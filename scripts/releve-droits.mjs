#!/usr/bin/env node
/**
 * Ce que l'application des droits retirerait, cabinet réel par cabinet réel.
 *
 *   ./cric releve-droits
 *
 * ─── POURQUOI CE RELEVÉ EXISTE ─────────────────────────────────────────────
 *
 * `firm_has_feature()` est écrite, administrable depuis /admin/catalogue, et
 * n'est appliquée qu'à UNE fonctionnalité : le connecteur d'intelligence
 * artificielle. Basculer un interrupteur dans la console ne change rien pour
 * les douze autres.
 *
 * Le jour où l'on branche cette fonction sur les politiques d'écriture, des
 * portes se ferment. Elles se fermeront correctement — c'est le but — mais
 * elles se fermeront pour des cabinets réels, qui n'auront pas été prévenus.
 *
 * CE SCRIPT NE MODIFIE RIEN. Il interroge la base comme le fera la politique,
 * et dit ce qui arriverait. On le lit AVANT d'écrire la migration, pas après.
 *
 * ─── CE QU'IL NE DIT PAS ───────────────────────────────────────────────────
 *
 * Il ne dit pas si le cabinet SE SERT de la fonctionnalité — il le dit quand
 * la donnée existe (une entente écrite, une demande de signature, une écriture
 * de fidéicommis). Un cabinet qui perdrait une fonctionnalité dont il n'a
 * jamais usé ne perd rien ; celui qui en a l'usage est le seul cas qui compte,
 * et c'est celui que la dernière colonne signale.
 */
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const env = Object.fromEntries(
  [...readFileSync(join(ROOT, ".env.local"), "utf8").matchAll(/^([A-Z0-9_]+)=(.*)$/gm)]
    .map((m) => [m[1], m[2].trim()])
)
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } })

/**
 * Les fonctionnalités qu'on s'apprête à rendre exécutoires, et la table qui
 * prouve qu'un cabinet s'en sert.
 *
 * Le connecteur n'y figure pas : il est DÉJÀ appliqué, depuis
 * `connector_firm()`. Le relever donnerait à croire qu'on s'apprête à le
 * fermer.
 */
const A_APPLIQUER = [
  { cle: "agreements", libelle: "Ententes de représentation", table: "agreements" },
  { cle: "esignature", libelle: "Signature électronique", table: "signature_requests" },
  { cle: "invoicing", libelle: "Facturation des clients", table: "invoices" },
  { cle: "research", libelle: "Recherche législative", table: null },
  { cle: "team_roles", libelle: "Rôles et permissions", table: null },
  { cle: "trust", libelle: "Comptes en fidéicommis", table: "trust_ledger" },
]

/** Un courriel dans un domaine réservé RFC 2606 ne peut appartenir à personne. */
const jetable = (c) => /@(?:[^@\s]+\.)?(?:invalid|example|test|localhost)$/i.test(String(c ?? ""))

const { data: firms, error } = await admin
  .from("firms")
  .select("id, name, email, plan, status, trial_ends_at")
  .order("created_at")
if (error) { console.error("Lecture des cabinets impossible :", error.message); process.exit(2) }

const reels = (firms ?? []).filter((f) => !jetable(f.email))
console.log(`\nCABINETS RÉELS : ${reels.length}`)
console.log(`(les cabinets d'épreuve sont écartés — leur courriel est dans un domaine réservé)\n`)

let aSignaler = 0

for (const f of reels) {
  // Le plan EFFECTIF, pas `firms.plan` : un abonnement payé prime sur ce que
  // la console a écrit à la main. C'est la règle que `firm_has_feature()`
  // appliquera, il faut donc l'interroger de la même façon.
  const { data: planEffectif } = await admin.rpc("firm_effective_plan", { f_id: f.id })
  const { data: ouvert } = await admin.rpc("firm_access_open", { f_id: f.id })

  console.log(`── ${f.name}`)
  console.log(`   forfait écrit : ${f.plan}    forfait effectif : ${planEffectif ?? "—"}` +
    `    accès : ${ouvert ? "ouvert" : "FERMÉ"}    état : ${f.status}`)

  for (const fn of A_APPLIQUER) {
    const { data: aDroit } = await admin.rpc("firm_has_feature", {
      f_id: f.id, feature_key: fn.cle,
    })

    let usage = null
    if (fn.table) {
      const { count } = await admin
        .from(fn.table).select("id", { count: "exact", head: true }).eq("firm_id", f.id)
      usage = count ?? 0
    }

    if (aDroit) {
      // Rien à signaler : le forfait le comprend, la politique laissera passer.
      continue
    }

    // LE SEUL CAS QUI COMPTE VRAIMENT : le droit manque ET la donnée existe.
    const grave = usage !== null && usage > 0
    if (grave) aSignaler++
    console.log(
      `   ${grave ? "⚠ " : "  "}sans « ${fn.libelle} »` +
      (usage === null ? "  (usage non mesurable)" : `  — ${usage} enregistrement(s) existants`)
    )
  }
  console.log("")
}

console.log("─".repeat(70))
if (aSignaler === 0) {
  console.log(
    "AUCUN cabinet réel ne perdrait une fonctionnalité dont il se sert.\n" +
    "L'application des droits peut être activée sans rien retirer à personne."
  )
} else {
  console.log(
    `⚠ ${aSignaler} cas où un cabinet perdrait une fonctionnalité DONT IL SE SERT.\n` +
    "Ajuster la matrice des forfaits, ou accorder une exception datée depuis\n" +
    "/fr/admin/catalogue, AVANT d'appliquer les droits."
  )
}
console.log("\nCe relevé n'a rien modifié.")
