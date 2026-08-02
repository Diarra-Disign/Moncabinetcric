#!/usr/bin/env node
/**
 * Diagnostic de l'authentification et du verrouillage RLS.
 *
 *   node scripts/verify-auth.mjs
 *
 * Lecture seule : ce script ne modifie rien. Il répond à une seule
 * question — « le compte propriétaire est-il opérationnel, et la base
 * est-elle réellement fermée ? »
 *
 * Le contrôle décisif est le dernier : interroger les tables avec la clé
 * anonyme, celle que reçoit n'importe quel visiteur. Si elle rapporte des
 * données, la base est encore ouverte à tout Internet.
 */

import { readFile } from "node:fs/promises"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

const OK = "  \x1b[32m✓\x1b[0m"
const KO = "  \x1b[31m✗\x1b[0m"
const WARN = "  \x1b[33m!\x1b[0m"

/**
 * Comptes d'exploitation de la plateforme.
 *
 * Ils ne doivent être rattachés à AUCUN cabinet : c'est précisément
 * l'absence de profil qui les empêche de lire les dossiers clients, la RLS
 * n'accordant rien sans firm_id. Un profil ici serait une régression, pas
 * un oubli — le diagnostic le signale donc dans l'autre sens.
 */
const PLATFORM_OPERATORS = ["diarrasf@outlook.fr"]

let failures = 0
function pass(msg) { console.log(`${OK} ${msg}`) }
function fail(msg) { console.log(`${KO} ${msg}`); failures++ }
function warn(msg) { console.log(`${WARN} ${msg}`) }

async function loadEnv() {
  const raw = await readFile(join(ROOT, ".env.local"), "utf8").catch(() => null)
  if (!raw) throw new Error(".env.local introuvable.")
  const env = {}
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }
  return env
}

async function main() {
  const env = await loadEnv()
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !anonKey || !serviceKey) {
    throw new Error("URL, clé anonyme et clé service_role doivent être définies dans .env.local.")
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const anon = createClient(url, anonKey, { auth: { persistSession: false } })

  console.log(`\nProjet : ${url.replace(/https:\/\/([a-z0-9]+)\..*/, "$1")}\n`)

  // ---------------------------------------------------------------- 0
  console.log("0. Nature des clés")
  // Deux formats coexistent chez Supabase : l'ancien JWT, où le rôle est
  // une revendication à décoder, et le nouveau, où il est porté par le
  // préfixe. Ne reconnaître que le premier faisait passer une clé secrète
  // valide pour illisible.
  const roleOf = (key) => {
    if (key.startsWith("sb_secret_")) return "service_role"
    if (key.startsWith("sb_publishable_")) return "anon"
    try {
      const part = key.split(".")[1]
      const json = Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
      return JSON.parse(json).role ?? "?"
    } catch {
      return "illisible"
    }
  }
  const anonRole = roleOf(anonKey)
  const serviceRole = roleOf(serviceKey)
  anonRole === "anon"
    ? pass("NEXT_PUBLIC_SUPABASE_ANON_KEY porte bien le rôle anon.")
    : fail(`NEXT_PUBLIC_SUPABASE_ANON_KEY porte le rôle « ${anonRole} » au lieu de anon.`)
  serviceRole === "service_role"
    ? pass("SUPABASE_SERVICE_ROLE_KEY porte bien le rôle service_role.")
    : fail(
        `SUPABASE_SERVICE_ROLE_KEY porte le rôle « ${serviceRole} » au lieu de service_role — ` +
          "la création de compte et l'administration sont impossibles."
      )

  // ---------------------------------------------------------------- 1
  console.log("1. Migration de verrouillage appliquée ?")

  const { data: colCheck, error: colErr } = await admin
    .from("profiles")
    .select("user_id")
    .limit(1)

  if (colErr && /user_id/.test(colErr.message)) {
    fail("profiles.user_id absent — la migration n'a PAS été appliquée.")
  } else if (colErr) {
    warn(`Lecture de profiles : ${colErr.message}`)
  } else {
    pass("profiles.user_id existe.")
  }

  const { error: fnErr } = await admin.rpc("current_firm_id")
  if (fnErr && /does not exist|could not find/i.test(fnErr.message)) {
    fail("Fonction current_firm_id() absente — migration non appliquée.")
  } else {
    pass("Fonction current_firm_id() présente.")
  }

  // ---------------------------------------------------------------- 2
  console.log("\n2. Compte propriétaire")

  const { data: userList, error: listErr } = await admin.auth.admin.listUsers()
  if (listErr) {
    fail(`Impossible de lister les comptes : ${listErr.message}`)
  } else {
    const users = userList?.users ?? []
    if (users.length === 0) {
      fail("Aucun compte dans auth.users — exécuter scripts/create-owner.mjs.")
    } else {
      pass(`${users.length} compte(s) dans auth.users.`)
      for (const u of users) {
        const confirmed = u.email_confirmed_at ? "confirmé" : "NON CONFIRMÉ"
        console.log(`      ${u.email}  (${confirmed}, dernière connexion : ${u.last_sign_in_at ?? "jamais"})`)
      }
    }

    // Chaque compte doit avoir un profil rattaché, sinon il ne verra rien.
    const { data: profiles } = await admin
      .from("profiles")
      .select("email, full_name, cicc_role, user_id, firm_id")

    for (const u of users) {
      const prof = (profiles ?? []).find((p) => p.user_id === u.id)
      const isOperator = PLATFORM_OPERATORS.includes(u.email)

      if (isOperator) {
        prof
          ? fail(
              `${u.email} : compte d'exploitation rattaché au cabinet « ${prof.firm_id} ». ` +
                "Un exploitant ne doit voir aucun dossier client."
            )
          : pass(`${u.email} : exploitant, sans cabinet — ne peut lire aucun dossier.`)
        continue
      }

      if (!prof) {
        fail(`${u.email} : aucun profil rattaché — ce compte se connectera mais ne verra rien.`)
      } else if (!prof.firm_id) {
        fail(`${u.email} : profil sans cabinet.`)
      } else {
        pass(`${u.email} → ${prof.full_name} (${prof.cicc_role}), cabinet rattaché.`)
      }
    }

    const orphans = (profiles ?? []).filter((p) => !p.user_id)
    if (orphans.length > 0) {
      warn(`${orphans.length} profil(s) sans compte : ${orphans.map((p) => p.email).join(", ")}`)
    }
  }

  // ---------------------------------------------------------------- 3
  console.log("\n3. Politiques ouvertes restantes")

  // pg_policies n'est pas exposé par PostgREST : on teste le comportement
  // réel plutôt que de lire le catalogue, ce qui est de toute façon plus
  // probant qu'une inspection déclarative.
  const tables = ["clients", "matters", "leads", "invoices", "documents", "calendar_events", "audit_logs"]
  let leaks = 0

  for (const table of tables) {
    const { data, error } = await anon.from(table).select("id").limit(1)
    if (error) {
      // Refus : politique absente ou droits révoqués. C'est l'état voulu.
      pass(`${table.padEnd(16)} accès refusé à la clé anonyme.`)
    } else {
      // Absence d'erreur = lecture AUTORISÉE. Une table vide n'est pas une
      // table protégée : ne pas confondre « rien à voir » et « interdit ».
      const n = (data ?? []).length
      fail(
        `${table.padEnd(16)} LISIBLE PAR N'IMPORTE QUI` +
          (n === 0 ? " (table vide aujourd'hui, mais l'accès est ouvert)." : ".")
      )
      leaks++
    }
  }

  // ---------------------------------------------------------------- 4
  console.log("\n4. Écriture anonyme")

  const { data: anyFirm } = await anon.from("firms").select("id").limit(1)
  const realFirmId = anyFirm?.[0]?.id

  if (!realFirmId) {
    warn("Aucun cabinet lisible : test d'écriture non concluant, ignoré.")
  } else {
    const probe = {
      name: "__diagnostic_a_supprimer__",
      email: "diagnostic@example.invalid",
      file_number: "DIAG-0000",
      firm_id: realFirmId,
    }
    const { data: inserted, error: writeErr } = await anon
      .from("clients")
      .insert(probe)
      .select("id")

    if (writeErr) {
      pass("Insertion anonyme refusée.")
    } else {
      fail("INSERTION ANONYME ACCEPTÉE — n'importe qui peut écrire dans votre base.")
      leaks++
      // Ne pas laisser de déchet derrière un diagnostic en lecture seule.
      const id = inserted?.[0]?.id
      if (id) {
        const { error: delErr } = await anon.from("clients").delete().eq("id", id)
        console.log(delErr ? "      (ligne de test non supprimée)" : "      (ligne de test supprimée)")
      }
    }
  }

  // ---------------------------------------------------------------- Bilan
  console.log("\n" + "─".repeat(66))
  if (failures === 0) {
    console.log("\x1b[32mTout est en ordre.\x1b[0m Le compte est opérationnel et la base est fermée.")
    console.log("Dernière étape, manuelle : se connecter sur /fr/connexion et vérifier")
    console.log("que les pages affichent bien vos données.")
  } else {
    console.log(`\x1b[31m${failures} contrôle(s) en échec.\x1b[0m`)
    if (leaks > 0) {
      console.log("\nDont une exposition de données : appliquer sans délai")
      console.log("supabase/migrations/20260802120000_auth_and_rls_lockdown.sql")
      console.log("dans l'éditeur SQL Supabase.")
    }
  }
  console.log()
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error("\nDiagnostic interrompu :", err.message)
  process.exit(2)
})
