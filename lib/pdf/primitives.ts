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

/** La largeur maximale d'un logo dans la colonne gauche d'un en-tête.
 *
 *  Le bandeau de titre commence à x = 300 et la marge gauche est à 56 :
 *  56 + 232 = 288 laisse douze points de garde avant le bandeau. */
export const LARGEUR_MAX_LOGO = 232
/** Le plafond de hauteur. Au-delà, le logo écrase le nom du cabinet — quinze
 *  points — et l'en-tête se lit comme une publicité plutôt qu'un document. */
export const HAUTEUR_MAX_LOGO = 64
/** Le plancher : la hauteur qu'un logo occupait avant. Ne jamais rétrécir un
 *  logo existant sous prétexte de mieux le proportionner. */
export const HAUTEUR_MIN_LOGO = 44

/**
 * La boîte où loge un logo, quelle que soit sa forme, sans le déformer.
 *
 * L'ancien calcul fixait la HAUTEUR puis plafonnait la largeur SANS la
 * recalculer :
 *
 *     const h = 44
 *     const l = (image.width / image.height) * h
 *     drawImage({ width: Math.min(l, 170), height: h })
 *
 * Au-delà du rapport 170/44, la largeur était donc tronquée pendant que la
 * hauteur restait entière : un logo en bandeau — le nom du cabinet sur une
 * ligne, la forme la plus répandue — sortait comprimé de près d'un cinquième.
 * Rien ne le signalait ; il fallait mesurer la matrice de dessin pour le voir.
 *
 * Ici les deux bornes valent ensemble. On part de la largeur disponible, et si
 * la hauteur qui en découlerait dépasse, c'est elle qui commande. Le rapport
 * d'origine est conservé dans tous les cas — c'est la seule garantie qui
 * compte, et elle tient aussi bien pour un carré que pour un bandeau.
 */
export function boiteLogo(
  image: { width: number; height: number },
  largeurMax: number,
  hauteurMax: number
): { largeur: number; hauteur: number } {
  const rapport = image.width / image.height
  const largeur = Math.min(largeurMax, hauteurMax * rapport)
  return { largeur, hauteur: largeur / rapport }
}

/** L'interligne du nom du cabinet quand il déborde sur une seconde ligne. */
export const INTERLIGNE_NOM = 17

/**
 * La raison sociale du cabinet, entière, sur deux lignes au plus.
 *
 * Elle était COUPÉE : `couper(c.nom, gras, 15, 220)`. « Diarra Global Visa &
 * Immigration Services Inc. » réclame 329 points à quinze — pour 220 alloués —
 * et s'imprimait donc « Diarra Global Visa & Immigr… ». Ce qui tombait avec les
 * points de suspension, c'était « ation Services Inc. », la forme juridique
 * comprise : l'en-tête d'une entente nommait une entité absente du registre,
 * alors que sa fonction même est de dire QUI s'engage.
 *
 * Tenir sur une ligne aurait exigé de descendre à dix points, à peine plus que
 * les neuf des lignes d'adresse en dessous — la hiérarchie de l'en-tête s'y
 * serait effondrée. On enveloppe donc, et on ne réduit la taille qu'en dernier
 * recours, pour les raisons sociales que deux lignes ne suffisent pas à porter.
 *
 * AUCUN CARACTÈRE N'EST JAMAIS PERDU. Si même la taille plancher ne tient pas
 * en deux lignes, le nom prend les lignes qu'il lui faut : un nom entier sur
 * trois lignes vaut mieux qu'un nom amputé sur deux.
 */
export function nomCabinetEnLignes(
  nom: string,
  police: PDFFont,
  largeur: number,
  tailleMax = 15,
  tailleMin = 11,
  lignesMax = 2
): { lignes: string[]; taille: number } {
  for (let taille = tailleMax; taille >= tailleMin; taille -= 0.5) {
    const lignes = envelopper(nom, police, taille, largeur)
    if (lignes.length <= lignesMax) return { lignes, taille }
  }
  return { lignes: envelopper(nom, police, tailleMin, largeur), taille: tailleMin }
}

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
  } catch (e) {
    // Rendre null reste juste — un logo injoignable ne doit pas empêcher
    // d'émettre un contrat — mais le taire l'était moins : le cabinet voyait
    // son logo dans l'écran des paramètres et jamais dans ses documents.
    console.warn("logoEnOctets :", e instanceof Error ? e.message : e)
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

  // Les lignes d'identité sont filtrées ICI plutôt que dans la boucle : leur
  // nombre décide de la hauteur disponible pour le logo, quelques lignes plus
  // bas, et il faut donc le connaître avant de dessiner quoi que ce soit.
  const identite = [
    c.numeroPermis ? `${mentionPermis} ${c.numeroPermis}` : "",
    c.adresse,
    [c.telephone, c.courriel].filter(Boolean).join(" · "),
  ].filter((ligne) => Boolean(ligne && ligne.trim()))

  // 1. Colonne gauche : Logo et cabinet
  //
  // LE LOGO NE PREND JAMAIS PLUS DE HAUTEUR QUE LA COLONNE DE DROITE N'EN
  // CONSOMME DÉJÀ, et c'est une garantie, pas un réglage. Cet en-tête sert cinq
  // documents — facture, reçu, registre mensuel, rapprochement, note de
  // rencontre — dont plusieurs tiennent sur UNE page ouverte par un seul
  // `addPage`, sans pagination : un en-tête plus haut y rognerait la place des
  // lignes et ferait déborder en silence une facture qui entrait hier (§5).
  //
  // La colonne droite descend de dix-huit points par repère ; la gauche, de la
  // hauteur du logo, puis de vingt-huit pour le nom, puis de onze par ligne
  // d'identité. Égaliser les deux donne la hauteur qu'on peut prendre sans rien
  // déplacer : soixante-trois points sur une facture (quatre repères), quarante-
  // cinq sur un rapprochement (trois). En deçà du plancher, on garde le
  // plancher — l'ancienne hauteur — et le document sort exactement comme avant.
  // La raison sociale se compose AVANT le logo : si elle réclame une seconde
  // ligne, c'est le logo qui la lui cède. Le nom légal prime sur une image.
  const nomCabinet = nomCabinetEnLignes(c.nom, gras, LARGEUR_MAX_LOGO)
  const supplementNom = (nomCabinet.lignes.length - 1) * INTERLIGNE_NOM

  const hauteurLibre =
    24 + 18 * reperes.filter((r) => r.valeur).length - 11 * identite.length - supplementNom
  const hauteurLogo = Math.min(HAUTEUR_MAX_LOGO, Math.max(HAUTEUR_MIN_LOGO, hauteurLibre))

  const logo = await logoEnOctets(c.logoUrl)
  if (logo) {
    try {
      const image = logo.type === "jpg" ? await doc.embedJpg(logo.octets) : await doc.embedPng(logo.octets)
      const boite = boiteLogo(image, LARGEUR_MAX_LOGO, hauteurLogo)
      page.drawImage(image, {
        x: G, y: yGauche - boite.hauteur, width: boite.largeur, height: boite.hauteur,
      })
      yGauche -= boite.hauteur + 12
    } catch (e) {
      // La facture ou le reçu s'émet sans logo plutôt que pas du tout ; la
      // trace dit lequel des deux formats embarquables manquait.
      console.warn("enTeteOfficiel : logo non embarqué —", e instanceof Error ? e.message : e)
    }
  }

  // La première ligne garde EXACTEMENT l'ordonnée d'avant : un nom qui tenait
  // déjà sur une ligne s'imprime au point près où il s'imprimait.
  let yNom = yGauche - 12
  for (const ligne of nomCabinet.lignes) {
    ecrire(page, ligne, { x: G, y: yNom, size: nomCabinet.taille, font: gras, color: MARINE })
    yNom -= INTERLIGNE_NOM
  }
  yGauche -= 28 + supplementNom

  for (const ligne of identite) {
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
    } catch (e) {
      // Poursuivre sans logo, mais le dire.
      console.warn("enTete : logo non embarqué —", e instanceof Error ? e.message : e)
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
