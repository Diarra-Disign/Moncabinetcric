import "server-only"

import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib"
import { sur, ecrire, couper, envelopper } from "./texte"

// Réexportés : les fonctions de texte sont PURES et vivent à part pour rester
// éprouvables par « pnpm test », qui ne sait pas neutraliser « server-only ».
// Les appelants n'ont pas à savoir où elles habitent.
export { sur, ecrire, couper, envelopper }

/**
 * Les primitives communes à toutes les pièces PDF du cabinet.
 *
 * Elles vivaient dans `lib/invoices/pdf.ts`, où elles étaient privées. L'entente
 * de service en a besoin des mêmes : même en-tête, même translittération, même
 * échelle typographique. Les recopier aurait donné deux moteurs — et le jour où
 * le cabinet change d'adresse, une facture et un contrat au nom de deux cabinets
 * légèrement différents. Le §17 du cahier des charges interdit précisément cela.
 *
 * Ce fichier ne contient AUCUNE chaîne visible. Les libellés restent chez
 * l'appelant, avec sa table de mots : un mot français glissé ici s'imprimerait
 * au milieu d'un document anglais, et personne ne le verrait avant qu'un client
 * anglophone ne le reçoive.
 */

export type LanguePdf = "fr" | "en"

export interface CabinetPdf {
  nom: string
  adresse: string
  telephone: string
  courriel: string
  numeroPermis: string
  numeroTps: string
  numeroTvq: string
  conditionsPaiement: string
  /** data: URI ou URL absolue. Absent, la pièce s'imprime sans logo. */
  logoUrl: string
}

export const ENCRE = rgb(0.06, 0.09, 0.16)
export const GRIS = rgb(0.42, 0.45, 0.5)
export const TRAIT = rgb(0.85, 0.87, 0.9)
export const PALE = rgb(0.93, 0.94, 0.96)

export const LARGEUR = 595.28
export const HAUTEUR = 841.89
/** Marge gauche. */
export const G = 56
/** Bord droit. */
export const D = 539

export const argentDe = (langue: LanguePdf) => (v: number) =>
  new Intl.NumberFormat(langue === "en" ? "en-CA" : "fr-CA", { style: "currency", currency: "CAD" })
    .format(v)
    .replace(/[  ]/g, " ")

/**
 * Un taux en pourcentage lisible : 0.09975 devient « 9,975 % ».
 *
 * Trois décimales, parce que la TVQ en compte trois. En arrondir deux
 * afficherait « 9,98 % » sur une facture calculée à 9,975 % : le client qui
 * refait l'opération ne retomberait pas sur le montant imprimé juste à côté.
 */
export const pourcentDe = (langue: LanguePdf) => (taux: number) =>
  new Intl.NumberFormat(langue === "en" ? "en-CA" : "fr-CA", {
    style: "percent", minimumFractionDigits: 3, maximumFractionDigits: 3,
  })
    .format(taux)
    // Intl place une espace FINE INSÉCABLE (U+202F) devant le %. Elle ne fait
    // pas partie du WinAnsi que couvrent les polices standard d'un PDF : la
    // laisser passer expose à un refus d'encodage au moment d'écrire la page.
    .replace(/[  ]/g, " ")

/** Écrit une valeur alignée à DROITE sur x — les montants se lisent en colonne. */
export function droite(
  page: PDFPage, texte: string, x: number, y: number,
  police: PDFFont, taille: number, couleur = ENCRE
) {
  const t = sur(texte)
  page.drawText(t, { x: x - police.widthOfTextAtSize(t, taille), y, size: taille, font: police, color: couleur })
}

/** Écrit une valeur CENTRÉE sur x — utilisé par la pagination. */
export function centre(
  page: PDFPage, texte: string, x: number, y: number,
  police: PDFFont, taille: number, couleur = GRIS
) {
  const t = sur(texte)
  page.drawText(t, { x: x - police.widthOfTextAtSize(t, taille) / 2, y, size: taille, font: police, color: couleur })
}

export async function logoEnOctets(url: string): Promise<{ octets: Uint8Array; type: "png" | "jpg" } | null> {
  try {
    if (!url) return null
    if (url.startsWith("data:")) {
      const [entete, donnees] = url.split(",")
      if (!donnees) return null
      const type = /jpe?g/i.test(entete) ? "jpg" : "png"
      return { octets: Buffer.from(donnees, "base64"), type }
    }
    const res = await fetch(url)
    if (!res.ok) return null
    const buf = new Uint8Array(await res.arrayBuffer())
    const type = /jpe?g/i.test(res.headers.get("content-type") ?? "") ? "jpg" : "png"
    return { octets: buf, type }
  } catch {
    // Un logo illisible ne doit pas empêcher d'émettre une pièce. On l'omet ;
    // le nom du cabinet reste imprimé, et la pièce reste valable.
    return null
  }
}

/**
 * L'en-tête commun à toutes les pièces : logo à gauche, cabinet à droite.
 *
 * Partagé, et c'est le point : deux en-têtes séparés auraient divergé au
 * premier changement d'adresse, et le client aurait reçu une facture et un
 * contrat au nom de deux cabinets légèrement différents.
 *
 * `mentionPermis` est fourni par l'appelant plutôt qu'écrit ici : c'est la
 * seule chaîne visible de l'en-tête, et elle doit suivre la langue du document.
 *
 * Rend l'ordonnée du bas de l'en-tête, d'où la suite du document repart.
 */
export async function enTete(
  doc: PDFDocument, page: PDFPage, c: CabinetPdf,
  normal: PDFFont, gras: PDFFont, titre: string, mentionPermis: string
): Promise<number> {
  const hautCabinet = 786
  let yCabinet = hautCabinet

  droite(page, couper(c.nom, gras, 12, 300), D, yCabinet, gras, 12)
  yCabinet -= 14
  for (const ligne of [
    c.adresse,
    [c.telephone, c.courriel].filter(Boolean).join(" · "),
    c.numeroPermis ? `${mentionPermis} ${c.numeroPermis}` : "",
  ]) {
    if (!ligne) continue
    droite(page, couper(ligne, normal, 8.5, 300), D, yCabinet, normal, 8.5, GRIS)
    yCabinet -= 11
  }

  let yGauche = hautCabinet
  const logo = await logoEnOctets(c.logoUrl)
  if (logo) {
    try {
      const image = logo.type === "jpg" ? await doc.embedJpg(logo.octets) : await doc.embedPng(logo.octets)
      const h = 48
      const l = (image.width / image.height) * h
      page.drawImage(image, { x: G, y: yGauche - h + 10, width: Math.min(l, 150), height: h })
      yGauche -= h + 6
    } catch {
      // Format non reconnu par pdf-lib : on poursuit sans logo.
    }
  }

  // Le titre vient sous le logo, à gauche : c'est le premier mot que l'œil
  // rencontre en descendant, et il dit de quelle pièce il s'agit.
  // Sous les DEUX colonnes, pas seulement sous le logo. En l'absence de logo,
  // yGauche valait encore le haut de page et le titre se posait sur la
  // dernière ligne du cabinet — le numéro de permis, précisément.
  const yTitre = Math.min(yGauche, yCabinet) - 22
  ecrire(page, titre, { x: G, y: yTitre, size: 26, font: gras, color: ENCRE })

  return yTitre - 34
}

/**
 * Une colonne du bandeau : une étiquette grise, sa valeur dessous.
 *
 * `aDroite` aligne le bloc sur son bord droit, pour la colonne des montants.
 */
export function bloc(
  page: PDFPage, x: number, y: number, etiquette: string, valeur: string,
  normal: PDFFont, gras: PDFFont, aDroite = false, tailleValeur = 10, couleurValeur = ENCRE
) {
  if (aDroite) {
    droite(page, etiquette, x, y, gras, 7.5, GRIS)
    droite(page, valeur, x, y - 15, gras, tailleValeur, couleurValeur)
  } else {
    ecrire(page, etiquette, { x, y, size: 7.5, font: gras, color: GRIS })
    ecrire(page, valeur, { x, y: y - 15, size: tailleValeur, font: gras, color: couleurValeur })
  }
}

/** Le pied de page, identique sur toutes les pièces. */
export function pagination(page: PDFPage, normal: PDFFont, libelle: string) {
  centre(page, libelle, LARGEUR / 2, 40, normal, 8)
}

/**
 * La mention en filigrane d'une pièce non définitive.
 *
 * Sans elle, un brouillon circule et se fait prendre pour la pièce définitive —
 * une facture non émise se fait payer, une entente non émise se fait signer.
 */
export function filigrane(page: PDFPage, texte: string, gras: PDFFont, taille = 54, x = 170) {
  ecrire(page, texte, {
    x, y: 400, size: taille, font: gras, color: PALE,
    rotate: { type: "degrees", angle: 32 } as never,
  })
}
