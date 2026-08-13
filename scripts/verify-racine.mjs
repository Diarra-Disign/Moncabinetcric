#!/usr/bin/env node
/**
 * Éprouve ce que sert la racine du domaine, et ce qu'elle ne sert pas.
 *
 *   ./cric racine
 *   ./cric racine --url=https://moncabinetcric.vercel.app
 *
 * ─── POURQUOI CE CONTRÔLE EXISTE ───────────────────────────────────────────
 *
 * La racine rendait le PORTAIL CLIENT — un dossier d'immigration, donc une page
 * qui exige une session. `proxy.ts` la déclarait protégée à ce titre, et tout
 * visiteur non connecté était renvoyé vers la page de connexion. Qui tapait le
 * nom de domaine tombait sur un formulaire de mot de passe sans jamais voir le
 * produit ; le plan de site annonçait pourtant cette racine en priorité 1.0.
 *
 * Le risque en corrigeant cela est SYMÉTRIQUE, et c'est lui que ces contrôles
 * surveillent : ouvrir la racine ne doit rien ouvrir d'autre. Une règle de
 * protection qui saute est invisible — la page s'affiche, tout paraît
 * fonctionner, et c'est précisément le symptôme d'une porte restée ouverte.
 *
 * Les six essais du cahier des charges, dans l'ordre.
 */
import { readFileSync, readdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
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

const marque = Date.now()
const mdp = `Epreuve!${marque}`
let cabinetId, userId, navigateur, echecs = 0

const v = (intitule, obtenu, attendu) => {
  const ok = String(obtenu) === String(attendu)
  if (!ok) echecs++
  console.log(`  ${ok ? "✓" : "✗"} ${intitule.padEnd(54)} ${String(obtenu).slice(0, 30)}` +
    (ok ? "" : `   ATTENDU ${attendu}`))
}

/** Le chemin où l'on ATTERRIT, quelles que soient les redirections traversées. */
const ou = (page) => new URL(page.url()).pathname

/**
 * Ouvrir une session, en composant avec l'hydratation.
 *
 * ─── LE PIÈGE, ET POURQUOI DEUX CORRECTIFS ONT ÉCHOUÉ AVANT CELUI-CI ───────
 *
 * Le champ existe dès que le HTML arrive, mais React n'est pas encore vivant.
 * Remplir à cet instant pose la valeur dans le DOM sans qu'aucun `onChange` ne
 * parte : l'état du composant reste vide, et `disabled={!email.trim()}` garde
 * le bouton fermé.
 *
 * Premier correctif tenté — attendre que le bouton s'active : il ne s'active
 * jamais, puisque rien n'a mis à jour l'état.
 *
 * Deuxième — relire la valeur après l'avoir écrite : elle est bien là, et c'est
 * précisément le problème. Une page non hydratée conserve ce qu'on lui écrit ;
 * la relecture confirme donc le DOM, jamais React.
 *
 * LE SEUL TÉMOIN FIABLE EST LE BOUTON LUI-MÊME. Il ne s'ouvre que si un
 * composant vivant a reçu la saisie. On remplit donc jusqu'à ce qu'il réponde.
 */
async function ouvrirSession(page, courriel, mdp) {
  await page.waitForSelector("#email", { timeout: 30000 })
  const bouton = page.locator('button[type="submit"]')

  for (let essai = 0; essai < 40; essai++) {
    await page.fill("#email", courriel)
    await page.fill("#password", mdp)
    await page.waitForTimeout(300)
    if (!(await bouton.isDisabled())) {
      await bouton.click()
      return
    }
  }
  throw new Error("Le formulaire de connexion ne s'est jamais activé.")
}

/** La page rendue est-elle bien l'accueil public ? */
const estLaLanding = (page) =>
  page.locator("#pricing").count().then((n) => n > 0)

try {
  const { data: cab } = await admin.from("firms").insert({
    name: `Cabinet racine ${marque}`,
    rcic_license_number: `R222${String(marque).slice(-4)}`,
    owner_name: "Épreuve", email: `rac-${marque}@example.invalid`,
    plan: "cabinet", status: "active",
  }).select("id").single()
  cabinetId = cab.id

  await admin.from("firm_subscriptions").insert({
    firm_id: cabinetId, plan: "cabinet", cadence: "monthly", seats: 3,
    status: "active", stripe_customer_id: `cus_rac_${marque}`,
  })

  const courriel = `membre-${marque}@example.invalid`
  const { data: u } = await admin.auth.admin.createUser({
    email: courriel, password: mdp, email_confirm: true,
  })
  userId = u.user.id
  await admin.from("profiles").insert({
    firm_id: cabinetId, user_id: userId, email: courriel,
    full_name: "Membre d'épreuve", cicc_role: "owner",
  })

  navigateur = await chromium.launch()

  // ── ESSAIS 1 À 3 : LE VISITEUR ANONYME ──────────────────────────────────
  // Contexte neuf, donc sans cookie : c'est la navigation privée du cahier
  // des charges.
  const anonyme = await navigateur.newContext({ viewport: { width: 1440, height: 900 } })
  const p1 = await anonyme.newPage()

  console.log("\nEssai 1 — la racine, sans compte")
  await p1.goto(`${BASE}/`, { waitUntil: "domcontentloaded" })
  await p1.waitForTimeout(600)
  v("elle n'envoie PAS vers la connexion", ou(p1).includes("connexion"), false)
  v("on atterrit sur la racine localisée", ou(p1), "/fr")
  v("et c'est bien la page publique", await estLaLanding(p1), true)

  console.log("\nEssai 2 — la connexion garde sa route")
  await p1.goto(`${BASE}/fr/connexion`, { waitUntil: "domcontentloaded" })
  v("la page répond", ou(p1), "/fr/connexion")
  v("elle porte un champ de mot de passe",
    await p1.locator('input[type="password"]').count() > 0, true)

  console.log("\nEssai 3 — le privé reste fermé")
  for (const chemin of ["/fr/dashboard", "/fr/clients", "/fr/fideicommis", "/fr/portal"]) {
    await p1.goto(`${BASE}${chemin}`, { waitUntil: "domcontentloaded" })
    v(`${chemin} renvoie à la connexion`, ou(p1), "/fr/connexion")
  }

  console.log("\nEssai 4 — la console d'exploitation, sans compte")
  await p1.goto(`${BASE}/fr/admin`, { waitUntil: "domcontentloaded" })
  v("/fr/admin renvoie à la connexion", ou(p1), "/fr/connexion")
  await anonyme.close()

  // ── ESSAIS 4 (SUITE), 5 ET 6 : LE MEMBRE CONNECTÉ ───────────────────────
  const connecte = await navigateur.newContext({ viewport: { width: 1440, height: 900 } })
  const p2 = await connecte.newPage()

  await p2.goto(`${BASE}/fr/connexion`, { waitUntil: "domcontentloaded" })
  await ouvrirSession(p2, courriel, mdp)
  await p2.waitForURL(/\/fr\/dashboard/, { timeout: 30000 }).catch(() => {})
  await p2.waitForTimeout(1500)

  console.log("\nEssai 4 bis — un membre ordinaire n'entre pas dans la console")
  await p2.goto(`${BASE}/fr/admin`, { waitUntil: "domcontentloaded" })
  await p2.waitForTimeout(800)
  v("il est renvoyé chez lui, pas vers la connexion", ou(p2), "/fr/dashboard")

  console.log("\nEssai 5 — la racine ne casse pas la session")
  await p2.goto(`${BASE}/`, { waitUntil: "domcontentloaded" })
  await p2.waitForTimeout(600)
  v("la page publique s'affiche", await estLaLanding(p2), true)
  // LE CONTRÔLE QUI COMPTE : la session survit-elle à ce passage ? Si la
  // racine effaçait le cookie, on ne s'en apercevrait qu'à la page suivante.
  await p2.goto(`${BASE}/fr/dashboard`, { waitUntil: "domcontentloaded" })
  await p2.waitForTimeout(1200)
  v("le tableau de bord reste accessible ensuite", ou(p2), "/fr/dashboard")

  console.log("\nEssai 6 — après déconnexion, la racine reste publique")
  await p2.evaluate(async () => {
    await fetch("/api/auth/sign-out", { method: "POST" })
  })
  await p2.goto(`${BASE}/`, { waitUntil: "domcontentloaded" })
  await p2.waitForTimeout(800)
  v("on reste sur la page publique", ou(p2), "/fr")
  v("et non sur la connexion", ou(p2).includes("connexion"), false)
  await p2.goto(`${BASE}/fr/dashboard`, { waitUntil: "domcontentloaded" })
  await p2.waitForTimeout(600)
  v("le privé s'est bien refermé", ou(p2), "/fr/connexion")

  await connecte.close()

  // ── L'ADRESSE CANONIQUE ─────────────────────────────────────────────────
  // La même page répond à deux adresses depuis que la racine la sert. Sans
  // canonique, un moteur les traite comme deux pages au contenu identique.
  console.log("\nLes deux adresses de la page publique s'accordent")
  const p3 = await (await navigateur.newContext()).newPage()
  await p3.goto(`${BASE}/fr/landing`, { waitUntil: "domcontentloaded" })
  const canon = await p3.locator('link[rel="canonical"]').getAttribute("href").catch(() => null)
  v("/fr/landing se déclare doublon de la racine", (canon ?? "").endsWith("/fr"), true)
  await p3.goto(`${BASE}/fr`, { waitUntil: "domcontentloaded" })
  v("la racine ne se déclare doublon de rien",
    await p3.locator('link[rel="canonical"]').count(), 0)

} finally {
  if (navigateur) await navigateur.close()
  if (userId) await admin.auth.admin.deleteUser(userId)
  if (cabinetId) await admin.rpc("purger_cabinet_epreuve", { p_firm_id: cabinetId })
  console.log("\nCabinet et compte d'épreuve supprimés.")
}

console.log(echecs === 0
  ? "\n✓ La racine est publique et le privé est resté fermé, 0 échec."
  : `\n✗ ${echecs} échec(s).`)
process.exit(echecs === 0 ? 0 : 1)
