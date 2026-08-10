import "server-only"

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib"

/**
 * La facture, en PDF.
 *
 * Composée plutôt que remplie : contrairement aux formulaires d'IRCC, il
 * n'existe pas de gabarit officiel à respecter. pdf-lib était déjà une
 * dépendance du projet ; en ajouter une seconde pour dessiner huit lignes de
 * texte aurait coûté une chaîne de mises à jour pour rien.
 *
 * Helvetica plutôt qu'une police intégrée : les polices standard d'un PDF
 * couvrent le WinAnsi, donc les accents français. Une police à intégrer
 * pèserait trois cents kilo-octets par facture.
 */

export interface LignePdf {
  description: string
  quantite: number
  prixUnitaire: number
  taxable: boolean
}

export interface FacturePdf {
  numero: string
  date: string
  echeance: string | null
  statut: string
  clientNom: string
  clientCourriel: string
  clientAdresse: string
  dossierReference: string
  consultant: string
  lignes: LignePdf[]
  sousTotal: number
  tps: number
  tvq: number
  total: number
  regle: number
  notes: string
}

export interface CabinetPdf {
  nom: string
  adresse: string
  telephone: string
  courriel: string
  numeroPermis: string
  numeroTps: string
  numeroTvq: string
  conditionsPaiement: string
  /** data: URI ou URL absolue. Absent, la facture s'imprime sans logo. */
  logoUrl: string
}

const ENCRE = rgb(0.06, 0.09, 0.16)
const GRIS = rgb(0.42, 0.45, 0.5)
const TRAIT = rgb(0.85, 0.87, 0.9)

const argent = (v: number) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(v).replace(/ | /g, " ")

/**
 * Coupe un texte à la largeur disponible.
 *
 * Sans cela, une description un peu longue sort de la page — le texte n'est
 * pas tronqué par le PDF, il continue simplement dans le vide et devient
 * invisible à l'impression. On ne s'en apercevrait que sur la facture d'un
 * vrai client.
 */
function couper(texte: string, police: PDFFont, taille: number, largeur: number): string {
  if (police.widthOfTextAtSize(texte, taille) <= largeur) return texte
  let court = texte
  while (court.length > 1 && police.widthOfTextAtSize(court + "…", taille) > largeur) {
    court = court.slice(0, -1)
  }
  return court + "…"
}

/** Écrit une valeur alignée à DROITE sur x — les montants se lisent en colonne. */
function droite(page: PDFPage, texte: string, x: number, y: number, police: PDFFont, taille: number, couleur = ENCRE) {
  page.drawText(texte, { x: x - police.widthOfTextAtSize(texte, taille), y, size: taille, font: police, color: couleur })
}

async function logoEnOctets(url: string): Promise<{ octets: Uint8Array; type: "png" | "jpg" } | null> {
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
    // Un logo illisible ne doit pas empêcher d'émettre une facture. On
    // l'omet ; le nom du cabinet reste imprimé, et la pièce reste valable.
    return null
  }
}

export async function facturePdf(f: FacturePdf, c: CabinetPdf): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([595.28, 841.89]) // A4
  const normal = await doc.embedFont(StandardFonts.Helvetica)
  const gras = await doc.embedFont(StandardFonts.HelveticaBold)

  const G = 56 // marge gauche
  const D = 539 // bord droit
  let y = 786

  // ---- En-tête : le cabinet ------------------------------------------------
  const logo = await logoEnOctets(c.logoUrl)
  if (logo) {
    try {
      const image = logo.type === "jpg" ? await doc.embedJpg(logo.octets) : await doc.embedPng(logo.octets)
      const h = 40
      const l = (image.width / image.height) * h
      page.drawImage(image, { x: G, y: y - h + 8, width: Math.min(l, 150), height: h })
      y -= h + 14
    } catch {
      // Format non reconnu par pdf-lib : même raisonnement que ci-dessus.
    }
  }

  page.drawText(c.nom, { x: G, y, size: 16, font: gras, color: ENCRE })
  y -= 15
  for (const ligne of [c.adresse, [c.telephone, c.courriel].filter(Boolean).join(" · "), c.numeroPermis ? `Consultant réglementé CRIC ${c.numeroPermis}` : ""]) {
    if (!ligne) continue
    page.drawText(couper(ligne, normal, 8.5, 300), { x: G, y, size: 8.5, font: normal, color: GRIS })
    y -= 11
  }

  // ---- Le titre, à droite --------------------------------------------------
  droite(page, "FACTURE", D, 786, gras, 22)
  droite(page, f.numero, D, 766, normal, 11, GRIS)
  droite(page, `Date : ${f.date}`, D, 750, normal, 9, GRIS)
  if (f.echeance) droite(page, `Échéance : ${f.echeance}`, D, 738, normal, 9, GRIS)

  y = Math.min(y, 726)
  page.drawLine({ start: { x: G, y }, end: { x: D, y }, thickness: 0.8, color: TRAIT })
  y -= 24

  // ---- Le client -----------------------------------------------------------
  page.drawText("FACTURÉ À", { x: G, y, size: 8, font: gras, color: GRIS })
  droite(page, "DOSSIER", D, y, gras, 8, GRIS)
  y -= 14
  page.drawText(couper(f.clientNom, gras, 11, 260), { x: G, y, size: 11, font: gras, color: ENCRE })
  droite(page, f.dossierReference, D, y, normal, 10, ENCRE)
  y -= 12
  for (const ligne of [f.clientAdresse, f.clientCourriel]) {
    if (!ligne) continue
    page.drawText(couper(ligne, normal, 9, 260), { x: G, y, size: 9, font: normal, color: GRIS })
    y -= 11
  }
  if (f.consultant) droite(page, couper(f.consultant, normal, 9, 200), D, y + 11, normal, 9, GRIS)

  y -= 22

  // ---- Les lignes ----------------------------------------------------------
  const xQte = 360
  const xPrix = 440
  page.drawRectangle({ x: G, y: y - 4, width: D - G, height: 20, color: rgb(0.96, 0.97, 0.98) })
  page.drawText("DESCRIPTION", { x: G + 8, y: y + 2, size: 8, font: gras, color: GRIS })
  droite(page, "QTÉ", xQte, y + 2, gras, 8, GRIS)
  droite(page, "PRIX", xPrix, y + 2, gras, 8, GRIS)
  droite(page, "MONTANT", D - 8, y + 2, gras, 8, GRIS)
  y -= 20

  for (const l of f.lignes) {
    const montant = l.quantite * l.prixUnitaire
    page.drawText(couper(l.description, normal, 9.5, 280), { x: G + 8, y, size: 9.5, font: normal, color: ENCRE })
    droite(page, String(l.quantite), xQte, y, normal, 9.5)
    droite(page, argent(l.prixUnitaire), xPrix, y, normal, 9.5)
    droite(page, argent(montant), D - 8, y, normal, 9.5)
    if (!l.taxable) {
      y -= 10
      page.drawText("non taxable", { x: G + 8, y, size: 7.5, font: normal, color: GRIS })
    }
    y -= 18
    page.drawLine({ start: { x: G, y: y + 6 }, end: { x: D, y: y + 6 }, thickness: 0.4, color: TRAIT })
  }

  // ---- Les totaux ----------------------------------------------------------
  y -= 10
  const totaux: [string, number, boolean][] = [
    ["Sous-total", f.sousTotal, false],
    [c.numeroTps ? `TPS (${c.numeroTps})` : "TPS", f.tps, false],
    [c.numeroTvq ? `TVQ (${c.numeroTvq})` : "TVQ", f.tvq, false],
    ["Total", f.total, true],
  ]
  for (const [libelle, valeur, fort] of totaux) {
    const police = fort ? gras : normal
    const taille = fort ? 11 : 9.5
    if (fort) {
      y -= 4
      page.drawLine({ start: { x: 340, y: y + 12 }, end: { x: D, y: y + 12 }, thickness: 0.8, color: TRAIT })
    }
    droite(page, libelle, 470, y, police, taille, fort ? ENCRE : GRIS)
    droite(page, argent(valeur), D, y, police, taille)
    y -= fort ? 20 : 15
  }

  if (f.regle > 0) {
    droite(page, "Déjà réglé", 470, y, normal, 9.5, GRIS)
    droite(page, argent(f.regle), D, y, normal, 9.5)
    y -= 15
    droite(page, "Solde dû", 470, y, gras, 11)
    droite(page, argent(f.total - f.regle), D, y, gras, 11)
    y -= 20
  }

  // ---- Le pied -------------------------------------------------------------
  let bas = 96
  if (c.conditionsPaiement) {
    page.drawText("CONDITIONS DE PAIEMENT", { x: G, y: bas, size: 8, font: gras, color: GRIS })
    bas -= 12
    for (const ligne of c.conditionsPaiement.split("\n").slice(0, 4)) {
      page.drawText(couper(ligne, normal, 8.5, D - G), { x: G, y: bas, size: 8.5, font: normal, color: GRIS })
      bas -= 10
    }
  }
  if (f.notes) {
    bas -= 6
    page.drawText(couper(f.notes, normal, 8.5, D - G), { x: G, y: bas, size: 8.5, font: normal, color: GRIS })
  }

  // Un brouillon porte sa mention. Sans elle, une facture non émise circule et
  // se fait payer comme une vraie — puis son numéro change à l'émission.
  if (f.statut === "draft") {
    page.drawText("BROUILLON", {
      x: 190, y: 400, size: 54, font: gras, color: rgb(0.93, 0.94, 0.96), rotate: { type: "degrees", angle: 32 } as never,
    })
  }

  return doc.save()
}

/**
 * Le reçu d'un paiement.
 *
 * Un reçu n'est pas une facture allégée : la facture dit « vous devez », le
 * reçu dit « vous avez payé ». Il porte donc le montant REÇU, sa date, son
 * mode, sa référence — et le solde qui reste, car c'est la première question
 * du client qui vient de payer.
 *
 * Il partage l'en-tête et les helpers de la facture : deux gabarits séparés
 * auraient divergé au premier changement d'adresse du cabinet, et le client
 * aurait reçu deux documents au nom de deux cabinets légèrement différents.
 */
export interface RecuPdf {
  numero: string
  date: string
  montant: number
  mode: string
  reference: string
  notes: string
  clientNom: string
  clientCourriel: string
  dossierReference: string
  factureNumero: string
  factureTotal: number
  dejaRegle: number
  /** Vrai si l'argent est entré en fidéicommis et non au compte général. */
  enFideicommis: boolean
}

const MODES: Record<string, string> = {
  card: "Carte", interac: "Virement Interac", bank_transfer: "Virement bancaire",
  cheque: "Chèque", cash: "Comptant", other: "Autre",
}

export async function recuPdf(r: RecuPdf, c: CabinetPdf): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([595.28, 841.89])
  const normal = await doc.embedFont(StandardFonts.Helvetica)
  const gras = await doc.embedFont(StandardFonts.HelveticaBold)

  const G = 56
  const D = 539
  let y = 786

  const logo = await logoEnOctets(c.logoUrl)
  if (logo) {
    try {
      const image = logo.type === "jpg" ? await doc.embedJpg(logo.octets) : await doc.embedPng(logo.octets)
      const h = 40
      page.drawImage(image, { x: G, y: y - h + 8, width: Math.min((image.width / image.height) * h, 150), height: h })
      y -= h + 14
    } catch { /* voir facturePdf */ }
  }

  page.drawText(c.nom, { x: G, y, size: 16, font: gras, color: ENCRE })
  y -= 15
  for (const ligne of [c.adresse, [c.telephone, c.courriel].filter(Boolean).join(" · "),
                       c.numeroPermis ? `Consultant réglementé CRIC ${c.numeroPermis}` : ""]) {
    if (!ligne) continue
    page.drawText(couper(ligne, normal, 8.5, 300), { x: G, y, size: 8.5, font: normal, color: GRIS })
    y -= 11
  }

  droite(page, "REÇU", D, 786, gras, 22)
  droite(page, r.numero, D, 766, normal, 11, GRIS)
  droite(page, `Reçu le ${r.date}`, D, 750, normal, 9, GRIS)

  y = Math.min(y, 726)
  page.drawLine({ start: { x: G, y }, end: { x: D, y }, thickness: 0.8, color: TRAIT })
  y -= 24

  page.drawText("REÇU DE", { x: G, y, size: 8, font: gras, color: GRIS })
  droite(page, "DOSSIER", D, y, gras, 8, GRIS)
  y -= 14
  page.drawText(couper(r.clientNom, gras, 11, 260), { x: G, y, size: 11, font: gras, color: ENCRE })
  droite(page, r.dossierReference, D, y, normal, 10, ENCRE)
  y -= 12
  if (r.clientCourriel) {
    page.drawText(couper(r.clientCourriel, normal, 9, 260), { x: G, y, size: 9, font: normal, color: GRIS })
    y -= 11
  }

  // Le montant reçu, en grand : c'est l'unique raison d'être du document.
  y -= 22
  page.drawRectangle({ x: G, y: y - 34, width: D - G, height: 56, color: rgb(0.96, 0.97, 0.98) })
  page.drawText("MONTANT REÇU", { x: G + 16, y: y + 6, size: 8, font: gras, color: GRIS })
  page.drawText(argent(r.montant), { x: G + 16, y: y - 22, size: 24, font: gras, color: ENCRE })
  droite(page, MODES[r.mode] ?? r.mode, D - 16, y + 6, normal, 9, GRIS)
  if (r.reference) droite(page, `Réf. ${r.reference}`, D - 16, y - 8, normal, 9, GRIS)
  y -= 60

  const details: [string, string][] = [
    ["Facture", r.factureNumero || "—"],
    ["Total de la facture", argent(r.factureTotal)],
    ["Total réglé à ce jour", argent(r.dejaRegle)],
    ["Solde restant", argent(Math.max(0, r.factureTotal - r.dejaRegle))],
  ]
  for (const [libelle, valeur] of details) {
    const solde = libelle === "Solde restant"
    droite(page, libelle, 400, y, solde ? gras : normal, solde ? 10 : 9.5, solde ? ENCRE : GRIS)
    droite(page, valeur, D, y, solde ? gras : normal, solde ? 10 : 9.5)
    y -= solde ? 20 : 15
  }

  if (r.enFideicommis) {
    y -= 8
    // Une somme en fiducie n'appartient pas encore au cabinet. Le taire sur
    // le reçu laisserait croire que les honoraires sont acquis — ce que
    // l'article 13 interdit précisément de laisser croire.
    page.drawText("Ces fonds sont détenus en fidéicommis (art. 13) et ne seront virés au compte",
      { x: G, y, size: 8.5, font: normal, color: GRIS })
    y -= 11
    page.drawText("général du cabinet qu'au fur et à mesure des services rendus.",
      { x: G, y, size: 8.5, font: normal, color: GRIS })
  }

  if (r.notes) {
    page.drawText(couper(r.notes, normal, 8.5, D - G), { x: G, y: 110, size: 8.5, font: normal, color: GRIS })
  }
  page.drawText("Merci de votre confiance.", { x: G, y: 88, size: 9, font: normal, color: GRIS })

  return doc.save()
}
