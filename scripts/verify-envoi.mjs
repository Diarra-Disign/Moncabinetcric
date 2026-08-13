#!/usr/bin/env node
/**
 * Reproduit le clic sur « Envoyer » depuis la bibliothèque, dans un vrai
 * navigateur, et rapporte CE QUE L'ÉCRAN RÉPOND.
 *
 * Un envoi peut échouer de trois manières qui se ressemblent à l'usage :
 * le bouton reste inerte, l'action échoue en silence, ou elle réussit sans
 * que le courriel parte. Ce script les distingue en lisant à la fois le
 * message affiché et l'état de la base.
 */
import { readFileSync, readdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { randomBytes } from "node:crypto"
import { createClient } from "@supabase/supabase-js"
import { exigerSupabase } from "./lib/environnement.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const env = Object.fromEntries(
  [...readFileSync(join(ROOT, ".env.local"), "utf8").matchAll(/^([A-Z0-9_]+)=(.*)$/gm)]
    .map((m) => [m[1], m[2].trim()])
)

// Avant toute conclusion : l'application lit-elle la vraie base ? Sinon
// cette épreuve échouerait sur des données factices, et son verdict
// parlerait de l'environnement en croyant parler du produit.
exigerSupabase(env)


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
  console.log(`  ${ok ? "✓" : "✗"} ${intitule.padEnd(46)} ${String(obtenu).slice(0, 60)}` +
    (ok ? "" : `\n      ATTENDU ${attendu}`))
}

const marque = Date.now()
const mdp = "Epreuve-" + randomBytes(9).toString("base64url")
let cabinetId, userId, navigateur

try {
  const { data: cab, error: e1 } = await admin.from("firms").insert({
    name: `Cabinet envoi ${marque}`,
    rcic_license_number: `R333${String(marque).slice(-4)}`,
    owner_name: "Épreuve", email: `envoi-${marque}@example.invalid`,
    plan: "cabinet", status: "active",
  }).select("id").single()
  if (e1) throw new Error(`Cabinet : ${e1.message}`)
  cabinetId = cab.id

  await admin.from("firm_subscriptions").insert({
    firm_id: cabinetId, plan: "cabinet", cadence: "monthly", seats: 3,
    status: "active", stripe_customer_id: `cus_env_${marque}`,
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

  await admin.from("leads").insert({
    firm_id: cabinetId, name: "Awa Diallo", email: `awa-${marque}@example.invalid`,
    phone: "+1 514 555 0199", type: "b2c", visa_type: "Permis d'études",
    estimated_value: 2500, score: 70, score_label: "med", stage: "newLead",
    last_contact: new Date().toISOString().slice(0, 10), notes: "",
  })

  navigateur = await chromium.launch({ channel: "chrome" })
  const page = await (await navigateur.newContext({ viewport: { width: 1440, height: 950 } })).newPage()

  const erreursConsole = []
  const erreursReseau = []
  page.on("console", (m) => { if (m.type() === "error") erreursConsole.push(m.text()) })
  page.on("pageerror", (e) => erreursConsole.push(String(e)))
  page.on("response", (r) => { if (r.status() >= 500) erreursReseau.push(`${r.status()} ${r.url()}`) })

  await page.goto(`${BASE}/fr/connexion`, { waitUntil: "domcontentloaded" })
  await page.waitForSelector('input[type="email"]', { timeout: 30000 })
  await page.fill('input[type="email"]', courriel)
  await page.fill('input[type="password"]', mdp)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/fr(\/|$)/, { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(2500)

  console.log("\nL'écran de la bibliothèque")
  await page.goto(`${BASE}/fr/questionnaires`, { waitUntil: "domcontentloaded" })
  await page.waitForSelector("h1", { timeout: 30000 })
  await page.waitForTimeout(1200)

  const cartes = await page.$$('article button:has-text("Envoyer")')
  verifier("des modèles sont proposés", cartes.length > 0, true)

  console.log("\nOn clique sur « Envoyer »")
  await cartes[0].click()
  await page.waitForTimeout(700)

  const modaleOuverte = await page.evaluate(() =>
    Boolean([...document.querySelectorAll("h2")].find((h) => /^Envoyer :/.test(h.textContent ?? "")))
  )
  verifier("la fenêtre d'envoi s'ouvre", modaleOuverte, true)

  const prospects = await page.$$('div.max-h-52 button')
  verifier("le prospect apparaît dans la liste", prospects.length > 0, true)
  await prospects[0].click()
  await page.waitForTimeout(400)

  const boutonEnvoyer = await page.$('footer button:has-text("Envoyer")')
  const desactive = await boutonEnvoyer.isDisabled()
  verifier("le bouton « Envoyer » est actif", desactive ? "DÉSACTIVÉ" : "actif", "actif")

  // ---------------------------------------------------------------------
  console.log("\nLe premier clic ne doit RIEN envoyer")
  // ---------------------------------------------------------------------
  await boutonEnvoyer.click()
  await page.waitForTimeout(900)

  const confirmation = await page.evaluate(() =>
    Boolean([...document.querySelectorAll("h2")].find((h) => /Confirmer l'envoi/.test(h.textContent ?? ""))))
  verifier("la confirmation s'ouvre", confirmation, true)

  const vu = await page.evaluate(() => document.querySelector('[role="dialog"]')?.textContent ?? "")
  verifier("elle nomme le destinataire", /Awa Diallo/.test(vu), true)
  verifier("elle montre son adresse", /awa-/.test(vu), true)
  verifier("elle nomme ce qui part", /Questionnaire/.test(vu), true)

  const { data: avant } = await admin.from("client_questionnaires").select("id").eq("firm_id", cabinetId)
  verifier("RIEN n'est parti avant confirmation", (avant ?? []).length, 0)

  // ---------------------------------------------------------------------
  console.log("\nAnnuler ne laisse aucune trace")
  // ---------------------------------------------------------------------
  await page.click('[role="dialog"] button:has-text("Annuler")')
  await page.waitForTimeout(700)
  const { data: apresAnnule } = await admin.from("client_questionnaires").select("id").eq("firm_id", cabinetId)
  verifier("après Annuler, toujours rien", (apresAnnule ?? []).length, 0)

  // ---------------------------------------------------------------------
  console.log("\nConfirmer, et alors seulement, envoyer")
  // ---------------------------------------------------------------------
  await boutonEnvoyer.click()
  await page.waitForTimeout(900)
  await page.click('[role="dialog"] button:has-text("Confirmer")')
  // L'action serveur crée la ligne puis appelle le fournisseur de courriel :
  // laisser le temps aux deux, sans quoi on conclurait à un échec sur une
  // simple lenteur.
  await page.waitForTimeout(6000)

  console.log("\nL'écran montre-t-il la preuve, là où l'œil se trouve ?")
  const apres = await page.evaluate(() => {
    const actif = [...document.querySelectorAll("button")]
      .find((b) => b.className.includes("border-primary") && /Envoyés/.test(b.textContent ?? ""))
    return {
      ongletEnvoyes: Boolean(actif),
      hauteur: Math.round(window.scrollY),
      lignePresente: /Awa Diallo/.test(document.body.innerText),
    }
  })
  verifier("l'onglet « Envoyés » devient actif", apres.ongletEnvoyes, true)
  verifier("la page est remontée sur la confirmation", apres.hauteur, 0)
  verifier("la ligne de l'envoi est visible", apres.lignePresente, true)

  console.log("\nCe que l'écran répond")
  const message = await page.evaluate(() => {
    const bloc = document.querySelector('[role="status"]')
    return bloc ? (bloc.textContent ?? "").trim() : "AUCUN MESSAGE"
  })
  console.log(`     « ${message.slice(0, 200)} »`)

  console.log("\nCe qui s'est réellement passé en base")
  const { data: envois } = await admin
    .from("client_questionnaires")
    .select("id, status, title, token_hash, sent_at")
    .eq("firm_id", cabinetId)
  verifier("le questionnaire est créé", (envois ?? []).length, 1)
  if ((envois ?? []).length > 0) {
    verifier("il porte le statut « envoyé »", envois[0].status, "sent")
    verifier("un lien d'accès a été engendré", Boolean(envois[0].token_hash), true)
    verifier("la date d'envoi est posée", Boolean(envois[0].sent_at), true)
  }

  // ---------------------------------------------------------------------
  console.log("\nLe rappel obéit à la même règle")
  // ---------------------------------------------------------------------
  // Le rappel mérite sa propre épreuve : il émet un jeton neuf, donc un clic
  // accidentel ne se contente pas d'envoyer un courriel de trop — il TUE le
  // lien que le destinataire avait peut-être déjà ouvert. Ce qu'on vérifie
  // ici, c'est que la fenêtre le dit, et qu'Annuler laisse le jeton intact.
  const jetonAvant = (envois ?? [])[0]?.token_hash ?? null

  await page.click('article button:has-text("Rappel")')
  await page.waitForTimeout(900)

  const vuRappel = await page.evaluate(() => document.querySelector('[role="dialog"]')?.textContent ?? "")
  verifier("le rappel demande confirmation", /Confirmer l'envoi/.test(vuRappel), true)
  verifier("il nomme le destinataire", /Awa Diallo/.test(vuRappel), true)
  verifier("il annonce que l'ancien lien meurt", /cessera aussitôt de fonctionner/.test(vuRappel), true)

  await page.click('[role="dialog"] button:has-text("Annuler")')
  await page.waitForTimeout(900)

  const { data: apresAnnuleRappel } = await admin
    .from("client_questionnaires")
    .select("token_hash, reminder_count")
    .eq("firm_id", cabinetId)
  verifier("après Annuler, aucun rappel compté", apresAnnuleRappel?.[0]?.reminder_count ?? 0, 0)
  verifier("après Annuler, le lien est intact", apresAnnuleRappel?.[0]?.token_hash === jetonAvant, true)

  verifier("aucune erreur serveur (5xx)", erreursReseau.length, 0)
  if (erreursReseau.length) erreursReseau.slice(0, 3).forEach((e) => console.log(`     ${e}`))

  const dures = erreursConsole.filter((e) => !/favicon|manifest|404/i.test(e))
  verifier("aucune erreur console", dures.length, 0)
  if (dures.length) dures.slice(0, 4).forEach((e) => console.log(`     ${e.slice(0, 220)}`))
} finally {
  if (navigateur) await navigateur.close()
  if (cabinetId) await admin.rpc("purger_cabinet_epreuve", { p_firm_id: cabinetId })
  if (userId) await admin.auth.admin.deleteUser(userId)
  console.log("\nCabinet et compte d'épreuve supprimés.")
}

console.log(echecs === 0 ? "\n✓ L'envoi fonctionne, 0 échec." : `\n✗ ${echecs} échec(s).`)
process.exit(echecs === 0 ? 0 : 1)
