import "server-only"

import { db, currentFirmId } from "./context"
import type {
  Matter,
  Lead,
  InvoiceRecord,
  ClientRecord,
  DocumentRecord,
  AuditLogRecord,
  CalendarEvent,
  ClientQuestionnaire,
} from "../types"
import {
  toMatter,
  toClient,
  toLead,
  toInvoice,
  toDocument,
  toCalendarEvent,
  toQuestionnaire,
} from "./mappers"

function fail(entity: string, message: string): never {
  throw new Error(`Écriture Supabase « ${entity} » en échec : ${message}`)
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Filtre de recherche par identifiant, tolérant aux deux formes d'id.
 *
 * Les enregistrements portent deux identités : la clé primaire `uuid` de
 * Postgres, et le `legacy_id` lisible hérité du modèle mock (« lead-1 »,
 * « doc-1785726863868 »). Les mappers exposent le `legacy_id` en priorité,
 * donc l'interface renvoie presque toujours cette forme-là.
 *
 * Interroger les deux colonnes d'un seul `or` semble naturel, mais Postgres
 * doit convertir le littéral en uuid pour évaluer `id = '...'` — et cette
 * conversion échoue avant que le OR ne puisse court-circuiter. L'écriture
 * entière est alors rejetée alors que la ligne existe bel et bien sous son
 * legacy_id. On n'interroge donc `id` que si la valeur en a la forme.
 */
function byId(id: string): string {
  return UUID.test(id) ? `id.eq.${id},legacy_id.eq.${id}` : `legacy_id.eq.${id}`
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
    rcic: data.rcic || '',
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
    .or(byId(id))
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
    .or(byId(id))
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
    doc_type: data.docType ?? null,
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
    .or(byId(id))
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
    .or(byId(id))

  if (error) fail("deleteDocumentRecord", error.message)
  return true
}

export async function restoreDocumentRecord(id: string): Promise<DocumentRecord | undefined> {
  const firmId = await currentFirmId()

  const { data, error } = await (await db())
    .from("documents")
    .update({ status: 'valid' })
    .eq("firm_id", firmId)
    .or(byId(id))
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


/**
 * Convertit un prospect en client.
 *
 * Le moment de la conversion n'est pas anodin dans une pratique CICC :
 * c'est là que naissent le mandat, le compte en fidéicommis et
 * l'obligation de tenue de dossier. L'action est donc explicite, et
 * l'interface ne la propose qu'à l'étape « entente signée ».
 *
 * Le prospect n'est pas supprimé : il est marqué converti et lié au
 * client créé, pour conserver l'historique du pipeline — origine du
 * contact, durée du cycle, valeur estimée face au réel.
 *
 * Idempotente : un prospect déjà converti renvoie son client, sans en
 * créer un second. Un double clic ne peut donc pas dédoubler un dossier.
 */
export async function convertLeadToClient(
  leadId: string
): Promise<{ client: ClientRecord; alreadyConverted: boolean }> {
  const firmId = await currentFirmId()
  const supabase = await db()

  const { data: lead, error: readErr } = await supabase
    .from("leads")
    .select("*")
    .eq("firm_id", firmId)
    .or(byId(leadId))
    .maybeSingle()

  if (readErr) fail("convertLeadToClient", readErr.message)
  if (!lead) fail("convertLeadToClient", `Prospect « ${leadId} » introuvable.`)

  // Déjà converti : on rend le client existant plutôt que d'en créer un
  // doublon. C'est ce qui rend un second clic sans conséquence.
  if (lead.converted_client_id) {
    const { data: existant } = await supabase
      .from("clients")
      .select("*")
      .eq("id", lead.converted_client_id)
      .maybeSingle()
    if (existant) return { client: toClient(existant), alreadyConverted: true }
  }

  // Le numéro est calculé en base : deux conversions simultanées y
  // produiraient sinon le même.
  const { data: fileNumber, error: numErr } = await supabase.rpc("next_client_file_number", {
    p_firm_id: firmId,
  })
  if (numErr) fail("convertLeadToClient", `numérotation : ${numErr.message}`)

  const { data: created, error: insErr } = await supabase
    .from("clients")
    .insert({
      firm_id: firmId,
      file_number: fileNumber,
      name: lead.name,
      first_name: lead.first_name,
      last_name: lead.last_name,
      email: lead.email,
      phone: lead.phone ?? "",
      program: lead.visa_type ?? "",
      status: "active",
      // On conserve la trace de l'origine : d'où venait ce client, et ce
      // qui avait été noté pendant la prospection.
      intake_motif: [lead.source ? `Origine : ${lead.source}` : null, lead.notes || null]
        .filter(Boolean)
        .join(" — "),
      client_type: lead.type === "b2b" ? "employer" : "individual",
      neq_number: lead.type === "b2b" ? null : null,
    })
    .select("*")
    .single()

  if (insErr) fail("convertLeadToClient", insErr.message)

  const { error: markErr } = await supabase
    .from("leads")
    .update({
      converted_client_id: created.id,
      converted_at: new Date().toISOString(),
      stage: "signed",
    })
    .eq("id", lead.id)

  // Le client existe déjà à ce stade : on ne fait pas échouer la
  // conversion pour un marquage manqué, mais on ne le tait pas non plus.
  if (markErr) {
    console.error("convertLeadToClient : client créé mais prospect non marqué —", markErr.message)
  }

  return { client: toClient(created), alreadyConverted: false }
}

/**
 * Enregistre un rendez-vous.
 *
 * Cette écriture n'existait pas : le formulaire d'invitation ajoutait
 * l'événement à l'état React et rien de plus. Il disparaissait au
 * rechargement, alors que l'interface annonçait une invitation envoyée et
 * publiée sur le portail du client.
 */
export async function createEvent(
  data: Omit<CalendarEvent, "id"> & { id?: string; clientId?: string }
): Promise<CalendarEvent> {
  const firmId = await currentFirmId()
  const supabase = await db()

  // Le dossier est référencé par son numéro lisible côté interface ; la
  // table attend une clé étrangère.
  let matterUuid: string | null = null
  if (data.matterId) {
    const bare = decodeURIComponent(data.matterId).replace("#", "")
    const { data: m } = await supabase
      .from("matters")
      .select("id, client_id")
      .eq("firm_id", firmId)
      .in("reference", [data.matterId, `#${bare}`, bare])
      .maybeSingle()
    if (m) matterUuid = m.id as string
  }

  // start_time et end_time sont obligatoires et de type texte. Ils se
  // déduisent de l'heure de début et de la durée : les omettre faisait
  // échouer l'insertion entière.
  const debut = String(data.hour ?? 9).padStart(2, "0") + ":00"
  const dureeMin = data.durationMinutes ?? 60
  const finMinutes = (data.hour ?? 9) * 60 + dureeMin
  const fin =
    String(Math.min(23, Math.floor(finMinutes / 60))).padStart(2, "0") +
    ":" +
    String(finMinutes % 60).padStart(2, "0")

  // L'interface et le schéma ont des vocabulaires distincts : elle parle
  // de « visio » et de « ready », la base n'accepte que consultation /
  // deadline / hearing / followup et confirmed / pending / cancelled.
  // La traduction se fait ici, à la frontière, plutôt que d'imposer le
  // vocabulaire de la base à l'affichage.
  const TYPES = ["consultation", "deadline", "hearing", "followup"]
  const STATUTS = ["confirmed", "pending", "cancelled"]
  const type = TYPES.includes(String(data.type)) ? String(data.type) : "consultation"
  const status = STATUTS.includes(String(data.status)) ? String(data.status) : "confirmed"

  const payload = {
    firm_id: firmId,
    matter_id: matterUuid,
    client_id: data.clientId ?? null,
    title: data.title,
    client_name: data.clientName ?? "",
    type,
    start_time: debut,
    end_time: fin,
    location: data.platform ?? "",
    platform: data.platform ?? null,
    link: data.link ?? null,
    date: toDateOnly(data.date, today()),
    day_name: data.dayName ?? null,
    time: data.time ?? null,
    hour: data.hour ?? null,
    status,
    program: data.program ?? null,
    notes: data.notes ?? null,
  }

  const { data: inserted, error } = await supabase
    .from("calendar_events")
    .insert(payload)
    .select("*, matters(reference)")
    .single()

  if (error) fail("createEvent", error.message)
  return toCalendarEvent(inserted)
}

// --- Questionnaires Clients -------------------------------------------

export async function assignQuestionnaire(
  matterId: string,
  clientId: string,
  formType: "study_permit" | "work_permit" | "pr"
): Promise<ClientQuestionnaire> {
  const firmId = await currentFirmId()
  const supabase = await db()

  // 1. Résoudre le matter uuid
  const bareMatter = decodeURIComponent(matterId).replace("#", "")
  const { data: m } = await supabase
    .from("matters")
    .select("id")
    .eq("firm_id", firmId)
    .in("reference", [matterId, `#${bareMatter}`, bareMatter])
    .maybeSingle()
  if (!m) fail("assignQuestionnaire", `Dossier ${matterId} introuvable.`)

  // 2. Résoudre le client uuid
  const { data: c } = await supabase
    .from("clients")
    .select("id")
    .eq("firm_id", firmId)
    .eq("legacy_id", clientId)
    .maybeSingle()
  if (!c) fail("assignQuestionnaire", `Client ${clientId} introuvable.`)

  let title = "Questionnaire — Demande de permis d'études"
  if (formType === "work_permit") title = "Questionnaire — Demande de permis de travail"
  else if (formType === "pr") title = "Questionnaire — Résidence permanente"

  const payload = {
    firm_id: firmId,
    client_id: c.id,
    matter_id: m.id,
    title,
    form_type: formType,
    status: "draft",
    progress: 0,
    answers: {},
    corrections: [],
    history: [],
  }

  const { data: inserted, error } = await supabase
    .from("client_questionnaires")
    .insert(payload)
    .select("*, matters(reference), clients(legacy_id)")
    .single()

  if (error) fail("assignQuestionnaire", error.message)
  return toQuestionnaire(inserted)
}

export async function saveQuestionnaireProgress(
  id: string,
  answers: Record<string, unknown>,
  progress: number
): Promise<ClientQuestionnaire> {
  const firmId = await currentFirmId()
  const supabase = await db()

  // 1. Lire le questionnaire pour vérifier son statut
  const { data: current, error: readErr } = await supabase
    .from("client_questionnaires")
    .select("status")
    .eq("id", id)
    .maybeSingle()

  if (readErr || !current) fail("saveQuestionnaireProgress", "Questionnaire introuvable.")

  const status = current.status === "draft" ? "in_progress" : current.status

  const { data: updated, error } = await supabase
    .from("client_questionnaires")
    .update({
      answers,
      progress,
      status,
      last_saved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*, matters(reference), clients(legacy_id)")
    .single()

  if (error) fail("saveQuestionnaireProgress", error.message)
  return toQuestionnaire(updated)
}

export async function updateQuestionnaireStatus(
  id: string,
  status: string,
  extraUpdates: Record<string, unknown> = {}
): Promise<ClientQuestionnaire> {
  const supabase = await db()
  const { data: updated, error } = await supabase
    .from("client_questionnaires")
    .update({
      status,
      ...extraUpdates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*, matters(reference), clients(legacy_id)")
    .single()

  if (error) fail("updateQuestionnaireStatus", error.message)
  return toQuestionnaire(updated)
}
