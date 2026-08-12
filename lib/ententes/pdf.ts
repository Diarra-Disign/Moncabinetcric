import "server-only"

import { PDFDocument, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib"
import {
  ENCRE, GRIS, TRAIT, LARGEUR, HAUTEUR, G, D,
  argentDe, ecrire, couper, envelopper, droite,
  enTete, bloc, pagination, filigrane,
  type LanguePdf, type CabinetPdf,
} from "@/lib/pdf/primitives"

/**
 * L'entente de service, en PDF.
 *
 * CE QUI DISTINGUE CE DOCUMENT D'UNE FACTURE, et qui justifie un fichier à lui
 * plutôt qu'une variante de `facturePdf()` :
 *
 * 1. IL EST LONG. Une facture tient sur une page ; une entente de service en
 *    fait trois ou quatre. Le texte doit donc s'ENVELOPPER et le document
 *    ENJAMBER les pages. La facture, elle, tronque ce qui dépasse — acceptable
 *    pour une description de ligne, inacceptable pour un article : abréger une
 *    clause, c'est retirer des obligations du texte que le client signe.
 *
 * 2. IL SE SIGNE. Le bloc de signature n'est pas une décoration : il porte le
 *    numéro de permis du consultant, qui atteste qu'il est autorisé à
 *    représenter devant IRCC. Et il porte DEUX signataires — le §25 le
 *    rappelait, le consultant signe aussi.
 *
 * 3. IL S'IMPRIME DEPUIS L'INSTANTANÉ, jamais depuis le modèle. Les articles
 *    reçus ici ont déjà été substitués et figés à la création (§18) : cette
 *    fonction ne connaît ni variables ni modèles, et ne peut donc pas produire
 *    un texte différent de celui qui a été accepté.
 *
 * Tout le reste — en-tête du cabinet, translittération WinAnsi, échelle
 * typographique — vient des primitives partagées. Un cabinet qui remet une
 * facture et un contrat au même client ne doit pas avoir l'air d'en avoir deux.
 */

const MOTS = {
  fr: {
    entente: "ENTENTE DE SERVICE",
    consultantCric: "Consultant réglementé CRIC",
    entre: "ENTRE — LE CONSULTANT",
    et: "ET — LE CLIENT",
    date: "DATE",
    permisAbrege: "Permis CRIC",
    tel: "Tél.",
    parties: "Ci-après collectivement désignés les « Parties ».",
    numero: "N° D'ENTENTE",
    honoraires: "HONORAIRES",
    proBono: "PRO BONO",
    sansHonoraires: "Sans honoraires",
    dossier: "DOSSIER",
    sousTotal: "Honoraires",
    taxes: "Taxes",
    total: "Total",
    signatures: "SIGNATURES",
    leClient: "Le client",
    leConsultant: "Le consultant",
    signeLe: "Signé le",
    brouillon: "BROUILLON",
    page: (n: number, sur: number) => `Page ${n} sur ${sur}`,
    suite: "suite",
    aucunArticle: "Cette entente ne comporte aucun article.",
    roles: {
      client: "Client", spouse: "Conjoint", co_applicant: "Codemandeur",
      parent: "Parent", representative: "Représentant",
      consultant: "Consultant", other: "Partie",
    } as Record<string, string>,
  },
  en: {
    entente: "SERVICE AGREEMENT",
    consultantCric: "Regulated Canadian Immigration Consultant",
    entre: "BETWEEN — THE CONSULTANT",
    et: "AND — THE CLIENT",
    date: "DATE",
    permisAbrege: "RCIC licence",
    tel: "Tel.",
    parties: "Hereinafter collectively referred to as the « Parties ».",
    numero: "AGREEMENT NUMBER",
    honoraires: "FEES",
    proBono: "PRO BONO",
    sansHonoraires: "No fees",
    dossier: "MATTER",
    sousTotal: "Fees",
    taxes: "Taxes",
    total: "Total",
    signatures: "SIGNATURES",
    leClient: "The client",
    leConsultant: "The consultant",
    signeLe: "Signed on",
    brouillon: "DRAFT",
    page: (n: number, sur: number) => `Page ${n} of ${sur}`,
    suite: "continued",
    aucunArticle: "This agreement contains no articles.",
    roles: {
      client: "Client", spouse: "Spouse", co_applicant: "Co-applicant",
      parent: "Parent", representative: "Representative",
      consultant: "Consultant", other: "Party",
    } as Record<string, string>,
  },
} as const

export interface ArticleImprime {
  position: number
  code: string
  title_fr: string
  body_fr: string
  level: string
}

export interface SignataireImprime {
  nom: string
  /** Le CODE du rôle, pas son libellé : c'est ici qu'il devient du texte, et
   *  c'est ici que vit la table de mots des deux langues. */
  role: string
  /** Numéro de permis, pour le consultant seulement. */
  permis?: string
}

/**
 * Une partie au contrat, telle qu'elle s'identifie en tête du document.
 *
 * LE §8 EXIGE DEUX BLOCS DISTINCTS, et cette interface est ce qui l'impose :
 * les deux parties passent par la même structure, donc le consultant ne peut
 * pas hériter d'un champ du client ni l'inverse. Auparavant le contrat ne
 * portait QU'UN bloc — le contractant — et le cabinet se contentait de
 * l'en-tête, sans adresse complète. Un contrat n'identifiait donc qu'une des
 * deux parties qui s'engagent.
 *
 * Tout est facultatif sauf le nom, et rien de vide ne s'imprime (§4) : un
 * consultant sans site web, un client sans téléphone, un bureau sans numéro
 * d'unité — ce sont les cas ordinaires.
 */
export interface BlocPartie {
  /** La personne physique, civilité comprise. */
  nom: string
  /** La raison sociale, pour le cabinet. Omise quand elle vaut le nom. */
  organisation?: string
  /** Permis CRIC — le consultant seulement. */
  permis?: string
  /** Déjà composées, déjà débarrassées des vides. */
  lignesAdresse: string[]
  telephone?: string
  courriel?: string
  siteWeb?: string
}

export interface EntentePdf {
  numero: string
  date: string
  titre: string
  statut: string
  proBono: boolean
  /** Le cabinet et son consultant — la partie qui s'engage à représenter. */
  consultant: BlocPartie
  /** Le contractant — la partie représentée. */
  client: BlocPartie
  dossierReference: string
  articles: ArticleImprime[]
  signataires: SignataireImprime[]
  montants: { honoraires: number; taxes: number; total: number }
  langue?: LanguePdf
}

/** Plancher du contenu : sous cette ligne, il ne reste que la pagination. */
const BAS = 96
/**
 * La hauteur qu'occupera le bloc de signature, selon le nombre de signataires.
 *
 * C'était une CONSTANTE généreuse, et cela se voyait : sur un contrat court à
 * deux signataires, elle réservait cent trente-deux points là où quatre-vingt-
 * quatorze suffisent, et les signatures partaient seules sur une deuxième page
 * en laissant une demi-page blanche. Un document qu'on tend à signer ne doit
 * pas donner l'impression d'avoir été mal assemblé.
 *
 * Deux signataires par rangée, une rangée par paire, plus le titre.
 */
const hauteurSignatures = (nombre: number) => 20 + Math.max(1, Math.ceil(nombre / 2)) * 74

/**
 * Le flux de pages.
 *
 * Il existe parce qu'un contrat déborde, et qu'un débordement mal géré est
 * invisible : pdf-lib n'avertit pas quand on écrit sous le bord de la page,
 * le texte disparaît simplement. Un article manquant dans un contrat signé se
 * découvrirait devant le Collège.
 *
 * `place(hauteur)` est la seule façon de descendre : elle ouvre une page quand
 * ce qui vient ne tient plus, et rend l'ordonnée où écrire.
 */
class Flux {
  page: PDFPage
  y: number
  readonly pages: PDFPage[] = []

  // Champs déclarés puis affectés, plutôt que des propriétés de paramètre :
  // « node --experimental-strip-types » — dont vivent les scripts d'épreuve —
  // ne sait pas les transformer, et le raccourci aurait rendu ce fichier
  // impossible à importer depuis « ./cric ententes ».
  private readonly doc: PDFDocument
  private readonly normal: PDFFont
  private readonly entete: { cabinet: string; numero: string; suite: string }

  constructor(
    doc: PDFDocument,
    normal: PDFFont,
    entete: { cabinet: string; numero: string; suite: string },
    premiere: PDFPage,
    yDepart: number
  ) {
    this.doc = doc
    this.normal = normal
    this.entete = entete
    this.page = premiere
    this.y = yDepart
    this.pages.push(premiere)
  }

  /** Réserve `hauteur` points, en changeant de page si nécessaire. */
  place(hauteur: number): number {
    if (this.y - hauteur < BAS) this.nouvellePage()
    this.y -= hauteur
    return this.y
  }

  nouvellePage() {
    const page = this.doc.addPage([LARGEUR, HAUTEUR])
    this.pages.push(page)
    this.page = page
    // Un bandeau de rappel, pas l'en-tête complet : répéter le logo et
    // l'adresse à chaque page ferait un dépliant publicitaire. Le nom du
    // cabinet et le numéro d'entente suffisent à rattacher une page égarée.
    ecrire(page, couper(this.entete.cabinet, this.normal, 8, 300), {
      x: G, y: 792, size: 8, font: this.normal, color: GRIS,
    })
    droite(page, `${this.entete.numero} · ${this.entete.suite}`, D, 792, this.normal, 8, GRIS)
    page.drawLine({ start: { x: G, y: 784 }, end: { x: D, y: 784 }, thickness: 0.6, color: TRAIT })
    this.y = 760
  }
}

/**
 * Un bloc d'identification de partie. Rend la HAUTEUR occupée.
 *
 * Aucune ligne vide n'est écrite (§4) : chaque élément absent ne consomme pas
 * de place. C'est pour cela que la hauteur est rendue plutôt que supposée —
 * le bloc du consultant, plus fourni, décide seul de la suite de la page.
 */
function blocPartie(
  page: PDFPage, x: number, y: number, largeur: number,
  titre: string, p: BlocPartie,
  m: typeof MOTS.fr | typeof MOTS.en,
  normal: PDFFont, gras: PDFFont
): number {
  let curseur = y

  ecrire(page, titre, { x, y: curseur, size: 7.5, font: gras, color: GRIS })
  curseur -= 16

  ecrire(page, couper(p.nom, gras, 10, largeur), { x, y: curseur, size: 10, font: gras, color: ENCRE })
  curseur -= 13

  // La raison sociale sous le nom, et seulement si elle en diffère : « Adama
  // Diarra » puis « Adama Diarra » serait un doublon, pas une précision.
  if (p.organisation && p.organisation.trim() && p.organisation.trim() !== p.nom.trim()) {
    ecrire(page, couper(p.organisation, gras, 9, largeur), { x, y: curseur, size: 9, font: gras, color: ENCRE })
    curseur -= 12
  }

  if (p.permis) {
    // Le permis est en ENCRE, pas en gris : c'est le renseignement qui atteste
    // que cette partie-ci est autorisée à représenter devant IRCC.
    ecrire(page, couper(`${m.permisAbrege} ${p.permis}`, normal, 8.5, largeur),
      { x, y: curseur, size: 8.5, font: normal, color: ENCRE })
    curseur -= 12
  }

  for (const ligne of p.lignesAdresse) {
    ecrire(page, couper(ligne, normal, 8.5, largeur), { x, y: curseur, size: 8.5, font: normal, color: GRIS })
    curseur -= 11
  }

  for (const ligne of [
    p.telephone ? `${m.tel} ${p.telephone}` : "",
    p.courriel ?? "",
    p.siteWeb ?? "",
  ]) {
    if (!ligne.trim()) continue
    ecrire(page, couper(ligne, normal, 8.5, largeur), { x, y: curseur, size: 8.5, font: normal, color: GRIS })
    curseur -= 11
  }

  return y - curseur
}

export async function ententePdf(e: EntentePdf, c: CabinetPdf): Promise<Uint8Array> {
  const langue: LanguePdf = e.langue ?? "fr"
  const m = MOTS[langue]
  const argent = argentDe(langue)

  const doc = await PDFDocument.create()
  const premiere = doc.addPage([LARGEUR, HAUTEUR])
  const normal = await doc.embedFont(StandardFonts.Helvetica)
  const gras = await doc.embedFont(StandardFonts.HelveticaBold)

  let y = await enTete(doc, premiere, c, normal, gras, m.entente, m.consultantCric)

  // ---- Le bandeau : quand, sous quel numéro, pour combien ------------------
  const xMilieu = 300

  bloc(premiere, G, y, m.date, e.date, normal, gras, false, 9.5)
  bloc(premiere, xMilieu, y, m.numero, e.numero, normal, gras, false, 9.5)
  // Pro bono : l'absence d'honoraires est le PROPOS du contrat, pas un oubli.
  // Imprimer « 0,00 $ » laisserait croire à une grille tarifaire non remplie.
  bloc(
    premiere, D, y, e.proBono ? m.proBono : m.honoraires,
    e.proBono ? m.sansHonoraires : argent(e.montants.total),
    normal, gras, true, e.proBono ? 11 : 14
  )

  y -= 34
  if (e.dossierReference) {
    ecrire(premiere, `${m.dossier} ${e.dossierReference}`, { x: G, y, size: 8.5, font: normal, color: GRIS })
    y -= 12
  }

  premiere.drawLine({ start: { x: G, y }, end: { x: D, y }, thickness: 1.6, color: ENCRE })
  y -= 22

  // ---- LES DEUX PARTIES, CÔTE À CÔTE (§8) ---------------------------------
  // Un filet vertical les sépare. Ce n'est pas de l'ornement : les deux
  // adresses ne doivent jamais pouvoir se lire comme une seule, et un lecteur
  // qui cherche « où joindre le consultant » doit trouver la réponse d'un
  // regard, sans démêler deux colonnes de texte qui se touchent.
  const largeurPartie = 215
  const xDroite = 320

  const hauteurGauche = blocPartie(premiere, G, y, largeurPartie, m.entre, e.consultant, m, normal, gras)
  const hauteurDroite = blocPartie(premiere, xDroite, y, largeurPartie, m.et, e.client, m, normal, gras)
  const hauteurParties = Math.max(hauteurGauche, hauteurDroite)

  premiere.drawLine({
    start: { x: xDroite - 26, y: y + 4 }, end: { x: xDroite - 26, y: y - hauteurParties + 6 },
    thickness: 0.6, color: TRAIT,
  })

  y -= hauteurParties + 14
  ecrire(premiere, m.parties, { x: G, y, size: 8.5, font: normal, color: GRIS })
  y -= 22

  premiere.drawLine({ start: { x: G, y }, end: { x: D, y }, thickness: 0.6, color: TRAIT })
  y -= 26

  // Le titre du mandat, sous le filet : c'est de CE service qu'il s'agit, et
  // le numéro d'entente ne le dit pas.
  ecrire(premiere, couper(e.titre, gras, 13, D - G), { x: G, y, size: 13, font: gras, color: ENCRE })
  y -= 26

  // ---- Les articles -------------------------------------------------------
  const flux = new Flux(
    doc, normal,
    { cabinet: c.nom, numero: e.numero, suite: m.suite },
    premiere, y
  )
  const largeur = D - G

  if (e.articles.length === 0) {
    // Un contrat vide ne doit pas ressembler à un contrat court : il le dit.
    ecrire(flux.page, m.aucunArticle, { x: G, y: flux.place(14), size: 9.5, font: normal, color: GRIS })
  }

  for (const [index, article] of e.articles.entries()) {
    const titre = `${index + 1}. ${article.title_fr}`.toUpperCase()
    const lignesTitre = envelopper(titre, gras, 10, largeur)
    const lignesCorps = envelopper(article.body_fr, normal, 9.5, largeur)

    // Le titre et la PREMIÈRE ligne du corps sont placés ensemble : un titre
    // seul en bas de page, son texte à la page suivante, se lit comme un
    // article vide.
    const solidaire = lignesTitre.length * 13 + (lignesCorps.length > 0 ? 14 : 0)
    if (flux.y - solidaire < BAS) flux.nouvellePage()

    for (const ligne of lignesTitre) {
      ecrire(flux.page, ligne, { x: G, y: flux.place(13), size: 10, font: gras, color: ENCRE })
    }
    flux.y -= 3
    for (const ligne of lignesCorps) {
      // Une ligne vide sépare deux alinéas : elle ne s'écrit pas, elle se
      // laisse.
      if (!ligne) { flux.place(6); continue }
      ecrire(flux.page, ligne, { x: G, y: flux.place(13), size: 9.5, font: normal, color: ENCRE })
    }
    flux.y -= 14
  }

  // ---- Le récapitulatif des montants --------------------------------------
  // Pro bono excepté : une ligne « Total 0,00 $ » sous un contrat sans
  // contrepartie contredirait ses propres articles.
  if (!e.proBono) {
    const xLibelle = 470
    if (flux.y - 70 < BAS) flux.nouvellePage()
    flux.y -= 6
    flux.page.drawLine({
      start: { x: 340, y: flux.y + 9 }, end: { x: D, y: flux.y + 9 }, thickness: 0.6, color: TRAIT,
    })
    let yM = flux.place(16)
    droite(flux.page, m.sousTotal, xLibelle, yM, normal, 9.5, GRIS)
    droite(flux.page, argent(e.montants.honoraires), D, yM, normal, 9.5)
    if (e.montants.taxes > 0) {
      yM = flux.place(16)
      droite(flux.page, m.taxes, xLibelle, yM, normal, 9.5, GRIS)
      droite(flux.page, `+${argent(e.montants.taxes)}`, D, yM, normal, 9.5)
    }
    flux.page.drawLine({
      start: { x: 340, y: flux.y - 5 }, end: { x: D, y: flux.y - 5 }, thickness: 1.6, color: ENCRE,
    })
    yM = flux.place(22)
    droite(flux.page, m.total, xLibelle, yM, gras, 11)
    droite(flux.page, argent(e.montants.total), D, yM, gras, 11)
    flux.y -= 18
  }

  // ---- Les signatures -----------------------------------------------------
  // Réservées d'un bloc : une ligne de signature coupée entre deux pages
  // laisserait signer sous le vide.
  if (flux.y - hauteurSignatures(e.signataires.length) < BAS) flux.nouvellePage()

  let yS = flux.place(20)
  ecrire(flux.page, m.signatures, { x: G, y: yS, size: 8, font: gras, color: GRIS })

  // Deux colonnes fixes plutôt qu'une répartition calculée : au-delà de deux
  // signataires, on descend d'une rangée. Un contrat à six parties reste
  // lisible, et aucune colonne ne rétrécit jusqu'à l'illisible.
  const colonnes = [G, 320]
  const largeurColonne = 215
  for (let i = 0; i < e.signataires.length; i += 2) {
    const rangee = e.signataires.slice(i, i + 2)
    const yLigne = flux.place(56)
    rangee.forEach((s, j) => {
      const x = colonnes[j]
      flux.page.drawLine({
        start: { x, y: yLigne + 22 }, end: { x: x + largeurColonne, y: yLigne + 22 },
        thickness: 0.8, color: ENCRE,
      })
      ecrire(flux.page, couper(s.nom, gras, 9.5, largeurColonne), {
        x, y: yLigne + 10, size: 9.5, font: gras, color: ENCRE,
      })
      const role = m.roles[s.role] ?? m.roles.other
      // La mention réglementaire REMPLACE le rôle au lieu de s'y ajouter :
      // « Consultant · Consultant réglementé CRIC R1041776 » disait deux fois
      // le même mot sous une ligne de signature.
      const dessous = s.permis ? `${m.consultantCric} ${s.permis}` : role
      ecrire(flux.page, couper(dessous, normal, 8, largeurColonne), {
        x, y: yLigne, size: 8, font: normal, color: GRIS,
      })
      ecrire(flux.page, m.signeLe, { x, y: yLigne - 14, size: 8, font: normal, color: GRIS })
      flux.page.drawLine({
        start: { x: x + 44, y: yLigne - 13 }, end: { x: x + largeurColonne, y: yLigne - 13 },
        thickness: 0.5, color: TRAIT,
      })
    })
    flux.y -= 18
  }

  // ---- Pagination et filigrane, en dernier --------------------------------
  // La pagination ne peut s'écrire qu'ICI : « Page 2 sur 4 » suppose de savoir
  // qu'il y en a quatre, et on ne le sait qu'une fois le texte posé.
  const total = flux.pages.length
  flux.pages.forEach((page, i) => {
    pagination(page, normal, m.page(i + 1, total))
    if (e.statut === "draft") filigrane(page, m.brouillon, gras, 48, 150)
  })

  return doc.save()
}
