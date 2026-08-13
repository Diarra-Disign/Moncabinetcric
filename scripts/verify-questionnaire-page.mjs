#!/usr/bin/env node
/**
 * Ouvre un vrai questionnaire par son lien, dans un vrai navigateur.
 *
 * La question à laquelle ce script répond est simple : chaque question du
 * modèle donne-t-elle bien au destinataire un endroit où répondre ? Compter
 * les champs en base ne le prouverait pas — un champ peut exister dans le
 * JSON et n'être rendu par aucune branche du composant, ce qui ne se verrait
 * qu'à l'usage, sur le questionnaire d'un vrai client.
 *
 * On vérifie donc trois choses, dans l'ordre :
 *   1. autant de zones de saisie que de questions, section par section ;
 *   2. ce que le destinataire tape ARRIVE en base (l'enregistrement
 *      automatique est différé : s'il ne partait pas, l'écran donnerait
 *      pourtant l'illusion d'avoir gardé la réponse) ;
 *   3. la mention « déjà connu » disparaît dès qu'il corrige.
 */
import { readFileSync, readdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { randomBytes, createHash } from "node:crypto"
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
  console.log(`  ${ok ? "✓" : "✗"} ${intitule.padEnd(48)} ${String(obtenu).slice(0, 34).padEnd(12)}` +
    (ok ? "" : ` ATTENDU ${attendu}`))
}

const marque = Date.now()
const mdp = "Epreuve-" + randomBytes(9).toString("base64url")
let cabinetId, userId, navigateur

try {
  const { data: cab, error: e1 } = await admin.from("firms").insert({
    name: `Cabinet réponse ${marque}`,
    rcic_license_number: `R444${String(marque).slice(-4)}`,
    owner_name: "Épreuve", email: `rep-${marque}@example.invalid`,
    plan: "cabinet", status: "active",
  }).select("id").single()
  if (e1) throw new Error(`Cabinet : ${e1.message}`)
  cabinetId = cab.id

  // Le VRAI modèle de préconsultation, celui qui est amorcé en base — et non
  // une maquette écrite pour l'occasion, qui ne prouverait que d'elle-même.
  const { data: modele } = await admin
    .from("questionnaire_templates")
    .select("id, title_fr, sections")
    .is("firm_id", null).eq("slug", "preconsultation").single()

  const attendus = modele.sections.flatMap((s) => s.fields)
  console.log(`\nModèle éprouvé : ${modele.title_fr}`)
  console.log(`${modele.sections.length} sections, ${attendus.length} questions\n`)

  const { data: prospect } = await admin.from("leads").insert({
    firm_id: cabinetId, name: "Awa Diallo", email: `awa-${marque}@example.invalid`,
    phone: "+1 514 555 0199", type: "b2c", visa_type: "Permis d'études",
    estimated_value: 2500, score: 70, score_label: "med", stage: "newLead",
    last_contact: new Date().toISOString().slice(0, 10), notes: "",
  }).select("id").single()

  const jeton = randomBytes(32).toString("base64url")
  const empreinte = createHash("sha256").update(jeton).digest("hex")

  // Un second envoi, portant UNE question de chaque type que l'éditeur offre.
  //
  // C'est le seul contrôle qui attrape un type qu'on accepte d'enregistrer et
  // qu'on ne sait pas afficher. « checkbox » était exactement ce cas : présent
  // dans l'union TypeScript, sans branche de rendu, il serait tombé dans le
  // cas générique et se serait affiché en zone de texte libre.
  const jetonTypes = randomBytes(32).toString("base64url")
  const TYPES_ATTENDUS = [
    { type: "text", labelFr: "Votre nom complet", controle: 'input[type="text"]' },
    { type: "number", labelFr: "Nombre de personnes", controle: 'input[type="number"]' },
    { type: "date", labelFr: "Date d'arrivée souhaitée", controle: 'input[type="date"]' },
    { type: "select", labelFr: "Province visée", controle: "select" },
    { type: "radio", labelFr: "Déjà refusé par IRCC ?", controle: "button" },
    { type: "file", labelFr: "Passeport", controle: "p" },
  ]
  const { data: envoiTypes } = await admin.from("client_questionnaires").insert({
    firm_id: cabinetId, lead_id: prospect.id, template_id: modele.id,
    title: "Tous les types de question",
    sections: [{ id: "types", titleFr: "Tous les types", titleEn: "Every type",
      fields: TYPES_ATTENDUS.map((t, i) => ({
        key: `q${i}`, labelFr: t.labelFr, labelEn: t.labelFr, type: t.type, required: false,
        ...(t.type === "select" || t.type === "radio"
          ? { options: [
              { value: "oui", labelFr: "Oui", labelEn: "Yes" },
              { value: "non", labelFr: "Non", labelEn: "No" },
            ] }
          : {}),
      })) }],
    status: "sent", sent_at: new Date().toISOString(),
    token_hash: createHash("sha256").update(jetonTypes).digest("hex"),
  }).select("id").single()

  const { data: envoi } = await admin.from("client_questionnaires").insert({
    firm_id: cabinetId, lead_id: prospect.id,
    template_id: modele.id, title: modele.title_fr,
    sections: modele.sections,
    prefill: { firstName: "Awa", email: `awa-${marque}@example.invalid` },
    status: "sent", sent_at: new Date().toISOString(), token_hash: empreinte,
  }).select("id").single()

  // Un consultant, pour éprouver l'autre bout du parcours : ce qui est
  // transmis doit être LISIBLE, faute de quoi tout ce qui précède n'aurait
  // servi à rien.
  const courrielConsultant = `consultant-${marque}@example.invalid`
  const { data: u } = await admin.auth.admin.createUser({
    email: courrielConsultant, password: mdp, email_confirm: true,
  })
  userId = u.user.id
  await admin.from("profiles").insert({
    firm_id: cabinetId, user_id: userId, email: courrielConsultant,
    full_name: "Consultant d'épreuve", cicc_role: "owner",
  })
  await admin.from("firm_subscriptions").insert({
    firm_id: cabinetId, plan: "cabinet", cadence: "monthly", seats: 3,
    status: "active", stripe_customer_id: `cus_rep_${marque}`,
  })

  navigateur = await chromium.launch({ channel: "chrome" })
  const page = await (await navigateur.newContext({ viewport: { width: 1280, height: 900 } })).newPage()

  const erreursConsole = []
  page.on("console", (m) => { if (m.type() === "error") erreursConsole.push(m.text()) })

  const rep = await page.goto(`${BASE}/fr/q/${jeton}`, { waitUntil: "domcontentloaded" })
  await page.waitForSelector("h1", { timeout: 30000 })
  verifier("la page s'ouvre", rep.status(), 200)
  verifier("le titre du questionnaire est affiché",
    (await page.textContent("h1"))?.trim(), modele.title_fr)

  // ---------------------------------------------------------------------
  console.log("\nUne zone de réponse par question, section par section")
  // ---------------------------------------------------------------------
  const onglets = await page.$$('nav button')
  verifier("un onglet par section", onglets.length, modele.sections.length)

  let totalRendus = 0
  for (let i = 0; i < modele.sections.length; i++) {
    const section = modele.sections[i]
    await onglets[i].click()
    await page.waitForTimeout(350)

    const rendus = await page.evaluate(() => {
      // Une « zone de réponse », c'est la carte qui porte l'étiquette de la
      // question : elle contient un champ, une liste, des boutons radio ou
      // un répéteur selon le type. Compter les <input> seuls sous-estimerait
      // les listes déroulantes et surestimerait les répéteurs.
      const cartes = [...document.querySelectorAll("section > div.rounded-xl")]
      return cartes.filter((c) => c.querySelector("label")).length
    })

    totalRendus += rendus
    verifier(`« ${section.titleFr.slice(0, 28)} »`, rendus, section.fields.length)
  }
  verifier("total des zones de réponse", totalRendus, attendus.length)

  // ---------------------------------------------------------------------
  console.log("\nChaque type de question offert par l'éditeur SAIT s'afficher")
  // ---------------------------------------------------------------------
  {
    const pageTypes = await (await navigateur.newContext()).newPage()
    await pageTypes.goto(`${BASE}/fr/q/${jetonTypes}`, { waitUntil: "domcontentloaded" })
    await pageTypes.waitForSelector("h1", { timeout: 30000 })
    await pageTypes.waitForTimeout(600)

    for (const t of TYPES_ATTENDUS) {
      const rendu = await pageTypes.evaluate((attendu) => {
        const etiquette = [...document.querySelectorAll("label")]
          .find((l) => (l.textContent ?? "").includes(attendu.labelFr))
        if (!etiquette) return "AUCUNE ÉTIQUETTE"
        const carte = etiquette.closest("div")
        if (!carte) return "AUCUNE CARTE"
        // Une zone de texte libre là où l'on attendait autre chose est le
        // symptôme exact du type non rendu : on le nomme.
        if (attendu.controle !== 'input[type="text"]' && carte.querySelector('input[type="text"]')) {
          return "ZONE DE TEXTE LIBRE"
        }
        return carte.querySelector(attendu.controle) ? "ok" : "MANQUANT"
      }, t)
      verifier(`« ${t.type} » se rend correctement`, rendu, "ok")
    }
    await pageTypes.close()
  }

  // ---------------------------------------------------------------------
  console.log("\nCe que le destinataire tape arrive en base")
  // ---------------------------------------------------------------------
  await onglets[0].click()
  await page.waitForTimeout(300)

  const champNom = await page.$('input[type="text"]')
  await champNom.fill("Diallo-Testé")
  // L'enregistrement est différé de 1,5 s après la dernière frappe.
  await page.waitForTimeout(3000)

  const { data: enBase } = await admin
    .from("client_questionnaires").select("answers, progress, status").eq("id", envoi.id).single()
  const valeurs = Object.values(enBase.answers ?? {}).map(String)
  verifier("la réponse saisie est enregistrée", valeurs.includes("Diallo-Testé"), true)
  verifier("le statut est passé « en cours »", enBase.status, "in_progress")
  verifier("la progression a bougé", enBase.progress > 0, true)

  // ---------------------------------------------------------------------
  console.log("\nLe pré-remplissage se signale, et se corrige")
  // ---------------------------------------------------------------------
  const mentions = await page.evaluate(() =>
    [...document.querySelectorAll("label span")].filter((s) => /déjà connu/i.test(s.textContent ?? "")).length
  )
  verifier("les champs pré-remplis sont signalés", mentions > 0, true)

  const champPrenom = await page.evaluate(() => {
    const labels = [...document.querySelectorAll("label")]
    const l = labels.find((x) => /Prénom/i.test(x.textContent ?? ""))
    return Boolean(l)
  })
  verifier("le prénom pré-rempli est présent", champPrenom, true)

  // ---------------------------------------------------------------------
  console.log("\nIl transmet — et le formulaire va quelque part")
  // ---------------------------------------------------------------------
  await page.click('button:has-text("Transmettre au cabinet")')
  await page.waitForTimeout(2500)

  const confirmation = await page.textContent("body")
  verifier("le destinataire voit une confirmation",
    /Questionnaire transmis/i.test(confirmation ?? "") ? "oui" : "non", "oui")

  const { data: apresEnvoi } = await admin
    .from("client_questionnaires").select("status, submitted_at").eq("id", envoi.id).single()
  verifier("le statut devient « soumis »", apresEnvoi.status, "submitted")
  verifier("la transmission est datée", apresEnvoi.submitted_at ? "oui" : "non", "oui")

  const { data: notif } = await admin.from("notifications")
    .select("title").eq("firm_id", cabinetId).eq("kind", "questionnaire_submitted")
  verifier("le cabinet est notifié", (notif ?? []).length, 1)

  // ---------------------------------------------------------------------
  console.log("\nLe consultant lit les réponses depuis son écran")
  // ---------------------------------------------------------------------
  const pageCab = await (await navigateur.newContext({ viewport: { width: 1440, height: 950 } })).newPage()
  await pageCab.goto(`${BASE}/fr/connexion`, { waitUntil: "domcontentloaded" })
  await pageCab.waitForSelector('input[type="email"]', { timeout: 30000 })
  await pageCab.fill('input[type="email"]', courrielConsultant)
  await pageCab.fill('input[type="password"]', mdp)
  await pageCab.click('button[type="submit"]')
  await pageCab.waitForURL(/\/fr(\/|$)/, { timeout: 30000 }).catch(() => {})
  await pageCab.waitForTimeout(2500)

  await pageCab.goto(`${BASE}/fr/questionnaires`, { waitUntil: "domcontentloaded" })
  await pageCab.waitForSelector('h1', { timeout: 30000 })
  await pageCab.waitForTimeout(1500)

  await pageCab.click('button:has-text("Envoyés")')
  await pageCab.waitForTimeout(700)

  const listeEnvois = await pageCab.textContent("body")
  verifier("l'envoi figure dans « Envoyés »",
    /Awa Diallo/.test(listeEnvois ?? "") ? "oui" : "non", "oui")
  verifier("avec le statut « Soumis »", /Soumis/.test(listeEnvois ?? "") ? "oui" : "non", "oui")

  await pageCab.click('button:has-text("Voir les réponses")')
  await pageCab.waitForTimeout(900)

  const reponsesLues = await pageCab.evaluate(() => {
    const d = document.querySelector('div[class*="max-w-3xl"]')
    return d ? d.textContent ?? "" : ""
  })
  verifier("la réponse tapée est lisible par le consultant",
    /Diallo-Testé/.test(reponsesLues) ? "oui" : "non", "oui")
  verifier("les questions sans réponse sont montrées comme telles",
    /—/.test(reponsesLues) ? "oui" : "non", "oui")
  verifier("le pré-rempli non modifié est signalé",
    /pré-rempli, non modifié/i.test(reponsesLues) ? "oui" : "non", "oui")

  const erreursDures = erreursConsole.filter((e) => !/favicon|manifest|404/i.test(e))
  verifier("aucune erreur console", erreursDures.length, 0)
  if (erreursDures.length) erreursDures.slice(0, 3).forEach((e) => console.log(`     ${e.slice(0, 150)}`))
} finally {
  if (navigateur) await navigateur.close()
  if (cabinetId) await admin.rpc("purger_cabinet_epreuve", { p_firm_id: cabinetId })
  if (userId) await admin.auth.admin.deleteUser(userId)
  console.log("\nCabinet et compte d'épreuve supprimés.")
}

console.log(echecs === 0 ? "\n✓ Chaque question a sa zone de réponse, 0 échec." : `\n✗ ${echecs} échec(s).`)
process.exit(echecs === 0 ? 0 : 1)
