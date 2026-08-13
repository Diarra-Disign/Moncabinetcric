/**
 * Ouvre réellement la fiche complète d'un dossier dans un navigateur.
 *
 * Le but n'est pas de vérifier une requête SQL mais la seule chose que
 * l'utilisateur constate : la page s'affiche-t-elle, ou rend-elle une erreur ?
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

const marque = Date.now()
const mdp = "Epreuve-" + randomBytes(9).toString("base64url")
const courriel = `fiche-${marque}@example.invalid`
const reference = `M-${marque}`
let cabinetId, userId, navigateur, echecs = 0

const verifier = (intitule, obtenu, attendu) => {
  const ok = String(obtenu) === String(attendu)
  if (!ok) echecs++
  console.log(`  ${ok ? "✓" : "✗"} ${intitule.padEnd(46)} ${String(obtenu).slice(0, 60)}` +
    (ok ? "" : `   ATTENDU ${attendu}`))
}

try {
  const { data: cab, error: e1 } = await admin.from("firms").insert({
    name: `Cabinet fiche ${marque}`,
    rcic_license_number: `R777${String(marque).slice(-4)}`,
    owner_name: "Épreuve", email: courriel, plan: "cabinet", status: "active",
  }).select("id").single()
  if (e1) throw new Error(`Cabinet : ${e1.message}`)
  cabinetId = cab.id

  await admin.from("firm_subscriptions").insert({
    firm_id: cabinetId, plan: "cabinet", cadence: "monthly", seats: 3,
    status: "active", stripe_customer_id: `cus_fiche_${marque}`,
  })

  const { data: u, error: e2 } = await admin.auth.admin.createUser({
    email: courriel, password: mdp, email_confirm: true,
  })
  if (e2) throw new Error(`Compte : ${e2.message}`)
  userId = u.user.id
  await admin.from("profiles").insert({
    firm_id: cabinetId, user_id: userId, email: courriel,
    full_name: "Propriétaire d'épreuve", cicc_role: "owner",
  })

  const { data: cl } = await admin.from("clients").insert({
    firm_id: cabinetId, name: "Tremblay", email: `tremblay-${marque}@example.invalid`,
    file_number: `DOS-${String(marque).slice(-6)}`, program: "Express Entry",
    status: "active", client_type: "individual",
  }).select("id").single()

  const { data: m, error: em } = await admin.from("matters").insert({
    firm_id: cabinetId, client_id: cl.id, reference,
    client_name: "Tremblay", program: "Résidence Permanente (EE)", category: "pr",
    rcic: "Épreuve", status: "pending", client_type: "b2c",
  }).select("id").single()
  if (em) throw new Error(`Dossier : ${em.message}`)

  navigateur = await chromium.launch({ channel: "chrome" })
  const page = await (await navigateur.newContext({ viewport: { width: 1440, height: 900 } })).newPage()

  const erreursConsole = []
  page.on("console", (msg) => { if (msg.type() === "error") erreursConsole.push(msg.text()) })

  await page.goto(`${BASE}/fr/connexion`, { waitUntil: "domcontentloaded" })
  await page.waitForSelector('input[type="email"]', { timeout: 30000 })
  await page.fill('input[type="email"]', courriel)
  await page.fill('input[type="password"]', mdp)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/fr(\/|$)/, { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(2500)

  console.log(`\nOuverture de la fiche complète — /fr/matters/${reference}\n`)
  const rep = await page.goto(`${BASE}/fr/matters/${reference}`, { waitUntil: "domcontentloaded" })

  verifier("le serveur répond 200", rep.status(), 200)

  const etat = await page.evaluate(() => ({
    titre: document.title,
    texte: document.body.innerText.slice(0, 400),
    onglets: [...document.querySelectorAll("button")]
      .map((b) => b.textContent.trim())
      .filter((t) => /Documents|Formulaires|Facturation|Échéances|Portail|Questionnaires/i.test(t)),
  }))

  const erreurNext = /Application error|Something went wrong|Une erreur|500|Internal Server Error/i.test(etat.texte)
  verifier("aucune page d'erreur", erreurNext ? "ERREUR AFFICHÉE" : "non", "non")
  verifier("la référence du dossier est affichée", etat.texte.includes(reference), true)
  verifier("les onglets du dossier sont rendus", etat.onglets.length > 0, true)
  console.log(`     onglets vus : ${etat.onglets.join(" · ") || "aucun"}`)

  const erreursDures = erreursConsole.filter((e) => !/favicon|manifest|404 \(Not Found\)/i.test(e))
  verifier("aucune erreur console", erreursDures.length, 0)
  if (erreursDures.length) erreursDures.slice(0, 3).forEach((e) => console.log(`     ${e.slice(0, 160)}`))

  if (!erreurNext) console.log(`\n   Extrait :\n   ${etat.texte.split("\n").slice(0, 6).join("\n   ")}`)
} finally {
  if (navigateur) await navigateur.close()
  if (cabinetId) await admin.rpc("purger_cabinet_epreuve", { p_firm_id: cabinetId })
  if (userId) await admin.auth.admin.deleteUser(userId)
  console.log("\nCabinet et compte d'épreuve supprimés.")
}

console.log(echecs === 0 ? "\n✓ La fiche complète s'ouvre, 0 échec." : `\n✗ ${echecs} échec(s).`)
process.exit(echecs === 0 ? 0 : 1)
