"use server"

import { revalidatePath } from "next/cache"
import { getCurrentPlatformAdmin, getSessionSupabase } from "@/lib/supabase/session"

/**
 * Actions de la console d'exploitation.
 *
 * Chaque action revérifie la qualité d'administrateur côté serveur. Ce
 * n'est pas redondant avec la protection de la route : une action de
 * serveur est un point d'entrée à part entière, appelable directement
 * sans jamais passer par la page. Se fier au fait que le bouton n'est
 * affiché qu'aux administrateurs reviendrait à protéger une porte en
 * cachant la poignée.
 *
 * Les écritures passent par le client de session, donc par la RLS : même
 * si ce contrôle applicatif était contourné, la base refuserait.
 */

export interface ResultatAction {
  ok: boolean
  message: string
}

async function exigerAdministrateur() {
  const admin = await getCurrentPlatformAdmin()
  if (!admin) throw new Error("Réservé aux administrateurs de la plateforme.")
  return admin
}

/** R suivi de six à huit chiffres ; la longueur varie selon l'époque de délivrance. */
const PERMIS = /^[Rr]-?\d{6,8}$/

export async function creerCabinet(formData: FormData): Promise<ResultatAction> {
  try {
    await exigerAdministrateur()
    const supabase = await getSessionSupabase()

    const nom = String(formData.get("nom") ?? "").trim()
    const permis = String(formData.get("permis") ?? "").trim()
    const proprietaire = String(formData.get("proprietaire") ?? "").trim()
    const courriel = String(formData.get("courriel") ?? "").trim()
    const plan = String(formData.get("plan") ?? "trial")
    const jours = Number.parseInt(String(formData.get("jours") ?? "30"), 10)

    if (!nom) return { ok: false, message: "La raison sociale est obligatoire." }
    if (!PERMIS.test(permis)) {
      return { ok: false, message: `Permis « ${permis} » non conforme. Attendu : R suivi de 6 à 8 chiffres.` }
    }
    if (!proprietaire) return { ok: false, message: "Le nom du consultant est obligatoire." }

    // Un essai sans échéance n'est pas un essai : il devient un accès
    // gratuit permanent que personne ne pense à révoquer.
    const echeance =
      plan === "trial"
        ? new Date(Date.now() + (Number.isFinite(jours) && jours > 0 ? jours : 30) * 86400000)
            .toISOString()
            .slice(0, 10)
        : null

    const { error } = await supabase.from("firms").insert({
      name: nom,
      rcic_license_number: permis,
      owner_name: proprietaire,
      email: courriel || null,
      plan,
      status: "active",
      trial_ends_at: echeance,
    })

    if (error) {
      if (error.code === "23505") {
        return { ok: false, message: "Un cabinet porte déjà ce numéro de permis." }
      }
      return { ok: false, message: error.message }
    }

    revalidatePath("/[locale]/admin", "page")
    return { ok: true, message: `Cabinet « ${nom} » créé.` }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

export async function changerPlan(formData: FormData): Promise<ResultatAction> {
  try {
    await exigerAdministrateur()
    const supabase = await getSessionSupabase()

    const id = String(formData.get("firmId") ?? "")
    const plan = String(formData.get("plan") ?? "")
    const jours = Number.parseInt(String(formData.get("jours") ?? "30"), 10)

    if (!id || !plan) return { ok: false, message: "Cabinet ou plan manquant." }

    const echeance =
      plan === "trial"
        ? new Date(Date.now() + (Number.isFinite(jours) && jours > 0 ? jours : 30) * 86400000)
            .toISOString()
            .slice(0, 10)
        : null

    const { error } = await supabase
      .from("firms")
      .update({ plan, trial_ends_at: echeance, updated_at: new Date().toISOString() })
      .eq("id", id)

    if (error) return { ok: false, message: error.message }

    revalidatePath("/[locale]/admin", "page")
    return { ok: true, message: `Plan passé à « ${plan} ».` }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

export async function basculerAcces(formData: FormData): Promise<ResultatAction> {
  try {
    await exigerAdministrateur()
    const supabase = await getSessionSupabase()

    const id = String(formData.get("firmId") ?? "")
    const suspendre = String(formData.get("suspendre") ?? "") === "1"
    if (!id) return { ok: false, message: "Cabinet manquant." }

    const { error } = await supabase
      .from("firms")
      .update({
        status: suspendre ? "suspended" : "active",
        suspended_at: suspendre ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)

    if (error) return { ok: false, message: error.message }

    revalidatePath("/[locale]/admin", "page")
    return {
      ok: true,
      // La suspension prend effet à la requête suivante : le verrou est
      // porté par current_firm_id(), évaluée à chaque appel.
      message: suspendre
        ? "Accès fermé. L'effet est immédiat, sans redéploiement."
        : "Accès rouvert.",
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}
