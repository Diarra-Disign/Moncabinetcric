import "server-only"

import { db, currentFirmId } from "./context"
import type {
  Matter,
  Lead,
  InvoiceRecord,
  ClientRecord,
  DocumentRecord,
  CalendarEvent,
  AuditLogRecord,
  ClientQuestionnaire,
} from "../types"
import {
  toMatter,
  toClient,
  toLead,
  toInvoice,
  toDocument,
  toCalendarEvent,
  toAuditLog,
  toQuestionnaire,
} from "./mappers"

/**
 * Lectures Supabase, cloisonnées par cabinet.
 *
 * Chaque requête filtre explicitement sur firm_id. Le client serveur
 * utilise la clé service_role et contourne donc RLS : ce filtre est, à
 * ce stade, la seule barrière entre cabinets. Il n'est pas optionnel.
 *
 * Les erreurs ne sont pas avalées : une requête en échec lève, plutôt
 * que de renvoyer une liste vide qui ferait passer une panne pour une
 * absence de données.
 */

function fail(entity: string, message: string): never {
  throw new Error(`Lecture Supabase « ${entity} » en échec : ${message}`)
}

// --- Dossiers ---------------------------------------------------------

export async function getMatters(): Promise<Matter[]> {
  const { data, error } = await (await db())
    .from("matters")
    .select("*, clients(legacy_id)")
    .eq("firm_id", await currentFirmId())
    .order("opened_date", { ascending: false })

  if (error) fail("matters", error.message)
  return (data ?? []).map(toMatter)
}

export async function getMatterById(id: string): Promise<Matter | undefined> {
  const decoded = decodeURIComponent(id)
  // L'UI manipule tantôt "#DOS-35695", tantôt "DOS-35695" selon qu'on
  // vienne d'un lien ou d'un segment d'URL : on interroge les deux formes.
  const bare = decoded.replace("#", "")
  const { data, error } = await (await db())
    .from("matters")
    .select("*, clients(legacy_id)")
    .eq("firm_id", await currentFirmId())
    .in("reference", [decoded, `#${bare}`, bare])
    .limit(1)

  if (error) fail("matterById", error.message)
  return data && data.length ? toMatter(data[0]) : undefined
}

export async function getMattersByClientId(clientId: string): Promise<Matter[]> {
  const { data, error } = await (await db())
    .from("matters")
    .select("*, clients!inner(legacy_id)")
    .eq("firm_id", await currentFirmId())
    .eq("clients.legacy_id", clientId)

  if (error) fail("mattersByClientId", error.message)
  return (data ?? []).map(toMatter)
}

// --- Clients ----------------------------------------------------------

export async function getClients(): Promise<ClientRecord[]> {
  const { data, error } = await (await db())
    .from("clients")
    .select("*")
    .eq("firm_id", await currentFirmId())
    .order("name")

  if (error) fail("clients", error.message)
  return (data ?? []).map(toClient)
}

export async function getClientById(id: string): Promise<ClientRecord | undefined> {
  const { data, error } = await (await db())
    .from("clients")
    .select("*")
    .eq("firm_id", await currentFirmId())
    .eq("legacy_id", id)
    .limit(1)

  if (error) fail("clientById", error.message)
  return data && data.length ? toClient(data[0]) : undefined
}

// --- Prospects --------------------------------------------------------

export async function getLeads(): Promise<Lead[]> {
  const { data, error } = await (await db())
    .from("leads")
    .select("*")
    .eq("firm_id", await currentFirmId())
    .order("score", { ascending: false })

  if (error) fail("leads", error.message)
  return (data ?? []).map(toLead)
}

export async function getLeadById(id: string): Promise<Lead | undefined> {
  const { data, error } = await (await db())
    .from("leads")
    .select("*")
    .eq("firm_id", await currentFirmId())
    .eq("legacy_id", id)
    .limit(1)

  if (error) fail("leadById", error.message)
  return data && data.length ? toLead(data[0]) : undefined
}

// --- Factures ---------------------------------------------------------

export async function getInvoices(): Promise<InvoiceRecord[]> {
  const { data, error } = await (await db())
    .from("invoices")
    .select("*, matters(reference), clients(legacy_id)")
    .eq("firm_id", await currentFirmId())
    .order("date", { ascending: false })

  if (error) fail("invoices", error.message)
  return (data ?? []).map(toInvoice)
}

export async function getInvoicesByMatterId(matterId: string): Promise<InvoiceRecord[]> {
  const decoded = decodeURIComponent(matterId)
  const bare = decoded.replace("#", "")
  const { data, error } = await (await db())
    .from("invoices")
    .select("*, matters!inner(reference), clients(legacy_id)")
    .eq("firm_id", await currentFirmId())
    .in("matters.reference", [decoded, `#${bare}`, bare])

  if (error) fail("invoicesByMatterId", error.message)
  return (data ?? []).map(toInvoice)
}

export async function getInvoicesByClientId(clientId: string): Promise<InvoiceRecord[]> {
  const { data, error } = await (await db())
    .from("invoices")
    .select("*, matters(reference), clients!inner(legacy_id)")
    .eq("firm_id", await currentFirmId())
    .eq("clients.legacy_id", clientId)

  if (error) fail("invoicesByClientId", error.message)
  return (data ?? []).map(toInvoice)
}

// --- Documents --------------------------------------------------------

export async function getDocuments(): Promise<DocumentRecord[]> {
  const { data, error } = await (await db())
    .from("documents")
    .select("*, matters(reference), clients(legacy_id)")
    .eq("firm_id", await currentFirmId())
    .order("date", { ascending: false })

  if (error) fail("documents", error.message)
  return (data ?? []).map(toDocument)
}

export async function getDocumentsByMatterId(matterId: string): Promise<DocumentRecord[]> {
  const decoded = decodeURIComponent(matterId)
  const bare = decoded.replace("#", "")
  const { data, error } = await (await db())
    .from("documents")
    .select("*, matters!inner(reference), clients(legacy_id)")
    .eq("firm_id", await currentFirmId())
    .in("matters.reference", [decoded, `#${bare}`, bare])

  if (error) fail("documentsByMatterId", error.message)
  return (data ?? []).map(toDocument)
}

// --- Agenda -----------------------------------------------------------

export async function getEvents(): Promise<CalendarEvent[]> {
  const { data, error } = await (await db())
    .from("calendar_events")
    .select("*, matters(reference)")
    .eq("firm_id", await currentFirmId())
    .order("date")

  if (error) return []
  return (data ?? []).map(toCalendarEvent)
}

// --- Journal d'audit --------------------------------------------------

export async function getAuditLogs(): Promise<AuditLogRecord[]> {
  const { data, error } = await (await db())
    .from("audit_logs")
    .select("*")
    .eq("firm_id", await currentFirmId())

  if (error) return []
  return (data ?? []).map(toAuditLog)
}

export async function getDocumentAuditLog(): Promise<AuditLogRecord[]> {
  const { data, error } = await (await db())
    .from("audit_logs")
    .select("*")
    .eq("firm_id", await currentFirmId())

  if (error) return []
  const mapped = (data ?? []).map(toAuditLog)
  return mapped.filter(log => log.entityType === "document" || log.action?.includes("document") || log.action?.includes("doc"))
}

// --- Questionnaires Clients -------------------------------------------

export async function getClientQuestionnairesByMatterId(matterId: string): Promise<ClientQuestionnaire[]> {
  const decoded = decodeURIComponent(matterId)
  const bare = decoded.replace("#", "")
  
  const { data, error } = await (await db())
    .from("client_questionnaires")
    .select("*, matters!inner(reference), clients(legacy_id, name, email), leads(legacy_id, name, email)")
    .eq("firm_id", await currentFirmId())
    .in("matters.reference", [decoded, `#${bare}`, bare])

  if (error) fail("clientQuestionnairesByMatterId", error.message)
  return (data ?? []).map(toQuestionnaire)
}

export async function getClientQuestionnairesByClientId(clientId: string): Promise<ClientQuestionnaire[]> {
  const { data, error } = await (await db())
    .from("client_questionnaires")
    .select("*, matters(reference), clients!inner(legacy_id, name, email), leads(legacy_id, name, email)")
    .eq("firm_id", await currentFirmId())
    .eq("clients.legacy_id", clientId)

  if (error) fail("clientQuestionnairesByClientId", error.message)
  return (data ?? []).map(toQuestionnaire)
}

export async function getClientQuestionnaireById(id: string): Promise<ClientQuestionnaire | undefined> {
  const { data, error } = await (await db())
    .from("client_questionnaires")
    .select("*, matters(reference), clients(legacy_id, name, email), leads(legacy_id, name, email)")
    .eq("firm_id", await currentFirmId())
    .eq("id", id)
    .limit(1)

  if (error) fail("clientQuestionnaireById", error.message)
  return data && data.length ? toQuestionnaire(data[0]) : undefined
}
