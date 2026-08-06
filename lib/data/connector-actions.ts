"use server"

import { revalidatePath } from "next/cache"
import { getCurrentMember, getSessionSupabase } from "@/lib/supabase/session"
import { creerCle } from "@/lib/data/connector-auth"

/**
 * Pilotage du connecteur par le cabinet.
 *
 * Ces actions passent par le client de session, donc par la RLS : les
 * politiques de `ai_api_keys` et `ai_connector_settings` exigent d'être
 * propriétaire de SON cabinet. Le contrôle applicatif ci-dessous ne sert
 * qu'à produire un message lisible — même contourné, la base refuserait.
 *
 * Une seule exception, la création de clé : elle passe par la clé de
 * service, parce qu'elle doit engendrer le secret côté serveur et n'en
 * garder que l'empreinte. Le cabinet y est celui de la session, jamais un
 * paramètre.
 */

export interface ResultatConnecteur {
  ok: boolean
  message: string
  /** Clé en clair, rendue une seule fois et jamais relisible ensuite. */
  cle?: string
}

async function exigerProprietaire() {
  const membre = await getCurrentMember()
  if (!membre) throw new Error("Session absente.")
  if (membre.ciccRole !== "owner") {
    throw new Error("Seul le propriétaire du cabinet peut régler le connecteur.")
  }
  return membre
}

/** Ouvre ou ferme le connecteur du cabinet. */
export async function basculerConnecteur(formData: FormData): Promise<ResultatConnecteur> {
  try {
    const membre = await exigerProprietaire()
    const supabase = await getSessionSupabase()
    const activer = String(formData.get("activer") ?? "") === "1"

    const { error } = await supabase
      .from("ai_connector_settings")
      .update({
        enabled: activer,
        enabled_by: activer ? membre.userId : null,
        enabled_at: activer ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("firm_id", membre.firmId)

    if (error) return { ok: false, message: error.message }

    revalidatePath("/[locale]/settings/connector", "page")
    return {
      ok: true,
      // La fermeture vaut pour toutes les clés à la fois : connector_firm()
      // consulte les réglages à chaque appel, sans mise en cache.
      message: activer
        ? "Connecteur ouvert. Les clés existantes redeviennent utilisables."
        : "Connecteur fermé. Toutes les clés cessent de fonctionner immédiatement.",
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

/** Engendre une clé pour le cabinet du propriétaire connecté. */
export async function creerCleApi(formData: FormData): Promise<ResultatConnecteur> {
  try {
    const membre = await exigerProprietaire()
    const label = String(formData.get("label") ?? "").trim()
    const jours = Number.parseInt(String(formData.get("jours") ?? ""), 10)

    if (label.length < 2) {
      return { ok: false, message: "Donnez un nom à cette clé : c'est ce qui permettra de la reconnaître." }
    }

    const r = await creerCle({
      firmId: membre.firmId,
      label,
      creePar: membre.userId,
      jours: Number.isFinite(jours) && jours > 0 ? jours : undefined,
    })

    if (!r.ok || !r.cle) return { ok: false, message: r.message }

    revalidatePath("/[locale]/settings/connector", "page")
    return { ok: true, message: r.message, cle: r.cle.cle }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

/** Révoque une clé. Irréversible : une clé révoquée ne se rouvre pas. */
export async function revoquerCleApi(formData: FormData): Promise<ResultatConnecteur> {
  try {
    const membre = await exigerProprietaire()
    const supabase = await getSessionSupabase()
    const id = String(formData.get("id") ?? "")
    if (!id) return { ok: false, message: "Clé manquante." }

    // Le filtre sur le cabinet est redondant avec la RLS, et c'est voulu :
    // si la politique venait à être assouplie, la requête resterait bornée.
    const { error } = await supabase
      .from("ai_api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id)
      .eq("firm_id", membre.firmId)

    if (error) return { ok: false, message: error.message }

    revalidatePath("/[locale]/settings/connector", "page")
    return { ok: true, message: "Clé révoquée. Elle cesse de fonctionner immédiatement." }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}
