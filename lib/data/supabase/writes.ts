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
    // L'intention de contact était collectée par le formulaire et jetée entre
    // le navigateur et la base : aucune colonne ne la recevait. Elle existe.
    contact_intent: data.contactIntent ?? null,
    civility: data.civility ?? null,
    // L'adresse postale, dès le prospect. Les colonnes existaient depuis la
    // veille et rien ne les remplissait : une colonne que personne n'écrit
    // vaut une colonne absente, et l'entente de service la réclamera.
    address: data.address ?? null,
    address_line2: data.addressLine2 ?? null,
    city: data.city ?? null,
    province: data.province ?? null,
    postal_code: data.postalCode ?? null,
    country: data.country ?? null,
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
  if (updates.address !== undefined) payload.address = updates.address || null
  if (updates.addressLine2 !== undefined) payload.address_line2 = updates.addressLine2 || null
  if (updates.city !== undefined) payload.city = updates.city || null
  if (updates.province !== undefined) payload.province = updates.province || null
  if (updates.postalCode !== undefined) payload.postal_code = updates.postalCode?.toUpperCase() || null
  if (updates.country !== undefined) payload.country = updates.country || null

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
    // La civilité est écrite ici comme partout : un champ à l'écran qui
    // n'arrive pas en base n'est qu'un décor — c'est exactement ce qui est
    // arrivé à l'intention de contact du formulaire prospect.
    civility: data.civility ?? null,
    first_name: data.firstName,
    last_name: data.lastName,
    email: data.email,
    phone: data.phone || '',
    citizenship: data.citizenship || '',
    residence: data.residence || '',
    // L'adresse POSTALE. `citizenship` et `residence` sont des PAYS : ni l'un
    // ni l'autre ne dit où le client habite, et c'est cette adresse-ci qui
    // identifie la partie sur une entente de service.
    address: data.address ?? null,
    address_line2: data.addressLine2 ?? null,
    city: data.city ?? null,
    province: data.province,
    postal_code: data.postalCode ?? null,
    country: data.country ?? null,
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

/**
 * Enregistre l'identité du cabinet.
 *
 * ELLE NE REND PLUS `true` À L'AVEUGLE. La version précédente lisait l'erreur
 * de PostgREST et concluait au succès en son absence — or une écriture
 * refusée par Row Level Security n'est PAS une erreur : elle ne trouve
 * simplement aucune ligne, et rend « succès, zéro ligne ».
 *
 * La politique `firms_owner_update` exige `is_firm_owner()`. Un collaborateur
 * enregistrait donc dans le vide, et l'écran le félicitait.
 *
 * La logique vit dans `lib/data/parametres-cabinet.ts`, hors du module de
 * session, pour rester appelable par une épreuve : c'est faute de pouvoir
 * l'appeler que ce défaut a vécu si longtemps.
 */
export async function updateFirmSettings(
  data: import("../parametres-cabinet").IdentiteCabinet
): Promise<{ ok: boolean; message: string }> {
  const firmId = await currentFirmId()
  const { updateFirmSettingsAvec } = await import("../parametres-cabinet")
  return updateFirmSettingsAvec(await db(), firmId, data)
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
): Promise<{ client: ClientRecord; alreadyConverted: boolean; questionnairesTransferes: number; membresFamilleTransferes: number; ententesTransferees: number }> {
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
    // Zéro, et non « inconnu » : le transfert a déjà eu lieu à la première
    // conversion, il ne reste rien à déplacer. C'est ce qui rend le second
    // clic sans conséquence de bout en bout.
    if (existant) return { client: toClient(existant), alreadyConverted: true, questionnairesTransferes: 0, membresFamilleTransferes: 0, ententesTransferees: 0 }
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
      // La civilité suit la personne. La perdre ici obligerait à la redemander
      // à quelqu'un qui vient de la donner — et l'entente de service partirait
      // entre-temps avec « Diarra » au lieu de « Monsieur Adama Diarra ».
      civility: lead.civility ?? null,
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

  // Les questionnaires suivent leur destinataire.
  //
  // Sans ceci, ils restaient accrochés au lead_id. Le portail du nouveau
  // client lit par client_id : il annonçait « Aucun questionnaire ne vous est
  // attribué » à quelqu'un qui venait d'en remplir un, et le cabinet le lui
  // redemandait.
  //
  // Un SEUL update, et les deux colonnes ensemble : la contrainte
  // client_questionnaires_destinataire impose
  // (client_id is not null) <> (lead_id is not null) — en deux temps, l'état
  // intermédiaire est refusé par la base.
  //
  // Vider lead_id n'est pas qu'un ménage : la colonne est « on delete
  // cascade ». La laisser garnie signifie qu'effacer le prospect plus tard
  // détruirait le questionnaire rempli. Le détacher est ce qui le sauve.
  //
  // token_hash n'est pas touché : le lien déjà transmis continue de
  // fonctionner. La personne qui remplit le formulaire n'a pas à savoir
  // qu'elle a changé de statut dans notre base.
  const { data: transferes, error: qErr } = await supabase
    .from("client_questionnaires")
    .update({ client_id: created.id, lead_id: null })
    .eq("firm_id", firmId)
    .eq("lead_id", lead.id)
    .select("id")

  // Même arbitrage que pour le marquage : le client est créé, on ne défait
  // pas une conversion réussie. Mais le compte est RENDU à l'appelant plutôt
  // que perdu dans un journal — une interface qui annonce « 2 questionnaires
  // transférés » et n'en montre aucun est un défaut visible ; un échec
  // silencieux ne l'est pas.
  if (qErr) {
    console.error("convertLeadToClient : client créé, questionnaires non transférés —", qErr.message)
  }

  // La composition familiale suit le même chemin que les questionnaires, et
  // pour la même raison : un seul UPDATE, les deux colonnes ensemble, parce
  // que la contrainte family_members_rattachement refuse l'état intermédiaire.
  //
  // Vider lead_id protège autant qu'il range : la colonne est « on delete
  // cascade », donc effacer le prospect plus tard emporterait la famille du
  // client — des conjoints et des enfants saisis un par un.
  const { data: famille, error: fErr } = await supabase
    .from("family_members")
    .update({ client_id: created.id, lead_id: null })
    .eq("firm_id", firmId)
    .eq("lead_id", lead.id)
    .select("id")

  if (fErr) {
    console.error("convertLeadToClient : client créé, famille non transférée —", fErr.message)
  }

  // Les ententes de service suivent le même geste, et c'est le §22.
  //
  // Le cas est celui-ci, et il est ordinaire : le consultant fait signer une
  // entente de consultation AU PROSPECT, puis le convertit. Sans ce transfert,
  // le contrat resterait accroché au lead_id — invisible depuis la fiche du
  // client, et détruit le jour où le prospect serait effacé, `lead_id` étant
  // « on delete cascade ». Un contrat signé perdu par un ménage de pipeline.
  //
  // Un seul UPDATE, les deux colonnes ensemble : agreements_destinataire
  // impose (client_id is not null) <> (lead_id is not null), et refuserait
  // l'état intermédiaire.
  //
  // Le PDF déjà émis, lui, ne bouge pas : il vit dans `documents`, il porte son
  // empreinte, et son chemin de stockage est figé. Le déplacer casserait la
  // signature apposée dessus — ce que l'empreinte sert précisément à empêcher.
  const { data: ententes, error: eErr } = await supabase
    .from("agreements")
    .update({ client_id: created.id, lead_id: null })
    .eq("firm_id", firmId)
    .eq("lead_id", lead.id)
    .select("id")

  if (eErr) {
    console.error("convertLeadToClient : client créé, ententes non transférées —", eErr.message)
  }

  return {
    client: toClient(created),
    alreadyConverted: false,
    questionnairesTransferes: qErr ? 0 : (transferes?.length ?? 0),
    membresFamilleTransferes: fErr ? 0 : (famille?.length ?? 0),
    ententesTransferees: eErr ? 0 : (ententes?.length ?? 0),
  }
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

  // Résolution du dossier si fourni
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

  // Vérification de la validité UUID du client pour éviter les erreurs de clé étrangère
  const isUuid = (v?: string | null): boolean =>
    Boolean(v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v))

  let clientUuid: string | null = null
  if (isUuid(data.clientId)) {
    const { data: c } = await supabase
      .from("clients")
      .select("id")
      .eq("firm_id", firmId)
      .eq("id", data.clientId!)
      .maybeSingle()
    if (c) clientUuid = c.id as string
  }

  const payload = {
    firm_id: firmId,
    matter_id: matterUuid,
    client_id: clientUuid,
    title: data.title,
    client_name: data.clientName ?? "",
    client_initials: data.clientInitials ?? null,
    avatar_bg: data.avatarBg ?? "bg-primary",
    type: data.type || "consultation",
    platform: data.platform ?? null,
    link: data.link ?? null,
    date: toDateOnly(data.date, today()),
    day_name: data.dayName ?? null,
    time: data.time ?? null,
    hour: data.hour ?? null,
    duration_minutes: data.durationMinutes ?? 60,
    status: data.status || "confirmed",
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

export async function updateCalendarEvent(
  id: string,
  data: Partial<CalendarEvent>
): Promise<CalendarEvent> {
  const firmId = await currentFirmId()
  const supabase = await db()

  const payload: Record<string, unknown> = {}
  if (data.title !== undefined) payload.title = data.title
  if (data.clientName !== undefined) payload.client_name = data.clientName
  if (data.type !== undefined) payload.type = data.type
  if (data.status !== undefined) payload.status = data.status
  if (data.platform !== undefined) payload.platform = data.platform
  if (data.link !== undefined) payload.link = data.link
  if (data.date !== undefined) payload.date = data.date
  if (data.dayName !== undefined) payload.day_name = data.dayName
  if (data.time !== undefined) payload.time = data.time
  if (data.hour !== undefined) payload.hour = data.hour
  if (data.durationMinutes !== undefined) payload.duration_minutes = data.durationMinutes
  if (data.notes !== undefined) payload.notes = data.notes
  if (data.program !== undefined) payload.program = data.program

  const { data: updated, error } = await supabase
    .from("calendar_events")
    .update(payload)
    .eq("id", id)
    .eq("firm_id", firmId)
    .select("*, matters(reference)")
    .single()

  if (error) fail("updateCalendarEvent", error.message)
  return toCalendarEvent(updated)
}

export async function deleteCalendarEvent(id: string): Promise<{ ok: boolean; message: string }> {
  const firmId = await currentFirmId()
  const supabase = await db()

  const { error } = await supabase
    .from("calendar_events")
    .delete()
    .eq("id", id)
    .eq("firm_id", firmId)

  if (error) fail("deleteCalendarEvent", error.message)
  return { ok: true, message: "Rendez-vous supprimé avec succès." }
}

export async function rescheduleCalendarEvent(
  id: string,
  newDateIso: string,
  newHour: number,
  formattedTime: string,
  formattedDayName: string
): Promise<CalendarEvent> {
  const firmId = await currentFirmId()
  const supabase = await db()

  const { data: updated, error } = await supabase
    .from("calendar_events")
    .update({
      date: newDateIso,
      hour: newHour,
      time: formattedTime,
      day_name: formattedDayName,
    })
    .eq("id", id)
    .eq("firm_id", firmId)
    .select("*, matters(reference)")
    .single()

  if (error) fail("rescheduleCalendarEvent", error.message)
  return toCalendarEvent(updated)
}

// --- Questionnaires Clients -------------------------------------------
//
// L'ATTRIBUTION d'un questionnaire n'est plus ici : elle est devenue un ENVOI,
// avec destinataire, jeton, date limite et instantané des questions, dans
// lib/data/questionnaire-actions.ts. Ce qui reste ici, ce sont les
// transitions d'état déclenchées depuis le portail ou depuis le dossier.

const CHAMPS = "*, matters(reference), clients(legacy_id, name, email), leads(legacy_id, name, email)"

export async function saveQuestionnaireProgress(
  id: string,
  answers: Record<string, unknown>,
  progress: number
): Promise<ClientQuestionnaire> {
  const supabase = await db()

  const { data: current, error: readErr } = await supabase
    .from("client_questionnaires")
    .select("status")
    .eq("id", id)
    .maybeSingle()

  if (readErr || !current) fail("saveQuestionnaireProgress", "Questionnaire introuvable.")

  // Le statut suit le geste : commencer à répondre met « en cours », répondre
  // à une demande de correction met « corrigé ». Un questionnaire déjà soumis
  // que l'on reprend redevient « en cours » — sans quoi il resterait affiché
  // comme rendu alors qu'il ne l'est plus.
  const status =
    current.status === "draft" || current.status === "sent" || current.status === "opened"
      ? "in_progress"
      : current.status === "to_correct"
        ? "corrected"
        : current.status

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
    .select(CHAMPS)
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
    .select(CHAMPS)
    .single()

  if (error) fail("updateQuestionnaireStatus", error.message)
  return toQuestionnaire(updated)
}
