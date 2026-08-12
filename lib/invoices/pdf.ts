import "server-only"

import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import {
  ENCRE, GRIS, TRAIT, LARGEUR, HAUTEUR, G, D,
  argentDe, pourcentDe, ecrire, couper, droite,
  enTete, bloc, pagination, filigrane,
  type LanguePdf, type CabinetPdf,
} from "@/lib/pdf/primitives"

// Réexportés : ces deux types font partie de l'interface de la facture depuis
// l'origine, et les appelants ne devraient pas avoir à savoir qu'ils ont
// déménagé dans les primitives.
export type { LanguePdf, CabinetPdf }

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
    rapprochement: "ÉTAT DE RAPPROCHEMENT",
    compteFiducie: "Compte en fidéicommis",
    periodeArretee: "PÉRIODE ARRÊTÉE AU",
    soldeReleve: "SOLDE DU RELEVÉ BANCAIRE",
    soldeRegistre: "SOLDE DU REGISTRE",
    elementsRapprochement: "ÉLÉMENTS DE RAPPROCHEMENT",
    aucunEcart: "Aucun élément de rapprochement : le relevé et le registre concordent exactement.",
    soldeRapproche: "SOLDE RAPPROCHÉ",
    ecartResiduel: "ÉCART RÉSIDUEL",
    ventilationClients: "VENTILATION PAR CLIENT",
    client: "Client",
    solde: "Solde",
    totalVentilation: "Total de la ventilation",
    attestation: "J'atteste que le présent état a été dressé à partir du registre du compte en",
    attestation2: "fidéicommis du cabinet et du relevé bancaire de la période indiquée.",
    arreteLe: "Arrêté le",
    par: "par",
    brouillonRappro: "NON ARRÊTÉ",
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
    rapprochement: "RECONCILIATION STATEMENT",
    compteFiducie: "Trust account",
    periodeArretee: "PERIOD ENDING",
    soldeReleve: "BANK STATEMENT BALANCE",
    soldeRegistre: "LEDGER BALANCE",
    elementsRapprochement: "RECONCILING ITEMS",
    aucunEcart: "No reconciling items: the statement and the ledger agree exactly.",
    soldeRapproche: "RECONCILED BALANCE",
    ecartResiduel: "UNEXPLAINED DIFFERENCE",
    ventilationClients: "BREAKDOWN BY CLIENT",
    client: "Client",
    solde: "Balance",
    totalVentilation: "Total of breakdown",
    attestation: "I certify that this statement was prepared from the firm's trust account",
    attestation2: "ledger and the bank statement for the period indicated.",
    arreteLe: "Closed on",
    par: "by",
    brouillonRappro: "NOT CLOSED",
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


export async function facturePdf(f: FacturePdf, c: CabinetPdf): Promise<Uint8Array> {
  const langue: LanguePdf = f.langue ?? "fr"
  const m = MOTS[langue]
  const argent = argentDe(langue)
  const pourcent = pourcentDe(langue)

  const doc = await PDFDocument.create()
  const page = doc.addPage([LARGEUR, HAUTEUR])
  const normal = await doc.embedFont(StandardFonts.Helvetica)
  const gras = await doc.embedFont(StandardFonts.HelveticaBold)

  let y = await enTete(doc, page, c, normal, gras, m.facture, m.consultantCric)

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

  pagination(page, normal, m.page(1, 1))

  // Un brouillon porte sa mention. Sans elle, une facture non émise circule et
  // se fait payer comme une vraie — puis son numéro change à l'émission.
  if (f.statut === "draft") filigrane(page, m.brouillon, gras)

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

  let y = await enTete(doc, page, c, normal, gras, m.recu, m.consultantCric)

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

  pagination(page, normal, m.page(1, 1))

  return doc.save()
}


/**
 * L'état de rapprochement du compte en fidéicommis.
 *
 * Il partage l'en-tête, la typographie et le pied des deux autres pièces : un
 * cabinet qui remet trois documents au même inspecteur ne doit pas avoir l'air
 * d'en avoir trois origines.
 *
 * La VENTILATION PAR CLIENT y figure, et ce n'est pas une décoration. Un solde
 * global juste peut masquer un client débiteur compensé par un autre — la
 * faute la plus grave en matière de fidéicommis. L'état la rend visible.
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

  let y = await enTete(doc, page, c, normal, gras, m.rapprochement, m.consultantCric)

  const xMilieu = 300
  bloc(page, G, y, m.compteFiducie, c.nom ? couper(c.nom, gras, 10, 220) : "-", normal, gras)
  bloc(page, xMilieu, y, m.periodeArretee, r.periodeFin, normal, gras, false, 9.5)
  bloc(page, D, y, m.soldeRapproche, argent(r.soldeRegistre), normal, gras, true, 14)

  y -= 40
  page.drawLine({ start: { x: G, y }, end: { x: D, y }, thickness: 1.6, color: ENCRE })
  y -= 24

  const xLibelle = 470
  droite(page, m.soldeReleve, xLibelle, y, normal, 9.5, GRIS)
  droite(page, argent(r.soldeBancaire), D, y, normal, 9.5)
  y -= 22

  ecrire(page, m.elementsRapprochement, { x: G, y, size: 8, font: gras, color: GRIS })
  y -= 16

  if (r.ecarts.length === 0) {
    ecrire(page, couper(m.aucunEcart, normal, 9, D - G), { x: G, y, size: 9, font: normal, color: GRIS })
    y -= 18
  } else {
    for (const e of r.ecarts) {
      ecrire(page, couper(e.libelle, normal, 9.5, 380), { x: G, y, size: 9.5, font: normal, color: ENCRE })
      droite(page, `${e.montant > 0 ? "+" : "-"}${argent(Math.abs(e.montant))}`, D, y, normal, 9.5)
      y -= 15
    }
  }

  const explique = r.ecarts.reduce((t, e) => t + e.montant, 0)
  const residuel = Math.round((r.soldeBancaire + explique - r.soldeRegistre) * 100) / 100

  y -= 4
  page.drawLine({ start: { x: 340, y: y + 9 }, end: { x: D, y: y + 9 }, thickness: 0.6, color: TRAIT })
  y -= 6
  droite(page, m.soldeRegistre, xLibelle, y, normal, 10, GRIS)
  droite(page, argent(r.soldeRegistre), D, y, normal, 10)
  y -= 18

  page.drawLine({ start: { x: 340, y: y + 9 }, end: { x: D, y: y + 9 }, thickness: 1.6, color: ENCRE })
  y -= 6
  // L'écart résiduel est imprimé MÊME quand il vaut zéro. C'est la ligne que
  // l'inspection cherche ; l'omettre parce qu'elle est nulle obligerait à
  // refaire le calcul pour s'en assurer.
  droite(page, m.ecartResiduel, xLibelle, y, gras, 11)
  droite(page, argent(residuel), D, y, gras, 11)
  y -= 34

  ecrire(page, m.ventilationClients, { x: G, y, size: 8, font: gras, color: GRIS })
  y -= 14
  ecrire(page, m.client, { x: G, y, size: 8, font: normal, color: GRIS })
  droite(page, m.solde, D, y, normal, 8, GRIS)
  y -= 16

  let totalVentile = 0
  for (const p of r.parClient.slice(0, 28)) {
    totalVentile += p.solde
    ecrire(page, couper(p.nom, normal, 9.5, 380), { x: G, y, size: 9.5, font: normal, color: ENCRE })
    droite(page, argent(p.solde), D, y, normal, 9.5, p.solde < 0 ? rgb(0.72, 0.11, 0.11) : ENCRE)
    y -= 14
    if (y < 150) break
  }

  y -= 4
  page.drawLine({ start: { x: G, y: y + 9 }, end: { x: D, y: y + 9 }, thickness: 0.6, color: TRAIT })
  y -= 6
  droite(page, m.totalVentilation, xLibelle, y, gras, 10)
  droite(page, argent(totalVentile), D, y, gras, 10)

  let bas = 120
  if (r.notes) {
    ecrire(page, m.notes, { x: G, y: bas, size: 8, font: gras, color: GRIS })
    bas -= 12
    ecrire(page, couper(r.notes, normal, 9, D - G), { x: G, y: bas, size: 9, font: normal, color: ENCRE })
    bas -= 18
  }

  ecrire(page, m.attestation, { x: G, y: bas, size: 8.5, font: normal, color: GRIS })
  bas -= 11
  ecrire(page, m.attestation2, { x: G, y: bas, size: 8.5, font: normal, color: GRIS })
  bas -= 14
  if (r.clos && r.closLe) {
    ecrire(page, `${m.arreteLe} ${r.closLe}${r.closPar ? ` ${m.par} ${r.closPar}` : ""}`,
      { x: G, y: bas, size: 8.5, font: gras, color: ENCRE })
  }

  // Un état non arrêté porte sa mention : sans elle, un brouillon circule et
  // se fait prendre pour la pièce définitive.
  if (!r.clos) filigrane(page, m.brouillonRappro, gras, 48, 150)

  pagination(page, normal, m.page(1, 1))
  return doc.save()
}
