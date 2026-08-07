import "server-only"

import Stripe from "stripe"
import { PLANS, DEVISE, type PlanId, type Cadence } from "./plans"

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
 * Montant catalogue d'une ligne de facturation, en cents.
 *
 * Une seule fonction pour les quatre combinaisons, afin que le montant
 * facturé et le montant vérifié soient littéralement calculés par le même
 * code. Deux expressions équivalentes écrites à deux endroits finissent par
 * diverger, et la divergence ne se voit que sur une facture.
 */
function montantCatalogue(plan: PlanId, cadence: Cadence, extra: boolean): number {
  const p = PLANS[plan]
  if (extra) return cadence === "annual" ? p.extraSeatAnnual : p.extraSeatMonthly
  return cadence === "annual" ? p.annual : p.monthly
}

/** Clé de recherche du tarif chez Stripe. Stable, et unique par compte. */
export function cleTarif(plan: PlanId, cadence: Cadence, extra: boolean): string {
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
async function tarif(plan: PlanId, cadence: Cadence, extra: boolean): Promise<string> {
  const sdk = stripe()
  const cle = cleTarif(plan, cadence, extra)
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
              ? `${etiquette(plan)} — place supplémentaire`
              : `moncabinetcric — ${etiquette(plan)}`,
          },
        }),
    // Le logiciel infonuagique est taxable au Canada ; le code précis relève
    // du tableau de bord Stripe Tax, pas d'ici.
    tax_behavior: "exclusive",
  })

  return prix.id
}

function etiquette(plan: PlanId): string {
  return plan === "solo" ? "Solo" : "Cabinet Pro"
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
 * Carte ET prélèvement préautorisé canadien. Le second est proposé parce
 * qu'il coûte 1 % plafonné plutôt que 2,9 % + 0,30 $ — sur un abonnement
 * mensuel, l'écart n'est pas anecdotique — et parce qu'un compte bancaire
 * n'expire pas, là où une carte expire tous les trois ans, toujours un jour
 * où personne ne surveille.
 */
export async function sessionPaiement(params: {
  customerId: string
  plan: PlanId
  cadence: Cadence
  places: number
  firmId: string
  retourOk: string
  retourAnnule: string
  langue: string
}): Promise<string> {
  const sdk = stripe()
  const p = PLANS[params.plan]

  const lignes: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    { price: await tarif(params.plan, params.cadence, false), quantity: 1 },
  ]

  const extras = Math.max(0, params.places - p.seatsIncluded)
  if (extras > 0 && p.extraSeatMonthly > 0) {
    lignes.push({ price: await tarif(params.plan, params.cadence, true), quantity: extras })
  }

  const session = await sdk.checkout.sessions.create({
    mode: "subscription",
    customer: params.customerId,
    line_items: lignes,
    locale: params.langue === "en" ? "en" : "fr-CA",
    currency: DEVISE,

    payment_method_types: ["card", "acss_debit"],
    payment_method_options: {
      acss_debit: {
        currency: "cad",
        mandate_options: {
          // Prélèvement récurrent d'un cabinet : « business », et non
          // « personal ». La distinction figure sur le mandat que Stripe fait
          // signer, et les règles de Paiements Canada n'y attachent pas les
          // mêmes délais de contestation.
          payment_schedule: "interval",
          interval_description:
            params.cadence === "annual" ? "Une fois par année" : "Une fois par mois",
          transaction_type: "business",
        },
        verification_method: "automatic",
      },
    },

    subscription_data: {
      metadata: { firm_id: params.firmId, plan: params.plan, cadence: params.cadence },
      // Le prélèvement préautorisé met jusqu'à cinq jours ouvrables à se
      // confirmer la première fois. Sans ces quelques jours, l'abonnement
      // resterait « incomplete » et le cabinet, qui vient pourtant de signer
      // son mandat, se verrait refuser l'entrée toute une semaine.
      trial_period_days: 7,
    },
    // Le moyen de paiement se recueille malgré la période d'essai : c'est tout
    // l'objet de la manœuvre.
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
