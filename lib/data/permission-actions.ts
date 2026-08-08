"use server"

import { revalidatePath } from "next/cache"
import { getSessionSupabase } from "@/lib/supabase/session"
import { exigerPermission } from "@/lib/auth/permissions"

/**
 * Ajustement des permissions d'un membre, par le cabinet.
 *
 * L'écriture passe par le client de session, donc par
 * `profile_permissions_manage` : elle exige `firm.members`, le même cabinet, et
 * refuse qu'on se vise soi-même. Le contrôle ci-dessous ne produit qu'un
 * message lisible — même contourné, la base refuserait.
 *
 * Ce module ne décide de rien. La règle est dans member_can(), et une seule
 * fois : propriétaire, puis permission réservée, puis ajustement, puis défaut
 * du rôle. La reconstituer ici créerait deux vérités, et l'écran finirait par
 * afficher un droit que la base refuse.
 */

export interface ResultatPermission {
  ok: boolean
  message: string
}

export async function ajusterPermission(formData: FormData): Promise<ResultatPermission> {
  try {
    await exigerPermission("firm.members")
    const supabase = await getSessionSupabase()

    const profilId = String(formData.get("profilId") ?? "")
    const permission = String(formData.get("permission") ?? "")
    const valeur = String(formData.get("valeur") ?? "")

    if (!profilId || !permission) return { ok: false, message: "Membre ou permission manquant." }

    const { data: p } = await supabase
      .from("permissions")
      .select("label_fr, owner_only")
      .eq("key", permission)
      .maybeSingle()

    if (!p) return { ok: false, message: "Permission inconnue." }
    if (p.owner_only) {
      return {
        ok: false,
        message: `« ${p.label_fr} » ne se délègue pas : elle reste au propriétaire du cabinet.`,
      }
    }

    // « defaut » retire l'ajustement au lieu d'écrire une valeur : le membre
    // retombe alors sur ce que son rôle prévoit, et suivra une future
    // modification de ce rôle. Écrire la valeur du défaut la figerait.
    if (valeur === "defaut") {
      const { error } = await supabase
        .from("profile_permissions")
        .delete()
        .eq("profile_id", profilId)
        .eq("permission", permission)
      if (error) return { ok: false, message: error.message }

      revalidatePath("/[locale]/settings", "page")
      return { ok: true, message: `« ${p.label_fr} » suit de nouveau le rôle du membre.` }
    }

    const { error } = await supabase.from("profile_permissions").upsert(
      { profile_id: profilId, permission, granted: valeur === "1", granted_at: new Date().toISOString() },
      { onConflict: "profile_id,permission" }
    )
    if (error) return { ok: false, message: error.message }

    revalidatePath("/[locale]/settings", "page")
    return {
      ok: true,
      message: `« ${p.label_fr} » ${valeur === "1" ? "accordée" : "retirée"}. Effet immédiat.`,
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}
