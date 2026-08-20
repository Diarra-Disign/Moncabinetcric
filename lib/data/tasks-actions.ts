"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getSessionSupabase } from "@/lib/supabase/session"
import { exigerPermission } from "@/lib/auth/permissions"
import { messageErreur } from "@/lib/data/erreurs"
import { journaliser } from "./journal"

export interface ResultatTache {
  ok: boolean
  message: string
  id?: string
}

const SchemaCreationTache = z.object({
  title: z.string().trim().min(1, "Le titre est obligatoire.").max(250),
  description: z.string().trim().max(2000).optional().nullable(),
  matterId: z.string().uuid().optional().nullable(),
  clientId: z.string().uuid().optional().nullable(),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  assignedTo: z.string().uuid().optional().nullable(),
  locale: z.string().default("fr"),
})

const SchemaModificationTache = z.object({
  id: z.string().uuid("Identifiant de tâche invalide."),
  title: z.string().trim().min(1, "Le titre est obligatoire.").max(250).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  assignedTo: z.string().uuid().optional().nullable(),
  locale: z.string().default("fr"),
})

/**
 * Créer une nouvelle tâche opérationnelle (de dossier ou générale de cabinet).
 */
export async function creerTache(formData: FormData): Promise<ResultatTache> {
  try {
    const membre = await exigerPermission("records.write")

    const brut = {
      title: formData.get("title"),
      description: formData.get("description") || null,
      matterId: formData.get("matterId") || null,
      clientId: formData.get("clientId") || null,
      priority: formData.get("priority") || "normal",
      dueDate: formData.get("dueDate") || null,
      assignedTo: formData.get("assignedTo") || null,
      locale: formData.get("locale") || "fr",
    }

    const valide = SchemaCreationTache.safeParse(brut)
    if (!valide.success) {
      return { ok: false, message: valide.error.issues[0]?.message ?? "Données invalides." }
    }

    const { data: d } = valide
    const sb = await getSessionSupabase()

    // Si matterId est fourni mais pas clientId, on récupère le client_id du dossier
    let clientIdFinal = d.clientId
    if (d.matterId && !clientIdFinal) {
      const { data: matter } = await sb
        .from("matters")
        .select("client_id")
        .eq("id", d.matterId)
        .maybeSingle()
      if (matter?.client_id) {
        clientIdFinal = String(matter.client_id)
      }
    }

    const { data: inseree, error } = await sb
      .from("tasks")
      .insert({
        firm_id: membre.firmId,
        matter_id: d.matterId || null,
        client_id: clientIdFinal || null,
        title: d.title,
        description: d.description || null,
        priority: d.priority,
        status: "todo",
        due_date: d.dueDate || null,
        created_by: membre.profileId,
        assigned_to: d.assignedTo || membre.profileId, // Assigne par défaut au créateur si non spécifié
      })
      .select("id")
      .single()

    if (error || !inseree) {
      return { ok: false, message: messageErreur(error, d.locale) }
    }

    await journaliser(sb, membre, {
      action: "task.create",
      entityType: "task",
      entityId: String(inseree.id),
      resume: `Tâche créée : « ${d.title} »`,
    })

    if (d.matterId) {
      revalidatePath(`/${d.locale}/matters/${d.matterId}`)
    }
    revalidatePath(`/${d.locale}/dashboard`)

    return {
      ok: true,
      message: d.locale === "en" ? "Task created." : "Tâche enregistrée avec succès.",
      id: String(inseree.id),
    }
  } catch (e) {
    return { ok: false, message: messageErreur(e) }
  }
}

/**
 * Basculer l'état d'une tâche (ex: Cocher 'done' ou rouvrir 'todo').
 */
export async function basculerEtatTache(
  taskId: string,
  nouveauStatut: "todo" | "in_progress" | "done" | "cancelled",
  locale: string = "fr"
): Promise<ResultatTache> {
  try {
    const membre = await exigerPermission("records.write")

    const sb = await getSessionSupabase()

    const { data: tache, error: errGet } = await sb
      .from("tasks")
      .select("id, matter_id, title, status")
      .eq("id", taskId)
      .maybeSingle()

    if (errGet || !tache) {
      return { ok: false, message: "Tâche introuvable." }
    }

    const { error } = await sb
      .from("tasks")
      .update({
        status: nouveauStatut,
        completed_at: nouveauStatut === "done" ? new Date().toISOString() : null,
        completed_by: nouveauStatut === "done" ? membre.profileId : null,
      })
      .eq("id", taskId)

    if (error) {
      return { ok: false, message: messageErreur(error, locale) }
    }

    await journaliser(sb, membre, {
      action: nouveauStatut === "done" ? "task.complete" : "task.status_change",
      entityType: "task",
      entityId: taskId,
      resume: `Tâche « ${tache.title} » marquée ${nouveauStatut}`,
    })

    if (tache.matter_id) {
      revalidatePath(`/${locale}/matters/${tache.matter_id}`)
    }
    revalidatePath(`/${locale}/dashboard`)

    return {
      ok: true,
      message: nouveauStatut === "done"
        ? (locale === "en" ? "Task completed." : "Tâche accomplie.")
        : (locale === "en" ? "Task updated." : "Statut de la tâche mis à jour."),
      id: taskId,
    }
  } catch (e) {
    return { ok: false, message: messageErreur(e, locale) }
  }
}

/**
 * Modifier les détails d'une tâche (titre, date, priorité, assigné).
 */
export async function modifierTache(formData: FormData): Promise<ResultatTache> {
  try {
    const membre = await exigerPermission("records.write")

    const brut = {
      id: formData.get("id"),
      title: formData.get("title") || undefined,
      description: formData.get("description") || null,
      priority: formData.get("priority") || undefined,
      dueDate: formData.get("dueDate") || null,
      assignedTo: formData.get("assignedTo") || null,
      locale: formData.get("locale") || "fr",
    }

    const valide = SchemaModificationTache.safeParse(brut)
    if (!valide.success) {
      return { ok: false, message: valide.error.issues[0]?.message ?? "Données invalides." }
    }

    const { data: d } = valide
    const sb = await getSessionSupabase()

    const { data: existante } = await sb
      .from("tasks")
      .select("id, matter_id")
      .eq("id", d.id)
      .maybeSingle()

    if (!existante) {
      return { ok: false, message: "Tâche introuvable." }
    }

    const { error } = await sb
      .from("tasks")
      .update({
        ...(d.title ? { title: d.title } : {}),
        description: d.description,
        ...(d.priority ? { priority: d.priority } : {}),
        due_date: d.dueDate || null,
        assigned_to: d.assignedTo || null,
      })
      .eq("id", d.id)

    if (error) {
      return { ok: false, message: messageErreur(error, d.locale) }
    }

    if (existante.matter_id) {
      revalidatePath(`/${d.locale}/matters/${existante.matter_id}`)
    }
    revalidatePath(`/${d.locale}/dashboard`)

    return {
      ok: true,
      message: d.locale === "en" ? "Task updated." : "Tâche mise à jour.",
      id: d.id,
    }
  } catch (e) {
    return { ok: false, message: messageErreur(e) }
  }
}

/**
 * Supprimer une tâche opérationnelle.
 */
export async function supprimerTache(taskId: string, locale: string = "fr"): Promise<ResultatTache> {
  try {
    const membre = await exigerPermission("records.delete")

    const sb = await getSessionSupabase()

    const { data: tache } = await sb
      .from("tasks")
      .select("id, matter_id, title")
      .eq("id", taskId)
      .maybeSingle()

    if (!tache) {
      return { ok: false, message: "Tâche introuvable." }
    }

    const { error } = await sb.from("tasks").delete().eq("id", taskId)

    if (error) {
      return { ok: false, message: messageErreur(error, locale) }
    }

    await journaliser(sb, membre, {
      action: "task.delete",
      entityType: "task",
      entityId: taskId,
      resume: `Tâche supprimée : « ${tache.title} »`,
    })

    if (tache.matter_id) {
      revalidatePath(`/${locale}/matters/${tache.matter_id}`)
    }
    revalidatePath(`/${locale}/dashboard`)

    return {
      ok: true,
      message: locale === "en" ? "Task deleted." : "Tâche supprimée.",
      id: taskId,
    }
  } catch (e) {
    return { ok: false, message: messageErreur(e, locale) }
  }
}
