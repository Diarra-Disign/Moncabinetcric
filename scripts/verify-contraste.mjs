#!/usr/bin/env node
/**
 * Mesure le contraste réel des pastilles de statut, sous CHAQUE thème.
 *
 * Relire les classes ne prouve rien : `bg-primary/10 text-primary` peut être
 * excellent sous un thème et illisible sous un autre, puisque les deux
 * viennent du même jeton, qui change. La seule preuve est la couleur
 * CALCULÉE par le navigateur, composée sur le fond réel de la carte.
 *
 * Le seuil retenu est 4,5:1 — celui de WCAG AA pour du texte normal. Les
 * pastilles sont en petits caractères gras, pour lesquels 3:1 suffirait ;
 * viser plus haut laisse une marge à qui lit sur un portable en plein jour.
 */
import { readFileSync, readdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { randomBytes, createHash } from "node:crypto"
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

const THEMES = ["sapphire", "emerald", "amber", "purple", "midnight"]
const SEUIL = 4.5

let echecs = 0
const verifier = (intitule, ratio) => {
  const ok = ratio >= SEUIL
  if (!ok) echecs++
  console.log(`  ${ok ? "✓" : "✗"} ${intitule.padEnd(40)} ${ratio.toFixed(2)}:1` + (ok ? "" : `   SOUS LE SEUIL ${SEUIL}`))
}

const marque = Date.now()
const mdp = "Epreuve-" + randomBytes(9).toString("base64url")
let cabinetId, userId, navigateur

/** Les états qu'un consultant voit réellement dans sa liste. */
const ETATS = ["sent", "opened", "in_progress", "submitted", "to_correct", "corrected", "completed", "cancelled"]

try {
  const { data: cab, error: e1 } = await admin.from("firms").insert({
    name: `Cabinet contraste ${marque}`,
    rcic_license_number: `R222${String(marque).slice(-4)}`,
    owner_name: "Épreuve", email: `ctr-${marque}@example.invalid`,
    plan: "cabinet", status: "active",
  }).select("id").single()
  if (e1) throw new Error(`Cabinet : ${e1.message}`)
  cabinetId = cab.id

  await admin.from("firm_subscriptions").insert({
    firm_id: cabinetId, plan: "cabinet", cadence: "monthly", seats: 3,
    status: "active", stripe_customer_id: `cus_ctr_${marque}`,
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

  // Un envoi par état, pour que la liste les montre tous à la fois.
  for (const etat of ETATS) {
    const { data: l } = await admin.from("leads").insert({
      firm_id: cabinetId, name: `Prospect ${etat}`, email: `${etat}-${marque}@example.invalid`,
      phone: "", type: "b2c", visa_type: "Permis d'études", estimated_value: 0,
      score: 50, score_label: "med", stage: "newLead",
      last_contact: new Date().toISOString().slice(0, 10), notes: "",
    }).select("id").single()

    const { error: eq } = await admin.from("client_questionnaires").insert({
      firm_id: cabinetId, lead_id: l.id, title: `Épreuve ${etat}`,
      sections: [], status: etat,
      token_hash: createHash("sha256").update(randomBytes(32).toString("hex")).digest("hex"),
    })
    if (eq) console.log(`  ! état ${etat} non créé : ${eq.message}`)
  }

  navigateur = await chromium.launch({ channel: "chrome" })
  const page = await (await navigateur.newContext({ viewport: { width: 1440, height: 1200 } })).newPage()

  await page.goto(`${BASE}/fr/connexion`, { waitUntil: "domcontentloaded" })
  await page.waitForSelector('input[type="email"]', { timeout: 30000 })
  await page.fill('input[type="email"]', courriel)
  await page.fill('input[type="password"]', mdp)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/fr(\/|$)/, { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(2500)

  await page.goto(`${BASE}/fr/questionnaires`, { waitUntil: "domcontentloaded" })
  await page.waitForSelector("h1", { timeout: 30000 })
  await page.waitForTimeout(1200)
  await page.click('button:has-text("Envoyés")')
  await page.waitForTimeout(800)

  const attendus = await admin.from("client_questionnaires").select("status").eq("firm_id", cabinetId)
  console.log(`\n${(attendus.data ?? []).length} envois en base, à retrouver à l'écran.`)

  for (const theme of THEMES) {
    console.log(`\nThème « ${theme} »`)
    await page.evaluate((t) => document.documentElement.setAttribute("data-cabinet-theme", t), theme)
    await page.waitForTimeout(400)

    const mesures = await page.evaluate(() => {
      // Les couleurs sont LUES PAR LE NAVIGATEUR, pas analysées à la main.
      //
      // Le premier jet cherchait « rgb( » dans le style calculé. Or Tailwind v4
      // exprime ses opacités en color-mix, que Chrome sérialise en oklab(…) :
      // l'expression régulière ne trouvait rien, retournait null, et le
      // programme SAUTAIT la pastille sans rien dire. Six sur huit n'étaient
      // pas mesurées, et le rapport annonçait pourtant « vérifié ».
      //
      // Un canvas accepte n'importe quelle syntaxe CSS et compose lui-même :
      // on peint le fond, puis la couleur par-dessus, et on lit le pixel. Ce
      // qu'on mesure est alors exactement ce que l'œil reçoit.
      const cv = document.createElement("canvas")
      cv.width = cv.height = 1
      const ctx = cv.getContext("2d", { willReadFrequently: true })

      const peindre = (couches) => {
        ctx.clearRect(0, 0, 1, 1)
        for (const c of couches) {
          ctx.fillStyle = c
          ctx.fillRect(0, 0, 1, 1)
        }
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
        return { r, g, b }
      }

      const luminance = ({ r, g, b }) => {
        const f = (v) => {
          const s = v / 255
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
        }
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
      }
      const ratio = (a, b) => {
        const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x)
        return (l1 + 0.05) / (l2 + 0.05)
      }

      const fondPage = getComputedStyle(document.body).backgroundColor

      const resultats = []
      for (const badge of document.querySelectorAll("article span.rounded-full")) {
        const texte = (badge.textContent ?? "").trim()
        if (!texte) continue
        const st = getComputedStyle(badge)
        const carte = badge.closest("article")
        const fondCarte = getComputedStyle(carte).backgroundColor

        // Empilement réel : page, carte, pastille — puis le texte par-dessus.
        const fond = peindre([fondPage, fondCarte, st.backgroundColor])
        const encre = peindre([fondPage, fondCarte, st.backgroundColor, st.color])
        resultats.push({ texte, ratio: ratio(encre, fond) })
      }
      return resultats
    })

    if (mesures.length === 0) {
      console.log("  ✗ aucune pastille trouvée")
      echecs++
    }
    for (const m of mesures) verifier(m.texte, m.ratio)
  }
} finally {
  if (navigateur) await navigateur.close()
  if (cabinetId) await admin.from("firms").delete().eq("id", cabinetId)
  if (userId) await admin.auth.admin.deleteUser(userId)
  console.log("\nCabinet et compte d'épreuve supprimés.")
}

console.log(echecs === 0 ? "\n✓ Contraste vérifié sous les 5 thèmes, 0 échec." : `\n✗ ${echecs} pastille(s) sous le seuil.`)
process.exit(echecs === 0 ? 0 : 1)
