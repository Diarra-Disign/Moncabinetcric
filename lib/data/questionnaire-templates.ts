export interface FormField {
  key: string
  labelFr: string
  labelEn: string
  type: "text" | "number" | "date" | "select" | "checkbox" | "radio" | "file" | "repeater"
  required: boolean
  options?: { value: string; labelFr: string; labelEn: string }[]
  fields?: FormField[] // Pour les repeaters (listes d'emplois, études, etc.)
  instructionsFr?: string
  instructionsEn?: string
}

export interface FormSection {
  id: string
  titleFr: string
  titleEn: string
  fields: FormField[]
}

export interface QuestionnaireTemplate {
  formType: "study_permit" | "work_permit" | "pr"
  titleFr: string
  titleEn: string
  descriptionFr: string
  descriptionEn: string
  sections: FormSection[]
}

// Bibliothèque de sections réutilisables
const SECTION_INFO_PERSO: FormSection = {
  id: "personal_info",
  titleFr: "Informations personnelles",
  titleEn: "Personal Information",
  fields: [
    { key: "lastName", labelFr: "Nom de famille", labelEn: "Last name", type: "text", required: true },
    { key: "firstName", labelFr: "Prénom(s)", labelEn: "First name(s)", type: "text", required: true },
    { key: "birthDate", labelFr: "Date de naissance", labelEn: "Date of birth", type: "date", required: true },
    {
      key: "citizenship",
      labelFr: "Nationalité",
      labelEn: "Citizenship",
      type: "select",
      required: true,
      options: [
        { value: "France", labelFr: "France", labelEn: "France" },
        { value: "Canada", labelFr: "Canada", labelEn: "Canada" },
        { value: "Maroc", labelFr: "Maroc", labelEn: "Morocco" },
        { value: "Tunisie", labelFr: "Tunisie", labelEn: "Tunisia" },
        { value: "Algérie", labelFr: "Algérie", labelEn: "Algeria" },
        { value: "Sénégal", labelFr: "Sénégal", labelEn: "Senegal" },
        { value: "Cameroun", labelFr: "Cameroun", labelEn: "Cameroon" },
        { value: "Autre", labelFr: "Autre", labelEn: "Other" }
      ]
    },
    { key: "phone", labelFr: "Numéro de téléphone", labelEn: "Phone number", type: "text", required: true },
    { key: "email", labelFr: "Adresse courriel", labelEn: "Email address", type: "text", required: true }
  ]
};

const SECTION_FAMILLE: FormSection = {
  id: "family",
  titleFr: "Informations familiales",
  titleEn: "Family Information",
  fields: [
    {
      key: "maritalStatus",
      labelFr: "État matrimonial",
      labelEn: "Marital status",
      type: "select",
      required: true,
      options: [
        { value: "single", labelFr: "Célibataire", labelEn: "Single" },
        { value: "married", labelFr: "Marié(e)", labelEn: "Married" },
        { value: "common_law", labelFr: "Conjoint de fait", labelEn: "Common-law" },
        { value: "divorced", labelFr: "Divorcé(e)", labelEn: "Divorced" },
        { value: "widowed", labelFr: "Veuf/Veuve", labelEn: "Widowed" }
      ]
    },
    { key: "spouseLastName", labelFr: "Nom de famille du conjoint", labelEn: "Spouse last name", type: "text", required: false },
    { key: "spouseFirstName", labelFr: "Prénom du conjoint", labelEn: "Spouse first name", type: "text", required: false },
    { key: "spouseBirthDate", labelFr: "Date de naissance du conjoint", labelEn: "Spouse date of birth", type: "date", required: false },
    {
      key: "children",
      labelFr: "Enfant(s) à charge",
      labelEn: "Dependent child(ren)",
      type: "repeater",
      required: false,
      fields: [
        { key: "childName", labelFr: "Nom complet", labelEn: "Full name", type: "text", required: true },
        { key: "childBirthDate", labelFr: "Date de naissance", labelEn: "Date of birth", type: "date", required: true }
      ]
    }
  ]
};

const SECTION_ETUDES: FormSection = {
  id: "education",
  titleFr: "Scolarité et études",
  titleEn: "Education History",
  fields: [
    {
      key: "schools",
      labelFr: "Historique des études (commencez par le plus récent)",
      labelEn: "Education history (start with the most recent)",
      type: "repeater",
      required: true,
      fields: [
        { key: "schoolName", labelFr: "Nom de l'établissement", labelEn: "School name", type: "text", required: true },
        { key: "diploma", labelFr: "Diplôme / Programme d'études", labelEn: "Diploma / Field of study", type: "text", required: true },
        { key: "startDate", labelFr: "Date de début", labelEn: "Start date", type: "date", required: true },
        { key: "endDate", labelFr: "Date de fin", labelEn: "End date", type: "date", required: true }
      ]
    }
  ]
};

const SECTION_EMPLOI: FormSection = {
  id: "employment",
  titleFr: "Historique professionnel",
  titleEn: "Work History",
  fields: [
    {
      key: "jobs",
      labelFr: "Historique des emplois (des 10 dernières années)",
      labelEn: "Employment history (for the last 10 years)",
      type: "repeater",
      required: true,
      fields: [
        { key: "employer", labelFr: "Employeur / Entreprise", labelEn: "Employer / Company", type: "text", required: true },
        { key: "title", labelFr: "Poste occupé", labelEn: "Job title", type: "text", required: true },
        { key: "startDate", labelFr: "Date de début", labelEn: "Start date", type: "date", required: true },
        { key: "endDate", labelFr: "Date de fin", labelEn: "End date", type: "date", required: true }
      ]
    }
  ]
};

const SECTION_VOYAGES: FormSection = {
  id: "travel",
  titleFr: "Historique des voyages",
  titleEn: "Travel History",
  fields: [
    {
      key: "trips",
      labelFr: "Voyages hors de votre pays de résidence",
      labelEn: "Travel outside your country of residence",
      type: "repeater",
      required: false,
      fields: [
        { key: "country", labelFr: "Pays visité", labelEn: "Country visited", type: "text", required: true },
        { key: "startDate", labelFr: "Date de départ", labelEn: "Departure date", type: "date", required: true },
        { key: "endDate", labelFr: "Date de retour", labelEn: "Return date", type: "date", required: true },
        { key: "purpose", labelFr: "Motif du séjour", labelEn: "Purpose of travel", type: "text", required: true }
      ]
    }
  ]
};

const SECTION_ANTECEDENTS: FormSection = {
  id: "background",
  titleFr: "Antécédents et déclarations",
  titleEn: "Background & Declarations",
  fields: [
    {
      key: "medicalHistory",
      labelFr: "Avez-vous, ou un membre de votre famille, eu de graves problèmes de santé physique ou mentale ?",
      labelEn: "Have you or any of your family members ever had any physical or mental health conditions?",
      type: "radio",
      required: true,
      options: [
        { value: "yes", labelFr: "Oui", labelEn: "Yes" },
        { value: "no", labelFr: "Non", labelEn: "No" }
      ]
    },
    {
      key: "visaRefusal",
      labelFr: "Avez-vous déjà essuyé un refus de visa, de permis d'études ou de travail, ou l'entrée au Canada ou dans un autre pays ?",
      labelEn: "Have you ever been refused a visa, study or work permit, or entry to Canada or another country?",
      type: "radio",
      required: true,
      options: [
        { value: "yes", labelFr: "Oui", labelEn: "Yes" },
        { value: "no", labelFr: "Non", labelEn: "No" }
      ]
    },
    {
      key: "criminalHistory",
      labelFr: "Avez-vous déjà commis, été accusé ou reconnu coupable d'un délit criminel dans un pays quelconque ?",
      labelEn: "Have you ever committed, been arrested for, or convicted of any criminal offense in any country?",
      type: "radio",
      required: true,
      options: [
        { value: "yes", labelFr: "Oui", labelEn: "Yes" },
        { value: "no", labelFr: "Non", labelEn: "No" }
      ]
    }
  ]
};

// Catalogue global des modèles de formulaires
export const QUESTIONNAIRE_TEMPLATES: QuestionnaireTemplate[] = [
  {
    formType: "study_permit",
    titleFr: "Questionnaire — Demande de permis d'études",
    titleEn: "Questionnaire — Study Permit Application",
    descriptionFr: "Veuillez remplir ce questionnaire pour nous permettre de préparer votre dossier de demande de permis d'études canadien.",
    descriptionEn: "Please fill out this questionnaire to allow us to prepare your Canadian study permit application.",
    sections: [
      SECTION_INFO_PERSO,
      SECTION_ETUDES,
      SECTION_FAMILLE,
      SECTION_EMPLOI,
      SECTION_VOYAGES,
      SECTION_ANTECEDENTS,
      {
        id: "financial",
        titleFr: "Informations financières",
        titleEn: "Financial Information",
        fields: [
          { key: "availableFunds", labelFr: "Fonds disponibles pour votre séjour ($ CAD)", labelEn: "Available funds for your stay ($ CAD)", type: "number", required: true },
          { key: "fundingSource", labelFr: "Source de financement", labelEn: "Source of funding", type: "text", required: true },
          { key: "bankStatement", labelFr: "Déposer un relevé de compte récent (PDF)", labelEn: "Upload a recent bank statement (PDF)", type: "file", required: true }
        ]
      }
    ]
  },
  {
    formType: "work_permit",
    titleFr: "Questionnaire — Demande de permis de travail",
    titleEn: "Questionnaire — Work Permit Application",
    descriptionFr: "Questionnaire officiel pour la préparation de votre demande de permis de travail ou de votre EIMT.",
    descriptionEn: "Official questionnaire for preparing your work permit application or LMIA.",
    sections: [
      SECTION_INFO_PERSO,
      {
        id: "job_offer",
        titleFr: "Détails de l'emploi offert",
        titleEn: "Job Offer Details",
        fields: [
          { key: "canadianEmployer", labelFr: "Nom de l'employeur au Canada", labelEn: "Canadian employer name", type: "text", required: true },
          { key: "jobTitle", labelFr: "Poste ou titre d'emploi offert", labelEn: "Offered job title", type: "text", required: true },
          { key: "offeredSalary", labelFr: "Salaire annuel offert ($ CAD)", labelEn: "Offered annual salary ($ CAD)", type: "number", required: true },
          { key: "expectedStartDate", labelFr: "Date de début prévue", labelEn: "Expected start date", type: "date", required: true }
        ]
      },
      SECTION_EMPLOI,
      SECTION_ETUDES,
      SECTION_FAMILLE,
      SECTION_VOYAGES
    ]
  },
  {
    formType: "pr",
    titleFr: "Questionnaire — Résidence permanente",
    titleEn: "Questionnaire — Permanent Residence",
    descriptionFr: "Rassemblez toutes les informations nécessaires à votre dossier de résidence permanente (Entrée Express, PEQ ou Entente Provinciale).",
    descriptionEn: "Gather all information required for your Permanent Residence application (Express Entry, PEQ or Provincial agreement).",
    sections: [
      SECTION_INFO_PERSO,
      SECTION_FAMILLE,
      SECTION_ETUDES,
      SECTION_EMPLOI,
      SECTION_VOYAGES,
      SECTION_ANTECEDENTS,
      {
        id: "addresses",
        titleFr: "Historique des adresses",
        titleEn: "Address History",
        fields: [
          {
            key: "addressList",
            labelFr: "Adresses résidentielles des 10 dernières années",
            labelEn: "Residential addresses for the last 10 years",
            type: "repeater",
            required: true,
            fields: [
              { key: "fullAddress", labelFr: "Adresse complète (rue, appartement)", labelEn: "Full address (street, apt)", type: "text", required: true },
              { key: "city", labelFr: "Ville", labelEn: "City", type: "text", required: true },
              { key: "country", labelFr: "Pays", labelEn: "Country", type: "text", required: true },
              { key: "startDate", labelFr: "Date d'arrivée", labelEn: "Start date", type: "date", required: true },
              { key: "endDate", labelFr: "Date de départ", labelEn: "End date", type: "date", required: true }
            ]
          }
        ]
      },
      {
        id: "languages",
        titleFr: "Informations linguistiques",
        titleEn: "Language Information",
        fields: [
          { key: "languageExamName", labelFr: "Nom de l'examen linguistique passé (IELTS, TEF, TCF)", labelEn: "Language exam taken (IELTS, TEF, TCF)", type: "text", required: true },
          { key: "examDate", labelFr: "Date de l'examen", labelEn: "Exam date", type: "date", required: true },
          { key: "listeningScore", labelFr: "Score — Compréhension orale", labelEn: "Score — Listening", type: "text", required: true },
          { key: "speakingScore", labelFr: "Score — Expression orale", labelEn: "Score — Speaking", type: "text", required: true },
          { key: "readingScore", labelFr: "Score — Compréhension écrite", labelEn: "Score — Reading", type: "text", required: true },
          { key: "writingScore", labelFr: "Score — Expression écrite", labelEn: "Score — Writing", type: "text", required: true },
          { key: "examAttestationFile", labelFr: "Téléverser l'attestation des résultats (PDF)", labelEn: "Upload the exam results statement (PDF)", type: "file", required: true }
        ]
      }
    ]
  }
];

export function getTemplateByType(type: "study_permit" | "work_permit" | "pr"): QuestionnaireTemplate | undefined {
  return QUESTIONNAIRE_TEMPLATES.find(t => t.formType === type);
}
