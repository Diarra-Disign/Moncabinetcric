"use server"

import { randomBytes, createHash } from "node:crypto"
import { revalidatePath } from "next/cache"
import { getCurrentMember, getSessionSupabase } from "@/lib/supabase/session"

/**
 * Gestion des membres d'un cabinet, depuis l'écran Paramètres.
 *
 * Toutes ces actions sont réservées au propriétaire du cabinet. La
 * vérification est refaite ici à chaque appel : une action de serveur
 * s'appelle directement, sans passer par la page qui masque les boutons.
 *
 * La RLS applique la même règle en base — les politiques d'écriture sur
 * profiles exigent is_firm_owner(). Ce contrôle applicatif sert à rendre
 * l'erreur lisible, pas à assurer la sécurité.
 */

export interface ResultatMembre {
  ok: boolean
  message: string
  /** Lien d'invitation, affiché une seule fois : seule l'empreinte est stockée. */
  lien?: string
}

const ROLES = ["owner", "rcic", "risia", "staff", "bookkeeper", "readonly"] as const

async function exigerProprietaire() {
  const membre = await getCurrentMember()
  if (!membre) throw new Error("Session absente.")
  if (membre.ciccRole !== "owner") {
    throw new Error("Réservé au propriétaire du cabinet.")
  }
  return membre
}

export async function inviterMembre(formData: FormData): Promise<ResultatMembre> {
  try {
    const membre = await exigerProprietaire()
    const supabase = await getSessionSupabase()

    const courriel = String(formData.get("courriel") ?? "").trim().toLowerCase()
    const role = String(formData.get("role") ?? "staff")
    const jours = Number.parseInt(String(formData.get("jours") ?? "7"), 10)

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(courriel)) {
      return { ok: false, message: "Adresse courriel non valide." }
    }
    if (!ROLES.includes(role as (typeof ROLES)[number])) {
      return { ok: false, message: `Rôle « ${role} » inconnu.` }
    }

    // Un membre déjà rattaché ne doit pas recevoir d'invitation : elle
    // créerait un second profil pour la même personne.
    const { data: existant } = await supabase
      .from("profiles")
      .select("id")
      .eq("firm_id", membre.firmId)
      .eq("email", courriel)
      .maybeSingle()
    if (existant) {
      return { ok: false, message: "Cette personne est déjà membre du cabinet." }
    }

    // Le jeton n'est jamais stocké : seule son empreinte l'est. Une fuite
    // de la table ne permettrait donc pas de rejouer une invitation.
    const jeton = randomBytes(32).toString("base64url")
    const empreinte = createHash("sha256").update(jeton).digest("hex")
    const validite = Number.isFinite(jours) && jours > 0 ? jours : 7

    const { error } = await supabase.from("invitations").insert({
      firm_id: membre.firmId,
      email: courriel,
      cicc_role: role,
      token_hash: empreinte,
      expires_at: new Date(Date.now() + validite * 86400000).toISOString(),
    })

    if (error) return { ok: false, message: error.message }

    revalidatePath("/[locale]/settings", "page")
    return {
      ok: true,
      message: `Invitation créée pour ${courriel}. Le lien n'est affiché qu'une fois.`,
      lien: `/fr/bienvenue?jeton=${jeton}`,
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

export async function changerRole(formData: FormData): Promise<ResultatMembre> {
  try {
    const membre = await exigerProprietaire()
    const supabase = await getSessionSupabase()

    const profilId = String(formData.get("profilId") ?? "")
    const role = String(formData.get("role") ?? "")
    if (!profilId || !ROLES.includes(role as (typeof ROLES)[number])) {
      return { ok: false, message: "Membre ou rôle manquant." }
    }

    // Se rétrograder soi-même laisserait le cabinet sans propriétaire :
    // plus personne ne pourrait inviter ni modifier l'identité.
    const { data: cible } = await supabase
      .from("profiles")
      .select("user_id, cicc_role")
      .eq("id", profilId)
      .maybeSingle()

    if (cible?.user_id === membre.userId && role !== "owner") {
      return {
        ok: false,
        message: "Vous ne pouvez pas vous retirer le rôle de propriétaire. Promouvez d'abord quelqu'un d'autre.",
      }
    }

    const { error } = await supabase.from("profiles").update({ cicc_role: role }).eq("id", profilId)
    if (error) return { ok: false, message: error.message }

    revalidatePath("/[locale]/settings", "page")
    return { ok: true, message: "Rôle mis à jour." }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

export async function retirerMembre(formData: FormData): Promise<ResultatMembre> {
  try {
    const membre = await exigerProprietaire()
    const supabase = await getSessionSupabase()

    const profilId = String(formData.get("profilId") ?? "")
    if (!profilId) return { ok: false, message: "Membre manquant." }

    const { data: cible } = await supabase
      .from("profiles")
      .select("user_id, email")
      .eq("id", profilId)
      .maybeSingle()

    if (cible?.user_id === membre.userId) {
      return { ok: false, message: "Vous ne pouvez pas vous retirer vous-même." }
    }

    // Le profil est supprimé, pas le compte : la personne perd l'accès au
    // cabinet sans que son identité disparaisse des journaux d'audit, qui
    // conservent son courriel et doivent rester intelligibles.
    const { error } = await supabase.from("profiles").delete().eq("id", profilId)
    if (error) return { ok: false, message: error.message }

    revalidatePath("/[locale]/settings", "page")
    return { ok: true, message: `${cible?.email ?? "Le membre"} n'a plus accès au cabinet.` }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

export async function revoquerInvitation(formData: FormData): Promise<ResultatMembre> {
  try {
    await exigerProprietaire()
    const supabase = await getSessionSupabase()

    const id = String(formData.get("invitationId") ?? "")
    if (!id) return { ok: false, message: "Invitation manquante." }

    const { error } = await supabase
      .from("invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id)
      .is("accepted_at", null)

    if (error) return { ok: false, message: error.message }

    revalidatePath("/[locale]/settings", "page")
    return { ok: true, message: "Invitation révoquée. Le lien ne fonctionne plus." }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}
