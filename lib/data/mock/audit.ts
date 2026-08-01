import { AuditLogRecord, ActionApprovalRecord } from "../types"

export const MOCK_AUDIT_LOGS: AuditLogRecord[] = [
  {
    id: "aud-001",
    occurredAt: "2026-08-01T14:20:11Z",
    actorMemberId: "mem-01",
    actorEmail: "adama.diarra@boreale-immigration.ca",
    actorName: "Me Adama Diarra",
    actorRole: "rcic",
    action: "approval",
    entityType: "approval_queue",
    entityId: "appr-101",
    summary: "Approbation RCIC exécutée — Virement Fidéicommis 10 000,00 $ (Phase 1 EIMT)",
    changes: {
      status: { before: "pending", after: "approved" },
      approvedBy: { before: null, after: "Me Adama Diarra (RCIC #R-514982)" }
    },
    ipAddress: "192.168.1.42",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    prevHash: "0000000000000000000000000000000000000000000000000000000000000000",
    rowHash: "8f9b2a7e4c1d6f3b8a1e5c9d2f4a7b0e3d6c9a2b5f8e1d4c7b0a3f6e9d2c5b8a"
  },
  {
    id: "aud-002",
    occurredAt: "2026-08-01T13:45:00Z",
    actorMemberId: "mem-02",
    actorEmail: "sophie.tremblay@boreale-immigration.ca",
    actorName: "Sophie Tremblay",
    actorRole: "staff",
    action: "create",
    entityType: "approval_queue",
    entityId: "appr-102",
    summary: "Soumission pour approbation CRIC — Signature Entente CICC #SA-2026-000142",
    changes: {
      actionType: { before: null, after: "sign_contract" },
      preparedBy: { before: null, after: "Sophie Tremblay (Staff)" }
    },
    ipAddress: "192.168.1.55",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    prevHash: "8f9b2a7e4c1d6f3b8a1e5c9d2f4a7b0e3d6c9a2b5f8e1d4c7b0a3f6e9d2c5b8a",
    rowHash: "3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b"
  },
  {
    id: "aud-003",
    occurredAt: "2026-08-01T11:12:30Z",
    actorMemberId: "mem-01",
    actorEmail: "adama.diarra@boreale-immigration.ca",
    actorName: "Me Adama Diarra",
    actorRole: "rcic",
    action: "trust_transfer",
    entityType: "trust_account",
    entityId: "inv-202601",
    summary: "Prélèvement Honoraires Fidéicommis exécuté après facturation (#FAC-202601)",
    changes: {
      trustBalance: { before: "50 900,00 $", after: "40 900,00 $" },
      generalBalance: { before: "15 000,00 $", after: "25 000,00 $" }
    },
    ipAddress: "192.168.1.42",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    prevHash: "3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b",
    rowHash: "1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f"
  },
  {
    id: "aud-004",
    occurredAt: "2026-07-31T16:05:12Z",
    actorMemberId: "mem-03",
    actorEmail: "julie.roy@boreale-immigration.ca",
    actorName: "Julie Roy",
    actorRole: "risia",
    action: "download",
    entityType: "document",
    entityId: "doc-8891",
    summary: "Téléchargement sécurisé document IRCC — Passeport M. Diarra (#DOS-35695)",
    ipAddress: "192.168.1.60",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    prevHash: "1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f",
    rowHash: "5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d"
  },
  {
    id: "aud-005",
    occurredAt: "2026-07-30T09:30:00Z",
    actorMemberId: "mem-01",
    actorEmail: "adama.diarra@boreale-immigration.ca",
    actorName: "Me Adama Diarra",
    actorRole: "owner",
    action: "update",
    entityType: "agreement",
    entityId: "agr-202601",
    summary: "Mise à jour des clauses d'honoraires et débours — Entente B2B Les Industries Nordiques",
    changes: {
      totalFees: { before: "15 000,00 $", after: "18 500,00 $" }
    },
    ipAddress: "192.168.1.42",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    prevHash: "5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d",
    rowHash: "9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b"
  }
]

export const MOCK_APPROVAL_QUEUE: ActionApprovalRecord[] = [
  {
    id: "appr-102",
    firmId: "firm-boreale",
    matterId: "DOS-35698",
    matterTitle: "Mandat Recrutement 12 EIMT & Permis de Travail",
    clientName: "Les Industries Nordiques Inc.",
    actionType: "trust_transfer",
    actionTitle: "Transfert Fidéicommis vers Compte Général (10 000,00 $)",
    summary: "Sophie Tremblay (Staff) demande l'approbation pour le prélèvement d'honoraires après atteinte du Jalon 1 (Approbation EIMT).",
    payload: {
      amountCents: 1000000,
      fromAccount: "Compte Fidéicommis BNC #4890-0192-332",
      toAccount: "Compte Opérationnel Général",
      milestoneRef: "Jalon 1 — Décision Favorable EIMT Service Canada"
    },
    preparedBy: "Sophie Tremblay (Adjointe Staff)",
    preparedByRole: "staff",
    preparedAt: "2026-08-01T13:45:00Z",
    status: "pending",
    amountCents: 1000000
  },
  {
    id: "appr-103",
    firmId: "firm-boreale",
    matterId: "DOS-35697",
    matterTitle: "Entrée Express — Résidence Permanente & ÉDE",
    clientName: "Dr. S. Rahman",
    actionType: "sign_contract",
    actionTitle: "Approbation & Contresignature Entente de Service CICC #SA-2026-000143",
    summary: "Julie Roy (RISIA) a complété la rédaction du contrat de services réglementé pour révision et validation RCIC obligatoire avant envoi au client.",
    payload: {
      contractRef: "SA-2026-000143",
      totalFeesCents: 420000,
      clausesCount: 7
    },
    preparedBy: "Julie Roy (Stagiaire RISIA)",
    preparedByRole: "risia",
    preparedAt: "2026-08-01T10:15:00Z",
    status: "pending",
    amountCents: 420000
  },
  {
    id: "appr-101",
    firmId: "firm-boreale",
    matterId: "DOS-35696",
    matterTitle: "Programme Recrutement Infirmières Santé Québec",
    clientName: "Santé Québec Express",
    actionType: "close_matter",
    actionTitle: "Fermeture Officielle du Dossier & Restitution Solde Fidéicommis",
    summary: "Demande de fermeture de dossier après obtention des permis de travail et rapprochement final du sous-compte fidéicommis.",
    payload: {
      refundCents: 0,
      finalStatus: "Succès — Permis Émis"
    },
    preparedBy: "Sophie Tremblay (Adjointe Staff)",
    preparedByRole: "staff",
    preparedAt: "2026-07-30T15:20:00Z",
    approvedBy: "Me Adama Diarra (RCIC #R-514982)",
    approvedAt: "2026-07-31T09:00:00Z",
    status: "approved"
  }
]
