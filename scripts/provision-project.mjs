#!/usr/bin/env node
/**
 * Remonte l'ensemble de la plateforme sur un projet Supabase neuf.
 *
 *   ./cric provisionner              # inventaire, n'écrit rien
 *   ./cric provisionner --apply
 *
 * Sert la bascule vers ca-central-1 : la région d'un projet Supabase ne
 * peut pas être changée après création, il faut donc en créer un autre et
 * y rejouer la lignée.
 *
 * Le script attend que .env.local pointe DÉJÀ vers le nouveau projet. Il
 * refuse de s'exécuter si la base contient des données métier, pour ne
 * jamais écraser un projet en service par mégarde.
 *
 * Ce qu'il fait, dans l'ordre :
 *   1. rejoue les migrations de supabase/migrations/ (jamais _archive/)
 *   2. crée le cabinet exploitant depuis firm-identity.json
 *   3. crée le cabinet de démonstration
 *   4. recrée les comptes et leurs profils
 *   5. rétablit l'administrateur de plateforme
 *
 * Les mots de passe ne sont pas repris : les comptes sont recréés avec
 * courriel confirmé, et la première connexion se fait par lien magique ou
 * après ./cric motdepasse.
 */

import { readFile, readdir } from "node:fs/promises"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { homedir } from "node:os"
import { createClient } from "@supabase/supabase-js"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const APPLY = process.argv.includes("--apply")

const OPERATEUR = "diarrasf@outlook.fr"
const PRATIQUE = "infos@dgvimmigration.com"
const TEST = "groupeimmedia@gmail.com"

const CABINET_DEMO = {
  name: "Cabinet de démonstration",
  rcic_license_number: "R000000",
  owner_name: "Compte de test",
  email: TEST,
  logo_letter: "D",
  plan: "courtoisie",
  status: "active",
}

async function lireEnv() {
  const raw = await readFile(join(ROOT, ".env.local"), "utf8")
  const env = {}
  for (const l of raw.split("\n")) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }
  return env
}

async function jetonGestion() {
  const p = join(homedir(), ".gemini/config/mcp_config.json")
  const cfg = JSON.parse(await readFile(p, "utf8"))
  const sb = (cfg.mcpServers ?? cfg.servers ?? {}).supabase
  const token = sb?.headers?.Authorization?.replace(/^Bearer\s+/i, "")
  if (!token) throw new Error("Jeton d'API de gestion introuvable dans mcp_config.json.")
  return token
}

async function executerSql(ref, token, sql, nom) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  })
  const corps = await r.text()
  if (!r.ok) throw new Error(`${nom} → HTTP ${r.status} ${corps.slice(0, 300)}`)
  // Postgres renvoie 201 même sur erreur logique : on lit le corps.
  try {
    const j = JSON.parse(corps)
    if (j && !Array.isArray(j) && (j.error || j.message)) {
      throw new Error(`${nom} → ${j.error ?? j.message}`)
    }
  } catch (e) {
    if (e.message.startsWith(nom)) throw e
  }
}

async function main() {
  const env = await lireEnv()
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const ref = url?.match(/https:\/\/([a-z0-9]+)\./)?.[1]
  if (!ref) throw new Error("NEXT_PUBLIC_SUPABASE_URL absente ou illisible dans .env.local.")

  const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })
  const token = await jetonGestion()

  // Région réelle du projet visé : c'est tout l'objet de l'opération.
  const infos = await (
    await fetch(`https://api.supabase.com/v1/projects/${ref}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).json()

  console.log(`\nProjet visé : ${infos.name ?? ref}`)
  console.log(`Région      : ${infos.region ?? "inconnue"}`)
  if (infos.region && !String(infos.region).startsWith("ca-")) {
    console.log("  ⚠ Ce projet n'est PAS dans une région canadienne.")
  }

  const fichiers = (await readdir(join(ROOT, "supabase/migrations")))
    .filter((f) => f.endsWith(".sql"))
    .sort()

  console.log(`\nMigrations à rejouer : ${fichiers.length}`)
  for (const f of fichiers) console.log(`   ${f}`)

  // Garde-fou : ne jamais écraser un projet déjà provisionné.
  //
  // Surveiller les seules tables métier ne suffisait pas : après une purge,
  // elles sont vides alors que les cabinets et les comptes subsistent. Un
  // --apply aurait alors créé des cabinets en double.
  const occupees = []
  for (const t of [
    "firms", "profiles", "platform_admins",
    "clients", "matters", "documents", "invoices", "leads",
  ]) {
    const { count, error } = await admin.from(t).select("*", { count: "exact", head: true })
    if (error) continue // table absente : projet neuf, c'est attendu
    if ((count ?? 0) > 0) occupees.push(`${t} (${count})`)
  }
  if (occupees.length > 0) {
    throw new Error(
      "Ce projet est déjà provisionné : " + occupees.join(", ") + ".\n" +
        "Le provisionnement est refusé pour ne pas créer de doublons. Viser un " +
        "projet neuf en changeant NEXT_PUBLIC_SUPABASE_URL dans .env.local."
    )
  }

  if (!APPLY) {
    console.log("\n(simulation — relancer avec --apply)")
    return
  }

  console.log("\n--- Migrations ---")
  for (const f of fichiers) {
    const sql = await readFile(join(ROOT, "supabase/migrations", f), "utf8")
    await executerSql(ref, token, sql, f)
    console.log(`  ✓ ${f}`)
  }

  console.log("\n--- Cabinets ---")
  const identite = JSON.parse(await readFile(join(ROOT, "firm-identity.json"), "utf8"))
  const { data: exploitant, error: e1 } = await admin
    .from("firms")
    .insert({
      name: identite.name,
      rcic_license_number: identite.rcicLicenseNumber,
      owner_name: identite.ownerName,
      address: identite.address,
      phone: identite.phone,
      email: identite.email,
      website: identite.website,
      logo_letter: identite.logoLetter,
      plan: "cabinet",
      status: "active",
      is_platform_operator: true,
    })
    .select("id, name")
    .single()
  if (e1) throw new Error(`Cabinet exploitant : ${e1.message}`)
  console.log(`  ✓ ${exploitant.name}`)

  const { data: demo, error: e2 } = await admin
    .from("firms")
    .insert(CABINET_DEMO)
    .select("id, name")
    .single()
  if (e2) throw new Error(`Cabinet de démonstration : ${e2.message}`)
  console.log(`  ✓ ${demo.name}`)

  console.log("\n--- Comptes ---")
  const plan = [
    { email: PRATIQUE, firm: exploitant.id, role: "owner", nom: identite.ownerName },
    { email: TEST, firm: demo.id, role: "rcic", nom: "Compte de test" },
  ]
  for (const p of plan) {
    const { data, error } = await admin.auth.admin.createUser({
      email: p.email,
      email_confirm: true,
    })
    if (error) throw new Error(`${p.email} : ${error.message}`)
    const { error: ep } = await admin.from("profiles").insert({
      firm_id: p.firm,
      user_id: data.user.id,
      email: p.email,
      full_name: p.nom,
      cicc_role: p.role,
    })
    if (ep) throw new Error(`Profil ${p.email} : ${ep.message}`)
    console.log(`  ✓ ${p.email} (${p.role})`)
  }

  const { data: op, error: eo } = await admin.auth.admin.createUser({
    email: OPERATEUR,
    email_confirm: true,
  })
  if (eo) throw new Error(`${OPERATEUR} : ${eo.message}`)
  // L'exploitant n'est membre d'aucun cabinet : c'est ce qui lui interdit
  // l'accès aux dossiers clients.
  const { error: ea } = await admin.from("platform_admins").insert({
    user_id: op.user.id,
    email: OPERATEUR,
    full_name: identite.ownerName,
  })
  if (ea) throw new Error(`Administrateur : ${ea.message}`)
  console.log(`  ✓ ${OPERATEUR} (exploitant, sans cabinet)`)

  console.log("\nTerminé. Étapes suivantes :")
  console.log("  ./cric verifier          # doit afficher 0 échec")
  console.log("  ./cric roles             # la matrice doit être respectée")
  console.log("  ./cric motdepasse --email=infos@dgvimmigration.com")
}

main().catch((err) => {
  console.error("\nÉchec :", err.message)
  process.exit(1)
})
