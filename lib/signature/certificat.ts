import "server-only"

import { PDFDocument, StandardFonts, type PDFPage, type PDFFont } from "pdf-lib"
import {
  ENCRE, GRIS, TRAIT, LARGEUR, HAUTEUR, G, D,
  ecrire, couper, envelopper, droite, centre,
} from "@/lib/pdf/primitives"
import { libelleRole } from "./statuts"
import {
  horodatage, dateSignature, heureSignature, abreviationFuseau, FUSEAU_LISIBLE,
} from "./horodatage"

/**
 * Le certificat de signature, et le document final.
 *
 * ─── CE QU'ON PRODUIT, ET POURQUOI PAS AUTRE CHOSE ─────────────────────────
 *
 * Un NOUVEAU PDF : les pages d'origine, portant les tracés aux emplacements
 * que le contrat prévoit, suivies d'une page de certificat.
 *
 *   1. LE TRACÉ NE PROUVE RIEN À LUI SEUL, et c'est pourquoi il ne vient
 *      jamais seul. Une image collée sur un PDF s'imite ; ce qui fait preuve
 *      est l'empreinte du fichier signé, imprimée au certificat avec
 *      l'horodatage et l'adresse d'origine. Le tracé rend le contrat lisible
 *      comme un contrat signé — la preuve, elle, est derrière.
 *   2. LE FICHIER D'ORIGINE N'EST PAS RÉÉCRIT. Ses pages sont recopiées telles
 *      quelles et l'on dessine par-dessus : le texte reproduit est exactement
 *      celui qui a été présenté, et son empreinte le démontre.
 *   3. Un tiers — IRCC, un employeur, un confrère — reçoit une pièce qui DIT
 *      ce qu'elle est : qui a signé, quand, depuis où, et sur quelle empreinte.
 *
 * ─── LES EMPLACEMENTS NE SONT PAS DEVINÉS ──────────────────────────────────
 *
 * Ils viennent du générateur de contrat, qui les a mesurés en dessinant les
 * encadrés, et transitent par `signature_fields`. Un document sans encadré
 * connu — un PDF téléversé — reçoit son certificat sans tracé apposé plutôt
 * qu'une signature posée au jugé.
 *
 * ─── L'EMPREINTE DE L'ORIGINAL EST IMPRIMÉE ────────────────────────────────
 *
 * C'est le cœur de la preuve. Le certificat porte le SHA-256 du document
 * signé : quiconque détient le fichier d'origine peut le recalculer et
 * constater qu'il s'agit du même. Sans ce nombre, le certificat ne serait
 * qu'une déclaration.
 *
 * ─── AUCUN SECOND MOTEUR ───────────────────────────────────────────────────
 *
 * Les primitives partagées — en-tête, translittération WinAnsi, échelle
 * typographique — sont celles de la facture, du reçu, de l'état de fiducie et
 * du contrat. Un cabinet qui remet cinq pièces au même inspecteur ne doit pas
 * avoir l'air d'en avoir cinq origines.
 */

const MOTS = {
  titre: "CERTIFICAT DE SIGNATURE",
  document: "DOCUMENT",
  reference: "RÉFÉRENCE DE LA TRANSACTION",
  empreinte: "EMPREINTE DU DOCUMENT SIGNÉ (SHA-256)",
  signataires: "SIGNATAIRES",
  colNom: "Signataire",
  colRole: "Rôle",
  colDate: "Signé le",
  colOrigine: "Origine",
  evenements: "JOURNAL DES ÉVÉNEMENTS",
  colEvenement: "Événement",
  colQuand: "Horodatage",
  colQui: "Auteur",
  mention1: "Ce certificat atteste des signatures apposées par voie électronique sur le document",
  mention2: "reproduit aux pages précédentes. L'empreinte ci-dessus permet de vérifier que ce",
  mention3: "document est bien celui qui a été signé : la recalculer sur le fichier d'origine doit",
  mention4: "rendre exactement la même valeur.",
  aucunEvenement: "Aucun événement consigné.",
  page: (n: number, sur: number) => `Certificat · page ${n} sur ${sur}`,
}

export interface SignataireCertificat {
  nom: string
  courriel: string
  role: string
  permis?: string | null
  signeLe: string
  ip?: string | null
  /** Le tracé, en data: URI. Facultatif. */
  trace?: string | null
}

export interface EvenementCertificat {
  libelle: string
  survenuLe: string
  acteur: string
}

/**
 * Un tracé à poser DANS le contrat, à l'emplacement qu'il prévoit.
 *
 * Les coordonnées viennent de `signature_fields`, qui les tient du générateur
 * de contrat. Aucune n'est devinée ici : un emplacement absent signifie que le
 * document n'a pas d'encadré connu, et rien n'est apposé.
 */
export interface AppositionSignature {
  nom: string
  signeLe: string
  /** Le tracé, en data: URI PNG. Sans lui, on écrit tout de même la date. */
  trace?: string | null
  /** Index de page, à partir de 0. */
  page: number
  signature: { x: number; y: number; largeur: number; hauteur: number } | null
  date: { x: number; y: number; largeur: number } | null
}

export interface DonneesCertificat {
  documentNom: string
  reference: string
  empreinte: string
  cabinetNom: string
  cabinetPermis: string
  signataires: SignataireCertificat[]
  evenements: EvenementCertificat[]
  /** Ce qu'on pose sur le contrat lui-même. Vide : certificat seul. */
  apposer?: AppositionSignature[]
}

/**
 * Pose les tracés et les dates dans les encadrés du contrat.
 *
 * ─── CE QU'ON ÉCRIT, ET CE QU'ON NE TOUCHE PAS ─────────────────────────────
 *
 * DEUX LIGNES, celles que le contrat laisse vides : le filet de signature et
 * le filet de date. Le nom est déjà imprimé dans l'encadré par le générateur —
 * le réécrire le doublerait.
 *
 * Aucun contenu d'origine n'est effacé ni recomposé. On dessine PAR-DESSUS des
 * pages recopiées telles quelles, ce qui garantit que le texte signé est bien
 * celui qui a été présenté.
 *
 * ─── RIEN N'EST INVENTÉ ────────────────────────────────────────────────────
 *
 * Une page hors bornes, un emplacement absent, un tracé illisible : on passe.
 * Un contrat sans tracé accompagné d'un certificat qui prouve la signature
 * vaut mieux qu'un tracé posé au hasard sur une page.
 */
async function apposerSurLeContrat(
  doc: PDFDocument,
  pages: PDFPage[],
  apposer: AppositionSignature[],
  normal: PDFFont
): Promise<void> {
  for (const a of apposer) {
    const page = pages[a.page]
    if (!page) continue

    // ── Le tracé ─────────────────────────────────────────────────────────
    if (a.signature && a.trace?.startsWith("data:image/png")) {
      try {
        const octets = Buffer.from(a.trace.split(",")[1] ?? "", "base64")
        const image = await doc.embedPng(octets)

        // À L'ÉCHELLE, ET DANS LA BOÎTE. Un tracé large déborderait sur la
        // colonne voisine — c'est-à-dire sur l'encadré de l'autre partie.
        const hMax = a.signature.hauteur
        const lMax = a.signature.largeur
        const facteur = Math.min(lMax / image.width, hMax / image.height)
        const l = image.width * facteur
        const h = image.height * facteur

        page.drawImage(image, {
          // Posé SUR le filet, légèrement au-dessus : une signature manuscrite
          // repose sur la ligne, elle ne flotte pas et ne la traverse pas.
          x: a.signature.x + 2,
          y: a.signature.y + 1.5,
          width: l,
          height: h,
        })
      } catch {
        // Un tracé illisible n'invalide pas la signature : la preuve est
        // l'empreinte, imprimée au certificat. On laisse la ligne vide.
        console.error("apposerSurLeContrat : tracé illisible pour", a.nom)
      }
    }

    // ── La date, celle du signataire ─────────────────────────────────────
    // Pas la date du contrat : deux parties signent rarement le même jour, et
    // c'est précisément l'écart qu'un tiers voudra lire.
    if (a.date && a.signeLe) {
      // SEPT POINTS ET DEMI, pour que « 12 août 2026 » entre en entier. À huit,
      // la ligne réservée par le contrat est trop courte de deux points et la
      // date sortait tronquée : « 12 août 2… ». Une date coupée sur un contrat
      // est pire qu'une date absente — elle a l'air d'une date.
      const TAILLE = 7.5
      const texte = dateSignature(a.signeLe)
      const largeur = normal.widthOfTextAtSize(texte, TAILLE)
      ecrire(page, largeur <= a.date.largeur ? texte : couper(texte, normal, TAILLE, a.date.largeur), {
        x: a.date.x + 2, y: a.date.y + 3, size: TAILLE, font: normal, color: ENCRE,
      })
    }
  }
}

/**
 * Compose le document final : l'original, puis le certificat.
 *
 * `octetsOriginal` est le PDF signé, tel qu'il a été déposé. Il est recopié
 * page à page sans être touché — c'est ce qui permet d'affirmer que le
 * document reproduit est bien celui dont l'empreinte figure au certificat.
 */
export async function documentAvecCertificat(
  octetsOriginal: Uint8Array,
  d: DonneesCertificat
): Promise<Uint8Array> {
  const sortie = await PDFDocument.create()

  // ── Les pages d'origine ────────────────────────────────────────────────
  const pagesOrigine: PDFPage[] = []
  try {
    const original = await PDFDocument.load(octetsOriginal)
    const pages = await sortie.copyPages(original, original.getPageIndices())
    for (const p of pages) { sortie.addPage(p); pagesOrigine.push(p) }
  } catch {
    // Un original illisible ne doit pas empêcher de produire le certificat :
    // la preuve des signatures existe indépendamment du fichier, et un
    // certificat seul vaut mieux que rien. L'anomalie se verra — le document
    // final n'aura qu'une page.
    console.error("documentAvecCertificat : original illisible, certificat seul.")
  }

  const normal = await sortie.embedFont(StandardFonts.Helvetica)
  const gras = await sortie.embedFont(StandardFonts.HelveticaBold)

  // ── Les signatures, DANS le contrat ────────────────────────────────────
  // Sur les pages recopiées, aux encadrés que le contrat prévoit déjà. Le
  // texte d'origine n'est pas réécrit : on remplit deux lignes laissées
  // vides, exactement comme une signature manuscrite les remplirait.
  await apposerSurLeContrat(sortie, pagesOrigine, d.apposer ?? [], normal)

  let page = sortie.addPage([LARGEUR, HAUTEUR])
  let y = 780
  const pagesCertificat = [page]

  const place = (hauteur: number) => {
    if (y - hauteur < 70) {
      page = sortie.addPage([LARGEUR, HAUTEUR])
      pagesCertificat.push(page)
      y = 780
    }
    y -= hauteur
    return y
  }

  // ── En-tête ────────────────────────────────────────────────────────────
  // LE TITRE MESURE SA PROPRE LARGEUR. Une première version le posait à 22
  // points et laissait 260 points au cabinet : les deux se chevauchaient, le
  // nom du cabinet s'imprimant PAR-DESSUS le mot « SIGNATURE ». Vu en
  // regardant le PDF produit — ni le compilateur ni l'épreuve de texte ne
  // peuvent voir un chevauchement.
  const TAILLE_TITRE = 20
  ecrire(page, MOTS.titre, { x: G, y, size: TAILLE_TITRE, font: gras, color: ENCRE })
  const finTitre = G + gras.widthOfTextAtSize(MOTS.titre, TAILLE_TITRE)
  const largeurCabinet = Math.max(120, D - finTitre - 20)
  y -= 18
  droite(page, couper(d.cabinetNom, normal, 9, largeurCabinet), D, y + 18, normal, 9, GRIS)
  if (d.cabinetPermis) {
    droite(page, `CRIC ${d.cabinetPermis}`, D, y + 7, normal, 8.5, GRIS)
  }
  page.drawLine({ start: { x: G, y }, end: { x: D, y }, thickness: 1.6, color: ENCRE })
  y -= 26

  const bloc = (etiquette: string, valeur: string, taille = 10) => {
    ecrire(page, etiquette, { x: G, y: place(13), size: 7.5, font: gras, color: GRIS })
    for (const ligne of envelopper(valeur, normal, taille, D - G)) {
      ecrire(page, ligne, { x: G, y: place(taille + 4), size: taille, font: normal, color: ENCRE })
    }
    y -= 8
  }

  bloc(MOTS.document, d.documentNom, 11)
  bloc(MOTS.reference, d.reference, 9.5)
  // L'empreinte en petit et sur deux lignes au besoin : soixante-quatre
  // caractères ne tiennent pas sur une ligne à une taille lisible, et la
  // couper au milieu la rendrait impossible à recopier.
  bloc(MOTS.empreinte, d.empreinte, 8.5)

  // ── Les signataires ────────────────────────────────────────────────────
  y -= 6
  ecrire(page, MOTS.signataires, { x: G, y: place(16), size: 9, font: gras, color: ENCRE })
  // LE FUSEAU EST NOMMÉ UNE FOIS, ICI. Sans lui, « 22:14 » n'est qu'un nombre :
  // un lecteur à Vancouver ou à Paris ne peut pas savoir ce qu'il désigne.
  droite(page, `Horodatage : ${FUSEAU_LISIBLE}`, D, y + 16, normal, 7.5, GRIS)
  y -= 4

  for (const [i, s] of d.signataires.entries()) {
    // Chaque signataire occupe un bloc solidaire : le couper entre deux pages
    // séparerait un nom de sa date.
    if (y - 74 < 70) { page = sortie.addPage([LARGEUR, HAUTEUR]); pagesCertificat.push(page); y = 780 }

    const haut = place(70)
    page.drawRectangle({
      x: G, y: haut, width: D - G, height: 66,
      borderColor: TRAIT, borderWidth: 0.6,
    })

    ecrire(page, `${i + 1}. ${s.nom}`, { x: G + 12, y: haut + 46, size: 11, font: gras, color: ENCRE })
    ecrire(page, couper(s.courriel, normal, 8.5, 260), {
      x: G + 12, y: haut + 33, size: 8.5, font: normal, color: GRIS,
    })
    // Le rôle est TRADUIT : « consultant » imprimé tel quel sur une pièce
    // remise à un tiers ferait amateur, et « co_applicant » serait illisible.
    const sousTitre = [libelleRole(s.role), s.permis ? `CRIC ${s.permis}` : ""]
      .filter(Boolean).join(" · ")
    ecrire(page, sousTitre, { x: G + 12, y: haut + 20, size: 8.5, font: normal, color: GRIS })
    // L'HEURE ET LE FUSEAU, pas seulement la date. « Signé le 12 août » ne
    // départage pas deux versions ; « 22:14 HAE » oui.
    const quand = `${MOTS.colDate} ${dateSignature(s.signeLe)} à ${heureSignature(s.signeLe)} ` +
      `${abreviationFuseau(s.signeLe)}${s.ip ? ` · ${s.ip}` : ""}`
    ecrire(page, couper(quand, normal, 8, D - G - 24), {
      x: G + 12, y: haut + 7, size: 8, font: normal, color: GRIS,
    })

    // Le tracé, à titre illustratif. Ce qui fait preuve reste l'empreinte.
    if (s.trace?.startsWith("data:image/png")) {
      try {
        const octets = Buffer.from(s.trace.split(",")[1] ?? "", "base64")
        const image = await sortie.embedPng(octets)
        const h = 40
        const l = Math.min((image.width / image.height) * h, 150)
        page.drawImage(image, { x: D - l - 14, y: haut + 14, width: l, height: h })
      } catch {
        // Un tracé illisible n'invalide rien : on l'omet.
      }
    }
    y -= 6
  }

  // ── Le journal ─────────────────────────────────────────────────────────
  y -= 10
  ecrire(page, MOTS.evenements, { x: G, y: place(16), size: 9, font: gras, color: ENCRE })
  y -= 2

  const xQuand = D - 10
  const xQui = D - 130
  ecrire(page, MOTS.colEvenement, { x: G, y: place(13), size: 7.5, font: gras, color: GRIS })
  droite(page, MOTS.colQui, xQui, y, gras, 7.5, GRIS)
  droite(page, MOTS.colQuand, xQuand, y, gras, 7.5, GRIS)
  page.drawLine({ start: { x: G, y: y - 4 }, end: { x: D, y: y - 4 }, thickness: 0.5, color: TRAIT })
  y -= 6

  if (d.evenements.length === 0) {
    ecrire(page, MOTS.aucunEvenement, { x: G, y: place(13), size: 8.5, font: normal, color: GRIS })
  }

  for (const e of d.evenements) {
    const yl = place(13)
    ecrire(page, couper(e.libelle, normal, 8.5, 220), { x: G, y: yl, size: 8.5, font: normal, color: ENCRE })
    droite(page, couper(e.acteur, normal, 8, 110), xQui, yl, normal, 8, GRIS)
    droite(page, horodatage(e.survenuLe), xQuand, yl, normal, 8, GRIS)
  }

  // ── La mention ─────────────────────────────────────────────────────────
  y -= 14
  for (const ligne of [MOTS.mention1, MOTS.mention2, MOTS.mention3, MOTS.mention4]) {
    ecrire(page, ligne, { x: G, y: place(11), size: 8, font: normal, color: GRIS })
  }

  // La pagination du certificat ne compte QUE ses propres pages : « page 1
  // sur 2 » au milieu d'un contrat de sept pages ferait croire à un document
  // tronqué.
  pagesCertificat.forEach((p, i) => {
    centre(p, MOTS.page(i + 1, pagesCertificat.length), LARGEUR / 2, 40, normal, 8, GRIS)
  })

  return sortie.save()
}
