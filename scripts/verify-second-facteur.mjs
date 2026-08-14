#!/usr/bin/env node
/**
 * Éprouve le second facteur, de l'enrôlement au contournement.
 *
 *   ./cric second-facteur
 *
 * ─── LE CONTRÔLE QUI JUSTIFIE CE SCRIPT ────────────────────────────────────
 *
 * Un second facteur qu'on peut sauter n'est pas un second facteur : c'est une
 * case cochée dans un audit. L'écran de connexion PROPOSE le défi ; rien ne
 * l'oblige. La session issue du mot de passe seul est parfaitement valide,
 * simplement de niveau `aal1`.
 *
 * L'essai qui compte est donc celui-ci : une session aal1 qui va DIRECTEMENT
 * sur /fr/dashboard, sans passer par le champ du code. Si le tableau de bord
 * s'ouvre, tout le reste est décoratif.
 *
 * ─── POURQUOI UN TOTP ÉCRIT À LA MAIN ──────────────────────────────────────
 *
 * Aucune bibliothèque TOTP n'est installée, et en ajouter une pour un script
 * d'épreuve alourdirait les dépendances de l'application. RFC 6238 tient en
 * quinze lignes avec `node:crypto`.
 */
import { readFileSync, readdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createHmac } from "node:crypto"
import { createClient } from "@supabase/supabase-js"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const env = Object.fromEntries(
  [...readFileSync(join(ROOT, ".env.local"), "utf8").matchAll(/^([A-Z0-9_]+)=(.*)$/gm)]
    .map((m) => [m[1], m[2].trim()])
)

const magasin = join(ROOT, "node_modules/.pnpm")
const dossierPw = readdirSync(magasin).find((d) => /^playwright@/.test(d))
const { chromium } = await import(join(magasin, dossierPw, "node_modules/playwright/index.mjs"))

const arg = process.argv.find((a) => a.startsWith("--url="))
const BASE = (arg ? arg.slice(6) : "http://localhost:3000").replace(/\/+$/, "")

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } })

// ── TOTP, RFC 6238 ─────────────────────────────────────────────────────────
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
function base32(secret) {
  let bits = ""
  for (const c of secret.replace(/=+$/, "").toUpperCase()) {
    const v = ALPHABET.indexOf(c)
    if (v < 0) continue
    bits += v.toString(2).padStart(5, "0")
  }
  const octets = []
  for (let i = 0; i + 8 <= bits.length; i += 8) octets.push(parseInt(bits.slice(i, i + 8), 2))
  return Buffer.from(octets)
}
function totp(secret, quand = Date.now()) {
  const compteur = Buffer.alloc(8)
  compteur.writeBigInt64BE(BigInt(Math.floor(quand / 1000 / 30)))
  const h = createHmac("sha1", base32(secret)).update(compteur).digest()
  const d = h[h.length - 1] & 0x0f
  const n = ((h[d] & 0x7f) << 24) | (h[d + 1] << 16) | (h[d + 2] << 8) | h[d + 3]
  return String(n % 1_000_000).padStart(6, "0")
}

const marque = Date.now()
const mdp = `Epreuve2facteurs!${marque}`
const courriel = `2f-${marque}@example.invalid`
let cabinetId, userId, navigateur, echecs = 0

const v = (intitule, obtenu, attendu) => {
  const ok = String(obtenu) === String(attendu)
  if (!ok) echecs++
  console.log(`  ${ok ? "✓" : "✗"} ${intitule.padEnd(54)} ${String(obtenu).slice(0, 28)}` +
    (ok ? "" : `   ATTENDU ${attendu}`))
}
const ou = (p) => new URL(p.url()).pathname
const chemin = async (page, url) => {
  await page.goto(`${BASE}${url}`, { waitUntil: "domcontentloaded" })
  let prec = null
  for (let i = 0; i < 40; i++) {
    const a = ou(page)
    if (a === prec) return a
    prec = a
    await page.waitForTimeout(250)
  }
  return ou(page)
}
async function connecter(page) {
  await page.goto(`${BASE}/fr/connexion`, { waitUntil: "domcontentloaded" })
  await page.waitForSelector("#email", { timeout: 60000 })
  const bouton = page.locator('button[type="submit"]')
  for (let i = 0; i < 60; i++) {
    await page.fill("#email", courriel)
    await page.fill("#password", mdp)
    await page.waitForTimeout(400)
    if (!(await bouton.isDisabled())) { await bouton.click(); return }
    if (i > 0 && i % 12 === 0) {
      await page.reload({ waitUntil: "domcontentloaded" })
      await page.waitForSelector("#email", { timeout: 30000 })
    }
  }
  throw new Error("Le formulaire de connexion ne s'est jamais activé.")
}

try {
  const { data: cab } = await admin.from("firms").insert({
    name: `Cabinet 2F ${marque}`, rcic_license_number: `R333${String(marque).slice(-4)}`,
    owner_name: "Épreuve", email: `f-${marque}@example.invalid`, plan: "cabinet", status: "active",
  }).select("id").single()
  cabinetId = cab.id
  await admin.from("firm_subscriptions").insert({
    firm_id: cabinetId, plan: "cabinet", cadence: "monthly", seats: 3,
    status: "active", stripe_customer_id: `cus_2f_${marque}`,
  })
  const { data: u } = await admin.auth.admin.createUser({
    email: courriel, password: mdp, email_confirm: true,
  })
  userId = u.user.id
  await admin.from("profiles").insert({
    firm_id: cabinetId, user_id: userId, email: courriel,
    full_name: "Membre 2F", cicc_role: "owner",
  })

  navigateur = await chromium.launch()
  const ctx = await navigateur.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await ctx.newPage()

  // ── 1. ENRÔLEMENT ───────────────────────────────────────────────────────
  console.log("\nEnrôlement du second facteur")
  await connecter(page)
  await page.waitForURL(/\/fr\/dashboard/, { timeout: 60000 }).catch(() => {})
  await chemin(page, "/fr/settings")
  const activer = page.getByRole("button", { name: /Activer le second facteur/i })
  await activer.waitFor({ state: "visible", timeout: 60000 })
  v("l'écran propose l'activation", await activer.isVisible(), true)
  await activer.click()

  const codeSecret = page.locator("code").first()
  await codeSecret.waitFor({ state: "visible", timeout: 60000 })
  const secret = (await codeSecret.textContent())?.trim() ?? ""
  v("un secret est proposé", secret.length > 10, true)
  v("le code à balayer est affiché", await page.locator('img[alt*="balayer"]').count(), 1)

  await page.fill("#mfa, input[inputmode='numeric']", totp(secret))
  await page.getByRole("button", { name: /^Confirmer$/ }).click()
  await page.waitForTimeout(3000)
  const actif = await page.getByText(/Actif depuis le/).count()
  v("le facteur est actif après vérification", actif, 1)

  // ── 2. LA TENTATIVE DE CONTOURNEMENT ────────────────────────────────────
  // Nouveau contexte, donc nouvelle session : on se connecte au mot de passe
  // et on IGNORE le champ du code, en allant droit au tableau de bord.
  console.log("\nLe contournement — l'essai qui compte")
  const ctx2 = await navigateur.newContext({ viewport: { width: 1440, height: 1000 } })
  const p2 = await ctx2.newPage()
  await connecter(p2)
  await p2.waitForTimeout(2500)
  v("le code est demandé après le mot de passe",
    await p2.locator("#mfa").count(), 1)

  const arrivee = await chemin(p2, "/fr/dashboard")
  v("aller DIRECTEMENT au tableau de bord est refusé", arrivee, "/fr/connexion")
  v("et l'écran sait pourquoi", new URL(p2.url()).searchParams.get("probleme"), "facteur")

  const arriveeAdmin = await chemin(p2, "/fr/settings")
  v("les réglages aussi sont refusés", arriveeAdmin, "/fr/connexion")

  // ── 3. LE CODE OUVRE ────────────────────────────────────────────────────
  console.log("\nLe code juste ouvre, le code faux non")
  await p2.waitForSelector("#mfa", { timeout: 60000 })
  await p2.fill("#mfa", "000000")
  await p2.getByRole("button", { name: /Vérifier/i }).click()
  await p2.waitForTimeout(2500)
  v("un code faux est refusé", ou(p2), "/fr/connexion")

  await p2.waitForSelector("#mfa", { timeout: 30000 })
  await p2.fill("#mfa", totp(secret))
  await p2.getByRole("button", { name: /Vérifier/i }).click()
  await p2.waitForURL(/\/fr\/dashboard/, { timeout: 60000 }).catch(() => {})
  await p2.waitForTimeout(1500)
  v("le code juste ouvre le tableau de bord", ou(p2), "/fr/dashboard")

  await ctx.close()
  await ctx2.close()
} finally {
  if (navigateur) await navigateur.close()
  if (userId) await admin.auth.admin.deleteUser(userId)
  if (cabinetId) await admin.rpc("purger_cabinet_epreuve", { p_firm_id: cabinetId })
  console.log("\nCabinet et compte d'épreuve supprimés.")
}

console.log(echecs === 0
  ? "\n✓ Le second facteur s'enrôle, s'impose et ne se contourne pas, 0 échec."
  : `\n✗ ${echecs} échec(s).`)
process.exit(echecs === 0 ? 0 : 1)
