import type { DocumentRecord } from "@/lib/data/types"
import type { TypeContratCicc } from "@/lib/legal/cicc-contrats"

/**
 * Nature détaillée d'un fichier déposé au dossier.
 *
 * Le champ `category` existant ne dit que l'origine du fichier — cinq valeurs,
 * dont « fourni par le client », qui recouvre aussi bien un passeport qu'un
 * relevé bancaire. Classer à ce grain oblige à rouvrir chaque fiche pour
 * savoir ce qu'elle contient.
 *
 * Ce module ajoute la nature du document sans toucher à l'origine : chaque
 * type détaillé porte la catégorie dont il relève, si bien que les filtres et
 * les compteurs existants continuent de fonctionner à l'identique.
 *
 * Les types de contrat renvoient aux articles 23 et 24 du Code de déontologie
 * (DORS/2022-128) — voir lib/legal/cicc-contrats.ts. Les numéros de
 * formulaires sont ceux publiés par IRCC ; ils changent, et le libellé sert
 * de repère, pas de garantie que la version en vigueur porte encore ce
 * numéro.
 */

export interface TypeDocument {
  id: string
  labelFr: string
  labelEn: string
  /** Origine du fichier — reprend les valeurs déjà en base. */
  category: DocumentRecord["category"]
  /** Renvoi au Code de déontologie, pour les documents qu'il régit. */
  refCode?: string
  /** Contrat que ce type matérialise, s'il y a lieu. */
  contrat?: TypeContratCicc
}

export interface GroupeTypesDocument {
  id: string
  labelFr: string
  labelEn: string
  types: TypeDocument[]
}

export const GROUPES_TYPES_DOCUMENT: GroupeTypesDocument[] = [
  {
    id: "contrats",
    labelFr: "Contrats et ententes",
    labelEn: "Contracts and agreements",
    types: [
      {
        id: "contrat_consultation",
        labelFr: "Contrat de consultation initiale",
        labelEn: "Initial consultation contract",
        category: "contract",
        refCode: "23",
        contrat: "consultation",
      },
      {
        id: "contrat_services",
        labelFr: "Contrat de services",
        labelEn: "Service agreement",
        category: "contract",
        refCode: "24",
        contrat: "services",
      },
      {
        id: "modification_contrat",
        labelFr: "Modification écrite au contrat de services",
        labelEn: "Written amendment to the service agreement",
        category: "contract",
        refCode: "24(5)",
      },
      {
        id: "consentement_depassement",
        labelFr: "Consentement écrit à un dépassement d’honoraires ou de débours",
        labelEn: "Written consent to fees or disbursements above estimate",
        category: "contract",
        refCode: "31(3)",
      },
      {
        id: "resiliation_contrat",
        labelFr: "Résiliation du contrat de services",
        labelEn: "Termination of the service agreement",
        category: "contract",
        refCode: "32",
      },
      {
        id: "remise_code",
        labelFr: "Accusé de remise du Code de déontologie au client",
        labelEn: "Acknowledgement that the Code was given to the client",
        category: "contract",
        refCode: "24(3)x)",
      },
      {
        id: "imm5476",
        labelFr: "IMM 5476 — Recours aux services d’un représentant",
        labelEn: "IMM 5476 — Use of a Representative",
        category: "ircc_form",
      },
      {
        id: "imm5475",
        labelFr: "IMM 5475 — Autorisation de communiquer des renseignements",
        labelEn: "IMM 5475 — Authority to Release Personal Information",
        category: "ircc_form",
      },
    ],
  },
  {
    id: "identite",
    labelFr: "Identité et état civil",
    labelEn: "Identity and civil status",
    types: [
      { id: "passeport", labelFr: "Passeport", labelEn: "Passport", category: "client_upload" },
      {
        id: "piece_identite",
        labelFr: "Pièce d’identité nationale",
        labelEn: "National identity document",
        category: "client_upload",
      },
      {
        id: "acte_naissance",
        labelFr: "Acte ou certificat de naissance",
        labelEn: "Birth certificate",
        category: "client_upload",
      },
      {
        id: "acte_mariage",
        labelFr: "Acte de mariage ou d’union de fait",
        labelEn: "Marriage or common-law certificate",
        category: "client_upload",
      },
      {
        id: "divorce",
        labelFr: "Jugement de divorce ou de séparation",
        labelEn: "Divorce or separation judgment",
        category: "client_upload",
      },
      {
        id: "garde_enfant",
        labelFr: "Jugement de garde ou autorisation parentale",
        labelEn: "Custody order or parental authorization",
        category: "client_upload",
      },
      {
        id: "photo_identite",
        labelFr: "Photo d’identité",
        labelEn: "Identity photo",
        category: "client_upload",
      },
    ],
  },
  {
    id: "statut",
    labelFr: "Statut et antécédents d’immigration",
    labelEn: "Status and immigration history",
    types: [
      {
        id: "visa_permis",
        labelFr: "Visa, permis d’études ou de travail en cours",
        labelEn: "Current visa, study or work permit",
        category: "client_upload",
      },
      {
        id: "fiche_etablissement",
        labelFr: "Confirmation de résidence permanente (IMM 5292 / IMM 5688)",
        labelEn: "Confirmation of Permanent Residence",
        category: "client_upload",
      },
      {
        id: "carte_rp",
        labelFr: "Carte de résident permanent",
        labelEn: "Permanent resident card",
        category: "client_upload",
      },
      {
        id: "historique_voyages",
        labelFr: "Historique de voyages et tampons",
        labelEn: "Travel history and stamps",
        category: "client_upload",
      },
      {
        id: "refus_anterieur",
        labelFr: "Refus, retrait ou interdiction de territoire antérieurs",
        labelEn: "Prior refusal, withdrawal or inadmissibility",
        category: "client_upload",
      },
      {
        id: "notes_sgc",
        labelFr: "Notes du SMGC obtenues par accès à l’information",
        labelEn: "GCMS notes obtained through ATIP",
        category: "client_upload",
      },
    ],
  },
  {
    id: "formulaires",
    labelFr: "Formulaires IRCC et MIFI",
    labelEn: "IRCC and MIFI forms",
    types: [
      {
        id: "imm0008",
        labelFr: "IMM 0008 — Demande générique de résidence permanente",
        labelEn: "IMM 0008 — Generic Application for Permanent Residence",
        category: "ircc_form",
      },
      {
        id: "imm5669",
        labelFr: "IMM 5669 — Antécédents et déclaration",
        labelEn: "IMM 5669 — Schedule A: Background/Declaration",
        category: "ircc_form",
      },
      {
        id: "imm5406",
        labelFr: "IMM 5406 — Renseignements additionnels sur la famille",
        labelEn: "IMM 5406 — Additional Family Information",
        category: "ircc_form",
      },
      {
        id: "imm5257",
        labelFr: "IMM 5257 — Visa de résident temporaire",
        labelEn: "IMM 5257 — Temporary Resident Visa",
        category: "ircc_form",
      },
      {
        id: "imm1294",
        labelFr: "IMM 1294 — Permis d’études",
        labelEn: "IMM 1294 — Study Permit",
        category: "ircc_form",
      },
      {
        id: "imm1295",
        labelFr: "IMM 1295 — Permis de travail hors du Canada",
        labelEn: "IMM 1295 — Work Permit Outside Canada",
        category: "ircc_form",
      },
      {
        id: "imm5710",
        labelFr: "IMM 5710 — Prorogation de séjour au Canada",
        labelEn: "IMM 5710 — Extend Stay in Canada",
        category: "ircc_form",
      },
      {
        id: "imm1344",
        labelFr: "IMM 1344 — Engagement de parrainage",
        labelEn: "IMM 1344 — Sponsorship Undertaking",
        category: "ircc_form",
      },
      {
        id: "arrima_csq",
        labelFr: "Déclaration d’intérêt Arrima ou demande de CSQ",
        labelEn: "Arrima expression of interest or CSQ application",
        category: "ircc_form",
      },
      {
        id: "formulaire_autre",
        labelFr: "Autre formulaire officiel",
        labelEn: "Other official form",
        category: "ircc_form",
      },
    ],
  },
  {
    id: "emploi_etudes",
    labelFr: "Emploi et études",
    labelEn: "Employment and studies",
    types: [
      {
        id: "offre_emploi",
        labelFr: "Offre d’emploi",
        labelEn: "Job offer",
        category: "client_upload",
      },
      {
        id: "eimt",
        labelFr: "EIMT / décision LMIA",
        labelEn: "LMIA decision",
        category: "client_upload",
      },
      {
        id: "lettre_employeur",
        labelFr: "Lettre d’expérience de travail",
        labelEn: "Employment reference letter",
        category: "client_upload",
      },
      {
        id: "cv",
        labelFr: "Curriculum vitæ",
        labelEn: "Résumé",
        category: "client_upload",
      },
      {
        id: "lettre_admission",
        labelFr: "Lettre d’admission d’un établissement désigné",
        labelEn: "Letter of acceptance from a designated institution",
        category: "client_upload",
      },
      { id: "caq", labelFr: "CAQ pour études", labelEn: "CAQ for studies", category: "client_upload" },
      {
        id: "diplomes",
        labelFr: "Diplômes et relevés de notes",
        labelEn: "Diplomas and transcripts",
        category: "client_upload",
      },
      {
        id: "eda",
        labelFr: "Évaluation des diplômes d’études (EDE / ECA)",
        labelEn: "Educational Credential Assessment",
        category: "client_upload",
      },
    ],
  },
  {
    id: "langue",
    labelFr: "Compétences linguistiques",
    labelEn: "Language ability",
    types: [
      {
        id: "test_anglais",
        labelFr: "Résultats de test d’anglais (IELTS, CELPIP, PTE)",
        labelEn: "English test results",
        category: "client_upload",
      },
      {
        id: "test_francais",
        labelFr: "Résultats de test de français (TEF, TCF)",
        labelEn: "French test results",
        category: "client_upload",
      },
    ],
  },
  {
    id: "finances",
    labelFr: "Capacité financière",
    labelEn: "Financial capacity",
    types: [
      {
        id: "preuve_fonds",
        labelFr: "Preuve de fonds",
        labelEn: "Proof of funds",
        category: "client_upload",
      },
      {
        id: "releves_bancaires",
        labelFr: "Relevés bancaires",
        labelEn: "Bank statements",
        category: "client_upload",
      },
      {
        id: "avis_cotisation",
        labelFr: "Avis de cotisation, T4 ou relevés d’impôt",
        labelEn: "Notice of assessment, T4 or tax records",
        category: "client_upload",
      },
      {
        id: "engagement_financier",
        labelFr: "Engagement ou attestation de prise en charge",
        labelEn: "Financial undertaking or support letter",
        category: "client_upload",
      },
    ],
  },
  {
    id: "medical_securite",
    labelFr: "Médical et sécurité",
    labelEn: "Medical and security",
    types: [
      {
        id: "examen_medical",
        labelFr: "Examen médical aux fins de l’immigration",
        labelEn: "Immigration medical examination",
        category: "client_upload",
      },
      {
        id: "certificat_police",
        labelFr: "Certificat de police",
        labelEn: "Police certificate",
        category: "client_upload",
      },
      {
        id: "biometrie",
        labelFr: "Confirmation de collecte des données biométriques",
        labelEn: "Biometrics collection confirmation",
        category: "client_upload",
      },
    ],
  },
  {
    id: "correspondance",
    labelFr: "Correspondance officielle et décisions",
    labelEn: "Official correspondence and decisions",
    types: [
      {
        id: "accuse_reception",
        labelFr: "Accusé de réception de la demande",
        labelEn: "Acknowledgement of receipt",
        category: "client_upload",
      },
      {
        id: "demande_documents",
        labelFr: "Demande de documents supplémentaires",
        labelEn: "Request for additional documents",
        category: "client_upload",
      },
      {
        id: "lettre_equite",
        labelFr: "Lettre d’équité procédurale",
        labelEn: "Procedural fairness letter",
        category: "client_upload",
      },
      {
        id: "convocation",
        labelFr: "Convocation à une entrevue ou à une audience",
        labelEn: "Interview or hearing notice",
        category: "client_upload",
      },
      {
        id: "decision",
        labelFr: "Décision — approbation ou refus",
        labelEn: "Decision — approval or refusal",
        category: "client_upload",
      },
    ],
  },
  {
    id: "travail_cabinet",
    labelFr: "Travail du cabinet",
    labelEn: "Firm work product",
    types: [
      {
        id: "notes_consultation",
        labelFr: "Notes de consultation",
        labelEn: "Consultation notes",
        category: "consultant_upload",
      },
      {
        id: "analyse_admissibilite",
        labelFr: "Analyse d’admissibilité",
        labelEn: "Eligibility assessment",
        category: "consultant_upload",
      },
      {
        id: "lettre_explication",
        labelFr: "Lettre d’explication soumise avec la demande",
        labelEn: "Letter of explanation filed with the application",
        category: "consultant_upload",
      },
      {
        id: "observations",
        labelFr: "Observations écrites ou plaidoirie",
        labelEn: "Written submissions",
        category: "consultant_upload",
      },
      {
        id: "liste_controle",
        labelFr: "Liste de contrôle des pièces",
        labelEn: "Document checklist",
        category: "consultant_upload",
      },
      {
        id: "correspondance_client",
        labelFr: "Correspondance avec le client",
        labelEn: "Correspondence with the client",
        category: "consultant_upload",
      },
      {
        id: "note_dossier",
        labelFr: "Note au dossier",
        labelEn: "File note",
        category: "consultant_upload",
      },
      {
        id: "traduction",
        labelFr: "Traduction certifiée et déclaration du traducteur",
        labelEn: "Certified translation and translator's declaration",
        category: "consultant_upload",
        refCode: "22(4)",
      },
    ],
  },
  {
    id: "facturation",
    labelFr: "Facturation et fidéicommis",
    labelEn: "Billing and trust account",
    types: [
      { id: "facture", labelFr: "Facture", labelEn: "Invoice", category: "invoice" },
      { id: "recu", labelFr: "Reçu de paiement", labelEn: "Payment receipt", category: "invoice" },
      {
        id: "recu_fideicommis",
        labelFr: "Reçu de dépôt en fidéicommis",
        labelEn: "Trust account deposit receipt",
        category: "invoice",
      },
      {
        id: "releve_fideicommis",
        labelFr: "Relevé du compte en fidéicommis",
        labelEn: "Trust account statement",
        category: "invoice",
      },
      {
        id: "remboursement",
        labelFr: "Remboursement au client",
        labelEn: "Refund to client",
        category: "invoice",
      },
      {
        id: "recu_frais_gouv",
        labelFr: "Reçu de frais gouvernementaux",
        labelEn: "Government fee receipt",
        category: "invoice",
      },
    ],
  },
  {
    id: "autre",
    labelFr: "Autre",
    labelEn: "Other",
    types: [
      {
        id: "autre_client",
        labelFr: "Autre pièce fournie par le client",
        labelEn: "Other client-provided document",
        category: "client_upload",
      },
      {
        id: "autre_cabinet",
        labelFr: "Autre document produit par le cabinet",
        labelEn: "Other firm-produced document",
        category: "consultant_upload",
      },
    ],
  },
]

/** Index plat, pour retrouver un type par son identifiant. */
export const TYPES_DOCUMENT: Record<string, TypeDocument> = Object.fromEntries(
  GROUPES_TYPES_DOCUMENT.flatMap((g) => g.types.map((t) => [t.id, t]))
)

/** Origine correspondant à un type détaillé ; « client_upload » si inconnu. */
export function categoriePourType(typeId: string | null | undefined): DocumentRecord["category"] {
  return TYPES_DOCUMENT[typeId ?? ""]?.category ?? "client_upload"
}

export function libelleType(typeId: string | null | undefined, locale: string): string | null {
  const t = TYPES_DOCUMENT[typeId ?? ""]
  if (!t) return null
  return locale.startsWith("en") ? t.labelEn : t.labelFr
}

export function libelleGroupe(groupe: GroupeTypesDocument, locale: string): string {
  return locale.startsWith("en") ? groupe.labelEn : groupe.labelFr
}
