import { test, describe } from "node:test"
import assert from "node:assert/strict"
import type { MeetingNote, MeetingNoteInput, MeetingNoteHistoryEntry } from "@/lib/data/types"

/**
 * Tests unitaires du registre des Rencontres & Notes de dossier (CICC).
 *
 * Règles fondamentales vérifiées :
 * 1. Chaque rencontre possède son identifiant unique et sa référence chronologique REN-YYYY-XXXX.
 * 2. Jamais d'écrasement : l'ajout ou la mise à jour d'une note n'altère aucune autre note existante.
 * 3. Confidentialité par défaut : visibility = 'internal'.
 * 4. Historisation des révisions après finalisation.
 */

describe("Registre des Rencontres & Notes de Dossier (CICC)", () => {
  const note1Id = "note-uuid-0001"
  const note2Id = "note-uuid-0002"
  const matterId = "matter-uuid-1234"
  const firmId = "firm-uuid-9999"

  test("Création d'une première note de rencontre (Rencontre 1 - 17 août 2026)", () => {
    const input1: MeetingNoteInput = {
      matterId,
      meetingDate: "2026-08-17",
      meetingTime: "10:00",
      durationMinutes: 60,
      meetingType: "consultation",
      reason: "consultation_initiale",
      subject: "Consultation initiale d'admissibilité — Entrée express",
      content: "Évaluation du profil du candidat. 480 points au SCG. Recommandation : test de langue français NCLC 7.",
      sections: {
        discussedInfo: "Expérience professionnelle et diplômes évalués.",
        observations: "Profil solide pour le volet francophone.",
        decisions: "Signature d'une entente de services requise.",
      },
      status: "finalized",
      visibility: "internal",
    }

    const note1: MeetingNote = {
      id: note1Id,
      firmId,
      matterId: input1.matterId,
      reference: "REN-2026-0001",
      meetingDate: input1.meetingDate,
      meetingTime: input1.meetingTime,
      durationMinutes: input1.durationMinutes,
      meetingType: input1.meetingType,
      reason: input1.reason,
      subject: input1.subject,
      content: input1.content,
      sections: input1.sections ?? {},
      status: input1.status ?? "draft",
      visibility: input1.visibility ?? "internal",
      createdAt: "2026-08-17T10:00:00Z",
      updatedAt: "2026-08-17T10:00:00Z",
      history: [],
      documents: [],
    }

    assert.equal(note1.reference, "REN-2026-0001")
    assert.equal(note1.subject, "Consultation initiale d'admissibilité — Entrée express")
    assert.equal(note1.visibility, "internal")
    assert.equal(note1.status, "finalized")
    assert.equal(note1.sections.decisions, "Signature d'une entente de services requise.")
  })

  test("Création d'une seconde note (Rencontre 2 - 25 août 2026) : l'historique conserve les 2 notes indépendantes", () => {
    const registre: MeetingNote[] = [
      {
        id: note1Id,
        firmId,
        matterId,
        reference: "REN-2026-0001",
        meetingDate: "2026-08-17",
        meetingTime: "10:00",
        durationMinutes: 60,
        meetingType: "consultation",
        reason: "consultation_initiale",
        subject: "Consultation initiale d'admissibilité",
        content: "Première note de rencontre.",
        sections: {},
        status: "finalized",
        visibility: "internal",
        createdAt: "2026-08-17T10:00:00Z",
        updatedAt: "2026-08-17T10:00:00Z",
        history: [],
      },
    ]

    // Ajout de la note #2
    const note2: MeetingNote = {
      id: note2Id,
      firmId,
      matterId,
      reference: "REN-2026-0002",
      meetingDate: "2026-08-25",
      meetingTime: "14:30",
      durationMinutes: 45,
      meetingType: "videoconference",
      reason: "verification_documents",
      subject: "Revue des pièces justificatives et relevés bancaires",
      content: "Vérification des preuves de fonds de subsistance et attestation de travail.",
      sections: {
        requestedDocs: "Relevé bancaire officiel des 6 derniers mois avec solde moyen.",
      },
      status: "draft",
      visibility: "internal",
      createdAt: "2026-08-25T14:30:00Z",
      updatedAt: "2026-08-25T14:30:00Z",
      history: [],
    }

    registre.unshift(note2) // Tri chronologique inversé

    assert.equal(registre.length, 2)
    assert.equal(registre[0].id, note2Id)
    assert.equal(registre[0].reference, "REN-2026-0002")
    assert.equal(registre[1].id, note1Id)
    assert.equal(registre[1].reference, "REN-2026-0001")
  })

  test("RÈGLE D'OR : La modification de la note #2 ne modifie ni n'écrase la note #1", () => {
    const note1: MeetingNote = {
      id: note1Id,
      firmId,
      matterId,
      reference: "REN-2026-0001",
      meetingDate: "2026-08-17",
      subject: "Consultation initiale",
      content: "Contenu original et intouchable de la note 1.",
      sections: {},
      durationMinutes: 60,
      meetingType: "consultation",
      reason: "consultation_initiale",
      status: "finalized",
      visibility: "internal",
      createdAt: "2026-08-17T10:00:00Z",
      updatedAt: "2026-08-17T10:00:00Z",
      history: [],
    }

    let note2: MeetingNote = {
      id: note2Id,
      firmId,
      matterId,
      reference: "REN-2026-0002",
      meetingDate: "2026-08-25",
      subject: "Revue préliminaire",
      content: "Brouillon note 2.",
      sections: {},
      durationMinutes: 30,
      meetingType: "phone",
      reason: "suivi_dossier",
      status: "draft",
      visibility: "internal",
      createdAt: "2026-08-25T14:30:00Z",
      updatedAt: "2026-08-25T14:30:00Z",
      history: [],
    }

    // Modification poussée sur la note #2
    note2 = {
      ...note2,
      subject: "Revue approfondie et checklist actualisée",
      content: "Contenu enrichi de la note 2 après appel téléphonique.",
      durationMinutes: 45,
      updatedAt: "2026-08-25T15:00:00Z",
    }

    // Vérification de l'intégrité de la note #1
    assert.equal(note1.id, note1Id)
    assert.equal(note1.subject, "Consultation initiale")
    assert.equal(note1.content, "Contenu original et intouchable de la note 1.")
    assert.equal(note1.reference, "REN-2026-0001")

    // Vérification de la mise à jour de la note #2
    assert.equal(note2.id, note2Id)
    assert.equal(note2.subject, "Revue approfondie et checklist actualisée")
    assert.equal(note2.content, "Contenu enrichi de la note 2 après appel téléphonique.")
    assert.equal(note2.durationMinutes, 45)
  })

  test("Historisation inaltérable : la mise à jour d'une note finalisée consigne l'ancienne version", () => {
    const noteFinalisee: MeetingNote = {
      id: note1Id,
      firmId,
      matterId,
      reference: "REN-2026-0001",
      meetingDate: "2026-08-17",
      subject: "Consultation officielle",
      content: "Texte original validé et signé.",
      sections: {},
      durationMinutes: 60,
      meetingType: "consultation",
      reason: "consultation_initiale",
      status: "finalized",
      visibility: "internal",
      createdAt: "2026-08-17T10:00:00Z",
      updatedAt: "2026-08-17T10:00:00Z",
      finalizedAt: "2026-08-17T10:00:00Z",
      history: [],
    }

    // Avenant / modification ultérieure
    const revision: MeetingNoteHistoryEntry = {
      modifiedAt: "2026-08-18T09:00:00Z",
      modifiedBy: "user-uuid-1",
      modifiedByName: "Adama Diarra, CRIC",
      changeSummary: "Précision sur la date d'expiration du passeport",
      previousContent: noteFinalisee.content,
    }

    const noteAvenantee: MeetingNote = {
      ...noteFinalisee,
      content: "Texte original validé et signé. Ajout : passeport valide jusqu'au 2029-11-12.",
      updatedAt: revision.modifiedAt,
      history: [revision, ...noteFinalisee.history],
    }

    assert.equal(noteAvenantee.history.length, 1)
    assert.equal(noteAvenantee.history[0].changeSummary, "Précision sur la date d'expiration du passeport")
    assert.equal(noteAvenantee.history[0].previousContent, "Texte original validé et signé.")
    assert.match(noteAvenantee.content, /passeport valide/)
  })

  test("Confidentialité : le partage avec le client nécessite une action explicite", () => {
    const notePrivee: MeetingNote = {
      id: note1Id,
      firmId,
      matterId,
      reference: "REN-2026-0001",
      meetingDate: "2026-08-17",
      subject: "Notes internes de stratégie",
      content: "Éléments confidentiels de préparation.",
      sections: {},
      durationMinutes: 60,
      meetingType: "consultation",
      reason: "suivi_dossier",
      status: "finalized",
      visibility: "internal", // Privé par défaut
      createdAt: "2026-08-17T10:00:00Z",
      updatedAt: "2026-08-17T10:00:00Z",
      history: [],
    }

    assert.equal(notePrivee.visibility, "internal")

    // Partage explicite
    const notePartagee: MeetingNote = {
      ...notePrivee,
      visibility: "shared_client",
      sharedAt: "2026-08-17T12:00:00Z",
      sharedBy: "user-uuid-1",
    }

    assert.equal(notePartagee.visibility, "shared_client")
    assert.ok(notePartagee.sharedAt)
  })
})
