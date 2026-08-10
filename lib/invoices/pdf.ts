import "server-only"

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib"

/**
 * La facture et le reçu, en PDF.
 *
 * Composés plutôt que remplis : contrairement aux formulaires d'IRCC, il
 * n'existe pas de gabarit officiel à respecter. pdf-lib était déjà une
 * dépendance du projet ; en ajouter une seconde pour dessiner quelques lignes
 * de texte aurait coûté une chaîne de mises à jour pour rien.
 *
 * Helvetica plutôt qu'une police intégrée : les polices standard d'un PDF
 * couvrent le WinAnsi, donc les accents français. Une police à intégrer
 * pèserait trois cents kilo-octets par facture.
 *
 * MISE EN PAGE — trois partis pris qui ne sont pas décoratifs.
 *
 * 1. LE MONTANT DÛ EST EN HAUT. Le client apprend ce qu'il doit dans le
 *    premier tiers de la page, à côté de la date d'échéance. Le chercher au
 *    bas, après le détail, c'est ce qui fait qu'on repose la facture « pour
 *    plus tard ».
 *
 * 2. CHAQUE TAXE IMPRIME SON TAUX, pas seulement son montant. Une facture qui
 *    montre « TPS 5,000 % · 10,00 $ » se vérifie ; une facture qui ne montre
 *    que « 10,00 $ » se croit. Le taux vient du cabinet, jamais d'une
 *    constante écrite ici.
 *
 * 3. LE SOLDE DÛ EST DISTINCT DU TOTAL. Après un acompte, ce sont deux
 *    nombres différents, et le client n'a besoin que du second.
 */

export type LanguePdf = "fr" | "en"

/**
 * Tout le vocabulaire imprimé, en un seul endroit.
 *
 * Un libellé oublié dans une fonction de dessin serait un mot français au
 * milieu d'un document anglais — et personne ne le verrait avant qu'un client
 * anglophone ne le reçoive. Les fonctions ci-dessous ne contiennent donc
 * AUCUNE chaîne visible.
 */
const MOTS = {
  fr: {
    facture: "FACTURE",
    recu: "REÇU",
    consultantCric: "Consultant réglementé CRIC",
    factureA: "FACTURÉ À",
    recuDe: "REÇU DE",
    dateEmise: "DATE D'ÉMISSION",
    dateRecu: "DATE DU PAIEMENT",
    numeroFacture: "N° DE FACTURE",
    numeroRecu: "N° DE REÇU",
    echeance: "ÉCHÉANCE",
    montantDu: "MONTANT DÛ",
    montantRecu: "MONTANT REÇU",
    dossier: "DOSSIER",
    description: "Description",
    taux: "Taux",
    quantite: "Qté",
    montant: "Montant",
    plusTaxes: "+ taxes",
    nonTaxable: "non taxable",
    sousTotal: "Sous-total",
    tps: "TPS",
    tvq: "TVQ",
    exonere: "Exonérée de taxes",
    total: "Total",
    dejaRegle: "Déjà réglé",
    soldeDu: "SOLDE DÛ",
    notes: "NOTES",
    conditions: "CONDITIONS DE PAIEMENT",
    brouillon: "BROUILLON",
    page: (n: number, sur: number) => `Page ${n} sur ${sur}`,
    factureLiee: "Facture",
    totalFacture: "Total de la facture",
    regleAJour: "Total réglé à ce jour",
    soldeRestant: "SOLDE RESTANT",
    fiducie1: "Ces fonds sont détenus en fidéicommis (art. 13) et ne seront virés au compte",
    fiducie2: "général du cabinet qu'au fur et à mesure des services rendus.",
    merci: "Merci de votre confiance.",
    modes: {
      card: "Carte", interac: "Virement Interac", bank_transfer: "Virement bancaire",
      cheque: "Chèque", cash: "Comptant", other: "Autre",
    } as Record<string, string>,
  },
  en: {
    facture: "INVOICE",
    recu: "RECEIPT",
    consultantCric: "Regulated Canadian Immigration Consultant",
    factureA: "BILLED TO",
    recuDe: "RECEIVED FROM",
    dateEmise: "DATE ISSUED",
    dateRecu: "PAYMENT DATE",
    numeroFacture: "INVOICE NUMBER",
    numeroRecu: "RECEIPT NUMBER",
    echeance: "DUE DATE",
    montantDu: "AMOUNT DUE",
    montantRecu: "AMOUNT RECEIVED",
    dossier: "MATTER",
    description: "Description",
    taux: "Rate",
    quantite: "Qty",
    montant: "Amount",
    plusTaxes: "+ tax",
    nonTaxable: "non-taxable",
    sousTotal: "Subtotal",
    tps: "GST",
    tvq: "QST",
    exonere: "Tax exempt",
    total: "Total",
    dejaRegle: "Already paid",
    soldeDu: "BALANCE DUE",
    notes: "NOTES",
    conditions: "PAYMENT TERMS",
    brouillon: "DRAFT",
    page: (n: number, sur: number) => `Page ${n} of ${sur}`,
    factureLiee: "Invoice",
    totalFacture: "Invoice total",
    regleAJour: "Paid to date",
    soldeRestant: "REMAINING BALANCE",
    fiducie1: "These funds are held in trust (s. 13) and will only be transferred to the",
    fiducie2: "firm's general account as services are rendered.",
    merci: "Thank you for your trust.",
    modes: {
      card: "Card", interac: "Interac transfer", bank_transfer: "Bank transfer",
      cheque: "Cheque", cash: "Cash", other: "Other",
    } as Record<string, string>,
  },
} as const

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
  /** Taux du cabinet, en fraction : 0.05 s'imprime « 5,000 % ». */
  tauxTps?: number
  tauxTvq?: number
  /** Vraie, aucune ligne de taxe n'est imprimée — une mention la remplace. */
  exonere?: boolean
  langue?: LanguePdf
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

const LARGEUR = 595.28
const HAUTEUR = 841.89
const G = 56 // marge gauche
const D = 539 // bord droit

const argentDe = (langue: LanguePdf) => (v: number) =>
  new Intl.NumberFormat(langue === "en" ? "en-CA" : "fr-CA", { style: "currency", currency: "CAD" })
    .format(v)
    .replace(/[\u00A0\u202F]/g, " ")

/**
 * Un taux en pourcentage lisible : 0.09975 devient « 9,975 % ».
 *
 * Trois décimales, parce que la TVQ en compte trois. En arrondir deux
 * afficherait « 9,98 % » sur une facture calculée à 9,975 % : le client qui
 * refait l'opération ne retomberait pas sur le montant imprimé juste à côté.
 */
const pourcentDe = (langue: LanguePdf) => (taux: number) =>
  new Intl.NumberFormat(langue === "en" ? "en-CA" : "fr-CA", {
    style: "percent", minimumFractionDigits: 3, maximumFractionDigits: 3,
  })
    .format(taux)
    // Intl place une espace FINE INSÉCABLE (U+202F) devant le %. Elle ne fait
    // pas partie du WinAnsi que couvrent les polices standard d'un PDF : la
    // laisser passer expose à un refus d'encodage au moment d'écrire la page.
    .replace(/[\u00A0\u202F]/g, " ")

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

/** Écrit une valeur CENTRÉE sur x — utilisé par la pagination. */
function centre(page: PDFPage, texte: string, x: number, y: number, police: PDFFont, taille: number, couleur = GRIS) {
  page.drawText(texte, { x: x - police.widthOfTextAtSize(texte, taille) / 2, y, size: taille, font: police, color: couleur })
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

/**
 * L'en-tête commun aux deux documents : logo à gauche, cabinet à droite.
 *
 * Partagé, et c'est le point : deux en-têtes séparés auraient divergé au
 * premier changement d'adresse, et le client aurait reçu une facture et un
 * reçu au nom de deux cabinets légèrement différents.
 *
 * Rend l'ordonnée du bas de l'en-tête, d'où la suite du document repart.
 */
async function enTete(
  doc: PDFDocument, page: PDFPage, c: CabinetPdf, m: typeof MOTS.fr | typeof MOTS.en,
  normal: PDFFont, gras: PDFFont, titre: string
): Promise<number> {
  const hautCabinet = 786
  let yCabinet = hautCabinet

  droite(page, couper(c.nom, gras, 12, 300), D, yCabinet, gras, 12)
  yCabinet -= 14
  for (const ligne of [
    c.adresse,
    [c.telephone, c.courriel].filter(Boolean).join(" · "),
    c.numeroPermis ? `${m.consultantCric} ${c.numeroPermis}` : "",
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
  const yTitre = Math.min(yGauche - 22, yCabinet - 6)
  page.drawText(titre, { x: G, y: yTitre, size: 26, font: gras, color: ENCRE })

  return yTitre - 34
}

/**
 * Une colonne du bandeau : une étiquette grise, sa valeur dessous.
 *
 * `aDroite` aligne le bloc sur son bord droit, pour la colonne des montants.
 */
function bloc(
  page: PDFPage, x: number, y: number, etiquette: string, valeur: string,
  normal: PDFFont, gras: PDFFont, aDroite = false, tailleValeur = 10, couleurValeur = ENCRE
) {
  if (aDroite) {
    droite(page, etiquette, x, y, gras, 7.5, GRIS)
    droite(page, valeur, x, y - 15, gras, tailleValeur, couleurValeur)
  } else {
    page.drawText(etiquette, { x, y, size: 7.5, font: gras, color: GRIS })
    page.drawText(valeur, { x, y: y - 15, size: tailleValeur, font: gras, color: couleurValeur })
  }
}

/** Le pied de page, identique sur les deux documents. */
function pagination(page: PDFPage, m: typeof MOTS.fr | typeof MOTS.en, normal: PDFFont) {
  centre(page, m.page(1, 1), LARGEUR / 2, 40, normal, 8)
}

export async function facturePdf(f: FacturePdf, c: CabinetPdf): Promise<Uint8Array> {
  const langue: LanguePdf = f.langue ?? "fr"
  const m = MOTS[langue]
  const argent = argentDe(langue)
  const pourcent = pourcentDe(langue)

  const doc = await PDFDocument.create()
  const page = doc.addPage([LARGEUR, HAUTEUR])
  const normal = await doc.embedFont(StandardFonts.Helvetica)
  const gras = await doc.embedFont(StandardFonts.HelveticaBold)

  let y = await enTete(doc, page, c, m, normal, gras, m.facture)

  // ---- Le bandeau : à qui, quand, combien ---------------------------------
  const xMilieu = 300
  const solde = f.total - f.regle

  bloc(page, G, y, m.factureA, couper(f.clientNom, gras, 10, 220), normal, gras)
  let yClient = y - 28
  for (const ligne of [f.clientAdresse, f.clientCourriel]) {
    if (!ligne) continue
    page.drawText(couper(ligne, normal, 9, 220), { x: G, y: yClient, size: 9, font: normal, color: GRIS })
    yClient -= 11
  }

  bloc(page, xMilieu, y, m.dateEmise, f.date, normal, gras, false, 9.5)
  if (f.echeance) bloc(page, D, y, m.echeance, f.echeance, normal, gras, true, 9.5)

  const yBas = y - 46
  bloc(page, xMilieu, yBas, m.numeroFacture, f.numero, normal, gras, false, 9.5)
  // Le montant dû, en haut, à droite : la question du client, à l'endroit où
  // l'œil termine sa lecture du bandeau.
  bloc(page, D, yBas, m.montantDu, argent(solde), normal, gras, true, 14)

  y = Math.min(yClient, yBas - 22) - 14
  if (f.dossierReference) {
    page.drawText(`${m.dossier} ${f.dossierReference}${f.consultant ? ` · ${f.consultant}` : ""}`,
      { x: G, y: y + 8, size: 8.5, font: normal, color: GRIS })
    y -= 6
  }

  page.drawLine({ start: { x: G, y }, end: { x: D, y }, thickness: 1.6, color: ENCRE })
  y -= 20

  // ---- Le tableau ---------------------------------------------------------
  const xTaux = 380
  const xQte = 452
  page.drawText(m.description, { x: G, y, size: 8, font: normal, color: GRIS })
  droite(page, m.taux, xTaux, y, normal, 8, GRIS)
  droite(page, m.quantite, xQte, y, normal, 8, GRIS)
  droite(page, m.montant, D, y, normal, 8, GRIS)
  y -= 22

  for (const l of f.lignes) {
    page.drawText(couper(l.description, normal, 10, 300), { x: G, y, size: 10, font: normal, color: ENCRE })
    droite(page, argent(l.prixUnitaire), xTaux, y, normal, 9, GRIS)
    droite(page, String(l.quantite), xQte, y, normal, 9, GRIS)
    droite(page, argent(l.quantite * l.prixUnitaire), D, y, normal, 9.5)
    // La mention de taxe se place SOUS le taux, comme dans le modèle : elle
    // qualifie le prix unitaire, pas la ligne entière.
    droite(page, l.taxable ? m.plusTaxes : m.nonTaxable, xTaux, y - 14, normal, 8, GRIS)
    y -= 34
  }

  // ---- Les totaux ---------------------------------------------------------
  const xLibelle = 470
  y -= 6

  droite(page, m.sousTotal, xLibelle, y, normal, 9.5, GRIS)
  droite(page, argent(f.sousTotal), D, y, normal, 9.5)
  y -= 16

  if (f.exonere) {
    droite(page, m.exonere, xLibelle, y, normal, 9.5, GRIS)
    y -= 16
  } else {
    // Une taxe dont le taux est nul ne s'imprime pas : un cabinet hors Québec
    // n'a pas à voir « TVQ 0,000 % » sur ses factures.
    const taxes: [string, number, number][] = [
      [m.tps, f.tauxTps ?? 0, f.tps],
      [m.tvq, f.tauxTvq ?? 0, f.tvq],
    ]
    for (const [nom, taux, valeur] of taxes) {
      if (taux <= 0 && valeur <= 0) continue
      droite(page, `${nom} ${pourcent(taux)}`, xLibelle, y, normal, 9.5, GRIS)
      droite(page, `+${argent(valeur)}`, D, y, normal, 9.5)
      y -= 16
    }
  }

  page.drawLine({ start: { x: 340, y: y + 8 }, end: { x: D, y: y + 8 }, thickness: 0.6, color: TRAIT })
  y -= 6
  droite(page, m.total, xLibelle, y, normal, 11, ENCRE)
  droite(page, argent(f.total), D, y, normal, 11)
  y -= 18

  if (f.regle > 0) {
    droite(page, m.dejaRegle, xLibelle, y, normal, 9.5, GRIS)
    droite(page, `−${argent(f.regle)}`, D, y, normal, 9.5, GRIS)
    y -= 16
  }

  page.drawLine({ start: { x: 340, y: y + 9 }, end: { x: D, y: y + 9 }, thickness: 1.6, color: ENCRE })
  y -= 6
  droite(page, m.soldeDu, xLibelle, y, gras, 11)
  droite(page, argent(solde), D, y, gras, 11)

  // ---- Le pied ------------------------------------------------------------
  // Les notes SUIVENT les totaux au lieu d'être clouées en bas de page : sur
  // une facture à deux lignes, un bloc épinglé au ras du pied paraissait
  // détaché du document et se lisait comme une mention légale, pas comme un
  // message du cabinet. Le plancher garde la place de la pagination.
  let bas = Math.max(y - 44, 132)
  if (f.notes) {
    page.drawText(m.notes, { x: G, y: bas, size: 8, font: gras, color: GRIS })
    bas -= 13
    page.drawText(couper(f.notes, normal, 9, D - G), { x: G, y: bas, size: 9, font: normal, color: ENCRE })
    bas -= 20
  }
  if (c.conditionsPaiement) {
    page.drawText(m.conditions, { x: G, y: bas, size: 8, font: gras, color: GRIS })
    bas -= 13
    for (const ligne of c.conditionsPaiement.split("\n").slice(0, 3)) {
      page.drawText(couper(ligne, normal, 9, D - G), { x: G, y: bas, size: 9, font: normal, color: ENCRE })
      bas -= 11
    }
  }

  // Les numéros de taxe engagent le cabinet : ils s'impriment quand ils
  // existent, et rien ne les invente quand ils manquent.
  const numeros = [c.numeroTps && `${m.tps} ${c.numeroTps}`, c.numeroTvq && `${m.tvq} ${c.numeroTvq}`]
    .filter(Boolean).join(" · ")
  if (numeros) page.drawText(numeros, { x: G, y: 62, size: 8, font: normal, color: GRIS })

  pagination(page, m, normal)

  // Un brouillon porte sa mention. Sans elle, une facture non émise circule et
  // se fait payer comme une vraie — puis son numéro change à l'émission.
  if (f.statut === "draft") {
    page.drawText(m.brouillon, {
      x: 170, y: 400, size: 54, font: gras, color: rgb(0.93, 0.94, 0.96), rotate: { type: "degrees", angle: 32 } as never,
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
  langue?: LanguePdf
}

export async function recuPdf(r: RecuPdf, c: CabinetPdf): Promise<Uint8Array> {
  const langue: LanguePdf = r.langue ?? "fr"
  const m = MOTS[langue]
  const argent = argentDe(langue)

  const doc = await PDFDocument.create()
  const page = doc.addPage([LARGEUR, HAUTEUR])
  const normal = await doc.embedFont(StandardFonts.Helvetica)
  const gras = await doc.embedFont(StandardFonts.HelveticaBold)

  let y = await enTete(doc, page, c, m, normal, gras, m.recu)

  const xMilieu = 300

  bloc(page, G, y, m.recuDe, couper(r.clientNom, gras, 10, 220), normal, gras)
  let yClient = y - 28
  if (r.clientCourriel) {
    page.drawText(couper(r.clientCourriel, normal, 9, 220), { x: G, y: yClient, size: 9, font: normal, color: GRIS })
    yClient -= 11
  }

  bloc(page, xMilieu, y, m.dateRecu, r.date, normal, gras, false, 9.5)
  bloc(page, D, y, m.montantRecu, argent(r.montant), normal, gras, true, 14)

  const yBas = y - 46
  bloc(page, xMilieu, yBas, m.numeroRecu, r.numero, normal, gras, false, 9.5)
  droite(page, m.modes[r.mode] ?? r.mode, D, yBas - 15, normal, 9, GRIS)
  if (r.reference) droite(page, r.reference, D, yBas - 27, normal, 8.5, GRIS)

  y = Math.min(yClient, yBas - 34) - 14
  if (r.dossierReference) {
    page.drawText(`${m.dossier} ${r.dossierReference}`, { x: G, y: y + 8, size: 8.5, font: normal, color: GRIS })
    y -= 6
  }

  page.drawLine({ start: { x: G, y }, end: { x: D, y }, thickness: 1.6, color: ENCRE })
  y -= 26

  // 445 et non 470 comme sur la facture : ici la colonne de droite reçoit un
  // NUMÉRO de facture, bien plus large qu'un montant. À 470, « Facture » et
  // « FAC-2026-000001 » se chevauchaient et donnaient « FactuFAC-2026-000001 ».
  const xLibelle = 445
  const details: [string, string][] = [
    [m.factureLiee, r.factureNumero || "—"],
    [m.totalFacture, argent(r.factureTotal)],
    [m.regleAJour, argent(r.dejaRegle)],
  ]
  for (const [libelle, valeur] of details) {
    droite(page, libelle, xLibelle, y, normal, 9.5, GRIS)
    droite(page, valeur, D, y, normal, 9.5)
    y -= 16
  }

  page.drawLine({ start: { x: 340, y: y + 9 }, end: { x: D, y: y + 9 }, thickness: 1.6, color: ENCRE })
  y -= 6
  droite(page, m.soldeRestant, xLibelle, y, gras, 11)
  droite(page, argent(Math.max(0, r.factureTotal - r.dejaRegle)), D, y, gras, 11)
  y -= 34

  if (r.enFideicommis) {
    // Une somme en fiducie n'appartient pas encore au cabinet. Le taire sur
    // le reçu laisserait croire que les honoraires sont acquis — ce que
    // l'article 13 interdit précisément de laisser croire.
    page.drawText(m.fiducie1, { x: G, y, size: 8.5, font: normal, color: GRIS })
    y -= 11
    page.drawText(m.fiducie2, { x: G, y, size: 8.5, font: normal, color: GRIS })
  }

  // Même raison que sur la facture : le bloc suit le corps du document plutôt
  // que de flotter au ras du pied.
  let bas = Math.max(y - 30, 110)
  if (r.notes) {
    page.drawText(m.notes, { x: G, y: bas, size: 8, font: gras, color: GRIS })
    bas -= 13
    page.drawText(couper(r.notes, normal, 9, D - G), { x: G, y: bas, size: 9, font: normal, color: ENCRE })
    bas -= 18
  }
  page.drawText(m.merci, { x: G, y: bas, size: 9, font: normal, color: GRIS })

  pagination(page, m, normal)

  return doc.save()
}
