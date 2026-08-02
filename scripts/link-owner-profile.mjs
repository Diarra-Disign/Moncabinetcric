#!/usr/bin/env node
/**
 * Rattache un compte auth.users existant à un profil de cabinet.
 *
 *   node scripts/link-owner-profile.mjs                 # état des lieux seul
 *   node scripts/link-owner-profile.mjs --apply         # crée le rattachement
 *   node scripts/link-owner-profile.mjs --apply --email=… --role=owner
 *
 * create-owner.mjs crée compte ET profil d'un coup, mais il exige un mot de
 * passe : il ne peut donc rien faire pour un compte déjà créé. Ce script
 * comble ce cas précis — le compte existe, le profil manque — sans avoir
 * besoin du mot de passe.
 *
 * Sans --apply, il n'écrit rien : il montre ce qu'il ferait.
 */

import { readFile } from "node:fs/promises"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

const args = process.argv.slice(2)
const APPLY = args.includes("--apply")
const argValue = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : undefined
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

  const { data: userList, error: userErr } = await admin.auth.admin.listUsers()
  if (userErr) throw new Error(`Comptes illisibles : ${userErr.message}`)
  const users = userList?.users ?? []

  const { data: firms } = await admin.from("firms").select("id, name, owner_name")
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email, full_name, cicc_role, user_id, firm_id")

  console.log("\nCabinets :")
  for (const f of firms ?? []) console.log(`  ${f.id}  ${f.name}`)

  console.log("\nComptes :")
  for (const u of users) {
    const linked = (profiles ?? []).find((p) => p.user_id === u.id)
    console.log(`  ${u.email.padEnd(28)} ${linked ? `→ profil « ${linked.full_name} »` : "→ AUCUN PROFIL"}`)
  }

  if ((firms ?? []).length === 0) throw new Error("Aucun cabinet en base : impossible de rattacher.")
  if ((firms ?? []).length > 1 && !argValue("firm")) {
    throw new Error("Plusieurs cabinets : préciser --firm=<uuid>.")
  }
  const firm = argValue("firm")
    ? firms.find((f) => f.id === argValue("firm"))
    : firms[0]
  if (!firm) throw new Error("Cabinet introuvable.")

  const targetEmail = argValue("email")
  const orphans = users.filter((u) => !(profiles ?? []).some((p) => p.user_id === u.id))
  const target = targetEmail ? users.find((u) => u.email === targetEmail) : orphans[0]

  if (!target) {
    console.log("\nRien à faire : tous les comptes ont déjà un profil.")
    return
  }

  const role = argValue("role") ?? "owner"
  const fullName = argValue("name") ?? firm.owner_name ?? target.email.split("@")[0]

  console.log("\nRattachement prévu :")
  console.log(`  compte  ${target.email}  (${target.id})`)
  console.log(`  cabinet ${firm.name}  (${firm.id})`)
  console.log(`  nom     ${fullName}`)
  console.log(`  rôle    ${role}`)

  if (!APPLY) {
    console.log("\n(simulation — relancer avec --apply pour écrire)")
    return
  }

  // Un profil peut déjà exister pour ce courriel sans user_id : c'est le cas
  // laissé par un seed. On le rattache plutôt que d'en créer un doublon, la
  // contrainte unique (firm_id, email) l'interdirait de toute façon.
  const existing = (profiles ?? []).find(
    (p) => p.email === target.email && p.firm_id === firm.id
  )

  if (existing) {
    const { error } = await admin
      .from("profiles")
      .update({ user_id: target.id, cicc_role: role, full_name: fullName })
      .eq("id", existing.id)
    if (error) throw new Error(`Mise à jour du profil : ${error.message}`)
    console.log("\n✓ Profil existant rattaché au compte.")
  } else {
    const { error } = await admin.from("profiles").insert({
      firm_id: firm.id,
      user_id: target.id,
      email: target.email,
      full_name: fullName,
      cicc_role: role,
    })
    if (error) throw new Error(`Création du profil : ${error.message}`)
    console.log("\n✓ Profil créé et rattaché au compte.")
  }

  console.log("Vérifier :  node scripts/verify-auth.mjs")
}

main().catch((err) => {
  console.error("\nÉchec :", err.message)
  process.exit(1)
})
