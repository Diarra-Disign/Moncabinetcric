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
import { exigerSupabase } from "./lib/environnement.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const env = Object.fromEntries(
  [...readFileSync(join(ROOT, ".env.local"), "utf8").matchAll(/^([A-Z0-9_]+)=(.*)$/gm)].map((m) => [m[1], m[2].trim()])
)

// Avant toute conclusion : l'application lit-elle la vraie base ? Sinon
// cette épreuve échouerait sur des données factices, et son verdict
// parlerait de l'environnement en croyant parler du produit.
exigerSupabase(env)

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
    // Les octets bruts sont ajoutés pour rattraper ce qui n'aurait pas été
    // décodé. C'est utile pour CHERCHER un mot, jamais pour affirmer qu'un
    // caractère est ABSENT : le binaire d'un PDF contient de tout.
    return lisible + octets.toString("latin1")
  }
  /** Le seul texte décodé, sans les octets bruts. Pour les preuves d'absence. */
  const texteSeul = (octets) => {
    const tout = lisiblePdf(octets)
    return tout.slice(0, tout.length - octets.length)
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
    // La refonte : ce que la capture de référence apporte et qui manquait.
    ["le montant dû, en en-tête", "MONTANT DÛ"],
    ["le TAUX de la TPS, pas que son montant", "5,000 %"],
    ["le taux de la TVQ à trois décimales", "9,975 %"],
    ["le solde dû, distinct du total", "SOLDE DÛ"],
    ["la pagination", "Page 1 sur 1"],
  ]) verifier(quoi, texte.includes(motif), true)

  // Les montants sont recalculés À LA MAIN, pour que le contrôle ne puisse
  // pas se contenter d'être d'accord avec un logiciel qui se tromperait :
  //   imposable     150 + 500        = 650,00
  //   non taxable   débours IRCC     = 235,00
  //   sous-total                     = 885,00
  //   TPS  650 x 5 %                 =  32,50
  //   TVQ  650 x 9,975 %             =  64,84   (64,8375 arrondi au cent)
  //   total                          = 982,34
  verifier("le sous-total imprimé", texte.includes("885,00"), true)
  verifier("la TPS calculée sur la seule part imposable", texte.includes("32,50"), true)
  verifier("la TVQ à trois décimales, arrondie au cent", texte.includes("64,84"), true)
  verifier("le total", texte.includes("982,34"), true)
  verifier("le débours n'est pas taxé", texte.includes("235,00"), true)

  // -----------------------------------------------------------------------
  console.log("\nUn nom que la police standard ne sait pas écrire")
  // -----------------------------------------------------------------------
  // C'est le défaut qui rendait le bouton « Voir le PDF » inerte : les polices
  // standard d'un PDF ne couvrent que le WinAnsi, et pdf-lib LÈVE sur tout
  // caractère hors de ce jeu. La route répondait 500. Pour un cabinet
  // d'immigration, une cliente nommée Nguyễn n'est pas un cas limite.
  const { data: c2 } = await admin.from("clients").insert({
    firm_id: cabinetId, name: "Nguyễn Thị Hồng Đào", email: `ng-${marque}@example.invalid`,
    file_number: "C-2", program: "PE", residence: "Hà Nội, Việt Nam",
    status: "active", client_type: "individual",
  }).select("id").single()
  const num2 = (await admin.rpc("next_invoice_number", { p_firm_id: cabinetId })).data
  const { data: inv2 } = await admin.from("invoices").insert({
    firm_id: cabinetId, client_id: c2.id, matter_id: m.id, invoice_number: num2,
    // BROUILLON d'abord : le verrou protect_issued_invoice refuse qu'on
    // garnisse une facture déjà émise, et il a raison. La fixture suit donc
    // le vrai chemin — créer, garnir, émettre.
    client_name: "Nguyễn Thị Hồng Đào", amount: 0, status: "draft",
    date: new Date().toISOString().slice(0, 10),
    service_description: "Dépôt — 100 % à l'acceptation ✅",
  }).select("id").single()
  const { error: eL2 } = await admin.from("invoice_lines").insert([
    { firm_id: cabinetId, invoice_id: inv2.id, description: "Honoraires — dossier Wojciechłąka", quantity: 1, unit_price: 400, taxable: true, position: 1 },
  ])
  if (eL2) throw new Error(`Lignes (2) : ${eL2.message}`)
  await admin.from("invoices").update({ status: "issued" }).eq("id", inv2.id)

  const repVn = await page.request.get(`${BASE}/api/invoices/${inv2.id}/pdf`)
  verifier("la facture se produit quand même", repVn.status(), 200)
  const texteVn = lisiblePdf(Buffer.from(await repVn.body()))
  // La romanisation ne touche QUE ce qui n'est pas imprimable : le « à » de
  // Dào est du latin-1, il reste tel quel. Un assainisseur qui aplatirait
  // aussi les accents français abîmerait les noms québécois sans raison.
  verifier("le nom est romanisé, pas perdu", texteVn.includes("Nguyen Thi Hong Dào"), true)
  verifier("le polonais aussi", texteVn.includes("Wojciechlaka"), true)
  verifier("le montant reste juste", texteVn.includes("459,90"), true)

  console.log("\nLe même document, en anglais")
  const repEn = await page.request.get(`${BASE}/api/invoices/${inv.id}/pdf?lang=en`)
  verifier("la route accepte la langue", repEn.status(), 200)
  const texteEn = lisiblePdf(Buffer.from(await repEn.body()))
  for (const [quoi, motif] of [
    ["le titre est traduit", "INVOICE"],
    ["le destinataire aussi", "BILLED TO"],
    ["le montant dû aussi", "AMOUNT DUE"],
    ["le solde dû aussi", "BALANCE DUE"],
    ["la taxe porte son nom canadien-anglais", "GST"],
    ["la pagination est traduite", "Page 1 of 1"],
  ]) verifier(quoi, texteEn.includes(motif), true)
  // Le format des nombres suit la langue : 5.000% et non 5,000 %.
  verifier("les nombres suivent la langue", texteEn.includes("5.000%"), true)
  verifier("aucun mot français ne subsiste", /FACTURÉ À|SOLDE DÛ/.test(texteEn), false)

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
    ["le solde restant", "SOLDE RESTANT"],
    ["la mention de fidéicommis", "fid\u00e9icommis"],
    ["le nom du cabinet", "Zenith Immigration"],
    // L'harmonie avec la facture : mêmes colonnes, même échelle de totaux,
    // même pied portant les numéros de taxe.
    ["l'en-tête de colonne Description", "Description"],
    ["la colonne Mode", "Mode"],
    ["la destination des fonds sur la ligne", "en fid"],
    ["le pied porte les numéros de taxe", "RT0001"],
    ["la pagination", "Page 1 sur 1"],
  ]) verifier(quoi, texteRecu.includes(motif), true)

  // Un « ? » dans un document signifie qu'un caractère n'a pas pu s'écrire.
  // Sur une pièce comptable, cela doit être un échec bruyant : c'est ainsi
  // qu'on a vu « ?300,00 $ » là où le signe moins typographique était employé.
  verifier("aucun caractère n'a été perdu", /\?/.test(texteSeul(octetsRecu)), false)

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
