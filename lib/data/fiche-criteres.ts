/**
 * Ce qu'une fiche client ou prospect porte, et ce qui appelle une confirmation.
 *
 * Module PUR — ni « server-only », ni « use server ». Le formulaire de
 * modification est un composant CLIENT : il a besoin de la liste des champs
 * sensibles pour décider s'il demande confirmation, et un module « use server »
 * ne peut exporter que des fonctions asynchrones. C'est la même raison qui a
 * fait sortir `variables.ts` et `dossiers-recents-criteres.ts` de leurs
 * modules d'actions.
 */

/** Les champs modifiables d'une fiche, quel que soit son type. */
export interface ChampsFiche {
  civility?: string | null
  first_name?: string
  last_name?: string
  legal_name?: string
  birth_date?: string | null
  email?: string
  email_secondary?: string
  phone?: string
  phone_secondary?: string
  address?: string
  address_line2?: string
  city?: string
  province?: string
  postal_code?: string
  country?: string
  notes?: string
  /** Client seulement. */
  program?: string
  citizenship?: string
  residence?: string
  intake_motif?: string
  neq_number?: string
  /** Prospect seulement. */
  company?: string
  visa_type?: string
  source?: string
  contact_intent?: string | null
}

/**
 * Les champs dont la modification appelle une confirmation (§7).
 *
 * Ce ne sont pas les champs « importants » au sens large : ce sont ceux qui
 * s'impriment sur un document opposable. Corriger une faute dans les notes
 * n'engage personne ; corriger un nom ou une adresse change ce que dira le
 * prochain contrat — et c'est cela qu'il faut annoncer avant d'enregistrer,
 * pas après.
 */
export const CHAMPS_SENSIBLES: (keyof ChampsFiche)[] = [
  "civility", "first_name", "last_name", "legal_name", "birth_date",
  "email", "address", "address_line2", "city", "province", "postal_code", "country",
]

/** Les libellés lisibles, partagés par le formulaire et par le journal. */
export const LIBELLES_CHAMPS: Record<string, string> = {
  civility: "Civilité",
  first_name: "Prénom",
  last_name: "Nom",
  legal_name: "Nom légal",
  name: "Nom complet",
  birth_date: "Date de naissance",
  email: "Courriel",
  email_secondary: "Courriel secondaire",
  phone: "Téléphone",
  phone_secondary: "Téléphone secondaire",
  address: "Adresse",
  address_line2: "Appartement / unité",
  city: "Ville",
  province: "Province",
  postal_code: "Code postal",
  country: "Pays",
  program: "Programme",
  visa_type: "Programme",
  status: "Statut",
  stage: "Étape",
  notes: "Notes",
  intake_motif: "Motif d'ouverture",
  citizenship: "Nationalité",
  residence: "Lieu de résidence",
  company: "Entreprise",
  neq_number: "NEQ",
  estimated_value: "Valeur estimée",
  score_label: "Faisabilité",
  contact_intent: "Intention de contact",
  source: "Origine",
}

export const libelleChamp = (champ: string): string => LIBELLES_CHAMPS[champ] ?? champ

/** Une entrée du journal, telle que l'écran la lit. */
export interface ChangementJournal {
  champ: string
  libelle: string
  avant: string
  apres: string
}

export interface EntreeJournal {
  id: string
  date: string
  action: string
  resume: string
  acteur: string
  changements: ChangementJournal[]
}
