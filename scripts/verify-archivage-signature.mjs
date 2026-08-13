#!/usr/bin/env node
/**
 * Éprouve l'archivage, la restauration et la suppression d'une demande close.
 *
 * ─── CE QUE CE SCRIPT PROTÈGE ──────────────────────────────────────────────
 *
 * LA PREUVE. `signatures.request_id` cascade depuis la demande : un
 * `delete from signature_requests` effacerait les signatures elles-mêmes,
 * leurs horodatages et leurs adresses d'origine. Une demande annulée APRÈS
 * qu'un client a signé garde tout cela, et doit le garder.
 *
 * Le contrôle central de ce script est donc négatif : il crée exactement ce
 * cas — client signé, consultant non, demande annulée — et vérifie que la
 * suppression est REFUSÉE.
 *
 * ─── ET LE DOCUMENT DU DOSSIER ─────────────────────────────────────────────
 *
 * Supprimer une demande ne doit pas emporter le contrat qu'on voulait faire
 * signer. C'est le dernier contrôle.
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
  console.log(`  ${ok ? "✓" : "✗"} ${intitule.padEnd(52)} ${String(obtenu).slice(0, 26)}` +
    (ok ? "" : `   ATTENDU ${attendu}`))
}

/** Une demande close, prête à être rangée. */
const nouvelleDemande = async (docId, clientId, statut, avecSignature) => {
  const { data: d } = await admin.from("signature_requests").insert({
    firm_id: cab, document_id: docId, client_id: clientId,
    document_sha256: "b".repeat(64), status: "sent", signing_mode: "sequential",
    provider: "internal",
    expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
  }).select("id").single()

  await admin.from("signature_recipients").insert([
    { firm_id: cab, request_id: d.id, role: "client", rank: 1,
      full_name: "Jean Tremblay", email: `jt-${marque}@example.invalid`,
      status: avecSignature ? "signed" : "pending",
      signed_at: avecSignature ? new Date().toISOString() : null },
    { firm_id: cab, request_id: d.id, role: "consultant", rank: 2,
      full_name: "Adama Diarra", email: `c-${marque}@example.invalid`, status: "pending" },
  ])

  if (avecSignature) {
    await admin.from("signatures").insert({
      request_id: d.id, firm_id: cab, document_id: docId,
      signer_kind: "client", signer_name: "Jean Tremblay",
      signer_email: `jt-${marque}@example.invalid`, signer_role: "client",
      document_sha256: "imposé par la base", ip_address: "198.51.100.9",
    })
  }

  // Le statut est posé APRÈS les destinataires : le déclencheur qui recalcule
  // l'état écraserait « cancelled » en repassant sur les rangs.
  await admin.from("signature_requests")
    .update({ status: statut, cancelled_at: statut === "cancelled" ? new Date().toISOString() : null })
    .eq("id", d.id)
  return d.id
}

const compte = async (page, titre) => {
  const h = page.locator("h2").filter({ hasText: titre }).first()
  if (await h.count() === 0) return "SECTION ABSENTE"
  return (await h.locator("span").last().innerText()).trim()
}

try {
  const courriel = `arch-${marque}@example.invalid`
  const { data: f } = await admin.from("firms").insert({
    name: "DGV Immigration", rcic_license_number: `R99${String(marque).slice(-5)}`,
    owner_name: "Adama Diarra", email: courriel, plan: "cabinet", status: "active",
  }).select("id").single()
  cab = f.id

  await admin.from("firm_subscriptions").insert({
    firm_id: cab, plan: "cabinet", cadence: "monthly", seats: 3,
    status: "active", stripe_customer_id: `cus_ar_${marque}`,
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
    email: `jt-${marque}@example.invalid`, file_number: `DOS-AR-${String(marque).slice(-6)}`,
    program: "Permis de travail", status: "active", client_type: "individual",
  }).select("id").single()

  const nouveauDoc = async (nom) => {
    const { data } = await admin.from("documents").insert({
      firm_id: cab, client_id: cl.id, name: nom, type: "Entente de service",
      category: "contract", uploaded_by: "Épreuve", source: "cabinet", status: "valid",
      storage_path: `${cab}/${cl.id}/faux/${nom}`, sha256: "b".repeat(64),
      mime_type: "application/pdf", size_bytes: 1234,
    }).select("id").single()
    return data.id
  }

  const docA = await nouveauDoc("Contrat A.pdf")   // annulée, sans signature
  const docB = await nouveauDoc("Contrat B.pdf")   // annulée AVEC signature
  const docC = await nouveauDoc("Contrat C.pdf")   // complétée

  const dA = await nouvelleDemande(docA, cl.id, "cancelled", false)
  const dB = await nouvelleDemande(docB, cl.id, "cancelled", true)
  const dC = await nouvelleDemande(docC, cl.id, "completed", true)

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

  await page.goto("http://localhost:3000/fr/signatures", { waitUntil: "domcontentloaded" })
  await page.getByText("Contrat A.pdf").first().waitFor({ timeout: 60000 })
  await capturer(page, "archives-avant.png")

  // ---- Test 1 — les demandes closes sont là ------------------------------
  v("« annulées ou expirées » compte les deux", await compte(page, "Annulées ou expirées"), "2")
  v("la section Archives existe", await compte(page, "Archives"), "0")
  v("la demande complétée est ailleurs", await compte(page, "Signées"), "1")

  // ---- Test 5 — une demande complétée ne s'efface pas ---------------------
  const carteC = page.locator("li").filter({ hasText: "Contrat C.pdf" }).first()
  v("une demande signée n'offre pas l'archivage",
    await carteC.getByRole("button", { name: /^Archiver$/ }).count(), 0)
  v("ni la suppression définitive",
    await carteC.getByRole("button", { name: /Supprimer définitivement/ }).count(), 0)

  // ---- Test 6 — signature partielle : suppression bloquée ----------------
  const carteB = page.locator("li").filter({ hasText: "Contrat B.pdf" }).first()
  v("une demande annulée offre l'archivage",
    await carteB.getByRole("button", { name: /^Archiver$/ }).count(), 1)
  await carteB.getByRole("button", { name: /Supprimer définitivement/ }).click()
  await page.waitForTimeout(2500)
  await capturer(page, "archives-refus.png")
  v("la fenêtre REFUSE d'effacer une preuve",
    await page.getByText(/signature a déjà été apposée/).count() > 0 ? "oui" : "NON", "oui")
  v("le bouton d'effacement reste inerte",
    await page.getByRole("button", { name: /^Supprimer définitivement$/ }).last().isDisabled()
      ? "oui" : "NON", "oui")
  v("aucun champ de confirmation n'est proposé",
    await page.locator('input[placeholder="SUPPRIMER"]').count(), 0)
  await page.getByRole("button", { name: /^Annuler$/ }).last().click()
  await page.waitForTimeout(1200)

  // ---- Test 2 — archivage ------------------------------------------------
  await page.locator("li").filter({ hasText: "Contrat A.pdf" }).first()
    .getByRole("button", { name: /^Archiver$/ }).click()
  await page.waitForTimeout(6000)
  await capturer(page, "archives-apres.png")

  const { data: apresA } = await admin.from("signature_requests")
    .select("status, archived_at, archived_by").eq("id", dA).single()
  v("la date d'archivage est posée", apresA.archived_at ? "oui" : "NON", "oui")
  v("l'auteur est retenu", apresA.archived_by ? "oui" : "NON", "oui")
  // §4 — LE STATUT D'ORIGINE N'A JAMAIS ÉTÉ PERDU : il n'a pas changé.
  v("le statut reste « annulée »", apresA.status, "cancelled")

  v("elle quitte la liste courante", await compte(page, "Annulées ou expirées"), "1")
  v("et rejoint les Archives", await compte(page, "Archives"), "1")

  const { data: evtArch } = await admin.from("audit_logs")
    .select("action").eq("entity_id", dA).eq("action", "signature.request.archived")
  v("l'archivage est consigné", (evtArch ?? []).length, 1)

  // ---- Test 3 — restauration ---------------------------------------------
  await page.locator("li").filter({ hasText: "Contrat A.pdf" }).first()
    .getByRole("button", { name: /^Restaurer$/ }).click()
  await page.waitForTimeout(6000)

  const { data: apresR } = await admin.from("signature_requests")
    .select("status, archived_at").eq("id", dA).single()
  v("la restauration efface la date", apresR.archived_at, "null")
  v("et rend son statut d'origine", apresR.status, "cancelled")
  v("elle revient dans la liste courante", await compte(page, "Annulées ou expirées"), "2")

  // ---- Test 4 — suppression définitive ------------------------------------
  await page.locator("li").filter({ hasText: "Contrat A.pdf" }).first()
    .getByRole("button", { name: /Supprimer définitivement/ }).click()
  await page.waitForTimeout(2500)

  const champ = page.locator('input[placeholder="SUPPRIMER"]')
  v("le champ de confirmation apparaît", await champ.count(), 1)
  const bouton = page.getByRole("button", { name: /^Supprimer définitivement$/ }).last()
  v("le bouton reste inerte sans le mot", await bouton.isDisabled() ? "oui" : "NON", "oui")

  await champ.fill("supprime")
  await page.waitForTimeout(600)
  v("un mot approchant ne suffit pas", await bouton.isDisabled() ? "oui" : "NON", "oui")

  await champ.fill("SUPPRIMER")
  await page.waitForTimeout(600)
  v("le mot exact débloque", await bouton.isDisabled() ? "BLOQUÉ" : "oui", "oui")
  await capturer(page, "archives-confirmation.png")

  await bouton.click()
  await page.waitForTimeout(6000)

  const { data: restante } = await admin.from("signature_requests").select("id").eq("id", dA)
  v("la demande a disparu", (restante ?? []).length, 0)
  const { count: destRestants } = await admin.from("signature_recipients")
    .select("id", { count: "exact", head: true }).eq("request_id", dA)
  v("ses destinataires aussi", destRestants ?? 0, 0)

  // LE JOURNAL SURVIT À LA LIGNE. `audit_logs` ne porte pas de clé étrangère
  // vers la demande : c'est ce qui permet de démontrer qu'elle a existé.
  const { data: evtSupp } = await admin.from("audit_logs")
    .select("action, actor_name").eq("entity_id", dA).eq("action", "signature.request.deleted")
  v("la suppression reste au journal", (evtSupp ?? []).length, 1)
  v("avec son auteur", evtSupp?.[0]?.actor_name, "Adama Diarra")

  // ---- Test 7 — le document du dossier survit -----------------------------
  const { data: docReste } = await admin.from("documents").select("id, name").eq("id", docA)
  v("le document du dossier est intact", (docReste ?? []).length, 1)

  // ---- La preuve de la demande B n'a pas bougé ---------------------------
  const { count: sigB } = await admin.from("signatures")
    .select("id", { count: "exact", head: true }).eq("request_id", dB)
  v("la signature de la demande B est conservée", sigB, 1)
  const { data: demandeB } = await admin.from("signature_requests").select("id").eq("id", dB)
  v("et sa demande également", (demandeB ?? []).length, 1)
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
  ? "\n✓ Archivage et suppression vérifiés, 0 échec."
  : `\n✗ ${echecs} échec(s).`)
process.exit(echecs === 0 ? 0 : 1)
