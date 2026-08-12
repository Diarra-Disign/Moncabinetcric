export interface Matter {
  id: string
  clientName: string
  clientType?: "b2b" | "b2c"
  program: string
  category?: "pr" | "work" | "study" | "sponsorship" | "appeal"
  openedDate: string
  deadline: string
  rcic: string
  status: "valid" | "alert" | "review" | "pending"
  urgencyDays?: number
  notes?: string
  isPriority?: boolean
  clientId?: string
}

export interface Lead {
  id: string
  name: string
  firstName?: string
  lastName?: string
  company?: string
  type: "b2b" | "b2c"
  visaType: string
  estimatedValue: number
  score: number // 0-100
  scoreLabel: "high" | "med" | "low"
  stage: "newLead" | "consultation" | "proposal" | "negotiation" | "signed"
  lastContact: string
  email: string
  phone: string
  notes: string
  lmiaPositions?: number
  source?: string
  contactIntent?: "info" | "consultation" | "mandate"
  /** Code de civilité — mr | mrs | mx | other. Voir lib/data/identite.ts. */
  civility?: string | null
  /**
   * L'adresse postale du prospect. Facultative, et c'est délibéré : on ne la
   * demande pas au premier appel. Mais elle se saisit DÈS ce moment-là si on
   * l'a, parce que c'est elle que l'entente de service exigera — et la
   * conversion l'emmène au dossier du client.
   */
  address?: string
  addressLine2?: string
  city?: string
  province?: string
  postalCode?: string
  country?: string
}

/**
 * Le vocabulaire des statuts de facture, tel que la base le produit.
 *
 * Il était typé « paid | pending | trust_reconciled », trois valeurs
 * qu'invoice_status() n'a jamais rendues. Le mappeur les affirmait par un
 * `as` aveugle, donc TypeScript ne pouvait rien signaler — et l'écran
 * Facturation filtrait sur « pending », valeur qu'aucune facture ne porte :
 * son indicateur « en attente » affichait 0 $ quel que soit l'encours.
 *
 * Une union qui ment est pire qu'une absence de type : elle donne la
 * confiance sans la garantie.
 */
export type StatutFacture =
  | "draft" | "issued" | "overdue" | "partial" | "paid" | "cancelled"

export interface InvoiceRecord {
  id: string
  invoiceNumber: string // format : #FAC-AAAAMM##
  clientName: string
  serviceDescription?: string // "Description du service facturé"
  amount: number // $ CAD
  date: string
  status: StatutFacture
  isTrustAccount?: boolean
  matterId?: string
  clientId?: string
  taxExempt?: boolean
}

/**
 * Une facture vue depuis l'écran du cabinet.
 *
 * Distincte d'InvoiceRecord parce qu'elle porte ce que seule la vue SQL sait :
 * le statut CALCULÉ, le montant réglé et le solde. Les reprendre dans
 * InvoiceRecord obligerait tous ses autres producteurs à les inventer.
 */
export interface FactureCabinet {
  id: string
  numero: string
  clientId: string | null
  clientNom: string
  /** L'adresse que la confirmation d'envoi doit montrer avant d'expédier. */
  clientCourriel: string | null
  matterId: string | null
  /** La référence affichable du dossier — celle que porte l'adresse. */
  dossierReference: string | null
  description: string | null
  montant: number
  regle: number
  solde: number
  statut: StatutFacture
  date: string
  echeance: string | null
  enFideicommis: boolean
}

export interface ClientRecord {
  id: string
  fileNumber: string // format : CRIC-AAAA-####
  name: string
  firstName?: string
  lastName?: string
  email: string
  phone: string
  citizenship: string
  residence: string
  /**
   * L'ADRESSE POSTALE, distincte de `citizenship` et `residence`.
   *
   * Ces deux-là sont des PAYS — la nationalité et le pays de résidence, qui
   * servent au dossier d'immigration. Aucun des deux ne dit où l'on habite, et
   * on ne peut pas écrire « demeurant au Canada » en tête d'une entente et
   * appeler cela l'identification d'une partie.
   */
  address?: string
  /** Appartement, bureau, unité. */
  addressLine2?: string
  city?: string
  province?: string
  postalCode?: string
  country?: string
  program: string
  status: "active" | "consultation" | "pending"
  intakeMotif: string
  clientType?: "individual" | "employer"
  neqNumber?: string
  /** Code de civilité — mr | mrs | mx | other. Voir lib/data/identite.ts. */
  civility?: string | null
}

export interface DocumentRecord {
  id: string
  name: string
  type: string
  category: "client_upload" | "consultant_upload" | "contract" | "invoice" | "ircc_form"
  /** Nature détaillée — identifiant de lib/data/document-types.ts. */
  docType?: string
  uploadedBy: string
  date: string
  expiration: string
  source: string
  status: "valid" | "invalid" | "archived"
  matterId?: string
  clientId?: string
  clientName?: string
  fileSize?: string
  sha256?: string
  storagePath?: string
  fileUrl?: string
  content?: string
}

export interface FolderRecord {
  title: string
  files: number
  size: string
}

export interface ProgramChecklistItem {
  id: string
  nameFr: string
  nameEn: string
  code: string
  isRequired: boolean
  defaultStatus: "valid" | "expired" | "missing"
}

export interface ImmigrationProgram {
  id: string
  nameFr: string
  nameEn: string
  forms: string[]
  delayDays: number
  checklist: ProgramChecklistItem[]
}

export interface AuditLogEntry {
  id: string
  timestamp: string
  author: string
  actionFr: string
  actionEn: string
}

export interface CalendarEvent {
  /** Durée en minutes, pour calculer l'heure de fin. */
  durationMinutes?: number
  id: string
  title: string
  clientName: string
  clientInitials: string
  avatarBg: string
  matterId: string
  program: string
  type: "visio" | "deadline" | "signing"
  platform?: "zoom" | "google_meet" | "calendly"
  link?: string
  date: string // YYYY-MM-DD
  dayName: string // "31 juil. 2026"
  time: string // "10 h 00 – 11 h 00 (HE)"
  hour: number // 8 to 17
  status: "ready" | "pending_doc" | "completed"
  trustBalance?: string
  notes?: string
}

export interface GovernmentFee {
  id: string
  code: string
  labelFr: string
  labelEn: string
  authority: "IRCC" | "MIFI" | "ASFC" | "CISR"
  jurisdiction: "federal" | "QC" | "ON"
  category: "processing" | "pr_right" | "biometrics" | "permit" | "citizenship"
  amountCents: number
  currency: string
  calcRule: "per_principal" | "per_dependant" | "per_family" | "flat"
  sourceUrl: string
  effectiveFrom: string
  isActive: boolean
}

export interface ClauseDefinition {
  id: string
  code: string
  category: "mandate" | "fees" | "cicc_compliance" | "trust" | "cancellation" | "custom"
  level: "structural" | "cicc_required" | "free" // 1=Structural, 2=CICC, 3=Free
  titleFr: string
  titleEn: string
  bodyFr: string
  bodyEn: string
  isEditable: boolean
  isOptional: boolean
}

export interface AgreementPerson {
  id: string
  personName: string
  partyRole: "principal" | "spouse" | "child" | "sponsor" | "employer" | "third_party"
  isSignatory: boolean
  address?: string
  countryOfResidence?: string
  phone?: string
  email?: string
}

export interface AgreementService {
  id: string
  personId: string
  personName: string
  programName: string
  scopeIncluded: string
  scopeExcluded: string
  feeCents: number // Honoraires HT en centimes
}

export interface AgreementRecord {
  id: string
  reference: string // format : SA-AAAA-######
  /**
   * Contrat de consultation (art. 23) ou contrat de services (art. 24) du
   * Code de déontologie. Ce ne sont pas deux formules concurrentes : le
   * premier précède la consultation initiale, le second toute prestation.
   * Absent sur les ententes créées avant l'introduction de la distinction.
   */
  contractType?: "consultation" | "services"
  /** Objet et portée — exigé au contrat de consultation, art. 23(2)e). */
  consultationScope?: string
  /** Éléments de rédaction attestés par le titulaire, par renvoi au Code. */
  attestedElements?: string[]
  clientName: string
  clientAddress?: string
  clientCountryOfResidence?: string
  clientPhone?: string
  clientEmail?: string
  matterId?: string
  program: string
  date: string // "01-08-2026"
  status: "draft" | "pending_signatures" | "fully_signed" | "amended" | "cancelled"
  persons: AgreementPerson[]
  services: AgreementService[]
  governmentFees: {
    feeId: string
    label: string
    amountCents: number
    quantity: number
  }[]
  discountCents: number
  discountLabel?: string
  totalProfessionalFeesCents: number // Honoraires calculés HT
  totalGovernmentFeesCents: number // Débours exonérés
  tpsCents: number
  tvqCents: number
  isTaxExempt?: boolean // True si client réside hors-Canada (Exonération 0% taxes)
  grandTotalCents: number // Honoraires + Taxes + Débours
  rcicName: string
  rcicLicenceNo: string // numéro de permis CICC, ex. « R1041776 »
  signedAt?: string
  sha256?: string
}

export interface DeadlineRule {
  id: string
  code: string
  labelFr: string
  labelEn: string
  triggerEvent: "status_expiry" | "biometrics_request" | "ita_received" | "medical_expiry" | "lmia_expiry" | "restoration_window" | "caq_expiry" | "cicc_license_renewal" | "trust_reconciliation"
  offsetDays: number
  offsetDirection: "before" | "after"
  severity: "critical" | "high" | "normal"
  reminderOffsets: number[] // Ex. [90, 60, 30, 14, 7, 1]
  authority: string // Référence réglementaire officielle CICC / IRCC / LIPR / RIPR
  sourceUrl: string
  effectiveFrom: string // YYYY-MM-DD
  verifiedOn: string // Date de dernière vérification officielle
  isActive: boolean
}

export interface DeadlineRecord {
  id: string
  matterId?: string
  personId?: string
  clientName: string
  program: string
  title: string
  ruleCode?: string
  dueOn: string // YYYY-MM-DD
  daysRemaining: number
  severity: "critical" | "high" | "normal"
  status: "open" | "done" | "dismissed" | "superseded"
  assignedTo: string
  authority: string
  dismissedReason?: string
  completedAt?: string
  completedBy?: string
  sourceFact?: { type: string; date: string; refId?: string }
  isManual?: boolean
}

export interface CiccComplianceItem {
  id: string
  labelFr: string
  labelEn: string
  weight: number // Points sur 100
  isSatisfied: boolean
  detailFr: string
  detailEn: string
}

export interface CiccComplianceScore {
  /**
   * Score sur 100, ou null lorsqu'il n'y a rien à évaluer.
   *
   * null n'est pas une commodité : afficher « 95/100 — parfait » à un
   * cabinet sans aucun dossier était une attestation de conformité sans
   * fondement, portant qui plus est le nom d'un audit CICC.
   */
  totalScore: number | null
  status: "perfect" | "good" | "action_required" | "not_assessed"
  items: CiccComplianceItem[]
}

export interface AuditLogRecord {
  id: string
  occurredAt: string // ISO timestamp "2026-08-01T14:20:00Z"
  actorMemberId: string
  actorEmail: string
  actorName: string
  actorRole: "owner" | "rcic" | "risia" | "staff" | "bookkeeper" | "system"
  action: "view" | "create" | "update" | "delete" | "download" | "export" | "login" | "trust_transfer" | "approval"
  entityType: "matter" | "agreement" | "invoice" | "document" | "trust_account" | "approval_queue"
  entityId?: string
  matterId?: string
  summary: string // "Virement Fidéicommis vers Compte Général exécuté"
  changes?: Record<string, { before: unknown; after: unknown }>
  ipAddress: string
  userAgent: string
  prevHash: string
  rowHash: string // SHA-256 string
}

export interface ActionApprovalRecord {
  id: string
  firmId: string
  matterId?: string
  matterTitle: string
  clientName: string
  actionType: "sign_contract" | "submit_ircc" | "trust_transfer" | "close_matter"
  actionTitle: string
  summary: string
  payload: Record<string, unknown>
  preparedBy: string // nom du membre ayant préparé la pièce
  preparedByRole: "staff" | "risia"
  preparedAt: string
  approvedBy?: string // nom et permis du consultant approbateur
  approvedAt?: string
  rejectedReason?: string
  status: "pending" | "approved" | "rejected" | "executed"
  amountCents?: number
}

export interface AiConnectorSettings {
  enabled: boolean
  enabledBy: string // "Adama Diarra, CRIC (owner)"
  enabledAt?: string
  allowedMemberIds: string[]
  allowedActions: string[]
  reservedHumanActions: string[]
  guideUrl: string // "rcicapp.ca/connector"
}

export interface AiApiKeyRecord {
  id: string
  name: string // "ChatGPT Custom GPT - A. Diarra, CRIC"
  keyPrefix: string // "cric_live_7a8b..."
  secretHash: string
  createdForMemberId: string
  createdForMemberName: string
  createdAt: string
  lastUsedAt?: string
  isActive: boolean
}

export interface AiConnectorLogRecord {
  id: string
  occurredAt: string
  apiKeyPrefix: string
  clientIp: string
  action: string
  resourceId?: string
  status: "success" | "forbidden_reserved" | "disabled" | "error"
  summary: string
  rowHash: string
}

export type LegislationInstrument = "lipr" | "ripr" | "loi_citoyennete"

export interface LegislationProvision {
  id: string
  instrument: LegislationInstrument
  provisionNo: string // "38(1)"
  hierarchyPath: string // "Partie 1 / Section 3 / Article 38"
  headingFr: string
  headingEn: string
  bodyFr: string
  bodyEn: string
  consolidatedOn: string // YYYY-MM-DD
  sourceUrl: string // justice.gc.ca official URL
  citingCaseCount?: number
  tags?: string[]
  /** Sélection éditoriale des dispositions les plus consultées en pratique. */
  frequentlyUsed?: boolean
}

export interface ResearchSource {
  id: string
  workspaceId: string
  provisionId: string
  provisionNo: string
  instrument: LegislationInstrument
  headingFr: string
  headingEn: string
  citationSnapshot: string
  textSnapshotFr: string
  textSnapshotEn: string
  note?: string
  sortOrder: number
  addedAt: string
}

export interface ResearchWorkspace {
  id: string
  title: string
  matterId?: string
  matterReference?: string
  clientName?: string
  program?: string
  createdBy: string
  createdAt: string
  updatedAt: string
  sources: ResearchSource[]
  notes?: string
}

export interface QuestionnaireCorrection {
  sectionId: string
  fieldKey?: string
  comment: string
  status: "pending" | "resolved"
  requestedAt: string
}

export interface QuestionnaireHistoryEntry {
  userId: string
  userName: string
  userType: "consultant" | "client"
  changedAt: string
  sectionId: string
  fieldKey: string
  fieldName: string
  oldValue: unknown
  newValue: unknown
}

/** Statuts réellement stockés. « expiré » n'en fait pas partie : il se calcule. */
export type QuestionnaireStatus =
  | "draft" | "sent" | "opened" | "in_progress" | "submitted"
  | "to_correct" | "corrected" | "completed" | "cancelled"

/** Ce que voit l'écran : les statuts stockés, plus celui que le temps produit. */
export type QuestionnaireStatusAffiche = QuestionnaireStatus | "expired"

export interface QuestionnaireTemplateRecord {
  id: string
  /** Nul pour un modèle fourni avec le logiciel, partagé et non modifiable. */
  firmId: string | null
  slug: string
  titleFr: string
  titleEn: string
  descriptionFr: string
  descriptionEn: string
  sections: FormSectionShape[]
  messageFr: string
  messageEn: string
  isDefaultPreconsultation: boolean
  active: boolean
  updatedAt: string
  /** Nombre d'envois faits depuis ce modèle : compté, jamais incrémenté à la main. */
  usageCount: number
}

/**
 * Forme d'une section telle qu'elle voyage en base.
 *
 * Volontairement structurelle et non importée de questionnaire-templates.ts :
 * ce fichier décrit le catalogue de DÉPART, alors qu'une section peut venir
 * d'un modèle que le consultant a créé lui-même et que le code n'a jamais vu.
 */
export interface FormSectionShape {
  id: string
  titleFr: string
  titleEn: string
  fields: FormFieldShape[]
}

export interface FormFieldShape {
  key: string
  labelFr: string
  labelEn: string
  type: string
  required: boolean
  options?: { value: string; labelFr: string; labelEn: string }[]
  fields?: FormFieldShape[]
  instructionsFr?: string
  instructionsEn?: string
}

export interface ClientQuestionnaire {
  id: string
  firmId: string
  /** Le destinataire est un client OU un prospect, jamais les deux. */
  clientId?: string
  leadId?: string
  matterId?: string
  templateId?: string
  title: string
  description?: string
  /**
   * Les questions telles qu'elles étaient À L'ENVOI.
   *
   * Pas une référence au modèle : si le consultant remanie le modèle pendant
   * qu'un client remplit, les réponses déjà saisies désigneraient des champs
   * disparus.
   */
  sections: FormSectionShape[]
  message: string
  status: QuestionnaireStatus
  /** Statut calculé, celui qu'il faut afficher : ajoute « expiré ». */
  statusAffiche: QuestionnaireStatusAffiche
  progress: number // de 0 à 100
  dueDate?: string
  sentAt?: string
  openedAt?: string
  submittedAt?: string
  completedAt?: string
  remindedAt?: string
  reminderCount: number
  createdAt: string
  updatedAt: string
  lastSavedAt?: string
  answers: Record<string, unknown>
  /** Ce que le cabinet savait déjà (§25), gardé à part des réponses. */
  prefill: Record<string, unknown>
  corrections: QuestionnaireCorrection[]
  history: QuestionnaireHistoryEntry[]
  /** Vrai si un lien d'accès existe et n'a pas été révoqué. */
  lienActif: boolean
  /** Nom du destinataire, résolu à la lecture pour la liste des envois. */
  destinataireNom?: string
  destinataireCourriel?: string
}

