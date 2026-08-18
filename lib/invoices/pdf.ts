import "server-only"

import { PDFDocument, StandardFonts, type PDFPage, type PDFFont } from "pdf-lib"
import {
  ENCRE, GRIS, TRAIT, LARGEUR, HAUTEUR, G, D, MARINE, OR, VOILE, BLANC,
  argentDe, pourcentDe, ecrire, couper, droite, centre,
  enTeteOfficiel, panneauPartie, piedOfficiel, filigrane, PALE,
  type LanguePdf, type CabinetPdf,
} from "@/lib/pdf/primitives"

export type { LanguePdf, CabinetPdf }

/**
 * Système d'harmonisation documentaire officiel (Factures, Reçus, Registres, Rapprochements).
 * Calqué rigoureusement sur le modèle maître des Ententes professionnelles.
 */

const MOTS = {
  fr: {
    facture: "FACTURE",
    factureSousTitre: "ÉMISSION OFFICIELLE",
    recu: "REÇU DE PAIEMENT",
    recuSousTitre: "CONFIRMATION DE RÈGLEMENT",
    consultantCric: "Consultant réglementé CRIC",
    permisAbrege: "Permis CRIC",
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
    description: "DESCRIPTION DU SERVICE",
    taux: "PRIX UNIT.",
    quantite: "QTÉ",
    montant: "MONTANT (CAD)",
    plusTaxes: "+ taxes",
    nonTaxable: "non taxable",
    sousTotal: "Sous-total honoraires",
    tps: "TPS",
    tvq: "TVQ",
    exonere: "Exonérée de taxes",
    total: "Total facturé",
    dejaRegle: "Déjà réglé",
    soldeDu: "SOLDE RESTANT DÛ",
    notes: "NOTES DU CABINET",
    conditions: "MODALITÉS ET CONDITIONS DE PAIEMENT",
    brouillon: "BROUILLON",
    page: (n: number, sur: number) => `Page ${n} sur ${sur}`,
    factureLiee: "FACTURE LIÉE",
    totalFacture: "Total de la facture",
    regleAJour: "Total réglé à ce jour",
    soldeRestant: "SOLDE RESTANT",
    fiducie1: "Ces fonds sont détenus en fidéicommis (art. 13) et ne seront virés au compte",
    fiducie2: "général du cabinet qu'au fur et à mesure des services rendus.",
    merci: "Merci de votre confiance.",
    rapprochement: "ÉTAT DE RAPPROCHEMENT",
    rapprochementSousTitre: "COMPTE EN FIDÉICOMMIS",
    registreMensuel: "REGISTRE DU COMPTE CLIENT",
    registreSousTitre: "COMPTE EN FIDÉICOMMIS",
    periodeRegistre: "PÉRIODE DU REGISTRE",
    colClient: "CLIENT",
    colDerniere: "DERNIÈRE TRANSACTION",
    colOuverture: "OUVERTURE",
    colDepots: "DÉPÔTS (+)",
    colRetraits: "RETRAITS (−)",
    colSolde: "SOLDE DE CLÔTURE",
    totauxRegistre: "TOTAUX CONSOLIDÉS",
    fondsDetenus: "TOTAL DES FONDS DÉTENUS POUR LES CLIENTS",
    aucunFonds: "Aucun client n'avait de fonds détenus au cours de cette période.",
    responsabiliteRegistre: "Outil de tenue de registre conforme au règlement du Collège (CICC). Le consultant",
    responsabiliteRegistre2: "demeure responsable de ses obligations professionnelles et de ses rapprochements.",
    compteFiducie: "COMPTE EN FIDÉICOMMIS",
    periodeArretee: "PÉRIODE ARRÊTÉE AU",
    soldeReleve: "Solde du relevé bancaire",
    soldeRegistre: "Solde selon le registre clients",
    elementsRapprochement: "ÉLÉMENTS DE RAPPROCHEMENT (AJUSTEMENTS)",
    aucunEcart: "Aucun élément de rapprochement : le relevé bancaire et le registre concordent exactement.",
    soldeRapproche: "SOLDE RAPPROCHÉ",
    ecartResiduel: "ÉCART RÉSIDUEL",
    ventilationClients: "VENTILATION PAR DOSSIER CLIENT",
    client: "Client / Dossier",
    solde: "Solde détenu",
    totalVentilation: "Total de la ventilation clients",
    attestation: "J'atteste que le présent état a été dressé à partir du registre du compte en",
    attestation2: "fidéicommis du cabinet et du relevé bancaire de la période indiquée conformément aux règles du CICC.",
    arreteLe: "Arrêté le",
    par: "Par le consultant :",
    signatureConsultant: "Signature du CRIC titulaire :",
    brouillonRappro: "NON ARRÊTÉ",
    modeCol: "MODE DE PAIEMENT",
    dateCol: "DATE",
    paiement: "Paiement reçu",
    destinationCol: "DESTINATION",
    enFiducie: "Compte fidéicommis (fiducie)",
    compteGeneral: "Compte d'exploitation",
    modes: {
      card: "Carte bancaire",
      interac: "Virement Interac",
      bank_transfer: "Virement bancaire",
      cheque: "Chèque",
      cash: "Comptant",
      other: "Autre mode",
    } as Record<string, string>,
  },
  en: {
    facture: "INVOICE",
    factureSousTitre: "OFFICIAL ISSUANCE",
    recu: "PAYMENT RECEIPT",
    recuSousTitre: "SETTLEMENT CONFIRMATION",
    consultantCric: "Regulated Canadian Immigration Consultant",
    permisAbrege: "RCIC Licence",
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
    description: "SERVICE DESCRIPTION",
    taux: "UNIT PRICE",
    quantite: "QTY",
    montant: "AMOUNT (CAD)",
    plusTaxes: "+ tax",
    nonTaxable: "non-taxable",
    sousTotal: "Professional fees subtotal",
    tps: "GST",
    tvq: "QST",
    exonere: "Tax exempt",
    total: "Total invoiced",
    dejaRegle: "Already paid",
    soldeDu: "REMAINING BALANCE DUE",
    notes: "FIRM NOTES",
    conditions: "PAYMENT TERMS & CONDITIONS",
    brouillon: "DRAFT",
    page: (n: number, sur: number) => `Page ${n} of ${sur}`,
    factureLiee: "LINKED INVOICE",
    totalFacture: "Invoice total",
    regleAJour: "Paid to date",
    soldeRestant: "REMAINING BALANCE",
    fiducie1: "These funds are held in trust (s. 13) and will only be transferred to the",
    fiducie2: "firm's general account as services are rendered.",
    merci: "Thank you for your trust.",
    rapprochement: "RECONCILIATION STATEMENT",
    rapprochementSousTitre: "TRUST ACCOUNT",
    registreMensuel: "CLIENT ACCOUNT REGISTER",
    registreSousTitre: "TRUST ACCOUNT",
    periodeRegistre: "REGISTER PERIOD",
    colClient: "CLIENT",
    colDerniere: "LAST TRANSACTION",
    colOuverture: "OPENING",
    colDepots: "DEPOSITS (+)",
    colRetraits: "WITHDRAWALS (−)",
    colSolde: "CLOSING BALANCE",
    totauxRegistre: "CONSOLIDATED TOTALS",
    fondsDetenus: "TOTAL FUNDS HELD FOR CLIENTS",
    aucunFonds: "No client held funds during this period.",
    responsabiliteRegistre: "Record-keeping tool complying with College (CICC) regulations. The consultant",
    responsabiliteRegistre2: "remains responsible for their professional obligations and reconciliations.",
    compteFiducie: "TRUST ACCOUNT",
    periodeArretee: "PERIOD ENDING",
    soldeReleve: "Bank statement balance",
    soldeRegistre: "Balance as per client ledger",
    elementsRapprochement: "RECONCILING ITEMS (ADJUSTMENTS)",
    aucunEcart: "No reconciling items: the bank statement and the ledger agree exactly.",
    soldeRapproche: "RECONCILED BALANCE",
    ecartResiduel: "UNEXPLAINED DIFFERENCE",
    ventilationClients: "BREAKDOWN BY CLIENT MATTER",
    client: "Client / Matter",
    solde: "Funds held",
    totalVentilation: "Total client breakdown",
    attestation: "I certify that this statement was prepared from the firm's trust account",
    attestation2: "ledger and the bank statement for the period indicated in compliance with CICC rules.",
    arreteLe: "Closed on",
    par: "By consultant:",
    signatureConsultant: "RCIC signature:",
    brouillonRappro: "NOT CLOSED",
    modeCol: "PAYMENT METHOD",
    dateCol: "DATE",
    paiement: "Payment received",
    destinationCol: "DESTINATION",
    enFiducie: "Trust account",
    compteGeneral: "General operating account",
    modes: {
      card: "Credit card",
      interac: "Interac e-Transfer",
      bank_transfer: "Bank wire transfer",
      cheque: "Cheque",
      cash: "Cash",
      other: "Other method",
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
  tauxTps?: number
  tauxTvq?: number
  exonere?: boolean
  langue?: LanguePdf
}

/**
 * Génération de la FACTURE PROFESSIONNELLE conforme au design des ententes.
 */
export async function facturePdf(f: FacturePdf, c: CabinetPdf): Promise<Uint8Array> {
  const langue: LanguePdf = f.langue ?? "fr"
  const m = MOTS[langue]
  const argent = argentDe(langue)
  const pourcent = pourcentDe(langue)

  const doc = await PDFDocument.create()
  const page = doc.addPage([LARGEUR, HAUTEUR])
  const normal = await doc.embedFont(StandardFonts.Helvetica)
  const gras = await doc.embedFont(StandardFonts.HelveticaBold)

  const solde = f.total - f.regle

  // 1. En-tête officiel bi-colonne
  const reperes = [
    { label: m.numeroFacture, valeur: f.numero },
    { label: m.dateEmise, valeur: f.date },
    { label: m.echeance, valeur: f.echeance || "—" },
    { label: m.dossier, valeur: f.dossierReference ? `${f.dossierReference}${f.consultant ? ` (${f.consultant})` : ""}` : "—" },
  ]

  let y = await enTeteOfficiel(
    doc,
    page,
    c,
    normal,
    gras,
    { surTitre: m.facture, sousTitre: m.factureSousTitre },
    m.permisAbrege,
    reperes
  )

  // 2. Panneau Client « FACTURÉ À » + Encadré montant dû en haut
  const largeurPanneau = 240
  const lignesClient = [
    { texte: f.clientNom, taille: 10, gras: true, couleur: ENCRE },
    { texte: f.clientAdresse, taille: 8.5, gras: false, couleur: GRIS },
    { texte: f.clientCourriel, taille: 8.5, gras: false, couleur: GRIS },
  ]
  const hPanneau = panneauPartie(page, G, y, largeurPanneau, m.factureA, lignesClient, normal, gras)

  // Encadré récapitulatif Montant Dû / Solde en haut à droite
  const xEncadre = 320
  const largEncadre = D - xEncadre
  page.drawRectangle({
    x: xEncadre, y: y - hPanneau, width: largEncadre, height: hPanneau, color: VOILE,
    borderColor: TRAIT, borderWidth: 0.5,
  })
  page.drawRectangle({
    x: xEncadre, y: y - hPanneau, width: 3, height: hPanneau, color: OR,
  })
  ecrire(page, m.montantDu, { x: xEncadre + 12, y: y - 16, size: 8, font: gras, color: GRIS })
  ecrire(page, argent(solde), { x: xEncadre + 12, y: y - 36, size: 15, font: gras, color: MARINE })
  if (f.regle > 0) {
    ecrire(page, `${m.totalFacture} : ${argent(f.total)}`, { x: xEncadre + 12, y: y - 52, size: 8, font: normal, color: GRIS })
    ecrire(page, `${m.dejaRegle} : ${argent(f.regle)}`, { x: xEncadre + 12, y: y - 63, size: 8, font: normal, color: GRIS })
  }

  y -= hPanneau + 18

  // 3. Tableau des prestations & débours
  const largeurTableau = D - G
  const HAUTEUR_ENTETE = 22
  const xTaux = 370
  const xQte = 435
  const xMontant = D - 10

  // Bandeau d'en-tête de tableau en MARINE pleine
  page.drawRectangle({ x: G, y: y - HAUTEUR_ENTETE, width: largeurTableau, height: HAUTEUR_ENTETE, color: MARINE })
  ecrire(page, m.description, { x: G + 10, y: y - 14.5, size: 8, font: gras, color: BLANC })
  droite(page, m.taux, xTaux, y - 14.5, gras, 8, BLANC)
  droite(page, m.quantite, xQte, y - 14.5, gras, 8, BLANC)
  droite(page, m.montant, xMontant, y - 14.5, gras, 8, BLANC)
  y -= HAUTEUR_ENTETE

  // Lignes de services
  for (const l of f.lignes) {
    const hLigne = 26
    page.drawRectangle({
      x: G, y: y - hLigne, width: largeurTableau, height: hLigne,
      borderColor: TRAIT, borderWidth: 0.5,
    })
    ecrire(page, couper(l.description, normal, 9.5, 270), { x: G + 10, y: y - 13, size: 9.5, font: normal, color: ENCRE })
    if (l.taxable) {
      ecrire(page, `(${m.plusTaxes})`, { x: G + 10, y: y - 22, size: 7.5, font: normal, color: GRIS })
    } else {
      ecrire(page, `(${m.nonTaxable})`, { x: G + 10, y: y - 22, size: 7.5, font: normal, color: GRIS })
    }

    droite(page, argent(l.prixUnitaire), xTaux, y - 15, normal, 9, GRIS)
    droite(page, String(l.quantite), xQte, y - 15, normal, 9, GRIS)
    droite(page, argent(l.quantite * l.prixUnitaire), xMontant, y - 15, gras, 9.5, ENCRE)
    y -= hLigne
  }

  // 4. Bloc des Totaux & Taxes
  y -= 8
  const xTotauxLibelle = 430

  // Sous-total
  droite(page, m.sousTotal, xTotauxLibelle, y, normal, 9, GRIS)
  droite(page, argent(f.sousTotal), xMontant, y, normal, 9, ENCRE)
  y -= 15

  // Taxes
  if (f.exonere) {
    droite(page, m.exonere, xTotauxLibelle, y, normal, 9, GRIS)
    y -= 15
  } else {
    const taxes: [string, number, number][] = [
      [m.tps, f.tauxTps ?? 0, f.tps],
      [m.tvq, f.tauxTvq ?? 0, f.tvq],
    ]
    for (const [nom, taux, valeur] of taxes) {
      if (taux <= 0 && valeur <= 0) continue
      droite(page, `${nom} (${pourcent(taux)})`, xTotauxLibelle, y, normal, 8.5, GRIS)
      droite(page, `+${argent(valeur)}`, xMontant, y, normal, 8.5, GRIS)
      y -= 14
    }
  }

  // Total général
  page.drawLine({ start: { x: 320, y: y + 6 }, end: { x: D, y: y + 6 }, thickness: 0.5, color: TRAIT })
  y -= 4
  droite(page, m.total, xTotauxLibelle, y, gras, 10, MARINE)
  droite(page, argent(f.total), xMontant, y, gras, 10, MARINE)
  y -= 16

  // Déjà réglé éventuel
  if (f.regle > 0) {
    droite(page, m.dejaRegle, xTotauxLibelle, y, normal, 9, GRIS)
    droite(page, `−${argent(f.regle)}`, xMontant, y, normal, 9, GRIS)
    y -= 15
  }

  // Bandeau final de SOLDE DÛ
  const hBandeauSolde = 22
  page.drawRectangle({ x: 320, y: y - hBandeauSolde, width: D - 320, height: hBandeauSolde, color: MARINE })
  ecrire(page, m.soldeDu, { x: 330, y: y - 14.5, size: 9, font: gras, color: BLANC })
  droite(page, argent(solde), xMontant, y - 14.5, gras, 10, BLANC)
  y -= hBandeauSolde + 16

  // 5. Notes du cabinet & Conditions de paiement
  const yBas = Math.max(y, 110)
  if (f.notes || c.conditionsPaiement) {
    const lignesNotes: string[] = []
    if (f.notes) lignesNotes.push(`${m.notes} : ${f.notes}`)
    if (c.conditionsPaiement) {
      lignesNotes.push(`${m.conditions} : ${c.conditionsPaiement.split("\n")[0]}`)
    }
    const hEncadreNotes = lignesNotes.length * 13 + 12
    page.drawRectangle({
      x: G, y: yBas - hEncadreNotes, width: largeurTableau, height: hEncadreNotes, color: VOILE,
      borderColor: TRAIT, borderWidth: 0.5,
    })
    page.drawRectangle({
      x: G, y: yBas - hEncadreNotes, width: 2.5, height: hEncadreNotes, color: OR,
    })
    let yTxt = yBas - 12
    for (const ligne of lignesNotes) {
      ecrire(page, couper(ligne, normal, 8, largeurTableau - 20), {
        x: G + 10, y: yTxt, size: 8, font: normal, color: ENCRE,
      })
      yTxt -= 13
    }
  }

  // 6. Pied de page officiel plein en MARINE
  const numerosTaxe = [c.numeroTps && `${m.tps} : ${c.numeroTps}`, c.numeroTvq && `${m.tvq} : ${c.numeroTvq}`]
    .filter(Boolean).join("  ·  ")
  const mentionGauche = numerosTaxe || c.nom
  piedOfficiel(page, f.numero, mentionGauche, 1, 1, normal, gras)

  if (f.statut === "draft") filigrane(page, m.brouillon, gras)

  return doc.save()
}

/**
 * Interface & Génération du REÇU DE PAIEMENT conforme aux ententes.
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

  // 1. En-tête officiel bi-colonne
  const reperes = [
    { label: m.numeroRecu, valeur: r.numero },
    { label: m.dateRecu, valeur: r.date },
    { label: m.factureLiee, valeur: r.factureNumero || "—" },
    { label: m.dossier, valeur: r.dossierReference || "—" },
  ]

  let y = await enTeteOfficiel(
    doc,
    page,
    c,
    normal,
    gras,
    { surTitre: m.recu, sousTitre: m.recuSousTitre },
    m.permisAbrege,
    reperes
  )

  // 2. Panneau « REÇU DE » + Encadré Montant Reçu
  const largeurPanneau = 240
  const lignesClient = [
    { texte: r.clientNom, taille: 10, gras: true, couleur: ENCRE },
    { texte: r.clientCourriel, taille: 8.5, gras: false, couleur: GRIS },
    { texte: r.reference ? `Réf. transaction : ${r.reference}` : "", taille: 8, gras: false, couleur: GRIS },
  ]
  const hPanneau = panneauPartie(page, G, y, largeurPanneau, m.recuDe, lignesClient, normal, gras)

  // Encadré Montant Reçu en haut à droite
  const xEncadre = 320
  const largEncadre = D - xEncadre
  page.drawRectangle({
    x: xEncadre, y: y - hPanneau, width: largEncadre, height: hPanneau, color: VOILE,
    borderColor: TRAIT, borderWidth: 0.5,
  })
  page.drawRectangle({
    x: xEncadre, y: y - hPanneau, width: 3, height: hPanneau, color: OR,
  })
  ecrire(page, m.montantRecu, { x: xEncadre + 12, y: y - 16, size: 8, font: gras, color: GRIS })
  ecrire(page, argent(r.montant), { x: xEncadre + 12, y: y - 36, size: 15, font: gras, color: MARINE })
  ecrire(page, `${m.modeCol} : ${m.modes[r.mode] ?? r.mode}`, { x: xEncadre + 12, y: y - 52, size: 8.5, font: normal, color: ENCRE })
  ecrire(page, r.enFideicommis ? m.enFiducie : m.compteGeneral, { x: xEncadre + 12, y: y - 64, size: 8, font: gras, color: r.enFideicommis ? MARINE : GRIS })

  y -= hPanneau + 20

  // 3. Tableau du Versement
  const largeurTableau = D - G
  const HAUTEUR_ENTETE = 22
  const xMode = 310
  const xDest = 420
  const xMontant = D - 10

  page.drawRectangle({ x: G, y: y - HAUTEUR_ENTETE, width: largeurTableau, height: HAUTEUR_ENTETE, color: MARINE })
  ecrire(page, m.description, { x: G + 10, y: y - 14.5, size: 8, font: gras, color: BLANC })
  ecrire(page, m.modeCol, { x: xMode, y: y - 14.5, size: 8, font: gras, color: BLANC })
  ecrire(page, m.destinationCol, { x: xDest, y: y - 14.5, size: 8, font: gras, color: BLANC })
  droite(page, m.montant, xMontant, y - 14.5, gras, 8, BLANC)
  y -= HAUTEUR_ENTETE

  const hLigne = 26
  page.drawRectangle({
    x: G, y: y - hLigne, width: largeurTableau, height: hLigne,
    borderColor: TRAIT, borderWidth: 0.5,
  })
  ecrire(page, couper(r.notes || m.paiement, normal, 9.5, 230), { x: G + 10, y: y - 16, size: 9.5, font: normal, color: ENCRE })
  ecrire(page, m.modes[r.mode] ?? r.mode, { x: xMode, y: y - 16, size: 9, font: normal, color: GRIS })
  ecrire(page, r.enFideicommis ? "Fidéicommis" : "Général", { x: xDest, y: y - 16, size: 8.5, font: gras, color: r.enFideicommis ? MARINE : GRIS })
  droite(page, argent(r.montant), xMontant, y - 16, gras, 9.5, ENCRE)
  y -= hLigne + 16

  // 4. Synthèse de la Facture rattachée
  if (r.factureNumero) {
    const xTotauxLibelle = 430
    droite(page, m.totalFacture, xTotauxLibelle, y, normal, 9, GRIS)
    droite(page, argent(r.factureTotal), xMontant, y, normal, 9, ENCRE)
    y -= 15
    droite(page, m.regleAJour, xTotauxLibelle, y, normal, 9, GRIS)
    droite(page, `−${argent(r.dejaRegle)}`, xMontant, y, normal, 9, GRIS)
    y -= 15

    const soldeRestant = Math.max(0, r.factureTotal - r.dejaRegle)
    const hBandeauSolde = 22
    page.drawRectangle({ x: 320, y: y - hBandeauSolde, width: D - 320, height: hBandeauSolde, color: MARINE })
    ecrire(page, m.soldeRestant, { x: 330, y: y - 14.5, size: 9, font: gras, color: BLANC })
    droite(page, argent(soldeRestant), xMontant, y - 14.5, gras, 10, BLANC)
    y -= hBandeauSolde + 20
  }

  // 5. Mention légale fidéicommis (Article 13 CICC)
  if (r.enFideicommis) {
    page.drawRectangle({
      x: G, y: y - 36, width: largeurTableau, height: 36, color: VOILE,
      borderColor: TRAIT, borderWidth: 0.5,
    })
    page.drawRectangle({
      x: G, y: y - 36, width: 2.5, height: 36, color: OR,
    })
    ecrire(page, m.fiducie1, { x: G + 10, y: y - 14, size: 8, font: normal, color: ENCRE })
    ecrire(page, m.fiducie2, { x: G + 10, y: y - 26, size: 8, font: normal, color: ENCRE })
    y -= 46
  }

  ecrire(page, m.merci, { x: G, y: Math.max(y, 100), size: 9, font: normal, color: GRIS })

  // 6. Pied de page officiel plein
  piedOfficiel(page, r.numero, c.nom, 1, 1, normal, gras)

  return doc.save()
}

/**
 * Interface & Génération du REGISTRE MENSUEL DU COMPTE CLIENT (Fidéicommis).
 */
export interface RegistreMensuelPdf {
  periode: string
  lignes: {
    nom: string
    dernierMouvement: string | null
    ouverture: number
    depots: number
    retraits: number
    cloture: number
  }[]
  totaux: { ouverture: number; depots: number; retraits: number; cloture: number }
  langue?: LanguePdf
}

export async function registreMensuelPdf(
  r: RegistreMensuelPdf,
  c: CabinetPdf
): Promise<Uint8Array> {
  const langue: LanguePdf = r.langue ?? "fr"
  const m = MOTS[langue]
  const argent = argentDe(langue)

  const doc = await PDFDocument.create()
  const normal = await doc.embedFont(StandardFonts.Helvetica)
  const gras = await doc.embedFont(StandardFonts.HelveticaBold)

  const pages: PDFPage[] = []
  let page = doc.addPage([LARGEUR, HAUTEUR])
  pages.push(page)

  const xNom = G + 10
  const xDerniere = 190
  const xOuverture = D - 210
  const xDepots = D - 140
  const xRetraits = D - 70
  const xSolde = D - 10
  const largeurTableau = D - G

  // 1. En-tête officiel
  const reperes = [
    { label: m.periodeRegistre, valeur: r.periode },
    { label: m.compteFiducie, valeur: c.nom || "—" },
    { label: "TITULAIRE CRIC", valeur: c.numeroPermis ? `${m.permisAbrege} ${c.numeroPermis}` : "—" },
  ]

  let y = await enTeteOfficiel(
    doc,
    page,
    c,
    normal,
    gras,
    { surTitre: m.registreMensuel, sousTitre: m.registreSousTitre },
    m.permisAbrege,
    reperes
  )

  // 2. Encadré de synthèse : TOTAL FONDS DÉTENUS
  const hSynthese = 38
  page.drawRectangle({
    x: G, y: y - hSynthese, width: largeurTableau, height: hSynthese, color: VOILE,
    borderColor: TRAIT, borderWidth: 0.5,
  })
  page.drawRectangle({
    x: G, y: y - hSynthese, width: 3, height: hSynthese, color: OR,
  })
  ecrire(page, m.fondsDetenus, { x: G + 12, y: y - 16, size: 8, font: gras, color: GRIS })
  ecrire(page, argent(r.totaux.cloture), { x: G + 12, y: y - 30, size: 14, font: gras, color: MARINE })
  droite(page, `Période : ${r.periode}`, D - 12, y - 22, normal, 9, GRIS)
  y -= hSynthese + 18

  // 3. Dessin des colonnes du tableau
  const HAUTEUR_ENTETE = 20
  const enTeteColonnes = (p: PDFPage, yy: number) => {
    p.drawRectangle({ x: G, y: yy - HAUTEUR_ENTETE, width: largeurTableau, height: HAUTEUR_ENTETE, color: MARINE })
    ecrire(p, m.colClient, { x: xNom, y: yy - 13.5, size: 7.5, font: gras, color: BLANC })
    ecrire(p, m.colDerniere, { x: xDerniere, y: yy - 13.5, size: 7.5, font: gras, color: BLANC })
    droite(p, m.colOuverture, xOuverture, yy - 13.5, gras, 7.5, BLANC)
    droite(p, m.colDepots, xDepots, yy - 13.5, gras, 7.5, BLANC)
    droite(p, m.colRetraits, xRetraits, yy - 13.5, gras, 7.5, BLANC)
    droite(p, m.colSolde, xSolde, yy - 13.5, gras, 7.5, BLANC)
  }

  enTeteColonnes(page, y)
  y -= HAUTEUR_ENTETE

  const BAS_PAGE = 80

  if (r.lignes.length === 0) {
    y -= 15
    ecrire(page, m.aucunFonds, { x: G + 10, y, size: 9, font: normal, color: GRIS })
    y -= 20
  }

  for (const l of r.lignes) {
    if (y < BAS_PAGE + 40) {
      page = doc.addPage([LARGEUR, HAUTEUR])
      pages.push(page)
      y = 780
      // En-tête de rappel sur page 2+
      ecrire(page, `${c.nom}  ·  ${m.registreMensuel} (${r.periode})`, { x: G, y: 792, size: 8, font: normal, color: GRIS })
      page.drawLine({ start: { x: G, y: 784 }, end: { x: G + 40, y: 784 }, thickness: 1.6, color: OR })
      page.drawLine({ start: { x: G + 40, y: 784 }, end: { x: D, y: 784 }, thickness: 0.5, color: TRAIT })
      y = 760
      enTeteColonnes(page, y)
      y -= HAUTEUR_ENTETE
    }

    const hLigne = 20
    page.drawRectangle({
      x: G, y: y - hLigne, width: largeurTableau, height: hLigne,
      borderColor: TRAIT, borderWidth: 0.5,
    })
    ecrire(page, couper(l.nom, gras, 8.5, xDerniere - xNom - 10), { x: xNom, y: y - 13.5, size: 8.5, font: gras, color: ENCRE })
    ecrire(page, l.dernierMouvement ?? "—", { x: xDerniere, y: y - 13.5, size: 8, font: normal, color: GRIS })
    droite(page, argent(l.ouverture), xOuverture, y - 13.5, normal, 8.5, GRIS)
    droite(page, l.depots ? argent(l.depots) : "—", xDepots, y - 13.5, normal, 8.5, ENCRE)
    droite(page, l.retraits ? argent(l.retraits) : "—", xRetraits, y - 13.5, normal, 8.5, ENCRE)
    droite(page, argent(l.cloture), xSolde, y - 13.5, gras, 9, MARINE)
    y -= hLigne
  }

  // 4. Ligne de Totaux Consolidés pleine en MARINE
  if (y < BAS_PAGE + 35) {
    page = doc.addPage([LARGEUR, HAUTEUR])
    pages.push(page)
    y = 760
  }

  const hTotaux = 22
  page.drawRectangle({ x: G, y: y - hTotaux, width: largeurTableau, height: hTotaux, color: MARINE })
  ecrire(page, m.totauxRegistre, { x: xNom, y: y - 14.5, size: 8.5, font: gras, color: BLANC })
  droite(page, argent(r.totaux.ouverture), xOuverture, y - 14.5, gras, 8.5, BLANC)
  droite(page, argent(r.totaux.depots), xDepots, y - 14.5, gras, 8.5, BLANC)
  droite(page, argent(r.totaux.retraits), xRetraits, y - 14.5, gras, 8.5, BLANC)
  droite(page, argent(r.totaux.cloture), xSolde, y - 14.5, gras, 9.5, BLANC)
  y -= hTotaux + 20

  // 5. Mention de responsabilité professionnelle
  ecrire(page, m.responsabiliteRegistre, { x: G, y: y, size: 7.5, font: normal, color: GRIS })
  ecrire(page, m.responsabiliteRegistre2, { x: G, y: y - 10, size: 7.5, font: normal, color: GRIS })

  // 6. Pied de page officiel plein sur toutes les pages
  pages.forEach((p, idx) => {
    piedOfficiel(p, `REGISTRE-${r.periode}`, c.nom, idx + 1, pages.length, normal, gras)
  })

  return doc.save()
}

/**
 * Interface & Génération de l'ÉTAT DE RAPPROCHEMENT BANCAIRE (Fidéicommis).
 */
export interface RapprochementPdf {
  periodeFin: string
  soldeBancaire: number
  soldeRegistre: number
  ecarts: { libelle: string; montant: number }[]
  parClient: { nom: string; solde: number }[]
  clos: boolean
  closLe: string | null
  closPar: string | null
  notes: string | null
  langue?: LanguePdf
}

export async function rapprochementPdf(r: RapprochementPdf, c: CabinetPdf): Promise<Uint8Array> {
  const langue: LanguePdf = r.langue ?? "fr"
  const m = MOTS[langue]
  const argent = argentDe(langue)

  const doc = await PDFDocument.create()
  const page = doc.addPage([LARGEUR, HAUTEUR])
  const normal = await doc.embedFont(StandardFonts.Helvetica)
  const gras = await doc.embedFont(StandardFonts.HelveticaBold)

  // 1. En-tête officiel
  const reperes = [
    { label: m.periodeArretee, valeur: r.periodeFin },
    { label: m.compteFiducie, valeur: c.nom || "—" },
    { label: "STATUT CONFORMITÉ", valeur: r.clos ? "ARRÊTÉ & CONFORME" : "BROUILLON EN COURS" },
  ]

  let y = await enTeteOfficiel(
    doc,
    page,
    c,
    normal,
    gras,
    { surTitre: m.rapprochement, sousTitre: m.rapprochementSousTitre },
    m.permisAbrege,
    reperes
  )

  const largeurTableau = D - G

  // 2. Encadré Tri-colonne : Relevé vs Registre vs Écart
  const explique = r.ecarts.reduce((t, e) => t + e.montant, 0)
  const residuel = Math.round((r.soldeBancaire + explique - r.soldeRegistre) * 100) / 100

  const hSynthese = 46
  page.drawRectangle({
    x: G, y: y - hSynthese, width: largeurTableau, height: hSynthese, color: VOILE,
    borderColor: TRAIT, borderWidth: 0.5,
  })
  page.drawRectangle({
    x: G, y: y - hSynthese, width: 3, height: hSynthese, color: residuel === 0 ? OR : MARINE,
  })

  const col1 = G + 15
  const col2 = G + 185
  const col3 = G + 355

  ecrire(page, m.soldeReleve, { x: col1, y: y - 16, size: 7.5, font: gras, color: GRIS })
  ecrire(page, argent(r.soldeBancaire), { x: col1, y: y - 34, size: 12, font: gras, color: ENCRE })

  ecrire(page, m.soldeRegistre, { x: col2, y: y - 16, size: 7.5, font: gras, color: GRIS })
  ecrire(page, argent(r.soldeRegistre), { x: col2, y: y - 34, size: 12, font: gras, color: MARINE })

  ecrire(page, m.ecartResiduel, { x: col3, y: y - 16, size: 7.5, font: gras, color: GRIS })
  ecrire(page, argent(residuel), {
    x: col3, y: y - 34, size: 12, font: gras,
    color: residuel === 0 ? MARINE : ENCRE,
  })

  y -= hSynthese + 18

  // 3. Éléments de rapprochement / Ajustements
  page.drawRectangle({ x: G, y: y - 18, width: largeurTableau, height: 18, color: MARINE })
  ecrire(page, m.elementsRapprochement, { x: G + 10, y: y - 12.5, size: 7.5, font: gras, color: BLANC })
  y -= 18

  if (r.ecarts.length === 0) {
    const hLigne = 20
    page.drawRectangle({
      x: G, y: y - hLigne, width: largeurTableau, height: hLigne,
      borderColor: TRAIT, borderWidth: 0.5,
    })
    ecrire(page, m.aucunEcart, { x: G + 10, y: y - 13.5, size: 8, font: normal, color: GRIS })
    y -= hLigne
  } else {
    for (const e of r.ecarts) {
      const hLigne = 18
      page.drawRectangle({
        x: G, y: y - hLigne, width: largeurTableau, height: hLigne,
        borderColor: TRAIT, borderWidth: 0.5,
      })
      ecrire(page, couper(e.libelle, normal, 8.5, 340), { x: G + 10, y: y - 12.5, size: 8.5, font: normal, color: ENCRE })
      droite(page, `${e.montant > 0 ? "+" : "−"}${argent(Math.abs(e.montant))}`, D - 10, y - 12.5, normal, 8.5, ENCRE)
      y -= hLigne
    }
  }

  y -= 14

  // 4. Ventilation par client
  page.drawRectangle({ x: G, y: y - 18, width: largeurTableau, height: 18, color: MARINE })
  ecrire(page, m.ventilationClients, { x: G + 10, y: y - 12.5, size: 7.5, font: gras, color: BLANC })
  droite(page, m.solde, D - 10, y - 12.5, gras, 7.5, BLANC)
  y -= 18

  const clientsAffiches = r.parClient.slice(0, 10)
  for (const cl of clientsAffiches) {
    const hLigne = 18
    page.drawRectangle({
      x: G, y: y - hLigne, width: largeurTableau, height: hLigne,
      borderColor: TRAIT, borderWidth: 0.5,
    })
    ecrire(page, couper(cl.nom, normal, 8.5, 340), { x: G + 10, y: y - 12.5, size: 8.5, font: normal, color: ENCRE })
    droite(page, argent(cl.solde), D - 10, y - 12.5, gras, 8.5, MARINE)
    y -= hLigne
  }

  // Ligne de total ventilation
  const totalVentile = r.parClient.reduce((t, x) => t + x.solde, 0)
  page.drawRectangle({ x: G, y: y - 20, width: largeurTableau, height: 20, color: VOILE, borderColor: TRAIT, borderWidth: 0.5 })
  ecrire(page, m.totalVentilation, { x: G + 10, y: y - 13.5, size: 8, font: gras, color: ENCRE })
  droite(page, argent(totalVentile), D - 10, y - 13.5, gras, 9, MARINE)
  y -= 34

  // 5. Bloc d'attestation CICC & Signature
  page.drawRectangle({
    x: G, y: y - 48, width: largeurTableau, height: 48, color: VOILE,
    borderColor: TRAIT, borderWidth: 0.5,
  })
  page.drawRectangle({
    x: G, y: y - 48, width: 2.5, height: 48, color: OR,
  })
  ecrire(page, m.attestation, { x: G + 10, y: y - 14, size: 7.5, font: normal, color: ENCRE })
  ecrire(page, m.attestation2, { x: G + 10, y: y - 24, size: 7.5, font: normal, color: ENCRE })
  ecrire(page, `${m.arreteLe} ${r.closLe || r.periodeFin}  ·  ${m.par} ${r.closPar || c.nom}`, {
    x: G + 10, y: y - 38, size: 7.5, font: gras, color: MARINE,
  })
  droite(page, m.signatureConsultant, D - 10, y - 38, normal, 7.5, GRIS)

  // 6. Pied de page officiel plein
  piedOfficiel(page, `RAPPROCHEMENT-${r.periodeFin}`, c.nom, 1, 1, normal, gras)

  return doc.save()
}
