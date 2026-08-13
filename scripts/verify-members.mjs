#!/usr/bin/env node
/**
 * Éprouve les statuts de membre.
 *
 *   ./cric membres
 *
 * Ce script existe parce que la migration 20260808100000 touche
 * current_firm_id(), sur laquelle s'adossent une trentaine de politiques RLS,
 * le portail client et le connecteur. Une erreur à cet endroit ne casse pas un
 * écran : elle ferme l'application à tous les cabinets à la fois, ou pire,
 * l'ouvre. Aucune relecture de code ne le montre — il faut frapper à la porte
 * avec une vraie session.
 *
 * Chaque cas emploie donc la clé ANONYME et un jeton d'utilisateur, jamais la
 * clé de service : c'est la RLS qu'on interroge, pas le schéma.
 */

import { readFile } from "node:fs/promises"
import { randomBytes } from "node:crypto"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

async function loadEnv() {
  const raw = await readFile(join(ROOT, ".env.local"), "utf8")
  const env = {}
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }
  return env
}

let echecs = 0
function verifier(intitule, obtenu, attendu) {
  const ok = obtenu === attendu
  if (!ok) echecs++
  console.log(
    `  ${ok ? "✓" : "✗"} ${intitule.padEnd(50)} ${String(obtenu).padEnd(10)}` +
      (ok ? "" : `  ATTENDU ${attendu}`)
  )
}

async function main() {
  const env = await loadEnv()
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  /** Client porteur de la session d'un utilisateur : soumis à la RLS. */
  const commeUtilisateur = async (courriel, motDePasse) => {
    const c = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    })
    const { error } = await c.auth.signInWithPassword({ email: courriel, password: motDePasse })
    if (error) throw new Error(`Connexion ${courriel} : ${error.message}`)
    return c
  }

  const marque = Date.now()
  const motDePasse = "Epreuve-" + randomBytes(9).toString("base64url")
  const comptes = []
  let cabinetId

  try {
    // ---------------------------------------------------------------------
    // Décor : un cabinet en courtoisie (accès ouvert sans paiement), un
    // propriétaire et un adjoint.
    // ---------------------------------------------------------------------
    const { data: cabinet, error: e1 } = await admin
      .from("firms")
      .insert({
        name: `Cabinet d'épreuve membres ${marque}`,
        rcic_license_number: `R888${String(marque).slice(-4)}`,
        owner_name: "Épreuve",
        email: `proprio-${marque}@example.invalid`,
        plan: "courtoisie",
        status: "active",
      })
      .select("id")
      .single()
    if (e1) throw new Error(`Cabinet : ${e1.message}`)
    cabinetId = cabinet.id

    for (const [role, nom] of [["owner", "Propriétaire"], ["staff", "Adjoint"]]) {
      const courriel = `${role}-${marque}@example.invalid`
      const { data, error } = await admin.auth.admin.createUser({
        email: courriel,
        password: motDePasse,
        email_confirm: true,
      })
      if (error) throw new Error(`Compte ${role} : ${error.message}`)

      const { error: e2 } = await admin.from("profiles").insert({
        firm_id: cabinetId,
        user_id: data.user.id,
        email: courriel,
        full_name: `${nom} d'épreuve`,
        cicc_role: role,
      })
      if (e2) throw new Error(`Profil ${role} : ${e2.message}`)

      comptes.push({ role, courriel, userId: data.user.id })
    }

    const proprio = comptes.find((c) => c.role === "owner")
    const adjoint = comptes.find((c) => c.role === "staff")

    const sessionProprio = await commeUtilisateur(proprio.courriel, motDePasse)
    const sessionAdjoint = await commeUtilisateur(adjoint.courriel, motDePasse)

    /** Le cabinet vu par cette session : NULL quand l'accès est refusé. */
    const cabinetVu = async (c) => {
      const { data } = await c.rpc("current_firm_id")
      return data ?? "NULL"
    }
    const placesOccupees = async () => {
      const { data } = await admin.rpc("firm_seats_taken", { f_id: cabinetId })
      return data
    }

    // ---------------------------------------------------------------------
    console.log("\nÉtat initial — deux membres actifs")
    verifier("le propriétaire voit son cabinet", await cabinetVu(sessionProprio), cabinetId)
    verifier("l'adjoint voit son cabinet", await cabinetVu(sessionAdjoint), cabinetId)
    verifier("places occupées", await placesOccupees(), 2)

    // ---------------------------------------------------------------------
    console.log("\nL'adjoint est suspendu par le propriétaire")
    const { data: profilAdjoint } = await admin
      .from("profiles")
      .select("id")
      .eq("user_id", adjoint.userId)
      .single()

    const { error: eSusp } = await sessionProprio
      .from("profiles")
      .update({ status: "suspended", status_at: new Date().toISOString() })
      .eq("id", profilAdjoint.id)
    verifier("le propriétaire a le droit de suspendre", eSusp ? eSusp.message : "ok", "ok")

    verifier("l'adjoint ne voit plus rien", await cabinetVu(sessionAdjoint), "NULL")
    verifier("le propriétaire n'est pas affecté", await cabinetVu(sessionProprio), cabinetId)
    // Suspendre libère la place : on ne paie pas pour quelqu'un qui ne peut
    // pas entrer. C'est la contrepartie de la réversibilité.
    verifier("la place est libérée", await placesOccupees(), 1)

    // Le rattachement demeure : c'est toute la différence avec un DELETE, et
    // c'est ce qui garde les journaux d'audit intelligibles.
    const { count: encoreLa } = await admin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("id", profilAdjoint.id)
    verifier("le rattachement est conservé", encoreLa, 1)

    // ---------------------------------------------------------------------
    console.log("\nCe qu'un membre suspendu ne peut plus faire")
    const { data: clientsVus } = await sessionAdjoint.from("clients").select("id")
    verifier("lire les clients du cabinet", (clientsVus ?? []).length, 0)

    const { error: eEcriture } = await sessionAdjoint
      .from("clients")
      .insert({ firm_id: cabinetId, name: "Intrus", file_number: "X", program: "X" })
    verifier("créer un client", eEcriture ? "refusé" : "ACCEPTÉ", "refusé")

    // Le rôle suit le statut : sans cela, un propriétaire suspendu resterait
    // « owner » aux yeux de is_firm_owner().
    const { data: roleSuspendu } = await sessionAdjoint.rpc("current_cicc_role")
    verifier("conserver son rôle", roleSuspendu ?? "NULL", "NULL")

    // ---------------------------------------------------------------------
    console.log("\nRéactivation")
    await sessionProprio
      .from("profiles")
      .update({ status: "active" })
      .eq("id", profilAdjoint.id)
    verifier("l'adjoint retrouve son cabinet", await cabinetVu(sessionAdjoint), cabinetId)
    verifier("la place est reprise", await placesOccupees(), 2)

    // ---------------------------------------------------------------------
    console.log("\nCe qu'un adjoint ne peut pas faire, même actif")
    const { data: profilProprio } = await admin
      .from("profiles")
      .select("id")
      .eq("user_id", proprio.userId)
      .single()

    // Un adjoint qui pourrait suspendre le propriétaire prendrait le cabinet.
    await sessionAdjoint.from("profiles").update({ status: "suspended" }).eq("id", profilProprio.id)
    const { data: apresTentative } = await admin
      .from("profiles")
      .select("status")
      .eq("id", profilProprio.id)
      .single()
    verifier("suspendre le propriétaire", apresTentative.status, "active")

    // ---------------------------------------------------------------------
    console.log("\nUn propriétaire ne peut pas se fermer la porte à lui-même")
    // Sans ce refus, le cabinet se retrouve sans personne pour rouvrir quoi
    // que ce soit — l'impasse déjà rencontrée avec les cabinets sans
    // propriétaire.
    await sessionProprio.from("profiles").update({ status: "suspended" }).eq("id", profilProprio.id)
    const { data: proprioApres } = await admin
      .from("profiles")
      .select("status")
      .eq("id", profilProprio.id)
      .single()
    verifier("auto-suspension", proprioApres.status, "active")

    // ---------------------------------------------------------------------
    console.log("\nRévocation")
    await sessionProprio
      .from("profiles")
      .update({ status: "revoked" })
      .eq("id", profilAdjoint.id)
    verifier("l'adjoint révoqué ne voit rien", await cabinetVu(sessionAdjoint), "NULL")
    verifier("sa ligne existe toujours", encoreLa, 1)
  } finally {
    if (cabinetId) await admin.rpc("purger_cabinet_epreuve", { p_firm_id: cabinetId })
    for (const c of comptes) await admin.auth.admin.deleteUser(c.userId).catch(() => {})
    console.log("\nCabinet et comptes d'épreuve supprimés.")
  }

  console.log(echecs === 0 ? "\n✓ Statuts de membre vérifiés, 0 échec." : `\n✗ ${echecs} échec(s).`)
  process.exit(echecs === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error("Échec :", e.message)
  process.exit(1)
})
