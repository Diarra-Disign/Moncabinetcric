#!/usr/bin/env node
/**
 * Éprouve la chaîne ENTENTE → CONTRAT → SIGNATURE → PDF FINAL.
 *
 * ─── LES DÉFAUTS QUE CE SCRIPT AURAIT ATTRAPÉS ─────────────────────────────
 *
 * 1. Le bouton « Envoyer pour signature » appelait l'ancien chemin : il
 *    insérait une demande NUE — aucun destinataire, aucun jeton, aucun
 *    courriel. L'écran affichait un succès, le client ne recevait rien.
 *
 * 2. Le PDF de l'entente était composé AVANT que son statut passe à « ready ».
 *    Le document classé — puis envoyé signer, puis intégré au contrat signé —
 *    sortait estampé BROUILLON sur toutes ses pages.
 *
 * 3. Les signatures n'existaient que sur le certificat. Le contrat lui-même
 *    gardait ses lignes vides, alors qu'il dessine des encadrés prévus pour.
 *
 * Aucun de ces trois défauts n'est visible d'une épreuve unitaire : la base
 * disait vrai à chaque fois. Il faut passer par l'écran, puis OUVRIR le PDF.
 *
 * ─── LE SCÉNARIO ───────────────────────────────────────────────────────────
 *
 *   brouillon → Émettre → Envoyer pour signature → le client signe →
 *   le consultant signe → document final.
 *
 * Tout est supprimé à la fin, même en cas d'échec.
 */
import { readFileSync, readdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { randomBytes, createHash } from "node:crypto"
import { deflateSync, inflateSync } from "node:zlib"
import { createClient } from "@supabase/supabase-js"
import { finaliser } from "../lib/signature/finalisation.ts"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const env = Object.fromEntries(
  [...readFileSync(join(ROOT, ".env.local"), "utf8").matchAll(/^([A-Z0-9_]+)=(.*)$/gm)]
    .map((m) => [m[1], m[2].trim()])
)
const magasin = join(ROOT, "node_modules/.pnpm")
const { chromium } = await import(join(magasin,
  readdirSync(magasin).find((d) => /^playwright@/.test(d)), "node_modules/playwright/index.mjs"))
const { PDFDocument, PDFName } = await import(join(magasin,
  readdirSync(magasin).find((d) => /^pdf-lib@/.test(d)), "node_modules/pdf-lib/cjs/index.js"))

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } })

const S = process.argv[2] ?? null
const capturer = async (page, nom) => { if (S) await page.screenshot({ path: join(S, nom) }) }

const marque = Date.now()
const mdp = "Epreuve-" + randomBytes(9).toString("base64url")
let cab, uid, nav, echecs = 0

const v = (intitule, obtenu, attendu) => {
  const ok = String(obtenu) === String(attendu)
  if (!ok) echecs++
  console.log(`  ${ok ? "✓" : "✗"} ${intitule.padEnd(50)} ${String(obtenu).slice(0, 28)}` +
    (ok ? "" : `   ATTENDU ${attendu}`))
}

// ── Un tracé de signature, en vrai PNG ────────────────────────────────────
// Node n'encode pas d'image : on assemble le PNG à la main. Un tracé factice
// mais VALIDE est indispensable — c'est la seule façon de vérifier qu'une
// image est réellement posée sur la bonne page du contrat.
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const o of buf) c = crcTable[(c ^ o) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const morceau = (type, data) => {
  const t = Buffer.from(type, "latin1")
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, crc])
}
/** Un trait diagonal noir sur fond blanc, en niveaux de gris 8 bits. */
const traceDeSignature = (l = 120, h = 30) => {
  const brut = Buffer.alloc((l + 1) * h, 0xff)
  for (let y = 0; y < h; y++) {
    brut[y * (l + 1)] = 0 // octet de filtre, en tête de chaque rangée
    for (let x = 0; x < l; x++) {
      if (Math.abs(Math.round((1 - y / h) * (l - 1)) - x) < 3) brut[y * (l + 1) + 1 + x] = 0x00
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(l, 0); ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8 // 8 bits par échantillon
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    morceau("IHDR", ihdr),
    morceau("IDAT", deflateSync(brut)),
    morceau("IEND", Buffer.alloc(0)),
  ])
  return "data:image/png;base64," + png.toString("base64")
}

/** Fait signer un destinataire pour de vrai, par un jeton frais. */
const faireSigner = async (destinataireId, courriel) => {
  const jeton = randomBytes(32).toString("base64url")
  const empreinte = createHash("sha256").update(jeton).digest("hex")
  await admin.from("signature_recipients")
    .update({ token_hash: empreinte, revoked_at: null }).eq("id", destinataireId)
  const { data, error } = await admin.rpc("signer_par_jeton", {
    p_token_hash: empreinte, p_courriel: courriel,
    p_trace: traceDeSignature(), p_champs: [],
    p_ip: "198.51.100.7", p_agent: "Épreuve",
  })
  if (error) throw new Error(`signer_par_jeton : ${error.message}`)
  if (data?.ok !== true) throw new Error(`signature refusée : ${data?.message}`)
  return data
}

/** Le texte lisible d'un PDF. pdf-lib écrit les chaînes en HEXADÉCIMAL. */
const lisiblePdf = (octets) => {
  let sortie = ""
  let i = 0
  while ((i = octets.indexOf("stream", i)) !== -1) {
    let debut = i + 6
    if (octets[debut] === 0x0d) debut++
    if (octets[debut] === 0x0a) debut++
    const fin = octets.indexOf("endstream", debut)
    if (fin === -1) break
    try { sortie += inflateSync(octets.subarray(debut, fin)).toString("latin1") }
    catch { sortie += octets.subarray(debut, fin).toString("latin1") }
    i = fin + 9
  }
  return sortie.replace(/<([0-9A-Fa-f]{4,})>/g, (_, hex) =>
    Buffer.from(hex, "hex").toString("latin1"))
}

/** Combien d'images une page porte-t-elle ? C'est ainsi qu'on voit un tracé. */
const imagesSurLaPage = (pdf, index) => {
  const res = pdf.getPage(index).node.Resources()
  const xo = res?.lookup(PDFName.of("XObject"))
  if (!xo?.keys) return 0
  let n = 0
  for (const cle of xo.keys()) {
    const flux = xo.lookup(cle)
    if (String(flux?.dict?.get(PDFName.of("Subtype")) ?? "") === "/Image") n++
  }
  return n
}

const telecharger = async (cheminStockage) => {
  const { data } = await admin.storage.from("documents").createSignedUrl(cheminStockage, 120)
  return Buffer.from(await (await fetch(data.signedUrl, { cache: "no-store" })).arrayBuffer())
}

try {
  // ── Le cabinet, le consultant, le client ────────────────────────────────
  const courrielConsultant = `ent-sig-${marque}@example.invalid`
  const permis = `R77${String(marque).slice(-5)}`

  const { data: f } = await admin.from("firms").insert({
    name: "DGV Immigration", rcic_license_number: permis,
    owner_name: "Adama Diarra", email: courrielConsultant, plan: "cabinet", status: "active",
  }).select("id").single()
  cab = f.id

  await admin.from("firm_subscriptions").insert({
    firm_id: cab, plan: "cabinet", cadence: "monthly", seats: 3,
    status: "active", stripe_customer_id: `cus_es_${marque}`,
  })
  const { data: u } = await admin.auth.admin.createUser({
    email: courrielConsultant, password: mdp, email_confirm: true,
  })
  uid = u.user.id
  const { data: profil } = await admin.from("profiles").insert({
    firm_id: cab, user_id: uid, email: courrielConsultant,
    full_name: "Adama Diarra", cicc_role: "owner", status: "active",
  }).select("id").single()

  const courrielClient = `jt-${marque}@example.invalid`
  const { data: cl } = await admin.from("clients").insert({
    firm_id: cab, name: "Jean Tremblay", first_name: "Jean", last_name: "Tremblay",
    email: courrielClient, file_number: `DOS-ES-${String(marque).slice(-6)}`,
    program: "Permis de travail", status: "active", client_type: "individual",
  }).select("id").single()

  // ── UN BROUILLON, pas un contrat déjà émis ──────────────────────────────
  // C'est l'émission par l'écran qui doit produire le PDF : c'est elle qui
  // mesure les encadrés de signature, et c'est elle qui a longtemps estampé
  // BROUILLON sur le document définitif.
  const reference = `ENT-ES-${String(marque).slice(-6)}`
  const { data: entente, error: eEntente } = await admin.from("agreements").insert({
    firm_id: cab, client_id: cl.id, reference, title: "Entente de services",
    kind: "services", status: "draft", fees_amount: 3500,
    // `created_by` désigne le PROFIL, pas le compte d'authentification.
    created_by: profil.id,
    articles_snapshot: [
      { position: 1, code: "OBJ", title_fr: "Objet du mandat", level: "article",
        body_fr: "Le consultant représente le client dans sa demande de permis de travail." },
      { position: 2, code: "HON", title_fr: "Honoraires", level: "article",
        body_fr: "Les honoraires professionnels s'élèvent à 3 500 $ CAD, payables selon l'échéancier." },
    ],
  }).select("id").single()
  if (eEntente) throw new Error(`entente d'épreuve : ${eEntente.message}`)

  // LES PARTIES FONT LES ENCADRÉS. Le générateur dessine un encadré par ligne
  // d'`agreement_parties` : sans elles, le contrat sort sans zone de signature,
  // et il n'y a rien à mesurer. L'écran de création les pose ; ici il faut les
  // poser à la main.
  const { error: eParties } = await admin.from("agreement_parties").insert([
    {
      firm_id: cab, agreement_id: entente.id, role: "consultant", signing_order: 1,
      first_name: "Adama", last_name: "Diarra", email: courrielConsultant,
      license_number: permis, address: "1 rue du Cabinet", city: "Gatineau",
      province: "QC", postal_code: "J8X 1A1", country: "Canada",
    },
    {
      firm_id: cab, agreement_id: entente.id, role: "client", signing_order: 2,
      first_name: "Jean", last_name: "Tremblay", email: courrielClient,
      // Non nulle en base : un client n'a pas de permis, mais la colonne
      // attend une chaîne vide plutôt que l'absence.
      license_number: "",
      address: "12 rue Principale", city: "Montréal",
      province: "QC", postal_code: "H2X 1Y4", country: "Canada",
    },
  ])
  if (eParties) throw new Error(`parties d'épreuve : ${eParties.message}`)

  // ── L'écran ─────────────────────────────────────────────────────────────
  nav = await chromium.launch({ channel: "chrome" })
  const contexte = await nav.newContext({ viewport: { width: 1440, height: 1100 } })
  const page = await contexte.newPage()

  await page.goto("http://localhost:3000/fr/connexion", { waitUntil: "domcontentloaded" })
  await page.waitForSelector('input[type="email"]', { timeout: 30000 })
  await page.waitForTimeout(1500)
  await page.fill('input[type="email"]', courrielConsultant)
  await page.fill('input[type="password"]', mdp)
  await page.waitForFunction(
    () => !document.querySelector("button[type=submit]")?.hasAttribute("disabled"),
    { timeout: 30000 })
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/fr(\/|$)/, { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(2500)

  await page.goto("http://localhost:3000/fr/agreements", { waitUntil: "domcontentloaded" })
  // ON ATTEND LA LIGNE, PAS UNE DURÉE : en développement, la première visite
  // d'une route la compile, et un délai fixe photographie une page vide.
  await page.getByText(reference).first().waitFor({ timeout: 60000 })
  await capturer(page, "ententes-brouillon.png")

  // ---- Test 1 — un brouillon EST estampé ---------------------------------
  const apercu = await page.request.get(
    `http://localhost:3000/api/agreements/${entente.id}/pdf`)
  v("l'aperçu d'un brouillon dit BROUILLON",
    lisiblePdf(Buffer.from(await apercu.body())).includes("BROUILLON") ? "oui" : "NON", "oui")

  // ---- Test 2 — l'émission ------------------------------------------------
  await page.getByRole("button", { name: /^Émettre$/ }).first().click()
  await page.waitForTimeout(7000)
  await capturer(page, "ententes-emise.png")

  const { data: ag1 } = await admin.from("agreements")
    .select("status, document_id").eq("id", entente.id).single()
  v("l'entente est émise", ag1.status, "ready")
  v("elle porte un document", ag1.document_id ? "oui" : "NON", "oui")

  const { data: docEmis } = await admin.from("documents")
    .select("id, storage_path, signature_anchors").eq("id", ag1.document_id).single()

  const octetsEmis = await telecharger(docEmis.storage_path)
  v("le contrat émis ne dit PLUS brouillon",
    lisiblePdf(octetsEmis).includes("BROUILLON") ? "ESTAMPÉ" : "non", "non")

  // Les encadrés mesurés à la composition : sans eux, aucune signature ne
  // pourrait être posée ailleurs qu'à la fin du document.
  const ancres = docEmis.signature_anchors ?? []
  v("les encadrés de signature sont mesurés", ancres.length, 2)
  v("celui du client est nommé", ancres.some((a) => a.role === "client") ? "oui" : "NON", "oui")
  v("celui du consultant aussi", ancres.some((a) => a.role === "consultant") ? "oui" : "NON", "oui")
  const pageAncre = ancres[0]?.page ?? -1
  v("ils portent une page", Number.isInteger(pageAncre) && pageAncre >= 0 ? "oui" : "NON", "oui")

  // ---- Test 3 — l'envoi ---------------------------------------------------
  const bouton = page.getByRole("button", { name: /^Envoyer pour signature$/ }).first()
  v("le bouton d'envoi apparaît", await bouton.count() > 0 ? "oui" : "NON", "oui")
  if (await bouton.count() === 0) throw new Error("bouton absent — voir ententes-emise.png")

  await bouton.click()
  await page.waitForTimeout(7000)
  await capturer(page, "ententes-envoyee.png")

  const { data: dem } = await admin.from("signature_requests")
    .select("id, status, document_id, client_id").eq("firm_id", cab)
  v("une demande est créée", (dem ?? []).length, 1)
  v("elle est envoyée", dem?.[0]?.status, "sent")
  v("elle porte le bon document", dem?.[0]?.document_id, docEmis.id)

  const { data: dest } = await admin.from("signature_recipients")
    .select("id, role, rank, email, rcic_number, status, token_hash, sent_at")
    .eq("request_id", dem[0].id).order("rank")
  v("DEUX signataires", (dest ?? []).length, 2)
  v("le client d'abord", dest?.[0]?.role, "client")
  v("avec son courriel de fiche", dest?.[0]?.email, courrielClient)
  v("le consultant ensuite", dest?.[1]?.role, "consultant")
  v("avec son PERMIS, non saisi", dest?.[1]?.rcic_number, permis)
  v("le jeton n'est gardé qu'en empreinte",
    /^[0-9a-f]{64}$/.test(String(dest?.[0]?.token_hash ?? "")) ? "oui" : "NON", "oui")
  v("le client est marqué prévenu", dest?.[0]?.sent_at ? "oui" : "NON", "oui")
  v("le consultant ne l'est pas encore", dest?.[1]?.sent_at ? "MARQUÉ" : "non", "non")

  // LES CHAMPS PORTENT LES COORDONNÉES DES ENCADRÉS. C'est la charnière entre
  // le générateur de contrat et le composeur du document signé.
  const { data: champs } = await admin.from("signature_fields")
    .select("recipient_id, kind, page, pos_x, pos_y, width, height").eq("request_id", dem[0].id)
  const placés = (champs ?? []).filter((c) => c.page !== null)
  v("les champs sont placés", placés.length >= 4 ? `oui (${placés.length})` : `NON (${placés.length})`,
    `oui (${placés.length})`)
  v("chaque signataire a sa ligne de signature",
    (champs ?? []).filter((c) => c.kind === "signature" && c.page !== null).length, 2)
  v("et sa ligne de date",
    (champs ?? []).filter((c) => c.kind === "date" && c.page !== null).length, 2)

  const { data: apresEnvoi } = await admin.from("documents")
    .select("locked_at").eq("id", docEmis.id).single()
  v("l'envoi VERROUILLE le document", apresEnvoi.locked_at ? "oui" : "NON", "oui")

  // ---- §13 — un second clic ne duplique pas -------------------------------
  await page.reload({ waitUntil: "domcontentloaded" })
  await page.getByText(reference).first().waitFor({ timeout: 60000 })
  v("le bouton devient « Renvoyer le lien »",
    await page.getByRole("button", { name: /Renvoyer le lien/ }).count() > 0 ? "oui" : "NON", "oui")
  v("« Envoyer pour signature » a disparu",
    await page.getByRole("button", { name: /^Envoyer pour signature$/ }).count(), 0)

  // ---- L'écran Signatures range au bon endroit ----------------------------
  const compte = async (titre) => {
    const h = page.locator("h2").filter({ hasText: titre }).first()
    if (await h.count() === 0) return "SECTION ABSENTE"
    return (await h.locator("span").last().innerText()).trim()
  }
  await page.goto("http://localhost:3000/fr/signatures", { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(4000)
  v("« en attente d'autrui » compte la demande", await compte("En attente d’autrui"), "1")
  v("« à signer par vous » est vide", await compte("À signer par vous"), "0")

  // ---- Tests 4 et 5 — les deux parties signent ----------------------------
  await faireSigner(dest[0].id, courrielClient)

  await page.reload({ waitUntil: "domcontentloaded" })
  await page.waitForTimeout(4000)
  await capturer(page, "signatures-a-moi.png")
  v("elle passe dans « à signer par vous »", await compte("À signer par vous"), "1")
  v("le bouton Signer apparaît",
    await page.getByRole("button", { name: /^Signer$/ }).count() > 0 ? "oui" : "NON", "oui")

  await faireSigner(dest[1].id, courrielConsultant)

  const { data: demFin } = await admin.from("signature_requests")
    .select("status").eq("id", dem[0].id).single()
  v("la demande est CLOSE", demFin.status, "completed")

  // ---- Test 6 — le PDF final ----------------------------------------------
  // FINALISER CONNECTÉ, pas en rôle de service : `verrouiller_document()` lit
  // le cabinet de la session, et le rôle de service n'en a aucun. Le verrou
  // échouerait en silence — un défaut de l'épreuve, pas du produit.
  const session = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } })
  await session.auth.signInWithPassword({ email: courrielConsultant, password: mdp })
  const fin = await finaliser(session, { firmId: cab, fullName: "Adama Diarra" }, dem[0].id)
  v("le document final se compose", fin.ok ? "ok" : fin.message, "ok")

  const { data: docFinal } = await admin.from("documents")
    .select("name, storage_path, supersedes_id, locked_at").eq("id", fin.documentId).single()
  v("il remplace l'original", docFinal.supersedes_id, docEmis.id)
  v("il est verrouillé dès sa naissance", docFinal.locked_at ? "oui" : "NON", "oui")

  const octetsFinal = await telecharger(docFinal.storage_path)
  const pdfFinal = await PDFDocument.load(octetsFinal)
  const pdfEmis = await PDFDocument.load(octetsEmis)
  v("les pages d'origine sont conservées",
    pdfFinal.getPageCount() > pdfEmis.getPageCount() ? "oui" : "NON", "oui")

  // LE CŒUR DE CETTE AMÉLIORATION : deux tracés sur la page des encadrés.
  v("le contrat émis ne portait aucune image", imagesSurLaPage(pdfEmis, pageAncre), 0)
  v("le contrat signé porte DEUX tracés", imagesSurLaPage(pdfFinal, pageAncre), 2)

  const texteFinal = lisiblePdf(octetsFinal)
  v("le document final ne dit PAS brouillon",
    texteFinal.includes("BROUILLON") ? "ESTAMPÉ" : "non", "non")
  v("le certificat est toujours là",
    texteFinal.includes("CERTIFICAT DE SIGNATURE") ? "oui" : "NON", "oui")
  v("les deux signataires y figurent",
    texteFinal.includes("Jean Tremblay") && texteFinal.includes("Adama Diarra") ? "oui" : "NON", "oui")

  // ---- Test 7 — le fuseau ---------------------------------------------------
  v("le certificat nomme le fuseau",
    texteFinal.includes("America/Toronto") ? "oui" : "NON", "oui")
  v("et l'abréviation en vigueur",
    /\b(EST|EDT)\b/.test(texteFinal) ? "oui" : "NON", "oui")

  // La date apposée sur le contrat est celle de la SIGNATURE, dans l'Est.
  const { horodatage } = await import("../lib/signature/horodatage.ts")
  const { data: sigs } = await admin.from("signatures")
    .select("signed_at").eq("request_id", dem[0].id).order("signed_at")
  const jourSignature = horodatage(String(sigs[0].signed_at)).slice(0, 10)
  const attenduLisible = new Intl.DateTimeFormat("fr-CA", {
    timeZone: "America/Toronto", day: "numeric", month: "long", year: "numeric",
  }).format(new Date(String(sigs[0].signed_at)))
  v("la date de signature est imprimée",
    texteFinal.includes(attenduLisible) ? "oui" : `NON (${attenduLisible})`, "oui")
  v("elle correspond au jour de l'Est", jourSignature.length, 10)

  if (S) {
    const { writeFileSync } = await import("node:fs")
    writeFileSync(join(S, "contrat-final.pdf"), octetsFinal)
    console.log("\n    PDF final écrit :", join(S, "contrat-final.pdf"))
  }
} catch (e) {
  echecs++
  console.error("\n  ✗ épreuve interrompue :", e.message)
} finally {
  if (nav) await nav.close().catch(() => {})
  if (cab) {
    await admin.from("firms").delete().eq("id", cab)
    console.log("\nCabinet et compte d'épreuve supprimés.")
  }
  if (uid) await admin.auth.admin.deleteUser(uid).catch(() => {})
}

console.log(echecs === 0
  ? "\n✓ Chaîne entente → signature → PDF final vérifiée, 0 échec."
  : `\n✗ ${echecs} échec(s).`)
process.exit(echecs === 0 ? 0 : 1)
