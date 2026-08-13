#!/usr/bin/env node
/**
 * Éprouve « Autres documents » dans l'onglet Documents d'un dossier.
 *
 * ─── CE QUE CE SCRIPT CHERCHE À PRENDRE EN DÉFAUT ──────────────────────────
 *
 * 1. QUE LA PIÈCE PARTE AILLEURS QUE DANS LE BON DOSSIER. Un document rattaché
 *    au client mais pas au dossier s'afficherait dans la fiche client et
 *    resterait invisible là où on le cherche.
 *
 * 2. QUE LE NOM SE PERDE. La catégorie est générique par dessein : si le nom
 *    donné par le consultant n'est pas celui qui s'affiche, la section devient
 *    une pile de « Autre document » indiscernables.
 *
 * 3. QUE LES AUTRES CATÉGORIES BOUGENT. La contrainte de catégorie a été
 *    remplacée pour en ajouter une sixième : les cinq anciennes doivent
 *    continuer d'être acceptées, et aucune valeur inconnue ne doit passer.
 *
 * 4. QUE LE FICHIER SOIT LISIBLE SANS DROIT. Le compartiment reste fermé ;
 *    l'accès passe par une adresse signée qui expire.
 *
 * Tout est supprimé à la fin, même en cas d'échec.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs"
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
const { chromium } = await import(join(magasin,
  readdirSync(magasin).find((d) => /^playwright@/.test(d)), "node_modules/playwright/index.mjs"))
const { PDFDocument, StandardFonts } = await import(join(magasin,
  readdirSync(magasin).find((d) => /^pdf-lib@/.test(d)), "node_modules/pdf-lib/cjs/index.js"))

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } })

const S = process.argv[2] ?? null
const capturer = async (page, nom) => { if (S) await page.screenshot({ path: join(S, nom) }) }

const marque = Date.now()
const mdp = "Epreuve-" + randomBytes(9).toString("base64url")
let cab, uid, nav, echecs = 0
const fichierTemporaire = join(ROOT, `.epreuve-${marque}.pdf`)

const v = (intitule, obtenu, attendu) => {
  const ok = String(obtenu) === String(attendu)
  if (!ok) echecs++
  console.log(`  ${ok ? "✓" : "✗"} ${intitule.padEnd(50)} ${String(obtenu).slice(0, 28)}` +
    (ok ? "" : `   ATTENDU ${attendu}`))
}

try {
  // ── Le cabinet, le client, le dossier ───────────────────────────────────
  const courriel = `autres-${marque}@example.invalid`
  const { data: f } = await admin.from("firms").insert({
    name: "DGV Immigration", rcic_license_number: `R88${String(marque).slice(-5)}`,
    owner_name: "Adama Diarra", email: courriel, plan: "cabinet", status: "active",
  }).select("id").single()
  cab = f.id

  await admin.from("firm_subscriptions").insert({
    firm_id: cab, plan: "cabinet", cadence: "monthly", seats: 3,
    status: "active", stripe_customer_id: `cus_ad_${marque}`,
  })
  const { data: u } = await admin.auth.admin.createUser({
    email: courriel, password: mdp, email_confirm: true,
  })
  uid = u.user.id
  await admin.from("profiles").insert({
    firm_id: cab, user_id: uid, email: courriel,
    full_name: "Adama Diarra", cicc_role: "owner", status: "active",
  })

  const { data: cl } = await admin.from("clients").insert({
    firm_id: cab, name: "Jean Tremblay", first_name: "Jean", last_name: "Tremblay",
    email: `jt-${marque}@example.invalid`, file_number: `DOS-AD-${String(marque).slice(-6)}`,
    program: "Permis de travail", status: "active", client_type: "individual",
  }).select("id").single()

  const { data: m } = await admin.from("matters").insert({
    firm_id: cab, client_id: cl.id, reference: `#DOS-${String(marque).slice(-5)}`,
    client_name: "Jean Tremblay", client_type: "b2c", program: "Permis de travail",
    category: "work", opened_date: new Date().toISOString().slice(0, 10),
    rcic: "Adama Diarra", status: "valid", urgency_days: 0, notes: "", is_priority: false,
  }).select("id, reference").single()

  // ── LES CINQ CATÉGORIES D'ORIGINE TIENNENT TOUJOURS ─────────────────────
  // La contrainte a été remplacée pour en ajouter une sixième. Si l'une des
  // anciennes avait été perdue en chemin, tout le module Documents tomberait.
  for (const c of ["client_upload", "consultant_upload", "contract", "invoice", "ircc_form"]) {
    const { data: essai, error } = await admin.from("documents").insert({
      firm_id: cab, client_id: cl.id, matter_id: m.id, name: `essai ${c}`,
      type: "Essai", category: c, uploaded_by: "Épreuve", source: "cabinet", status: "valid",
    }).select("id").single()
    v(`catégorie « ${c} » toujours acceptée`, error ? error.message.slice(0, 24) : "oui", "oui")
    if (essai) await admin.from("documents").delete().eq("id", essai.id)
  }

  const { error: eInconnue } = await admin.from("documents").insert({
    firm_id: cab, client_id: cl.id, matter_id: m.id, name: "essai",
    type: "Essai", category: "categorie_inventee", uploaded_by: "Épreuve",
    source: "cabinet", status: "valid",
  })
  v("une catégorie inconnue : REFUSÉE", eInconnue ? "refusée" : "ACCEPTÉE", "refusée")

  // ── Un vrai PDF à téléverser ────────────────────────────────────────────
  const pdf = await PDFDocument.create()
  const pg = pdf.addPage([595, 842])
  const pol = await pdf.embedFont(StandardFonts.Helvetica)
  pg.drawText("LETTRE EXPLICATIVE", { x: 56, y: 760, size: 18, font: pol })
  writeFileSync(fichierTemporaire, Buffer.from(await pdf.save()))

  // ── L'écran ─────────────────────────────────────────────────────────────
  nav = await chromium.launch({ channel: "chrome" })
  const page = await (await nav.newContext({ viewport: { width: 1440, height: 1200 } })).newPage()

  await page.goto("http://localhost:3000/fr/connexion", { waitUntil: "domcontentloaded" })
  await page.waitForSelector('input[type="email"]', { timeout: 30000 })
  await page.waitForTimeout(1500)
  await page.fill('input[type="email"]', courriel)
  await page.fill('input[type="password"]', mdp)
  await page.waitForFunction(
    () => !document.querySelector("button[type=submit]")?.hasAttribute("disabled"),
    { timeout: 30000 })
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/fr(\/|$)/, { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(2500)

  // Le dossier se retrouve par sa RÉFÉRENCE : c'est la convention des adresses.
  await page.goto(`http://localhost:3000/fr/matters/${encodeURIComponent(m.reference)}`,
    { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(4000)

  const onglet = page.locator("button[aria-selected]").filter({ hasText: /^Documents$/ }).first()
  v("l'onglet Documents existe", await onglet.count() > 0 ? "oui" : "NON", "oui")
  if (await onglet.count() === 0) throw new Error("onglet absent")
  await onglet.click()
  await page.waitForTimeout(2000)
  await capturer(page, "documents-vide.png")

  v("la section « Autres documents » est là",
    await page.getByText("Autres documents", { exact: true }).count() > 0 ? "oui" : "NON", "oui")
  v("elle annonce l'état vide",
    await page.getByText(/Aucun autre document au dossier/).count() > 0 ? "oui" : "NON", "oui")
  // LE FORMULAIRE EST VISÉ PAR UN CHAMP QUI N'EXISTE QU'EN LUI. Les pièces
  // exigées portent chacune leur propre bouton de téléversement, juste
  // au-dessus : viser « le premier bouton » déposerait la lettre explicative
  // dans la case du passeport — ce que ce script a fait avant d'être corrigé.
  const ajout = page.locator('form:has(input[name="dateDocument"])').first()
  v("le formulaire d'ajout est là",
    await ajout.getByRole("button", { name: /Ajouter au dossier/ }).count() > 0 ? "oui" : "NON", "oui")

  // ── Le nom est OBLIGATOIRE ──────────────────────────────────────────────
  const nomChamp = ajout.locator('input[name="nom"]')
  v("le nom est exigé par le formulaire",
    await nomChamp.getAttribute("required") !== null ? "oui" : "NON", "oui")

  // ── Le dépôt ────────────────────────────────────────────────────────────
  const NOM = "Lettre explicative concernant le refus de 2024"
  await nomChamp.fill(NOM)
  await ajout.locator('input[name="description"]').fill("Préparée par le client au sujet de son historique.")
  await ajout.locator('input[name="dateDocument"]').fill("2026-03-14")
  await ajout.locator('select[name="provenance"]').selectOption("Client")
  await ajout.locator('input[name="fichier"]').setInputFiles(fichierTemporaire)
  await capturer(page, "documents-rempli.png")

  await ajout.getByRole("button", { name: /Ajouter au dossier/ }).click()
  await page.waitForTimeout(7000)
  await capturer(page, "documents-ajoute.png")

  // ── Ce que la base doit contenir ────────────────────────────────────────
  const { data: docs } = await admin.from("documents")
    .select("id, name, description, category, matter_id, client_id, date, type, storage_path, size_bytes, status")
    .eq("firm_id", cab).eq("category", "other")

  v("le document est créé", (docs ?? []).length, 1)
  const doc = docs?.[0]
  v("il porte le NOM donné", doc?.name, NOM)
  v("et sa description", doc?.description, "Préparée par le client au sujet de son historique.")
  v("sa catégorie est générique", doc?.category, "other")
  v("il est rattaché au DOSSIER", doc?.matter_id, m.id)
  v("et au client du dossier", doc?.client_id, cl.id)
  v("la date du document est retenue", String(doc?.date ?? "").slice(0, 10), "2026-03-14")
  v("la provenance sert d'étiquette", doc?.type, "Client")
  v("le fichier est déposé", doc?.storage_path ? "oui" : "NON", "oui")
  v("sa taille est enregistrée", (doc?.size_bytes ?? 0) > 0 ? "oui" : "NON", "oui")
  // Une pièce rangée par le cabinet n'attend pas que le cabinet l'approuve.
  v("il n'attend aucune vérification", doc?.status, "valid")

  // ── L'écran le montre, avec son nom ─────────────────────────────────────
  v("l'écran affiche le nom donné",
    await page.getByText(NOM).count() > 0 ? "oui" : "NON", "oui")
  v("et non « Autre document »",
    await page.getByText(/^Autre document$/).count(), 0)
  v("il dit qui l'a ajouté",
    await page.getByText(/Ajouté le .* par Adama Diarra/).count() > 0 ? "oui" : "NON", "oui")

  // ── Le fichier ne se lit pas sans droit ─────────────────────────────────
  const anonyme = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } })
  const { error: eLecture } = await anonyme.storage.from("documents").download(doc.storage_path)
  v("le fichier n'est pas lisible sans droit", eLecture ? "refusé" : "LISIBLE", "refusé")

  // ── Les pièces exigées n'ont pas bougé ──────────────────────────────────
  const { data: autresCat } = await admin.from("documents")
    .select("id").eq("firm_id", cab).neq("category", "other")
  v("aucune autre catégorie n'a été créée au passage", (autresCat ?? []).length, 0)
} catch (e) {
  echecs++
  console.error("\n  ✗ épreuve interrompue :", e.message)
} finally {
  if (nav) await nav.close().catch(() => {})
  try { const { unlinkSync } = await import("node:fs"); unlinkSync(fichierTemporaire) } catch {}
  if (cab) {
    await admin.from("firms").delete().eq("id", cab)
    console.log("\nCabinet et compte d'épreuve supprimés.")
  }
  if (uid) await admin.auth.admin.deleteUser(uid).catch(() => {})
}

console.log(echecs === 0
  ? "\n✓ Autres documents vérifiés, 0 échec."
  : `\n✗ ${echecs} échec(s).`)
process.exit(echecs === 0 ? 0 : 1)
