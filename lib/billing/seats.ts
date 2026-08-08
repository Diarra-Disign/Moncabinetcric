import type { Cadence, Plan } from "./plans"

/**
 * Répartition des places facturables d'un cabinet.
 *
 * Volontairement pur : aucune entrée-sortie, aucun appel à Stripe, aucune
 * lecture de base. C'est ce qui permet de l'éprouver par des tests ordinaires,
 * et c'est indispensable ici — ce module décide de ce que des cabinets réels
 * paieront chaque mois. Un calcul de facturation qu'on ne peut vérifier qu'en
 * facturant quelqu'un ne se vérifie jamais.
 */

/** Prix d'une place selon le rôle de son occupant, en cents. */
export interface PrixParRole {
  [ciccRole: string]: { monthly: number; annual: number }
}

/** Ce que le cabinet occupe, par rôle. */
export interface ComptesParRole {
  [ciccRole: string]: number
}

/** Une ligne d'abonnement Stripe à obtenir. */
export interface LigneSiege {
  ciccRole: string
  quantite: number
  /** Prix unitaire en cents, dans la cadence demandée. */
  unitaire: number
}

export interface Repartition {
  lignes: LigneSiege[]
  /** Places absorbées par le forfait, donc non facturées. */
  comprises: number
  /** Total des places occupées, comprises incluses. */
  occupees: number
  /** Montant des places supplémentaires, hors prix de base du forfait. */
  supplement: number
}

/**
 * Prix unitaire d'une place occupée par ce rôle.
 *
 * Une absence de ligne dans `plan_seat_prices` renvoie au tarif générique du
 * forfait. Il n'est donc pas nécessaire de décrire six rôles pour six
 * forfaits : seuls les écarts se déclarent, et un rôle ajouté plus tard est
 * facturé au tarif générique plutôt que gratuitement — un oubli qui coûte au
 * cabinet vaut mieux qu'un oubli qui coûte à l'éditeur, parce que le premier
 * se réclame et se corrige, là où le second ne se voit jamais.
 */
export function prixDuRole(
  plan: Plan,
  role: string,
  cadence: Cadence,
  grille: PrixParRole
): number {
  const specifique = grille[role]
  if (specifique) return cadence === "annual" ? specifique.annual : specifique.monthly
  return cadence === "annual" ? plan.extraSeatAnnual : plan.extraSeatMonthly
}

/**
 * Quelles places le forfait absorbe, et ce qui reste à facturer.
 *
 * LE CHOIX QUI COMPTE : les places comprises absorbent les rôles LES PLUS
 * CHERS d'abord.
 *
 * Un forfait à trois places comprises, occupé par deux consultants à 25 $ et
 * deux adjointes à 15 $, peut absorber d'un côté ou de l'autre :
 *
 *   les plus chères d'abord → reste 1 adjointe    → 15 $
 *   les moins chères d'abord → reste 1 consultant → 25 $
 *
 * Dix dollars par mois séparent les deux, et rien dans l'énoncé « trois places
 * comprises » ne dit lesquelles. On tranche en faveur du cabinet, pour deux
 * raisons : c'est ce qu'un client suppose quand on ne le lui précise pas, et
 * l'inverse donnerait à l'éditeur un intérêt à ce que la règle reste floue.
 */
export function repartirSieges(params: {
  plan: Plan
  comptes: ComptesParRole
  cadence: Cadence
  grille: PrixParRole
}): Repartition {
  const { plan, comptes, cadence, grille } = params

  // Chaque place devient une unité, avec son prix. Raisonner par place et non
  // par groupe évite d'avoir à traiter le cas d'un groupe partiellement
  // absorbé — celui où les erreurs d'arrondi se logent.
  const places: { role: string; unitaire: number }[] = []
  for (const [role, n] of Object.entries(comptes)) {
    const unitaire = prixDuRole(plan, role, cadence, grille)
    for (let i = 0; i < n; i++) places.push({ role, unitaire })
  }

  // Tri décroissant, puis par rôle pour que deux exécutions sur les mêmes
  // données produisent exactement le même résultat : une répartition instable
  // enverrait à Stripe des modifications qui n'en sont pas, et chacune d'elles
  // déclenche une proratisation.
  places.sort((a, b) => b.unitaire - a.unitaire || a.role.localeCompare(b.role))

  const comprises = Math.min(plan.seatsIncluded, places.length)
  const facturables = places.slice(comprises)

  const parRole = new Map<string, LigneSiege>()
  for (const p of facturables) {
    const ligne = parRole.get(p.role)
    if (ligne) ligne.quantite += 1
    else parRole.set(p.role, { ciccRole: p.role, quantite: 1, unitaire: p.unitaire })
  }

  const lignes = [...parRole.values()].sort((a, b) => a.ciccRole.localeCompare(b.ciccRole))

  return {
    lignes,
    comprises,
    occupees: places.length,
    supplement: lignes.reduce((t, l) => t + l.quantite * l.unitaire, 0),
  }
}

/**
 * Montant total mensuel ou annuel d'un abonnement, base comprise.
 *
 * Sert à afficher, jamais à facturer : c'est Stripe qui facture, à partir des
 * lignes d'abonnement. Les deux doivent concorder, et c'est pourquoi ce calcul
 * part de la même répartition.
 */
export function montantTotal(plan: Plan, repartition: Repartition, cadence: Cadence): number {
  const base = (cadence === "annual" ? plan.annual : plan.monthly) ?? 0
  return base + repartition.supplement
}

/**
 * Clé de recherche du tarif Stripe pour une place d'un rôle donné.
 *
 * Le rôle entre dans la clé : sans lui, deux tarifs de montants différents se
 * disputeraient la même clé, et Stripe n'en garde qu'un par clé de recherche.
 */
export function cleTarifSiege(plan: string, role: string, cadence: Cadence): string {
  return `mcc_${plan}_${cadence}_place_${role}`
}
