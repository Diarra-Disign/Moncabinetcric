#!/usr/bin/env node
/**
 * Éprouve le centre de contrôle : droits par forfait, exceptions, suspension,
 * cloisonnement de l'exploitant.
 *
 *   ./cric controle
 *
 * ─── LE CONTRÔLE LE PLUS IMPORTANT EST LE SECOND ───────────────────────────
 *
 * Qu'un cabinet privé de « signature électronique » ne puisse plus en ouvrir
 * est l'objet de la fonctionnalité. Qu'il continue de LIRE ses signatures
 * passées est ce qui distingue un levier commercial d'une faute : un
 * consultant réglementé répond de ses dossiers devant le Collège, et lui
 * masquer ses propres contrats signés parce qu'il a rétrogradé transformerait
 * une décision de facturation en défaut de tenue de dossiers.
 *
 * Le troisième compte autant : il doit pouvoir ANNULER ce qu'il a commencé.
 * On l'empêche d'ouvrir de nouveaux chantiers, on ne l'enferme pas dans les
 * anciens.
 *
 * Tout est supprimé à la fin, même en cas d'échec.
 */
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { randomBytes } from "node:crypto"
import { createClient } from "@supabase/supabase-js"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const env = Object.fromEntries(
  [...readFileSync(join(ROOT, ".env.local"), "utf8").matchAll(/^([A-Z0-9_]+)=(.*)$/gm)]
    .map((m) => [m[1], m[2].trim()])
)
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } })

const marque = Date.now()
const mdp = "Epreuve-" + randomBytes(9).toString("base64url")
let cab, uid, echecs = 0

const v = (intitule, obtenu, attendu) => {
  const ok = String(obtenu) === String(attendu)
  if (!ok) echecs++
  console.log(`  ${ok ? "✓" : "✗"} ${intitule.padEnd(56)} ${String(obtenu).slice(0, 22)}` +
    (ok ? "" : `   ATTENDU ${attendu}`))
}

try {
  const courriel = `ctrl-${marque}@example.invalid`
  const { data: f } = await admin.from("firms").insert({
    name: "DGV Immigration", rcic_license_number: `R22${String(marque).slice(-5)}`,
    owner_name: "Adama Diarra", email: courriel, plan: "cabinet", status: "active",
  }).select("id").single()
  cab = f.id

  await admin.from("firm_subscriptions").insert({
    firm_id: cab, plan: "cabinet", cadence: "monthly", seats: 3,
    status: "active", stripe_customer_id: `cus_ct_${marque}`,
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
    email: `jt-${marque}@example.invalid`, file_number: `DOS-CT-${String(marque).slice(-6)}`,
    program: "Permis de travail", status: "active", client_type: "individual",
  }).select("id").single()
  const { data: doc } = await admin.from("documents").insert({
    firm_id: cab, client_id: cl.id, name: "Contrat.pdf", type: "Entente de service",
    category: "contract", uploaded_by: "Épreuve", source: "cabinet", status: "valid",
    storage_path: `${cab}/${cl.id}/faux/c.pdf`, sha256: "b".repeat(64),
    mime_type: "application/pdf", size_bytes: 10,
  }).select("id").single()

  const cabinet = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } })
  await cabinet.auth.signInWithPassword({ email: courriel, password: mdp })

  const nouvelleDemande = () => cabinet.from("signature_requests").insert({
    firm_id: cab, document_id: doc.id, client_id: cl.id,
    document_sha256: "b".repeat(64), status: "draft", signing_mode: "sequential",
    provider: "internal",
    expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
  }).select("id").single()

  // ── 1. Avec le droit, tout passe ────────────────────────────────────────
  console.log("\nAvec la fonctionnalité, le cabinet travaille")
  const { data: aDroit } = await admin.rpc("firm_has_feature", { f_id: cab, feature_key: "esignature" })
  v("le forfait comprend la signature", aDroit, true)
  const { data: d1, error: e1 } = await nouvelleDemande()
  v("une demande s'ouvre", e1 ? `REFUS ${e1.code}` : "ouverte", "ouverte")

  // ── 2. Sans le droit : LA CRÉATION EST REFUSÉE ─────────────────────────
  console.log("\nSans la fonctionnalité, plus rien ne s'ouvre")
  await admin.from("plan_features")
    .upsert({ plan: "cabinet", feature: "esignature", enabled: false },
      { onConflict: "plan,feature" })

  const { data: apres } = await admin.rpc("firm_has_feature", { f_id: cab, feature_key: "esignature" })
  v("le forfait ne la comprend plus", apres, false)
  const { error: e2 } = await nouvelleDemande()
  v("une nouvelle demande est REFUSÉE", e2 ? "refusée" : "ACCEPTÉE", "refusée")

  // ── 3. MAIS IL LIT TOUJOURS SON PASSÉ ──────────────────────────────────
  // Le contrôle qui distingue un levier commercial d'une faute.
  console.log("\nMais il lit toujours ce qui existe")
  const { data: lues } = await cabinet.from("signature_requests").select("id").eq("firm_id", cab)
  v("ses demandes passées restent lisibles", (lues ?? []).length, 1)
  const { data: docLu } = await cabinet.from("documents").select("id").eq("id", doc.id).maybeSingle()
  v("et le contrat qu'elles visent aussi", docLu ? "lisible" : "MASQUÉ", "lisible")

  // ── 4. ET IL PEUT ANNULER CE QU'IL A COMMENCÉ ──────────────────────────
  console.log("\nEt il n'est pas enfermé dans ce qu'il a commencé")
  const { error: eAnnul } = await cabinet.from("signature_requests")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", d1.id)
  v("annuler une demande en cours reste possible", eAnnul ? `REFUS ${eAnnul.code}` : "possible", "possible")

  // ── 5. L'EXCEPTION ROUVRE, SON EXPIRATION REFERME ──────────────────────
  console.log("\nL'exception rouvre, et son échéance referme")
  await admin.from("firm_feature_overrides").upsert({
    firm_id: cab, feature: "esignature", enabled: true,
    reason: "épreuve", expires_at: new Date(Date.now() + 86400000).toISOString(),
  }, { onConflict: "firm_id,feature" })
  const { data: rouvert } = await admin.rpc("firm_has_feature", { f_id: cab, feature_key: "esignature" })
  v("l'exception rend le droit", rouvert, true)
  const { error: e3 } = await nouvelleDemande()
  v("et une demande s'ouvre de nouveau", e3 ? `REFUS ${e3.code}` : "ouverte", "ouverte")

  await admin.from("firm_feature_overrides")
    .update({ expires_at: new Date(Date.now() - 86400000).toISOString() })
    .eq("firm_id", cab).eq("feature", "esignature")
  const { data: echu } = await admin.rpc("firm_has_feature", { f_id: cab, feature_key: "esignature" })
  v("une exception ÉCHUE ne donne plus rien", echu, false)

  // Remise en état du catalogue partagé : il est commun à tous les cabinets,
  // le laisser modifié fausserait toutes les épreuves suivantes.
  await admin.from("plan_features")
    .upsert({ plan: "cabinet", feature: "esignature", enabled: true },
      { onConflict: "plan,feature" })

  // ── 6. LA SUSPENSION FERME TOUT, SANS RIEN EFFACER ─────────────────────
  console.log("\nLa suspension ferme tout, et ne détruit rien")
  await admin.from("firms").update({ status: "suspended" }).eq("id", cab)
  const { data: ouvert } = await admin.rpc("firm_access_open", { f_id: cab })
  v("l'accès est fermé", ouvert, false)
  const { data: rienVu } = await cabinet.from("clients").select("id").eq("firm_id", cab)
  v("le cabinet ne voit plus ses clients", (rienVu ?? []).length, 0)
  const { count: intacts } = await admin.from("clients")
    .select("id", { count: "exact", head: true }).eq("firm_id", cab)
  v("mais ses données sont intactes", intacts, 1)

  await admin.from("firms").update({ status: "active" }).eq("id", cab)
  const { data: revus } = await cabinet.from("clients").select("id").eq("firm_id", cab)
  v("la réactivation lui rend tout", (revus ?? []).length, 1)

  // ── 7. LE CLOISONNEMENT DE L'EXPLOITANT ────────────────────────────────
  // Il gère les cabinets, jamais leur contenu. Ce contrôle échouerait si un
  // lot futur élargissait ses politiques par mégarde.
  console.log("\nUn exploitant gère les cabinets, jamais leur contenu")

  // On lit les MIGRATIONS, et c'est délibéré : la question n'est pas « que
  // voit tel exploitant aujourd'hui » mais « existe-t-il, quelque part, une
  // politique qui ouvre le contenu d'un cabinet à un exploitant ». La réponse
  // est dans le dépôt, et ce contrôle échouera le jour où un lot futur en
  // ajoutera une — y compris si aucun exploitant n'existe encore en base.
  const { readdirSync } = await import("node:fs")
  const dossier = join(ROOT, "supabase/migrations")
  const sql = readdirSync(dossier)
    .filter((n) => n.endsWith(".sql"))
    .map((n) => readFileSync(join(dossier, n), "utf8"))
    .join("\n")

  const INTERDITES = ["clients", "matters", "leads", "documents", "audit_logs", "signatures"]
  for (const table of INTERDITES) {
    // Une politique sur cette table dont la clause mentionne is_platform_admin.
    const motif = new RegExp(
      `create policy[^;]*?on public\\.${table}\\b[^;]*?is_platform_admin`, "gis"
    )
    const trouvees = sql.match(motif) ?? []
    v(`aucune politique n'ouvre « ${table} » à l'exploitant`, trouvees.length, 0)
  }

} finally {
  if (cab) await admin.rpc("purger_cabinet_epreuve", { p_firm_id: cab })
  if (uid) await admin.auth.admin.deleteUser(uid)
  console.log("\nCabinet et compte d'épreuve supprimés.")
}

console.log(echecs === 0
  ? "\n✓ Les droits s'appliquent, et n'enferment personne. 0 échec."
  : `\n✗ ${echecs} échec(s).`)
process.exit(echecs === 0 ? 0 : 1)
