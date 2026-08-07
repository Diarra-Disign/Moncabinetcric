/**
 * Catalogue des abonnements.
 *
 * Source unique des prix, des places et des avantages. La page publique, la
 * console d'exploitation et l'écran d'abonnement du cabinet lisent tous ici :
 * un prix affiché à un endroit et facturé à un autre est le genre d'écart
 * qu'on ne découvre que par une réclamation.
 *
 * Ce module ne fait pas autorité sur les droits. Les limites qui comptent —
 * places, connecteur — sont dans `plan_limits`, en base, parce qu'elles sont
 * appliquées par des déclencheurs SQL. Ce qui suit sert à afficher et à
 * facturer ; ce qui refuse est ailleurs. Les deux doivent concorder, et la
 * migration 20260807100000 porte les mêmes valeurs.
 *
 * Règle tenue depuis la reprise de la page publique : rien n'est annoncé ici
 * qui ne soit ni construit ni appliqué. Pas de quota de stockage, pas de
 * plafond de dossiers, pas d'« intégration fiscale » — ces promesses ont été
 * retirées faute d'existence, et n'y reviendront qu'avec le code qui les tient.
 */

export type PlanId = "solo" | "cabinet"
export type Cadence = "monthly" | "annual"

export interface Plan {
  id: PlanId
  /** Montants en cents CAD : la devise n'a pas de fractions plus fines, et
   *  Stripe ne parle qu'en plus petite unité. Aucun flottant nulle part. */
  monthly: number
  annual: number
  /** Place supplémentaire, en cents par mois. Zéro quand le plan n'en vend pas. */
  extraSeatMonthly: number
  extraSeatAnnual: number
  /** Places comprises dans le prix de base. */
  seatsIncluded: number
  /** null = sans limite. Doit refléter plan_limits.max_seats. */
  maxSeats: number | null
  aiConnector: boolean
}

export const DEVISE = "cad"

/**
 * Douze mois payés dix. Le rabais annuel n'est pas une générosité : un
 * prélèvement annuel coûte une commission au lieu de douze, et supprime onze
 * occasions qu'une carte expire au mauvais moment.
 */
const MOIS_OFFERTS = 2

export const PLANS: Record<PlanId, Plan> = {
  solo: {
    id: "solo",
    monthly: 4900,
    annual: 4900 * (12 - MOIS_OFFERTS),
    extraSeatMonthly: 0,
    extraSeatAnnual: 0,
    seatsIncluded: 1,
    maxSeats: 1,
    aiConnector: false,
  },
  cabinet: {
    id: "cabinet",
    monthly: 7900,
    annual: 7900 * (12 - MOIS_OFFERTS),
    extraSeatMonthly: 2500,
    extraSeatAnnual: 2500 * (12 - MOIS_OFFERTS),
    seatsIncluded: 3,
    maxSeats: null,
    aiConnector: true,
  },
}

export function estPlanPayant(plan: string): plan is PlanId {
  return plan === "solo" || plan === "cabinet"
}

/**
 * Prix total d'un abonnement, places supplémentaires comprises.
 *
 * `places` est le nombre total de comptes, pas le nombre d'extras : c'est ce
 * que compte `firm_seats_taken()`, et raisonner sur deux unités différentes
 * de part et d'autre du paiement finit toujours par produire un écart d'une
 * place.
 */
export function montant(plan: PlanId, cadence: Cadence, places: number): number {
  const p = PLANS[plan]
  const base = cadence === "annual" ? p.annual : p.monthly
  const extraUnitaire = cadence === "annual" ? p.extraSeatAnnual : p.extraSeatMonthly
  const extras = Math.max(0, places - p.seatsIncluded)
  return base + extras * extraUnitaire
}

/** « 49,00 $ » en français, « $49.00 » en anglais. */
export function formatMontant(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale === "en" ? "en-CA" : "fr-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100)
}

/**
 * Prix mensuel équivalent d'un abonnement annuel, pour l'afficher en regard
 * du mensuel. Sans lui, on compare 490 $ à 49 $ et la comparaison ne veut
 * rien dire.
 */
export function equivalentMensuel(plan: PlanId): number {
  return Math.round(PLANS[plan].annual / 12)
}

/** Économie annuelle, en cents. */
export function economieAnnuelle(plan: PlanId): number {
  return PLANS[plan].monthly * 12 - PLANS[plan].annual
}
