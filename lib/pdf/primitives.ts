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
 * Entente de service, facture, reçu, registre fidéicommis et rapprochement
 * partagent rigoureusement le même système visuel, la même translittération,
 * la même palette et les mêmes proportions d'en-tête et de pied.
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

/**
 * Les couleurs officielles du cabinet :
 *
 * MARINE est la couleur identitaire d'autorité du système de design.
 * OR est le filet d'accentuation et de sous-titre officiel.
 * VOILE est le fond des panneaux d'identification.
 */
export const MARINE = rgb(0.09, 0.16, 0.30)
export const OR = rgb(0.78, 0.65, 0.32)
export const VOILE = rgb(0.96, 0.97, 0.99)
export const BLANC = rgb(1, 1, 1)

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
 */
export const pourcentDe = (langue: LanguePdf) => (taux: number) =>
  new Intl.NumberFormat(langue === "en" ? "en-CA" : "fr-CA", {
    style: "percent", minimumFractionDigits: 3, maximumFractionDigits: 3,
  })
    .format(taux)
    .replace(/[  ]/g, " ")

/** Écrit une valeur alignée à DROITE sur x — les montants se lisent en colonne. */
export function droite(
  page: PDFPage, texte: string, x: number, y: number,
  police: PDFFont, taille: number, couleur = ENCRE
) {
  const t = sur(texte)
  page.drawText(t, { x: x - police.widthOfTextAtSize(t, taille), y, size: taille, font: police, color: couleur })
}

/** Écrit une valeur CENTRÉE sur x — utilisé par la pagination et les bandeaux. */
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
    return null
  }
}

/**
 * L'en-tête officiel bi-colonne standardisé (calqué sur le modèle des ententes) :
 * - Gauche : Logo + Nom du cabinet en MARINE + Mention CRIC & Permis
 * - Droite : Cartouche de titre plein en MARINE avec sur-titre blanc et sous-titre doré OR
 * - Repères structurés avec filets fins TRAIT
 */
export async function enTeteOfficiel(
  doc: PDFDocument,
  page: PDFPage,
  c: CabinetPdf,
  normal: PDFFont,
  gras: PDFFont,
  titre: { surTitre: string; sousTitre: string },
  mentionPermis: string,
  reperes: { label: string; valeur: string }[]
): Promise<number> {
  const HAUT = 792
  const xDroite = 300
  let yGauche = HAUT

  // 1. Colonne gauche : Logo et cabinet
  const logo = await logoEnOctets(c.logoUrl)
  if (logo) {
    try {
      const image = logo.type === "jpg" ? await doc.embedJpg(logo.octets) : await doc.embedPng(logo.octets)
      const h = 44
      const l = (image.width / image.height) * h
      page.drawImage(image, { x: G, y: yGauche - h, width: Math.min(l, 170), height: h })
      yGauche -= h + 12
    } catch {
      // Ignorer erreur de format logo
    }
  }

  ecrire(page, couper(c.nom, gras, 15, 220), { x: G, y: yGauche - 12, size: 15, font: gras, color: MARINE })
  yGauche -= 28

  const identite = [
    c.numeroPermis ? `${mentionPermis} ${c.numeroPermis}` : "",
    c.adresse,
    [c.telephone, c.courriel].filter(Boolean).join(" · "),
  ]
  for (const ligne of identite) {
    if (!ligne || !ligne.trim()) continue
    ecrire(page, couper(ligne, normal, 8.5, 230), {
      x: G, y: yGauche, size: 8.5, font: normal, color: GRIS,
    })
    yGauche -= 11
  }

  // 2. Colonne droite : Cartouche de titre officiel
  const largeurBandeau = D - xDroite
  const hauteurBandeau = 44
  page.drawRectangle({
    x: xDroite, y: HAUT - hauteurBandeau, width: largeurBandeau, height: hauteurBandeau, color: MARINE,
  })
  centre(page, titre.surTitre, xDroite + largeurBandeau / 2, HAUT - 20, gras, 13, BLANC)
  centre(page, titre.sousTitre, xDroite + largeurBandeau / 2, HAUT - 35, normal, 9.5, OR)

  let yDroite = HAUT - hauteurBandeau - 20

  // Repères avec filets fins
  for (const r of reperes) {
    if (!r.valeur) continue
    ecrire(page, r.label, { x: xDroite, y: yDroite, size: 8, font: gras, color: ENCRE })
    const xValeur = xDroite + 105
    ecrire(page, couper(r.valeur, normal, 8.5, D - xValeur), {
      x: xValeur, y: yDroite, size: 8.5, font: normal, color: ENCRE,
    })
    page.drawLine({
      start: { x: xValeur, y: yDroite - 3 }, end: { x: D, y: yDroite - 3 },
      thickness: 0.5, color: TRAIT,
    })
    yDroite -= 18
  }

  return Math.min(yGauche, yDroite) - 10
}

/**
 * Panneau d'identification de partie avec barre de titre pleine MARINE et fond VOILE.
 */
export function panneauPartie(
  page: PDFPage, x: number, y: number, largeur: number,
  titre: string,
  lignes: { texte: string; taille?: number; gras?: boolean; couleur?: typeof ENCRE }[],
  normal: PDFFont, gras: PDFFont
): number {
  const HAUTEUR_BARRE = 18
  const elements = lignes.filter((l) => Boolean(l.texte && l.texte.trim()))
  const corps = elements.length * 13 + 14
  const hauteur = HAUTEUR_BARRE + corps

  page.drawRectangle({
    x, y: y - hauteur, width: largeur, height: corps, color: VOILE,
    borderColor: TRAIT, borderWidth: 0.5,
  })
  page.drawRectangle({
    x, y: y - HAUTEUR_BARRE, width: largeur, height: HAUTEUR_BARRE, color: MARINE,
  })
  ecrire(page, titre, { x: x + 10, y: y - 12.5, size: 8, font: gras, color: BLANC })

  let curseur = y - HAUTEUR_BARRE - 13
  for (const l of elements) {
    const p = l.gras ? gras : normal
    const sz = l.taille ?? 8.5
    const clr = l.couleur ?? (l.gras ? ENCRE : GRIS)
    ecrire(page, couper(l.texte, p, sz, largeur - 20), {
      x: x + 10, y: curseur, size: sz, font: p, color: clr,
    })
    curseur -= 13
  }

  return hauteur
}

/**
 * En-tête classique préservé pour compatibilité.
 */
export async function enTete(
  doc: PDFDocument, page: PDFPage, c: CabinetPdf,
  normal: PDFFont, gras: PDFFont, titre: string, mentionPermis: string
): Promise<number> {
  const hautCabinet = 786
  let yCabinet = hautCabinet

  droite(page, couper(c.nom, gras, 12, 300), D, yCabinet, gras, 12, MARINE)
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
      // Poursuivre sans logo
    }
  }

  const yTitre = Math.min(yGauche, yCabinet) - 22
  ecrire(page, titre, { x: G, y: yTitre, size: 24, font: gras, color: MARINE })

  return yTitre - 30
}

/**
 * Une colonne du bandeau : une étiquette grise, sa valeur dessous.
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

/**
 * Le pied de page officiel plein en MARINE de 30pt (norme visuelle des ententes).
 */
export function piedOfficiel(
  page: PDFPage,
  reference: string,
  mentionGauche: string,
  n: number,
  total: number,
  normal: PDFFont,
  gras: PDFFont
) {
  const HAUTEUR_PIED = 30
  page.drawRectangle({ x: 0, y: 0, width: LARGEUR, height: HAUTEUR_PIED, color: MARINE })
  ecrire(page, mentionGauche, { x: G, y: 11, size: 7.5, font: normal, color: BLANC })
  droite(page, `${reference}  ·  Page ${n} sur ${total}`, D, 11, gras, 7.5, BLANC)
}

/** Le pied de page simple centré. */
export function pagination(page: PDFPage, normal: PDFFont, libelle: string) {
  centre(page, libelle, LARGEUR / 2, 40, normal, 8)
}

/**
 * La mention en filigrane d'une pièce non définitive.
 */
export function filigrane(page: PDFPage, texte: string, gras: PDFFont, taille = 54, x = 170) {
  ecrire(page, texte, {
    x, y: 400, size: taille, font: gras, color: PALE,
    rotate: { type: "degrees", angle: 32 } as never,
  })
}
