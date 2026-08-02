#!/usr/bin/env node
/**
 * Purge les données de démonstration et inscrit l'identité réelle du cabinet.
 *
 *   node scripts/reset-firm.mjs                    # état des lieux, n'écrit rien
 *   node scripts/reset-firm.mjs --apply            # purge seule
 *   node scripts/reset-firm.mjs --apply --identity # purge + identité (voir ci-dessous)
 *
 * L'identité réelle est lue depuis firm-identity.json, à la racine du projet.
 * Ce fichier n'est pas versionné : il contient des coordonnées professionnelles
 * et surtout un numéro de permis CICC, qui ne doit jamais être inventé ni
 * hérité d'un jeu de démonstration.
 *
 * Modèle attendu :
 *   {
 *     "name": "…",  "rcicLicenseNumber": "R-000000",  "ownerName": "…",
 *     "address": "…", "phone": "…", "email": "…", "logoLetter": "M"
 *   }
 */

import { readFile } from "node:fs/promises"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const args = process.argv.slice(2)
const APPLY = args.includes("--apply")
const WITH_IDENTITY = args.includes("--identity")

/** Tables purgées, dans l'ordre : les enfants avant les parents. */
const DEMO_TABLES = [
  "audit_logs",
  "calendar_events",
  "documents",
  "invoices",
  "matters",
  "leads",
  "clients",
]

async function loadEnv() {
  const raw = await readFile(join(ROOT, ".env.local"), "utf8")
  const env = {}
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }
  return env
}

async function loadIdentity() {
  const path = join(ROOT, "firm-identity.json")
  let raw
  try {
    raw = await readFile(path, "utf8")
  } catch {
    throw new Error(
      "firm-identity.json introuvable. Copier firm-identity.example.json, " +
        "le renseigner avec les informations réelles du cabinet, puis relancer."
    )
  }
  const id = JSON.parse(raw)

  const required = ["name", "rcicLicenseNumber", "ownerName"]
  const missing = required.filter((k) => !id[k] || String(id[k]).trim() === "")
  if (missing.length) {
    throw new Error(`Champs obligatoires vides dans firm-identity.json : ${missing.join(", ")}`)
  }

  // Le format du permis est vérifié ici ET par une contrainte en base : une
  // erreur de saisie sur ce champ se propage à toutes les ententes.
  if (!/^[Rr]-?\d{6}$/.test(String(id.rcicLicenseNumber).trim())) {
    throw new Error(
      `Numéro de permis « ${id.rcicLicenseNumber} » non conforme. Format attendu : R-123456.`
    )
  }

  // Garde-fou : refuser explicitement les valeurs du jeu de démonstration.
  const demo = ["Boréale", "Boreale", "R-514982", "immigrations-boreale"]
  const serialized = JSON.stringify(id)
  const leftovers = demo.filter((d) => serialized.includes(d))
  if (leftovers.length) {
    throw new Error(
      `firm-identity.json contient encore des valeurs de démonstration : ${leftovers.join(", ")}`
    )
  }
  return id
}

async function main() {
  const env = await loadEnv()
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  console.log("\n--- Contenu actuel ---")
  const counts = {}
  for (const table of DEMO_TABLES) {
    const { count, error } = await admin.from(table).select("*", { count: "exact", head: true })
    counts[table] = error ? `erreur : ${error.message}` : count ?? 0
    console.log(`  ${table.padEnd(18)} ${counts[table]}`)
  }

  const { data: firms } = await admin.from("firms").select("id, name, rcic_license_number")
  console.log("\n--- Cabinets ---")
  for (const f of firms ?? []) {
    console.log(`  ${f.name}  (permis ${f.rcic_license_number ?? "non renseigné"})`)
  }

  let identity = null
  if (WITH_IDENTITY) {
    identity = await loadIdentity()
    console.log("\n--- Identité à inscrire ---")
    for (const [k, v] of Object.entries(identity)) console.log(`  ${k.padEnd(20)} ${v}`)
  }

  if (!APPLY) {
    console.log("\n(simulation — relancer avec --apply pour écrire)")
    return
  }

  console.log("\n--- Purge ---")
  for (const table of DEMO_TABLES) {
    // neq sur un uuid impossible : supprime tout en satisfaisant l'exigence
    // d'un filtre explicite côté PostgREST.
    const { error } = await admin
      .from(table)
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000")
    console.log(error ? `  ${table.padEnd(18)} ÉCHEC : ${error.message}` : `  ${table.padEnd(18)} vidée`)
  }

  if (identity) {
    const target = (firms ?? [])[0]
    if (!target) throw new Error("Aucun cabinet à mettre à jour.")
    const { error } = await admin
      .from("firms")
      .update({
        name: identity.name,
        rcic_license_number: identity.rcicLicenseNumber,
        owner_name: identity.ownerName,
        address: identity.address ?? null,
        phone: identity.phone ?? null,
        email: identity.email ?? null,
        logo_letter: identity.logoLetter ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", target.id)
    if (error) throw new Error(`Mise à jour du cabinet : ${error.message}`)
    console.log("\n✓ Identité du cabinet inscrite.")
  }

  console.log("\nVérifier :  node scripts/verify-auth.mjs")
}

main().catch((err) => {
  console.error("\nÉchec :", err.message)
  process.exit(1)
})
