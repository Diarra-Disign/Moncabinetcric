import { AgreementRecord, ClauseDefinition, GovernmentFee } from "../types"

export const MOCK_GOVERNMENT_FEES: GovernmentFee[] = [
  {
    id: "fee-01",
    code: "ircc_pr_processing_principal",
    labelFr: "Frais de traitement RP (Demandeur principal)",
    labelEn: "PR Processing Fee (Principal Applicant)",
    authority: "IRCC",
    jurisdiction: "federal",
    category: "processing",
    amountCents: 95000, // $950.00
    currency: "CAD",
    calcRule: "per_principal",
    sourceUrl: "https://www.cic.gc.ca/francais/information/frais/bareme.asp",
    effectiveFrom: "2026-01-01",
    isActive: true
  },
  {
    id: "fee-02",
    code: "ircc_pr_right_principal",
    labelFr: "Droit de résidence permanente (DRP)",
    labelEn: "Right of Permanent Residence Fee (RPRF)",
    authority: "IRCC",
    jurisdiction: "federal",
    category: "pr_right",
    amountCents: 57500, // $575.00
    currency: "CAD",
    calcRule: "per_principal",
    sourceUrl: "https://www.cic.gc.ca/francais/information/frais/bareme.asp",
    effectiveFrom: "2026-01-01",
    isActive: true
  },
  {
    id: "fee-03",
    code: "ircc_biometrics_individual",
    labelFr: "Frais de collecte des données biométriques (Individuel)",
    labelEn: "Biometrics Collection Fee (Individual)",
    authority: "IRCC",
    jurisdiction: "federal",
    category: "biometrics",
    amountCents: 8500, // $85.00
    currency: "CAD",
    calcRule: "per_principal",
    sourceUrl: "https://www.cic.gc.ca/francais/information/frais/bareme.asp",
    effectiveFrom: "2026-01-01",
    isActive: true
  },
  {
    id: "fee-04",
    code: "mifi_csq_processing_principal",
    labelFr: "Frais de traitement CSQ / Sélection Québec (Principal)",
    labelEn: "Quebec Selection Certificate CSQ Fee (Principal)",
    authority: "MIFI",
    jurisdiction: "QC",
    category: "processing",
    amountCents: 89500, // $895.00
    currency: "CAD",
    calcRule: "per_principal",
    sourceUrl: "http://www.immigration-quebec.gouv.qc.ca/fr/frais.html",
    effectiveFrom: "2026-01-01",
    isActive: true
  },
  {
    id: "fee-05",
    code: "ircc_work_permit_open",
    labelFr: "Frais de titulaire de permis de travail ouvert",
    labelEn: "Open Work Permit Holder Fee",
    authority: "IRCC",
    jurisdiction: "federal",
    category: "permit",
    amountCents: 10000, // $100.00
    currency: "CAD",
    calcRule: "per_principal",
    sourceUrl: "https://www.cic.gc.ca/francais/information/frais/bareme.asp",
    effectiveFrom: "2026-01-01",
    isActive: true
  }
]

export const MOCK_CLAUSES: ClauseDefinition[] = [
  {
    id: "clause-1",
    code: "mandate_scope",
    category: "mandate",
    level: "structural",
    titleFr: "1. Identification du Mandat & Portée des Services",
    titleEn: "1. Mandate Identification & Scope of Services",
    bodyFr: "Le cabinet s'engage à représenter le Client devant IRCC, le MIFI et les autorités canadiennes selon les services spécifiés dans la présente entente. Aucune prestation non mentionnée explicitement n'est couverte par ce mandat.",
    bodyEn: "The firm agrees to represent the Client before IRCC, MIFI, and Canadian authorities according to the services specified herein. Any service not explicitly mentioned is outside this mandate.",
    isEditable: false,
    isOptional: false
  },
  {
    id: "clause-2",
    code: "parties_contact_info",
    category: "mandate",
    level: "structural",
    titleFr: "2. Coordonnées Officiellement Validées des Parties (Conformité CICC)",
    titleEn: "2. Formally Validated Parties Contact Details (CICC Compliance)",
    bodyFr: "Toutes les communications officielles relatives à l'exécution du mandat, aux avis administratifs et aux déclarations IRCC seront envoyées à l'adresse postale, au téléphone et au courriel du Client indiqués à la section 1 de la présente entente. Le Client s'engage à notifier tout changement sous 7 jours.",
    bodyEn: "All official communications regarding mandate execution, administrative notices, and IRCC declarations will be sent to the Client's address, phone, and email listed in Section 1. The Client agrees to notify any changes within 7 days.",
    isEditable: false,
    isOptional: false
  },
  {
    id: "clause-3",
    code: "no_guarantee_result",
    category: "cicc_compliance",
    level: "cicc_required",
    titleFr: "3. Absence de Garantie du Résultat (Exigence Code CICC)",
    titleEn: "3. No Guarantee of Outcome (CICC Code Requirement)",
    bodyFr: "Le consultant réglementé en immigration (RCIC) agit avec diligence et compétence professionnelle. Toutefois, aucune garantie de délivrance de visa, permis, CSQ ou résidence permanente ne peut être accordée, la décision finale relevant de la compétence exclusive et souveraine du gouvernement du Canada et des provinces.",
    bodyEn: "The RCIC acts with professional diligence and skill. However, no guarantee of visa, permit, CSQ, or PR issuance can be provided, as final approval rests exclusively with the Canadian and provincial governments.",
    isEditable: false,
    isOptional: false
  },
  {
    id: "clause-4",
    code: "cicc_complaints",
    category: "cicc_compliance",
    level: "cicc_required",
    titleFr: "4. Procédure de Traitement des Différends & Plaintes CICC",
    titleEn: "4. Disputes & CICC Complaints Procedure",
    bodyFr: "En cas de différend, le Client s'adresse en premier lieu au consultant titulaire (Adama Diarra, RCIC #R000000, info@immigrationdemo.ca). Si le différend persiste, le Client conserve le droit inaliénable de porter plainte auprès du Collège des consultants en immigration et en citoyenneté (CICC) à complaints@college-ic.ca.",
    bodyEn: "In case of dispute, the Client first contacts the responsible RCIC (Adama Diarra, RCIC #R000000, info@immigrationdemo.ca). If unresolved, the Client retains the right to file a formal complaint with the CICC at complaints@college-ic.ca.",
    isEditable: true,
    isOptional: false
  },
  {
    id: "clause-5",
    code: "trust_account_art13",
    category: "trust",
    level: "cicc_required",
    titleFr: "5. Traitement des Fonds en Fidéicommis (Art. 13 du Règlement CICC)",
    titleEn: "5. Trust Funds Administration (Art. 13 CICC Regulation)",
    bodyFr: "Conformément à l'Art. 13 du Règlement du CICC, les acomptes d'honoraires et les avances de débours versés par le Client sont déposés dans le compte Fidéicommis séparé du cabinet (Banque Nationale du Canada) et ne sont transférés vers le compte général qu'après émission de la facture correspondante aux jalons d'avancement.",
    bodyEn: "Per Art. 13 of CICC Regulations, all retainer fees and disbursement advances paid by the Client are deposited into the firm's dedicated Trust Account (National Bank of Canada) and transferred to the general account only after invoice issuance upon milestone completions.",
    isEditable: false,
    isOptional: false
  },
  {
    id: "clause-6",
    code: "privacy_retention_6years",
    category: "cicc_compliance",
    level: "cicc_required",
    titleFr: "6. Protection des Données Personnelles & Conservation Obligatoire (6 ans)",
    titleEn: "6. Personal Data Protection & Mandatory Retention (6 Years)",
    bodyFr: "Les données personnelles et pièces justificatives du Client sont protégées et chiffrées selon les normes AES-256 et la Loi 25. Conformément à la réglementation du CICC, le cabinet a l'obligation légale de conserver le dossier physique/numérique pendant une période minimale de 6 ans à compter de la fermeture du dossier.",
    bodyEn: "The Client's personal data and supporting documents are encrypted per AES-256 and Law 25 standards. Per CICC regulations, the firm is legally required to retain the file for a minimum of 6 years following file closure.",
    isEditable: false,
    isOptional: false
  },
  {
    id: "clause-7",
    code: "custom_cancellation",
    category: "cancellation",
    level: "free",
    titleFr: "7. Modalités de Résiliation & Remboursement au Prorata",
    titleEn: "7. Cancellation & Pro-Rata Refund Terms",
    bodyFr: "Chaque partie peut résilier la présente entente moyennant préavis écrit de 7 jours. En cas de résiliation anticipée, les débours non engagés et le solde des honoraires non travaillés en Fidéicommis seront restitués au Client sous 15 jours.",
    bodyEn: "Either party may terminate this agreement upon 7 days written notice. In case of early termination, uncommitted disbursements and unearned retainer fees in Trust will be refunded to the Client within 15 days.",
    isEditable: true,
    isOptional: true
  }
]

export const MOCK_AGREEMENTS: AgreementRecord[] = [
  {
    id: "agr-01",
    reference: "SA-2026-000142",
    clientName: "Jean-François Tremblay",
    clientAddress: "7420 Boulevard Saint-Laurent, App. 402, Montréal (QC) H2R 1W6",
    clientCountryOfResidence: "Canada (Québec)",
    clientPhone: "+1 (514) 892-3401",
    clientEmail: "jf.tremblay@email.ca",
    matterId: "mat-01",
    program: "PEQ / Résidence Permanente",
    date: "01-08-2026",
    status: "fully_signed",
    persons: [
      { 
        id: "p-01", 
        personName: "Jean-François Tremblay", 
        partyRole: "principal", 
        isSignatory: true,
        address: "7420 Boulevard Saint-Laurent, App. 402, Montréal (QC) H2R 1W6",
        countryOfResidence: "Canada (Québec)",
        phone: "+1 (514) 892-3401",
        email: "jf.tremblay@email.ca"
      },
      { 
        id: "p-02", 
        personName: "Marie-Louise Tremblay", 
        partyRole: "spouse", 
        isSignatory: true,
        address: "7420 Boulevard Saint-Laurent, App. 402, Montréal (QC) H2R 1W6",
        countryOfResidence: "Canada (Québec)",
        phone: "+1 (514) 892-3409",
        email: "ml.tremblay@email.ca"
      }
    ],
    services: [
      {
        id: "srv-01",
        personId: "p-01",
        personName: "Jean-François Tremblay",
        programName: "Programme de l'Expérience Québécoise (PEQ)",
        scopeIncluded: "Constitution complète du dossier CSQ + Demande de RP fédérale IRCC",
        scopeExcluded: "Traduction certifiée de documents non fournis en français/anglais",
        feeCents: 350000 // $3,500.00
      },
      {
        id: "srv-02",
        personId: "p-02",
        personName: "Marie-Louise Tremblay",
        programName: "Permis de travail ouvert conjoint",
        scopeIncluded: "Dépôt conjoint et suivi permis de travail rattaché",
        scopeExcluded: "Frais de renouvellement ultérieur",
        feeCents: 120000 // $1,200.00
      }
    ],
    governmentFees: [
      { feeId: "fee-01", label: "Frais de traitement RP (Principal)", amountCents: 95000, quantity: 1 },
      { feeId: "fee-02", label: "Droit de résidence permanente (DRP)", amountCents: 57500, quantity: 1 },
      { feeId: "fee-04", label: "Frais CSQ Sélection Québec (Principal)", amountCents: 89500, quantity: 1 },
      { feeId: "fee-03", label: "Biométrie Individuelle (×2)", amountCents: 17000, quantity: 2 }
    ],
    discountCents: 20000, // $200.00 remise fidélité
    discountLabel: "Remise Client Privilégié",
    totalProfessionalFeesCents: 450000, // $4,500.00 HT ($4,700 - $200)
    totalGovernmentFeesCents: 259000, // $2,590.00 Débours
    tpsCents: 22500, // $225.00 (5%)
    tvqCents: 44888, // $448.88 (9.975%)
    grandTotalCents: 772388, // $7,723.88 CAD
    rcicName: "Adama Diarra",
    rcicLicenceNo: "R000000",
    signedAt: "01-08-2026 14:15",
    sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  },
  {
    id: "agr-02",
    reference: "SA-2026-000143",
    clientName: "Amadou Diallo",
    clientAddress: "1250 Rue de la Montagne, Bureau 800, Montréal (QC) H3G 2M1",
    clientCountryOfResidence: "Canada (Québec)",
    clientPhone: "+1 (514) 710-9922",
    clientEmail: "a.diallo@technord.ca",
    matterId: "mat-02",
    program: "EIMT & Permis de Travail B2B",
    date: "28-07-2026",
    status: "pending_signatures",
    persons: [
      { 
        id: "p-03", 
        personName: "Amadou Diallo", 
        partyRole: "principal", 
        isSignatory: true,
        address: "1250 Rue de la Montagne, Bureau 800, Montréal (QC) H3G 2M1",
        countryOfResidence: "Canada (Québec)",
        phone: "+1 (514) 710-9922",
        email: "a.diallo@technord.ca"
      },
      { 
        id: "p-04", 
        personName: "Technologies TechNord Inc.", 
        partyRole: "employer", 
        isSignatory: true,
        address: "1250 Rue de la Montagne, Bureau 800, Montréal (QC) H3G 2M1",
        countryOfResidence: "Canada (Québec)",
        phone: "+1 (514) 710-9000",
        email: "hr@technord.ca"
      }
    ],
    services: [
      {
        id: "srv-03",
        personId: "p-03",
        personName: "Amadou Diallo",
        programName: "Dossier EIMT Hauts Salaires & Permis Fermé",
        scopeIncluded: "Montage du dossier d'EIMT auprès d'EDSC et Permis de travail IRCC",
        scopeExcluded: "Étude d'impact sur le marché du travail préalable refusée par EDSC",
        feeCents: 480000 // $4,800.00
      }
    ],
    governmentFees: [
      { feeId: "fee-01", label: "Frais de traitement EIMT EDSC", amountCents: 100000, quantity: 1 },
      { feeId: "fee-03", label: "Biométrie Individuelle", amountCents: 8500, quantity: 1 }
    ],
    discountCents: 0,
    totalProfessionalFeesCents: 480000,
    totalGovernmentFeesCents: 108500,
    tpsCents: 24000,
    tvqCents: 47880,
    grandTotalCents: 660380, // $6,603.80 CAD
    rcicName: "Adama Diarra",
    rcicLicenceNo: "R000000"
  },
  {
    id: "agr-03",
    reference: "SA-2026-000144",
    clientName: "Elena Rostova",
    clientAddress: "Nevsky Prospekt 45, App. 12, Saint-Pétersbourg, Russie",
    clientCountryOfResidence: "Russie",
    clientPhone: "+7 911 402-8812",
    clientEmail: "elena.rostova@mail.ru",
    matterId: "mat-03",
    program: "Entrée Express Fédéral",
    date: "25-07-2026",
    status: "draft",
    persons: [
      { 
        id: "p-05", 
        personName: "Elena Rostova", 
        partyRole: "principal", 
        isSignatory: true,
        address: "Nevsky Prospekt 45, App. 12, Saint-Pétersbourg, Russie",
        countryOfResidence: "Russie",
        phone: "+7 911 402-8812",
        email: "elena.rostova@mail.ru"
      }
    ],
    services: [
      {
        id: "srv-04",
        personId: "p-05",
        personName: "Elena Rostova",
        programName: "Entrée Express - Travailleurs Qualifiés Fédéral",
        scopeIncluded: "Optimisation profil MonCIC + Dépôt résidence permanente après ITA",
        scopeExcluded: "Évaluation des diplômes EDE et test de langue TEF/TCF",
        feeCents: 290000 // $2,900.00
      }
    ],
    governmentFees: [
      { feeId: "fee-01", label: "Frais de traitement RP Principal", amountCents: 95000, quantity: 1 },
      { feeId: "fee-02", label: "Droit de résidence permanente (DRP)", amountCents: 57500, quantity: 1 }
    ],
    discountCents: 0,
    totalProfessionalFeesCents: 290000,
    totalGovernmentFeesCents: 152500,
    tpsCents: 14500,
    tvqCents: 28928,
    grandTotalCents: 485928, // $4,859.28 CAD
    rcicName: "Adama Diarra",
    rcicLicenceNo: "R000000"
  }
]
