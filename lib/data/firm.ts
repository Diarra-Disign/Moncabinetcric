/**
 * Identité du cabinet.
 *
 * La source de vérité est la table `firms`. Ce module n'expose plus de
 * constante figée : le cabinet fictif « Boréale » se retrouvait autrefois
 * sur les ententes, factures et lettres de soumission parce que son
 * identité était écrite en dur ici et recopiée dans une douzaine de
 * composants.
 *
 * Les écrans reçoivent désormais l'identité par le contexte fourni au
 * layout applicatif ; voir components/app-shell/firm-provider.tsx.
 */

export interface FirmIdentity {
  id: string
  name: string
  rcicNumber: string
  rcicName: string
  address: string
  phone: string
  email: string
  website: string
  logoLetter: string
  logoUrl: string
}

/**
 * Valeurs de repli, volontairement neutres.
 *
 * Elles ne servent qu'à éviter un rendu cassé si la table n'est pas encore
 * renseignée — jamais à suggérer une identité. Aucun nom de cabinet ni
 * numéro de permis plausible n'y figure : un permis affiché par défaut
 * serait une faute déontologique, pas un dépannage.
 */
export const EMPTY_FIRM: FirmIdentity = {
  id: "",
  name: "",
  rcicNumber: "",
  rcicName: "",
  address: "",
  phone: "",
  email: "",
  website: "",
  logoLetter: "",
  logoUrl: "",
}

/** Ligne brute de la table firms, en snake_case. */
export interface FirmRow {
  id: string
  name: string | null
  rcic_license_number: string | null
  owner_name: string | null
  address: string | null
  phone: string | null
  email: string | null
  website: string | null
  logo_letter: string | null
  logo_url: string | null
}

export function mapFirmRow(row: FirmRow): FirmIdentity {
  const name = row.name ?? ""
  return {
    id: row.id,
    name,
    rcicNumber: row.rcic_license_number ?? "",
    rcicName: row.owner_name ?? "",
    address: row.address ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    website: row.website ?? "",
    // À défaut d'initiale explicite, la première lettre de la raison sociale.
    logoLetter: row.logo_letter || name.trim().charAt(0).toUpperCase() || "",
    logoUrl: row.logo_url ?? "",
  }
}
