import { libelleCivilite, nomAvecCivilite } from "@/lib/data/identite"
import {
  adresseUneLigne, lignesAdresse, manquesAdresseProfessionnelle,
  type AdressePostale,
} from "@/lib/data/adresse"

/**
 * Les variables d'un contrat, et ce qui empêche de le générer.
 *
 * Module PUR — ni « server-only », ni accès base. L'aperçu en temps réel du
 * §19 s'affiche dans le navigateur et a besoin des mêmes substitutions que le
 * PDF composé sur le serveur. Deux implémentations donneraient un aperçu qui
 * ne correspond pas au document envoyé, et c'est l'écart qu'on ne découvre
 * qu'après l'avoir envoyé.
 *
 * DEUX DÉFAUTS QUE CE FICHIER REND IMPOSSIBLES.
 *
 * Le premier : une variable inconnue laissée telle quelle. « {{adresse_client}} »
 * imprimé dans un contrat est silencieux à la génération et visible pour le
 * seul client. substituer() rend donc la liste de ce qu'elle n'a pas su
 * remplacer, et verifierAvantGeneration() refuse de générer tant qu'il en
 * reste.
 *
 * Le second : un contrat produit sans les renseignements essentiels. Le §29
 * demande de l'empêcher — et de NOMMER ce qui manque, parce que
 * « informations incomplètes » ne dit pas où retourner.
 *
 * Une variable CONNUE mais VIDE n'est pas une inconnue. Un téléphone absent
 * laisse un blanc : c'est un renseignement manquant, pas une faute de modèle.
 * Les deux se corrigent à des endroits différents — la fiche client d'un côté,
 * le modèle de l'autre — donc ils ne doivent pas se confondre.
 */

export interface PartieContractante {
  civility?: string | null
  firstName?: string
  lastName?: string
  legalName?: string
  email?: string
  phone?: string
  address?: string
  /** Appartement, bureau, unité. */
  addressLine2?: string
  city?: string
  province?: string
  postalCode?: string
  country?: string
  birthDate?: string | null
  /** Permis CRIC — le consultant seulement. Figé avec le reste de la copie. */
  licenseNumber?: string
}

export interface CabinetContrat {
  nom: string
  consultant: string
  civiliteConsultant?: string | null
  permis: string
  /** Numéro et rue — première ligne de l'adresse professionnelle. */
  adresse?: string
  /** Appartement, bureau, unité. Omise du document quand elle est vide. */
  adresseComplement?: string
  ville?: string
  province?: string
  codePostal?: string
  pays?: string
  courriel?: string
  telephone?: string
  siteWeb?: string
}

export interface ContexteEntente {
  contractant: PartieContractante
  cabinet: CabinetContrat
  montants: { honoraires: number; taxes: number; total: number }
  entente: { numero: string; date: string; titre: string }
  locale: string
  /** Pro bono : l'absence d'honoraires est le propos du contrat, pas un oubli. */
  proBono?: boolean
}

/**
 * Un montant en dollars canadiens, sans espace insécable.
 *
 * Intl place une espace fine insécable (U+202F) devant le symbole et une
 * insécable ordinaire (U+00A0) dans les milliers. Aucune des deux n'appartient
 * au WinAnsi que couvrent les polices standard d'un PDF — le moteur de
 * facturation a déjà buté dessus, et un contrat se compose avec les mêmes.
 */
export const argent = (v: number, locale = "fr"): string =>
  new Intl.NumberFormat(locale === "en" ? "en-CA" : "fr-CA", { style: "currency", currency: "CAD" })
    .format(v)
    .replace(/[  ]/g, " ")

const dateLongue = (v: string, locale = "fr"): string => {
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return v
  return d.toLocaleDateString(locale === "en" ? "en-CA" : "fr-CA", {
    day: "numeric", month: "long", year: "numeric",
  })
}

/** Assemble en écartant les vides : une adresse partielle ne doit pas produire
 *  de virgules orphelines dans un document officiel. */
const joindre = (parties: (string | undefined)[], separateur: string) =>
  parties.map((p) => (p ?? "").trim()).filter(Boolean).join(separateur)

/**
 * L'adresse professionnelle telle que la composition la comprend.
 *
 * Une seule traduction du cabinet vers l'adresse : les variables, la
 * validation et le bloc du PDF passent tous par ici, et ne peuvent donc pas
 * imprimer trois adresses différentes du même cabinet.
 */
export const adresseDuCabinet = (f: CabinetContrat): AdressePostale => ({
  ligne1: f.adresse,
  ligne2: f.adresseComplement,
  ville: f.ville,
  province: f.province,
  codePostal: f.codePostal,
  pays: f.pays,
})

/** Les lignes de l'adresse professionnelle, pour un bloc à plusieurs lignes. */
export const lignesAdresseCabinet = (f: CabinetContrat): string[] =>
  lignesAdresse(adresseDuCabinet(f))

/** L'adresse du contractant, même traduction, pour le bloc en vis-à-vis. */
export const adresseDuContractant = (c: PartieContractante): AdressePostale => ({
  ligne1: c.address,
  ligne2: c.addressLine2,
  ville: c.city,
  province: c.province,
  codePostal: c.postalCode,
  pays: c.country,
})

export function variablesDe(ctx: ContexteEntente): Record<string, string> {
  const c = ctx.contractant
  const f = ctx.cabinet
  const l = ctx.locale

  return {
    // Le contractant
    civilite: libelleCivilite(c.civility, l),
    prenom_client: (c.firstName ?? "").trim(),
    nom_client: (c.lastName ?? "").trim(),
    nom_legal_client: (c.legalName ?? "").trim() ||
      joindre([c.firstName, c.lastName], " "),
    nom_complet_client: nomAvecCivilite(
      { civility: c.civility, firstName: c.firstName, lastName: c.lastName }, l
    ),
    courriel_client: (c.email ?? "").trim(),
    telephone_client: (c.phone ?? "").trim(),
    // Composée par le MÊME module que celle du consultant : deux compositions
    // auraient fini par écrire les deux adresses du contrat dans deux formats.
    adresse_client: adresseUneLigne(adresseDuContractant(c)),
    ville_client: (c.city ?? "").trim(),
    province_client: (c.province ?? "").trim(),
    code_postal_client: (c.postalCode ?? "").trim(),
    pays_client: (c.country ?? "").trim(),
    date_naissance_client: c.birthDate ? dateLongue(c.birthDate, l) : "",

    // Le cabinet — jamais retapé, toujours issu des Paramètres (§9)
    nom_cabinet: f.nom.trim(),
    nom_consultant: nomAvecCivilite({ civility: f.civiliteConsultant, name: f.consultant }, l),
    permis_consultant: f.permis.trim(),
    courriel_cabinet: (f.courriel ?? "").trim(),
    telephone_cabinet: (f.telephone ?? "").trim(),
    site_cabinet: (f.siteWeb ?? "").trim(),

    // L'ADRESSE PROFESSIONNELLE, EN MORCEAUX ET EN ENTIER.
    //
    // « adresse_cabinet » ne rend plus la seule première ligne : elle rend
    // l'adresse COMPLÈTE. Les quatre modèles fournis l'emploient déjà, et un
    // contrat qui annonce « domicilié au 88 rue Dollard-des-Ormeaux » sans dire
    // dans quelle ville n'identifie personne. Le nom de la variable ne change
    // pas — le renommer aurait cassé chaque modèle déjà écrit, y compris ceux
    // qu'un cabinet aurait personnalisés.
    adresse_cabinet: adresseUneLigne(adresseDuCabinet(f)),
    adresse_consultant_complete: adresseUneLigne(adresseDuCabinet(f)),
    // La première ligne SEULE, pour un modèle qui compose lui-même sa mise en
    // page sur plusieurs lignes.
    adresse_consultant: (f.adresse ?? "").trim(),
    complement_consultant: (f.adresseComplement ?? "").trim(),
    ville_consultant: (f.ville ?? "").trim(),
    province_consultant: (f.province ?? "").trim(),
    code_postal_consultant: (f.codePostal ?? "").trim(),
    pays_consultant: (f.pays ?? "").trim(),
    telephone_consultant: (f.telephone ?? "").trim(),
    courriel_consultant: (f.courriel ?? "").trim(),
    site_consultant: (f.siteWeb ?? "").trim(),

    // Les montants — retenus à l'émission, jamais recalculés après coup
    honoraires: argent(ctx.montants.honoraires, l),
    taxes: argent(ctx.montants.taxes, l),
    total: argent(ctx.montants.total, l),

    // L'entente
    numero_contrat: ctx.entente.numero,
    date_contrat: dateLongue(ctx.entente.date, l),
    titre_contrat: ctx.entente.titre,
  }
}

const MOTIF = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi

export function substituer(
  texte: string,
  variables: Record<string, string>
): { texte: string; inconnues: string[] } {
  const inconnues = new Set<string>()
  const rendu = texte.replace(MOTIF, (_, nom: string) => {
    const cle = nom.toLowerCase()
    if (!(cle in variables)) {
      inconnues.add(cle)
      // On laisse le motif intact : le retirer masquerait le défaut à
      // l'aperçu, et le consultant croirait le contrat complet.
      return `{{${nom}}}`
    }
    return variables[cle]
  })
  return { texte: rendu, inconnues: [...inconnues] }
}

export type Verification =
  | { ok: true }
  | {
      ok: false
      manquants: string[]
      /**
       * Vrai quand au moins un manque se corrige dans les Paramètres et non
       * sur la fiche du client. L'écran s'en sert pour offrir « Compléter mon
       * profil » (§5) — sans cela, le consultant lit « adresse professionnelle
       * incomplète » et cherche où la saisir.
       */
      profilACompleter?: boolean
    }

/**
 * Ce qui doit être là avant de produire un contrat définitif (§29).
 *
 * La liste n'est pas un caprice : un contrat sans adresse ni courriel du
 * client ne peut ni être envoyé ni servir de pièce, et un contrat sans le
 * numéro de permis du consultant n'identifie pas son signataire — c'est ce
 * numéro qui atteste qu'il est autorisé à représenter devant IRCC.
 */
export function verifierAvantGeneration(
  ctx: ContexteEntente,
  textes: string[] = []
): Verification {
  const manquants: string[] = []
  const c = ctx.contractant
  let profilACompleter = false

  if (!joindre([c.firstName, c.lastName], " ")) manquants.push("Le nom du client est absent.")
  if (!(c.email ?? "").trim()) manquants.push("Le courriel du client est absent.")
  if (!(c.address ?? "").trim()) manquants.push("L'adresse du client est absente.")

  if (!ctx.cabinet.nom.trim()) {
    manquants.push("Le nom du cabinet n'est pas configuré.")
    profilACompleter = true
  }
  if (!ctx.cabinet.permis.trim()) {
    manquants.push("Le numéro de permis du consultant n'est pas configuré.")
    profilACompleter = true
  }

  // L'ADRESSE PROFESSIONNELLE (§5). Elle n'est pas décorative : elle dit où
  // joindre le représentant et sous quelle juridiction il exerce. Un contrat
  // qui l'omet n'identifie pas la partie qui s'engage — et le Collège lit ce
  // document-là.
  //
  // Le manque est NOMMÉ morceau par morceau : « adresse professionnelle
  // incomplète » n'apprend pas au consultant que c'est la province qui
  // manque, et il rouvrira ses paramètres pour chercher.
  const manquesCabinet = manquesAdresseProfessionnelle(adresseDuCabinet(ctx.cabinet))
  if (manquesCabinet.length > 0) {
    manquants.push(
      `Adresse professionnelle incomplète : il manque ${manquesCabinet.join(", ")}.`
    )
    profilACompleter = true
  }

  // Pro bono : zéro est la réponse, pas une absence de réponse.
  if (!ctx.proBono && ctx.montants.honoraires <= 0) {
    manquants.push("Les honoraires ne sont pas configurés.")
  }

  const variables = variablesDe(ctx)
  const inconnues = new Set<string>()
  for (const t of textes) for (const i of substituer(t, variables).inconnues) inconnues.add(i)
  for (const i of inconnues) {
    manquants.push(`Le modèle emploie une variable inconnue : {{${i}}}.`)
  }

  return manquants.length === 0 ? { ok: true } : { ok: false, manquants, profilACompleter }
}
