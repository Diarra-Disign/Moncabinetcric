"use server"

import { revalidatePath } from "next/cache"
import { getSessionSupabase, getCurrentMember } from "@/lib/supabase/session"
import { messageErreur } from "@/lib/data/erreurs"

export interface Resultat {
  ok: boolean
  message: string
}

/**
 * Marque des notifications comme lues, pour CE membre seulement.
 *
 * L'insertion ignore les doublons plutôt que de les prévenir : marquer deux
 * fois la même notification n'est pas une erreur qu'il faille signaler à
 * quelqu'un, c'est un double clic.
 */
export async function marquerLues(formData: FormData): Promise<Resultat> {
  try {
    const membre = await getCurrentMember()
    if (!membre) return { ok: false, message: "Session expirée." }

    const ids = String(formData.get("ids") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    if (ids.length === 0) return { ok: true, message: "Rien à marquer." }

    const sb = await getSessionSupabase()
    const { error } = await sb
      .from("notification_reads")
      .upsert(
        ids.map((id) => ({ notification_id: id, profile_id: membre.profileId })),
        { onConflict: "notification_id,profile_id", ignoreDuplicates: true }
      )

    if (error) return { ok: false, message: messageErreur(error) }

    revalidatePath("/", "layout")
    return { ok: true, message: "Notifications marquées comme lues." }
  } catch (e) {
    return { ok: false, message: messageErreur(e) }
  }
}
