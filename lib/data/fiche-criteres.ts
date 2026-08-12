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
  estimated_value?: number
  score_label?: string
  lmia_positions?: number
  /**
   * Le TYPE de fiche : « b2c » ou « b2b » pour un prospect, « individual » ou
   * « employer » pour un client. Un seul champ pour les deux vocabulaires
   * aurait mélangé les deux tables ; deux champs distincts se seraient
   * désynchronisés à la conversion.
   */
  type?: string
  client_type?: string
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
  lmia_positions: "Postes visés",
  client_type: "Type de client",
  type: "Type de prospect",
  score_label: "Faisabilité",
  contact_intent: "Intention de contact",
  source: "Origine",
}

export const libelleChamp = (champ: string): string => LIBELLES_CHAMPS[champ] ?? champ

/**
 * Les champs sans lesquels une fiche ne sert à rien.
 *
 * Volontairement COURTE. Un formulaire qui exige quinze champs à la création
 * fait inventer des réponses — et une nationalité inventée vaut moins qu'une
 * nationalité absente, parce qu'elle a l'air renseignée. Le reste se complète
 * quand on l'apprend : c'est tout l'objet du formulaire de modification.
 *
 * Le nom et le courriel suffisent : sans nom on ne retrouve personne, sans
 * courriel on ne peut ni envoyer un questionnaire ni ouvrir un portail.
 */
export const CHAMPS_REQUIS: (keyof ChampsFiche)[] = ["last_name", "email"]

/**
 * La validation d'un champ, telle que l'écran et le serveur la voient.
 *
 * Module PUR, et c'est la même raison que partout ailleurs : le formulaire
 * valide dans le navigateur pour donner une réponse immédiate, l'action valide
 * sur le serveur parce qu'elle reste appelable sans l'écran. Deux
 * implémentations auraient fini par accepter d'un côté ce que l'autre refuse.
 *
 * Rend un message EN FRANÇAIS ou rien. Un code d'erreur obligerait chaque
 * appelant à le traduire, et l'un d'eux oublierait.
 */
export function valider(champ: keyof ChampsFiche, valeur: string): string | null {
  const v = (valeur ?? "").trim()

  if (CHAMPS_REQUIS.includes(champ) && !v) {
    return `${libelleChamp(champ)} est obligatoire.`
  }
  if (!v) return null

  switch (champ) {
    case "email":
    case "email_secondary":
      // Volontairement PERMISSIVE : une adresse valide selon la norme est bien
      // plus large que ce qu'un motif strict accepte, et refuser une adresse
      // réelle est pire que laisser passer une faute de frappe — le courriel
      // reviendra en erreur, la fiche non.
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? null : "Ce courriel semble incomplet."

    case "postal_code":
      // Le format canadien seulement quand le code EN A la forme. Un code
      // postal français ou marocain ne doit pas être refusé — un cabinet
      // d'immigration a des clients qui n'habitent pas encore au Canada.
      if (/^[a-z]/i.test(v) && !/^[a-z]\d[a-z][ -]?\d[a-z]\d$/i.test(v)) {
        return "Format attendu : A1A 1A1."
      }
      return null

    case "phone":
    case "phone_secondary":
      // Au moins sept chiffres : c'est le plus court numéro joignable. On ne
      // contraint ni l'indicatif ni la ponctuation, qui varient d'un pays à
      // l'autre.
      return (v.match(/\d/g) ?? []).length >= 7 ? null : "Ce numéro semble incomplet."

    case "birth_date": {
      const d = new Date(v)
      if (Number.isNaN(d.getTime())) return "Date invalide."
      // Une date de naissance dans le futur est une faute de frappe, jamais une
      // donnée. Elle fausserait le calcul d'âge d'un enfant à charge.
      if (d.getTime() > Date.now()) return "Cette date est dans le futur."
      return null
    }

    default:
      return null
  }
}

/** Tous les manques d'une fiche, pour refuser une création incomplète. */
export function validerFiche(champs: ChampsFiche): Partial<Record<keyof ChampsFiche, string>> {
  const erreurs: Partial<Record<keyof ChampsFiche, string>> = {}
  const aControler: (keyof ChampsFiche)[] = [
    ...CHAMPS_REQUIS,
    "email", "email_secondary", "phone", "phone_secondary", "postal_code", "birth_date",
  ]
  for (const champ of new Set(aControler)) {
    const message = valider(champ, String(champs[champ] ?? ""))
    if (message) erreurs[champ] = message
  }
  return erreurs
}

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
