import { AuditLogEntry } from "../types"

export const MOCK_AUDIT_LOGS: Record<string, AuditLogEntry[]> = {
  "#DOS-35698": [
    { id: "aud-1", timestamp: "2026-05-18 10:15", author: "A. Diarra, CRIC", actionFr: "Ouverture du dossier et génération de la checklist EIMT (12 postes)", actionEn: "Opened matter and generated LMIA checklist (12 positions)" },
    { id: "aud-2", timestamp: "2026-05-18 14:30", author: "Système CICC", actionFr: "Facture #FAC-202601 générée en compte fidéicommis ($18,500 CAD)", actionEn: "Invoice #FAC-202601 generated in trust account ($18,500 CAD)" },
    { id: "aud-3", timestamp: "2026-05-19 09:00", author: "Michael S. (Client)", actionFr: "Téléversement du document 'Passeport - L. Nordiques.pdf'", actionEn: "Uploaded document 'Passeport - L. Nordiques.pdf'" }
  ],
  "#DOS-35697": [
    { id: "aud-10", timestamp: "2026-05-16 11:00", author: "A. Diarra, CRIC", actionFr: "Ouverture du dossier Entrée Express - Catégorie Santé", actionEn: "Opened Express Entry matter - Healthcare category" },
    { id: "aud-11", timestamp: "2026-05-16 16:45", author: "Dr. S. Rahman (Client)", actionFr: "Téléversement de la preuve de TEF Canada (Niveau C1)", actionEn: "Uploaded TEF Canada proof (C1 Level)" }
  ],
  "#DOS-35696": [
    { id: "aud-20", timestamp: "2026-05-15 08:30", author: "S. Lavoie, CRIC", actionFr: "Ouverture du dossier Recrutement LMIA Exemption (8 infirmières)", actionEn: "Opened LMIA Exemption recruitment matter (8 nurses)" },
    { id: "aud-21", timestamp: "2026-05-17 15:20", author: "S. Lavoie, CRIC", actionFr: "Alerte de conformité : vérification des équivalences de diplôme en attente", actionEn: "Compliance alert: pending educational credential verification" }
  ],
  "#DOS-35695": [
    { id: "aud-30", timestamp: "2026-05-12 13:00", author: "A. Diarra, CRIC", actionFr: "Ouverture du dossier Parrainage d'Époux / Conjoint de fait", actionEn: "Opened Spousal Sponsorship matter" },
    { id: "aud-31", timestamp: "2026-05-14 10:10", author: "K. Tremblay (Client)", actionFr: "Téléversement de l'acte de mariage et preuves de cohabitation", actionEn: "Uploaded marriage certificate and cohabitation proofs" }
  ]
}

export function getAuditLogsForMatter(matterId: string): AuditLogEntry[] {
  return MOCK_AUDIT_LOGS[matterId] || [
    { id: "aud-def-1", timestamp: "2026-05-10 09:00", author: "A. Diarra, CRIC", actionFr: "Création du dossier CICC dans le registre officiel", actionEn: "Matter created in official CICC registry" },
    { id: "aud-def-2", timestamp: "2026-05-10 09:05", author: "Système CICC", actionFr: "Checklist documentaire initialisée selon les normes IRCC", actionEn: "Document checklist initialized according to IRCC standards" }
  ]
}
