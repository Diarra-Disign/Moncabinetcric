"use server"

import { revalidatePath } from "next/cache"
import { getSessionSupabase } from "@/lib/supabase/session"
import { messageErreur } from "@/lib/data/erreurs"

export interface ResultatAction {
  ok: boolean
  message: string
}

export async function repondreValidation(formData: FormData): Promise<ResultatAction> {
  try {
    const { getCurrentPortalClient, getCurrentMember } = await import("@/lib/supabase/session")
    const realClient = await getCurrentPortalClient()
    const membre = await getCurrentMember()

    // 1. Verrou serveur strict : le consultant en mode aperçu n'a pas le droit d'agir à la place du client
    if (membre && !realClient) {
      return {
        ok: false,
        message: "Action refusée : Vous êtes en mode aperçu (lecture seule). Les actions sont réservées au client.",
      }
    }

    if (!realClient) {
      return { ok: false, message: "Session client invalide ou expirée." }
    }

    const sb = await getSessionSupabase()
    const reviewId = String(formData.get("reviewId") ?? "").trim()
    const decision = String(formData.get("decision") ?? "").trim() // "confirmed" ou "error_reported"
    const comment = String(formData.get("comment") ?? "").trim()

    if (!reviewId) {
      return { ok: false, message: "Demande de validation introuvable." }
    }

    if (decision !== "confirmed" && decision !== "error_reported") {
      return { ok: false, message: "Décision invalide. Choisissez 'Confirmer' ou 'Signaler une erreur'." }
    }

    if (decision === "error_reported" && !comment) {
      return { ok: false, message: "Veuillez préciser l'erreur constatée pour permettre sa correction." }
    }

    // Lire les informations de la demande pour notifier le consultant
    const { data: rev } = await sb
      .from("document_reviews")
      .select("id, firm_id, client_id, matter_id, document_id, requested_by, documents(name), clients(name), matters(reference)")
      .eq("id", reviewId)
      .maybeSingle()

    const { error } = await sb
      .from("document_reviews")
      .update({
        status: decision,
        client_comment: comment || null,
        responded_at: new Date().toISOString(),
      })
      .eq("id", reviewId)

    if (error) {
      return { ok: false, message: messageErreur(error) }
    }

    if (rev) {
      const docName = (rev.documents as unknown as { name?: string })?.name || "Document"
      const clientName = (rev.clients as unknown as { name?: string })?.name || "Le client"
      const matterRef = (rev.matters as unknown as { reference?: string })?.reference || ""

      await sb.from("notifications").insert({
        firm_id: rev.firm_id,
        profile_id: rev.requested_by || null,
        kind: decision === "confirmed" ? "document_confirmed" : "document_error_reported",
        title:
          decision === "confirmed"
            ? `✅ Validation reçue · ${docName}`
            : `⚠️ Erreur signalée · ${docName}`,
        body:
          decision === "confirmed"
            ? `${clientName} a confirmé l'exactitude du document « ${docName} »${matterRef ? ` (dossier ${matterRef})` : ""}.`
            : `${clientName} a signalé une erreur sur « ${docName} »${matterRef ? ` (dossier ${matterRef})` : ""} : "${comment}".`,
        link: matterRef ? `/matters/${encodeURIComponent(matterRef)}` : "/matters",
        entity_type: "document_review",
        entity_id: reviewId,
      })
    }

    revalidatePath("/[locale]/portal", "page")
    revalidatePath("/[locale]/matters/[id]", "page")
    revalidatePath("/", "layout")
    return {
      ok: true,
      message:
        decision === "confirmed"
          ? "Document confirmé avec succès. Le consultant en a été notifié !"
          : "Signalement d'erreur enregistré. Le consultant en a été notifié.",
    }
  } catch (e) {
    return { ok: false, message: messageErreur(e) }
  }
}
