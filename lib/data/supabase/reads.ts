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
  DeadlineRecord,
  FactureCabinet,
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

/**
 * Toutes les factures du cabinet, statut CALCULÉ compris.
 *
 * Passe par firm_invoices_view() plutôt que de lire la table : la colonne
 * status reste « issued » sur une facture entièrement payée et ignore qu'une
 * échéance est passée. L'écran du cabinet affichait donc des statuts que la
 * fiche dossier, elle, corrigeait — deux écrans, deux vérités sur la même
 * facture.
 */
export async function getFacturesDuCabinet(): Promise<FactureCabinet[]> {
  const { data, error } = await (await db())
    .rpc("firm_invoices_view", { f_id: await currentFirmId() })

  if (error) fail("firmInvoices", error.message)
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    numero: String(r.invoice_number ?? ""),
    clientId: r.client_id ? String(r.client_id) : null,
    clientNom: String(r.client_name ?? ""),
    clientCourriel: r.client_email ? String(r.client_email) : null,
    matterId: r.matter_id ? String(r.matter_id) : null,
    dossierReference: r.matter_reference ? String(r.matter_reference) : null,
    description: r.service_description ? String(r.service_description) : null,
    montant: Number(r.amount ?? 0),
    regle: Number(r.paid_amount ?? 0),
    solde: Number(r.balance ?? 0),
    statut: String(r.status ?? "draft") as FactureCabinet["statut"],
    date: String(r.date ?? ""),
    echeance: r.due_on ? String(r.due_on) : null,
    enFideicommis: r.is_trust_account === true,
  }))
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

// --- Échéances du cabinet ---------------------------------------------

/**
 * Toutes les échéances du cabinet, jours restants et gravité compris.
 *
 * Le calcul de l'urgence vit dans firm_deadlines_view(), et non ici : la base
 * connaît déjà deadline_status(), et un second calcul du même fait finit
 * toujours par en différer — celui qui rassure étant celui qu'on croit.
 */
export async function getFirmDeadlines(): Promise<DeadlineRecord[]> {
  const { data, error } = await (await db()).rpc("firm_deadlines_view", {
    f_id: await currentFirmId(),
  })
  if (error) fail("firmDeadlines", error.message)

  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    matterId: r.matter_reference ? String(r.matter_reference) : undefined,
    clientName: String(r.client_name ?? ""),
    program: String(r.program ?? ""),
    title: String(r.title ?? ""),
    dueOn: String(r.due_on ?? ""),
    daysRemaining: Number(r.days_remaining ?? 0),
    severity: r.severity as DeadlineRecord["severity"],
    status: r.status as DeadlineRecord["status"],
    assignedTo: String(r.assignee_name ?? ""),
    authority: r.is_regulatory ? "IRCC" : "Cabinet",
    completedAt: r.completed_at ? String(r.completed_at) : undefined,
  }))
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
