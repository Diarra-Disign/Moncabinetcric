import { ImmigrationProgram, ProgramChecklistItem } from "./types"

export const IMMIGRATION_PROGRAMS: ImmigrationProgram[] = [
  {
    id: "prog-ee",
    nameFr: "Résidence Permanente (EE)",
    nameEn: "Permanent Residence (EE)",
    forms: ["IMM 5476", "IMM 0008", "IMM 5669", "IMM 5406"],
    delayDays: 180,
    checklist: [
      { id: "chk-1", nameFr: "Passeport valide au moins 6 mois", nameEn: "Passport valid for at least 6 months", code: "PASSPORT", isRequired: true, defaultStatus: "valid" },
      { id: "chk-2", nameFr: "Test de langue (TEF / IELTS)", nameEn: "Language test (TEF / IELTS)", code: "LANG_TEST", isRequired: true, defaultStatus: "valid" },
      { id: "chk-3", nameFr: "Évaluation des diplômes (EDE/ECA)", nameEn: "Educational credential assessment (ECA)", code: "ECA", isRequired: true, defaultStatus: "valid" },
      { id: "chk-4", nameFr: "Preuve de fonds suffisants", nameEn: "Proof of sufficient funds", code: "FUNDS", isRequired: true, defaultStatus: "valid" },
      { id: "chk-5", nameFr: "Certificat de police du pays d'origine", nameEn: "Police clearance certificate", code: "POLICE", isRequired: true, defaultStatus: "expired" },
      { id: "chk-6", nameFr: "Formulaire IMM 5476 signé (Représentation)", nameEn: "IMM 5476 signed form (Representation)", code: "IMM5476", isRequired: true, defaultStatus: "valid" },
      { id: "chk-7", nameFr: "Formulaire IMM 0008 (Demande générique)", nameEn: "IMM 0008 form (Generic application)", code: "IMM0008", isRequired: true, defaultStatus: "missing" }
    ]
  },
  {
    id: "prog-peq",
    nameFr: "Résidence Permanente (PEQ)",
    nameEn: "Permanent Residence (PEQ)",
    forms: ["IMM 5476", "IMM 0008", "A-0520-IF", "IMM 5669"],
    delayDays: 240,
    checklist: [
      { id: "chk-peq-1", nameFr: "CSQ - Certificat de sélection du Québec", nameEn: "CSQ - Quebec Selection Certificate", code: "CSQ", isRequired: true, defaultStatus: "valid" },
      { id: "chk-peq-2", nameFr: "Passeport valide au moins 6 mois", nameEn: "Passport valid for at least 6 months", code: "PASSPORT", isRequired: true, defaultStatus: "valid" },
      { id: "chk-peq-3", nameFr: "Test de langue française de niveau B2 minimum", nameEn: "French language test level B2 min", code: "TEFAQ", isRequired: true, defaultStatus: "valid" },
      { id: "chk-peq-4", nameFr: "Formulaire IMM 5476 signé (Représentation)", nameEn: "IMM 5476 signed form (Representation)", code: "IMM5476", isRequired: true, defaultStatus: "valid" },
      { id: "chk-peq-5", nameFr: "Certificats de police", nameEn: "Police certificates", code: "POLICE", isRequired: true, defaultStatus: "missing" }
    ]
  },
  {
    id: "prog-tr-visa",
    nameFr: "Visa de Visiteur (VTR / TRV)",
    nameEn: "Visitor Visa (TRV)",
    forms: ["IMM 5257", "IMM 5645", "IMM 5476"],
    delayDays: 30,
    checklist: [
      { id: "chk-visa-1", nameFr: "Passeport valide pour la durée du séjour", nameEn: "Valid Passport", code: "PASSPORT", isRequired: true, defaultStatus: "valid" },
      { id: "chk-visa-2", nameFr: "Preuve de liens avec le pays d'origine", nameEn: "Proof of ties to home country", code: "TIES", isRequired: true, defaultStatus: "valid" },
      { id: "chk-visa-3", nameFr: "Lettre d'invitation et preuves financières", nameEn: "Invitation letter & financial proof", code: "INVITATION", isRequired: true, defaultStatus: "valid" },
      { id: "chk-visa-4", nameFr: "Formulaire IMM 5257 (Demande de VTR)", nameEn: "IMM 5257 Form", code: "IMM5257", isRequired: true, defaultStatus: "valid" }
    ]
  },
  {
    id: "prog-super-visa",
    nameFr: "Super Visa (Parents & Grands-Parents)",
    nameEn: "Super Visa (Parents & Grandparents)",
    forms: ["IMM 5257", "IMM 5645", "IMM 5476", "Preuve Assurance Médicale"],
    delayDays: 60,
    checklist: [
      { id: "chk-sv-1", nameFr: "Preuve de filiation (Acte de naissance)", nameEn: "Proof of relationship", code: "BIRTH_CERT", isRequired: true, defaultStatus: "valid" },
      { id: "chk-sv-2", nameFr: "Assurance médicale canadienne (100k$ CAD min)", nameEn: "Canadian medical insurance (100k$ min)", code: "INSURANCE", isRequired: true, defaultStatus: "valid" },
      { id: "chk-sv-3", nameFr: "Preuve de revenu du répondant (NOA / T4)", nameEn: "Host income proof (NOA / T4)", code: "INCOME_PROOF", isRequired: true, defaultStatus: "valid" },
      { id: "chk-sv-4", nameFr: "Examen médical préalable", nameEn: "Upfront medical exam", code: "MEDICAL", isRequired: true, defaultStatus: "valid" }
    ]
  },
  {
    id: "prog-lmia",
    nameFr: "Permis de travail / EIMT",
    nameEn: "Work Permit / LMIA",
    forms: ["IMM 5476", "IMM 1295", "EMP5602", "IMM 5710"],
    delayDays: 90,
    checklist: [
      { id: "chk-lmia-1", nameFr: "Offre d'emploi validée (EIMT positive)", nameEn: "Validated job offer (Positive LMIA)", code: "LMIA_POS", isRequired: true, defaultStatus: "valid" },
      { id: "chk-lmia-2", nameFr: "Contrat de travail signé", nameEn: "Signed employment contract", code: "CONTRACT", isRequired: true, defaultStatus: "valid" },
      { id: "chk-lmia-3", nameFr: "Passeport valide au moins 1 an", nameEn: "Passport valid for at least 1 year", code: "PASSPORT", isRequired: true, defaultStatus: "valid" },
      { id: "chk-lmia-4", nameFr: "Preuves d'expérience professionnelle (lettres)", nameEn: "Proof of work experience (reference letters)", code: "EXPERIENCE", isRequired: true, defaultStatus: "valid" },
      { id: "chk-lmia-5", nameFr: "Formulaire IMM 1295 (Permis de travail)", nameEn: "IMM 1295 form (Work permit)", code: "IMM1295", isRequired: true, defaultStatus: "missing" }
    ]
  },
  {
    id: "prog-study",
    nameFr: "Permis d'études / CAQ",
    nameEn: "Study Permit / CAQ",
    forms: ["IMM 5476", "IMM 1294", "A-0506-F", "IMM 5709", "IMM 5257"],
    delayDays: 60,
    checklist: [
      { id: "chk-study-1", nameFr: "Lettre d'admission d'un établissement (EED)", nameEn: "Letter of acceptance from DLI", code: "LOA", isRequired: true, defaultStatus: "valid" },
      { id: "chk-study-2", nameFr: "CAQ - Certificat d'acceptation du Québec", nameEn: "CAQ - Quebec Acceptance Certificate", code: "CAQ", isRequired: true, defaultStatus: "valid" },
      { id: "chk-study-3", nameFr: "Preuves de ressources financières suffisantes", nameEn: "Proof of sufficient financial support", code: "FUNDS_STUDY", isRequired: true, defaultStatus: "valid" },
      { id: "chk-study-4", nameFr: "Formulaire IMM 1294 (Permis d'études)", nameEn: "IMM 1294 form (Study permit)", code: "IMM1294", isRequired: true, defaultStatus: "missing" },
      { id: "chk-study-5", nameFr: "Formulaire IMM 5257 (Visa de visiteur)", nameEn: "IMM 5257 form (Visitor visa)", code: "IMM5257", isRequired: false, defaultStatus: "valid" }
    ]
  },
  {
    id: "prog-sponsorship",
    nameFr: "Parrainage Spousal",
    nameEn: "Spousal Sponsorship",
    forms: ["IMM 5476", "IMM 1344", "IMM 5532", "IMM 0008", "IMM 5406"],
    delayDays: 365,
    checklist: [
      { id: "chk-fam-1", nameFr: "Certificat de mariage ou preuve de conjoint de fait", nameEn: "Marriage certificate or common-law proof", code: "MARRIAGE", isRequired: true, defaultStatus: "valid" },
      { id: "chk-fam-2", nameFr: "Formulaire IMM 1344 (Demande de parrainage)", nameEn: "IMM 1344 form (Application to sponsor)", code: "IMM1344", isRequired: true, defaultStatus: "valid" },
      { id: "chk-fam-3", nameFr: "Formulaire IMM 5532 (Relation et évaluation)", nameEn: "IMM 5532 form (Relationship assessment)", code: "IMM5532", isRequired: true, defaultStatus: "valid" },
      { id: "chk-fam-4", nameFr: "Preuves d'identité du parrain et du parrainé", nameEn: "Identity documents for sponsor and sponsored", code: "ID_DOCS", isRequired: true, defaultStatus: "valid" },
      { id: "chk-fam-5", nameFr: "Photos et preuves de vie commune", nameEn: "Photos and cohabitation proofs", code: "COHABITATION", isRequired: true, defaultStatus: "expired" }
    ]
  }
]

export async function getPrograms(): Promise<ImmigrationProgram[]> {
  return IMMIGRATION_PROGRAMS
}

export async function getProgramByName(programName: string): Promise<ImmigrationProgram | undefined> {
  const norm = programName.toLowerCase()
  return IMMIGRATION_PROGRAMS.find(p => 
    norm.includes("super") ? p.id === "prog-super-visa" :
    norm.includes("visa") || norm.includes("visiteur") || norm.includes("trv") ? p.id === "prog-tr-visa" :
    norm.includes("ee") || norm.includes("express") ? p.id === "prog-ee" :
    norm.includes("peq") || norm.includes("québec") || norm.includes("quebec") ? p.id === "prog-peq" :
    norm.includes("lmia") || norm.includes("eimt") || norm.includes("travail") || norm.includes("work") ? p.id === "prog-lmia" :
    norm.includes("étude") || norm.includes("study") || norm.includes("caq") ? p.id === "prog-study" :
    norm.includes("parrainage") || norm.includes("sponsorship") || norm.includes("spousal") ? p.id === "prog-sponsorship" :
    p.id === "prog-ee"
  )
}

export function generateChecklistForProgram(programName: string): ProgramChecklistItem[] {
  const norm = programName.toLowerCase()
  const prog = IMMIGRATION_PROGRAMS.find(p => 
    norm.includes("super") ? p.id === "prog-super-visa" :
    norm.includes("visa") || norm.includes("visiteur") || norm.includes("trv") ? p.id === "prog-tr-visa" :
    norm.includes("ee") || norm.includes("express") ? p.id === "prog-ee" :
    norm.includes("peq") || norm.includes("québec") || norm.includes("quebec") ? p.id === "prog-peq" :
    norm.includes("lmia") || norm.includes("eimt") || norm.includes("travail") || norm.includes("work") ? p.id === "prog-lmia" :
    norm.includes("étude") || norm.includes("study") || norm.includes("caq") ? p.id === "prog-study" :
    norm.includes("parrainage") || norm.includes("sponsorship") || norm.includes("spousal") ? p.id === "prog-sponsorship" :
    p.id === "prog-ee"
  )
  return prog ? prog.checklist : IMMIGRATION_PROGRAMS[0].checklist
}

export function calculateCompletionPercentage(checklist: ProgramChecklistItem[]): number {
  if (!checklist || checklist.length === 0) return 0
  const validCount = checklist.filter(item => item.defaultStatus === "valid").length
  return Math.round((validCount / checklist.length) * 100)
}
