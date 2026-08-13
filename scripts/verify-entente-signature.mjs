#!/usr/bin/env node
/**
 * Éprouve la chaîne ENTENTE → CONTRAT → SIGNATURE, dans un vrai navigateur.
 *
 * ─── LE DÉFAUT QUE CE SCRIPT AURAIT ATTRAPÉ ────────────────────────────────
 *
 * Le bouton « Envoyer pour signature » des ententes appelait l'ancien chemin :
 * il insérait une demande NUE — aucun destinataire, aucun champ, aucun jeton,
 * aucun verrou, aucun courriel. La demande existait en base, l'écran affichait
 * un succès, et le client ne recevait jamais rien.
 *
 * Rien ne pouvait le voir : ni le compilateur, ni les épreuves unitaires, ni
 * les contrôles du socle — qui créaient leurs demandes par le BON chemin et ne
 * passaient donc jamais par ce bouton.
 *
 * ─── CE QU'IL VÉRIFIE ──────────────────────────────────────────────────────
 *
 *   1. le clic crée une demande RÉELLE, avec ses deux signataires ;
 *   2. le client d'abord, le consultant ensuite, avec son permis ;
 *   3. le document est verrouillé par l'envoi ;
 *   4. un jeton existe, et seule son empreinte est en base ;
 *   5. un second clic ne crée pas une seconde demande (§13) ;
 *   6. l'écran Signatures range la demande dans la BONNE section ;
 *   7. quand le client a signé, elle passe dans « à signer par vous ».
 *
 * Tout est supprimé à la fin, même en cas d'échec.
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
const { chromium } = await import(join(magasin,
  readdirSync(magasin).find((d) => /^playwright@/.test(d)), "node_modules/playwright/index.mjs"))
const { PDFDocument, StandardFonts } = await import(join(magasin,
  readdirSync(magasin).find((d) => /^pdf-lib@/.test(d)), "node_modules/pdf-lib/cjs/index.js"))

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } })

// Les captures ne sont écrites que si on donne un dossier.
const S = process.argv[2] ?? null
const capturer = async (page, nom) => { if (S) await page.screenshot({ path: join(S, nom) }) }

const marque = Date.now()
const mdp = "Epreuve-" + randomBytes(9).toString("base64url")
let cab, uid, nav, echecs = 0

const v = (intitule, obtenu, attendu) => {
  const ok = String(obtenu) === String(attendu)
  if (!ok) echecs++
  console.log(`  ${ok ? "✓" : "✗"} ${intitule.padEnd(48)} ${String(obtenu).slice(0, 30)}` +
    (ok ? "" : `   ATTENDU ${attendu}`))
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

  // ── Le contrat déjà émis : un document porteur d'un fichier ─────────────
  const pdf = await PDFDocument.create()
  const pg = pdf.addPage([595, 842])
  const pol = await pdf.embedFont(StandardFonts.Helvetica)
  pg.drawText("CONTRAT DE SERVICES", { x: 56, y: 760, size: 18, font: pol })
  const octets = Buffer.from(await pdf.save())

  const { data: doc } = await admin.from("documents").insert({
    firm_id: cab, client_id: cl.id, name: "Entente de services.pdf",
    type: "Entente de service", category: "contract", uploaded_by: "Adama Diarra",
    source: "cabinet", status: "valid", mime_type: "application/pdf", size_bytes: octets.length,
  }).select("id").single()
  const chemin = `${cab}/${cl.id}/${doc.id}/entente.pdf`
  await admin.storage.from("documents").upload(chemin, octets,
    { contentType: "application/pdf", upsert: true })
  await admin.from("documents").update({
    storage_path: chemin, sha256: createHash("sha256").update(octets).digest("hex"),
  }).eq("id", doc.id)

  const reference = `ENT-ES-${String(marque).slice(-6)}`
  // `created_by` désigne le PROFIL, pas le compte d'authentification. Passer
  // l'identifiant de compte fait échouer la clé étrangère — et une insertion
  // dont on ne lit pas l'erreur produit un écran vide qu'on impute au produit.
  const { data: entente, error: eEntente } = await admin.from("agreements").insert({
    firm_id: cab, client_id: cl.id, reference, title: "Entente de services",
    kind: "services", status: "ready", articles_snapshot: [],
    fees_amount: 3500, document_id: doc.id, created_by: profil.id,
    issued_at: new Date().toISOString(),
  }).select("id").single()
  if (eEntente) throw new Error(`entente d'épreuve : ${eEntente.message}`)

  // ── L'écran ─────────────────────────────────────────────────────────────
  nav = await chromium.launch({ channel: "chrome" })
  const page = await (await nav.newContext({ viewport: { width: 1440, height: 1100 } })).newPage()

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
  // ON ATTEND LA LIGNE, PAS UNE DURÉE. En développement, la première visite
  // d'une route la compile : un délai fixe photographie une page encore vide
  // et fait échouer l'épreuve sur un défaut qui n'existe pas.
  await page.getByText(reference).first().waitFor({ timeout: 60000 })
  await capturer(page, "ententes.png")

  const bouton = page.getByRole("button", { name: /^Envoyer pour signature$/ }).first()
  v("le bouton existe sur l'entente émise", await bouton.count() > 0 ? "oui" : "NON", "oui")
  if (await bouton.count() === 0) throw new Error("bouton absent — voir ententes.png")

  await bouton.click()
  await page.waitForTimeout(6000)
  await capturer(page, "ententes-envoyee.png")

  // ── Ce que la base doit contenir ────────────────────────────────────────
  const { data: dem } = await admin.from("signature_requests")
    .select("id, status, document_id, client_id").eq("firm_id", cab)
  v("une demande est créée", (dem ?? []).length, 1)
  v("elle est envoyée", dem?.[0]?.status, "sent")
  v("elle porte le bon document", dem?.[0]?.document_id, doc.id)
  v("et le bon client", dem?.[0]?.client_id, cl.id)

  const { data: dest } = await admin.from("signature_recipients")
    .select("id, role, rank, full_name, email, rcic_number, status, token_hash, sent_at")
    .eq("request_id", dem[0].id).order("rank")
  v("DEUX signataires", (dest ?? []).length, 2)
  v("le client d'abord", dest?.[0]?.role, "client")
  v("avec son courriel de fiche", dest?.[0]?.email, courrielClient)
  v("le consultant ensuite", dest?.[1]?.role, "consultant")
  v("avec son PERMIS, non saisi", dest?.[1]?.rcic_number, permis)

  // Le jeton ne doit exister qu'en empreinte.
  v("le client a un jeton", dest?.[0]?.token_hash ? "oui" : "NON", "oui")
  v("et ce n'est qu'une empreinte",
    /^[0-9a-f]{64}$/.test(String(dest?.[0]?.token_hash ?? "")) ? "oui" : "NON", "oui")

  // En séquentiel, seul le premier est marqué comme prévenu.
  v("le client est marqué prévenu", dest?.[0]?.sent_at ? "oui" : "NON", "oui")
  v("le consultant ne l'est pas encore", dest?.[1]?.sent_at ? "MARQUÉ" : "non", "non")

  const { data: apres } = await admin.from("documents")
    .select("locked_at").eq("id", doc.id).single()
  v("l'envoi VERROUILLE le document", apres.locked_at ? "oui" : "NON", "oui")

  const { data: ag } = await admin.from("agreements")
    .select("status").eq("id", entente.id).single()
  v("l'entente passe à « envoyée »", ag.status, "sent")

  const { data: evts } = await admin.from("audit_logs")
    .select("action").eq("entity_type", "signature_request").eq("entity_id", dem[0].id)
  v("le journal consigne la création",
    (evts ?? []).some((e) => e.action === "signature.request.created") ? "oui" : "NON", "oui")
  v("et l'envoi",
    (evts ?? []).some((e) => e.action === "signature.request.sent") ? "oui" : "NON", "oui")

  // ── §13 : un second clic ne crée pas une seconde demande ────────────────
  await page.reload({ waitUntil: "domcontentloaded" })
  await page.waitForTimeout(3500)
  const renvoyer = page.getByRole("button", { name: /Renvoyer le lien/ }).first()
  v("le bouton devient « Renvoyer le lien »", await renvoyer.count() > 0 ? "oui" : "NON", "oui")
  v("« Envoyer pour signature » a disparu",
    await page.getByRole("button", { name: /^Envoyer pour signature$/ }).count(), 0)

  await renvoyer.click()
  await page.waitForTimeout(5000)
  const { data: apresRenvoi } = await admin.from("signature_requests").select("id").eq("firm_id", cab)
  v("relancer ne crée PAS de seconde demande", (apresRenvoi ?? []).length, 1)

  // ── L'écran Signatures range au bon endroit ─────────────────────────────
  await page.goto("http://localhost:3000/fr/signatures", { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(3500)
  await capturer(page, "signatures-attente.png")

  const compte = async (titre) => {
    const h = page.locator("h2").filter({ hasText: titre }).first()
    if (await h.count() === 0) return "SECTION ABSENTE"
    return (await h.locator("span").last().innerText()).trim()
  }
  v("« en attente d'autrui » compte la demande", await compte("En attente d’autrui"), "1")
  v("« à signer par vous » est vide", await compte("À signer par vous"), "0")
  v("« prêts à envoyer » est vide", await compte("Prêts à envoyer"), "0")

  // ── Le client signe : le tour passe au consultant ───────────────────────
  await admin.from("signature_recipients")
    .update({ status: "signed", signed_at: new Date().toISOString() })
    .eq("id", dest[0].id)

  await page.reload({ waitUntil: "domcontentloaded" })
  await page.waitForTimeout(3500)
  await capturer(page, "signatures-a-moi.png")
  v("elle passe dans « à signer par vous »", await compte("À signer par vous"), "1")
  v("et quitte « en attente d'autrui »", await compte("En attente d’autrui"), "0")
  v("le bouton Signer apparaît",
    await page.getByRole("button", { name: /^Signer$/ }).count() > 0 ? "oui" : "NON", "oui")

  // Le clic doit mener à la page publique de signature, pas à un second écran.
  await page.getByRole("button", { name: /^Signer$/ }).first().click()
  await page.waitForTimeout(6000)
  v("il mène à la page de signature", /\/s\/[A-Za-z0-9_-]{20,}/.test(page.url()) ? "oui" : page.url(), "oui")
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
  ? "\n✓ Chaîne entente → signature vérifiée, 0 échec."
  : `\n✗ ${echecs} échec(s).`)
process.exit(echecs === 0 ? 0 : 1)
