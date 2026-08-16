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

/**
 * Pourquoi, exactement, cet accès est-il fermé ?
 *
 * ─── CE QUE L'ÉCRAN DISAIT AVANT ───────────────────────────────────────────
 *
 * Deux textes seulement, départagés par `plan === 'trial'` : « essai échu »,
 * ou — pour tout le reste — « L'accès de ce cabinet a été FERMÉ. […]
 * Contactez l'exploitant pour le rétablir. »
 *
 * Un consultant dont l'abonnement venait simplement de prendre fin lisait donc
 * qu'on lui avait fermé la porte. Ce n'est pas la même chose, et cela n'appelle
 * pas la même réaction : dans un cas il faut écrire à quelqu'un et attendre,
 * dans l'autre il suffit de reprendre un abonnement — l'écran le propose
 * quelques centimètres plus bas, et il ne le voyait pas.
 *
 * Le cas de l'impayé mérite d'être séparé du reste pour la même raison : la
 * carte a été refusée, le geste utile est de la remplacer, pas de souscrire à
 * nouveau ni d'écrire à l'éditeur.
 *
 * ─── L'ORDRE EST CELUI DE `firm_access_open()` ─────────────────────────────
 *
 * La suspension d'abord, parce qu'elle est souveraine : elle ferme un cabinet
 * parfaitement à jour de ses paiements, et lui proposer de payer serait
 * encaisser sans rouvrir.
 *
 * `ouvert` n'est pas un cas de repli commode : il signale que cette fonction
 * et la base ne disent pas la même chose. L'écran ne devrait alors pas être
 * affiché du tout.
 */
export type RaisonAccesFerme =
  /** Décision de l'exploitant. Payer ne la lèverait pas. */
  | "suspendu"
  /** Période d'essai échue. */
  | "essai-echu"
  /** Paiement refusé, délai de grâce épuisé : la carte est à remplacer. */
  | "paiement-en-souffrance"
  /** Abonnement résilié, ou jamais souscrit sur un forfait payant. */
  | "abonnement-termine"
  /** Rien ne justifie une fermeture — désaccord avec la base. */
  | "ouvert"

export function raisonAccesFerme(opts: {
  statutCabinet: string
  plan: string
  finEssai: string
  statutAbonnement: string
  graceJusqua: string
  maintenant?: Date
}): RaisonAccesFerme {
  const maintenant = opts.maintenant ?? new Date()

  if (opts.statutCabinet !== "active") return "suspendu"

  // La courtoisie n'a ni essai ni abonnement : elle ouvre par elle-même.
  if (opts.plan === "courtoisie") return "ouvert"

  if (opts.plan === "trial") {
    if (!opts.finEssai) return "ouvert"
    // Comparaison sur la DATE seule, comme `current_date` côté base : un essai
    // qui finit aujourd'hui vaut jusqu'à ce soir, pas jusqu'à minuit UTC.
    const aujourdhui = maintenant.toISOString().slice(0, 10)
    return opts.finEssai >= aujourdhui ? "ouvert" : "essai-echu"
  }

  if (abonnementCouvre(opts.statutAbonnement, opts.graceJusqua, maintenant)) return "ouvert"
  if (opts.statutAbonnement === "past_due" || opts.statutAbonnement === "unpaid") {
    return "paiement-en-souffrance"
  }
  return "abonnement-termine"
}

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
