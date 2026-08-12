/**
 * Une adresse postale, et la façon de l'écrire.
 *
 * Module PUR — il sert au navigateur comme au serveur, à l'aperçu d'un contrat
 * comme à son PDF. Deux compositions donneraient une adresse à l'écran et une
 * autre sur le document envoyé.
 *
 * LA RÈGLE QUI GOUVERNE TOUT CE FICHIER : jamais de ligne vide, jamais de
 * virgule orpheline. Un cabinet sans numéro de bureau, un client sans province,
 * un consultant sans site web — ce sont les cas ORDINAIRES, pas les
 * exceptions. Une composition naïve produit « 88 rue Dollard-des-Ormeaux, ,
 * Gatineau », et c'est ce qui fait qu'un contrat a l'air bâclé.
 *
 * LE FORMAT CANADIEN est suivi : « Gatineau (Québec) J8X 0B9 ». C'est celui de
 * Postes Canada et celui qu'emploient les contrats qui ont servi de référence.
 * La virgule entre la ville et la province est une habitude américaine.
 */

export interface AdressePostale {
  /** Numéro et rue. */
  ligne1?: string | null
  /** Appartement, bureau, unité. */
  ligne2?: string | null
  ville?: string | null
  province?: string | null
  codePostal?: string | null
  pays?: string | null
}

const txt = (v: unknown): string => String(v ?? "").trim()

/**
 * Les lignes d'une adresse, telles qu'elles s'impriment les unes sous les
 * autres. Une ligne absente n'est pas une ligne vide : elle n'existe pas.
 *
 *     88 rue Dollard-des-Ormeaux
 *     Bureau 801
 *     Gatineau (Québec) J8X 0B9
 *     Canada
 */
export function lignesAdresse(a: AdressePostale): string[] {
  const lignes: string[] = []

  if (txt(a.ligne1)) lignes.push(txt(a.ligne1))
  if (txt(a.ligne2)) lignes.push(txt(a.ligne2))

  // La ville, la province entre parenthèses, le code postal à la suite. Chaque
  // morceau peut manquer sans laisser de trace : « Gatineau J8X 0B9 » si la
  // province est absente, « (Québec) » seule si c'est la ville qui manque.
  const localite = [
    txt(a.ville),
    txt(a.province) ? `(${txt(a.province)})` : "",
    txt(a.codePostal),
  ].filter(Boolean).join(" ")
  if (localite) lignes.push(localite)

  if (txt(a.pays)) lignes.push(txt(a.pays))

  return lignes
}

/**
 * L'adresse sur UNE ligne, pour un bandeau ou un en-tête où la place manque.
 *
 * Les séparateurs sont des virgules, mais seulement entre des morceaux qui
 * existent réellement — c'est le même principe que ci-dessus, appliqué
 * horizontalement.
 */
export function adresseUneLigne(a: AdressePostale): string {
  return lignesAdresse(a).join(", ")
}

/** Vrai si l'adresse ne porte strictement rien. */
export const adresseVide = (a: AdressePostale): boolean => lignesAdresse(a).length === 0

/**
 * Ce qui manque à une adresse pour identifier un professionnel.
 *
 * Le §5 demande d'empêcher la génération d'un contrat quand l'adresse
 * professionnelle est incomplète — et de le DIRE. Une adresse de contrat n'est
 * pas une adresse de livraison : elle sert à savoir où joindre le représentant
 * et sous quelle juridiction il exerce. La rue, la ville et la province sont
 * donc exigées ; le code postal ne l'est pas, faute d'être universel hors du
 * Canada, et le numéro de bureau encore moins.
 *
 * Rend la liste des manques en français lisible, pas un code d'erreur : c'est
 * ce texte que le consultant lira avant d'aller le corriger.
 */
export function manquesAdresseProfessionnelle(a: AdressePostale): string[] {
  const manques: string[] = []
  if (!txt(a.ligne1)) manques.push("le numéro et la rue")
  if (!txt(a.ville)) manques.push("la ville")
  if (!txt(a.province)) manques.push("la province")
  return manques
}

/**
 * Les provinces et territoires, pour un sélecteur plutôt qu'un champ libre.
 *
 * Un champ libre reçoit « QC », « Qc », « Québec » et « Quebec » pour la même
 * province — et c'est ce texte-là qui s'imprime sur le contrat. Le nom complet
 * est retenu plutôt que le code : « Gatineau (QC) » se lit comme une étiquette
 * de colis, « Gatineau (Québec) » comme un contrat.
 */
export const PROVINCES: { valeur: string; fr: string; en: string }[] = [
  { valeur: "Alberta", fr: "Alberta", en: "Alberta" },
  { valeur: "Colombie-Britannique", fr: "Colombie-Britannique", en: "British Columbia" },
  { valeur: "Île-du-Prince-Édouard", fr: "Île-du-Prince-Édouard", en: "Prince Edward Island" },
  { valeur: "Manitoba", fr: "Manitoba", en: "Manitoba" },
  { valeur: "Nouveau-Brunswick", fr: "Nouveau-Brunswick", en: "New Brunswick" },
  { valeur: "Nouvelle-Écosse", fr: "Nouvelle-Écosse", en: "Nova Scotia" },
  { valeur: "Nunavut", fr: "Nunavut", en: "Nunavut" },
  { valeur: "Ontario", fr: "Ontario", en: "Ontario" },
  { valeur: "Québec", fr: "Québec", en: "Quebec" },
  { valeur: "Saskatchewan", fr: "Saskatchewan", en: "Saskatchewan" },
  { valeur: "Terre-Neuve-et-Labrador", fr: "Terre-Neuve-et-Labrador", en: "Newfoundland and Labrador" },
  { valeur: "Territoires du Nord-Ouest", fr: "Territoires du Nord-Ouest", en: "Northwest Territories" },
  { valeur: "Yukon", fr: "Yukon", en: "Yukon" },
]
