import "server-only"

import { PDFDocument, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib"
import {
  ENCRE, GRIS, TRAIT, MARINE, OR, VOILE, BLANC, LARGEUR, HAUTEUR, G, D,
  argentDe, ecrire, couper, envelopper, droite, centre,
  logoEnOctets, filigrane,
  type LanguePdf, type CabinetPdf,
} from "@/lib/pdf/primitives"
import type { EmplacementSignature } from "./emplacements"

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
    entre: "CONSULTANT / REPRÉSENTANT",
    et: "CLIENT / CONTRACTANT",
    date: "DATE",
    permisAbrege: "Permis CRIC",
    tel: "Tél.",
    parties: "Ci-après collectivement désignés les « Parties ».",
    surTitre: "CONTRAT DE REPRÉSENTATION",
    sousTitre: "EN IMMIGRATION CANADIENNE",
    numero: "N° DE CONTRAT",
    dateContrat: "DATE DU CONTRAT",
    dossierRef: "DOSSIER / RÉFÉRENCE",
    regi: [
      "Le présent contrat est régi par les lois du Canada et par les",
      "règlements du Collège des consultants en immigration et en",
      "citoyenneté (CCIC).",
    ],
    consultantLong: "Consultant réglementé en immigration canadienne",
    description: "DESCRIPTION",
    montantCad: "MONTANT (CAD)",
    honorairesPro: "Honoraires professionnels",
    servicesTitre: "DESCRIPTION DES SERVICES",
    servicesInclus: "Services inclus",
    echeancierTitre: "ÉCHÉANCIER DES HONORAIRES",
    colEtape: "Étape",
    colDescription: "Description",
    colEcheance: "Déclenchement",
    colMode: "Mode",
    colMontant: "Montant",
    totalHonoraires: "Total des honoraires",
    fiducieMarque: "fidéicommis",
    fiducieMention: [
      "Les versements marqués « fidéicommis » sont détenus en fiducie conformément à l'article 13",
      "du règlement du Collège. Ils ne sont virés au compte général du cabinet qu'au fur et à mesure",
      "des services rendus.",
    ],
    modesTitre: "MODES DE PAIEMENT ACCEPTÉS",
    conditionsTitre: "CONDITIONS PARTICULIÈRES DE PAIEMENT",
    fraisTitre: "FRAIS NON INCLUS DANS LES HONORAIRES",
    pourLeConsultant: "POUR LE CONSULTANT",
    pourLeClient: "POUR LE CLIENT",
    nomLabel: "Nom :",
    signatureLabel: "Signature :",
    dateLabel: "Date :",
    piedConfidentiel: "Vos informations sont confidentielles et protégées.",
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
    entre: "CONSULTANT / REPRESENTATIVE",
    et: "CLIENT / CONTRACTING PARTY",
    date: "DATE",
    permisAbrege: "RCIC licence",
    tel: "Tel.",
    parties: "Hereinafter collectively referred to as the « Parties ».",
    surTitre: "REPRESENTATION AGREEMENT",
    sousTitre: "CANADIAN IMMIGRATION",
    numero: "AGREEMENT NO.",
    dateContrat: "AGREEMENT DATE",
    dossierRef: "MATTER / REFERENCE",
    regi: [
      "This agreement is governed by the laws of Canada and by the",
      "regulations of the College of Immigration and Citizenship",
      "Consultants (CICC).",
    ],
    consultantLong: "Regulated Canadian Immigration Consultant",
    description: "DESCRIPTION",
    montantCad: "AMOUNT (CAD)",
    honorairesPro: "Professional fees",
    servicesTitre: "DESCRIPTION OF SERVICES",
    servicesInclus: "Services included",
    echeancierTitre: "FEE SCHEDULE",
    colEtape: "Step",
    colDescription: "Description",
    colEcheance: "Trigger",
    colMode: "Method",
    colMontant: "Amount",
    totalHonoraires: "Total fees",
    fiducieMarque: "in trust",
    fiducieMention: [
      "Payments marked \"in trust\" are held in trust under section 13 of the College's regulation.",
      "They are transferred to the firm's general account only as services are rendered.",
    ],
    modesTitre: "ACCEPTED PAYMENT METHODS",
    conditionsTitre: "PARTICULAR PAYMENT TERMS",
    fraisTitre: "FEES NOT INCLUDED",
    pourLeConsultant: "FOR THE CONSULTANT",
    pourLeClient: "FOR THE CLIENT",
    nomLabel: "Name:",
    signatureLabel: "Signature:",
    dateLabel: "Date:",
    piedConfidentiel: "Your information is confidential and protected.",
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
  /** La description libre du mandat (§3, §15). */
  servicesDescription?: string
  /** Les services décomposés (§4), déjà ordonnés. */
  servicesItems?: { position: number; libelle: string }[]
  /** L'échéancier (§6), déjà calculé et ordonné. */
  echeancier?: {
    position: number; description: string; declenchement?: string
    mode?: string; montant: number; pourcentage?: number
    /** Ce versement est détenu en fiducie (art. 13). */
    fideicommis?: boolean
  }[]
  /** Les modes acceptés, déjà traduits en libellés lisibles (§11). */
  modesPaiement?: string[]
  conditionsPaiement?: string
  fraisNonInclus?: string
  articles: ArticleImprime[]
  signataires: SignataireImprime[]
  montants: { honoraires: number; taxes: number; total: number }
  langue?: LanguePdf
}

/**
 * Plancher du contenu : sous cette ligne, il ne reste que le bandeau de pied.
 *
 * Le bandeau fait trente points de haut et il est PLEIN : y écrire du texte le
 * rendrait illisible, pas seulement mal placé.
 */
const BAS = 76
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
const hauteurSignatures = (nombre: number) => 20 + Math.max(1, Math.ceil(nombre / 2)) * 76

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

  /**
   * Réserve `hauteur` points, en changeant de page si nécessaire.
   *
   * Rend LA PAGE ET L'ORDONNÉE, jamais l'ordonnée seule — et c'est une garde,
   * pas une commodité. Écrit d'un trait,
   *
   *     ecrire(flux.page, ligne, { y: flux.place(13) })
   *
   * JavaScript évalue « flux.page » AVANT « flux.place() ». Quand place()
   * ouvrait une page, la ligne partait donc sur l'ANCIENNE page à l'ordonnée
   * de la NOUVELLE : la première ligne de chaque page s'imprimait par-dessus
   * l'en-tête de la précédente. Rien ne levait, et cela ne se voyait que sur un
   * contrat assez long pour déborder.
   *
   * En rendant les deux ensemble, l'appelant ne PEUT plus tenir une page
   * périmée : le défaut est écarté par la forme, pas par la vigilance.
   */
  place(hauteur: number): { page: PDFPage; y: number } {
    if (this.y - hauteur < BAS) this.nouvellePage()
    this.y -= hauteur
    return { page: this.page, y: this.y }
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
    page.drawLine({ start: { x: G, y: 784 }, end: { x: G + 40, y: 784 }, thickness: 1.6, color: OR })
    page.drawLine({ start: { x: G + 40, y: 784 }, end: { x: D, y: 784 }, thickness: 0.6, color: TRAIT })
    this.y = 760
  }
}

/**
 * L'en-tête du contrat : le cabinet à gauche, le titre et les repères à droite.
 *
 * Il ne réutilise PAS `enTete()` des primitives, et c'est le seul écart assumé
 * de tout ce fichier. Cet en-tête-là convient à une facture, où le titre suffit
 * et où l'adresse n'est qu'un repère. Un contrat s'ouvre autrement : il faut y
 * lire, avant toute chose, QUI s'engage et SOUS QUEL NUMÉRO. Les primitives de
 * dessin — translittération, coupe, alignement — restent partagées ; c'est la
 * composition qui diffère, comme elle diffère sur le papier.
 *
 * Rend l'ordonnée où la suite reprend.
 */
async function enTeteContrat(
  doc: PDFDocument, page: PDFPage, e: EntentePdf, c: CabinetPdf,
  m: typeof MOTS.fr | typeof MOTS.en, normal: PDFFont, gras: PDFFont
): Promise<number> {
  const HAUT = 792
  const xDroite = 300
  let yGauche = HAUT

  // ---- Colonne gauche : l'identité du cabinet ----
  const logo = await logoEnOctets(c.logoUrl)
  if (logo) {
    try {
      const image = logo.type === "jpg" ? await doc.embedJpg(logo.octets) : await doc.embedPng(logo.octets)
      const h = 44
      const l = (image.width / image.height) * h
      page.drawImage(image, { x: G, y: yGauche - h, width: Math.min(l, 170), height: h })
      yGauche -= h + 12
    } catch {
      // Format non reconnu : le nom du cabinet suffit à l'identifier.
    }
  }

  ecrire(page, couper(c.nom, gras, 15, 220), { x: G, y: yGauche - 12, size: 15, font: gras, color: MARINE })
  yGauche -= 28

  const identite = [
    e.consultant.nom,
    m.consultantLong,
    c.numeroPermis ? `${m.permisAbrege} ${c.numeroPermis}` : "",
  ]
  for (const [i, ligne] of identite.entries()) {
    if (!ligne.trim()) continue
    ecrire(page, couper(ligne, i === 0 ? gras : normal, 9, 230), {
      x: G, y: yGauche, size: 9, font: i === 0 ? gras : normal, color: i === 0 ? ENCRE : GRIS,
    })
    yGauche -= 12
  }

  // LES COORDONNÉES NE SONT PAS RÉPÉTÉES ICI. Le panneau « 1. Consultant /
  // Représentant », quelques centimètres plus bas, porte l'adresse, le
  // téléphone et le courriel. Les imprimer deux fois sur la même page faisait
  // lire le document comme un dépliant, et obligerait à corriger deux endroits
  // le jour d'un déménagement. L'en-tête dit QUI ; le panneau dit OÙ.

  // ---- Colonne droite : le bandeau de titre ----
  const largeurBandeau = D - xDroite
  const hauteurBandeau = 46
  page.drawRectangle({
    x: xDroite, y: HAUT - hauteurBandeau, width: largeurBandeau, height: hauteurBandeau, color: MARINE,
  })
  centre(page, m.surTitre, xDroite + largeurBandeau / 2, HAUT - 22, gras, 13, BLANC)
  centre(page, m.sousTitre, xDroite + largeurBandeau / 2, HAUT - 37, normal, 10, OR)

  let yDroite = HAUT - hauteurBandeau - 24

  // Les trois repères, chacun sur son filet — la forme d'un contrat qu'on
  // remplit à la main, celle que le consultant reconnaît.
  for (const [etiquette, valeur] of [
    [m.numero, e.numero],
    [m.dateContrat, e.date],
    [m.dossierRef, e.dossierReference || "—"],
  ] as const) {
    ecrire(page, etiquette, { x: xDroite, y: yDroite, size: 8, font: gras, color: ENCRE })
    const xValeur = xDroite + 118
    ecrire(page, couper(valeur, normal, 9, D - xValeur), {
      x: xValeur, y: yDroite, size: 9, font: normal, color: ENCRE,
    })
    page.drawLine({
      start: { x: xValeur, y: yDroite - 4 }, end: { x: D, y: yDroite - 4 },
      thickness: 0.5, color: TRAIT,
    })
    yDroite -= 20
  }

  // L'encadré du droit applicable. Il dit ce qui gouverne le contrat sans rien
  // promettre : « régi par » n'est pas « conforme à », et le §1 interdit la
  // seconde formule.
  yDroite -= 6
  const hauteurNote = 14 + m.regi.length * 11
  page.drawRectangle({
    x: xDroite, y: yDroite - hauteurNote + 8, width: largeurBandeau, height: hauteurNote, color: VOILE,
  })
  page.drawRectangle({
    x: xDroite, y: yDroite - hauteurNote + 8, width: 2.5, height: hauteurNote, color: OR,
  })
  let yNote = yDroite - 4
  for (const ligne of m.regi) {
    ecrire(page, ligne, { x: xDroite + 12, y: yNote, size: 7.5, font: normal, color: ENCRE })
    yNote -= 11
  }
  yDroite -= hauteurNote + 6

  return Math.min(yGauche, yDroite) - 14
}

/**
 * Un panneau d'identification de partie. Rend la HAUTEUR occupée.
 *
 * LE §8 EXIGE DEUX BLOCS DISTINCTS, et le panneau est ce qui le rend visible :
 * une barre de titre pleine, un fond teinté, une bordure. Deux colonnes de
 * texte nu se touchant au milieu de la page peuvent se lire comme une seule ;
 * deux panneaux, non.
 *
 * Aucune ligne vide n'est écrite (§4) : ce qui manque ne consomme pas de place,
 * et c'est pour cela que la hauteur est RENDUE plutôt que supposée — le
 * panneau le plus fourni décide seul de la suite de la page.
 */
function panneauPartie(
  page: PDFPage, x: number, y: number, largeur: number,
  titre: string, p: BlocPartie,
  m: typeof MOTS.fr | typeof MOTS.en,
  normal: PDFFont, gras: PDFFont
): number {
  // Deux passes : on mesure d'abord, on dessine ensuite. Le fond doit être
  // posé AVANT le texte — l'inverse le recouvrirait — et sa hauteur ne se
  // connaît qu'une fois les lignes comptées.
  const lignes: { texte: string; taille: number; police: PDFFont; couleur: typeof ENCRE; saut: number }[] = []

  lignes.push({ texte: p.nom, taille: 10, police: gras, couleur: ENCRE, saut: 13 })

  if (p.organisation && p.organisation.trim() && p.organisation.trim() !== p.nom.trim()) {
    lignes.push({ texte: p.organisation, taille: 9, police: gras, couleur: ENCRE, saut: 12 })
  }
  if (p.permis) {
    // En ENCRE et non en gris : c'est le renseignement qui atteste que cette
    // partie-ci est autorisée à représenter devant IRCC.
    lignes.push({ texte: m.consultantLong, taille: 8, police: normal, couleur: GRIS, saut: 11 })
    lignes.push({ texte: `${m.permisAbrege} ${p.permis}`, taille: 8.5, police: gras, couleur: ENCRE, saut: 13 })
  }
  for (const l of p.lignesAdresse) {
    lignes.push({ texte: l, taille: 8.5, police: normal, couleur: GRIS, saut: 11 })
  }
  for (const l of [
    p.telephone ? `${m.tel} ${p.telephone}` : "",
    p.courriel ?? "",
    p.siteWeb ?? "",
  ]) {
    if (!l.trim()) continue
    lignes.push({ texte: l, taille: 8.5, police: normal, couleur: GRIS, saut: 11 })
  }

  const HAUTEUR_BARRE = 18
  const corps = lignes.reduce((t, l) => t + l.saut, 0) + 16
  const hauteur = HAUTEUR_BARRE + corps

  page.drawRectangle({
    x, y: y - hauteur, width: largeur, height: corps, color: VOILE,
    borderColor: TRAIT, borderWidth: 0.5,
  })
  page.drawRectangle({
    x, y: y - HAUTEUR_BARRE, width: largeur, height: HAUTEUR_BARRE, color: MARINE,
  })
  ecrire(page, titre, { x: x + 10, y: y - 12.5, size: 8, font: gras, color: BLANC })

  let curseur = y - HAUTEUR_BARRE - 14
  for (const l of lignes) {
    ecrire(page, couper(l.texte, l.police, l.taille, largeur - 20), {
      x: x + 10, y: curseur, size: l.taille, font: l.police, color: l.couleur,
    })
    curseur -= l.saut
  }

  return hauteur
}

/**
 * Un titre de section, dans le style DÉJÀ EN PLACE des titres d'article.
 *
 * Aucune nouvelle typographie, aucune nouvelle couleur : le §30 est explicite,
 * le design est approuvé. Ces sections s'écrivent donc exactement comme les
 * articles s'écrivent déjà — marine, corps 10, gras.
 */
function titreSection(flux: Flux, texte: string, gras: PDFFont) {
  const p = flux.place(15)
  ecrire(p.page, texte, { x: G, y: p.y, size: 10, font: gras, color: MARINE })
  flux.y -= 5
}

/** Un paragraphe enveloppé, dans le corps de texte des articles. */
function paragraphe(flux: Flux, texte: string, normal: PDFFont, largeur: number) {
  for (const ligne of envelopper(texte, normal, 9.5, largeur)) {
    if (!ligne) { flux.place(6); continue }
    const p = flux.place(13)
    ecrire(p.page, ligne, { x: G, y: p.y, size: 9.5, font: normal, color: ENCRE })
  }
}

/**
 * Le tableau de l'échéancier (§6, §23).
 *
 * Il emprunte les MÊMES bandeaux, les mêmes filets et la même échelle que le
 * tableau des honoraires qui existe déjà : un contrat ne doit pas avoir l'air
 * d'avoir deux tableaux venus de deux endroits. Seules les colonnes changent,
 * parce que la lecture change.
 *
 * Il enjambe les pages : un mandat en huit versements ne tient pas au bas
 * d'une page, et une ligne écrite sous le bord disparaîtrait en silence.
 */
function tableauEcheancier(
  flux: Flux, e: EntentePdf, m: typeof MOTS.fr | typeof MOTS.en,
  argent: (v: number) => string, normal: PDFFont, gras: PDFFont,
  langue: LanguePdf
) {
  const etapes = e.echeancier ?? []
  if (etapes.length === 0) return

  const largeur = D - G
  const H = 22
  // Les colonnes n'existent que si elles portent quelque chose : un contrat
  // sans mode par étape ne doit pas afficher une colonne « Mode » vide.
  const avecMode = etapes.some((x) => (x.mode ?? "").trim())
  const avecDeclenchement = etapes.some((x) => (x.declenchement ?? "").trim())

  // LES COLONNES SONT POSÉES PAR LEUR BORD DROIT, de la droite vers la gauche,
  // et chacune réserve sa largeur. Une première version les calculait par
  // décalages successifs : « Mode » et « Montant » se chevauchaient, et les
  // deux textes s'imprimaient l'un sur l'autre. Ici, chaque colonne connaît sa
  // borne, et la description prend ce qui reste.
  const LARGEUR_MONTANT = 92
  const LARGEUR_MODE = 84
  const LARGEUR_DECLENCHEMENT = 92

  const xEtape = G + 10
  const xDescription = G + 44
  const xMontant = D - 10
  const xMode = avecMode ? xMontant - LARGEUR_MONTANT : 0
  const xDeclenchement = avecDeclenchement
    ? (avecMode ? xMode - LARGEUR_MODE : xMontant - LARGEUR_MONTANT)
    : 0
  const finDescription = avecDeclenchement
    ? xDeclenchement - LARGEUR_DECLENCHEMENT
    : avecMode
      ? xMode - LARGEUR_MODE
      : xMontant - LARGEUR_MONTANT
  const largeurDescription = Math.max(60, finDescription - xDescription - 10)

  const enTete = () => {
    const p = flux.place(H)
    p.page.drawRectangle({ x: G, y: p.y, width: largeur, height: H, color: MARINE })
    ecrire(p.page, m.colEtape, { x: xEtape, y: p.y + 7.5, size: 8, font: gras, color: BLANC })
    ecrire(p.page, m.colDescription, { x: xDescription, y: p.y + 7.5, size: 8, font: gras, color: BLANC })
    if (avecDeclenchement) droite(p.page, m.colEcheance, xDeclenchement, p.y + 7.5, gras, 8, BLANC)
    if (avecMode) droite(p.page, m.colMode, xMode, p.y + 7.5, gras, 8, BLANC)
    droite(p.page, m.colMontant, xMontant, p.y + 7.5, gras, 8, BLANC)
  }

  enTete()

  for (const [i, etape] of etapes.entries()) {
    // Une nouvelle page redonne l'en-tête : sans lui, la suite du tableau est
    // une colonne de chiffres sans titre.
    if (flux.y - H < BAS) { flux.nouvellePage(); enTete() }
    const p = flux.place(H)
    p.page.drawRectangle({
      x: G, y: p.y, width: largeur, height: H, borderColor: TRAIT, borderWidth: 0.5,
    })
    ecrire(p.page, String(etape.position || i + 1), { x: xEtape, y: p.y + 7.5, size: 9, font: gras, color: ENCRE })
    ecrire(p.page, couper(etape.description, normal, 9, largeurDescription), {
      x: xDescription, y: p.y + 7.5, size: 9, font: normal, color: ENCRE,
    })
    if (avecDeclenchement) {
      droite(p.page, couper(etape.declenchement ?? "", normal, 8, LARGEUR_DECLENCHEMENT), xDeclenchement, p.y + 7.5, normal, 8, GRIS)
    }
    // LA MARQUE DE FIDUCIE, sous la description et non dans une colonne à
    // elle : elle ne concerne qu'une partie des versements, et une colonne
    // vide sur les autres lignes ferait chercher ce qui manque.
    if (etape.fideicommis) {
      ecrire(p.page, `(${m.fiducieMarque})`, {
        x: xDescription + couper(etape.description, normal, 9, largeurDescription).length * 0 +
          normal.widthOfTextAtSize(couper(etape.description, normal, 9, largeurDescription), 9) + 6,
        y: p.y + 7.5, size: 7.5, font: gras, color: MARINE,
      })
    }
    if (avecMode) {
      droite(p.page, couper(etape.mode ?? "", normal, 8, LARGEUR_MODE), xMode, p.y + 7.5, normal, 8, GRIS)
    }
    // Le pourcentage accompagne le montant quand il a servi à le calculer :
    // « 1 000,00 $ (20 %) » se vérifie, « 1 000,00 $ » se croit.
    // Le pourcentage accompagne le montant DANS LA LANGUE DU DOCUMENT :
    // « 22.22 % » sur un contrat français se lit comme une coquille.
    const pourcent = etape.pourcentage
      ? new Intl.NumberFormat(langue === "en" ? "en-CA" : "fr-CA", {
          maximumFractionDigits: 2,
        }).format(etape.pourcentage)
      : ""
    const montant = pourcent
      ? `${argent(etape.montant)} (${pourcent} %)`
      : argent(etape.montant)
    droite(p.page, couper(montant, gras, 9, LARGEUR_MONTANT), xMontant, p.y + 7.5, gras, 9, ENCRE)
  }

  if (flux.y - H < BAS) flux.nouvellePage()
  const total = flux.place(H)
  total.page.drawRectangle({ x: G, y: total.y, width: largeur, height: H, color: MARINE })
  ecrire(total.page, m.totalHonoraires, { x: xEtape, y: total.y + 7.5, size: 9, font: gras, color: BLANC })
  droite(
    total.page,
    argent(etapes.reduce((t, x) => t + (Number(x.montant) || 0), 0)),
    xMontant, total.y + 7.5, gras, 9, BLANC
  )
  flux.y -= 10

  // LA MENTION DE L'ARTICLE 13, et seulement si un versement est concerné.
  // L'imprimer sur tous les contrats en ferait une formule qu'on cesse de
  // lire — or celle-ci engage le cabinet sur le maniement des sommes.
  if (etapes.some((x) => x.fideicommis)) {
    for (const ligne of m.fiducieMention) {
      const p = flux.place(11)
      ecrire(p.page, ligne, { x: G, y: p.y, size: 8, font: normal, color: GRIS })
    }
    flux.y -= 10
  }
}

/**
 * Le tableau des honoraires. Rend la hauteur occupée.
 *
 * CHAQUE TAXE IMPRIME SON MONTANT SUR SA PROPRE LIGNE, et le total est dans un
 * bandeau plein : c'est le nombre que le client cherche, et le chercher dans
 * une colonne de chiffres identiques est ce qui fait qu'on repose le document.
 */
function tableauHonoraires(
  page: PDFPage, x: number, y: number, largeur: number,
  e: EntentePdf, m: typeof MOTS.fr | typeof MOTS.en,
  argent: (v: number) => string, normal: PDFFont, gras: PDFFont
): number {
  const HAUTEUR_LIGNE = 22
  const xMontant = x + largeur - 10
  const lignes: [string, number, boolean][] = [[m.honorairesPro, e.montants.honoraires, false]]
  if (e.montants.taxes > 0) lignes.push([m.taxes, e.montants.taxes, false])

  let curseur = y

  page.drawRectangle({ x, y: curseur - HAUTEUR_LIGNE, width: largeur, height: HAUTEUR_LIGNE, color: MARINE })
  ecrire(page, m.description, { x: x + 10, y: curseur - 14.5, size: 8, font: gras, color: BLANC })
  droite(page, m.montantCad, xMontant, curseur - 14.5, gras, 8, BLANC)
  curseur -= HAUTEUR_LIGNE

  for (const [libelle, montant] of lignes) {
    page.drawRectangle({
      x, y: curseur - HAUTEUR_LIGNE, width: largeur, height: HAUTEUR_LIGNE,
      borderColor: TRAIT, borderWidth: 0.5,
    })
    ecrire(page, libelle, { x: x + 10, y: curseur - 14.5, size: 9, font: normal, color: ENCRE })
    droite(page, argent(montant), xMontant, curseur - 14.5, normal, 9, ENCRE)
    curseur -= HAUTEUR_LIGNE
  }

  page.drawRectangle({ x, y: curseur - HAUTEUR_LIGNE, width: largeur, height: HAUTEUR_LIGNE, color: MARINE })
  ecrire(page, m.total, { x: x + 10, y: curseur - 14.5, size: 9, font: gras, color: BLANC })
  droite(page, argent(e.montants.total), xMontant, curseur - 14.5, gras, 9, BLANC)
  curseur -= HAUTEUR_LIGNE

  return y - curseur
}

/**
 * Le pied de page, sur chaque page.
 *
 * Il porte le numéro du contrat à côté de la pagination : une page détachée
 * doit pouvoir être rattachée à son document, et « Page 2 sur 4 » seule ne le
 * permet pas.
 */
function piedContrat(
  page: PDFPage, m: typeof MOTS.fr | typeof MOTS.en,
  reference: string, n: number, total: number, normal: PDFFont, gras: PDFFont
) {
  const HAUTEUR_PIED = 30
  page.drawRectangle({ x: 0, y: 0, width: LARGEUR, height: HAUTEUR_PIED, color: MARINE })
  ecrire(page, m.piedConfidentiel, { x: G, y: 11, size: 7.5, font: normal, color: BLANC })
  droite(page, `${reference}  ·  ${m.page(n, total)}`, D, 11, gras, 7.5, BLANC)
}

export interface ContratCompose {
  octets: Uint8Array
  /**
   * Où signer, encadré par encadré.
   *
   * Restitué plutôt que gardé pour soi : c'est ce qui permettra d'apposer les
   * signatures DANS le contrat, aux emplacements qu'il prévoit déjà, au lieu
   * d'en fabriquer d'autres à la fin du document.
   */
  emplacements: EmplacementSignature[]
}

export async function ententePdf(e: EntentePdf, c: CabinetPdf): Promise<ContratCompose> {
  const langue: LanguePdf = e.langue ?? "fr"
  const m = MOTS[langue]
  const argent = argentDe(langue)

  const doc = await PDFDocument.create()
  const premiere = doc.addPage([LARGEUR, HAUTEUR])
  const normal = await doc.embedFont(StandardFonts.Helvetica)
  const gras = await doc.embedFont(StandardFonts.HelveticaBold)

  let y = await enTeteContrat(doc, premiere, e, c, m, normal, gras)

  // ---- LES DEUX PARTIES, EN PANNEAUX NUMÉROTÉS (§8) -----------------------
  // Numérotés « 1. » et « 2. » : le contrat se lit et se cite, et « la partie
  // désignée au paragraphe 1 » a besoin d'un paragraphe 1.
  const largeurPartie = (D - G - 18) / 2
  const xDroite = G + largeurPartie + 18

  const hauteurParties = Math.max(
    panneauPartie(premiere, G, y, largeurPartie, `1. ${m.entre}`, e.consultant, m, normal, gras),
    panneauPartie(premiere, xDroite, y, largeurPartie, `2. ${m.et}`, e.client, m, normal, gras)
  )

  y -= hauteurParties + 14
  ecrire(premiere, m.parties, { x: G, y, size: 8, font: normal, color: GRIS })
  y -= 22

  // Le titre du mandat, souligné d'un filet d'or : c'est de CE service qu'il
  // s'agit, et le numéro de contrat ne le dit pas.
  ecrire(premiere, couper(e.titre, gras, 13, D - G), { x: G, y, size: 13, font: gras, color: MARINE })
  premiere.drawLine({ start: { x: G, y: y - 7 }, end: { x: G + 54, y: y - 7 }, thickness: 2, color: OR })
  y -= 28

  // ---- Les articles -------------------------------------------------------
  const flux = new Flux(
    doc, normal,
    { cabinet: c.nom, numero: e.numero, suite: m.suite },
    premiere, y
  )
  const largeur = D - G

  if (e.articles.length === 0) {
    // Un contrat vide ne doit pas ressembler à un contrat court : il le dit.
    const vide = flux.place(14)
    ecrire(vide.page, m.aucunArticle, { x: G, y: vide.y, size: 9.5, font: normal, color: GRIS })
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
      const p = flux.place(13)
      ecrire(p.page, ligne, { x: G, y: p.y, size: 10, font: gras, color: MARINE })
    }
    flux.y -= 5
    for (const ligne of lignesCorps) {
      // Une ligne vide sépare deux alinéas : elle ne s'écrit pas, elle se
      // laisse.
      if (!ligne) { flux.place(6); continue }
      const p = flux.place(13)
      ecrire(p.page, ligne, { x: G, y: p.y, size: 9.5, font: normal, color: ENCRE })
    }
    flux.y -= 14
  }

  // ---- CE QUE LE CONSULTANT A PERSONNALISÉ ---------------------------------
  // Ces sections s'écrivent APRÈS les articles et AVANT les montants, parce
  // que c'est l'ordre de lecture d'un contrat : ce qui est convenu, puis ce
  // que cela coûte. Elles empruntent la typographie des articles — le §30
  // interdit d'en inventer une seconde.
  if ((e.servicesDescription ?? "").trim() || (e.servicesItems ?? []).length > 0) {
    flux.y -= 6
    titreSection(flux, m.servicesTitre, gras)
    if ((e.servicesDescription ?? "").trim()) {
      paragraphe(flux, e.servicesDescription!, normal, largeur)
      flux.y -= 8
    }
    for (const item of e.servicesItems ?? []) {
      // La numérotation est celle de la liste, pas celle du contrat : « 1. »
      // ici ne renvoie pas à l'article 1.
      const lignes = envelopper(`${item.position}. ${item.libelle}`, normal, 9.5, largeur - 14)
      for (const [i, ligne] of lignes.entries()) {
        const p = flux.place(13)
        ecrire(p.page, ligne, { x: i === 0 ? G : G + 14, y: p.y, size: 9.5, font: normal, color: ENCRE })
      }
    }
    flux.y -= 14
  }

  if ((e.echeancier ?? []).length > 0) {
    titreSection(flux, m.echeancierTitre, gras)
    flux.y -= 4
    tableauEcheancier(flux, e, m, argent, normal, gras, langue)
  }

  for (const [titre, texte] of [
    [m.modesTitre, (e.modesPaiement ?? []).join(" · ")],
    [m.conditionsTitre, e.conditionsPaiement ?? ""],
    [m.fraisTitre, e.fraisNonInclus ?? ""],
  ] as const) {
    if (!texte.trim()) continue
    titreSection(flux, titre, gras)
    paragraphe(flux, texte, normal, largeur)
    flux.y -= 14
  }

  // ---- Le tableau des honoraires ------------------------------------------
  // Pro bono excepté : une ligne « Total 0,00 $ » sous un contrat sans
  // contrepartie contredirait ses propres articles.
  if (!e.proBono) {
    const hauteurTableau = 22 * (e.montants.taxes > 0 ? 4 : 3)
    if (flux.y - hauteurTableau < BAS) flux.nouvellePage()
    flux.y -= tableauHonoraires(flux.page, G, flux.y, D - G, e, m, argent, normal, gras) + 22
  }

  // ---- Les signatures, en encadrés ----------------------------------------
  // Réservées d'un bloc : une ligne de signature coupée entre deux pages
  // laisserait signer sous le vide.
  //
  // ENCADRÉES plutôt qu'alignées sur un simple filet. Un contrat qu'on tend à
  // signer doit montrer OÙ signer sans qu'on le demande — et l'encadré porte
  // aussi le nom déjà imprimé, pour qu'aucune des deux parties ne signe à la
  // place de l'autre.
  if (flux.y - hauteurSignatures(e.signataires.length) < BAS) flux.nouvellePage()

  const entete = flux.place(20)
  ecrire(entete.page, m.signatures, { x: G, y: entete.y, size: 8, font: gras, color: GRIS })
  entete.page.drawLine({
    start: { x: G, y: entete.y - 6 }, end: { x: G + 40, y: entete.y - 6 }, thickness: 1.6, color: OR,
  })

  const largeurCase = (D - G - 18) / 2
  const colonnes = [G, G + largeurCase + 18]

  // LES POSITIONS SONT RETENUES AU MOMENT OÙ ON LES DESSINE. C'est le seul
  // instant où on les connaît : la page d'un encadré dépend de la longueur des
  // articles qui précèdent. Les recalculer plus tard reviendrait à réécrire la
  // mise en page, et à diverger d'elle au premier changement.
  const emplacements: EmplacementSignature[] = []

  for (let i = 0; i < e.signataires.length; i += 2) {
    const rangee = e.signataires.slice(i, i + 2)
    const HAUT_CASE = 68
    const { page: pageCase, y: yCase } = flux.place(HAUT_CASE + 8)
    const indexPage = flux.pages.indexOf(pageCase)
    rangee.forEach((s, j) => {
      const x = colonnes[j]
      pageCase.drawRectangle({
        x, y: yCase, width: largeurCase, height: HAUT_CASE,
        borderColor: TRAIT, borderWidth: 0.6,
      })

      const enTeteCase = s.permis ? m.pourLeConsultant : m.pourLeClient
      ecrire(pageCase, enTeteCase, { x: x + 10, y: yCase + HAUT_CASE - 15, size: 7.5, font: gras, color: MARINE })

      const role = m.roles[s.role] ?? m.roles.other
      // La mention réglementaire REMPLACE le rôle au lieu de s'y ajouter :
      // « Consultant · Consultant réglementé CRIC R1041776 » disait deux fois
      // le même mot sous une ligne de signature.
      const qualite = s.permis ? `${m.permisAbrege} ${s.permis}` : role
      ecrire(pageCase, couper(`${m.nomLabel} ${s.nom}`, gras, 9, largeurCase - 20), {
        x: x + 10, y: yCase + HAUT_CASE - 32, size: 9, font: gras, color: ENCRE,
      })
      ecrire(pageCase, couper(qualite, normal, 7.5, largeurCase - 20), {
        x: x + 10, y: yCase + HAUT_CASE - 43, size: 7.5, font: normal, color: GRIS,
      })

      // Signature et date sur la même ligne : c'est l'ordre dans lequel on
      // les remplit, et la date isolée sur sa propre ligne se saute.
      const yLigne = yCase + 14
      ecrire(pageCase, m.signatureLabel, { x: x + 10, y: yLigne, size: 7.5, font: normal, color: GRIS })
      const xTrait = x + 10 + normal.widthOfTextAtSize(m.signatureLabel, 7.5) + 4
      const xDate = x + largeurCase - 78
      pageCase.drawLine({
        start: { x: xTrait, y: yLigne - 3 }, end: { x: xDate - 8, y: yLigne - 3 },
        thickness: 0.5, color: ENCRE,
      })
      ecrire(pageCase, m.dateLabel, { x: xDate, y: yLigne, size: 7.5, font: normal, color: GRIS })
      const xDateTrait = xDate + normal.widthOfTextAtSize(m.dateLabel, 7.5) + 4
      pageCase.drawLine({
        start: { x: xDateTrait, y: yLigne - 3 },
        end: { x: x + largeurCase - 10, y: yLigne - 3 },
        thickness: 0.5, color: ENCRE,
      })

      emplacements.push({
        role: s.role,
        nom: s.nom,
        permis: s.permis || undefined,
        page: indexPage,
        boite: { x, y: yCase, largeur: largeurCase, hauteur: HAUT_CASE },
        // Les deux lignes que le contrat laisse VIDES : c'est exactement là
        // qu'une signature manuscrite se poserait.
        signature: { x: xTrait, y: yLigne - 3, largeur: xDate - 8 - xTrait },
        date: { x: xDateTrait, y: yLigne - 3, largeur: x + largeurCase - 10 - xDateTrait },
      })
    })
  }

  // ---- Pied de page et filigrane, en dernier ------------------------------
  // La pagination ne peut s'écrire qu'ICI : « Page 2 sur 4 » suppose de savoir
  // qu'il y en a quatre, et on ne le sait qu'une fois le texte posé.
  const total = flux.pages.length
  flux.pages.forEach((page, i) => {
    piedContrat(page, m, e.numero, i + 1, total, normal, gras)
    if (e.statut === "draft") filigrane(page, m.brouillon, gras, 48, 150)
  })

  return { octets: await doc.save(), emplacements }
}
