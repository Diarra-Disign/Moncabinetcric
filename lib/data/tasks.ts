import "server-only"

import { getSessionSupabase, getCurrentMember } from "@/lib/supabase/session"
import type { TaskRecord, TaskStatus, TaskPriority, TaskMember } from "./types"

interface RowTask {
  id: string
  firm_id: string
  matter_id: string | null
  client_id: string | null
  title: string
  description: string | null
  priority: string
  status: string
  due_date: string | null
  created_by: string | null
  assigned_to: string | null
  completed_at: string | null
  completed_by: string | null
  created_at: string
  updated_at: string
  matters?: { reference?: string } | { reference?: string }[] | null
  clients?: { name?: string } | { name?: string }[] | null
  assigne?: { full_name?: string } | { full_name?: string }[] | null
  auteur?: { full_name?: string } | { full_name?: string }[] | null
}

function mapperTache(r: RowTask): TaskRecord {
  const matterRef = Array.isArray(r.matters) ? r.matters[0]?.reference : r.matters?.reference
  const clientNom = Array.isArray(r.clients) ? r.clients[0]?.name : r.clients?.name
  const assigneNom = Array.isArray(r.assigne) ? r.assigne[0]?.full_name : r.assigne?.full_name
  const auteurNom = Array.isArray(r.auteur) ? r.auteur[0]?.full_name : r.auteur?.full_name

  return {
    id: r.id,
    firmId: r.firm_id,
    matterId: r.matter_id,
    matterReference: matterRef ?? null,
    clientId: r.client_id,
    clientName: clientNom ?? null,
    title: r.title,
    description: r.description,
    priority: (r.priority as TaskPriority) || "normal",
    status: (r.status as TaskStatus) || "todo",
    dueDate: r.due_date,
    createdBy: r.created_by,
    createdByName: auteurNom ?? null,
    assignedTo: r.assigned_to,
    assignedToName: assigneNom ?? null,
    completedAt: r.completed_at,
    completedBy: r.completed_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

/**
 * Liste les tâches rattachées à un dossier spécifique.
 */
export async function listerTachesDossier(matterId: string): Promise<TaskRecord[]> {
  const sb = await getSessionSupabase()
  const { data, error } = await sb
    .from("tasks")
    .select(`
      *,
      matters:matter_id(reference),
      clients:client_id(name),
      assigne:assigned_to(full_name),
      auteur:created_by(full_name)
    `)
    .eq("matter_id", matterId)
    .order("created_at", { ascending: false })

  if (error || !data) {
    if (error) console.error("listerTachesDossier :", error.message)
    return []
  }

  return (data as RowTask[]).map(mapperTache)
}

/**
 * Liste les tâches du cabinet avec filtres optionnels.
 */
export async function listerTachesCabinet(filtres?: {
  assignedToMe?: boolean
  status?: TaskStatus
  priority?: TaskPriority
}): Promise<TaskRecord[]> {
  const sb = await getSessionSupabase()
  const membre = await getCurrentMember()

  let requete = sb
    .from("tasks")
    .select(`
      *,
      matters:matter_id(reference),
      clients:client_id(name),
      assigne:assigned_to(full_name),
      auteur:created_by(full_name)
    `)
    .order("created_at", { ascending: false })

  if (filtres?.assignedToMe && membre?.profileId) {
    requete = requete.eq("assigned_to", membre.profileId)
  }

  if (filtres?.status) {
    requete = requete.eq("status", filtres.status)
  }

  if (filtres?.priority) {
    requete = requete.eq("priority", filtres.priority)
  }

  const { data, error } = await requete

  if (error || !data) {
    if (error) console.error("listerTachesCabinet :", error.message)
    return []
  }

  return (data as RowTask[]).map(mapperTache)
}

/**
 * Statistiques rapides sur les tâches du cabinet.
 */
export async function statistiquesTaches(): Promise<{
  total: number
  enAttente: number
  enRetard: number
  terminees: number
}> {
  const sb = await getSessionSupabase()
  const aujourdhui = new Date().toISOString().slice(0, 10)

  const { data } = await sb
    .from("tasks")
    .select("status, due_date")

  if (!data) return { total: 0, enAttente: 0, enRetard: 0, terminees: 0 }

  let enAttente = 0
  let enRetard = 0
  let terminees = 0

  for (const t of data) {
    if (t.status === "done") {
      terminees++
    } else if (t.status !== "cancelled") {
      enAttente++
      if (t.due_date && t.due_date < aujourdhui) {
        enRetard++
      }
    }
  }

  return {
    total: data.length,
    enAttente,
    enRetard,
    terminees,
  }
}

/**
 * Liste les collaborateurs du cabinet pour l'attribution des tâches.
 */
export async function listerMembresCabinet(): Promise<TaskMember[]> {
  const sb = await getSessionSupabase()
  const { data, error } = await sb
    .from("profiles")
    .select("id, full_name, cicc_role, email")
    .order("full_name", { ascending: true })

  if (error || !data) {
    if (error) console.error("listerMembresCabinet :", error.message)
    return []
  }

  return data.map((p) => ({
    id: p.id,
    fullName: p.full_name || p.email || "Collaborateur",
    role: p.cicc_role || "staff",
    email: p.email,
  }))
}
