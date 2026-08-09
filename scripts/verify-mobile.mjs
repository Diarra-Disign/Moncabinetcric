#!/usr/bin/env node
/**
 * Éprouve l'application sur un écran de téléphone.
 *
 *   ./cric mobile                                (serveur local)
 *   ./cric mobile --url=https://moncabinetcric.com
 *
 * ---------------------------------------------------------------------------
 * POURQUOI CE CONTRÔLE EXISTE
 * ---------------------------------------------------------------------------
 * Deux défauts vivaient depuis des semaines sur toutes les tailles de
 * téléphone, et aucune relecture de code ne pouvait les révéler :
 *
 *   1. Le tiroir de navigation s'ouvrait ÉCRASÉ à la hauteur de la barre
 *      supérieure. On y voyait le logo et la croix, pas un seul lien. La cause
 *      n'était pas dans le composant du tiroir mais dans un ANCÊTRE : la barre
 *      porte `backdrop-blur`, et un `backdrop-filter` fait de l'élément un bloc
 *      conteneur pour ses descendants en `position: fixed`. Le `inset-0` du
 *      tiroir se résolvait donc contre 64 pixels.
 *
 *   2. La barre supérieure débordait de 74 à 184 pixels selon l'appareil, et
 *      c'est le menu du membre — donc la déconnexion — qui sortait de l'écran.
 *
 * Les deux se voient en une seconde sur un vrai rendu, et jamais autrement :
 * le DOM contenait les quatorze liens, et chaque composant, lu isolément,
 * était correct.
 *
 * Le script monte un cabinet d'épreuve, s'y connecte pour de bon, mesure, puis
 * supprime tout.
 */

import fs from "node:fs"
import { randomBytes } from "node:crypto"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

/**
 * Playwright est une dépendance transitive : elle n'est pas liée à la racine
 * de node_modules. On la retrouve dans le magasin pnpm sans figer sa version,
 * qu'une mise à jour changerait.
 */
async function chargerChromium() {
  const magasin = join(ROOT, "node_modules/.pnpm")
  const dossier = fs
    .readdirSync(magasin)
    .find((d) => /^playwright@/.test(d))
  if (!dossier) {
    throw new Error("Playwright introuvable. Installer avec : pnpm add -D playwright")
  }
  const mod = await import(join(magasin, dossier, "node_modules/playwright/index.mjs"))
  return mod.chromium
}

const env = Object.fromEntries(
  fs.readFileSync(join(ROOT, ".env.local"), "utf8").split("\n")
    .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)).filter(Boolean)
    .map((m) => [m[1], m[2].trim()])
)

const arg = process.argv.find((a) => a.startsWith("--url="))
const BASE = (arg ? arg.slice(6) : "http://localhost:3000").replace(/\/+$/, "")

/** Les largeurs réelles des appareils les plus répandus, plus un cas étroit. */
const LARGEURS = [320, 360, 375, 390, 414, 430]

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

let echecs = 0
function verifier(intitule, obtenu, attendu) {
  const ok = String(obtenu) === String(attendu)
  if (!ok) echecs++
  console.log(
    `  ${ok ? "✓" : "✗"} ${intitule.padEnd(46)} ${String(obtenu).padEnd(10)}` +
      (ok ? "" : ` ATTENDU ${attendu}`)
  )
}

async function main() {
  const chromium = await chargerChromium()
  const marque = Date.now()
  const mdp = "Epreuve-" + randomBytes(9).toString("base64url")
  const courriel = `mobile-${marque}@example.invalid`
  let cabinetId, userId, navigateur

  console.log(`Rendu mobile — ${BASE}\n`)

  try {
    const { data: cab, error: e1 } = await admin.from("firms").insert({
      name: `Cabinet mobile ${marque}`,
      rcic_license_number: `R888${String(marque).slice(-4)}`,
      owner_name: "Épreuve", email: courriel, plan: "cabinet", status: "active",
    }).select("id").single()
    if (e1) throw new Error(`Cabinet : ${e1.message}`)
    cabinetId = cab.id

    await admin.from("firm_subscriptions").insert({
      firm_id: cabinetId, plan: "cabinet", cadence: "monthly", seats: 3,
      status: "active", stripe_customer_id: `cus_mobile_${marque}`,
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

    navigateur = await chromium.launch({ channel: "chrome" })
    const ctx = await navigateur.newContext({
      viewport: { width: 375, height: 812 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    })
    const page = await ctx.newPage()

    await page.goto(`${BASE}/fr/connexion`, { waitUntil: "networkidle" })
    await page.fill('input[type="email"]', courriel)
    await page.fill('input[type="password"]', mdp)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/fr(\/|$)/, { timeout: 30000 }).catch(() => {})
    await page.waitForTimeout(3500)

    // -----------------------------------------------------------------------
    console.log("Le tiroir de navigation")
    // -----------------------------------------------------------------------
    await page.click('button[aria-label="Ouvrir le menu"]')
    await page.waitForTimeout(700)

    const tiroir = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]')
      if (!d) return { present: false }
      const b = d.getBoundingClientRect()
      const liens = [...d.querySelectorAll("a")]
      // Un lien n'est « vu » que s'il occupe une surface DANS l'écran. Le
      // défaut d'origine laissait les quatorze liens dans le DOM, rognés hors
      // d'un conteneur haut de 64 pixels : les compter n'aurait rien prouvé.
      const visibles = liens.filter((a) => {
        const r = a.getBoundingClientRect()
        return r.width > 0 && r.height > 0 && r.top < window.innerHeight && r.bottom > 0
      })
      return {
        present: true,
        hauteur: Math.round(b.height),
        hauteurEcran: window.innerHeight,
        liens: liens.length,
        liensVus: visibles.length,
      }
    })

    verifier("le tiroir s'ouvre", tiroir.present, true)
    verifier("il occupe toute la hauteur", tiroir.hauteur, tiroir.hauteurEcran)
    verifier("des liens de navigation sont visibles", tiroir.liensVus > 0, true)
    console.log(`     (${tiroir.liens} liens, ${tiroir.liensVus} à l'écran sans défiler)`)

    await page.keyboard.press("Escape")
    await page.waitForTimeout(400)

    // -----------------------------------------------------------------------
    console.log("\nLa barre supérieure, par largeur d'appareil")
    // -----------------------------------------------------------------------
    for (const w of LARGEURS) {
      await page.setViewportSize({ width: w, height: 800 })
      await page.waitForTimeout(350)
      const r = await page.evaluate(() => {
        const h = document.querySelector("header")
        const boutons = [...h.querySelectorAll("button")]
        const dernier = boutons[boutons.length - 1]
        const b = dernier?.getBoundingClientRect()
        return {
          deborde: h.scrollWidth - Math.round(h.getBoundingClientRect().width),
          dernierDedans: b ? b.x >= 0 && b.right <= window.innerWidth && b.width > 0 : false,
        }
      })
      verifier(`${w} px — la barre ne déborde pas`, r.deborde, 0)
      verifier(`${w} px — le menu du membre est atteignable`, r.dernierDedans, true)
    }
  } finally {
    if (navigateur) await navigateur.close().catch(() => {})
    if (cabinetId) await admin.from("firms").delete().eq("id", cabinetId)
    if (userId) await admin.auth.admin.deleteUser(userId).catch(() => {})
    console.log("\nCabinet et compte d'épreuve supprimés.")
  }

  console.log(echecs === 0 ? "\n✓ Rendu mobile vérifié, 0 échec." : `\n✗ ${echecs} échec(s).`)
  process.exit(echecs === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error("\nÉchec :", e.message)
  process.exit(1)
})
