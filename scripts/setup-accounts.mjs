#!/usr/bin/env node
/**
 * Met en place les cabinets et les comptes de l'étape 1.
 *
 *   node scripts/setup-accounts.mjs           # simulation, n'écrit rien
 *   node scripts/setup-accounts.mjs --apply   # applique
 *
 * Sépare trois identités qui étaient confondues :
 *
 *   exploitant  — administre la plateforme, ne voit aucun dossier client
 *   pratique    — votre cabinet réel, rôle owner
 *   test        — cabinet de démonstration, pour éprouver le produit
 *                 depuis la position d'un utilisateur externe
 *
 * Aucun mot de passe n'est manipulé : les comptes sont créés avec courriel
 * confirmé, et la première connexion se fait par lien magique. Un mot de
 * passe tapé dans un terminal finit dans l'historique de défilement.
 */

import { readFile } from "node:fs/promises"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const APPLY = process.argv.includes("--apply")

const OPERATOR_EMAIL = "diarrasf@outlook.fr"
const PRACTICE_EMAIL = "infos@dgvimmigration.com"
const TEST_EMAIL = "groupeimmedia@gmail.com"

const DEMO_FIRM = {
  name: "Cabinet de démonstration",
  rcic_license_number: "R000000",
  owner_name: "Compte de test",
  address: "Adresse de démonstration",
  phone: "000 000-0000",
  email: TEST_EMAIL,
  logo_letter: "D",
}

async function loadEnv() {
  const raw = await readFile(join(ROOT, ".env.local"), "utf8")
  const env = {}
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }
  return env
}

async function main() {
  const env = await loadEnv()
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const { data: firms } = await admin.from("firms").select("id, name, rcic_license_number")
  const practiceFirm = (firms ?? []).find((f) => f.rcic_license_number === "R1041776")
  if (!practiceFirm) throw new Error("Cabinet de pratique introuvable (permis R1041776).")

  let demoFirm = (firms ?? []).find((f) => f.name === DEMO_FIRM.name)

  const { data: userList } = await admin.auth.admin.listUsers()
  const users = userList?.users ?? []
  const { data: profiles } = await admin.from("profiles").select("id, email, user_id, firm_id, cicc_role")

  const plan = [
    { email: PRACTICE_EMAIL, role: "owner", firm: practiceFirm.name, kind: "pratique" },
    { email: TEST_EMAIL, role: "rcic", firm: DEMO_FIRM.name, kind: "test" },
  ]

  console.log("\n--- État actuel ---")
  console.log(`  Cabinet de pratique : ${practiceFirm.name}`)
  console.log(`  Cabinet de démo     : ${demoFirm ? demoFirm.name : "à créer"}`)
  for (const u of users) {
    const p = (profiles ?? []).find((x) => x.user_id === u.id)
    console.log(`  ${u.email.padEnd(30)} ${p ? `profil ${p.cicc_role}` : "aucun profil"}`)
  }

  console.log("\n--- Cible ---")
  for (const item of plan) {
    const exists = users.some((u) => u.email === item.email)
    console.log(`  ${item.email.padEnd(30)} ${item.role.padEnd(6)} → ${item.firm}${exists ? "  (compte déjà présent)" : ""}`)
  }
  console.log(`  ${OPERATOR_EMAIL.padEnd(30)} exploitant → aucun cabinet`)

  if (!APPLY) {
    console.log("\n(simulation — relancer avec --apply pour écrire)")
    return
  }

  // ---------------------------------------------------------------- démo
  if (!demoFirm) {
    const { data, error } = await admin.from("firms").insert(DEMO_FIRM).select("id, name").single()
    if (error) throw new Error(`Création du cabinet de démonstration : ${error.message}`)
    demoFirm = data
    console.log(`\n✓ Cabinet de démonstration créé.`)
  }

  const firmIdOf = (name) => (name === DEMO_FIRM.name ? demoFirm.id : practiceFirm.id)

  // ---------------------------------------------------------------- comptes
  for (const item of plan) {
    let user = users.find((u) => u.email === item.email)

    if (!user) {
      // Sans mot de passe : la première connexion se fera par lien magique.
      const { data, error } = await admin.auth.admin.createUser({
        email: item.email,
        email_confirm: true,
      })
      if (error) throw new Error(`Création de ${item.email} : ${error.message}`)
      user = data.user
      console.log(`✓ Compte créé  : ${item.email}`)
    } else {
      console.log(`· Compte existant : ${item.email}`)
    }

    const firmId = firmIdOf(item.firm)
    const existing = (profiles ?? []).find(
      (p) => p.user_id === user.id || (p.email === item.email && p.firm_id === firmId)
    )

    if (existing) {
      const { error } = await admin
        .from("profiles")
        .update({ user_id: user.id, firm_id: firmId, cicc_role: item.role })
        .eq("id", existing.id)
      if (error) throw new Error(`Profil de ${item.email} : ${error.message}`)
      console.log(`  profil mis à jour (${item.role})`)
    } else {
      const { error } = await admin.from("profiles").insert({
        firm_id: firmId,
        user_id: user.id,
        email: item.email,
        full_name: item.kind === "pratique" ? "Adama Diarra" : "Compte de test",
        cicc_role: item.role,
      })
      if (error) throw new Error(`Profil de ${item.email} : ${error.message}`)
      console.log(`  profil créé (${item.role})`)
    }
  }

  // ------------------------------------------------------- exploitant
  // L'exploitant ne doit être membre d'aucun cabinet : c'est ce qui
  // l'empêche de lire les dossiers clients, la RLS ne lui accordant rien
  // sans profil.
  const operator = users.find((u) => u.email === OPERATOR_EMAIL)
  if (operator) {
    const opProfile = (profiles ?? []).find((p) => p.user_id === operator.id)
    if (opProfile) {
      const { error } = await admin.from("profiles").delete().eq("id", opProfile.id)
      if (error) throw new Error(`Détachement de l'exploitant : ${error.message}`)
      console.log(`\n✓ ${OPERATOR_EMAIL} détaché de tout cabinet.`)
    } else {
      console.log(`\n· ${OPERATOR_EMAIL} n'était rattaché à aucun cabinet.`)
    }
  }

  console.log("\nVérifier :  node scripts/verify-auth.mjs")
  console.log("Se connecter : http://localhost:3000/fr/connexion (onglet « Lien par courriel »)")
}

main().catch((err) => {
  console.error("\nÉchec :", err.message)
  process.exit(1)
})
