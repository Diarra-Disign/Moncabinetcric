#!/usr/bin/env node
/**
 * Le cloisonnement des fonctions qui reçoivent un cabinet en paramètre.
 *
 * Une fonction `security definer` s'exécute avec les pleins pouvoirs. Quand
 * elle reçoit en plus le cabinet à lire, le paramètre EST la faille : il
 * suffit de lui nommer celui du voisin.
 *
 * Cette épreuve tient les DEUX bords, et le second compte autant que le
 * premier :
 *
 *   · un membre du cabinet A ne doit RIEN obtenir du cabinet B ;
 *   · un membre du cabinet A doit continuer de tout obtenir du SIEN.
 *
 * Une garde qui ferme aussi la porte au propriétaire légitime n'est pas une
 * correction, c'est une panne.
 */
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const env = Object.fromEntries(
  readFileSync(join(ROOT, ".env.local"), "utf8")
    .split("\n")
    .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")])
)

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

let echecs = 0
const verifier = (intitule, obtenu, attendu) => {
  const ok = String(obtenu) === String(attendu)
  if (!ok) echecs++
  console.log(`  ${ok ? "✓" : "✗"} ${intitule.padEnd(56)} ${String(obtenu).slice(0, 30)}` +
    (ok ? "" : `\n      ATTENDU ${attendu}`))
}

const marque = Date.now()
let cabA, cabB, userA, temoins = []

const sessionPour = async (courriel) => {
  const { data: lien } = await admin.auth.admin.generateLink({ type: "magiclink", email: courriel })
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  })
  const { data, error } = await anon.auth.verifyOtp({
    token_hash: lien.properties.hashed_token, type: "magiclink",
  })
  if (error) throw error
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
  })
}

const creerCabinet = async (suffixe) => {
  // Le permis n'accepte que des chiffres après le R : une lettre ici faisait
  // échouer l'insertion en silence, et le script tombait trois lignes plus bas
  // sur un `null` dont la cause était invisible.
  const rang = suffixe === "A" ? "1" : "2"
  const { data: f, error: eF } = await admin.from("firms").insert({
    name: `Cabinet cloison ${suffixe} ${marque}`,
    rcic_license_number: `R77${rang}${String(marque).slice(-4)}`,
    owner_name: "Épreuve", email: `cl-${suffixe}-${marque}@example.invalid`,
    plan: "courtoisie", status: "active",
  }).select("id").single()
  if (eF) throw new Error(`Cabinet ${suffixe} : ${eF.message}`)
  const { data: c } = await admin.from("clients").insert({
    firm_id: f.id, name: `Client secret ${suffixe}`,
    email: `cs-${suffixe}-${marque}@example.invalid`,
    file_number: `CL-${suffixe}`, program: "RP", status: "active", client_type: "individual",
  }).select("id").single()
  await admin.from("trust_ledger").insert({
    firm_id: f.id, client_id: c.id, entry_type: "deposit",
    amount: suffixe === "A" ? 1111 : 9999, occurred_on: "2026-08-16", memo: `Témoin ${suffixe}`,
  })
  return { firmId: f.id, clientId: c.id }
}

try {
  cabA = await creerCabinet("A")
  cabB = await creerCabinet("B")

  const courriel = `membre-a-${marque}@example.invalid`
  const { data: u } = await admin.auth.admin.createUser({
    email: courriel, password: `Epreuve-Cloison-${marque}!aA1`, email_confirm: true,
  })
  userA = u.user.id
  await admin.from("profiles").insert({
    firm_id: cabA.firmId, user_id: userA, email: courriel,
    full_name: "Membre du cabinet A", cicc_role: "owner",
  })

  const membreA = await sessionPour(courriel)

  // =========================================================================
  console.log("\nLe membre du cabinet A voit SON cabinet — rien n'est cassé")
  // =========================================================================
  const { data: soldeA } = await membreA.rpc("firm_trust_balance", { f_id: cabA.firmId })
  verifier("son solde de fidéicommis lui est rendu", soldeA, 1111)

  const { data: parClientA } = await membreA.rpc("firm_trust_by_client", { f_id: cabA.firmId })
  verifier("la ventilation par client lui est rendue", parClientA?.length, 1)

  const { data: registreA } = await membreA.rpc("firm_trust_ledger_view", { f_id: cabA.firmId })
  verifier("son registre lui est rendu", registreA?.length, 1)

  const { data: echA } = await membreA.rpc("firm_deadlines_view", { f_id: cabA.firmId })
  verifier("ses échéances lui sont rendues (liste vide, sans erreur)", Array.isArray(echA), true)

  const { data: facA } = await membreA.rpc("firm_invoices_view", { f_id: cabA.firmId })
  verifier("ses factures lui sont rendues (liste vide, sans erreur)", Array.isArray(facA), true)

  // =========================================================================
  console.log("\nLe même membre ne voit RIEN du cabinet B")
  // =========================================================================
  const { data: soldeB } = await membreA.rpc("firm_trust_balance", { f_id: cabB.firmId })
  verifier("le solde du voisin ne fuit plus", Number(soldeB), 0)

  const { data: parClientB } = await membreA.rpc("firm_trust_by_client", { f_id: cabB.firmId })
  verifier("aucun NOM de client du voisin", parClientB?.length ?? 0, 0)

  const { data: registreB } = await membreA.rpc("firm_trust_ledger_view", { f_id: cabB.firmId })
  verifier("aucune écriture du voisin", registreB?.length ?? 0, 0)

  const { data: facB } = await membreA.rpc("firm_invoices_view", { f_id: cabB.firmId })
  verifier("aucune facture du voisin", facB?.length ?? 0, 0)

  const { data: echB } = await membreA.rpc("firm_deadlines_view", { f_id: cabB.firmId })
  verifier("aucune échéance du voisin", echB?.length ?? 0, 0)

  const { data: alB } = await membreA.rpc("firm_deadline_alerts", { f_id: cabB.firmId })
  const aucuneAlerte = (alB ?? []).every((r) => !r.depassees && !r.aujourdhui && !r.a_venir)
  verifier("aucun décompte d'échéances du voisin", aucuneAlerte, true)

  // =========================================================================
  console.log("\nÉcrire chez le voisin — la notification refuse bruyamment")
  // =========================================================================
  const { error: eNotif } = await membreA.rpc("notifier", {
    p_firm_id: cabB.firmId, p_kind: "system",
    p_title: "Votre accès expire", p_body: "Cliquez ici",
    p_link: "https://hameconnage.example/voler",
  })
  verifier("déposer une notification chez le voisin est refusé", Boolean(eNotif), true)
  verifier("et le refus est explicite", /pas le v[ôo]tre|42501/.test(String(eNotif?.message ?? "") + String(eNotif?.code ?? "")), true)

  const { data: idNotif, error: eSienne } = await membreA.rpc("notifier", {
    p_firm_id: cabA.firmId, p_kind: "system", p_title: "Chez moi", p_body: "",
  })
  verifier("mais notifier SON cabinet fonctionne toujours", Boolean(idNotif) && !eSienne, true)
  if (idNotif) temoins.push(idNotif)

  // =========================================================================
  console.log("\nLa clé de service garde tous ses droits")
  // =========================================================================
  const { data: svcB } = await admin.rpc("firm_trust_balance", { f_id: cabB.firmId })
  verifier("le service lit le cabinet B", Number(svcB), 9999)
  const { data: svcReg } = await admin.rpc("firm_trust_ledger_view", { f_id: cabB.firmId })
  verifier("et son registre", svcReg?.length, 1)

  // =========================================================================
  console.log("\nLe chemin ANONYME des déclencheurs reste ouvert")
  // =========================================================================
  // C'est la régression qu'une garde trop brutale aurait provoquée : les six
  // déclencheurs de questionnaire appellent notifier(), et le questionnaire
  // public est rempli par un candidat sans compte, avec la clé anonyme.
  const anonPur = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  })
  const { error: eAnon } = await anonPur.rpc("notifier", {
    p_firm_id: cabA.firmId, p_kind: "system", p_title: "Depuis l'anonyme", p_body: "",
  })
  verifier("anon ne peut pas appeler notifier directement", Boolean(eAnon), true)
} finally {
  for (const id of temoins) await admin.from("notifications").delete().eq("id", id)
  for (const c of [cabA, cabB]) {
    if (c?.firmId) await admin.rpc("purger_cabinet_epreuve", { p_firm_id: c.firmId })
  }
  if (userA) await admin.auth.admin.deleteUser(userA)
  console.log("\nCabinets et compte d'épreuve supprimés.")
}

console.log(echecs === 0
  ? "\n✓ Cloisonnement vérifié, 0 échec."
  : `\n✗ ${echecs} échec(s) — une fonction sert encore le cabinet qu'on lui nomme.`)
process.exit(echecs === 0 ? 0 : 1)
