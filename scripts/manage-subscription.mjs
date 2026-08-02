#!/usr/bin/env node
/**
 * Gère les plans et l'accès des cabinets.
 *
 *   node scripts/manage-subscription.mjs
 *   node scripts/manage-subscription.mjs --firm=<permis|nom> --plan=courtoisie
 *   node scripts/manage-subscription.mjs --firm=<permis|nom> --suspend
 *   node scripts/manage-subscription.mjs --firm=<permis|nom> --activate
 *   node scripts/manage-subscription.mjs --firm=<permis|nom> --plan=trial --days=30
 *
 * Plans : trial (essai daté), solo et cabinet (payants), courtoisie (accès
 * gratuit accordé à un testeur — sans échéance, mais révocable et tracé).
 *
 * Suspendre ferme l'accès immédiatement : current_firm_id() renvoie NULL et
 * toutes les politiques refusent. Aucun déploiement, aucun redémarrage.
 */

import { readFile } from "node:fs/promises"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const args = process.argv.slice(2)
const valueOf = (n) => {
  const hit = args.find((a) => a.startsWith(`--${n}=`))
  return hit ? hit.slice(n.length + 3).trim() : undefined
}
const has = (n) => args.includes(`--${n}`)

const PLANS = ["trial", "solo", "cabinet", "courtoisie"]

async function loadEnv() {
  const raw = await readFile(join(ROOT, ".env.local"), "utf8")
  const env = {}
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }
  return env
}

function accessOpen(f) {
  if (f.status !== "active") return false
  if (f.plan === "trial" && f.trial_ends_at && f.trial_ends_at < new Date().toISOString().slice(0, 10)) {
    return false
  }
  return true
}

async function main() {
  const env = await loadEnv()
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const target = valueOf("firm")
  const plan = valueOf("plan")
  const days = valueOf("days")

  if (plan && !PLANS.includes(plan)) {
    throw new Error(`Plan « ${plan} » inconnu. Attendu : ${PLANS.join(", ")}.`)
  }

  if (target) {
    const { data: firms } = await admin.from("firms").select("id, name, rcic_license_number")
    const firm = (firms ?? []).find(
      (f) => f.rcic_license_number === target || f.name === target || f.name.includes(target)
    )
    if (!firm) throw new Error(`Aucun cabinet correspondant à « ${target} ».`)

    const patch = { updated_at: new Date().toISOString() }

    if (plan) {
      patch.plan = plan
      // Un essai sans échéance n'est pas un essai : il devient un accès
      // gratuit permanent que personne ne pense à révoquer.
      if (plan === "trial") {
        const n = Number.parseInt(days ?? "30", 10)
        if (!Number.isFinite(n) || n <= 0) throw new Error("--days doit être un nombre de jours positif.")
        patch.trial_ends_at = new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)
      } else {
        patch.trial_ends_at = null
      }
    }

    if (has("suspend")) {
      patch.status = "suspended"
      patch.suspended_at = new Date().toISOString()
    }
    if (has("activate")) {
      patch.status = "active"
      patch.suspended_at = null
    }

    if (Object.keys(patch).length === 1) {
      throw new Error("Rien à modifier : préciser --plan, --suspend ou --activate.")
    }

    const { error } = await admin.from("firms").update(patch).eq("id", firm.id)
    if (error) throw new Error(`Mise à jour : ${error.message}`)
    console.log(`✓ ${firm.name} mis à jour.`)
  }

  const { data: firms } = await admin
    .from("firms")
    .select("name, rcic_license_number, plan, status, trial_ends_at")
    .order("created_at")

  console.log("\nCabinets :\n")
  for (const f of firms ?? []) {
    const open = accessOpen(f)
    const echeance = f.trial_ends_at ? `  échéance ${f.trial_ends_at}` : ""
    console.log(
      `  ${open ? "\x1b[32m●\x1b[0m" : "\x1b[31m○\x1b[0m"} ${f.name}`
    )
    console.log(
      `     ${f.rcic_license_number.padEnd(10)} plan ${f.plan.padEnd(11)} ${f.status.padEnd(10)}` +
        `${open ? "accès ouvert" : "ACCÈS FERMÉ"}${echeance}`
    )
  }
  console.log("\nUn accès fermé prend effet immédiatement : la base refuse, sans redéploiement.")
}

main().catch((err) => {
  console.error("\nÉchec :", err.message)
  process.exit(1)
})
