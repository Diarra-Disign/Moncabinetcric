#!/usr/bin/env node
/**
 * Ouvrir un dossier depuis la fiche d'un client, dans un vrai navigateur.
 *
 * Ce que ce script cherche à prendre en défaut : le numéro engendré, le
 * rattachement au client, et surtout le fait que le dossier neuf arrive
 * GARNI — pièces exigées du programme comprises. Une création qui réussit
 * mais laisse un dossier vide passerait pour un succès, et le verrou de
 * complétude n'aurait alors plus rien à bloquer.
 */
import { readFileSync, readdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { randomBytes } from "node:crypto"
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
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

let echecs = 0
const verifier = (i, o, a) => {
  const ok = String(o) === String(a)
  if (!ok) echecs++
  console.log(`  ${ok ? "✓" : "✗"} ${i.padEnd(46)} ${String(o).slice(0, 40)}` + (ok ? "" : `   ATTENDU ${a}`))
}

const marque = Date.now()
const mdp = "Epreuve-" + randomBytes(9).toString("base64url")
let cabinetId, userId, navigateur

try {
  const { data: cab } = await admin.from("firms").insert({
    name: `Zenith Immigration ${marque}`, rcic_license_number: `R999${String(marque).slice(-4)}`,
    owner_name: "Épreuve", email: `z-${marque}@example.invalid`, plan: "cabinet", status: "active",
  }).select("id").single()
  cabinetId = cab.id
  await admin.from("firm_subscriptions").insert({
    firm_id: cabinetId, plan: "cabinet", cadence: "monthly", seats: 3,
    status: "active", stripe_customer_id: `cus_dc_${marque}`,
  })
  const courriel = `consultant-${marque}@example.invalid`
  const { data: u } = await admin.auth.admin.createUser({ email: courriel, password: mdp, email_confirm: true })
  userId = u.user.id
  await admin.from("profiles").insert({
    firm_id: cabinetId, user_id: userId, email: courriel, full_name: "Me Épreuve", cicc_role: "owner",
  })
  await admin.from("clients").insert({
    firm_id: cabinetId, name: "Awa Diallo", email: `awa-${marque}@example.invalid`,
    phone: "+1 514 555 0199", file_number: `CRIC-2026-0001`, program: "Permis d'études",
    citizenship: "Sénégal", residence: "Dakar", status: "active", client_type: "individual",
  })

  navigateur = await chromium.launch({ channel: "chrome" })
  const page = await (await navigateur.newContext({ viewport: { width: 1440, height: 1000 } })).newPage()
  await page.goto(`${BASE}/fr/connexion`, { waitUntil: "domcontentloaded" })
  await page.waitForSelector('input[type="email"]', { timeout: 30000 })
  await page.fill('input[type="email"]', courriel)
  await page.fill('input[type="password"]', mdp)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/fr(\/|$)/, { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(2500)

  console.log("\nDepuis la liste des clients")
  await page.goto(`${BASE}/fr/clients`, { waitUntil: "domcontentloaded" })
  await page.waitForSelector("h1", { timeout: 30000 })
  await page.waitForTimeout(1500)

  await page.click('button[title="Ouvrir un nouveau dossier pour ce client"]')
  await page.waitForTimeout(700)

  const entete = await page.evaluate(() =>
    [...document.querySelectorAll("h3")].some((h) => /Ouvrir un dossier/.test(h.textContent ?? "")))
  verifier("la fenêtre s'ouvre", entete, true)

  const repris = await page.evaluate(() => document.body.innerText)
  verifier("le profil est repris, pas ressaisi", /repris du profil client/i.test(repris), true)
  verifier("le courriel du client y figure", /awa-/.test(repris), true)
  verifier("sa nationalité aussi", /Sénégal/.test(repris), true)

  await page.selectOption('div[class*="max-w-xl"] select', { label: "Permis d'études" })
  await page.waitForTimeout(300)
  await page.click('button:has-text("Créer le dossier")')
  await page.waitForTimeout(6000)
  const messageEcran = await page.evaluate(() => document.body.innerText.slice(0, 1200))
  const err = messageEcran.match(/[^\n]*(erreur|introuvable|impossible|existe déjà|violates|null value)[^\n]*/i)
  if (err) console.log(`     message à l'écran : « ${err[0].trim().slice(0, 160)} »`)
  console.log("     URL après clic :", page.url())
  console.log("     texte de la fenêtre :", await page.evaluate(() => {
    const d = document.querySelector('div[class*="max-w-xl"]')
    return d ? d.innerText.replace(/\n+/g, " | ").slice(-320) : "FENÊTRE FERMÉE"
  }))
  console.log("     bouton désactivé :", await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => /Créer le dossier/.test(x.textContent ?? ""))
    return b ? b.disabled : "BOUTON ABSENT"
  }))

  console.log("\nCe que la base contient")
  const { data: dossiers } = await admin.from("matters")
    .select("id, reference, client_id, service_type, program, priority, status").eq("firm_id", cabinetId)
  verifier("un dossier est créé", (dossiers ?? []).length, 1)
  const d = (dossiers ?? [])[0]
  if (d) {
    verifier("le numéro suit le cabinet et l'année", /^ZEN-\d{4}-00001$/.test(d.reference) ? "oui" : d.reference, "oui")
    verifier("il est rattaché au client", Boolean(d.client_id), true)
    verifier("le type de service est retenu", d.service_type, "Permis d'études")
    verifier("le programme en est déduit", d.program, "Permis d'études")

    const { data: exigences } = await admin.from("matter_requirements").select("code").eq("matter_id", d.id)
    verifier("le dossier arrive GARNI de ses pièces", (exigences ?? []).length > 0, true)
    console.log(`     ${(exigences ?? []).length} pièces exigées posées automatiquement`)
  }

  console.log("\nUn second dossier pour le MÊME client")
  await page.goto(`${BASE}/fr/clients`, { waitUntil: "domcontentloaded" })
  await page.waitForSelector("h1", { timeout: 30000 })
  await page.waitForTimeout(1500)
  await page.click('button[title="Ouvrir un nouveau dossier pour ce client"]')
  await page.waitForSelector('div[class*="max-w-xl"] select', { timeout: 15000 })
  await page.selectOption('div[class*="max-w-xl"] select', { label: "Parrainage" })
  await page.waitForTimeout(400)
  await page.click('button:has-text("Créer le dossier")')
  await page.waitForTimeout(7000)

  const { data: deux } = await admin.from("matters").select("reference, client_id").eq("firm_id", cabinetId).order("reference")
  verifier("le client porte deux dossiers", (deux ?? []).length, 2)
  verifier("sans dupliquer son profil", new Set((deux ?? []).map((x) => x.client_id)).size, 1)
  verifier("les numéros se suivent", (deux ?? []).map((x) => x.reference.slice(-5)).join(","), "00001,00002")
} finally {
  if (navigateur) await navigateur.close()
  if (cabinetId) await admin.from("firms").delete().eq("id", cabinetId)
  if (userId) await admin.auth.admin.deleteUser(userId)
  console.log("\nCabinet et compte d'épreuve supprimés.")
}
console.log(echecs === 0 ? "\n✓ Ouverture de dossier vérifiée, 0 échec." : `\n✗ ${echecs} échec(s).`)
process.exit(echecs === 0 ? 0 : 1)
