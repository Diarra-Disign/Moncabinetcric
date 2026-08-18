import type {
  Matter,
  Lead,
  InvoiceRecord,
  ClientRecord,
  DocumentRecord,
  CalendarEvent,
  AuditLogRecord,
  ClientQuestionnaire,
  QuestionnaireCorrection,
  QuestionnaireHistoryEntry,
  QuestionnaireTemplateRecord,
} from "../types"

/**
 * Conversion des lignes Postgres (snake_case) vers les types du domaine
 * (camelCase de lib/data/types.ts).
 *
 * L'UI ne voit jamais une ligne brute : elle continue de recevoir
 * exactement les mêmes formes qu'avec les mocks. C'est ce qui permet le
 * branchement sans toucher aux composants.
 */

type Row = Record<string, unknown>

const str = (v: unknown): string => (v == null ? "" : String(v))
const optStr = (v: unknown): string | undefined => (v == null ? undefined : String(v))
const num = (v: unknown): number => (v == null ? 0 : Number(v))
const optNum = (v: unknown): number | undefined => (v == null ? undefined : Number(v))
const bool = (v: unknown): boolean => v === true

/** Les dates arrivent en "YYYY-MM-DD" ou en timestamptz ; on garde la partie date. */
const dateStr = (v: unknown): string => {
  if (v == null) return ""
  const s = String(v)
  return s.includes("T") ? s.split("T")[0] : s
}

export function toMatter(r: Row): Matter {
  return {
    // On expose la référence métier (#DOS-35695), pas l'uuid technique :
    // c'est elle que l'UI et les URLs manipulent déjà.
    id: str(r.reference),
    clientName: str(r.client_name),
    clientType: (r.client_type as Matter["clientType"]) ?? undefined,
    program: str(r.program),
    category: (r.category as Matter["category"]) ?? undefined,
    openedDate: dateStr(r.opened_date),
    deadline: dateStr(r.deadline),
    rcic: str(r.rcic),
    status: r.status as Matter["status"],
    urgencyDays: optNum(r.urgency_days),
    notes: optStr(r.notes),
    isPriority: bool(r.is_priority),
    clientId: optStr((r.clients as Row | null)?.legacy_id || r.client_id),
  }
}

export function toClient(r: Row): ClientRecord {
  return {
    id: str(r.legacy_id || r.id),
    fileNumber: str(r.file_number),
    name: str(r.name),
    firstName: optStr(r.first_name),
    lastName: optStr(r.last_name),
    email: str(r.email),
    phone: str(r.phone),
    citizenship: str(r.citizenship),
    residence: str(r.residence),
    address: optStr(r.address),
    addressLine2: optStr(r.address_line2),
    city: optStr(r.city),
    postalCode: optStr(r.postal_code),
    country: optStr(r.country),
    province: optStr(r.province),
    program: str(r.program),
    status: r.status as ClientRecord["status"],
    intakeMotif: str(r.intake_motif),
    clientType: (r.client_type as ClientRecord["clientType"]) ?? undefined,
    neqNumber: optStr(r.neq_number),
    civility: optStr(r.civility) ?? null,
  }
}

export function toLead(r: Row): Lead {
  return {
    id: str(r.legacy_id || r.id),
    name: str(r.name),
    firstName: optStr(r.first_name),
    lastName: optStr(r.last_name),
    company: optStr(r.company),
    type: r.type as Lead["type"],
    visaType: str(r.visa_type),
    estimatedValue: num(r.estimated_value),
    score: num(r.score),
    scoreLabel: r.score_label as Lead["scoreLabel"],
    stage: r.stage as Lead["stage"],
    lastContact: dateStr(r.last_contact),
    email: str(r.email),
    phone: str(r.phone),
    notes: str(r.notes),
    lmiaPositions: optNum(r.lmia_positions),
    source: optStr(r.source),
    contactIntent: (optStr(r.contact_intent) as Lead["contactIntent"]) ?? undefined,
    civility: optStr(r.civility) ?? null,
    address: optStr(r.address),
    addressLine2: optStr(r.address_line2),
    city: optStr(r.city),
    postalCode: optStr(r.postal_code),
    country: optStr(r.country),
    province: optStr(r.province),
  }
}

export function toInvoice(r: Row): InvoiceRecord {
  return {
    id: str(r.legacy_id || r.id),
    invoiceNumber: str(r.invoice_number),
    clientName: str(r.client_name),
    serviceDescription: optStr(r.service_description),
    amount: num(r.amount),
    date: dateStr(r.date),
    status: r.status as InvoiceRecord["status"],
    isTrustAccount: bool(r.is_trust_account),
    matterId: optStr((r.matters as Row | null)?.reference),
    clientId: optStr((r.clients as Row | null)?.legacy_id),
    taxExempt: bool(r.tax_exempt),
  }
}

export function toDocument(r: Row): DocumentRecord {
  return {
    id: str(r.legacy_id || r.id),
    name: str(r.name),
    type: str(r.type),
    category: r.category as DocumentRecord["category"],
    docType: optStr(r.doc_type),
    uploadedBy: str(r.uploaded_by),
    date: dateStr(r.date),
    expiration: str(r.expiration),
    source: str(r.source),
    status: r.status as DocumentRecord["status"],
    matterId: optStr((r.matters as Row | null)?.reference),
    clientId: optStr((r.clients as Row | null)?.legacy_id),
    clientName: optStr(r.client_name),
    fileSize: optStr(r.file_size),
    sha256: optStr(r.sha256),
    storagePath: optStr(r.storage_path),
    fileUrl: optStr(r.file_url),
    content: optStr(r.content),
  }
}

export function toCalendarEvent(r: Row): CalendarEvent {
  return {
    id: str(r.legacy_id || r.id),
    title: str(r.title),
    clientName: str(r.client_name),
    clientInitials: str(r.client_initials),
    avatarBg: str(r.avatar_bg),
    matterId: str((r.matters as Row | null)?.reference),
    clientId: optStr(r.client_id),
    program: str(r.program),
    type: r.type as CalendarEvent["type"],
    platform: (r.platform as CalendarEvent["platform"]) ?? undefined,
    link: optStr(r.link),
    date: dateStr(r.date),
    dayName: str(r.day_name),
    time: str(r.time),
    hour: num(r.hour) || 9,
    durationMinutes: optNum(r.duration_minutes) || 60,
    status: r.status as CalendarEvent["status"],
    trustBalance: optStr(r.trust_balance),
    notes: optStr(r.notes),
  }
}

export function toAuditLog(r: Row): AuditLogRecord {
  return {
    id: str(r.legacy_id || r.id),
    occurredAt: str(r.occurred_at),
    actorMemberId: str(r.actor_member_id),
    actorEmail: str(r.actor_email),
    actorName: str(r.actor_name),
    actorRole: r.actor_role as AuditLogRecord["actorRole"],
    action: r.action as AuditLogRecord["action"],
    entityType: r.entity_type as AuditLogRecord["entityType"],
    entityId: optStr(r.entity_id),
    matterId: optStr(r.matter_id),
    summary: str(r.summary),
    changes: (r.changes as AuditLogRecord["changes"]) ?? undefined,
    ipAddress: str(r.ip_address),
    userAgent: str(r.user_agent),
    prevHash: str(r.prev_hash),
    rowHash: str(r.row_hash),
  }
}

/**
 * Statut affiché, calculé ici comme il l'est en base.
 *
 * La règle est écrite deux fois — dans questionnaire_status() et ici — parce
 * qu'un questionnaire lu par un chemin qui n'appelle pas la fonction doit
 * quand même s'afficher « expiré ». Les deux versions doivent donc rester
 * d'accord ; ./cric questionnaires les confronte sur les mêmes cas.
 */
function statutAffiche(r: Row): ClientQuestionnaire["statusAffiche"] {
  const stocke = r.status as ClientQuestionnaire["status"]
  if (["completed", "cancelled", "submitted", "corrected"].includes(stocke)) return stocke
  if (r.token_revoked_at) return "cancelled"
  if (r.due_date && new Date(String(r.due_date)) < new Date()) return "expired"
  return stocke
}

export function toQuestionnaire(r: Row): ClientQuestionnaire {
  const client = r.clients as Row | null
  const lead = r.leads as Row | null

  return {
    id: str(r.id),
    firmId: str(r.firm_id),
    clientId: r.client_id ? optStr(client?.legacy_id) || str(r.client_id) : undefined,
    leadId: r.lead_id ? optStr(lead?.legacy_id) || str(r.lead_id) : undefined,
    matterId: r.matter_id ? optStr((r.matters as Row | null)?.reference) || str(r.matter_id) : undefined,
    templateId: optStr(r.template_id),
    title: str(r.title),
    description: optStr(r.description),
    sections: (r.sections as ClientQuestionnaire["sections"]) ?? [],
    message: str(r.message),
    status: r.status as ClientQuestionnaire["status"],
    statusAffiche: statutAffiche(r),
    progress: num(r.progress),
    dueDate: optStr(r.due_date),
    sentAt: optStr(r.sent_at),
    openedAt: optStr(r.opened_at),
    submittedAt: optStr(r.submitted_at),
    completedAt: optStr(r.completed_at),
    remindedAt: optStr(r.reminded_at),
    reminderCount: num(r.reminder_count),
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
    lastSavedAt: optStr(r.last_saved_at),
    answers: (r.answers as Record<string, unknown>) ?? {},
    prefill: (r.prefill as Record<string, unknown>) ?? {},
    corrections: (r.corrections as QuestionnaireCorrection[]) ?? [],
    history: (r.history as QuestionnaireHistoryEntry[]) ?? [],
    lienActif: Boolean(r.token_hash) && !r.token_revoked_at,
    destinataireNom: optStr(client?.name) || optStr(lead?.name),
    destinataireCourriel: optStr(client?.email) || optStr(lead?.email),
  }
}

export function toQuestionnaireTemplate(r: Row): QuestionnaireTemplateRecord {
  return {
    id: str(r.id),
    firmId: r.firm_id ? str(r.firm_id) : null,
    slug: str(r.slug),
    titleFr: str(r.title_fr),
    titleEn: str(r.title_en),
    descriptionFr: str(r.description_fr),
    descriptionEn: str(r.description_en),
    sections: (r.sections as QuestionnaireTemplateRecord["sections"]) ?? [],
    messageFr: str(r.message_fr),
    messageEn: str(r.message_en),
    isDefaultPreconsultation: r.is_default_preconsultation === true,
    active: r.active !== false,
    updatedAt: str(r.updated_at),
    usageCount: num(r.usage_count),
  }
}
