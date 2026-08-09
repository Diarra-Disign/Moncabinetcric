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
  /**
   * Identifiant lisible du modèle, et NON une valeur d'énumération.
   *
   * Ce champ s'appelait formType et valait « study_permit | work_permit | pr ».
   * Une union fermée en TypeScript doublée d'une contrainte CHECK en base :
   * ajouter le questionnaire de préconsultation exigeait donc de modifier le
   * type, la contrainte, et de redéployer. Un cabinet ne peut pas déployer.
   *
   * Or le brief demande précisément que le consultant crée ses propres
   * questionnaires. Une bibliothèque ne tient pas dans une contrainte CHECK :
   * les modèles sont devenus des LIGNES, et ce fichier n'est plus que le
   * catalogue de départ qui les amorce.
   */
  slug: string
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

/**
 * Catalogue de départ.
 *
 * Ces modèles sont amorcés en base par la migration questionnaire_library.
 * Ils n'y sont PAS relus à chaque démarrage : un cabinet qui modifie le
 * questionnaire de préconsultation verrait sa version écrasée au prochain
 * déploiement. Le catalogue amorce, il ne gouverne pas.
 */
export const QUESTIONNAIRE_TEMPLATES: QuestionnaireTemplate[] = [
  {
    // Le seul destiné à un prospect qu'on ne connaît pas encore : il ne
    // demande donc ni antécédents ni historique décennal, seulement de quoi
    // préparer la consultation.
    slug: "preconsultation",
    titleFr: "Questionnaire de préconsultation",
    titleEn: "Pre-consultation Questionnaire",
    descriptionFr: "Questionnaire permettant de recueillir les informations nécessaires avant une consultation.",
    descriptionEn: "Questionnaire used to gather the information needed ahead of a consultation.",
    sections: [
      SECTION_INFO_PERSO,
      {
        id: "project",
        titleFr: "Votre projet d'immigration",
        titleEn: "Your immigration project",
        fields: [
          {
            key: "projectType",
            labelFr: "Quel type de démarche envisagez-vous ?",
            labelEn: "What type of application are you considering?",
            type: "select",
            required: true,
            options: [
              { value: "study", labelFr: "Permis d'études", labelEn: "Study permit" },
              { value: "work", labelFr: "Permis de travail", labelEn: "Work permit" },
              { value: "pr", labelFr: "Résidence permanente", labelEn: "Permanent residence" },
              { value: "sponsorship", labelFr: "Parrainage", labelEn: "Sponsorship" },
              { value: "visitor", labelFr: "Visite / Super visa", labelEn: "Visitor / Super visa" },
              { value: "other", labelFr: "Autre / je ne sais pas encore", labelEn: "Other / not sure yet" }
            ]
          },
          { key: "currentCountry", labelFr: "Pays où vous vous trouvez actuellement", labelEn: "Country you are currently in", type: "text", required: true },
          {
            key: "currentStatus",
            labelFr: "Votre statut actuel au Canada, le cas échéant",
            labelEn: "Your current status in Canada, if any",
            type: "select",
            required: false,
            options: [
              { value: "none", labelFr: "Je ne suis pas au Canada", labelEn: "I am not in Canada" },
              { value: "visitor", labelFr: "Visiteur", labelEn: "Visitor" },
              { value: "student", labelFr: "Étudiant", labelEn: "Student" },
              { value: "worker", labelFr: "Travailleur", labelEn: "Worker" },
              { value: "expired", labelFr: "Statut expiré", labelEn: "Expired status" }
            ]
          },
          { key: "targetDate", labelFr: "À quelle date souhaiteriez-vous partir ou déposer ?", labelEn: "When would you like to leave or file?", type: "date", required: false },
          {
            key: "previousRefusal",
            labelFr: "Avez-vous déjà essuyé un refus d'une autorité d'immigration ?",
            labelEn: "Have you ever been refused by an immigration authority?",
            type: "radio",
            required: true,
            options: [
              { value: "yes", labelFr: "Oui", labelEn: "Yes" },
              { value: "no", labelFr: "Non", labelEn: "No" }
            ]
          },
          {
            key: "consultedBefore",
            labelFr: "Avez-vous déjà été accompagné par un consultant ou un avocat pour cette démarche ?",
            labelEn: "Have you already been assisted by a consultant or lawyer for this matter?",
            type: "radio",
            required: true,
            options: [
              { value: "yes", labelFr: "Oui", labelEn: "Yes" },
              { value: "no", labelFr: "Non", labelEn: "No" }
            ]
          },
          { key: "questions", labelFr: "Les questions que vous souhaitez aborder en consultation", labelEn: "Questions you would like to discuss during the consultation", type: "text", required: false }
        ]
      }
    ]
  },
  {
    slug: "study_permit",
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
    slug: "work_permit",
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
    slug: "pr",
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
  },
  {
    slug: "sponsorship",
    titleFr: "Questionnaire — Parrainage",
    titleEn: "Questionnaire — Sponsorship",
    descriptionFr: "Informations nécessaires à une demande de parrainage d'un époux, conjoint de fait, enfant ou parent.",
    descriptionEn: "Information required for sponsoring a spouse, common-law partner, child or parent.",
    sections: [
      SECTION_INFO_PERSO,
      {
        id: "sponsor",
        titleFr: "Le répondant",
        titleEn: "The sponsor",
        fields: [
          {
            key: "sponsorStatus",
            labelFr: "Statut du répondant au Canada",
            labelEn: "Sponsor's status in Canada",
            type: "select",
            required: true,
            options: [
              { value: "citizen", labelFr: "Citoyen canadien", labelEn: "Canadian citizen" },
              { value: "pr", labelFr: "Résident permanent", labelEn: "Permanent resident" },
              { value: "registered_indian", labelFr: "Indien inscrit", labelEn: "Registered Indian" }
            ]
          },
          { key: "sponsorProvince", labelFr: "Province de résidence du répondant", labelEn: "Sponsor's province of residence", type: "text", required: true },
          { key: "sponsorIncome", labelFr: "Revenu annuel brut du répondant ($ CAD)", labelEn: "Sponsor's gross annual income ($ CAD)", type: "number", required: true },
          {
            key: "previousSponsorship",
            labelFr: "Le répondant a-t-il déjà parrainé quelqu'un ?",
            labelEn: "Has the sponsor sponsored anyone before?",
            type: "radio",
            required: true,
            options: [
              { value: "yes", labelFr: "Oui", labelEn: "Yes" },
              { value: "no", labelFr: "Non", labelEn: "No" }
            ]
          }
        ]
      },
      {
        id: "relationship",
        titleFr: "Le lien avec la personne parrainée",
        titleEn: "Relationship with the sponsored person",
        fields: [
          {
            key: "relationshipType",
            labelFr: "Nature du lien",
            labelEn: "Type of relationship",
            type: "select",
            required: true,
            options: [
              { value: "spouse", labelFr: "Époux / épouse", labelEn: "Spouse" },
              { value: "common_law", labelFr: "Conjoint de fait", labelEn: "Common-law partner" },
              { value: "child", labelFr: "Enfant à charge", labelEn: "Dependent child" },
              { value: "parent", labelFr: "Parent ou grand-parent", labelEn: "Parent or grandparent" }
            ]
          },
          { key: "relationshipStart", labelFr: "Date du mariage ou du début de la vie commune", labelEn: "Date of marriage or start of cohabitation", type: "date", required: false },
          { key: "meetingStory", labelFr: "Comment vous êtes-vous rencontrés ? Décrivez l'évolution de la relation.", labelEn: "How did you meet? Describe how the relationship developed.", type: "text", required: true },
          { key: "proofOfRelationship", labelFr: "Déposer une preuve du lien (photos, communications, bail commun)", labelEn: "Upload proof of the relationship (photos, communications, joint lease)", type: "file", required: false }
        ]
      },
      SECTION_FAMILLE,
      SECTION_ANTECEDENTS
    ]
  },
  {
    slug: "visitor_super_visa",
    titleFr: "Questionnaire — Visiteur / Super visa",
    titleEn: "Questionnaire — Visitor / Super Visa",
    descriptionFr: "Informations nécessaires à une demande de visa de visiteur ou de super visa.",
    descriptionEn: "Information required for a visitor visa or super visa application.",
    sections: [
      SECTION_INFO_PERSO,
      {
        id: "visit",
        titleFr: "Le séjour prévu",
        titleEn: "Planned stay",
        fields: [
          { key: "arrivalDate", labelFr: "Date d'arrivée prévue", labelEn: "Expected arrival date", type: "date", required: true },
          { key: "departureDate", labelFr: "Date de départ prévue", labelEn: "Expected departure date", type: "date", required: true },
          { key: "purpose", labelFr: "Motif du séjour", labelEn: "Purpose of the stay", type: "text", required: true },
          { key: "hostName", labelFr: "Nom de la personne qui vous accueille au Canada", labelEn: "Name of your host in Canada", type: "text", required: false },
          { key: "hostRelationship", labelFr: "Lien avec cette personne", labelEn: "Relationship to that person", type: "text", required: false },
          { key: "availableFunds", labelFr: "Fonds disponibles pour le séjour ($ CAD)", labelEn: "Funds available for the stay ($ CAD)", type: "number", required: true },
          {
            key: "superVisa",
            labelFr: "S'agit-il d'une demande de super visa (parent ou grand-parent) ?",
            labelEn: "Is this a super visa application (parent or grandparent)?",
            type: "radio",
            required: true,
            options: [
              { value: "yes", labelFr: "Oui", labelEn: "Yes" },
              { value: "no", labelFr: "Non", labelEn: "No" }
            ]
          },
          { key: "medicalInsurance", labelFr: "Déposer la preuve d'assurance maladie (super visa)", labelEn: "Upload proof of medical insurance (super visa)", type: "file", required: false }
        ]
      },
      {
        id: "ties",
        titleFr: "Attaches au pays de résidence",
        titleEn: "Ties to your country of residence",
        fields: [
          { key: "currentJob", labelFr: "Emploi actuel et employeur", labelEn: "Current job and employer", type: "text", required: false },
          { key: "propertyOwned", labelFr: "Biens ou propriétés détenus", labelEn: "Property or assets owned", type: "text", required: false },
          { key: "familyRemaining", labelFr: "Membres de la famille qui restent dans votre pays", labelEn: "Family members remaining in your country", type: "text", required: false }
        ]
      },
      SECTION_VOYAGES,
      SECTION_ANTECEDENTS
    ]
  },
  {
    // Deux questionnaires courts, à envoyer seuls quand il ne manque qu'une
    // pièce du puzzle — plutôt que de renvoyer tout un questionnaire complet
    // à quelqu'un qui a déjà tout rempli.
    slug: "family_info",
    titleFr: "Questionnaire — Informations familiales",
    titleEn: "Questionnaire — Family Information",
    descriptionFr: "Recueil des informations sur la composition familiale : conjoint, enfants à charge, état matrimonial.",
    descriptionEn: "Collection of family composition details: spouse, dependent children, marital status.",
    sections: [SECTION_FAMILLE]
  },
  {
    slug: "work_history",
    titleFr: "Questionnaire — Historique professionnel",
    titleEn: "Questionnaire — Work History",
    descriptionFr: "Recueil de l'historique des emplois occupés, requis par la plupart des programmes économiques.",
    descriptionEn: "Collection of employment history, required by most economic programs.",
    sections: [SECTION_EMPLOI]
  }
];

export function getTemplateBySlug(slug: string): QuestionnaireTemplate | undefined {
  return QUESTIONNAIRE_TEMPLATES.find((t) => t.slug === slug);
}

/**
 * Nombre de questions d'un modèle.
 *
 * Les sous-champs d'un répéteur comptent pour un : « adresses des dix
 * dernières années » est UNE question posée au destinataire, quel que soit
 * le nombre de lignes qu'il finira par saisir. Compter les sous-champs
 * afficherait « 87 questions » là où l'écran en montre douze.
 */
export function compterQuestions(sections: FormSection[]): number {
  return sections.reduce((n, s) => n + s.fields.length, 0);
}
