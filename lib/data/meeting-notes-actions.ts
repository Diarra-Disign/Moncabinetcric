"use server"

import { revalidatePath } from "next/cache"
import { getSessionSupabase, getCurrentMember } from "@/lib/supabase/session"
import type { MeetingNote, MeetingNoteInput, MeetingNoteHistoryEntry } from "./types"
import type { Resultat } from "./matter-actions"
import { messageErreur } from "@/lib/data/erreurs"

/**
 * Actions du Registre des Rencontres & Notes de dossier.
 *
 * Règles métier strictes :
 * 1. Une nouvelle note ne remplace JAMAIS une note précédente.
 * 2. Chaque note est créée en visibilité interne ('internal') par défaut.
 * 3. Une note finalisée conserve l'historique complet de ses révisions.
 */

async function moi() {
  const membre = await getCurrentMember()
  if (!membre) throw new Error("Session expirée. Reconnectez-vous.")
  return membre
}

function lisible(e: { message?: string; code?: string } | null): string {
  if (e?.code === "23505") return "Cette référence de rencontre existe déjà."
  return messageErreur(e)
}

interface RawDbMeetingNote {
  id: string
  firm_id: string
  matter_id: string
  client_id: string | null
  calendar_event_id: string | null
  reference: string
  meeting_date: string
  meeting_time: string | null
  duration_minutes: number
  meeting_type: string
  meeting_type_other: string | null
  reason: string
  reason_other: string | null
  subject: string
  content: string
  sections: Record<string, unknown> | null
  next_meeting_date: string | null
  next_meeting_time: string | null
  next_meeting_reason: string | null
  next_meeting_notes: string | null
  status: string
  visibility: string
  shared_at: string | null
  shared_by: string | null
  created_by: string | null
  created_by_name: string | null
  created_at: string
  updated_by: string | null
  updated_by_name: string | null
  updated_at: string
  finalized_at: string | null
  finalized_by: string | null
  history: MeetingNoteHistoryEntry[] | null
  meeting_note_documents?: {
    document_id: string
    added_at: string
    documents?: {
      id: string
      name: string
      category: string
    } | null
  }[] | null
}

function mapMeetingNote(row: RawDbMeetingNote): MeetingNote {
  const docs = (row.meeting_note_documents ?? [])
    .filter((d) => d.documents)
    .map((d) => ({
      id: String(d.documents!.id),
      name: String(d.documents!.name),
      category: String(d.documents!.category),
      addedAt: String(d.added_at),
    }))

  return {
    id: row.id,
    firmId: row.firm_id,
    matterId: row.matter_id,
    clientId: row.client_id,
    calendarEventId: row.calendar_event_id,
    reference: row.reference,
    meetingDate: row.meeting_date,
    meetingTime: row.meeting_time,
    durationMinutes: row.duration_minutes ?? 60,
    meetingType: row.meeting_type as MeetingNote["meetingType"],
    meetingTypeOther: row.meeting_type_other,
    reason: row.reason as MeetingNote["reason"],
    reasonOther: row.reason_other,
    subject: row.subject,
    content: row.content,
    sections: (row.sections ?? {}) as MeetingNote["sections"],
    nextMeetingDate: row.next_meeting_date,
    nextMeetingTime: row.next_meeting_time,
    nextMeetingReason: row.next_meeting_reason,
    nextMeetingNotes: row.next_meeting_notes,
    status: row.status as MeetingNote["status"],
    visibility: row.visibility as MeetingNote["visibility"],
    sharedAt: row.shared_at,
    sharedBy: row.shared_by,
    createdBy: row.created_by,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    updatedBy: row.updated_by,
    updatedByName: row.updated_by_name,
    updatedAt: row.updated_at,
    finalizedAt: row.finalized_at,
    finalizedBy: row.finalized_by,
    history: row.history ?? [],
    documents: docs,
  }
}

/**
 * Liste toutes les notes de rencontre d'un dossier client,
 * triées de la plus récente à la plus ancienne.
 */
export async function listerNotesRencontre(matterId: string): Promise<MeetingNote[]> {
  try {
    const membre = await moi()
    const sb = await getSessionSupabase()

    // Résoudre l'UUID réel si matterId est une référence comme "#DOS-35695"
    let uuidCible = matterId
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(matterId)) {
      const nue = decodeURIComponent(matterId).replace("#", "")
      const { data: m } = await sb
        .from("matters")
        .select("id")
        .in("reference", [decodeURIComponent(matterId), `#${nue}`, nue])
        .maybeSingle()
      if (m?.id) uuidCible = m.id
    }

    const { data, error } = await sb
      .from("matter_meeting_notes")
      .select(`
        *,
        meeting_note_documents(
          document_id,
          added_at,
          documents(id, name, category)
        )
      `)
      .eq("firm_id", membre.firmId)
      .eq("matter_id", uuidCible)
      .order("meeting_date", { ascending: false })
      .order("created_at", { ascending: false })

    if (error || !data) return []
    return (data as unknown as RawDbMeetingNote[]).map(mapMeetingNote)
  } catch (e) {
    console.error("listerNotesRencontre error:", e)
    return []
  }
}

/**
 * Récupère une note de rencontre spécifique par son identifiant.
 */
export async function obtenirNoteRencontre(id: string): Promise<MeetingNote | null> {
  try {
    const membre = await moi()
    const sb = await getSessionSupabase()

    const { data, error } = await sb
      .from("matter_meeting_notes")
      .select(`
        *,
        meeting_note_documents(
          document_id,
          added_at,
          documents(id, name, category)
        )
      `)
      .eq("firm_id", membre.firmId)
      .eq("id", id)
      .maybeSingle()

    if (error || !data) return null
    return mapMeetingNote(data as unknown as RawDbMeetingNote)
  } catch {
    return null
  }
}

/**
 * Crée une NOUVELLE note de rencontre.
 * Génère automatiquement la référence unique REN-YYYY-XXXX.
 */
export async function creerNoteRencontre(input: MeetingNoteInput): Promise<Resultat & { id?: string; reference?: string }> {
  try {
    const membre = await moi()
    const sb = await getSessionSupabase()

    if (!input.subject.trim()) {
      return { ok: false, message: "L'objet ou sujet de la rencontre est obligatoire." }
    }
    if (!input.content.trim()) {
      return { ok: false, message: "Le compte rendu / notes de la rencontre ne peut pas être vide." }
    }

    // Résoudre l'UUID réel du dossier si nécessaire
    let realMatterId = input.matterId
    let realClientId = input.clientId
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.matterId)) {
      const nue = decodeURIComponent(input.matterId).replace("#", "")
      const { data: m } = await sb
        .from("matters")
        .select("id, client_id")
        .in("reference", [decodeURIComponent(input.matterId), `#${nue}`, nue])
        .maybeSingle()
      if (m?.id) {
        realMatterId = m.id
        if (!realClientId && m.client_id) realClientId = m.client_id
      }
    }

    // Générer la prochaine référence unique
    let reference = `REN-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
    const { data: refGen } = await sb.rpc("prochaine_reference_rencontre", { f_id: membre.firmId })
    if (refGen && typeof refGen === "string") {
      reference = refGen
    }

    const auteurNom = membre.fullName || membre.email

    const { data: noteCreee, error } = await sb
      .from("matter_meeting_notes")
      .insert({
        firm_id: membre.firmId,
        matter_id: realMatterId,
        client_id: realClientId || null,
        calendar_event_id: input.calendarEventId || null,
        reference,
        meeting_date: input.meetingDate || new Date().toISOString().slice(0, 10),
        meeting_time: input.meetingTime || null,
        duration_minutes: input.durationMinutes || 60,
        meeting_type: input.meetingType || "consultation",
        meeting_type_other: input.meetingTypeOther || null,
        reason: input.reason || "suivi_dossier",
        reason_other: input.reasonOther || null,
        subject: input.subject.trim(),
        content: input.content.trim(),
        sections: input.sections ?? {},
        next_meeting_date: input.nextMeetingDate || null,
        next_meeting_time: input.nextMeetingTime || null,
        next_meeting_reason: input.nextMeetingReason || null,
        next_meeting_notes: input.nextMeetingNotes || null,
        status: input.status || "draft",
        visibility: input.visibility || "internal",
        created_by: membre.profileId,
        created_by_name: auteurNom,
        updated_by: membre.profileId,
        updated_by_name: auteurNom,
        finalized_at: input.status === "finalized" ? new Date().toISOString() : null,
        finalized_by: input.status === "finalized" ? membre.profileId : null,
      })
      .select("id, reference")
      .single()

    if (error || !noteCreee) return { ok: false, message: lisible(error) }

    // Associer les documents si fournis
    if (input.documentIds && input.documentIds.length > 0) {
      const liens = input.documentIds.map((docId) => ({
        meeting_note_id: noteCreee.id,
        document_id: docId,
        firm_id: membre.firmId,
      }))
      await sb.from("meeting_note_documents").insert(liens)
    }

    revalidatePath("/[locale]/matters/[id]", "page")
    return {
      ok: true,
      id: noteCreee.id,
      reference: noteCreee.reference,
      message: `Compte-rendu ${noteCreee.reference} enregistré avec succès.`,
    }
  } catch (e) {
    return { ok: false, message: messageErreur(e) }
  }
}

/**
 * Modifie une note existante.
 * Si la note était déjà finalisée, consigne automatiquement l'ancienne version dans `history`.
 */
export async function modifierNoteRencontre(
  id: string,
  input: Partial<MeetingNoteInput>,
  changeSummary?: string
): Promise<Resultat> {
  try {
    const membre = await moi()
    const sb = await getSessionSupabase()

    // 1. Relire la note actuelle
    const { data: existante, error: errGet } = await sb
      .from("matter_meeting_notes")
      .select("*")
      .eq("id", id)
      .eq("firm_id", membre.firmId)
      .maybeSingle()

    if (errGet || !existante) {
      return { ok: false, message: "Note de rencontre introuvable." }
    }

    const auteurNom = membre.fullName || membre.email
    let history = (existante.history as MeetingNoteHistoryEntry[]) ?? []

    // Si la note est déjà finalisée et qu'on modifie son contenu, on historise
    if (existante.status === "finalized") {
      const entry: MeetingNoteHistoryEntry = {
        modifiedAt: new Date().toISOString(),
        modifiedBy: membre.profileId,
        modifiedByName: auteurNom,
        changeSummary: changeSummary || "Modification du compte rendu",
        previousContent: existante.content,
      }
      history = [entry, ...history]
    }

    const updates: Record<string, unknown> = {
      updated_by: membre.profileId,
      updated_by_name: auteurNom,
      updated_at: new Date().toISOString(),
      history,
    }

    if (input.meetingDate !== undefined) updates.meeting_date = input.meetingDate
    if (input.meetingTime !== undefined) updates.meeting_time = input.meetingTime
    if (input.durationMinutes !== undefined) updates.duration_minutes = input.durationMinutes
    if (input.meetingType !== undefined) updates.meeting_type = input.meetingType
    if (input.meetingTypeOther !== undefined) updates.meeting_type_other = input.meetingTypeOther
    if (input.reason !== undefined) updates.reason = input.reason
    if (input.reasonOther !== undefined) updates.reason_other = input.reasonOther
    if (input.subject !== undefined) updates.subject = input.subject.trim()
    if (input.content !== undefined) updates.content = input.content.trim()
    if (input.sections !== undefined) updates.sections = input.sections
    if (input.nextMeetingDate !== undefined) updates.next_meeting_date = input.nextMeetingDate
    if (input.nextMeetingTime !== undefined) updates.next_meeting_time = input.nextMeetingTime
    if (input.nextMeetingReason !== undefined) updates.next_meeting_reason = input.nextMeetingReason
    if (input.nextMeetingNotes !== undefined) updates.next_meeting_notes = input.nextMeetingNotes
    if (input.status !== undefined) {
      updates.status = input.status
      if (input.status === "finalized" && existante.status !== "finalized") {
        updates.finalized_at = new Date().toISOString()
        updates.finalized_by = membre.profileId
      }
    }
    if (input.visibility !== undefined) updates.visibility = input.visibility

    const { error: errUpd } = await sb
      .from("matter_meeting_notes")
      .update(updates)
      .eq("id", id)
      .eq("firm_id", membre.firmId)

    if (errUpd) return { ok: false, message: lisible(errUpd) }

    // Mettre à jour les documents associés si fournis
    if (input.documentIds !== undefined) {
      await sb.from("meeting_note_documents").delete().eq("meeting_note_id", id)
      if (input.documentIds.length > 0) {
        const liens = input.documentIds.map((docId) => ({
          meeting_note_id: id,
          document_id: docId,
          firm_id: membre.firmId,
        }))
        await sb.from("meeting_note_documents").insert(liens)
      }
    }

    revalidatePath("/[locale]/matters/[id]", "page")
    return { ok: true, message: `Note ${existante.reference} mise à jour.` }
  } catch (e) {
    return { ok: false, message: messageErreur(e) }
  }
}

/**
 * Finalise une note de rencontre.
 * La note devient un compte rendu officiel verrouillé contre toute suppression silencieuse.
 */
export async function finaliserNoteRencontre(id: string): Promise<Resultat> {
  try {
    const membre = await moi()
    const sb = await getSessionSupabase()

    const { data: note, error: errCheck } = await sb
      .from("matter_meeting_notes")
      .select("reference")
      .eq("id", id)
      .eq("firm_id", membre.firmId)
      .maybeSingle()

    if (errCheck || !note) return { ok: false, message: "Note introuvable." }

    const { error } = await sb
      .from("matter_meeting_notes")
      .update({
        status: "finalized",
        finalized_at: new Date().toISOString(),
        finalized_by: membre.profileId,
        updated_at: new Date().toISOString(),
        updated_by: membre.profileId,
        updated_by_name: membre.fullName || membre.email,
      })
      .eq("id", id)
      .eq("firm_id", membre.firmId)

    if (error) return { ok: false, message: lisible(error) }

    revalidatePath("/[locale]/matters/[id]", "page")
    return { ok: true, message: `Compte-rendu ${note.reference} finalisé et officialisé.` }
  } catch (e) {
    return { ok: false, message: messageErreur(e) }
  }
}

/**
 * Archive une note de rencontre.
 */
export async function archiverNoteRencontre(id: string): Promise<Resultat> {
  try {
    const membre = await moi()
    const sb = await getSessionSupabase()

    const { error } = await sb
      .from("matter_meeting_notes")
      .update({
        status: "archived",
        updated_at: new Date().toISOString(),
        updated_by: membre.profileId,
        updated_by_name: membre.fullName || membre.email,
      })
      .eq("id", id)
      .eq("firm_id", membre.firmId)

    if (error) return { ok: false, message: lisible(error) }

    revalidatePath("/[locale]/matters/[id]", "page")
    return { ok: true, message: "Note de rencontre archivée." }
  } catch (e) {
    return { ok: false, message: messageErreur(e) }
  }
}

/**
 * Partage explicitement une note avec le client dans son portail.
 */
export async function partagerNoteAvecClient(id: string): Promise<Resultat> {
  try {
    const membre = await moi()
    const sb = await getSessionSupabase()

    const { data: note, error: errCheck } = await sb
      .from("matter_meeting_notes")
      .select("reference, status, client_id")
      .eq("id", id)
      .eq("firm_id", membre.firmId)
      .maybeSingle()

    if (errCheck || !note) return { ok: false, message: "Note introuvable." }

    const { error } = await sb
      .from("matter_meeting_notes")
      .update({
        visibility: "shared_client",
        shared_at: new Date().toISOString(),
        shared_by: membre.profileId,
        // Si elle était brouillon, le partage l'officialise
        status: "finalized",
        finalized_at: new Date().toISOString(),
        finalized_by: membre.profileId,
        updated_at: new Date().toISOString(),
        updated_by: membre.profileId,
        updated_by_name: membre.fullName || membre.email,
      })
      .eq("id", id)
      .eq("firm_id", membre.firmId)

    if (error) return { ok: false, message: lisible(error) }

    revalidatePath("/[locale]/matters/[id]", "page")
    return {
      ok: true,
      message: `Compte-rendu ${note.reference} partagé avec le client sur son portail.`,
    }
  } catch (e) {
    return { ok: false, message: messageErreur(e) }
  }
}

/**
 * Crée une échéance réglementaire ou de suivi directement depuis une note de rencontre.
 */
export async function creerEcheanceDepuisNote(
  noteId: string,
  data: {
    title: string
    dueOn: string
    priority?: string
    description?: string
  }
): Promise<Resultat> {
  try {
    const membre = await moi()
    const sb = await getSessionSupabase()

    const { data: note } = await sb
      .from("matter_meeting_notes")
      .select("matter_id, reference")
      .eq("id", noteId)
      .eq("firm_id", membre.firmId)
      .maybeSingle()

    if (!note) return { ok: false, message: "Note introuvable." }

    const { error } = await sb.from("matter_deadlines").insert({
      firm_id: membre.firmId,
      matter_id: note.matter_id,
      title: data.title.trim(),
      description: data.description ? `${data.description} (Issu de ${note.reference})` : `Action convenue lors de la rencontre ${note.reference}`,
      due_on: data.dueOn,
      priority: data.priority || "normal",
      created_by: membre.profileId,
    })

    if (error) return { ok: false, message: lisible(error) }

    revalidatePath("/[locale]/matters/[id]", "page")
    return { ok: true, message: `Échéance créée et liée au dossier (réf. ${note.reference}).` }
  } catch (e) {
    return { ok: false, message: messageErreur(e) }
  }
}
