/**
 * Forme d'un forfait, et calculs qui s'y appliquent.
 *
 * Ce module ne contient PLUS aucun prix. Ils vivaient ici, en dur, et le
 * catalogue Stripe comme la page publique en dépendaient : changer un tarif
 * demandait un déploiement, et ajouter un palier demandait de modifier une
 * contrainte SQL en plus. Les montants sont désormais dans `plan_limits`, en
 * base, modifiables depuis la console d'exploitation — voir `catalogue.ts`,
 * qui les lit.
 *
 * Ce qui reste ici est volontairement pur : aucune entrée-sortie, donc
 * utilisable des deux côtés de la frontière serveur/client. Un composant
 * client reçoit ses forfaits en propriétés et se sert des mêmes fonctions que
 * le serveur pour les afficher — c'est ce qui garantit qu'un montant affiché
 * et un montant facturé sont calculés par le même code.
 */

export type Cadence = "monthly" | "annual"

export interface Plan {
  key: string
  labelFr: string
  labelEn: string
  taglineFr: string
  taglineEn: string
  rank: number
  /** Souscriptible par le cabinet lui-même. Faux pour essai, courtoisie, entreprise. */
  purchasable: boolean
  /** Cents CAD. null = pas de tarif public (sur mesure ou accordé à la main). */
  monthly: number | null
  annual: number | null
  extraSeatMonthly: number
  extraSeatAnnual: number
  seatsIncluded: number
  /** null = sans limite. */
  maxSeats: number | null
  aiConnector: boolean
}

export const DEVISE = "cad"

/** Le forfait porte-t-il un tarif public ? */
export function estTarife(p: Plan): boolean {
  return p.monthly !== null && p.annual !== null
}

/**
 * Prix total d'un abonnement, places supplémentaires comprises.
 *
 * `places` est le nombre TOTAL de comptes, pas le nombre d'extras : c'est ce
 * que compte firm_seats_taken(), et raisonner sur deux unités différentes de
 * part et d'autre du paiement finit toujours par produire un écart d'une place.
 */
export function montant(p: Plan, cadence: Cadence, places: number): number {
  const base = (cadence === "annual" ? p.annual : p.monthly) ?? 0
  const extraUnitaire = cadence === "annual" ? p.extraSeatAnnual : p.extraSeatMonthly
  const extras = Math.max(0, places - p.seatsIncluded)
  return base + extras * extraUnitaire
}

/** « 49 $ » en français, « $49 » en anglais. */
export function formatMontant(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale === "en" ? "en-CA" : "fr-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100)
}

/**
 * Prix mensuel équivalent d'un abonnement annuel.
 *
 * Sans lui, l'œil compare 490 $ à 49 $ et la comparaison ne veut rien dire.
 */
export function equivalentMensuel(p: Plan): number {
  return Math.round((p.annual ?? 0) / 12)
}

/** Économie annuelle, en cents. */
export function economieAnnuelle(p: Plan): number {
  return (p.monthly ?? 0) * 12 - (p.annual ?? 0)
}

/** Libellé dans la langue de l'utilisateur. */
export function libelle(p: Plan, locale: string): string {
  return locale === "en" ? p.labelEn : p.labelFr
}

export function accroche(p: Plan, locale: string): string {
  return locale === "en" ? p.taglineEn : p.taglineFr
}

/**
 * Un abonnement dans cet état donne-t-il des droits ?
 *
 * Réplique EXACTE de la condition de `firm_effective_plan()` et de
 * `firm_access_open()`, côté base. Les deux doivent dire la même chose : une
 * console qui annonce un effet que la base ne produira pas est pire qu'une
 * console muette — l'exploitant clique, ne vérifie pas, et croit avoir agi.
 *
 * Le délai de grâce couvre l'impayé le temps que Stripe réessaie. Passé lui,
 * les droits tombent, même si la ligne d'abonnement existe toujours.
 */
export function abonnementCouvre(
  statut: string,
  graceJusqua: string,
  maintenant: Date = new Date()
): boolean {
  if (statut === "active" || statut === "trialing") return true
  if (statut !== "past_due" && statut !== "unpaid") return false
  if (!graceJusqua) return false
  const fin = new Date(graceJusqua)
  return !Number.isNaN(fin.getTime()) && fin >= maintenant
}

/**
 * Ce que produira réellement l'octroi d'un plan depuis la console.
 *
 * ─── POURQUOI CETTE FONCTION EXISTE ────────────────────────────────────────
 *
 * Accorder « courtoisie » ou « essai » écrit `firms.plan`, et rien d'autre.
 * Or trois conditions séparent cette écriture d'un accès réellement rouvert,
 * et deux d'entre elles la rendent SANS AUCUN EFFET VISIBLE :
 *
 *   · le cabinet est suspendu — `firm_access_open()` exige `status = 'active'`
 *     avant même de regarder le plan ; l'octroi est écrit et ne rouvre rien ;
 *   · le cabinet paie encore — `firm_effective_plan()` fait primer
 *     l'abonnement sur le plan accordé, donc les droits ne bougent pas.
 *
 * Dans les deux cas, la console afficherait « Plan passé à courtoisie » et
 * l'exploitant en conclurait que c'est réglé. Il ne le saurait qu'au prochain
 * appel du consultant.
 *
 * On ne se contente donc pas d'ouvrir le contrôle : on dit ce qu'il fera.
 */
export type EffetOctroi =
  /** Le cabinet est suspendu : lever la suspension d'abord. */
  | "suspendu"
  /** Un abonnement en règle prime : les droits ne changeront pas. */
  | "abonnement-prime"
  /** Rien ne prime : l'octroi rouvre effectivement l'accès. */
  | "rouvre"

export function effetOctroi(opts: {
  statutCabinet: string
  statutAbonnement: string
  graceJusqua: string
  maintenant?: Date
}): EffetOctroi {
  // L'ordre porte la règle : la suspension est vérifiée en premier parce
  // qu'elle est souveraine, y compris sur un cabinet parfaitement à jour.
  if (opts.statutCabinet === "suspended") return "suspendu"
  if (abonnementCouvre(opts.statutAbonnement, opts.graceJusqua, opts.maintenant)) {
    return "abonnement-prime"
  }
  return "rouvre"
}
