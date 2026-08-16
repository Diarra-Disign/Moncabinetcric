#!/usr/bin/env node
/**
 * Éprouve la seule politique du schéma qui doit fonctionner ALORS QUE
 * L'ACCÈS EST FERMÉ.
 *
 *   ./cric demande-aide --firm=R2233456
 *
 * ─── POURQUOI CETTE ÉPREUVE EXISTE ─────────────────────────────────────────
 *
 * `current_firm_id()` renvoie NULL dès que firm_access_open() est faux. C'est
 * ce qui ferme les trente autres politiques d'un seul coup, sans qu'aucune
 * n'ait à y penser — et c'est très bien ainsi.
 *
 * `support_requests` est l'exception, et elle est fragile pour une raison
 * précise : elle repose sur `current_firm_id_unchecked()`, une fonction que
 * personne n'a de raison d'employer ailleurs. Quiconque « harmonisera » un
 * jour les politiques du schéma la remplacera par la version normale en
 * croyant corriger un oubli. Rien ne cassera visiblement. Les cabinets à jour
 * continueront d'écrire — ils ont accès à tout — et seuls les cabinets
 * BLOQUÉS verront leur demande refusée. C'est-à-dire exactement ceux pour
 * qui la table existe, et les seuls qui ne pourront pas le signaler.
 *
 * ─── CE QUE CE SCRIPT FAIT AU CABINET VISÉ ─────────────────────────────────
 *
 * Il FERME MOMENTANÉMENT SON ACCÈS — c'est la seule façon d'éprouver la
 * chose. Le forfait d'origine est rétabli dans un `finally`, y compris si
 * une vérification échoue en cours de route. À n'exécuter que sur un cabinet
 * d'épreuve : pendant quelques secondes, ses membres sont dehors.
 *
 * Le permis est donc OBLIGATOIRE et sans valeur par défaut : personne ne doit
 * pouvoir fermer un cabinet par une commande tapée sans argument.
 */

import { readFile } from "node:fs/promises"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const args = process.argv.slice(2)
const valeurDe = (n) => args.find((a) => a.startsWith(`--${n}=`))?.split("=").slice(1).join("=")

const permis = valeurDe("firm")
if (!permis) {
  console.error(
    "Permis obligatoire : ./cric demande-aide --firm=R2233456\n" +
      "Ce script ferme momentanément l'accès du cabinet visé — n'employez qu'un cabinet d'épreuve."
  )
  process.exit(2)
}

// Les scripts de ce dossier lisent .env.local eux-mêmes : `./cric` pose le
// chemin de node, pas l'environnement.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const env = {}
for (const ligne of (await readFile(join(ROOT, ".env.local"), "utf8")).split("\n")) {
  const m = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "")
}

const URL = env.NEXT_PUBLIC_SUPABASE_URL
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !ANON || !SERVICE) {
  console.error("Configuration Supabase incomplète (.env.local).")
  process.exit(2)
}

const svc = createClient(URL, SERVICE, { auth: { persistSession: false } })

let echecs = 0
const verifier = (quoi, ok, detail = "") => {
  if (!ok) echecs++
  console.log(`  ${ok ? "✓" : "✗"} ${quoi.padEnd(52)} ${detail}`)
}

const { data: cabinet } = await svc
  .from("firms")
  .select("id, name, plan, trial_ends_at")
  .eq("rcic_license_number", permis)
  .maybeSingle()

if (!cabinet) {
  console.error(`Aucun cabinet au permis « ${permis} ».`)
  process.exit(2)
}

const FIRM = cabinet.id
let membre = null

try {
  // ─── 1. Reconstituer l'impasse ───────────────────────────────────────────
  // Forfait payant sans abonnement en règle : firm_access_open() doit tomber.
  await svc.from("firms").update({ plan: "solo", trial_ends_at: null }).eq("id", FIRM)
  const { data: ouvert } = await svc.rpc("firm_access_open", { f_id: FIRM })

  console.log(`\nL'impasse est reconstituée sur « ${cabinet.name} »`)
  verifier("firm_access_open est faux", ouvert === false, "(forfait payant, aucun abonnement en règle)")

  // ─── 2. Une session au nom d'un membre, sans mot de passe ni courriel ────
  const { data: prof } = await svc
    .from("profiles")
    .select("user_id, email")
    .eq("firm_id", FIRM)
    .eq("status", "active")
    .limit(1)
    .maybeSingle()

  if (!prof) throw new Error("Ce cabinet n'a aucun membre actif : rien à éprouver.")

  const { data: lien } = await svc.auth.admin.generateLink({ type: "magiclink", email: prof.email })
  membre = createClient(URL, ANON, { auth: { persistSession: false } })
  const { data: sess } = await membre.auth.verifyOtp({
    type: "magiclink",
    token_hash: lien?.properties?.hashed_token,
  })

  console.log("\nSession d'un membre bloqué")
  verifier("session ouverte", Boolean(sess?.session), prof.email)
  if (!sess?.session) throw new Error("Session impossible : le reste n'aurait aucun sens.")

  // Le témoin négatif. Sans lui, une épreuve qui passe ne prouverait rien :
  // peut-être l'accès n'était-il pas fermé du tout.
  const { data: clients } = await membre.from("clients").select("id").limit(1)
  verifier("les autres tables refusent bien", (clients ?? []).length === 0, "(current_firm_id() est NULL)")

  // ─── 3. LE POINT DE LA MIGRATION ────────────────────────────────────────
  console.log("\nLa demande d'aide, écrite depuis l'impasse")
  const { data: cree, error: eIns } = await membre
    .from("support_requests")
    .insert({
      firm_id: FIRM,
      requested_by: sess.session.user.id,
      requester_name: "Épreuve du verrou",
      requester_email: prof.email,
      firm_plan: "solo",
      firm_status: "active",
      subscription_status: "canceled",
      message: "Épreuve automatique de ./cric demande-aide — cette ligne est effacée aussitôt.",
      locale: "fr",
    })
    .select("id")
    .maybeSingle()

  verifier("l'insertion est ACCEPTÉE", Boolean(cree) && !eIns, eIns ? eIns.message : "")

  // ─── 4. Ce que le cabinet ne doit PAS pouvoir faire ─────────────────────
  const { error: eDouble } = await membre.from("support_requests").insert({
    firm_id: FIRM,
    requester_name: "doublon",
    requester_email: prof.email,
    message: "Seconde demande, qui doit être refusée.",
    locale: "fr",
  })
  verifier(
    "une seconde demande en attente est refusée",
    eDouble?.code === "23505",
    eDouble?.code ?? "ACCEPTÉE — l'index unique manque"
  )

  if (cree) {
    const { data: maj } = await membre
      .from("support_requests")
      .update({ status: "handled" })
      .eq("id", cree.id)
      .select("id")
    verifier("le cabinet ne classe pas sa propre demande", (maj ?? []).length === 0)
  }

  const { data: relu } = await membre.from("support_requests").select("id")
  verifier("mais il relit ce qu'il a envoyé", (relu ?? []).length === 1, "(un refus muet ferait recommencer)")

  const autre = createClient(URL, ANON, { auth: { persistSession: false } })
  const { data: anonyme } = await autre.from("support_requests").select("id")
  verifier("un visiteur anonyme ne lit rien", (anonyme ?? []).length === 0)
} finally {
  // Le rétablissement passe AVANT tout compte rendu : un script interrompu
  // ne doit pas laisser un cabinet dehors.
  if (membre) await membre.auth.signOut().catch(() => {})
  await svc.from("support_requests").delete().eq("firm_id", FIRM)
  await svc
    .from("firms")
    .update({ plan: cabinet.plan, trial_ends_at: cabinet.trial_ends_at })
    .eq("id", FIRM)

  const { data: rouvert } = await svc.rpc("firm_access_open", { f_id: FIRM })
  console.log("\nRemise en état")
  verifier(`forfait rendu à « ${cabinet.plan} »`, rouvert === true, "accès rouvert")
}

console.log(echecs === 0 ? "\n✓ Demande d'aide vérifiée, 0 échec." : `\n✗ ${echecs} échec(s).`)
process.exit(echecs === 0 ? 0 : 1)
