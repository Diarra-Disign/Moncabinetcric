#!/usr/bin/env node
/**
 * Crée, liste et révoque des invitations.
 *
 *   node scripts/invite.mjs
 *   node scripts/invite.mjs --email=… --firm=<permis|nom> --role=rcic [--days=7]
 *   node scripts/invite.mjs --revoke=<courriel> --firm=<permis|nom>
 *
 * Le lien produit n'est affiché qu'une seule fois : seule l'empreinte du
 * jeton est conservée en base. Perdu, il faut réinviter — c'est le prix
 * d'une base qui ne contient rien d'exploitable en cas de fuite.
 */

import { readFile } from "node:fs/promises"
import { randomBytes, createHash } from "node:crypto"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const args = process.argv.slice(2)
const valueOf = (n) => {
  const hit = args.find((a) => a.startsWith(`--${n}=`))
  return hit ? hit.slice(n.length + 3).trim() : undefined
}

const ROLES = ["owner", "rcic", "risia", "staff", "bookkeeper", "readonly"]
const BASE_URL = (process.env.APP_URL || "").trim() || "http://localhost:3000"

async function loadEnv() {
  const raw = await readFile(join(ROOT, ".env.local"), "utf8")
  const env = {}
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }
  return env
}

const hash = (t) => createHash("sha256").update(t).digest("hex")

async function findFirm(admin, target) {
  const { data: firms } = await admin.from("firms").select("id, name, rcic_license_number")
  const firm = (firms ?? []).find(
    (f) => f.rcic_license_number === target || f.name === target || f.name.includes(target)
  )
  if (!firm) throw new Error(`Aucun cabinet correspondant à « ${target} ».`)
  return firm
}

async function main() {
  const env = await loadEnv()
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const email = valueOf("email")
  const revoke = valueOf("revoke")
  const firmTarget = valueOf("firm")

  if (revoke) {
    if (!firmTarget) throw new Error("--firm est requis pour révoquer.")
    const firm = await findFirm(admin, firmTarget)
    const { error } = await admin
      .from("invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("firm_id", firm.id)
      .ilike("email", revoke)
      .is("accepted_at", null)
      .is("revoked_at", null)
    if (error) throw new Error(`Révocation : ${error.message}`)
    console.log(`✓ Invitation de ${revoke} révoquée.`)
  }

  if (email) {
    if (!firmTarget) throw new Error("--firm est requis pour inviter.")
    const firm = await findFirm(admin, firmTarget)
    const role = valueOf("role") ?? "staff"
    if (!ROLES.includes(role)) throw new Error(`Rôle « ${role} » inconnu. Attendu : ${ROLES.join(", ")}.`)

    // Un compte déjà rattaché n'a pas besoin d'invitation, et en créer une
    // laisserait croire qu'il faut la suivre.
    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .eq("firm_id", firm.id)
      .maybeSingle()
    if (existing) throw new Error(`${email} est déjà membre de ${firm.name}.`)

    const days = Number.parseInt(valueOf("days") ?? "7", 10)
    if (!Number.isFinite(days) || days <= 0) throw new Error("--days doit être un nombre positif.")

    // 32 octets : assez large pour qu'une recherche exhaustive soit hors
    // de portée, même si la table des empreintes venait à fuiter.
    const token = randomBytes(32).toString("base64url")

    // Une invitation en attente pour la même adresse bloque l'insertion
    // (index unique partiel) : on révoque l'ancienne plutôt que d'échouer.
    await admin
      .from("invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("firm_id", firm.id)
      .ilike("email", email)
      .is("accepted_at", null)
      .is("revoked_at", null)

    const { error } = await admin.from("invitations").insert({
      firm_id: firm.id,
      email,
      cicc_role: role,
      token_hash: hash(token),
      expires_at: new Date(Date.now() + days * 86400000).toISOString(),
    })
    if (error) throw new Error(`Création : ${error.message}`)

    const link = `${BASE_URL}/fr/bienvenue?jeton=${token}`
    console.log(`\n✓ Invitation créée pour ${email}`)
    console.log(`  cabinet : ${firm.name}`)
    console.log(`  rôle    : ${role}`)
    console.log(`  expire  : dans ${days} jour(s)`)
    console.log(`\n  ${link}\n`)
    console.log("  Ce lien n'est affiché qu'une fois. Transmettez-le à son destinataire.")
  }

  const { data: invites } = await admin
    .from("invitations")
    .select("email, cicc_role, expires_at, accepted_at, revoked_at, firms(name)")
    .order("created_at", { ascending: false })
    .limit(20)

  console.log("\nInvitations récentes :\n")
  if (!invites || invites.length === 0) console.log("  (aucune)")
  for (const i of invites ?? []) {
    const state = i.accepted_at
      ? "acceptée"
      : i.revoked_at
        ? "révoquée"
        : new Date(i.expires_at) < new Date()
          ? "expirée"
          : "en attente"
    console.log(
      `  ${i.email.padEnd(30)} ${i.cicc_role.padEnd(11)} ${state.padEnd(11)} ${i.firms?.name ?? ""}`
    )
  }
}

main().catch((err) => {
  console.error("\nÉchec :", err.message)
  process.exit(1)
})
