#!/usr/bin/env node
/**
 * Éprouve le questionnaire client contre la base réelle.
 *
 * Deux questions, et une seule compte vraiment : le client du portail
 * peut-il réécrire ce qui ne lui appartient pas ? Row Level Security
 * n'attribue que des LIGNES ; les colonnes sont gardées par un déclencheur,
 * et un corps PL/pgSQL n'est analysé qu'à sa PREMIÈRE EXÉCUTION — le voir
 * créé sans erreur ne prouve rien du tout.
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

const url = env.NEXT_PUBLIC_SUPABASE_URL
const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const session = async (courriel, mdp) => {
  const c = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  const { error } = await c.auth.signInWithPassword({ email: courriel, password: mdp })
  if (error) throw new Error(`Connexion ${courriel} : ${error.message}`)
  return c
}

let echecs = 0
const verifier = (intitule, obtenu, attendu) => {
  const ok = String(obtenu) === String(attendu)
  if (!ok) echecs++
  console.log(`  ${ok ? "✓" : "✗"} ${intitule.padEnd(48)} ${String(obtenu).slice(0, 40).padEnd(14)}` +
    (ok ? "" : ` ATTENDU ${attendu}`))
}

const marque = Date.now()
const mdp = "Epreuve-" + randomBytes(9).toString("base64url")
let cabinetId, userConsultant, userClient

try {
  const { data: cab } = await admin.from("firms").insert({
    name: `Cabinet questionnaire ${marque}`,
    rcic_license_number: `R666${String(marque).slice(-4)}`,
    owner_name: "Épreuve", email: `q-${marque}@example.invalid`,
    plan: "cabinet", status: "active",
  }).select("id").single()
  cabinetId = cab.id

  await admin.from("firm_subscriptions").insert({
    firm_id: cabinetId, plan: "cabinet", cadence: "monthly", seats: 3,
    status: "active", stripe_customer_id: `cus_q_${marque}`,
  })

  const courrielConsultant = `consultant-${marque}@example.invalid`
  const { data: uc } = await admin.auth.admin.createUser({
    email: courrielConsultant, password: mdp, email_confirm: true,
  })
  userConsultant = uc.user.id
  await admin.from("profiles").insert({
    firm_id: cabinetId, user_id: userConsultant, email: courrielConsultant,
    full_name: "Consultant d'épreuve", cicc_role: "rcic",
  })

  const courrielClient = `client-${marque}@example.invalid`
  const { data: cl } = await admin.from("clients").insert({
    firm_id: cabinetId, name: "Tremblay", email: courrielClient,
    file_number: `DOS-${String(marque).slice(-6)}`, program: "Express Entry",
    status: "active", client_type: "individual",
  }).select("id").single()
  const { data: uu } = await admin.auth.admin.createUser({
    email: courrielClient, password: mdp, email_confirm: true,
  })
  userClient = uu.user.id
  await admin.from("client_users").insert({
    user_id: userClient, client_id: cl.id, firm_id: cabinetId, email: courrielClient,
  })

  const { data: m } = await admin.from("matters").insert({
    firm_id: cabinetId, client_id: cl.id, reference: `M-${marque}`,
    client_name: "Tremblay", program: "Express Entry", category: "pr",
    rcic: "Épreuve", status: "pending", client_type: "b2c",
  }).select("id").single()

  const { data: q, error: eq } = await admin.from("client_questionnaires").insert({
    firm_id: cabinetId, client_id: cl.id, matter_id: m.id,
    title: "Questionnaire de permis d'études", form_type: "study_permit",
    status: "in_progress",
    corrections: [{ sectionId: "identite", comment: "Date de naissance à revoir", status: "pending", requestedAt: new Date().toISOString() }],
    history: [{ userId: "consultant-1", userName: "Consultant", userType: "consultant", changedAt: new Date().toISOString(), sectionId: "identite", fieldKey: "nom", fieldName: "Nom", oldValue: "", newValue: "Tremblay" }],
  }).select("id").single()
  if (eq) throw new Error(`Questionnaire : ${eq.message}`)

  const portail = await session(courrielClient, mdp)
  const cabinet = await session(courrielConsultant, mdp)

  // -------------------------------------------------------------------------
  console.log("\nLa table existe et la fiche peut la lire")
  // -------------------------------------------------------------------------
  const { data: vuCabinet, error: eLecture } = await cabinet
    .from("client_questionnaires").select("id, title").eq("id", q.id)
  verifier("le cabinet lit le questionnaire", eLecture ? eLecture.message : vuCabinet.length, 1)

  const { data: vuClient } = await portail
    .from("client_questionnaires").select("id").eq("id", q.id)
  verifier("le client voit le sien", vuClient?.length ?? 0, 1)

  // -------------------------------------------------------------------------
  console.log("\nCe que le client PEUT faire")
  // -------------------------------------------------------------------------
  const { error: eRep } = await portail.from("client_questionnaires")
    .update({ answers: { nom: "Tremblay", prenom: "Marie" }, progress: 40 }).eq("id", q.id)
  verifier("répondre aux questions", eRep ? eRep.message : "ok", "ok")

  // -------------------------------------------------------------------------
  console.log("\nCe que le client NE PEUT PAS faire")
  // -------------------------------------------------------------------------
  const refus = async (intitule, patch) => {
    const { error } = await portail.from("client_questionnaires").update(patch).eq("id", q.id)
    verifier(intitule, error ? "refusé" : "ACCEPTÉ", "refusé")
  }

  await refus("effacer les demandes de correction", { corrections: [] })
  await refus("réécrire le journal des modifications", { history: [] })
  await refus("changer le titre du questionnaire", { title: "Autre chose" })
  await refus("changer le type de formulaire", { form_type: "pr" })
  await refus("se déclarer validé", { status: "validated" })
  await refus("verrouiller son questionnaire", { status: "locked" })

  const { data: apres } = await admin.from("client_questionnaires")
    .select("corrections, history, title, status, answers").eq("id", q.id).single()
  verifier("les corrections sont intactes", apres.corrections.length, 1)
  verifier("le journal est intact", apres.history.length, 1)
  verifier("le titre est intact", apres.title, "Questionnaire de permis d'études")
  verifier("les réponses, elles, ont bien été enregistrées", apres.answers.prenom, "Marie")

  // -------------------------------------------------------------------------
  console.log("\nCe que le cabinet, lui, peut faire")
  // -------------------------------------------------------------------------
  const { error: eVal } = await cabinet.from("client_questionnaires")
    .update({ status: "validated", corrections: [] }).eq("id", q.id)
  verifier("valider et solder les corrections", eVal ? eVal.message : "ok", "ok")

  // -------------------------------------------------------------------------
  console.log("\nCloisonnement")
  // -------------------------------------------------------------------------
  const { data: cabB } = await admin.from("firms").insert({
    name: `Cabinet tiers ${marque}`, rcic_license_number: `R555${String(marque).slice(-4)}`,
    owner_name: "Tiers", email: `tiers-${marque}@example.invalid`,
    plan: "cabinet", status: "active",
  }).select("id").single()
  await admin.from("firm_subscriptions").insert({
    firm_id: cabB.id, plan: "cabinet", cadence: "monthly", seats: 3,
    status: "active", stripe_customer_id: `cus_tiers_${marque}`,
  })
  const courrielTiers = `tiers-c-${marque}@example.invalid`
  const { data: ut } = await admin.auth.admin.createUser({
    email: courrielTiers, password: mdp, email_confirm: true,
  })
  await admin.from("profiles").insert({
    firm_id: cabB.id, user_id: ut.user.id, email: courrielTiers,
    full_name: "Tiers", cicc_role: "rcic",
  })
  const tiers = await session(courrielTiers, mdp)
  const { data: vuTiers } = await tiers.from("client_questionnaires").select("id").eq("id", q.id)
  verifier("un autre cabinet ne voit rien", vuTiers?.length ?? 0, 0)

  await admin.from("firms").delete().eq("id", cabB.id)
  await admin.auth.admin.deleteUser(ut.user.id)
} finally {
  if (cabinetId) await admin.from("firms").delete().eq("id", cabinetId)
  if (userConsultant) await admin.auth.admin.deleteUser(userConsultant)
  if (userClient) await admin.auth.admin.deleteUser(userClient)
  console.log("\nCabinets et comptes d'épreuve supprimés.")
}

console.log(echecs === 0 ? "\n✓ Questionnaires vérifiés, 0 échec." : `\n✗ ${echecs} échec(s).`)
process.exit(echecs === 0 ? 0 : 1)
