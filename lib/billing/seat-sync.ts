import "server-only"

import { createClient } from "@supabase/supabase-js"
import { stripe, stripeConfigure } from "./stripe"
import { getPlan } from "./catalogue"
import { repartirSieges, cleTarifSiege, type PrixParRole, type ComptesParRole } from "./seats"
import { DEVISE, type Cadence, type Plan } from "./plans"

/**
 * Réconciliation des places facturées avec Stripe.
 *
 * Appelée après chaque changement d'effectif : invitation posée ou révoquée,
 * membre suspendu, réactivé, révoqué, rôle modifié. Elle compare ce que le
 * cabinet occupe à ce que Stripe facture, et ne touche QUE ce qui diffère.
 *
 * ---------------------------------------------------------------------------
 * TROIS PRÉCAUTIONS, ET LEURS RAISONS
 * ---------------------------------------------------------------------------
 *
 * 1. Elle ne fait rien sans abonnement Stripe en cours. Un cabinet en essai,
 *    en courtoisie, ou qui n'a jamais payé n'a pas de quantité à ajuster — et
 *    tenter d'en créer une lui ouvrirait une facturation que personne n'a
 *    demandée.
 *
 * 2. Elle ne modifie que les écarts. Réécrire une ligne identique déclenche
 *    chez Stripe une proratisation, donc une ligne sur la facture du client.
 *    Un cabinet qui change une adresse ne doit pas recevoir un ajustement de
 *    quelques cents pour autant.
 *
 * 3. Elle ne bloque jamais l'opération qui l'a déclenchée. Suspendre un membre
 *    doit fonctionner même si Stripe est injoignable : l'accès se ferme
 *    aussitôt, la facturation se rattrapera. L'inverse — refuser une
 *    suspension parce qu'un service de paiement est en panne — serait
 *    difficile à défendre auprès d'un cabinet qui vient de découvrir une
 *    irrégularité chez un collaborateur.
 */

export interface ResultatSync {
  /** Faux quand rien n'a été tenté : pas d'abonnement, Stripe non configuré. */
  applicable: boolean
  /** Vrai quand Stripe a été mis à jour. Faux si rien ne différait. */
  modifie: boolean
  message: string
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Configuration Supabase incomplète.")
  return createClient(url, key, { auth: { persistSession: false } })
}

/** Statuts d'abonnement pour lesquels ajuster une quantité a un sens. */
const AJUSTABLES = ["active", "trialing", "past_due"]

/**
 * Tarif Stripe d'une place occupée par ce rôle, créé au besoin.
 *
 * Même mécanique que `tarif()` dans stripe.ts, et pour la même raison : le
 * montant du tarif retrouvé est RELU et comparé au catalogue. Un tarif Stripe
 * est immuable ; sans cette relecture, un prix modifié dans la console
 * laisserait la clé de recherche pointer sur l'ancien montant, et le cabinet
 * paierait un prix que plus aucun écran n'affiche.
 */
async function tarifSiege(
  planKey: string,
  role: string,
  cadence: Cadence,
  montant: number,
  etiquette: string
): Promise<string> {
  const sdk = stripe()
  const cle = cleTarifSiege(planKey, role, cadence)
  const intervalle = cadence === "annual" ? "year" : "month"

  const existants = await sdk.prices.list({ lookup_keys: [cle], active: true, limit: 1 })
  const trouve = existants.data[0]

  if (
    trouve &&
    trouve.unit_amount === montant &&
    trouve.currency === DEVISE &&
    trouve.recurring?.interval === intervalle
  ) {
    return trouve.id
  }

  const prix = await sdk.prices.create({
    lookup_key: cle,
    ...(trouve ? { transfer_lookup_key: true } : {}),
    currency: DEVISE,
    unit_amount: montant,
    recurring: { interval: intervalle },
    ...(trouve && typeof trouve.product === "string"
      ? { product: trouve.product }
      : { product_data: { name: `moncabinetcric — place ${etiquette}` } }),
    tax_behavior: "exclusive",
  })

  return prix.id
}

/** Une ligne de places telle que Stripe l'attend. */
export interface LignePlaceStripe {
  price: string
  quantity: number
}

/**
 * Les lignes de places que ce cabinet devrait avoir sous ce forfait.
 *
 * Extrait de la synchronisation pour qu'un CHANGEMENT DE FORFAIT puisse s'en
 * servir aussi. Sans cela, le changement supprimait les lignes par rôle et une
 * synchronisation ultérieure les recréait : deux écritures chez Stripe, donc
 * deux proratisations sur la facture, pour une seule décision du cabinet.
 *
 * Lève si la base est injoignable — l'appelant décide, parce que les deux
 * appelants n'ont pas la même tolérance : une synchronisation de fond doit
 * échouer en silence, un changement de forfait doit s'arrêter net.
 */
export async function calculerLignesPlaces(params: {
  firmId: string
  plan: Plan
  cadence: Cadence
}): Promise<{ lignes: LignePlaceStripe[]; occupees: number }> {
  const { firmId, plan, cadence } = params
  const supabase = serviceClient()

  const [{ data: comptesBruts }, { data: grilleBrute }] = await Promise.all([
    supabase.rpc("firm_seat_counts", { f_id: firmId }),
    supabase.from("plan_seat_prices").select("plan, cicc_role, monthly_cents, annual_cents"),
  ])

  const comptes: ComptesParRole = {}
  for (const c of (comptesBruts as { cicc_role: string; n: number }[] | null) ?? []) {
    comptes[c.cicc_role] = c.n
  }

  const grille: PrixParRole = {}
  for (const g of grilleBrute ?? []) {
    if (g.plan !== plan.key) continue
    grille[g.cicc_role as string] = {
      monthly: (g.monthly_cents as number) ?? 0,
      annual: (g.annual_cents as number) ?? 0,
    }
  }

  const repartition = repartirSieges({ plan, comptes, cadence, grille })

  const lignes: LignePlaceStripe[] = []
  for (const l of repartition.lignes) {
    lignes.push({
      price: await tarifSiege(plan.key, l.ciccRole, cadence, l.unitaire, l.ciccRole),
      quantity: l.quantite,
    })
  }

  return { lignes, occupees: repartition.occupees }
}

/**
 * Aligne les lignes de l'abonnement Stripe sur l'effectif réel du cabinet.
 *
 * Ne lève jamais : le résultat est rendu, et l'appelant décide quoi en dire.
 */
export async function synchroniserSiegesStripe(firmId: string): Promise<ResultatSync> {
  try {
    if (!stripeConfigure()) {
      return { applicable: false, modifie: false, message: "Stripe n'est pas configuré." }
    }

    const supabase = serviceClient()

    const { data: abonnement } = await supabase
      .from("firm_subscriptions")
      .select("stripe_subscription_id, plan, cadence, status")
      .eq("firm_id", firmId)
      .maybeSingle()

    if (!abonnement?.stripe_subscription_id || !AJUSTABLES.includes(abonnement.status as string)) {
      // Précaution 1 : sans abonnement en cours, il n'y a pas de quantité à
      // ajuster, et en créer une ouvrirait une facturation non demandée.
      return {
        applicable: false,
        modifie: false,
        message: "Aucun abonnement Stripe en cours : rien à ajuster.",
      }
    }

    const plan = await getPlan(abonnement.plan as string)
    if (!plan) {
      return { applicable: false, modifie: false, message: "Forfait absent du catalogue." }
    }

    const cadence: Cadence = abonnement.cadence === "annual" ? "annual" : "monthly"

    const { lignes, occupees } = await calculerLignesPlaces({ firmId, plan, cadence })

    const sdk = stripe()
    const sub = await sdk.subscriptions.retrieve(abonnement.stripe_subscription_id as string)

    // La ligne de base du forfait n'est pas une ligne de place : on la
    // reconnaît à sa clé de recherche et on n'y touche jamais. La confondre
    // avec une place la ramènerait à zéro et offrirait le forfait.
    const lignesPlaces = sub.items.data.filter((i) =>
      (i.price?.lookup_key ?? "").includes("_place")
    )

    // Le rapprochement se fait sur l'IDENTIFIANT DE TARIF, et non sur le rôle
    // déduit de la clé de recherche. Le tarif porte à la fois le forfait, la
    // cadence et le rôle : après un changement de forfait, les anciennes
    // lignes ne se retrouvent donc pas dans les voulues et disparaissent
    // d'elles-mêmes. Comparer les rôles les aurait laissées en place, au prix
    // de l'ancien forfait.
    const voulues = new Map(lignes.map((l) => [l.price, l.quantity]))
    const modifications: { id?: string; price?: string; quantity: number; deleted?: boolean }[] = []

    // Ce qui existe chez Stripe et ne devrait plus, ou plus dans cette quantité.
    for (const item of lignesPlaces) {
      const priceId = item.price?.id ?? ""
      const quantiteVoulue = voulues.get(priceId)

      if (quantiteVoulue === undefined) {
        modifications.push({ id: item.id, quantity: 0, deleted: true })
        continue
      }
      // Précaution 2 : une ligne identique n'est pas réécrite. Chaque écriture
      // provoque une proratisation, donc une ligne sur la facture du client.
      if (item.quantity !== quantiteVoulue) {
        modifications.push({ id: item.id, quantity: quantiteVoulue })
      }
      voulues.delete(priceId)
    }

    // Ce qui devrait exister et n'existe pas encore.
    for (const [price, quantity] of voulues) {
      modifications.push({ price, quantity })
    }

    if (modifications.length === 0) {
      return {
        applicable: true,
        modifie: false,
        message: `Places à jour : ${occupees} occupée(s), ${lignes.reduce((t, l) => t + l.quantity, 0)} facturée(s).`,
      }
    }

    await sdk.subscriptions.update(abonnement.stripe_subscription_id as string, {
      items: modifications.map((m) =>
        m.deleted
          ? { id: m.id, deleted: true }
          : m.id
            ? { id: m.id, quantity: m.quantity }
            : { price: m.price, quantity: m.quantity }
      ),
      // Stripe calcule le crédit ou le complément au prorata du temps restant.
      // Le faire nous-mêmes reviendrait à réimplémenter une arithmétique de
      // dates que Stripe tient déjà, et dont les cas limites — changement de
      // fuseau, mois de 28 jours, année bissextile — se découvrent en
      // production.
      proration_behavior: "create_prorations",
    })

    // La quantité en base suit, pour que les écrans n'aient pas à interroger
    // Stripe pour afficher un nombre de places.
    //
    // C'est la CAPACITÉ payée qui s'écrit — places comprises au forfait, ou
    // effectif s'il les dépasse — et non l'effectif seul. Le webhook écrit
    // cette même grandeur : deux écrivains qui n'entendent pas la même chose
    // par « seats » se corrigeraient l'un l'autre à chaque événement.
    await supabase
      .from("firm_subscriptions")
      .update({
        seats: Math.max(occupees, plan.seatsIncluded, 1),
        updated_at: new Date().toISOString(),
      })
      .eq("firm_id", firmId)

    return {
      applicable: true,
      modifie: true,
      message: `${modifications.length} ligne(s) ajustée(s) chez Stripe. Proratisation appliquée.`,
    }
  } catch (e) {
    // Précaution 3 : jamais de levée. L'opération qui a déclenché cette
    // synchronisation — une suspension, une invitation — doit aboutir même si
    // Stripe est injoignable.
    return {
      applicable: true,
      modifie: false,
      message: `Synchronisation Stripe impossible : ${e instanceof Error ? e.message : "erreur inattendue"}`,
    }
  }
}
