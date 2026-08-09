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
    clientId: optStr((r.clients as Row | null)?.legacy_id),
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
    province: optStr(r.province),
    program: str(r.program),
    status: r.status as ClientRecord["status"],
    intakeMotif: str(r.intake_motif),
    clientType: (r.client_type as ClientRecord["clientType"]) ?? undefined,
    neqNumber: optStr(r.neq_number),
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
    program: str(r.program),
    type: r.type as CalendarEvent["type"],
    platform: (r.platform as CalendarEvent["platform"]) ?? undefined,
    link: optStr(r.link),
    date: dateStr(r.date),
    dayName: str(r.day_name),
    time: str(r.time),
    // La grille place les rendez-vous par cette heure. Un événement créé
    // hors de l'application — import, ou demain un flux Calendly — porte
    // start_time sans hour, et deviendrait invisible. On la déduit.
    hour: num(r.hour) || Number.parseInt(String(r.start_time ?? "").slice(0, 2), 10) || 9,
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

export function toQuestionnaire(r: Row): ClientQuestionnaire {
  return {
    id: str(r.id),
    firmId: str(r.firm_id),
    clientId: optStr((r.clients as Row | null)?.legacy_id) || str(r.client_id),
    matterId: optStr((r.matters as Row | null)?.reference) || str(r.matter_id),
    title: str(r.title),
    description: optStr(r.description),
    formType: r.form_type as ClientQuestionnaire["formType"],
    status: r.status as ClientQuestionnaire["status"],
    progress: num(r.progress),
    dueDate: optStr(r.due_date),
    createdAt: str(r.created_at),
    updatedAt: str(r.updated_at),
    lastSavedAt: optStr(r.last_saved_at),
    answers: (r.answers as Record<string, unknown>) ?? {},
    corrections: (r.corrections as QuestionnaireCorrection[]) ?? [],
    history: (r.history as QuestionnaireHistoryEntry[]) ?? [],
  }
}
