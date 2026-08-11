/**
 * Les critères de recherche des dossiers récents — listes, types et bornes.
 *
 * Séparé de dossiers-recents.ts pour deux raisons, et la seconde est la plus
 * contraignante :
 *
 * 1. `bornesDeLaPeriode` est de la logique pure. Dans un module « server-only »
 *    elle serait inéprouvable — et c'est exactement le genre de calcul où une
 *    erreur d'un jour se glisse sans qu'on la voie.
 * 2. Les listes CHAMPS_DATE, TRIS et PERIODES sont affichées par un composant
 *    CLIENT. Un module « server-only » lève à l'import : elles ne peuvent pas
 *    vivre à côté de la lecture en base.
 */

/** Les dates sur lesquelles on peut chercher. Quatre, pas cinq — voir la migration. */
export const CHAMPS_DATE = [
  { valeur: "updated_at", libelle: "Dernière modification" },
  { valeur: "created_at", libelle: "Date de création" },
  { valeur: "opened_date", libelle: "Date d'ouverture" },
  { valeur: "deadline", libelle: "Prochaine échéance" },
] as const

export const TRIS = [
  { valeur: "date_desc", libelle: "Plus récents d'abord" },
  { valeur: "date_asc", libelle: "Plus anciens d'abord" },
  { valeur: "echeance", libelle: "Échéance la plus proche" },
  { valeur: "client", libelle: "Nom du client" },
  { valeur: "statut", libelle: "Statut" },
] as const

export type ChampDate = (typeof CHAMPS_DATE)[number]["valeur"]
export type Tri = (typeof TRIS)[number]["valeur"]

/** Les raccourcis de période du §4. « Période personnalisée » n'est pas ici :
 *  elle n'est pas un raccourci mais deux dates saisies. */
export const PERIODES = [
  { valeur: "tout", libelle: "Tout" },
  { valeur: "jour", libelle: "Aujourd'hui" },
  { valeur: "7j", libelle: "7 derniers jours" },
  { valeur: "30j", libelle: "30 derniers jours" },
  { valeur: "90j", libelle: "90 derniers jours" },
  { valeur: "annee", libelle: "Cette année" },
] as const

export type Periode = (typeof PERIODES)[number]["valeur"]

export interface DossierRecent {
  id: string
  reference: string
  clientName: string
  program: string
  category: string | null
  status: string
  openedDate: string | null
  deadline: string | null
  createdAt: string
  updatedAt: string
}

export interface PageDossiersRecents {
  dossiers: DossierRecent[]
  /** Nombre de dossiers CORRESPONDANTS, pas nombre rendu : sans lui on ne peut
   *  pas écrire « 8 sur 143 », et l'utilisateur ne sait pas s'il voit tout. */
  total: number
}

export interface CritèresDossiersRecents {
  champDate?: ChampDate
  periode?: Periode
  du?: string
  au?: string
  recherche?: string
  tri?: Tri
  limite?: number
}

/** Traduit un raccourci de période en bornes. Rendu séparément pour être
 *  éprouvable sans base : c'est la partie où une erreur d'un jour se glisse. */
export function bornesDeLaPeriode(
  periode: Periode,
  aujourdhui = new Date()
): { du: string | null; au: string | null } {
  const jour = (d: Date) => d.toISOString().slice(0, 10)
  const fin = jour(aujourdhui)
  const ilYA = (n: number) => {
    const d = new Date(aujourdhui)
    d.setDate(d.getDate() - n)
    return jour(d)
  }

  switch (periode) {
    case "jour":
      return { du: fin, au: fin }
    // 6 et non 7 : « les 7 derniers jours » inclut aujourd'hui. Compter 7 en
    // arrière en donnerait huit, et le total afficherait un jour de trop.
    case "7j":
      return { du: ilYA(6), au: fin }
    case "30j":
      return { du: ilYA(29), au: fin }
    case "90j":
      return { du: ilYA(89), au: fin }
    case "annee":
      return { du: `${aujourdhui.getFullYear()}-01-01`, au: fin }
    default:
      return { du: null, au: null }
  }
}


export interface DossierRecent {
  id: string
  reference: string
  clientName: string
  program: string
  category: string | null
  status: string
  openedDate: string | null
  deadline: string | null
  createdAt: string
  updatedAt: string
}

export interface PageDossiersRecents {
  dossiers: DossierRecent[]
  /** Nombre de dossiers CORRESPONDANTS, pas nombre rendu : sans lui on ne peut
   *  pas écrire « 8 sur 143 », et l'utilisateur ne sait pas s'il voit tout. */
  total: number
}
