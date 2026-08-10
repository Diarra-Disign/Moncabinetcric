#!/usr/bin/env node
/**
 * L'écran Facturation du menu latéral, dans un vrai navigateur.
 *
 * Ce script existe pour un défaut précis, et il le nomme : l'écran ANNONÇAIT
 * des résultats qu'il ne produisait pas. « Facture émise avec succès » sans
 * rien écrire en base, « transmise par courriel » sans envoi, « annulée et
 * retirée du journal » pour un filtre sur l'état local. Trois messages qu'un
 * simple rechargement démentait.
 *
 * On vérifie donc deux choses qu'une relecture du code ne prouve pas :
 *   — les indicateurs comptent le vrai encours, sur le statut CALCULÉ ;
 *   — aucun bouton n'affirme un envoi avant confirmation.
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

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

let echecs = 0
const verifier = (intitule, obtenu, attendu) => {
  const ok = String(obtenu) === String(attendu)
  if (!ok) echecs++
  console.log(`  ${ok ? "✓" : "✗"} ${intitule.padEnd(48)} ${String(obtenu).slice(0, 50)}` +
    (ok ? "" : `\n      ATTENDU ${attendu}`))
}

const marque = Date.now()
const mdp = "Epreuve-" + randomBytes(9).toString("base64url")
let cabinetId, userId, navigateur

try {
  const { data: cab, error: e1 } = await admin.from("firms").insert({
    name: `Cabinet global ${marque}`,
    rcic_license_number: `R777${String(marque).slice(-4)}`,
    owner_name: "Épreuve", email: `glob-${marque}@example.invalid`,
    plan: "cabinet", status: "active",
    tax_gst_rate: 0.05, tax_qst_rate: 0.09975,
  }).select("id").single()
  if (e1) throw new Error(`Cabinet : ${e1.message}`)
  cabinetId = cab.id

  await admin.from("firm_subscriptions").insert({
    firm_id: cabinetId, plan: "cabinet", cadence: "monthly", seats: 3,
    status: "active", stripe_customer_id: `cus_glob_${marque}`,
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

  const { data: c } = await admin.from("clients").insert({
    firm_id: cabinetId, name: "Awa Diallo", email: `awa-${marque}@example.invalid`,
    file_number: "C-1", program: "PE", status: "active", client_type: "individual",
  }).select("id").single()

  const { data: m } = await admin.from("matters").insert({
    firm_id: cabinetId, client_id: c.id, reference: "GLO-2026-00001", client_name: "Awa Diallo",
    client_type: "b2c", program: "PE", category: "study", rcic: "Me Épreuve", status: "pending",
  }).select("id").single()

  // Une facture ÉMISE et non payée : c'est exactement le cas que l'ancien
  // écran comptait pour zéro, parce qu'il filtrait sur un statut « pending »
  // que la base ne produit pas.
  const num = (await admin.rpc("next_invoice_number", { p_firm_id: cabinetId })).data
  const { data: inv } = await admin.from("invoices").insert({
    firm_id: cabinetId, client_id: c.id, matter_id: m.id, invoice_number: num,
    client_name: "Awa Diallo", amount: 0, status: "draft",
    date: new Date().toISOString().slice(0, 10),
    due_on: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    service_description: "Mandat de représentation",
  }).select("id").single()
  await admin.from("invoice_lines").insert([
    { firm_id: cabinetId, invoice_id: inv.id, description: "Honoraires", quantity: 1, unit_price: 1000, taxable: true, position: 1 },
  ])
  await admin.from("invoices").update({ status: "issued" }).eq("id", inv.id)

  navigateur = await chromium.launch({ channel: "chrome" })
  const page = await (await navigateur.newContext({ viewport: { width: 1440, height: 950 } })).newPage()

  const erreursConsole = []
  const erreursReseau = []
  page.on("console", (mm) => { if (mm.type() === "error") erreursConsole.push(mm.text()) })
  page.on("pageerror", (e) => erreursConsole.push(String(e)))
  page.on("response", (r) => { if (r.status() >= 500) erreursReseau.push(`${r.status()} ${r.url()}`) })

  await page.goto(`${BASE}/fr/connexion`, { waitUntil: "domcontentloaded" })
  await page.waitForSelector('input[type="email"]', { timeout: 30000 })
  await page.fill('input[type="email"]', courriel)
  await page.fill('input[type="password"]', mdp)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/fr(\/|$)/, { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(2500)

  console.log("\nL'écran s'ouvre et compte juste")
  await page.goto(`${BASE}/fr/billing`, { waitUntil: "domcontentloaded" })
  await page.waitForSelector("h1", { timeout: 30000 })
  await page.waitForTimeout(1500)

  const vu = await page.evaluate(() => document.body.innerText)
  verifier("la facture du cabinet est listée", vu.includes(String(num)), true)
  verifier("son statut est celui, calculé, de la base", /Émise/.test(vu), true)
  verifier("le dossier est nommé", vu.includes("GLO-2026-00001"), true)

  // 1000 $ + TPS 50 + TVQ 99,75 = 1 149,75 $. C'est ce qui reste à encaisser :
  // l'ancien écran affichait 0 $ ici.
  const montant = vu.replace(/[  ]/g, " ")
  verifier("le total facturé n'est pas nul", montant.includes("1 149,75"), true)
  verifier("« reste à encaisser » compte la facture émise",
    (montant.match(/1 149,75/g) ?? []).length >= 2, true)

  // -----------------------------------------------------------------------
  console.log("\nLe clic réel sur « Voir le PDF »")
  // -----------------------------------------------------------------------
  // Interroger la route à la main prouve qu'elle répond ; cela ne prouve pas
  // que le LIEN de l'écran pointe au bon endroit. C'est le clic qu'il faut
  // reproduire, et l'onglet qu'il ouvre qu'il faut lire.
  const [ongletPdf] = await Promise.all([
    page.waitForEvent("popup", { timeout: 15000 }).catch(() => null),
    page.click('a:has-text("Voir le PDF")'),
  ])
  verifier("un onglet s'ouvre", Boolean(ongletPdf), true)
  if (ongletPdf) {
    const rep = await ongletPdf.request.get(ongletPdf.url())
    verifier("il sert bien un PDF", rep.headers()["content-type"], "application/pdf")
    verifier("et non une page d'erreur", rep.status(), 200)
    const octets = Buffer.from(await rep.body())
    verifier("le fichier est un PDF valide", octets.subarray(0, 5).toString(), "%PDF-")
    await ongletPdf.close()
  }

  console.log("\nAucune façade : le premier clic n'envoie rien")
  await page.click('button:has-text("Envoyer au client")')
  await page.waitForTimeout(800)
  const dial = await page.evaluate(() => document.querySelector('[role="dialog"]')?.textContent ?? "")
  verifier("la confirmation s'ouvre", /Confirmer l'envoi/.test(dial), true)
  verifier("elle nomme le destinataire", /Awa Diallo/.test(dial), true)
  verifier("elle montre son adresse", /awa-/.test(dial), true)
  verifier("elle nomme la facture", dial.includes(String(num)), true)

  await page.click('[role="dialog"] button:has-text("Annuler")')
  await page.waitForTimeout(600)

  console.log("\nCe que l'écran promet, la base le confirme")
  // L'ancien « Supprimer » retirait la ligne de l'écran sans rien écrire :
  // après rechargement, la facture revenait. On vérifie l'inverse — ce que
  // l'écran montre survit à un rechargement.
  await page.reload({ waitUntil: "domcontentloaded" })
  await page.waitForTimeout(1500)
  const apres = await page.evaluate(() => document.body.innerText)
  verifier("la liste survit au rechargement", apres.includes(String(num)), true)

  console.log("\nLa création conduit au dossier, elle ne se fait plus ici")
  await page.click('button:has-text("Nouvelle facture")')
  await page.waitForTimeout(600)
  const choix = await page.evaluate(() => document.querySelector('[role="dialog"]')?.textContent ?? "")
  verifier("on demande le dossier", /Dans quel dossier/.test(choix), true)
  verifier("et l'on dit pourquoi", /appartient toujours à un dossier/.test(choix), true)
  verifier("aucun champ de montant n'est proposé",
    await page.evaluate(() => Boolean(document.querySelector('[role="dialog"] input[inputmode="decimal"]'))), false)

  await page.click('[role="dialog"] button:has-text("Awa Diallo")')
  await page.waitForTimeout(2500)
  verifier("on arrive sur le dossier", /\/matters\//.test(page.url()), true)

  verifier("aucune erreur serveur (5xx)", erreursReseau.length, 0)
  if (erreursReseau.length) erreursReseau.slice(0, 3).forEach((e) => console.log(`     ${e}`))
  const dures = erreursConsole.filter((e) => !/favicon|manifest|404/i.test(e))
  verifier("aucune erreur console", dures.length, 0)
  if (dures.length) dures.slice(0, 4).forEach((e) => console.log(`     ${e.slice(0, 220)}`))
} finally {
  if (navigateur) await navigateur.close()
  if (cabinetId) await admin.from("firms").delete().eq("id", cabinetId)
  if (userId) await admin.auth.admin.deleteUser(userId)
  console.log("\nCabinet et compte d'épreuve supprimés.")
}

console.log(echecs === 0 ? "\n✓ L'écran de facturation dit vrai, 0 échec." : `\n✗ ${echecs} échec(s).`)
process.exit(echecs === 0 ? 0 : 1)
