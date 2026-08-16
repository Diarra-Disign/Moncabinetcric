"use server"

import { createHash } from "node:crypto"
import { createClient } from "@supabase/supabase-js"
import { synchroniserSiegesStripe } from "@/lib/billing/seat-sync"
import { motDePasseValide } from "@/lib/securite/regle-mot-de-passe"

/**
 * Acceptation d'une invitation.
 *
 * Tout se passe côté serveur avec la clé de service : créer un compte et
 * le rattacher à un cabinet sont des opérations privilégiées, qui ne
 * doivent jamais dépendre de ce qu'un navigateur affirme.
 *
 * Le jeton reçu n'est comparé qu'à son empreinte. Le courriel n'est PAS
 * demandé au formulaire : il vient de l'invitation. Sans cela, un jeton
 * valide permettrait de créer un compte sous n'importe quelle adresse.
 */

export interface AcceptResult {
  ok: boolean
  /** Clé de message à traduire côté page ; jamais un texte en dur. */
  error?: "invalid" | "weak" | "exists" | "failed"
}

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Configuration Supabase incomplète.")
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function acceptInvitation(
  token: string,
  fullName: string,
  password: string
): Promise<AcceptResult> {
  if (!token) return { ok: false, error: "invalid" }

  // Même règle que le formulaire, parce que c'est LE MÊME CODE. Ce contrôle
  // n'est pas un doublon de courtoisie : le formulaire vit dans le navigateur
  // et se contourne, celui-ci non. Il épargne aussi un aller-retour vers
  // Supabase pour un refus qu'on peut prononcer ici — et surtout un message
  // d'erreur en anglais sur une interface française.
  if (!motDePasseValide(password)) return { ok: false, error: "weak" }

  const admin = serviceClient()
  const tokenHash = createHash("sha256").update(token).digest("hex")

  const { data: invite } = await admin
    .from("invitations")
    .select("id, firm_id, email, cicc_role, expires_at, accepted_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle()

  // Un seul message pour toutes les causes de refus : distinguer
  // « inconnu » de « expiré » renseignerait un attaquant sur la validité
  // des jetons qu'il essaie.
  if (
    !invite ||
    invite.accepted_at ||
    invite.revoked_at ||
    new Date(invite.expires_at as string) < new Date()
  ) {
    return { ok: false, error: "invalid" }
  }

  const email = invite.email as string

  // Le compte peut déjà exister — invité sur un second cabinet, ou créé
  // auparavant. On ne recrée rien, on rattache.
  const { data: list } = await admin.auth.admin.listUsers()
  let user = (list?.users ?? []).find((u) => u.email?.toLowerCase() === email.toLowerCase())

  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (error || !data.user) return { ok: false, error: "failed" }
    user = data.user
  } else {
    // Compte existant : on ne touche PAS à son mot de passe. Le contraire
    // ferait d'une invitation un moyen de réinitialiser le mot de passe de
    // quelqu'un d'autre.
    const { data: already } = await admin
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .eq("firm_id", invite.firm_id as string)
      .maybeSingle()
    if (already) return { ok: false, error: "exists" }
  }

  const { error: profileError } = await admin.from("profiles").insert({
    firm_id: invite.firm_id,
    user_id: user.id,
    email,
    full_name: fullName.trim() || email.split("@")[0],
    cicc_role: invite.cicc_role,
  })
  if (profileError) return { ok: false, error: "failed" }

  await admin
    .from("invitations")
    .update({ accepted_at: new Date().toISOString(), accepted_by: user.id })
    .eq("id", invite.id)

  // L'invitation cesse d'occuper une place et le profil en prend une : le
  // total ne bouge pas, mais la répartition par rôle peut changer. Le résultat
  // n'est pas remonté — l'acceptation d'une invitation ne doit pas parler de
  // facturation à la personne qui rejoint le cabinet.
  await synchroniserSiegesStripe(invite.firm_id as string)

  return { ok: true }
}
