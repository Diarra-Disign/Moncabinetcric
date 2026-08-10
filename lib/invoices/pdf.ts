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
    modeCol: "Mode",
    dateCol: "Date",
    paiement: "Paiement reçu",
    enFiducie: "en fidéicommis",
    compteGeneral: "compte de l'entreprise",
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
    modeCol: "Method",
    dateCol: "Date",
    paiement: "Payment received",
    enFiducie: "in trust",
    compteGeneral: "general account",
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
 * Rend un texte imprimable par une police standard de PDF.
 *
 * LE DÉFAUT QUE CECI CORRIGE : les polices standard ne couvrent que le
 * WinAnsi, et pdf-lib LÈVE UNE ERREUR sur tout caractère hors de ce jeu. Une
 * cliente nommée Nguyễn, un client nommé Wojciech ou أحمد rendaient donc leur
 * facture impossible à produire — la route répondait 500 et le bouton
 * « Voir le PDF » ne faisait rien. Pour un cabinet d'immigration, ces noms
 * sont la règle, pas l'exception.
 *
 * On translittère plutôt que d'échouer : « ễ » se décompose en « e » plus des
 * accents, dont on garde la base — c'est la romanisation qu'IRCC emploie déjà
 * sur les documents de voyage. Les lettres latines qui ne se décomposent pas
 * (ł, đ) ont leur équivalent en table.
 *
 * Ce qui ne se translittère pas — arabe, chinois, cyrillique — devient « ? ».
 * C'est un compromis ASSUMÉ et il se voit : mieux vaut un nom visiblement
 * incomplet, qu'on corrige, qu'un document qui n'existe pas. Imprimer ces
 * écritures demanderait d'intégrer une police Unicode au PDF.
 */
const EQUIVALENTS: Record<string, string> = {
  "ł": "l", "Ł": "L", "đ": "d", "Đ": "D", "ħ": "h", "Ħ": "H",
  "ı": "i", "ŋ": "n", "Ŋ": "N", "ŧ": "t", "Ŧ": "T", "ə": "e",
  "‑": "-", "‒": "-", "―": "-", "′": "'", "″": '"',
  // U+2212, le vrai signe moins. Il est plus juste typographiquement que le
  // trait d'union, et c'est celui qu'on écrit spontanément devant un montant
  // déduit — mais WinAnsi ne le connaît pas. Sans cette ligne, « Déjà réglé »
  // s'imprimait « ?300,00 $ » sur chaque reçu.
  "−": "-",
}

/**
 * Les vingt-sept caractères que WinAnsi loge entre 0x80 et 0x9F, hors du
 * latin-1 : sans cette liste, l'apostrophe courbe et le tiret cadratin
 * — fréquents dans un texte français — seraient translittérés pour rien.
 */
const WINANSI_SUP = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ''“”•–—˜™š›œžŸ")

const encodable = (c: string) => {
  const n = c.codePointAt(0) ?? 0
  return (n >= 0x20 && n <= 0x7e) || (n >= 0xa0 && n <= 0xff) || WINANSI_SUP.has(c)
}

function sur(texte: string): string {
  let sortie = ""
  for (const c of texte) {
    if (encodable(c)) { sortie += c; continue }
    if (EQUIVALENTS[c]) { sortie += EQUIVALENTS[c]; continue }
    // « ễ » se décompose en « e » suivi de deux marques : on garde la base.
    const base = [...c.normalize("NFD")].filter((d) => encodable(d)).join("")
    sortie += base || "?"
  }
  return sortie
}

/** Toute écriture passe par ici : un seul point où le texte est assaini. */
function ecrire(
  page: PDFPage, texte: string,
  options: Parameters<PDFPage["drawText"]>[1]
) {
  page.drawText(sur(texte), options)
}

/**
 * Coupe un texte à la largeur disponible.
 *
 * Sans cela, une description un peu longue sort de la page — le texte n'est
 * pas tronqué par le PDF, il continue simplement dans le vide et devient
 * invisible à l'impression. On ne s'en apercevrait que sur la facture d'un
 * vrai client.
 */
function couper(entree: string, police: PDFFont, taille: number, largeur: number): string {
  // Mesuré APRÈS assainissement : « Nguyễn » et « Nguyen » n'ont pas la même
  // largeur, et c'est le second qui sera écrit.
  const texte = sur(entree)
  if (police.widthOfTextAtSize(texte, taille) <= largeur) return texte
  let court = texte
  while (court.length > 1 && police.widthOfTextAtSize(court + "…", taille) > largeur) {
    court = court.slice(0, -1)
  }
  return court + "…"
}

/** Écrit une valeur alignée à DROITE sur x — les montants se lisent en colonne. */
function droite(page: PDFPage, texte: string, x: number, y: number, police: PDFFont, taille: number, couleur = ENCRE) {
  const t = sur(texte)
  page.drawText(t, { x: x - police.widthOfTextAtSize(t, taille), y, size: taille, font: police, color: couleur })
}

/** Écrit une valeur CENTRÉE sur x — utilisé par la pagination. */
function centre(page: PDFPage, texte: string, x: number, y: number, police: PDFFont, taille: number, couleur = GRIS) {
  const t = sur(texte)
  page.drawText(t, { x: x - police.widthOfTextAtSize(t, taille) / 2, y, size: taille, font: police, color: couleur })
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
  ecrire(page, titre, { x: G, y: yTitre, size: 26, font: gras, color: ENCRE })

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
    ecrire(page, etiquette, { x, y, size: 7.5, font: gras, color: GRIS })
    ecrire(page, valeur, { x, y: y - 15, size: tailleValeur, font: gras, color: couleurValeur })
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
    ecrire(page, couper(ligne, normal, 9, 220), { x: G, y: yClient, size: 9, font: normal, color: GRIS })
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
    ecrire(page, `${m.dossier} ${f.dossierReference}${f.consultant ? ` · ${f.consultant}` : ""}`,
      { x: G, y: y + 8, size: 8.5, font: normal, color: GRIS })
    y -= 6
  }

  page.drawLine({ start: { x: G, y }, end: { x: D, y }, thickness: 1.6, color: ENCRE })
  y -= 20

  // ---- Le tableau ---------------------------------------------------------
  const xTaux = 380
  const xQte = 452
  ecrire(page, m.description, { x: G, y, size: 8, font: normal, color: GRIS })
  droite(page, m.taux, xTaux, y, normal, 8, GRIS)
  droite(page, m.quantite, xQte, y, normal, 8, GRIS)
  droite(page, m.montant, D, y, normal, 8, GRIS)
  y -= 22

  for (const l of f.lignes) {
    ecrire(page, couper(l.description, normal, 10, 300), { x: G, y, size: 10, font: normal, color: ENCRE })
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
    ecrire(page, m.notes, { x: G, y: bas, size: 8, font: gras, color: GRIS })
    bas -= 13
    ecrire(page, couper(f.notes, normal, 9, D - G), { x: G, y: bas, size: 9, font: normal, color: ENCRE })
    bas -= 20
  }
  if (c.conditionsPaiement) {
    ecrire(page, m.conditions, { x: G, y: bas, size: 8, font: gras, color: GRIS })
    bas -= 13
    for (const ligne of c.conditionsPaiement.split("\n").slice(0, 3)) {
      ecrire(page, couper(ligne, normal, 9, D - G), { x: G, y: bas, size: 9, font: normal, color: ENCRE })
      bas -= 11
    }
  }

  // Les numéros de taxe engagent le cabinet : ils s'impriment quand ils
  // existent, et rien ne les invente quand ils manquent.
  const numeros = [c.numeroTps && `${m.tps} ${c.numeroTps}`, c.numeroTvq && `${m.tvq} ${c.numeroTvq}`]
    .filter(Boolean).join(" · ")
  if (numeros) ecrire(page, numeros, { x: G, y: 62, size: 8, font: normal, color: GRIS })

  pagination(page, m, normal)

  // Un brouillon porte sa mention. Sans elle, une facture non émise circule et
  // se fait payer comme une vraie — puis son numéro change à l'émission.
  if (f.statut === "draft") {
    ecrire(page, m.brouillon, {
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
    ecrire(page, couper(r.clientCourriel, normal, 9, 220), { x: G, y: yClient, size: 9, font: normal, color: GRIS })
    yClient -= 11
  }

  bloc(page, xMilieu, y, m.dateRecu, r.date, normal, gras, false, 9.5)
  bloc(page, D, y, m.montantRecu, argent(r.montant), normal, gras, true, 14)

  const yBas = y - 46
  bloc(page, xMilieu, yBas, m.numeroRecu, r.numero, normal, gras, false, 9.5)
  if (r.factureNumero) bloc(page, D, yBas, m.factureLiee, r.factureNumero, normal, gras, true, 9.5)

  y = Math.min(yClient, yBas - 22) - 14
  if (r.dossierReference) {
    ecrire(page, `${m.dossier} ${r.dossierReference}`, { x: G, y: y + 8, size: 8.5, font: normal, color: GRIS })
    y -= 6
  }

  page.drawLine({ start: { x: G, y }, end: { x: D, y }, thickness: 1.6, color: ENCRE })
  y -= 20

  // ---- Le tableau, calqué sur celui de la facture -------------------------
  // Un reçu n'a qu'une ligne, ce qui rendait tentant de l'écrire en prose. Mais
  // c'est la MÊME lecture pour le client — quoi, comment, quand, combien — et
  // deux mises en page pour une même lecture obligent à réapprendre où
  // regarder. Le reçu emprunte donc les colonnes, les filets et l'échelle de
  // la facture ; seuls les en-têtes changent.
  const xMode = 380
  const xDate = 465
  ecrire(page, m.description, { x: G, y, size: 8, font: normal, color: GRIS })
  droite(page, m.modeCol, xMode, y, normal, 8, GRIS)
  droite(page, m.dateCol, xDate, y, normal, 8, GRIS)
  droite(page, m.montant, D, y, normal, 8, GRIS)
  y -= 22

  ecrire(page, couper(r.notes || m.paiement, normal, 10, 300), { x: G, y, size: 10, font: normal, color: ENCRE })
  droite(page, m.modes[r.mode] ?? r.mode, xMode, y, normal, 9, GRIS)
  droite(page, r.date, xDate, y, normal, 9, GRIS)
  droite(page, argent(r.montant), D, y, normal, 9.5)
  // À la place du « + taxes » de la facture : la destination des fonds. C'est
  // ce qui qualifie ce paiement-ci, et le client doit pouvoir le lire sur la
  // ligne même, pas seulement dans la mention légale du bas.
  droite(page, r.enFideicommis ? m.enFiducie : m.compteGeneral, xMode, y - 14, normal, 8, GRIS)
  if (r.reference) ecrire(page, r.reference, { x: G, y: y - 14, size: 8, font: normal, color: GRIS })
  y -= 34

  // ---- L'échelle des totaux, identique à celle de la facture --------------
  const xLibelle = 470
  y -= 6

  droite(page, m.totalFacture, xLibelle, y, normal, 9.5, GRIS)
  droite(page, argent(r.factureTotal), D, y, normal, 9.5)
  y -= 16
  droite(page, m.regleAJour, xLibelle, y, normal, 9.5, GRIS)
  droite(page, `−${argent(r.dejaRegle)}`, D, y, normal, 9.5, GRIS)
  y -= 16

  page.drawLine({ start: { x: 340, y: y + 9 }, end: { x: D, y: y + 9 }, thickness: 1.6, color: ENCRE })
  y -= 6
  droite(page, m.soldeRestant, xLibelle, y, gras, 11)
  droite(page, argent(Math.max(0, r.factureTotal - r.dejaRegle)), D, y, gras, 11)
  y -= 34

  if (r.enFideicommis) {
    // Une somme en fiducie n'appartient pas encore au cabinet. Le taire sur
    // le reçu laisserait croire que les honoraires sont acquis — ce que
    // l'article 13 interdit précisément de laisser croire.
    ecrire(page, m.fiducie1, { x: G, y, size: 8.5, font: normal, color: GRIS })
    y -= 11
    ecrire(page, m.fiducie2, { x: G, y, size: 8.5, font: normal, color: GRIS })
  }

  // Les notes ne sont plus répétées ici : elles servent de description à la
  // ligne du tableau. Les imprimer deux fois ferait croire à deux mentions.
  const bas = Math.max(y - 20, 110)
  ecrire(page, m.merci, { x: G, y: bas, size: 9, font: normal, color: GRIS })

  // Le même pied que la facture, pour la même raison : ces numéros engagent le
  // cabinet, et un client qui compare ses deux pièces doit les retrouver au
  // même endroit.
  const numeros = [c.numeroTps && `${m.tps} ${c.numeroTps}`, c.numeroTvq && `${m.tvq} ${c.numeroTvq}`]
    .filter(Boolean).join(" · ")
  if (numeros) ecrire(page, numeros, { x: G, y: 62, size: 8, font: normal, color: GRIS })

  pagination(page, m, normal)

  return doc.save()
}
