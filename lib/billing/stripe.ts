import "server-only"

import Stripe from "stripe"
import { DEVISE, type Cadence, type Plan } from "./plans"

/**
 * Accès à Stripe.
 *
 * Le client est créé à la demande et non au chargement du module : sans cela,
 * toute page de l'application planterait sur une installation où la clé n'est
 * pas encore posée — y compris la page publique, qui n'a rien à voir avec le
 * paiement.
 *
 * La clé secrète n'est lue que dans ce fichier, qui est `server-only`. Elle ne
 * traverse jamais une action de serveur ni un composant.
 */

let client: Stripe | null = null

export function stripeConfigure(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

export function stripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error(
      "STRIPE_SECRET_KEY absente de .env.local : le paiement ne peut pas être ouvert."
    )
  }
  if (!client) {
    client = new Stripe(process.env.STRIPE_SECRET_KEY, {
      // Repéré dans le tableau de bord Stripe à côté de chaque requête : sans
      // cela, tous les appels de toutes les applications se ressemblent.
      appInfo: { name: "moncabinetcric" },
      maxNetworkRetries: 2,
    })
  }
  return client
}

/**
 * La taxe est-elle calculée par Stripe ?
 *
 * Volontairement derrière une variable d'environnement plutôt qu'activée
 * d'office : Stripe Tax refuse la session tant que l'inscription fiscale n'est
 * pas déclarée dans le tableau de bord. Activée à l'aveugle, elle
 * transformerait chaque tentative de paiement en erreur, sans que le message
 * dise pourquoi.
 */
function taxeAutomatique(): boolean {
  return process.env.STRIPE_AUTOMATIC_TAX === "1"
}

/**
 * NE PAS AJOUTER acss_debit NI AUCUN AUTRE MOYEN ICI.
 *
 * Stripe le refuse en mode « subscription » :
 *   « The payment method `acss_debit` cannot be used in `subscription` mode. »
 *
 * Vérifié le 2026-08-09 sur cinq combinaisons, contre le compte de production.
 * Le refus ne dépend ni de l'agrément du compte, ni de la configuration
 * d'affichage : les deux annonçaient « actif ». Seule la tentative le révèle.
 *
 * Et comme Stripe valide la liste des moyens D'UN BLOC, le refus emporte la
 * carte avec lui : le tunnel de paiement entier devient inutilisable, sans
 * qu'aucun message ne parle du moyen fautif.
 *
 * Avant d'en ajouter un, l'éprouver :  ./cric stripe-config --checkout --appliquer
 */

/**
 * Montant catalogue d'une ligne de facturation, en cents.
 *
 * Une seule fonction pour les quatre combinaisons, afin que le montant
 * facturé et le montant vérifié soient littéralement calculés par le même
 * code. Deux expressions équivalentes écrites à deux endroits finissent par
 * diverger, et la divergence ne se voit que sur une facture.
 */
function montantCatalogue(p: Plan, cadence: Cadence, extra: boolean): number {
  if (extra) return cadence === "annual" ? p.extraSeatAnnual : p.extraSeatMonthly
  return (cadence === "annual" ? p.annual : p.monthly) ?? 0
}

/** Clé de recherche du tarif chez Stripe. Stable, et unique par compte. */
export function cleTarif(plan: string, cadence: Cadence, extra: boolean): string {
  return `mcc_${plan}_${cadence}${extra ? "_place" : ""}`
}

/**
 * Identifiant du tarif chez Stripe, créé ou renouvelé au besoin.
 *
 * Rien à configurer à la main dans le tableau de bord : la clé de recherche
 * (`lookup_key`) rend l'opération idempotente.
 *
 * Le montant du tarif retrouvé est RELU et comparé au catalogue avant d'être
 * réutilisé. C'est le cœur de la garantie « on facture le prix affiché », et
 * ça manquait : la version précédente retournait le tarif portant la bonne
 * clé sans jamais regarder son montant.
 *
 * Le scénario était concret. Un tarif chez Stripe est immuable — on ne peut
 * pas en changer le montant. Le jour où l'on modifie un prix dans
 * `plans.ts`, la page publique affiche aussitôt le nouveau ; la recherche par
 * clé, elle, retrouvait l'ancien tarif et le facturait. Le client voyait 59 $
 * et payait 49 $, sans qu'aucune erreur ne se produise nulle part. Rien
 * n'aurait signalé l'écart, ni au client, ni ici.
 *
 * `transfer_lookup_key` déplace la clé de l'ancien tarif vers le nouveau :
 * l'ancien reste attaché aux abonnements en cours — un abonné garde le prix
 * auquel il a souscrit, ce qui est le comportement attendu — mais plus aucune
 * souscription nouvelle ne s'y accroche.
 */
async function tarif(plan: Plan, cadence: Cadence, extra: boolean): Promise<string> {
  const sdk = stripe()
  const cle = cleTarif(plan.key, cadence, extra)
  const montant = montantCatalogue(plan, cadence, extra)
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
    // Reprend la clé au tarif périmé, s'il en existe un. Sans cela, Stripe
    // refuserait la création : une clé de recherche est unique par compte.
    ...(trouve ? { transfer_lookup_key: true } : {}),
    currency: DEVISE,
    unit_amount: montant,
    recurring: { interval: intervalle },
    // Le produit est réutilisé quand il existe déjà, pour ne pas empiler un
    // produit par changement de prix dans le catalogue Stripe.
    ...(trouve && typeof trouve.product === "string"
      ? { product: trouve.product }
      : {
          product_data: {
            name: extra
              ? `${plan.labelFr} — place supplémentaire`
              : `moncabinetcric — ${plan.labelFr}`,
          },
        }),
    // Le logiciel infonuagique est taxable au Canada ; le code précis relève
    // du tableau de bord Stripe Tax, pas d'ici.
    tax_behavior: "exclusive",
  })

  return prix.id
}

/**
 * Le client Stripe correspondant au cabinet, créé au besoin.
 *
 * L'identifiant du cabinet est posé en métadonnée. C'est par lui que le
 * webhook retrouvera qui payer : il ne fait jamais confiance à un paramètre
 * d'URL de retour, qu'un navigateur peut fabriquer.
 */
export async function clientStripe(params: {
  firmId: string
  nom: string
  courriel: string
  existant?: string | null
}): Promise<string> {
  const sdk = stripe()

  if (params.existant) {
    // Un client supprimé côté Stripe laisserait un identifiant mort en base.
    const recupere = await sdk.customers.retrieve(params.existant).catch(() => null)
    if (recupere && !("deleted" in recupere && recupere.deleted)) return params.existant
  }

  const c = await sdk.customers.create({
    name: params.nom,
    email: params.courriel,
    metadata: { firm_id: params.firmId },
    preferred_locales: ["fr-CA", "en-CA"],
  })
  return c.id
}

/**
 * Ouvre une session de paiement hébergée par Stripe.
 *
 * Carte de crédit uniquement — voir la note ci-dessus, qui explique pourquoi
 * et comment le vérifier avant d'en ajouter un autre.
 */
export async function sessionPaiement(params: {
  customerId: string
  /** Forfait tel qu'il figure au catalogue en base, jamais une clé nue. */
  plan: Plan
  cadence: Cadence
  places: number
  firmId: string
  retourOk: string
  retourAnnule: string
  langue: string
}): Promise<string> {
  const sdk = stripe()
  const p = params.plan

  const lignes: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    { price: await tarif(p, params.cadence, false), quantity: 1 },
  ]

  const extras = Math.max(0, params.places - p.seatsIncluded)
  if (extras > 0 && p.extraSeatMonthly > 0) {
    lignes.push({ price: await tarif(p, params.cadence, true), quantity: extras })
  }

  const session = await sdk.checkout.sessions.create({
    mode: "subscription",
    customer: params.customerId,
    line_items: lignes,
    locale: params.langue === "en" ? "en" : "fr-CA",
    currency: DEVISE,

    // Carte seule. Voir l'explication au-dessus de cette fonction : Stripe
    // refuse tout autre moyen en mode « subscription », et le refus emporte
    // la carte avec lui.
    payment_method_types: ["card"],

    subscription_data: {
      metadata: { firm_id: params.firmId, plan: p.key, cadence: params.cadence },
      // Aucune période d'essai. Elle n'existait que pour couvrir les cinq
      // jours ouvrables de confirmation d'un mandat bancaire ; une carte se
      // confirme en deux secondes, et l'accorder serait une semaine donnée
      // sans raison.
    },
    payment_method_collection: "always",

    ...(taxeAutomatique()
      ? {
          automatic_tax: { enabled: true },
          tax_id_collection: { enabled: true },
          customer_update: { address: "auto", name: "auto" },
        }
      : {}),

    success_url: params.retourOk,
    cancel_url: params.retourAnnule,
    // Métadonnée doublée sur la session : si l'abonnement échouait à se créer,
    // l'événement de session porterait encore de quoi savoir qui paie.
    metadata: { firm_id: params.firmId },
  })

  if (!session.url) throw new Error("Stripe n'a pas renvoyé d'adresse de paiement.")
  return session.url
}

/**
 * Portail client Stripe : changer de carte, passer au prélèvement bancaire,
 * télécharger ses factures, résilier.
 *
 * Tout cela se fait chez Stripe, sans qu'aucun écran d'ici n'ait à recueillir
 * de coordonnées bancaires — ce qui tient l'application hors du champ PCI le
 * plus lourd, dans une base qui contient par ailleurs des dossiers
 * d'immigration.
 */
export async function sessionPortail(params: {
  customerId: string
  retour: string
  langue: string
}): Promise<string> {
  const sdk = stripe()
  const session = await sdk.billingPortal.sessions.create({
    customer: params.customerId,
    return_url: params.retour,
    locale: params.langue === "en" ? "en" : "fr-CA",
  })
  return session.url
}

/**
 * Retrouve l'abonnement Stripe actif (ou en essai) d'un client.
 *
 * Renvoie `null` s'il n'en existe aucun : le flux de première souscription
 * reprend alors normalement par session Checkout.
 */
export async function abonnementActifStripe(
  customerId: string
): Promise<Stripe.Subscription | null> {
  const sdk = stripe()
  const { data } = await sdk.subscriptions.list({
    customer: customerId,
    status: "active",
    limit: 1,
  })
  if (data[0]) return data[0]

  // Un abonnement en période d'essai n'a pas le statut « active ».
  const essai = await sdk.subscriptions.list({
    customer: customerId,
    status: "trialing",
    limit: 1,
  })
  return essai.data[0] ?? null
}

/**
 * Change le forfait d'un abonnement Stripe existant.
 *
 * Stripe refuse un second abonnement pour le même client : passer d'un forfait
 * à l'autre se fait donc en remplaçant les lignes de facturation, et non par
 * une nouvelle session Checkout. Le prorata est appliqué — Stripe crédite la
 * période restante de l'ancien forfait et facture la différence du nouveau.
 *
 * ---------------------------------------------------------------------------
 * TROIS CHOSES QUE CETTE FONCTION NE FAIT PLUS
 * ---------------------------------------------------------------------------
 *
 * 1. Elle ne finit plus par une redirection vers le portail client. Le portail
 *    exige une configuration enregistrée dans le tableau de bord Stripe ;
 *    tant qu'elle n'existe pas, cet appel LÈVE. Le changement de forfait,
 *    lui, avait déjà eu lieu — l'écran annonçait donc un échec sur une
 *    opération réussie et facturée. C'est exactement ce que voyait
 *    l'utilisateur qui tentait de revenir à un autre forfait.
 *
 * 2. Elle ne supprime plus aveuglément tout ce qui suit la première ligne. Ce
 *    balayage emportait les lignes de places par rôle, qu'une synchronisation
 *    ultérieure recréait : deux écritures, donc deux proratisations sur la
 *    facture, pour une seule décision du cabinet. Les lignes voulues sont
 *    maintenant calculées par l'appelant et posées dans la MÊME écriture.
 *
 * 3. Elle ne devine plus la ligne de base par sa position. `items.data[0]`
 *    n'est pas garanti d'être le forfait : c'est la clé de recherche qui le
 *    dit, une ligne de place contenant toujours `_place`.
 *
 * Renvoie l'abonnement tel que Stripe le rend après modification : c'est lui
 * qui fait foi, pas ce que l'écran avait demandé.
 */
export async function changerForfait(params: {
  subscriptionId: string
  plan: Plan
  cadence: Cadence
  firmId: string
  /** Lignes de places voulues, calculées par `calculerLignesPlaces()`. */
  lignesPlaces: { price: string; quantity: number }[]
}): Promise<Stripe.Subscription> {
  const sdk = stripe()
  const sub = await sdk.subscriptions.retrieve(params.subscriptionId)
  const p = params.plan

  const prixBase = await tarif(p, params.cadence, false)
  const items: Stripe.SubscriptionUpdateParams.Item[] = []

  const estPlace = (i: Stripe.SubscriptionItem) => (i.price?.lookup_key ?? "").includes("_place")
  const ligneBase = sub.items.data.find((i) => !estPlace(i))

  if (ligneBase) {
    items.push({ id: ligneBase.id, price: prixBase, quantity: 1 })
  } else {
    items.push({ price: prixBase, quantity: 1 })
  }

  // Les places voulues sont rapprochées par identifiant de tarif. Une ligne
  // déjà correcte n'est pas réécrite : chaque écriture ajoute une ligne de
  // proratisation à la facture du cabinet.
  const voulues = new Map(params.lignesPlaces.map((l) => [l.price, l.quantity]))

  for (const item of sub.items.data) {
    if (!estPlace(item)) continue
    const priceId = item.price?.id ?? ""
    const quantite = voulues.get(priceId)

    if (quantite === undefined) {
      // Appartient à l'ancien forfait, ou n'a plus lieu d'être.
      items.push({ id: item.id, deleted: true })
      continue
    }
    if (item.quantity !== quantite) items.push({ id: item.id, quantity: quantite })
    voulues.delete(priceId)
  }

  for (const [price, quantity] of voulues) items.push({ price, quantity })

  return sdk.subscriptions.update(params.subscriptionId, {
    items,
    proration_behavior: "create_prorations",
    metadata: { firm_id: params.firmId, plan: p.key, cadence: params.cadence },
  })
}
