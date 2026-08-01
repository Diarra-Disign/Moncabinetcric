import { DeadlineRule, DeadlineRecord, CiccComplianceScore } from "../types"

export const OFFICIAL_DEADLINE_RULES: DeadlineRule[] = [
  {
    id: "rule-ee-ita",
    code: "ee_ita_submission",
    labelFr: "Soumission Demande Entrée Express après Invitation (ITA)",
    labelEn: "Express Entry ITA Application Submission Window",
    triggerEvent: "ita_received",
    offsetDays: 60,
    offsetDirection: "after",
    severity: "critical",
    reminderOffsets: [60, 45, 30, 14, 7, 1],
    authority: "LIPR art. 10.3 & Guide IRCC Entrée Express",
    sourceUrl: "https://www.canada.ca/fr/immigration-refugies-citoyennete/services/immigrer-canada/entree-express.html",
    effectiveFrom: "2024-01-01",
    verifiedOn: "2026-06-15",
    isActive: true
  },
  {
    id: "rule-biometrics",
    code: "biometrics_instruction_letter",
    labelFr: "Dépôt des Données Biométriques (Lettre d'Instruction IRCC)",
    labelEn: "Biometrics Instruction Letter Compliance",
    triggerEvent: "biometrics_request",
    offsetDays: 30,
    offsetDirection: "after",
    severity: "high",
    reminderOffsets: [30, 14, 7, 3, 1],
    authority: "RIPR art. 12.1 & Instructions Générale IRCC",
    sourceUrl: "https://www.canada.ca/fr/immigration-refugies-citoyennete/services/donnees-biometriques.html",
    effectiveFrom: "2024-01-01",
    verifiedOn: "2026-05-20",
    isActive: true
  },
  {
    id: "rule-status-restoration",
    code: "status_restoration_window",
    labelFr: "Délai de Rétablissement de Statut au Canada (90 Jours)",
    labelEn: "Status Restoration Application Window (90 Days)",
    triggerEvent: "restoration_window",
    offsetDays: 90,
    offsetDirection: "after",
    severity: "critical",
    reminderOffsets: [90, 60, 30, 14, 7, 1],
    authority: "LIPR art. 182 & RIPR art. 182",
    sourceUrl: "https://www.canada.ca/fr/immigration-refugies-citoyennete/organisation/publications-guides.html",
    effectiveFrom: "2023-11-01",
    verifiedOn: "2026-07-01",
    isActive: true
  },
  {
    id: "rule-work-permit-expiry",
    code: "work_permit_renewal_notice",
    labelFr: "Avis d'Échéance Permis de Travail (Statut Maintenu)",
    labelEn: "Work Permit Expiry Notice & Maintained Status",
    triggerEvent: "status_expiry",
    offsetDays: 90,
    offsetDirection: "before",
    severity: "high",
    reminderOffsets: [90, 60, 30, 14, 7, 1],
    authority: "RIPR art. 186(u)",
    sourceUrl: "https://www.canada.ca/fr/immigration-refugies-citoyennete.html",
    effectiveFrom: "2024-01-01",
    verifiedOn: "2026-06-10",
    isActive: true
  },
  {
    id: "rule-cicc-reconciliation",
    code: "cicc_trust_reconciliation_monthly",
    labelFr: "Rapprochement Mensuel Obligatoire du Compte Fidéicommis",
    labelEn: "Mandatory Monthly Trust Account Reconciliation",
    triggerEvent: "trust_reconciliation",
    offsetDays: 30,
    offsetDirection: "after",
    severity: "critical",
    reminderOffsets: [30, 15, 5, 1],
    authority: "Code de déontologie CICC art. 13.4 & Règlement Trust",
    sourceUrl: "https://college-ic.ca",
    effectiveFrom: "2022-07-01",
    verifiedOn: "2026-07-31",
    isActive: true
  },
  {
    id: "rule-cicc-permit-renewal",
    code: "cicc_license_annual_renewal",
    labelFr: "Renouvellement Annuel du Permis CRIC & Cotisation",
    labelEn: "Annual RCIC Licence Renewal & Dues",
    triggerEvent: "cicc_license_renewal",
    offsetDays: 60,
    offsetDirection: "before",
    severity: "critical",
    reminderOffsets: [60, 30, 14, 7, 1],
    authority: "Règlement Administratif CICC art. 4",
    sourceUrl: "https://college-ic.ca",
    effectiveFrom: "2025-01-01",
    verifiedOn: "2026-01-15",
    isActive: true
  }
]

export const MOCK_DEADLINE_RECORDS: DeadlineRecord[] = [
  {
    id: "dead-001",
    matterId: "DOS-35698",
    personId: "pers-101",
    clientName: "Les Industries Nordiques Inc.",
    program: "EIMT & Permis de Travail",
    title: "Dépôt des Données Biométriques pour 12 Travailleurs (Lettre IRCC)",
    ruleCode: "biometrics_instruction_letter",
    dueOn: "2026-08-08",
    daysRemaining: 7,
    severity: "critical",
    status: "open",
    assignedTo: "Sophie Tremblay",
    authority: "RIPR art. 12.1 & Instructions IRCC",
    sourceFact: { type: "document_received", date: "2026-07-09", refId: "doc-bil-9901" },
    isManual: false
  },
  {
    id: "dead-002",
    matterId: "DOS-35697",
    personId: "pers-102",
    clientName: "Dr. S. Rahman",
    program: "Entrée Express — Travailleurs Qualifiés",
    title: "Soumission Complète de la Demande de RP post-ITA (Fenêtre 60 Jours)",
    ruleCode: "ee_ita_submission",
    dueOn: "2026-08-14",
    daysRemaining: 13,
    severity: "high",
    status: "open",
    assignedTo: "Me Adama Diarra",
    authority: "LIPR art. 10.3 & Instructions Entrée Express",
    sourceFact: { type: "ita_issued", date: "2026-06-15" },
    isManual: false
  },
  {
    id: "dead-003",
    matterId: "DOS-35696",
    personId: "pers-103",
    clientName: "Santé Québec Express",
    program: "Programme PEQ & Recrutement Infirmières",
    title: "Renouvellement du Permis de Travail Fermé avant Expiration",
    ruleCode: "work_permit_renewal_notice",
    dueOn: "2026-08-28",
    daysRemaining: 27,
    severity: "high",
    status: "open",
    assignedTo: "Julie Roy",
    authority: "RIPR art. 186(u)",
    sourceFact: { type: "status_expiry", date: "2026-08-28" },
    isManual: false
  },
  {
    id: "dead-004",
    matterId: "CAB-2026",
    clientName: "Cabinet Immigration Boréale Inc.",
    program: "Conformité Cabinet CICC",
    title: "Rapprochement Mensuel Obligatoire du Compte Fidéicommis (Août 2026)",
    ruleCode: "cicc_trust_reconciliation_monthly",
    dueOn: "2026-08-31",
    daysRemaining: 30,
    severity: "normal",
    status: "open",
    assignedTo: "Me Adama Diarra",
    authority: "Règlement Fidéicommis CICC art. 13.4",
    isManual: false
  },
  {
    id: "dead-005",
    matterId: "DOS-35695",
    clientName: "M. Diarra",
    program: "Parrainage Époux",
    title: "Délai de Transmission Certificat de Casier Judiciaire Supplémentaire",
    dueOn: "2026-09-10",
    daysRemaining: 40,
    severity: "normal",
    status: "open",
    assignedTo: "Sophie Tremblay",
    authority: "Demande Spécifique IRCC (Lettre du 10 juillet)",
    isManual: true
  }
]

export const OFFICIAL_CICC_COMPLIANCE_SCORE: CiccComplianceScore = {
  totalScore: 95,
  status: "perfect",
  items: [
    {
      id: "cicc-01",
      labelFr: "Contrat de services réglementé signé au dossier",
      labelEn: "Regulated Service Agreement Signed on File",
      weight: 20,
      isSatisfied: true,
      detailFr: "Tous les dossiers actifs possèdent une entente CICC signée et horodatée.",
      detailEn: "All active matters have a signed and timestamped CICC agreement."
    },
    {
      id: "cicc-02",
      labelFr: "Mandat de représentation IMM 5476 signé et versé",
      labelEn: "IMM 5476 Representation Mandate Signed & Filed",
      weight: 15,
      isSatisfied: true,
      detailFr: "Formulaire IMM 5476 valide et actif sur chaque dossier client.",
      detailEn: "Valid IMM 5476 form filed for all active clients."
    },
    {
      id: "cicc-03",
      labelFr: "Aucune échéance réglementaire critique dépassée",
      labelEn: "Zero Critical Regulatory Deadlines Overdue",
      weight: 20,
      isSatisfied: true,
      detailFr: "Toutes les échéances critiques sont dans les délais prescrits par la LIPR.",
      detailEn: "All critical deadlines are within prescribed LIPR timeframes."
    },
    {
      id: "cicc-04",
      labelFr: "Rapprochement du compte fidéicommis du mois précédent complété",
      labelEn: "Prior Month Trust Account Reconciliation Completed",
      weight: 15,
      isSatisfied: true,
      detailFr: "Rapprochement mensuel du compte client validé et scellé au 31 juillet 2026.",
      detailEn: "Monthly trust reconciliation validated as of July 31, 2026."
    },
    {
      id: "cicc-05",
      labelFr: "Aucun retrait fidéicommis sans facture justificative rattachée",
      labelEn: "Zero Trust Withdrawals Without Attached Invoice",
      weight: 15,
      isSatisfied: true,
      detailFr: "Chaque virement du fidéicommis correspond à un reçu et une facture émise.",
      detailEn: "Every trust transfer matches an issued invoice and receipt."
    },
    {
      id: "cicc-06",
      labelFr: "Registre des conflits d'intérêts vérifié à l'ouverture",
      labelEn: "Conflict of Interest Registry Checked at Opening",
      weight: 10,
      isSatisfied: true,
      detailFr: "Contrôle d'absence de conflit exécuté avant la première consultation.",
      detailEn: "Conflict of interest check completed prior to initial consultation."
    },
    {
      id: "cicc-07",
      labelFr: "Permis CICC (#R-514982) et assurance responsabilité en règle",
      labelEn: "CICC Licence (#R-514982) & E&O Insurance Active",
      weight: 5,
      isSatisfied: false,
      detailFr: "Avis préventif : renouvellement annuel de la police d'assurance responsabilité dans 60 jours.",
      detailEn: "Preventive notice: annual E&O insurance renewal due in 60 days."
    }
  ]
}
