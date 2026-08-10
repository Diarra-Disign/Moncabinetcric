#!/usr/bin/env node
/**
 * Photographie une page de l'application, sous un ou plusieurs thèmes.
 *
 * Le contrôle de contraste dit qu'un texte est LISIBLE ; il ne dit pas qu'un
 * écran est cohérent, ni qu'un bloc n'a pas disparu au passage. Pendant une
 * conversion de couleurs, c'est justement ce qui peut se perdre sans qu'aucun
 * seuil ne bronche — une pastille qui devient invisible parce qu'elle est
 * désormais de la couleur de sa carte reste parfaitement « contrastée » avec
 * le texte qu'elle porte.
 *
 * D'où cet outil : une image avant, une image après, lues à l'œil.
 *
 *   ./cric capture --page=/fr/deadlines --nom=avant
 *   ./cric capture --page=/fr/deadlines --nom=apres --themes=sapphire,midnight
 */
import { readFileSync, readdirSync, mkdirSync } from "node:fs"
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

const lire = (cle, defaut = "") =>
  (process.argv.find((a) => a.startsWith(`--${cle}=`)) ?? "").slice(cle.length + 3) || defaut

const BASE = lire("url", "http://localhost:3000").replace(/\/+$/, "")
const PAGE = lire("page", "/fr/dashboard")
const NOM = lire("nom", "capture")
const THEMES = lire("themes", "sapphire,midnight").split(",").filter(Boolean)
const SORTIE = lire("sortie", "/tmp/captures")

mkdirSync(SORTIE, { recursive: true })

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const marque = Date.now()
const mdp = "Epreuve-" + randomBytes(9).toString("base64url")
let cabinetId, userId, navigateur

try {
  const { data: cab, error: e1 } = await admin.from("firms").insert({
    name: `Cabinet capture ${marque}`,
    rcic_license_number: `R444${String(marque).slice(-4)}`,
    owner_name: "Épreuve", email: `cap-${marque}@example.invalid`,
    plan: "cabinet", status: "active",
  }).select("id").single()
  if (e1) throw new Error(`Cabinet : ${e1.message}`)
  cabinetId = cab.id

  await admin.from("firm_subscriptions").insert({
    firm_id: cabinetId, plan: "cabinet", cadence: "monthly", seats: 3,
    status: "active", stripe_customer_id: `cus_cap_${marque}`,
  })

  const courriel = `consultant-${marque}@example.invalid`
  const { data: u } = await admin.auth.admin.createUser({
    email: courriel, password: mdp, email_confirm: true,
  })
  userId = u.user.id
  await admin.from("profiles").insert({
    firm_id: cabinetId, user_id: userId, email: courriel,
    full_name: "Consultant d'épreuve", cicc_role: "owner",
  })

  // Un peu de matière, sans quoi les écrans montrent leur état vide — qui est
  // rarement celui dont on doute.
  const { data: c } = await admin.from("clients").insert({
    firm_id: cabinetId, name: "Awa Diallo", email: `awa-${marque}@example.invalid`,
    file_number: "C-1", program: "PE", residence: "Dakar", status: "active",
    client_type: "individual",
  }).select("id").single()

  const { data: m } = await admin.from("matters").insert({
    firm_id: cabinetId, client_id: c.id, reference: "CAP-2026-00001",
    client_name: "Awa Diallo", client_type: "b2c", program: "PE", category: "study",
    rcic: "Me Épreuve", status: "pending",
  }).select("id").single()

  await admin.from("matter_deadlines").insert([
    { firm_id: cabinetId, matter_id: m.id, title: "Dépôt de la demande", due_on: new Date(Date.now() + 9 * 86400000).toISOString().slice(0, 10), status: "open", is_regulatory: true },
    { firm_id: cabinetId, matter_id: m.id, title: "Expiration du passeport", due_on: new Date(Date.now() + 55 * 86400000).toISOString().slice(0, 10), status: "open", is_regulatory: false },
  ])

  await admin.from("leads").insert({
    firm_id: cabinetId, name: "Marc Tremblay", email: `mt-${marque}@example.invalid`,
    phone: "+1 514 555 0111", type: "b2c", visa_type: "Permis de travail",
    estimated_value: 3200, score: 70, score_label: "med", stage: "newLead",
    last_contact: new Date().toISOString().slice(0, 10), notes: "",
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

  await page.goto(`${BASE}${PAGE}`, { waitUntil: "domcontentloaded" })
  await page.waitForSelector("h1, h2", { timeout: 30000 })
  await page.waitForTimeout(1800)

  for (const theme of THEMES) {
    await page.evaluate((t) => document.documentElement.setAttribute("data-cabinet-theme", t), theme)
    await page.waitForTimeout(700)
    const chemin = join(SORTIE, `${NOM}-${PAGE.replace(/\W+/g, "-").replace(/^-|-$/g, "")}-${theme}.png`)
    await page.screenshot({ path: chemin, fullPage: true })
    console.log(`  ${chemin}`)
  }
} finally {
  if (navigateur) await navigateur.close()
  if (cabinetId) await admin.from("firms").delete().eq("id", cabinetId)
  if (userId) await admin.auth.admin.deleteUser(userId)
  console.log("\nCabinet et compte d'épreuve supprimés.")
}
