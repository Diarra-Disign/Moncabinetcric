#!/usr/bin/env node
/**
 * Le compte en fidéicommis, de l'écriture jusqu'à l'état conforme.
 *
 * Ce module produit une pièce qu'une inspection professionnelle peut réclamer.
 * Les contrôles portent donc moins sur « l'écran s'affiche » que sur les trois
 * garanties qui font qu'un état vaut quelque chose :
 *
 *   — un solde débiteur est REFUSÉ, par la base et non par l'écran ;
 *   — un rapprochement ne s'arrête pas tant qu'un écart reste inexpliqué ;
 *   — un état arrêté ne se modifie plus.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { randomBytes } from "node:crypto"
import { inflateSync } from "node:zlib"
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
  console.log(`  ${ok ? "✓" : "✗"} ${intitule.padEnd(50)} ${String(obtenu).slice(0, 46)}` +
    (ok ? "" : `\n      ATTENDU ${attendu}`))
}

const marque = Date.now()
const mdp = "Epreuve-" + randomBytes(9).toString("base64url")
let cabinetId, userId, navigateur

try {
  const { data: cab, error: e1 } = await admin.from("firms").insert({
    name: `Cabinet fiducie ${marque}`,
    rcic_license_number: `R666${String(marque).slice(-4)}`,
    owner_name: "Épreuve", email: `fid-${marque}@example.invalid`,
    plan: "cabinet", status: "active", address: "1000 rue Sherbrooke O, Montréal",
  }).select("id").single()
  if (e1) throw new Error(`Cabinet : ${e1.message}`)
  cabinetId = cab.id

  await admin.from("firm_subscriptions").insert({
    firm_id: cabinetId, plan: "cabinet", cadence: "monthly", seats: 3,
    status: "active", stripe_customer_id: `cus_fid_${marque}`,
  })

  const courriel = `consultant-${marque}@example.invalid`
  const { data: u } = await admin.auth.admin.createUser({ email: courriel, password: mdp, email_confirm: true })
  userId = u.user.id
  await admin.from("profiles").insert({
    firm_id: cabinetId, user_id: userId, email: courriel,
    full_name: "Consultant d'épreuve", cicc_role: "owner",
  })

  const { data: c1 } = await admin.from("clients").insert({
    firm_id: cabinetId, name: "Awa Diallo", email: `a-${marque}@example.invalid`,
    file_number: "C-1", program: "PE", status: "active", client_type: "individual",
  }).select("id").single()
  const { data: c2 } = await admin.from("clients").insert({
    firm_id: cabinetId, name: "Marc Tremblay", email: `m-${marque}@example.invalid`,
    file_number: "C-2", program: "PT", status: "active", client_type: "individual",
  }).select("id").single()

  // -----------------------------------------------------------------------
  console.log("\nLa règle cardinale : jamais de solde débiteur")
  // -----------------------------------------------------------------------
  // Elle est tenue par un DÉCLENCHEUR, pas par l'écran. On l'éprouve donc en
  // écrivant directement en base, c'est-à-dire par le chemin qu'un script
  // d'importation ou une correction à la main emprunterait.
  await admin.from("trust_ledger").insert({
    firm_id: cabinetId, client_id: c1.id, entry_type: "deposit",
    amount: 5000, occurred_on: "2026-07-05", memo: "Acompte au mandat",
  })
  const { error: eDeb } = await admin.from("trust_ledger").insert({
    firm_id: cabinetId, client_id: c1.id, entry_type: "withdrawal",
    amount: 9000, occurred_on: "2026-07-10", memo: "Sortie excessive",
  })
  verifier("une sortie qui rendrait le solde débiteur est refusée", Boolean(eDeb), true)
  verifier("et le refus dit de combien", /débiteur|-4000/.test(String(eDeb?.message ?? "")), true)

  await admin.from("trust_ledger").insert([
    { firm_id: cabinetId, client_id: c1.id, entry_type: "withdrawal", amount: 1085, occurred_on: "2026-07-20", memo: "Frais IRCC" },
    { firm_id: cabinetId, client_id: c2.id, entry_type: "deposit", amount: 2000, occurred_on: "2026-07-12", memo: "Dépôt initial" },
  ])
  // 5000 − 1085 + 2000 = 5915
  const { data: solde } = await admin.rpc("firm_trust_balance", { f_id: cabinetId })
  verifier("le solde du cabinet est juste", Number(solde), 5915)

  navigateur = await chromium.launch({ channel: "chrome" })
  const page = await (await navigateur.newContext({ viewport: { width: 1440, height: 1000 } })).newPage()
  const erreursConsole = []
  page.on("console", (m) => { if (m.type() === "error") erreursConsole.push(m.text()) })
  page.on("pageerror", (e) => erreursConsole.push(String(e)))

  await page.goto(`${BASE}/fr/connexion`, { waitUntil: "domcontentloaded" })
  await page.waitForSelector('input[type="email"]', { timeout: 30000 })
  await page.fill('input[type="email"]', courriel)
  await page.fill('input[type="password"]', mdp)
  // Le bouton reste désactivé tant que le formulaire n'est pas hydraté.
  // Cliquer avant produisait un échec intermittent qu'on mettait sur le compte
  // de la lenteur ; on attend l'état, pas une durée.
  await page.waitForSelector('button[type="submit"]:not([disabled])', { timeout: 30000 })
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/fr(\/|$)/, { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(2500)

  // -----------------------------------------------------------------------
  console.log("\nL'écran du registre")
  // -----------------------------------------------------------------------
  await page.goto(`${BASE}/fr/fideicommis`, { waitUntil: "domcontentloaded" })
  await page.waitForSelector("h1", { timeout: 30000 })
  await page.waitForTimeout(1500)

  const vu = (await page.evaluate(() => document.body.innerText)).replace(/[\u00A0\u202F]/g, " ")
  verifier("le solde global est affiché", vu.includes("5 915,00"), true)
  verifier("la ventilation par client aussi", vu.includes("Awa Diallo") && vu.includes("Marc Tremblay"), true)
  verifier("le registre montre les écritures", vu.includes("Frais IRCC"), true)
  // Le §F25 : l'alerte doit se déclencher, aucun mois n'ayant jamais été arrêté.
  verifier("l'alerte de rapprochement en retard s'affiche", /jamais été arrêté|Aucun rapprochement/.test(vu), true)

  // -----------------------------------------------------------------------
  console.log("\nUn rapprochement ne s'arrête pas sur un écart inexpliqué")
  // -----------------------------------------------------------------------
  // Le relevé porte 6 415 $ : 500 $ de plus que le registre, parce qu'un
  // chèque de 500 $ n'a pas encore été encaissé.
  await page.click('button:has-text("Rapprocher une période")')
  await page.waitForTimeout(700)
  await page.fill('[role="dialog"] input[inputmode="decimal"]', "6415")
  await page.click('[role="dialog"] button:has-text("Enregistrer le rapprochement")')
  await page.waitForTimeout(2500)

  await page.click('button:has-text("Arrêter la période")')
  await page.waitForTimeout(2000)
  const refus = await page.evaluate(() => document.querySelector('[role="status"]')?.textContent ?? "")
  verifier("l'arrêt est refusé tant qu'il reste un écart", /n'explique pas|500,00/.test(refus), true)

  const { data: r0 } = await admin.from("trust_reconciliations").select("id, status").eq("firm_id", cabinetId).single()
  verifier("et le rapprochement reste un brouillon", r0.status, "draft")

  // -----------------------------------------------------------------------
  console.log("\nExpliqué, il s'arrête — et se fige")
  // -----------------------------------------------------------------------
  await admin.from("trust_reconciliations")
    .update({ explanations: [{ libelle: "Chèque n° 1234 en circulation", montant: -500 }] })
    .eq("id", r0.id)
  await page.reload({ waitUntil: "domcontentloaded" })
  await page.waitForTimeout(1800)
  await page.click('button:has-text("Arrêter la période")')
  await page.waitForTimeout(2500)

  const { data: r1 } = await admin.from("trust_reconciliations").select("status, ledger_balance, closed_at").eq("id", r0.id).single()
  verifier("le rapprochement est arrêté", r1.status, "closed")
  verifier("le solde du registre y est FIGÉ", Number(r1.ledger_balance), 5915)
  verifier("la date d'arrêt est posée", Boolean(r1.closed_at), true)

  // Une écriture postérieure ne doit PAS changer l'état déjà arrêté : c'est
  // toute la raison d'être d'un constat daté.
  await admin.from("trust_ledger").insert({
    firm_id: cabinetId, client_id: c2.id, entry_type: "deposit", amount: 777, occurred_on: "2026-08-03",
  })
  const { data: r2 } = await admin.from("trust_reconciliations").select("ledger_balance").eq("id", r0.id).single()
  verifier("une écriture postérieure ne réécrit pas le passé", Number(r2.ledger_balance), 5915)

  const { error: eFige } = await admin.from("trust_reconciliations").update({ bank_balance: 1 }).eq("id", r0.id)
  verifier("un état arrêté refuse toute retouche", Boolean(eFige), true)

  // -----------------------------------------------------------------------
  console.log("\nL'état conforme, en PDF")
  // -----------------------------------------------------------------------
  const rep = await page.request.get(`${BASE}/api/trust/${r0.id}/statement`)
  verifier("la route répond", rep.status(), 200)
  verifier("c'est un PDF", rep.headers()["content-type"], "application/pdf")

  const octets = Buffer.from(await rep.body())
  const lisiblePdf = (o) => {
    let sortie = "", i = 0
    while ((i = o.indexOf("stream", i)) !== -1) {
      let d = i + 6
      if (o[d] === 0x0d) d++
      if (o[d] === 0x0a) d++
      const f = o.indexOf("endstream", d)
      if (f === -1) break
      try { sortie += inflateSync(o.subarray(d, f)).toString("latin1") } catch { sortie += o.subarray(d, f).toString("latin1") }
      i = f + 9
    }
    return sortie.replace(/<([0-9A-Fa-f]{4,})>/g, (_, h) => Buffer.from(h, "hex").toString("latin1"))
  }
  const texte = lisiblePdf(octets)
  for (const [quoi, motif] of [
    ["le titre", "ÉTAT DE RAPPROCHEMENT"],
    ["le nom du cabinet", "Cabinet fiducie"],
    ["le solde du relevé", "6 415,00"],
    ["le solde du registre", "5 915,00"],
    ["l'élément qui explique l'écart", "1234"],
    ["l'écart résiduel, imprimé même à zéro", "ÉCART RÉSIDUEL"],
    ["la ventilation par client", "VENTILATION PAR CLIENT"],
    ["l'attestation", "J'atteste"],
    ["la pagination", "Page 1 sur 1"],
  ]) verifier(quoi, texte.includes(motif), true)
  verifier("aucun caractère perdu", /\?/.test(texte), false)

  writeFileSync("/tmp/rapprochement-epreuve.pdf", octets)
  console.log("     État écrit dans /tmp/rapprochement-epreuve.pdf")

  const anonyme = await (await navigateur.newContext()).newPage()
  const vol = await anonyme.request.get(`${BASE}/api/trust/${r0.id}/statement`)
  verifier("sans session, l'état est refusé", vol.status(), 404)

  const dures = erreursConsole.filter((e) => !/favicon|manifest|404/i.test(e))
  verifier("aucune erreur console", dures.length, 0)
  if (dures.length) dures.slice(0, 3).forEach((e) => console.log(`     ${e.slice(0, 200)}`))

  // =======================================================================
  console.log("\nLe registre mensuel — le scénario complet, mois après mois")
  // =======================================================================
  //
  // C'est la question à laquelle tout ce module doit répondre : « combien
  // est-ce que je détiens pour chaque client, ce mois-ci ? »
  //
  // Le scénario suit un client sur quatre mois, parce que c'est la SUITE des
  // mois qui porte la difficulté, pas un mois isolé :
  //
  //   avril    rien                                    → absent
  //   mai      dépôt 3 500, retrait 2 000              → clôture 1 500
  //   juin     aucun mouvement                         → ouverture ET clôture 1 500
  //   juillet  retrait 1 500                           → clôture 0
  //   août     rien                                    → ABSENT des soldes actifs
  //   septembre nouveau dépôt 1 000                    → RÉAPPARAÎT
  //
  // Juin est le mois qui casse une implémentation naïve : sans mouvement, un
  // GROUP BY sur les écritures de la période ne produit aucune ligne, et le
  // client détenteur de 1 500 $ disparaît du registre alors que le cabinet
  // détient toujours son argent. C'est l'erreur exacte qu'il faut prévenir.

  const { data: cReg } = await admin.from("clients").insert({
    firm_id: cabinetId, name: "Jean Tremblay", email: `jt-reg-${marque}@example.invalid`,
    file_number: "C-REG", program: "RP", status: "active", client_type: "individual",
  }).select("id").single()

  const mois = async (debut, fin) => {
    const { data, error } = await admin.rpc("firm_trust_monthly_register", {
      f_id: cabinetId, p_start: debut, p_end: fin,
    })
    if (error) return { erreur: error.message, lignes: [] }
    return { lignes: data ?? [] }
  }
  const ligneDe = (r, id) => (r.lignes ?? []).find((l) => l.client_id === id)

  await admin.from("trust_ledger").insert([
    { firm_id: cabinetId, client_id: cReg.id, entry_type: "deposit", amount: 3500, occurred_on: "2026-05-02", memo: "Paiement anticipé" },
    { firm_id: cabinetId, client_id: cReg.id, entry_type: "transfer_to_business", amount: 2000, occurred_on: "2026-05-15", memo: "Services rendus" },
  ])

  const mai = await mois("2026-05-01", "2026-05-31")
  if (mai.erreur) console.log(`     (la fonction manque : ${mai.erreur})`)
  const lMai = ligneDe(mai, cReg.id)
  verifier("mai — le client figure au registre", Boolean(lMai), true)
  verifier("mai — solde d'ouverture", lMai?.opening ?? "—", "0.00")
  verifier("mai — dépôts du mois", lMai?.deposits ?? "—", "3500.00")
  verifier("mai — retraits du mois", lMai?.withdrawals ?? "—", "2000.00")
  verifier("mai — solde de clôture", lMai?.closing ?? "—", "1500.00")

  // Le mois SANS mouvement. La clôture de mai doit devenir l'ouverture de juin,
  // et le client doit rester visible : le cabinet détient toujours ses fonds.
  const juin = await mois("2026-06-01", "2026-06-30")
  const lJuin = ligneDe(juin, cReg.id)
  verifier("juin — le client reste visible sans aucun mouvement", Boolean(lJuin), true)
  verifier("juin — l'ouverture reprend la clôture de mai", lJuin?.opening ?? "—", "1500.00")
  verifier("juin — aucun dépôt", lJuin?.deposits ?? "—", "0.00")
  verifier("juin — la clôture est inchangée", lJuin?.closing ?? "—", "1500.00")

  await admin.from("trust_ledger").insert({
    firm_id: cabinetId, client_id: cReg.id, entry_type: "transfer_to_business",
    amount: 1500, occurred_on: "2026-07-20", memo: "Solde des honoraires",
  })

  const juillet = await mois("2026-07-01", "2026-07-31")
  const lJuil = ligneDe(juillet, cReg.id)
  verifier("juillet — le client figure, le mois où il tombe à zéro", Boolean(lJuil), true)
  verifier("juillet — solde de clôture nul", lJuil?.closing ?? "—", "0.00")

  // §7, §31, §32 : à zéro et sans mouvement, le client sort de la liste.
  const aout = await mois("2026-08-01", "2026-08-31")
  verifier("août — le client à zéro N'APPARAÎT PLUS", Boolean(ligneDe(aout, cReg.id)), false)

  // §8 : mais son histoire reste entière.
  const { data: histoire } = await admin
    .from("trust_ledger").select("id").eq("client_id", cReg.id)
  verifier("août — son historique est intact", histoire?.length ?? 0, 3)

  // §9 : un nouveau dépôt le ramène, sans geste particulier.
  await admin.from("trust_ledger").insert({
    firm_id: cabinetId, client_id: cReg.id, entry_type: "deposit",
    amount: 1000, occurred_on: "2026-09-08", memo: "Nouveau mandat",
  })
  const septembre = await mois("2026-09-01", "2026-09-30")
  const lSept = ligneDe(septembre, cReg.id)
  verifier("septembre — le client RÉAPPARAÎT de lui-même", Boolean(lSept), true)
  verifier("septembre — ouverture à zéro", lSept?.opening ?? "—", "0.00")
  verifier("septembre — clôture au nouveau dépôt", lSept?.closing ?? "—", "1000.00")

  // §33 : le total du registre doit égaler le solde du cabinet. Un registre
  // dont la somme ne retombe pas sur le solde ne vaut rien.
  const { data: soldeCabinet } = await admin.rpc("firm_trust_balance", { f_id: cabinetId })
  const totalRegistre = (septembre.lignes ?? [])
    .reduce((s, l) => s + Number(l.closing), 0)
    .toFixed(2)
  verifier("§33 — la somme des clôtures égale le solde du cabinet",
    totalRegistre, Number(soldeCabinet).toFixed(2))
} finally {
  if (navigateur) await navigateur.close()
  if (cabinetId) await admin.rpc("purger_cabinet_epreuve", { p_firm_id: cabinetId })
  if (userId) await admin.auth.admin.deleteUser(userId)
  console.log("\nCabinet et compte d'épreuve supprimés.")
}

console.log(echecs === 0 ? "\n✓ Le fidéicommis tient, 0 échec." : `\n✗ ${echecs} échec(s).`)
process.exit(echecs === 0 ? 0 : 1)
