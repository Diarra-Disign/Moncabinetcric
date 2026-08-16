#!/usr/bin/env node
/**
 * Le registre mensuel du compte client, de la base jusqu'à l'écran.
 *
 * Le scénario est celui du §6 du cahier des charges, au dollar près : trois
 * clients, des ouvertures différentes, et des totaux qui doivent tomber juste.
 *
 *     Client           Ouverture   Dépôts   Retraits   Solde
 *     Jean Tremblay            0    3 500      2 000   1 500
 *     Fatou Traoré         1 000    2 000        500   2 500
 *     Moussa Diallo        2 000        —      1 000   1 000
 *     TOTAL                3 000    5 500      3 500   5 000
 *
 * Le mois d'AVRIL est éprouvé pour lui-même : Jean n'a encore aucun fonds et
 * ne doit pas y figurer, Moussa y porte déjà son ouverture. C'est la règle des
 * §7 et §31 vue depuis l'écran plutôt que depuis le SQL.
 *
 * La lecture porte sur LA SECTION DU REGISTRE, jamais sur la page entière :
 * les blocs existants — solde par client, mouvements — listent tous les
 * clients sans égard au mois, et une lecture globale ferait passer l'épreuve
 * pour de mauvaises raisons.
 */
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"
import { chromium } from "@playwright/test"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const env = Object.fromEntries(
  [...readFileSync(join(ROOT, ".env.local"), "utf8").matchAll(/^([A-Z0-9_]+)=(.*)$/gm)].map((m) => [m[1], m[2].trim()])
)
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

let echecs = 0
const v = (q, ok, d = "") => { if (!ok) echecs++; console.log(`  ${ok ? "✓" : "✗"} ${q.padEnd(50)} ${d}`) }

const BASE = (process.argv.find((a) => a.startsWith("--url=")) ?? "--url=http://localhost:3000").slice(6).replace(/\/+$/, "")

const marque = Date.now()
const mdp = `Epreuve-Registre-${marque}!aA1`
let cabinetId, userId, nav

try {
  const { data: cab, error: eC } = await admin.from("firms").insert({
    name: `Cabinet registre ${marque}`,
    rcic_license_number: `R555${String(marque).slice(-4)}`,
    owner_name: "Épreuve", email: `reg-${marque}@example.invalid`,
    plan: "courtoisie", status: "active", address: "1000 rue Sherbrooke O, Montréal",
  }).select("id").single()
  if (eC) throw new Error(eC.message)
  cabinetId = cab.id

  const courriel = `reg-consultant-${marque}@example.invalid`
  const { data: u } = await admin.auth.admin.createUser({ email: courriel, password: mdp, email_confirm: true })
  userId = u.user.id
  await admin.from("profiles").insert({
    firm_id: cabinetId, user_id: userId, email: courriel,
    full_name: "Consultant", cicc_role: "owner",
  })

  // Trois clients, exactement le tableau du §6 du cahier des charges.
  const clients = {}
  for (const [nom, num] of [["Jean Tremblay", "C-1"], ["Fatou Traoré", "C-2"], ["Moussa Diallo", "C-3"]]) {
    const { data } = await admin.from("clients").insert({
      firm_id: cabinetId, name: nom, email: `${num}-${marque}@example.invalid`,
      file_number: num, program: "RP", status: "active", client_type: "individual",
    }).select("id").single()
    clients[nom] = data.id
  }

  await admin.from("trust_ledger").insert([
    // Jean : rien avant mai, 3 500 déposés, 2 000 retirés → 1 500
    { firm_id: cabinetId, client_id: clients["Jean Tremblay"], entry_type: "deposit", amount: 3500, occurred_on: "2026-05-02", memo: "Paiement anticipé" },
    { firm_id: cabinetId, client_id: clients["Jean Tremblay"], entry_type: "transfer_to_business", amount: 2000, occurred_on: "2026-05-15", memo: "Services rendus" },
    // Fatou : 1 000 d'ouverture, +2 000, −500 → 2 500
    { firm_id: cabinetId, client_id: clients["Fatou Traoré"], entry_type: "deposit", amount: 1000, occurred_on: "2026-04-10", memo: "Ouverture" },
    { firm_id: cabinetId, client_id: clients["Fatou Traoré"], entry_type: "deposit", amount: 2000, occurred_on: "2026-05-06", memo: "Complément" },
    { firm_id: cabinetId, client_id: clients["Fatou Traoré"], entry_type: "transfer_to_business", amount: 500, occurred_on: "2026-05-22", memo: "Honoraires" },
    // Moussa : 2 000 d'ouverture, −1 000 → 1 000
    { firm_id: cabinetId, client_id: clients["Moussa Diallo"], entry_type: "deposit", amount: 2000, occurred_on: "2026-03-18", memo: "Acompte" },
    { firm_id: cabinetId, client_id: clients["Moussa Diallo"], entry_type: "transfer_to_business", amount: 1000, occurred_on: "2026-05-28", memo: "Honoraires" },
  ])

  nav = await chromium.launch()
  const page = await (await nav.newContext({ viewport: { width: 1500, height: 1100 } })).newPage()
  await page.goto(`${BASE}/fr/connexion`, { waitUntil: "domcontentloaded" })
  await page.waitForSelector('input[type="email"]', { timeout: 30000 })
  await page.fill('input[type="email"]', courriel)
  await page.fill('input[type="password"]', mdp)
  await page.waitForSelector('button[type="submit"]:not([disabled])', { timeout: 30000 })
  await page.click('button[type="submit"]')
  // La redirection après connexion n'est pas instantanée ; attendre l'ADRESSE
  // plutôt qu'une durée évitait un échec intermittent qu'on mettait sur le
  // compte de la lenteur.
  await page.waitForTimeout(4000)
  await page.waitForURL(/\/fr(\/|$)/, { timeout: 20000 }).catch(() => {})

  await page.goto(`${BASE}/fr/fideicommis?mois=2026-05`, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(3000)
  try {
    await page.waitForSelector("h2", { timeout: 20000 })
  } catch {
    console.log("   URL   :", page.url())
    console.log("   TEXTE :", (await page.evaluate(() => document.body.innerText)).slice(0, 500))
    throw new Error("l'écran n'a pas rendu")
  }

  const vu = (await page.evaluate(() => document.body.innerText)).replace(/[  ]/g, " ")

  console.log("\nLe tableau du §6, à l'écran")
  v("le registre mensuel est affiché", /Registre du compte client/.test(vu))
  v("Jean Tremblay — clôture 1 500", /Jean Tremblay/.test(vu) && /1 500,00/.test(vu))
  v("Fatou Traoré — clôture 2 500", /Fatou Traoré/.test(vu) && /2 500,00/.test(vu))
  v("Moussa Diallo — clôture 1 000", /Moussa Diallo/.test(vu) && /1 000,00/.test(vu))
  v("ouverture totale 3 000", /3 000,00/.test(vu))
  v("dépôts 5 500", /5 500,00/.test(vu))
  v("retraits 3 500", /3 500,00/.test(vu))
  v("clôture totale 5 000", /5 000,00/.test(vu))
  v("le total détenu est énoncé", /Total des fonds détenus/.test(vu))
  v("§37 — aucune promesse de conformité", !/garantit la conformité|conforme au CICC/i.test(vu))
  v("§37 — la responsabilité est rappelée", /demeure responsable/.test(vu))

  console.log("\nLe changement de mois")
  await page.selectOption("#mois-registre", "2026-04")
  await page.waitForTimeout(2000)
  const tableau = async () =>
    (await page.locator("section", { hasText: "Registre du compte client" })
      .first().innerText()).replace(/[\u00a0\u202f]/g, " ")
  const avril = await tableau()
  v("l'adresse porte le mois", page.url().includes("mois=2026-04"), page.url().split("?")[1] ?? "")
  v("avril — Fatou entre avec 1 000 de dépôt", /Fatou Traoré/.test(avril))
  v("avril — Jean n'a encore aucun fonds", !/Jean Tremblay/.test(avril))
  v("avril — Moussa a déjà ses 2 000 en ouverture", /Moussa Diallo/.test(avril))

  console.log("\nL'export tableur")
  const csv = await page.request.get(`${BASE}/api/fideicommis/registre?mois=2026-05`)
  const texte = await csv.text()
  v("le fichier est servi", csv.status(), 200)
  v("en pièce jointe et nommé par le mois",
    /registre-compte-client-2026-05\.csv/.test(csv.headers()["content-disposition"] ?? ""))
  v("la marque d'ordre d'octets est là", texte.charCodeAt(0) === 0xfeff)
  v("le séparateur est le point-virgule", texte.includes("Client;Dernière transaction"))
  v("les trois clients y sont", ["Jean Tremblay", "Fatou Traoré", "Moussa Diallo"].every((n) => texte.includes(n)))
  v("les totaux aussi", texte.includes("Totaux;;3000.00;5500.00;3500.00;5000.00"))
  v("un mois invalide est refusé",
    (await page.request.get(`${BASE}/api/fideicommis/registre?mois=pas-un-mois`)).status(), 400)

  await page.goto(`${BASE}/fr/fideicommis?mois=2026-05`, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: "/tmp/registre-mensuel.png", fullPage: false })
  console.log("\n     Capture : /tmp/registre-mensuel.png")
} finally {
  if (nav) await nav.close()
  if (cabinetId) await admin.rpc("purger_cabinet_epreuve", { p_firm_id: cabinetId })
  if (userId) await admin.auth.admin.deleteUser(userId)
  console.log("\nCabinet d'épreuve supprimé.")
}

console.log(echecs === 0 ? "\n✓ Registre mensuel vérifié, 0 échec." : `\n✗ ${echecs} échec(s).`)
process.exit(echecs === 0 ? 0 : 1)
