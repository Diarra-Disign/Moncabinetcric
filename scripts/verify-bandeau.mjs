#!/usr/bin/env node
/**
 * Le bandeau d'échéances dit-il la vérité ?
 *
 * On lui présente trois situations réelles — aucune échéance, une à 20 jours,
 * une à 5 jours — et l'on vérifie que ce que l'écran MONTRE correspond à ce
 * que la base CONTIENT : le titre, la ligne de détail, la teinte, et la
 * présence ou non d'une animation.
 *
 * Le défaut corrigé ne se voyait dans aucun test : le bandeau s'affichait
 * parfaitement, avec ses belles couleurs d'alerte, sur un cabinet sans la
 * moindre échéance. Rien n'était « cassé ». Il mentait, simplement.
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
  console.log(`  ${ok ? "✓" : "✗"} ${intitule.padEnd(44)} ${String(obtenu).slice(0, 46)}` +
    (ok ? "" : `\n      ATTENDU ${attendu}`))
}

const marque = Date.now()
const mdp = "Epreuve-" + randomBytes(9).toString("base64url")
let cabinetId, userId, navigateur

const dansNJours = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)

try {
  const { data: cab, error: e1 } = await admin.from("firms").insert({
    name: `Cabinet bandeau ${marque}`,
    rcic_license_number: `R111${String(marque).slice(-4)}`,
    owner_name: "Épreuve", email: `ban-${marque}@example.invalid`,
    plan: "cabinet", status: "active",
  }).select("id").single()
  if (e1) throw new Error(`Cabinet : ${e1.message}`)
  cabinetId = cab.id

  await admin.from("firm_subscriptions").insert({
    firm_id: cabinetId, plan: "cabinet", cadence: "monthly", seats: 3,
    status: "active", stripe_customer_id: `cus_ban_${marque}`,
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

  const { data: cl } = await admin.from("clients").insert({
    firm_id: cabinetId, name: "Tremblay", email: `t-${marque}@example.invalid`,
    file_number: `DOS-${String(marque).slice(-6)}`, program: "Express Entry",
    status: "active", client_type: "individual",
  }).select("id").single()

  const { data: m } = await admin.from("matters").insert({
    firm_id: cabinetId, client_id: cl.id, reference: `M-${marque}`,
    client_name: "Tremblay", program: "Express Entry", category: "pr",
    rcic: "Épreuve", status: "pending", client_type: "b2c",
  }).select("id").single()

  navigateur = await chromium.launch({ channel: "chrome" })
  const page = await (await navigateur.newContext({ viewport: { width: 1440, height: 1000 } })).newPage()

  await page.goto(`${BASE}/fr/connexion`, { waitUntil: "domcontentloaded" })
  await page.waitForSelector('input[type="email"]', { timeout: 30000 })
  await page.fill('input[type="email"]', courriel)
  await page.fill('input[type="password"]', mdp)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/fr(\/|$)/, { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(2500)

  /** Ce que le bandeau raconte, tel qu'il est rendu. */
  const lireBandeau = async () => {
    await page.goto(`${BASE}/fr/dashboard`, { waitUntil: "domcontentloaded" })
    await page.waitForSelector("h2", { timeout: 30000 })
    await page.waitForTimeout(1200)
    return page.evaluate(() => {
      const pastille = [...document.querySelectorAll("span")]
        .find((s) => /MOTEUR D'ÉCHÉANCES/i.test(s.textContent ?? ""))
      const bandeau = pastille?.closest("div.rounded-3xl")
      if (!bandeau) return { present: false }
      const horloge = bandeau.querySelector("svg")
      return {
        present: true,
        titre: bandeau.querySelector("h2")?.textContent?.trim() ?? "",
        detail: bandeau.querySelector("p")?.textContent?.trim() ?? "",
        classes: bandeau.className,
        pulse: Boolean(horloge && horloge.className.baseVal.includes("animate-pulse")),
      }
    })
  }

  // -------------------------------------------------------------------------
  console.log("\nAucune échéance — le bandeau doit être calme")
  // -------------------------------------------------------------------------
  let b = await lireBandeau()
  verifier("le bandeau s'affiche", b.present, true)
  verifier("teinte de succès", /bg-success/.test(b.classes ?? "") ? "succès" : b.classes?.slice(0, 30), "succès")
  verifier("rien ne palpite", b.pulse ? "PALPITE" : "immobile", "immobile")
  verifier("le titre annonce le contrôle", /sous contrôle/i.test(b.titre ?? "") ? "oui" : b.titre, "oui")
  verifier("le détail ne parle pas d'urgence", /aucune échéance enregistrée/i.test(b.detail ?? "") ? "oui" : b.detail, "oui")

  // -------------------------------------------------------------------------
  console.log("\nUne échéance à 20 jours — vigilance, sans alarme")
  // -------------------------------------------------------------------------
  const { error: eEch } = await admin.from("matter_deadlines").insert({
    firm_id: cabinetId, matter_id: m.id, title: "Dépôt du dossier",
    due_on: dansNJours(20), priority: "high", is_regulatory: true,
  })
  if (eEch) console.log(`  ! échéance non créée : ${eEch.message}`)

  b = await lireBandeau()
  verifier("teinte d'avertissement", /bg-warning/.test(b.classes ?? "") ? "avertissement" : b.classes?.slice(0, 30), "avertissement")
  verifier("rien ne palpite encore", b.pulse ? "PALPITE" : "immobile", "immobile")
  verifier("le titre compte les échéances", /à surveiller dans les 30 jours/i.test(b.titre ?? "") ? "oui" : b.titre, "oui")

  // -------------------------------------------------------------------------
  console.log("\nUne échéance à 5 jours — alarme, et elle seule palpite")
  // -------------------------------------------------------------------------
  const { error: eEch2 } = await admin.from("matter_deadlines").insert({
    firm_id: cabinetId, matter_id: m.id, title: "Biométrie",
    due_on: dansNJours(5), priority: "critical", is_regulatory: true,
  })
  if (eEch2) console.log(`  ! échéance non créée : ${eEch2.message}`)

  b = await lireBandeau()
  verifier("teinte d'erreur", /bg-error/.test(b.classes ?? "") ? "erreur" : b.classes?.slice(0, 30), "erreur")
  verifier("l'horloge palpite", b.pulse ? "palpite" : "IMMOBILE", "palpite")
  verifier("le titre nomme le délai", /moins de 14 jours/i.test(b.titre ?? "") ? "oui" : b.titre, "oui")
  verifier("le détail ne dit plus « aucune »", /aucune/i.test(b.detail ?? "") ? "MENT" : "cohérent", "cohérent")
} finally {
  if (navigateur) await navigateur.close()
  if (cabinetId) await admin.from("firms").delete().eq("id", cabinetId)
  if (userId) await admin.auth.admin.deleteUser(userId)
  console.log("\nCabinet et compte d'épreuve supprimés.")
}

console.log(echecs === 0 ? "\n✓ Le bandeau dit ce que la base contient, 0 échec." : `\n✗ ${echecs} échec(s).`)
process.exit(echecs === 0 ? 0 : 1)
