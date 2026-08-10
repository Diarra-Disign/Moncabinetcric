#!/usr/bin/env node
/**
 * Produit un vrai PDF de facture et l'inspecte.
 *
 * Vérifier que la route répond 200 ne prouverait rien : un PDF vide, sans
 * montant ni nom de cabinet, répond 200 lui aussi. On lit donc le contenu —
 * la présence des mots attendus dans le flux de texte du document.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { randomBytes } from "node:crypto"
import { inflateSync } from "node:zlib"
import { createClient } from "@supabase/supabase-js"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const env = Object.fromEntries(
  [...readFileSync(join(ROOT, ".env.local"), "utf8").matchAll(/^([A-Z0-9_]+)=(.*)$/gm)].map((m) => [m[1], m[2].trim()])
)
const magasin = join(ROOT, "node_modules/.pnpm")
const pw = readdirSync(magasin).find((d) => /^playwright@/.test(d))
const { chromium } = await import(join(magasin, pw, "node_modules/playwright/index.mjs"))
const arg = process.argv.find((a) => a.startsWith("--url="))
const BASE = (arg ? arg.slice(6) : "http://localhost:3000").replace(/\/+$/, "")
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

let echecs = 0
const verifier = (i, o, a) => {
  const ok = String(o) === String(a)
  if (!ok) echecs++
  console.log(`  ${ok ? "✓" : "✗"} ${i.padEnd(46)} ${String(o).slice(0, 34)}` + (ok ? "" : `   ATTENDU ${a}`))
}

const marque = Date.now()
const mdp = "Epreuve-" + randomBytes(9).toString("base64url")
let cabinetId, userId, navigateur
try {
  const { data: cab } = await admin.from("firms").insert({
    name: `Zenith Immigration ${marque}`, rcic_license_number: `R888${String(marque).slice(-4)}`,
    owner_name: "Me Épreuve", email: `z-${marque}@example.invalid`, phone: "+1 514 555 0100",
    address: "1000 rue Sherbrooke O, Montréal", plan: "cabinet", status: "active",
    tax_gst_number: "123456789 RT0001", tax_qst_number: "1234567890 TQ0001",
    payment_terms: "Paiement dû sous 30 jours. Virement Interac accepté.",
  }).select("id").single()
  cabinetId = cab.id
  await admin.from("firm_subscriptions").insert({
    firm_id: cabinetId, plan: "cabinet", cadence: "monthly", seats: 3, status: "active",
    stripe_customer_id: `cus_pdf_${marque}`,
  })
  const courriel = `consultant-${marque}@example.invalid`
  const { data: u } = await admin.auth.admin.createUser({ email: courriel, password: mdp, email_confirm: true })
  userId = u.user.id
  await admin.from("profiles").insert({ firm_id: cabinetId, user_id: userId, email: courriel, full_name: "Me Épreuve", cicc_role: "owner" })
  const { data: c } = await admin.from("clients").insert({
    firm_id: cabinetId, name: "Awa Diallo", email: `awa-${marque}@example.invalid`,
    file_number: "C-1", program: "PE", residence: "Dakar, Sénégal", status: "active", client_type: "individual",
  }).select("id").single()
  const { data: m } = await admin.from("matters").insert({
    firm_id: cabinetId, client_id: c.id, reference: `ZEN-2026-00001`, client_name: "Awa Diallo",
    client_type: "b2c", program: "PE", category: "study", rcic: "Me Épreuve", status: "pending",
  }).select("id").single()
  const num = (await admin.rpc("next_invoice_number", { p_firm_id: cabinetId })).data
  const { data: inv, error: eInv } = await admin.from("invoices").insert({
    firm_id: cabinetId, client_id: c.id, matter_id: m.id, invoice_number: num, client_name: "Awa Diallo",
    amount: 0, date: new Date().toISOString().slice(0, 10), status: "draft",
    due_on: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
  }).select("id").single()
  if (eInv) throw new Error(`Facture : ${eInv.message}`)
  const { error: eL } = await admin.from("invoice_lines").insert([
    { firm_id: cabinetId, invoice_id: inv.id, description: "Consultation initiale en immigration", quantity: 1, unit_price: 150, taxable: true, position: 1 },
    { firm_id: cabinetId, invoice_id: inv.id, description: "Analyse du dossier", quantity: 1, unit_price: 500, taxable: true, position: 2 },
    { firm_id: cabinetId, invoice_id: inv.id, description: "Débours IRCC", quantity: 1, unit_price: 235, taxable: false, position: 3 },
  ])
  if (eL) throw new Error(`Lignes : ${eL.message}`)

  await admin.from("invoices").update({ status: "issued" }).eq("id", inv.id)

  navigateur = await chromium.launch({ channel: "chrome" })
  const page = await (await navigateur.newContext()).newPage()
  await page.goto(`${BASE}/fr/connexion`, { waitUntil: "domcontentloaded" })
  await page.waitForSelector('input[type="email"]', { timeout: 30000 })
  await page.fill('input[type="email"]', courriel)
  await page.fill('input[type="password"]', mdp)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/fr(\/|$)/, { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(2500)

  console.log("\nLe PDF de la facture")
  const rep = await page.request.get(`${BASE}/api/invoices/${inv.id}/pdf`)
  verifier("la route répond", rep.status(), 200)
  verifier("c'est bien un PDF", rep.headers()["content-type"], "application/pdf")
  verifier("il s'ouvre dans l'onglet", /^inline/.test(rep.headers()["content-disposition"] ?? "") ? "inline" : "téléchargé", "inline")

  const octets = Buffer.from(await rep.body())
  verifier("le fichier n'est pas vide", octets.length > 2000, true)
  verifier("l'en-tête PDF est valide", octets.subarray(0, 5).toString(), "%PDF-")

  /**
   * Le texte d'un PDF n'est PAS lisible en clair : pdf-lib comprime les flux
   * de contenu (/FlateDecode). Chercher « Zenith » dans les octets bruts
   * renvoyait faux sur un document parfaitement rempli — le contrôle
   * échouait, et c'est lui qui avait tort.
   */
  const lisiblePdf = (octets) => {
    let sortie = ""
    let i = 0
    while ((i = octets.indexOf("stream", i)) !== -1) {
      let debut = i + 6
      if (octets[debut] === 0x0d) debut++
      if (octets[debut] === 0x0a) debut++
      const fin = octets.indexOf("endstream", debut)
      if (fin === -1) break
      try {
        sortie += inflateSync(octets.subarray(debut, fin)).toString("latin1")
      } catch {
        sortie += octets.subarray(debut, fin).toString("latin1")
      }
      i = fin + 9
    }
    // pdf-lib écrit les chaînes en HEXADÉCIMAL : <5A656E697468> est « Zenith ».
    // Chercher le mot en clair échouait donc sur un document parfaitement
    // rempli — deux fois de suite, le contrôle avait tort et le PDF raison.
    const lisible = sortie.replace(/<([0-9A-Fa-f]{4,})>/g, (_, hex) =>
      Buffer.from(hex, "hex").toString("latin1"))
    return lisible + octets.toString("latin1")
  }
  const texte = lisiblePdf(octets)
  for (const [quoi, motif] of [
    ["le nom du cabinet", "Zenith Immigration"],
    ["son adresse", "Sherbrooke"],
    ["son numéro de permis CRIC", "R888"],
    ["le numéro de facture", String(num)],
    ["le nom du client", "Awa Diallo"],
    ["la référence du dossier", "ZEN-2026-00001"],
    ["la première ligne de service", "Consultation initiale"],
    ["le débours non taxable", "non taxable"],
    ["le numéro de TPS", "RT0001"],
    ["les conditions de paiement", "30 jours"],
  ]) verifier(quoi, texte.includes(motif), true)

  const chemin = "/tmp/facture-epreuve.pdf"
  writeFileSync(chemin, octets)
  console.log(`\n     PDF écrit dans ${chemin} (${Math.round(octets.length / 1024)} Ko) — ouvre-le pour juger la mise en page.`)

  console.log("\nCloisonnement")
  const anonyme = await (await navigateur.newContext()).newPage()
  const anonyme2 = anonyme
  const vol = await anonyme.request.get(`${BASE}/api/invoices/${inv.id}/pdf`)
  verifier("sans session, la facture est refusée", vol.status(), 404)

  console.log("\nLe reçu du paiement")
  const { data: pay, error: eP } = await admin.from("payments").insert({
    firm_id: cabinetId, client_id: c.id, matter_id: m.id, invoice_id: inv.id,
    amount: 300, paid_on: new Date().toISOString().slice(0, 10),
    method: "interac", reference: "INT-88213", destination: "trust",
    notes: "Acompte à la signature du mandat.",
  }).select("id").single()
  if (eP) throw new Error(`Paiement : ${eP.message}`)

  const rec = await page.request.get(`${BASE}/api/payments/${pay.id}/receipt`)
  verifier("la route du reçu répond", rec.status(), 200)
  verifier("c'est un PDF", rec.headers()["content-type"], "application/pdf")

  const octetsRecu = Buffer.from(await rec.body())
  const texteRecu = lisiblePdf(octetsRecu)
  for (const [quoi, motif] of [
    ["le titre REÇU", "RE\u00c7U"],
    ["le montant reçu", "300"],
    ["le mode de paiement", "Interac"],
    ["la référence", "INT-88213"],
    ["le nom du client", "Awa Diallo"],
    ["la facture rattachée", String(num)],
    ["le solde restant", "Solde restant"],
    ["la mention de fidéicommis", "fid\u00e9icommis"],
    ["le nom du cabinet", "Zenith Immigration"],
  ]) verifier(quoi, texteRecu.includes(motif), true)

  writeFileSync("/tmp/recu-epreuve.pdf", octetsRecu)
  console.log("     Reçu écrit dans /tmp/recu-epreuve.pdf")

  const volRecu = await anonyme2.request.get(`${BASE}/api/payments/${pay.id}/receipt`)
  verifier("sans session, le reçu est refusé", volRecu.status(), 404)

  // -----------------------------------------------------------------------
  console.log("\nLe reçu s'envoie comme une facture")
  // -----------------------------------------------------------------------
  // Le reçu n'avait qu'un lien « Reçu PDF » : on pouvait le regarder, jamais
  // le transmettre. Il porte maintenant les mêmes gestes qu'une facture, et
  // donc la même règle — le clic PRÉPARE, la fenêtre exécute.
  // La fiche s'ouvre par la RÉFÉRENCE du dossier, pas par son identifiant :
  // c'est ce que porte l'adresse que voit le consultant.
  await page.goto(`${BASE}/fr/matters/ZEN-2026-00001`, { waitUntil: "domcontentloaded" })
  await page.waitForSelector("h1", { timeout: 30000 })
  await page.click('button:has-text("Paiements")')
  await page.waitForTimeout(1500)

  const gestes = await page.evaluate(() => {
    const zone = document.body.innerText
    return {
      paiementVisible: /INT-88213/.test(zone),
      voir: /Voir le PDF/.test(zone),
      envoyer: /Envoyer au client/.test(zone),
    }
  })
  verifier("le paiement figure dans l'onglet", gestes.paiementVisible, true)
  verifier("le reçu offre « Voir le PDF »", gestes.voir, true)
  verifier("le reçu offre « Envoyer au client »", gestes.envoyer, true)

  // On vise la LIGNE du paiement par sa référence, qui n'appartient qu'à lui.
  // Prendre « le dernier bouton Envoyer au client » de la page ouvrait en fait
  // celui de la facture, et le contrôle passait sur le mauvais document.
  const ligneDuPaiement = page.locator("div.rounded-2xl").filter({ hasText: "INT-88213" }).first()
  await ligneDuPaiement.getByRole("button", { name: "Envoyer au client" }).click()
  await page.waitForTimeout(800)

  const vuRecu = await page.evaluate(() => document.querySelector('[role="dialog"]')?.textContent ?? "")
  console.log(`     La fenêtre dit : « ${vuRecu.replace(/\s+/g, " ").slice(0, 220)} »`)
  verifier("l'envoi du reçu demande confirmation", /Confirmer l'envoi/.test(vuRecu), true)
  verifier("il nomme le destinataire", /Awa Diallo/.test(vuRecu), true)
  verifier("il montre le montant encaissé", /300/.test(vuRecu), true)
  // Un reçu n'écrit rien et ne fige rien : l'avertissement rouge serait un
  // mensonge, et l'habitude de le voir partout finirait par le rendre muet
  // là où il compte.
  verifier("il n'annonce AUCUNE irréversibilité", /irréversible|cessera|figé/i.test(vuRecu), false)

  await page.click('[role="dialog"] button:has-text("Annuler")')
  await page.waitForTimeout(500)
  const ferme = await page.evaluate(() => !document.querySelector('[role="dialog"]'))
  verifier("Annuler referme sans rien envoyer", ferme, true)

} finally {
  if (navigateur) await navigateur.close()
  if (cabinetId) await admin.from("firms").delete().eq("id", cabinetId)
  if (userId) await admin.auth.admin.deleteUser(userId)
  console.log("\nCabinet et compte d'épreuve supprimés.")
}
console.log(echecs === 0 ? "\n✓ PDF de facture vérifié, 0 échec." : `\n✗ ${echecs} échec(s).`)
process.exit(echecs === 0 ? 0 : 1)
