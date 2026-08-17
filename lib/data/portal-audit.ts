import "server-only"

import { getSessionSupabase, getCurrentMember } from "@/lib/supabase/session"

/**
 * Journalise l'accès d'un consultant au portail client en mode aperçu / lecture seule.
 * L'événement est consigné dans audit_logs avec l'identité du consultant et la cible client.
 */
export async function journaliserAccesApercuPortail(
  clientId: string,
  clientNom: string
): Promise<void> {
  try {
    const membre = await getCurrentMember()
    if (!membre) return

    const sb = await getSessionSupabase()
    await sb.from("audit_logs").insert({
      firm_id: membre.firmId,
      actor_member_id: membre.profileId,
      actor_email: membre.email,
      actor_name: membre.fullName,
      actor_role: membre.ciccRole,
      action: "client_portal_preview_accessed",
      entity_type: "client",
      entity_id: clientId,
      summary: `Consultation du portail client en mode aperçu (lecture seule) pour ${clientNom || clientId}.`,
    })
  } catch (e) {
    // Ne pas bloquer l'affichage si le log échoue
    console.error("Échec de journalisation audit portail aperçu :", e)
  }
}
