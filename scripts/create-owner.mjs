#!/usr/bin/env node
/**
 * Création du compte propriétaire du cabinet.
 *
 *   node scripts/create-owner.mjs
 *
 * Il n'existe aucune inscription publique : le premier compte doit donc
 * être créé hors application. Ce script utilise la clé service_role, la
 * seule habilitée à créer un compte et à écrire dans profiles avant que
 * la moindre session existe.
 *
 * À exécuter APRÈS la migration 20260802120000_auth_and_rls_lockdown.sql,
 * qui ajoute profiles.user_id.
 *
 * Le mot de passe est saisi en mode masqué : il n'apparaît ni à l'écran,
 * ni dans l'historique du shell, ni dans la liste des processus.
 */

import { createInterface } from "node:readline/promises"
import { stdin, stdout } from "node:process"
import { readFile } from "node:fs/promises"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

/** Lit .env.local sans dépendance externe. */
async function loadEnv() {
  const raw = await readFile(join(ROOT, ".env.local"), "utf8").catch(() => null)
  if (!raw) throw new Error(".env.local introuvable à la racine du projet.")
  const env = {}
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }
  return env
}

async function askHidden(question) {
  const rl = createInterface({ input: stdin, output: stdout, terminal: true })
  stdout.write(question)
  // Masque la frappe en interceptant l'écho du terminal.
  const onData = (char) => {
    if (["\n", "\r", ""].includes(char.toString())) return
    stdout.write("[2K[200D" + question + "*".repeat(rl.line.length))
  }
  stdin.on("data", onData)
  const answer = await rl.question("")
  stdin.off("data", onData)
  rl.close()
  stdout.write("\n")
  return answer
}

async function main() {
  const env = await loadEnv()
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définies dans .env.local."
    )
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const rl = createInterface({ input: stdin, output: stdout })
  const email = (await rl.question("Adresse courriel du propriétaire : ")).trim()
  const fullName = (await rl.question("Nom complet : ")).trim()
  rl.close()

  const password = await askHidden("Mot de passe (saisie masquée, 12 caractères minimum) : ")

  if (!email || !fullName) throw new Error("Courriel et nom sont obligatoires.")
  if (password.length < 12) {
    throw new Error("Mot de passe trop court : 12 caractères minimum.")
  }

  // 1. Le cabinet doit exister.
  const { data: firms, error: firmErr } = await admin.from("firms").select("id, name").limit(1)
  if (firmErr) throw new Error(`Lecture des cabinets impossible : ${firmErr.message}`)
  if (!firms || firms.length === 0) {
    throw new Error("Aucun cabinet en base. Appliquer d'abord les migrations de schéma et de données.")
  }
  const firm = firms[0]
  console.log(`\nCabinet cible : ${firm.name}`)

  // 2. Création du compte, courriel confirmé d'office : c'est un compte
  //    d'administration créé de la main du propriétaire, pas une inscription.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  let userId = created?.user?.id

  if (createErr) {
    if (!/already been registered|already exists/i.test(createErr.message)) {
      throw new Error(`Création du compte impossible : ${createErr.message}`)
    }
    // Compte déjà présent : on le retrouve pour rattacher le profil.
    console.log("Compte déjà existant — rattachement du profil.")
    const { data: list } = await admin.auth.admin.listUsers()
    userId = list?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id
    if (!userId) throw new Error("Compte existant introuvable.")
  }

  // 3. Profil rattaché au cabinet, avec le rôle propriétaire.
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle()

  if (existing) {
    const { error } = await admin
      .from("profiles")
      .update({ user_id: userId, full_name: fullName, cicc_role: "owner", firm_id: firm.id })
      .eq("id", existing.id)
    if (error) throw new Error(`Mise à jour du profil impossible : ${error.message}`)
    console.log("Profil existant mis à jour et rattaché au compte.")
  } else {
    const { error } = await admin.from("profiles").insert({
      firm_id: firm.id,
      user_id: userId,
      full_name: fullName,
      email,
      cicc_role: "owner",
    })
    if (error) throw new Error(`Création du profil impossible : ${error.message}`)
    console.log("Profil créé.")
  }

  console.log(`\n✓ Compte propriétaire prêt : ${email}`)
  console.log("  Connectez-vous sur /fr/connexion")
}

main().catch((err) => {
  console.error("\nÉchec :", err.message)
  process.exit(1)
})
