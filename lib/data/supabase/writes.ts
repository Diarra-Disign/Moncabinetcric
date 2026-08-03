import "server-only"

import { db, currentFirmId } from "./context"
import type {
  Matter,
  Lead,
  InvoiceRecord,
  ClientRecord,
  DocumentRecord,
  AuditLogRecord,
} from "../types"
import {
  toMatter,
  toClient,
  toLead,
  toInvoice,
  toDocument,
} from "./mappers"

function fail(entity: string, message: string): never {
  throw new Error(`Écriture Supabase « ${entity} » en échec : ${message}`)
}

/**
 * Normalise une valeur destinée à une colonne `date`.
 *
 * Plusieurs champs héritent du modèle mock, où ils portaient un libellé
 * lisible — « Appel - il y a 1j », « Nouveau prospect - À l'instant » —
 * alors que la colonne attend une date. Envoyer ce texte à Postgres fait
 * échouer l'écriture entière avec un message que l'utilisateur ne peut pas
 * interpréter.
 *
 * On accepte une date ISO ou tout ce que Date sait lire ; le reste est
 * remplacé par la valeur de repli plutôt que de faire échouer
 * l'enregistrement pour un champ d'affichage.
 */
export function toDateOnly(value: unknown, fallback: string | null = null): string | null {
  if (value === null || value === undefined || value === "") return fallback
  const raw = String(value).trim()

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw

  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)

  return fallback
}

/** Date du jour, au format attendu par une colonne `date`. */
export function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function createMatter(data: Omit<Matter, "id"> & { id?: string }): Promise<Matter> {
  const firmId = await currentFirmId()
  const reference = data.id || `#DOS-${Math.floor(10000 + Math.random() * 90000)}`

  const payload = {
    firm_id: firmId,
    reference,
    client_name: data.clientName,
    client_type: data.clientType || 'b2c',
    program: data.program,
    category: data.category || 'pr',
    opened_date: toDateOnly(data.openedDate, today()),
    deadline: toDateOnly(data.deadline),
    rcic: data.rcic || 'Adama Diarra',
    status: data.status || 'valid',
    urgency_days: data.urgencyDays || 0,
    notes: data.notes || '',
    is_priority: data.isPriority || false,
  }

  const { data: inserted, error } = await (await db())
    .from("matters")
    .insert(payload)
    .select("*, clients(legacy_id)")
    .single()

  if (error) fail("createMatter", error.message)
  return toMatter(inserted)
}

export async function updateMatterStatus(id: string, status: Matter["status"]): Promise<Matter | undefined> {
  const firmId = await currentFirmId()
  const decoded = decodeURIComponent(id)
  const bare = decoded.replace("#", "")

  const { data, error } = await (await db())
    .from("matters")
    .update({ status })
    .eq("firm_id", firmId)
    .in("reference", [decoded, `#${bare}`, bare])
    .select("*, clients(legacy_id)")
    .single()

  if (error) fail("updateMatterStatus", error.message)
  return data ? toMatter(data) : undefined
}

export async function createLead(data: Omit<Lead, "id"> & { id?: string }): Promise<Lead> {
  const firmId = await currentFirmId()
  const legacyId = data.id || `lead-${Date.now()}`

  const payload = {
    firm_id: firmId,
    legacy_id: legacyId,
    name: data.name,
    first_name: data.firstName,
    last_name: data.lastName,
    company: data.company,
    type: data.type,
    visa_type: data.visaType,
    estimated_value: data.estimatedValue || 0,
    score: data.score || 50,
    score_label: data.scoreLabel || 'med',
    stage: data.stage || 'newLead',
    last_contact: toDateOnly(data.lastContact, today()),
    email: data.email,
    phone: data.phone || '',
    notes: data.notes || '',
    lmia_positions: data.lmiaPositions,
    source: data.source,
  }

  const { data: inserted, error } = await (await db())
    .from("leads")
    .insert(payload)
    .select("*")
    .single()

  if (error) fail("createLead", error.message)
  return toLead(inserted)
}

export async function moveLeadStage(id: string, stage: Lead["stage"]): Promise<Lead | undefined> {
  const firmId = await currentFirmId()

  const { data, error } = await (await db())
    .from("leads")
    .update({ stage })
    .eq("firm_id", firmId)
    .or(`id.eq.${id},legacy_id.eq.${id}`)
    .select("*")
    .single()

  if (error) fail("moveLeadStage", error.message)
  return data ? toLead(data) : undefined
}

export async function updateLead(id: string, updates: Partial<Lead>): Promise<Lead | undefined> {
  const firmId = await currentFirmId()
  const payload: Record<string, unknown> = {}
  if (updates.name !== undefined) payload.name = updates.name
  if (updates.firstName !== undefined) payload.first_name = updates.firstName
  if (updates.lastName !== undefined) payload.last_name = updates.lastName
  if (updates.company !== undefined) payload.company = updates.company
  if (updates.visaType !== undefined) payload.visa_type = updates.visaType
  if (updates.estimatedValue !== undefined) payload.estimated_value = updates.estimatedValue
  if (updates.score !== undefined) payload.score = updates.score
  if (updates.scoreLabel !== undefined) payload.score_label = updates.scoreLabel
  if (updates.stage !== undefined) payload.stage = updates.stage
  if (updates.email !== undefined) payload.email = updates.email
  if (updates.phone !== undefined) payload.phone = updates.phone
  if (updates.notes !== undefined) payload.notes = updates.notes

  const { data, error } = await (await db())
    .from("leads")
    .update(payload)
    .eq("firm_id", firmId)
    .or(`id.eq.${id},legacy_id.eq.${id}`)
    .select("*")
    .maybeSingle()

  if (error) fail("updateLead", error.message)
  return data ? toLead(data) : undefined
}


export async function createInvoice(data: Omit<InvoiceRecord, "id"> & { id?: string }): Promise<InvoiceRecord> {
  const firmId = await currentFirmId()
  const legacyId = data.id || `inv-${Date.now()}`

  const payload = {
    firm_id: firmId,
    legacy_id: legacyId,
    invoice_number: data.invoiceNumber,
    client_name: data.clientName,
    service_description: data.serviceDescription,
    amount: data.amount,
    date: toDateOnly(data.date, today()),
    status: data.status,
    is_trust_account: data.isTrustAccount || false,
    tax_exempt: data.taxExempt || false,
  }

  const { data: inserted, error } = await (await db())
    .from("invoices")
    .insert(payload)
    .select("*")
    .single()

  if (error) fail("createInvoice", error.message)
  return toInvoice(inserted)
}

export async function createClient(data: Omit<ClientRecord, "id"> & { id?: string }): Promise<ClientRecord> {
  const firmId = await currentFirmId()
  const legacyId = data.id || `c-${Date.now()}`

  const payload = {
    firm_id: firmId,
    legacy_id: legacyId,
    file_number: data.fileNumber,
    name: data.name,
    first_name: data.firstName,
    last_name: data.lastName,
    email: data.email,
    phone: data.phone || '',
    citizenship: data.citizenship || '',
    residence: data.residence || '',
    province: data.province,
    program: data.program || '',
    status: data.status || 'active',
    intake_motif: data.intakeMotif || '',
    client_type: data.clientType,
    neq_number: data.neqNumber,
  }

  const { data: inserted, error } = await (await db())
    .from("clients")
    .insert(payload)
    .select("*")
    .single()

  if (error) fail("createClient", error.message)
  return toClient(inserted)
}

export async function createDocument(data: Omit<DocumentRecord, "id"> & { id?: string }): Promise<DocumentRecord> {
  const firmId = await currentFirmId()
  const legacyId = data.id || `doc-${Date.now()}`

  const payload = {
    firm_id: firmId,
    legacy_id: legacyId,
    name: data.name,
    type: data.type,
    category: data.category,
    uploaded_by: data.uploadedBy,
    date: toDateOnly(data.date, today()),
    expiration: toDateOnly(data.expiration),
    source: data.source,
    status: data.status || 'valid',
    client_name: data.clientName,
    file_size: data.fileSize,
    sha256: data.sha256,
    storage_path: data.storagePath,
    file_url: data.fileUrl,
  }

  const { data: inserted, error } = await (await db())
    .from("documents")
    .insert(payload)
    .select("*")
    .single()

  if (error) fail("createDocument", error.message)
  return toDocument(inserted)
}

export async function archiveDocumentRecord(id: string): Promise<DocumentRecord | undefined> {
  const firmId = await currentFirmId()

  const { data, error } = await (await db())
    .from("documents")
    .update({ status: 'archived' })
    .eq("firm_id", firmId)
    .or(`id.eq.${id},legacy_id.eq.${id}`)
    .select("*")
    .single()

  if (error) fail("archiveDocumentRecord", error.message)
  return data ? toDocument(data) : undefined
}

export async function deleteDocumentRecord(id: string): Promise<boolean> {
  const firmId = await currentFirmId()

  const { error } = await (await db())
    .from("documents")
    .delete()
    .eq("firm_id", firmId)
    .or(`id.eq.${id},legacy_id.eq.${id}`)

  if (error) fail("deleteDocumentRecord", error.message)
  return true
}

export async function restoreDocumentRecord(id: string): Promise<DocumentRecord | undefined> {
  const firmId = await currentFirmId()

  const { data, error } = await (await db())
    .from("documents")
    .update({ status: 'valid' })
    .eq("firm_id", firmId)
    .or(`id.eq.${id},legacy_id.eq.${id}`)
    .select("*")
    .single()

  if (error) fail("restoreDocumentRecord", error.message)
  return data ? toDocument(data) : undefined
}

export async function updateFirmSettings(data: {
  name?: string
  rcicNumber?: string
  rcicName?: string
  address?: string
  phone?: string
  email?: string
  logoUrl?: string
}): Promise<boolean> {
  const firmId = await currentFirmId()
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (data.name !== undefined) payload.name = data.name
  if (data.rcicNumber !== undefined) payload.rcic_license_number = data.rcicNumber
  if (data.rcicName !== undefined) payload.owner_name = data.rcicName
  if (data.address !== undefined) payload.address = data.address
  if (data.phone !== undefined) payload.phone = data.phone
  if (data.email !== undefined) payload.email = data.email
  if (data.logoUrl !== undefined) payload.logo_url = data.logoUrl

  const { error } = await (await db())
    .from("firms")
    .update(payload)
    .eq("id", firmId)

  if (error) fail("updateFirmSettings", error.message)
  return true
}

