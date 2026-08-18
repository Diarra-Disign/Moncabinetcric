import "server-only"

import { PDFDocument, StandardFonts, type PDFPage, type PDFFont } from "pdf-lib"
import {
  ENCRE, GRIS, TRAIT, LARGEUR, HAUTEUR, G, D, MARINE, OR, VOILE, BLANC,
  ecrire, couper, droite, centre,
  enTeteOfficiel, panneauPartie, piedOfficiel, filigrane, PALE,
  type LanguePdf, type CabinetPdf,
} from "@/lib/pdf/primitives"
import type { MeetingNote } from "@/lib/data/types"

export type { LanguePdf, CabinetPdf }

const TYPE_LABELS: Record<string, string> = {
  consultation: "Consultation officielle",
  appointment: "Rendez-vous en cabinet",
  in_person: "Rencontre en personne",
  phone: "Entretien téléphonique",
  videoconference: "Visioconférence",
  google_meet: "Google Meet",
  zoom: "Zoom",
  whatsapp: "WhatsApp / Appel vidéo",
  email_exchange: "Échange courriel",
  other: "Autre modalité",
}

const REASON_LABELS: Record<string, string> = {
  consultation_initiale: "Consultation initiale",
  suivi_dossier: "Suivi de dossier",
  verification_documents: "Vérification des documents",
  preparation_demande: "Préparation d'une demande",
  signature_document: "Signature de documents",
  explication_procedure: "Explication de procédure",
  mise_a_jour: "Mise à jour du dossier",
  demande_info: "Demande d'information",
  autre: "Autre motif",
}

export interface MeetingNotePdfData {
  note: MeetingNote
  clientName: string
  clientEmail?: string
  clientPhone?: string
  matterReference: string
  programName?: string
  consultantName: string
  consultantLicence: string
  langue?: LanguePdf
}

/**
 * Génération du COMPTE RENDU OFFICIEL DE RENCONTRE (PDF vectoriel haute fidélité).
 */
export async function compteRenduRencontrePdf(
  data: MeetingNotePdfData,
  c: CabinetPdf
): Promise<Uint8Array> {
  const langue: LanguePdf = data.langue ?? "fr"
  const doc = await PDFDocument.create()
  const normal = await doc.embedFont(StandardFonts.Helvetica)
  const gras = await doc.embedFont(StandardFonts.HelveticaBold)

  const pages: PDFPage[] = []
  let page = doc.addPage([LARGEUR, HAUTEUR])
  pages.push(page)

  const n = data.note
  const typeLibelle = n.meetingType === "other" && n.meetingTypeOther
    ? n.meetingTypeOther
    : TYPE_LABELS[n.meetingType] ?? n.meetingType

  const motifLibelle = n.reason === "autre" && n.reasonOther
    ? n.reasonOther
    : REASON_LABELS[n.reason] ?? n.reason

  // 1. En-tête officiel
  const reperes = [
    { label: "RÉFÉRENCE NOTE", valeur: n.reference },
    { label: "DATE DE RENCONTRE", valeur: `${n.meetingDate}${n.meetingTime ? ` à ${n.meetingTime}` : ""}` },
    { label: "TYPE & DURÉE", valeur: `${typeLibelle} (${n.durationMinutes} min)` },
    { label: "DOSSIER", valeur: data.matterReference || "—" },
  ]

  let y = await enTeteOfficiel(
    doc,
    page,
    c,
    normal,
    gras,
    { surTitre: "COMPTE RENDU DE RENCONTRE", sousTitre: "REGISTRE OFFICIEL CICC" },
    "Permis CRIC",
    reperes
  )

  const largeurTableau = D - G

  // 2. Panneau Client & Panneau Séance
  const largDemi = (largeurTableau - 12) / 2
  const lignesClient = [
    { texte: data.clientName, taille: 10, gras: true, couleur: ENCRE },
    { texte: data.clientEmail ? `Courriel : ${data.clientEmail}` : "", taille: 8.5, gras: false, couleur: GRIS },
    { texte: data.clientPhone ? `Téléphone : ${data.clientPhone}` : "", taille: 8.5, gras: false, couleur: GRIS },
    { texte: data.programName ? `Programme : ${data.programName}` : "", taille: 8.5, gras: false, couleur: GRIS },
  ]
  const hPanneau = panneauPartie(page, G, y, largDemi, "CLIENT PARTICIPANT", lignesClient, normal, gras)

  const xSeance = G + largDemi + 12
  page.drawRectangle({
    x: xSeance, y: y - hPanneau, width: largDemi, height: hPanneau, color: VOILE,
    borderColor: TRAIT, borderWidth: 0.5,
  })
  page.drawRectangle({
    x: xSeance, y: y - hPanneau, width: 3, height: hPanneau, color: OR,
  })

  ecrire(page, "MODALITÉS DE LA SÉANCE", { x: xSeance + 12, y: y - 16, size: 8, font: gras, color: GRIS })
  ecrire(page, `Motif : ${motifLibelle}`, { x: xSeance + 12, y: y - 30, size: 9, font: gras, color: MARINE })
  ecrire(page, `Consultant : ${n.createdByName || data.consultantName}`, { x: xSeance + 12, y: y - 44, size: 8.5, font: normal, color: ENCRE })
  ecrire(page, `Statut : ${n.status === "finalized" ? "Officiel / Finalisé" : "Brouillon"} · ${n.visibility === "shared_client" ? "Partagé au client" : "Interne cabinet"}`, { x: xSeance + 12, y: y - 56, size: 8, font: normal, color: GRIS })

  y -= hPanneau + 18

  // 3. Encadré Objet / Sujet
  const hSujet = 34
  page.drawRectangle({
    x: G, y: y - hSujet, width: largeurTableau, height: hSujet, color: VOILE,
    borderColor: TRAIT, borderWidth: 0.5,
  })
  page.drawRectangle({
    x: G, y: y - hSujet, width: 3, height: hSujet, color: MARINE,
  })
  ecrire(page, "OBJET / SUJET DE LA RENCONTRE", { x: G + 12, y: y - 13, size: 7.5, font: gras, color: GRIS })
  ecrire(page, couper(n.subject, gras, 9.5, largeurTableau - 24), { x: G + 12, y: y - 25, size: 9.5, font: gras, color: ENCRE })

  y -= hSujet + 16

  // Helper pour sauter de page si besoin
  const BAS_PAGE = 85
  const verifierSautPage = (hauteurRequise: number) => {
    if (y - hauteurRequise < BAS_PAGE) {
      page = doc.addPage([LARGEUR, HAUTEUR])
      pages.push(page)
      y = 780
      ecrire(page, `${c.nom}  ·  ${n.reference} — Compte rendu de rencontre (${n.meetingDate})`, { x: G, y: 792, size: 8, font: normal, color: GRIS })
      page.drawLine({ start: { x: G, y: 784 }, end: { x: G + 40, y: 784 }, thickness: 1.6, color: OR })
      page.drawLine({ start: { x: G + 40, y: 784 }, end: { x: D, y: 784 }, thickness: 0.5, color: TRAIT })
      y = 760
    }
  }

  // 4. Section Compte Rendu Général / Notes
  page.drawRectangle({ x: G, y: y - 18, width: largeurTableau, height: 18, color: MARINE })
  ecrire(page, "COMPTE RENDU & NOTES DE LA SÉANCE", { x: G + 10, y: y - 12.5, size: 8, font: gras, color: BLANC })
  y -= 18

  // Découpage des lignes du compte rendu
  const paragraphes = n.content.split("\n")
  for (const para of paragraphes) {
    if (!para.trim()) {
      y -= 6
      continue
    }
    const mots = para.split(" ")
    let ligneCourante = ""
    for (const mot of mots) {
      const test = ligneCourante ? `${ligneCourante} ${mot}` : mot
      if (normal.widthOfTextAtSize(test, 9) > largeurTableau - 20) {
        verifierSautPage(14)
        ecrire(page, ligneCourante, { x: G + 10, y: y - 10, size: 9, font: normal, color: ENCRE })
        y -= 13
        ligneCourante = mot
      } else {
        ligneCourante = test
      }
    }
    if (ligneCourante) {
      verifierSautPage(14)
      ecrire(page, ligneCourante, { x: G + 10, y: y - 10, size: 9, font: normal, color: ENCRE })
      y -= 13
    }
  }

  y -= 10

  // 5. Sections structurées spécifiques (si renseignées)
  const sectionsCles: [string, string | undefined][] = [
    ["INFORMATIONS DISCUTÉES", n.sections?.discussedInfo],
    ["ANALYSE & OBSERVATIONS", n.sections?.observations],
    ["DÉCISIONS PRISES", n.sections?.decisions],
    ["DOCUMENTS DEMANDÉS", n.sections?.requestedDocs],
    ["ACTIONS À EFFECTUER & PROCHAINES ÉTAPES", n.sections?.actionItems || n.sections?.nextSteps],
  ]

  for (const [titreSec, texteSec] of sectionsCles) {
    if (!texteSec?.trim()) continue
    verifierSautPage(40)

    page.drawRectangle({ x: G, y: y - 16, width: largeurTableau, height: 16, color: VOILE, borderColor: TRAIT, borderWidth: 0.5 })
    ecrire(page, titreSec, { x: G + 8, y: y - 11.5, size: 7.5, font: gras, color: MARINE })
    y -= 16

    const lignesSec = texteSec.split("\n")
    for (const l of lignesSec) {
      if (!l.trim()) continue
      verifierSautPage(14)
      ecrire(page, couper(l, normal, 8.5, largeurTableau - 20), { x: G + 10, y: y - 10, size: 8.5, font: normal, color: ENCRE })
      y -= 12
    }
    y -= 6
  }

  // 6. Prochain rendez-vous convenu (si renseigné)
  if (n.nextMeetingDate || n.sections?.nextFollowupDate) {
    verifierSautPage(45)
    const hNext = 38
    page.drawRectangle({ x: G, y: y - hNext, width: largeurTableau, height: hNext, color: VOILE, borderColor: TRAIT, borderWidth: 0.5 })
    page.drawRectangle({ x: G, y: y - hNext, width: 3, height: hNext, color: OR })
    ecrire(page, "PROCHAIN SUIVI / RENDEZ-VOUS CONVENU", { x: G + 12, y: y - 14, size: 7.5, font: gras, color: GRIS })
    const infoDate = n.nextMeetingDate
      ? `${n.nextMeetingDate}${n.nextMeetingTime ? ` à ${n.nextMeetingTime}` : ""}${n.nextMeetingReason ? ` — Motif : ${n.nextMeetingReason}` : ""}`
      : `Date de suivi cible : ${n.sections?.nextFollowupDate}`
    ecrire(page, couper(infoDate, gras, 9, largeurTableau - 24), { x: G + 12, y: y - 27, size: 9, font: gras, color: MARINE })
    y -= hNext + 12
  }

  // 7. Documents associés rattachés
  if (n.documents && n.documents.length > 0) {
    verifierSautPage(30 + n.documents.length * 12)
    ecrire(page, "DOCUMENTS ASSOCIÉS AU COMPTE RENDU", { x: G, y: y - 8, size: 7.5, font: gras, color: GRIS })
    y -= 12
    for (const d of n.documents) {
      ecrire(page, `• ${d.name} (${d.category})`, { x: G + 10, y: y - 8, size: 8, font: normal, color: ENCRE })
      y -= 11
    }
    y -= 6
  }

  // 8. Bloc de visa / signature
  verifierSautPage(60)
  y -= 8
  page.drawLine({ start: { x: G, y }, end: { x: D, y }, thickness: 0.5, color: TRAIT })
  y -= 15

  const largColSign = (largeurTableau - 20) / 2
  // Consultant
  ecrire(page, "VISÉ PAR LE CONSULTANT TITULAIRE", { x: G, y, size: 7.5, font: gras, color: GRIS })
  ecrire(page, data.consultantName || c.nom, { x: G, y: y - 12, size: 9, font: gras, color: ENCRE })
  ecrire(page, `Permis CRIC : ${data.consultantLicence || c.numeroPermis}`, { x: G, y: y - 22, size: 8, font: normal, color: GRIS })
  ecrire(page, `Enregistré le : ${new Date(n.createdAt).toLocaleDateString("fr-CA")}`, { x: G, y: y - 32, size: 7.5, font: normal, color: GRIS })

  // Client
  const xCol2 = G + largColSign + 20
  ecrire(page, "CLIENT DU DOSSIER", { x: xCol2, y, size: 7.5, font: gras, color: GRIS })
  ecrire(page, data.clientName, { x: xCol2, y: y - 12, size: 9, font: gras, color: ENCRE })
  ecrire(page, data.matterReference, { x: xCol2, y: y - 22, size: 8, font: normal, color: GRIS })
  ecrire(page, `Dossier CICC : ${c.nom}`, { x: xCol2, y: y - 32, size: 7.5, font: normal, color: GRIS })

  // 9. Pieds de page sur toutes les pages
  pages.forEach((p, idx) => {
    piedOfficiel(p, n.reference, c.nom, idx + 1, pages.length, normal, gras)
  })

  if (n.status === "draft") {
    pages.forEach((p) => filigrane(p, "BROUILLON", gras))
  }

  return doc.save()
}
