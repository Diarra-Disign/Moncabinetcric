import type { PartieContractante, CabinetContrat } from "./variables"

/**
 * Ce qu'un contrat retient d'une personne et d'un cabinet.
 *
 * Module PUR, comme variables.ts, et pour la même raison : l'écran de
 * pré-remplissage montre au consultant ce que le contrat retiendra, et le
 * serveur compose le PDF avec ces mêmes valeurs. Une seule traduction des
 * lignes de base vers les parties du contrat.
 *
 * LE POINT DU §6, ET IL SE JOUE ICI. Ces fonctions produisent les valeurs
 * INITIALES d'une partie au contrat. Elles ne sont pas une vue sur la fiche :
 * une fois écrites dans agreement_parties, elles vivent leur vie. Corriger
 * l'adresse pour les besoins d'un contrat ne doit pas réécrire la fiche
 * client — et lire la fiche à chaque affichage du contrat produirait
 * l'inverse : un contrat signé dont l'adresse changerait le jour où le client
 * déménage.
 *
 * Ce que le contrat a retenu est ce que le contrat a retenu.
 */

/** Ce qu'on lit sur une ligne `clients`. */
export interface LigneClient {
  civility?: string | null
  address_line2?: string | null
  first_name?: string | null
  last_name?: string | null
  name?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  city?: string | null
  province?: string | null
  postal_code?: string | null
  country?: string | null
  file_number?: string | null
}

/** Ce qu'on lit sur une ligne `leads`. Mêmes champs, moins le numéro de dossier. */
export type LigneProspect = Omit<LigneClient, "file_number">

const txt = (v: unknown): string => String(v ?? "").trim()

/**
 * Sépare un nom complet quand prénom et nom ne sont pas renseignés.
 *
 * Les prospects anciens n'ont souvent que `name`. Le DERNIER mot est retenu
 * comme nom de famille et le reste comme prénom : « Awa Diallo » donne bien
 * Awa / Diallo, et « Marie Claire Dupont » donne Marie Claire / Dupont, ce qui
 * est plus souvent juste que l'inverse pour des noms francophones.
 */
function separer(nomComplet: string): { firstName: string; lastName: string } {
  const mots = nomComplet.split(/\s+/).filter(Boolean)
  if (mots.length === 0) return { firstName: "", lastName: "" }
  if (mots.length === 1) return { firstName: "", lastName: mots[0] }
  return { firstName: mots.slice(0, -1).join(" "), lastName: mots[mots.length - 1] }
}

function partieDepuis(r: LigneClient): PartieContractante {
  const prenom = txt(r.first_name)
  const nom = txt(r.last_name)
  const separe = prenom || nom ? { firstName: prenom, lastName: nom } : separer(txt(r.name))

  return {
    civility: r.civility ?? null,
    firstName: separe.firstName,
    lastName: separe.lastName,
    email: txt(r.email),
    phone: txt(r.phone),
    address: txt(r.address),
    addressLine2: txt(r.address_line2),
    city: txt(r.city),
    province: txt(r.province),
    postalCode: txt(r.postal_code),
    country: txt(r.country),
  }
}

export const partieDepuisClient = (r: LigneClient): PartieContractante => partieDepuis(r)
export const partieDepuisProspect = (r: LigneProspect): PartieContractante => partieDepuis(r)

/** Ce qu'on lit sur la ligne `firms`. */
export interface LigneCabinet {
  name?: string | null
  owner_name?: string | null
  rcic_license_number?: string | null
  address?: string | null
  address_line2?: string | null
  city?: string | null
  province?: string | null
  postal_code?: string | null
  country?: string | null
  email?: string | null
  phone?: string | null
  website?: string | null
}

/**
 * Le consultant vient des Paramètres (§9), jamais retapé dans un contrat.
 *
 * C'est LE point du §11 : il n'existe pas d'identité professionnelle propre
 * aux contrats. Les Paramètres sont la source, et une adresse corrigée
 * là-bas s'applique aux contrats SUIVANTS — jamais à ceux déjà établis, dont
 * la copie est figée dans agreement_parties au moment de la création.
 */
export function cabinetDepuisFirm(r: LigneCabinet, civiliteConsultant?: string | null): CabinetContrat {
  return {
    nom: txt(r.name),
    consultant: txt(r.owner_name),
    civiliteConsultant: civiliteConsultant ?? null,
    permis: txt(r.rcic_license_number),
    adresse: txt(r.address),
    adresseComplement: txt(r.address_line2),
    ville: txt(r.city),
    province: txt(r.province),
    codePostal: txt(r.postal_code),
    pays: txt(r.country),
    courriel: txt(r.email),
    telephone: txt(r.phone),
    siteWeb: txt(r.website),
  }
}

/**
 * Le consultant, en tant que PARTIE au contrat.
 *
 * Sa copie était incomplète : `emettreEntente()` n'écrivait que la première
 * ligne de son adresse dans agreement_parties, et le PDF d'un contrat ancien
 * n'aurait donc jamais retrouvé sa ville. Ici, tout est recopié — c'est cette
 * copie-là qui fait foi une fois le contrat établi.
 */
export function partieDepuisCabinet(f: CabinetContrat): PartieContractante {
  return {
    civility: f.civiliteConsultant ?? null,
    firstName: "",
    lastName: f.consultant,
    // La raison sociale : le contrat engage le CABINET, le consultant le
    // signe. Les deux doivent figurer, et « legal_name » est la colonne qui
    // porte déjà cette distinction pour un client constitué en société.
    legalName: f.nom,
    email: f.courriel ?? "",
    phone: f.telephone ?? "",
    address: f.adresse ?? "",
    addressLine2: f.adresseComplement ?? "",
    city: f.ville ?? "",
    licenseNumber: f.permis ?? "",
    province: f.province ?? "",
    postalCode: f.codePostal ?? "",
    country: f.pays ?? "",
  }
}

/**
 * Une partie prête à écrire dans agreement_parties.
 *
 * PostgREST unifie le jeu de colonnes d'un insert groupé : une ligne qui omet
 * « email » reçoit NULL et non la valeur par défaut, et l'insert entier échoue.
 * Cette fonction rend donc TOUTES les colonnes, y compris vides — c'est le
 * piège qu'a attrapé ./cric ententes en tentant d'ajouter un conjoint sans
 * courriel.
 */
export function ligneDePartie(
  p: PartieContractante,
  role: string,
  ordre = 1
): Record<string, string | number | null> {
  return {
    role,
    civility: p.civility ?? null,
    first_name: p.firstName ?? "",
    last_name: p.lastName ?? "",
    legal_name: p.legalName ?? "",
    email: p.email ?? "",
    phone: p.phone ?? "",
    address: p.address ?? "",
    address_line2: p.addressLine2 ?? "",
    license_number: p.licenseNumber ?? "",
    city: p.city ?? "",
    province: p.province ?? "",
    postal_code: p.postalCode ?? "",
    country: p.country ?? "",
    birth_date: p.birthDate ?? null,
    signing_order: ordre,
  }
}
