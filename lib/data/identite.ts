/**
 * L'identité d'une personne, dite d'une seule façon dans tout le logiciel.
 *
 * La base stocke un CODE — « mr », « mrs » — jamais un libellé. Écrire
 * « Monsieur » en base obligerait à le traduire à chaque affichage anglais, et
 * à le comparer un jour à « Mr. », « M. » ou « Monsieur » selon qui l'a saisi.
 *
 * Ce fichier est le seul endroit où un code devient du texte. Un contrat, un
 * questionnaire, un courriel et une fiche client y puisent la même formule :
 * sans cela, le même client serait « Monsieur Diarra » sur l'entente et
 * « Diarra » sur la facture, et c'est le genre d'écart qu'on ne remarque que
 * lorsqu'un client le fait remarquer.
 *
 * Pas de « server-only » ici : ces libellés s'affichent aussi dans le
 * navigateur, et la moitié de leur intérêt serait perdue s'il fallait les
 * recopier côté client.
 */

export type Civilite = "mr" | "mrs" | "mx" | "other"

export const CIVILITES: { valeur: Civilite; fr: string; en: string; abrege: string }[] = [
  { valeur: "mr", fr: "Monsieur", en: "Mr.", abrege: "M." },
  { valeur: "mrs", fr: "Madame", en: "Mrs.", abrege: "Mme" },
  // Mx : la civilité neutre reconnue au Canada. Proposée, jamais imposée —
  // le champ reste facultatif de bout en bout.
  { valeur: "mx", fr: "Mx", en: "Mx", abrege: "Mx" },
  { valeur: "other", fr: "Autre", en: "Other", abrege: "" },
]

export function libelleCivilite(code: string | null | undefined, locale = "fr"): string {
  const trouve = CIVILITES.find((c) => c.valeur === code)
  if (!trouve || trouve.valeur === "other") return ""
  return locale === "en" ? trouve.en : trouve.fr
}

/**
 * Le nom tel qu'on s'adresse à la personne : « Monsieur Adama Diarra ».
 *
 * Rend le nom seul quand la civilité manque, plutôt qu'un espace en tête. Un
 * document qui commence par « ,  Diarra » se remarque, et c'est le document
 * qu'on envoie à IRCC.
 */
export function nomAvecCivilite(
  personne: { civility?: string | null; name?: string | null; firstName?: string | null; lastName?: string | null },
  locale = "fr"
): string {
  const nom = (personne.name ?? "").trim() ||
    [personne.firstName, personne.lastName].filter(Boolean).join(" ").trim()
  const civilite = libelleCivilite(personne.civility, locale)
  return [civilite, nom].filter(Boolean).join(" ")
}

/** Le lien de parenté : ce que cette personne est pour le requérant. */
export type Relation = "spouse" | "child" | "dependant" | "other"

export const RELATIONS: { valeur: Relation; fr: string; en: string }[] = [
  { valeur: "spouse", fr: "Conjoint(e)", en: "Spouse" },
  { valeur: "child", fr: "Enfant", en: "Child" },
  { valeur: "dependant", fr: "Personne à charge", en: "Dependant" },
  { valeur: "other", fr: "Autre", en: "Other" },
]

/**
 * Le rôle au dossier : ce que cette personne est pour IRCC.
 *
 * Ne se confond pas avec le lien de parenté, et c'est tout l'intérêt de les
 * séparer : un conjoint peut rester au pays, un enfant majeur peut ne plus
 * être à charge. C'est cet écart qui décide qui figure sur quel formulaire.
 */
export type RoleImmigration =
  | "principal" | "accompanying_spouse" | "non_accompanying_spouse"
  | "dependent_child" | "other"

export const ROLES_IMMIGRATION: { valeur: RoleImmigration; fr: string; en: string }[] = [
  { valeur: "principal", fr: "Requérant principal", en: "Principal applicant" },
  { valeur: "accompanying_spouse", fr: "Conjoint accompagnant", en: "Accompanying spouse" },
  { valeur: "non_accompanying_spouse", fr: "Conjoint non accompagnant", en: "Non-accompanying spouse" },
  { valeur: "dependent_child", fr: "Enfant à charge", en: "Dependent child" },
  { valeur: "other", fr: "Autre", en: "Other" },
]

export function libelle(
  liste: { valeur: string; fr: string; en: string }[],
  code: string | null | undefined,
  locale = "fr"
): string {
  const trouve = liste.find((c) => c.valeur === code)
  if (!trouve) return ""
  return locale === "en" ? trouve.en : trouve.fr
}

export interface MembreFamille {
  id: string
  relation: Relation
  immigrationRole: RoleImmigration | null
  civility: Civilite | null
  firstName: string
  lastName: string
  birthDate: string | null
  notes: string
}

/**
 * L'âge à une date donnée, en années révolues.
 *
 * Utile parce qu'IRCC borne l'enfant à charge à 22 ans : le calcul doit donc
 * pouvoir se faire à la DATE DE DÉPÔT et non à aujourd'hui — un enfant de 21
 * ans au dépôt reste à charge même s'il en a 23 à l'examen du dossier. Le
 * second paramètre existe pour ça.
 */
export function ageALaDate(naissance: string, reference: Date = new Date()): number | null {
  const n = new Date(naissance)
  if (Number.isNaN(n.getTime())) return null
  let age = reference.getFullYear() - n.getFullYear()
  const moisEcoule = reference.getMonth() - n.getMonth()
  if (moisEcoule < 0 || (moisEcoule === 0 && reference.getDate() < n.getDate())) age -= 1
  return age
}
