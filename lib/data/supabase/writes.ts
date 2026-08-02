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
    opened_date: data.openedDate || new Date().toISOString().split('T')[0],
    deadline: data.deadline,
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
    last_contact: data.lastContact || new Date().toISOString().split('T')[0],
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
    date: data.date || new Date().toISOString().split('T')[0],
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
    date: data.date || new Date().toISOString().split('T')[0],
    expiration: data.expiration,
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
