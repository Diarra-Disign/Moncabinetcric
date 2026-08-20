"use server"

import { createClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import { getCurrentPlatformAdmin, getSessionSupabase } from "@/lib/supabase/session"
import { exigerPermission } from "@/lib/auth/permissions"
import { messageErreur } from "@/lib/data/erreurs"

/**
 * Demandes de places : le cabinet demande, l'exploitant accorde.
 *
 * Un cabinet à court de places se heurtait à un refus sec du déclencheur
 * enforce_seat_limit, sans autre issue que de changer de forfait ou d'écrire un
 * courriel. Ces deux actions ouvrent le chemin manquant.
 *
 * La séparation est portée par la base, pas par ce fichier :
 * `seat_requests_create` n'autorise l'insertion qu'avec `status = 'pending'` et
 * `granted_seats = 0`, et aucune politique d'UPDATE n'est ouverte au cabinet.
 * Il ne peut donc ni se répondre à lui-même, ni effacer un refus.
 */

export interface ResultatSieges {
  ok: boolean
  message: string
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Configuration Supabase incomplète.")
  return createClient(url, key, { auth: { persistSession: false } })
}

/** Dépose une demande. Une seule à la fois : l'index unique l'impose. */
export async function demanderSieges(formData: FormData): Promise<ResultatSieges> {
  try {
    const membre = await exigerPermission("firm.members")
    const supabase = await getSessionSupabase()

    const seats = Number.parseInt(String(formData.get("seats") ?? "1"), 10)
    if (!Number.isFinite(seats) || seats < 1 || seats > 50) {
      return { ok: false, message: "Indiquez entre 1 et 50 places." }
    }

    const { error } = await supabase.from("seat_requests").insert({
      firm_id: membre.firmId,
      requested_by: membre.userId,
      requester_name: membre.fullName || membre.email,
      seats,
      role_hint: String(formData.get("role") ?? "").trim() || null,
      justification: String(formData.get("justification") ?? "").trim() || null,
      status: "pending",
      granted_seats: 0,
    })

    if (error) {
      // 23505 : l'index partiel qui n'admet qu'une demande vivante par cabinet.
      // Sans lui, un clic répété en empile dix et l'exploitant traite dix fois
      // la même chose.
      if (error.code === "23505") {
        return {
          ok: false,
          message: "Une demande est déjà en attente pour ce cabinet. Attendez la réponse avant d'en déposer une autre.",
        }
      }
      return { ok: false, message: messageErreur(error) }
    }

    revalidatePath("/[locale]/settings", "page")
    return {
      ok: true,
      message: `Demande de ${seats} place(s) envoyée. Vous serez informé de la réponse.`,
    }
  } catch (e) {
    return { ok: false, message: messageErreur(e) }
  }
}

/**
 * Réponse de l'exploitant : accorder, refuser, ou demander des précisions.
 *
 * Accorder ajoute les places à `firms.extra_seats`. Cela ne les FACTURE pas :
 * leur prix suivra au prochain changement d'abonnement, où sessionPaiement()
 * recompte les places occupées. Le message le dit à l'exploitant au moment où
 * il accorde, plutôt que de le lui laisser découvrir sur son relevé.
 */
export async function repondreDemandeSieges(formData: FormData): Promise<ResultatSieges> {
  try {
    const admin = await getCurrentPlatformAdmin()
    if (!admin) return { ok: false, message: "Réservé aux administrateurs de la plateforme." }

    const supabase = await getSessionSupabase()
    const id = String(formData.get("id") ?? "")
    const decision = String(formData.get("decision") ?? "")
    const reponse = String(formData.get("reponse") ?? "").trim()

    if (!id) return { ok: false, message: "Demande manquante." }
    if (!["approved", "refused", "info_requested"].includes(decision)) {
      return { ok: false, message: "Décision inconnue." }
    }

    const { data: demande } = await supabase
      .from("seat_requests")
      .select("firm_id, seats, status, firms(name, extra_seats)")
      .eq("id", id)
      .maybeSingle()

    if (!demande) return { ok: false, message: "Demande introuvable." }
    if (demande.status === "approved" || demande.status === "refused") {
      // Sans ce garde-fou, un double clic accorderait les places deux fois.
      return { ok: false, message: "Cette demande a déjà reçu une réponse." }
    }

    const cabinet = demande.firms as unknown as { name?: string; extra_seats?: number } | null
    const demandees = demande.seats as number
    const accordees =
      decision === "approved"
        ? Math.max(0, Number.parseInt(String(formData.get("accordees") ?? demandees), 10) || demandees)
        : 0

    const { error } = await supabase
      .from("seat_requests")
      .update({
        status: decision,
        granted_seats: accordees,
        response: reponse || null,
        handled_by: admin.userId,
        handled_at: new Date().toISOString(),
      })
      .eq("id", id)

    if (error) return { ok: false, message: messageErreur(error) }

    if (decision === "approved" && accordees > 0) {
      const { error: eSieges } = await supabase
        .from("firms")
        .update({
          extra_seats: (cabinet?.extra_seats ?? 0) + accordees,
          updated_at: new Date().toISOString(),
        })
        .eq("id", demande.firm_id as string)

      if (eSieges) {
        return {
          ok: false,
          message: `Demande marquée accordée, mais les places n'ont pas été ajoutées : ${messageErreur(eSieges)}`,
        }
      }
    }

    await serviceClient().from("platform_audit").insert({
      actor_id: admin.userId,
      actor_email: admin.email,
      action: `seat_request.${decision}`,
      firm_id: demande.firm_id,
      firm_name: cabinet?.name ?? "",
      summary:
        decision === "approved"
          ? `${accordees} place(s) accordée(s) à ${cabinet?.name ?? "un cabinet"} (${demandees} demandée(s)).`
          : decision === "refused"
            ? `Demande de ${demandees} place(s) refusée à ${cabinet?.name ?? "un cabinet"}.`
            : `Précisions demandées à ${cabinet?.name ?? "un cabinet"}.`,
      details: { demandees, accordees, reponse },
    })

    revalidatePath("/[locale]/admin", "page")

    if (decision === "approved") {
      return {
        ok: true,
        message:
          `${accordees} place(s) ajoutée(s). Attention : elles ne sont pas facturées automatiquement — ` +
          `leur prix suivra au prochain changement d'abonnement du cabinet.`,
      }
    }
    return {
      ok: true,
      message: decision === "refused" ? "Demande refusée." : "Précisions demandées au cabinet.",
    }
  } catch (e) {
    return { ok: false, message: messageErreur(e) }
  }
}
