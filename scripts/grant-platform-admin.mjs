#!/usr/bin/env node
/**
 * Accorde ou retire les pouvoirs d'administration de la plateforme.
 *
 *   node scripts/grant-platform-admin.mjs                        # état des lieux
 *   node scripts/grant-platform-admin.mjs --grant=<courriel>
 *   node scripts/grant-platform-admin.mjs --revoke=<courriel>
 *
 * Volontairement hors de l'application : on ne se promeut pas administrateur
 * depuis une interface web. La table platform_admins n'a aucune politique
 * d'écriture ; seule la clé de service peut y toucher.
 *
 * Un administrateur de plateforme gère les cabinets et les accès. Il ne
 * voit AUCUN dossier client : aucune politique ne lui ouvre clients,
 * matters, documents, invoices, calendar_events ni audit_logs. Ce script
 * le vérifie après chaque changement.
 */

import { readFile } from "node:fs/promises"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const args = process.argv.slice(2)
const valueOf = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3).trim() : undefined
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

  const grant = valueOf("grant")
  const revoke = valueOf("revoke")

  if (grant) {
    const { data: list } = await admin.auth.admin.listUsers()
    const user = (list?.users ?? []).find((u) => u.email === grant)
    if (!user) throw new Error(`Aucun compte pour ${grant}.`)

    // Un administrateur ne doit être membre d'aucun cabinet : c'est
    // l'absence de profil qui lui interdit l'accès aux dossiers.
    const { data: prof } = await admin
      .from("profiles")
      .select("id, firm_id")
      .eq("user_id", user.id)
      .maybeSingle()

    if (prof) {
      throw new Error(
        `${grant} est membre d'un cabinet. Un administrateur de plateforme ne doit ` +
          "l'être d'aucun, sinon il accède aux dossiers de ce cabinet. Détacher le " +
          "profil d'abord."
      )
    }

    const { error } = await admin
      .from("platform_admins")
      .upsert({ user_id: user.id, email: grant }, { onConflict: "user_id" })
    if (error) throw new Error(`Ajout : ${error.message}`)
    console.log(`✓ ${grant} est administrateur de la plateforme.`)
  }

  if (revoke) {
    const { data: list } = await admin.auth.admin.listUsers()
    const user = (list?.users ?? []).find((u) => u.email === revoke)
    if (!user) throw new Error(`Aucun compte pour ${revoke}.`)
    const { error } = await admin.from("platform_admins").delete().eq("user_id", user.id)
    if (error) throw new Error(`Retrait : ${error.message}`)
    console.log(`✓ ${revoke} n'est plus administrateur.`)
  }

  const { data: admins } = await admin.from("platform_admins").select("email, created_at")
  console.log("\nAdministrateurs de la plateforme :")
  if (!admins || admins.length === 0) console.log("  (aucun)")
  for (const a of admins ?? []) console.log(`  ${a.email}`)

  console.log("\nRappel : un administrateur gère les cabinets, jamais leurs dossiers.")
}

main().catch((err) => {
  console.error("\nÉchec :", err.message)
  process.exit(1)
})
