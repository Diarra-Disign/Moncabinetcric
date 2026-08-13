#!/usr/bin/env node
/**
 * Éprouve les échéances du dossier.
 *
 *   ./cric echeances
 *
 * Le contrôle qui compte n'est pas « l'échéance s'enregistre-t-elle » — c'est
 * que matters.deadline, que lisent déjà les listes et le calcul d'urgence, ne
 * puisse plus contredire la table. Deux dates qui prétendent dire la même
 * chose finissent toujours par diverger, et c'est celle qui rassure qu'on
 * croit.
 */

import { readFile } from "node:fs/promises"
import { randomBytes } from "node:crypto"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

async function loadEnv() {
  const raw = await readFile(join(ROOT, ".env.local"), "utf8")
  const env = {}
  for (const l of raw.split("\n")) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }
  return env
}

const jour = (decalage) =>
  new Date(Date.now() + decalage * 86400000).toISOString().slice(0, 10)

let echecs = 0
function verifier(intitule, obtenu, attendu) {
  const ok = String(obtenu) === String(attendu)
  if (!ok) echecs++
  console.log(
    `  ${ok ? "✓" : "✗"} ${intitule.padEnd(52)} ${String(obtenu).padEnd(12)}` +
      (ok ? "" : ` ATTENDU ${attendu}`)
  )
}

async function main() {
  const env = await loadEnv()
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

  const commeUtilisateur = async (courriel, mdp) => {
    const c = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
    const { error } = await c.auth.signInWithPassword({ email: courriel, password: mdp })
    if (error) throw new Error(`Connexion ${courriel} : ${error.message}`)
    return c
  }

  const marque = Date.now()
  const mdp = "Epreuve-" + randomBytes(9).toString("base64url")
  const comptes = []
  let cabinetA, cabinetB, clientA, dossier

  try {
    const creerCabinet = async (chiffre) => {
      const { data, error } = await admin.from("firms").insert({
        name: `Cabinet échéances ${chiffre} ${marque}`,
        rcic_license_number: `R7${chiffre}${String(marque).slice(-4)}`,
        owner_name: "Épreuve", email: `ech-${chiffre}-${marque}@example.invalid`,
        plan: "cabinet", status: "active",
      }).select("id").single()
      if (error) throw new Error(`Cabinet : ${error.message}`)
      await admin.from("firm_subscriptions").insert({
        firm_id: data.id, plan: "cabinet", cadence: "monthly", seats: 3,
        status: "active", stripe_customer_id: `cus_ech_${chiffre}_${marque}`,
      })
      return data.id
    }
    cabinetA = await creerCabinet(1)
    cabinetB = await creerCabinet(2)

    const creerMembre = async (nom, firmId, role) => {
      const courriel = `${nom}-${marque}@example.invalid`
      const { data, error } = await admin.auth.admin.createUser({
        email: courriel, password: mdp, email_confirm: true,
      })
      if (error) throw new Error(`Compte ${nom} : ${error.message}`)
      const { data: prof } = await admin.from("profiles").insert({
        firm_id: firmId, user_id: data.user.id, email: courriel,
        full_name: `${nom} d'épreuve`, cicc_role: role,
      }).select("id").single()
      const c = { nom, userId: data.user.id, profileId: prof.id, session: await commeUtilisateur(courriel, mdp) }
      comptes.push(c)
      return c
    }
    const consultant = await creerMembre("consultant", cabinetA, "rcic")
    const adjointe = await creerMembre("adjointe", cabinetA, "staff")
    const intrus = await creerMembre("intrus", cabinetB, "owner")

    const { data: cl } = await admin.from("clients").insert({
      firm_id: cabinetA, name: "Tremblay", email: `tremblay-${marque}@example.invalid`,
      file_number: `DOS-${String(marque).slice(-6)}`, program: "Express Entry",
      status: "active", client_type: "individual",
    }).select("id").single()
    clientA = cl.id

    // -----------------------------------------------------------------------
    console.log("La date déjà portée par le dossier n'est pas perdue")
    // -----------------------------------------------------------------------
    // Une règle de programme, pour vérifier qu'elle produit bien une occurrence.
    await admin.from("deadline_rules").insert({
      firm_id: cabinetA, program: "Express Entry",
      step_name: "Dépôt de la demande complète", delay_days: 60, is_regulatory: true,
    })

    const { data: m, error: em } = await admin.from("matters").insert({
      firm_id: cabinetA, client_id: clientA, reference: `M-${marque}`,
      client_name: "Tremblay", program: "Express Entry", category: "pr",
      rcic: "Épreuve", status: "pending", client_type: "b2c",
      opened_date: jour(0), deadline: jour(90),
    }).select("id").single()
    if (em) throw new Error(`Dossier : ${em.message}`)
    dossier = m.id

    const vue = async () => {
      const { data } = await admin.rpc("matter_deadlines_view", { m_id: dossier })
      return data ?? []
    }
    const dateDossier = async () => {
      const { data } = await admin.from("matters").select("deadline").eq("id", dossier).single()
      return data.deadline
    }

    const auDepart = await vue()
    // Deux échéances : celle saisie à l'ouverture, et celle qu'engendre la
    // règle du programme. Le premier jet n'en produisait qu'une, et la date
    // saisie disparaissait sans erreur ni trace — la projection ne connaît
    // que la table, et 90 jours était plus lointain que les 60 de la règle.
    verifier("la date saisie devient une échéance", 
      auDepart.some((d) => d.title === "Échéance principale" && d.due_on === jour(90)), true)
    verifier("la règle du programme en produit une seconde", auDepart.length, 2)
    const regle = auDepart.find((d) => d.title === "Dépôt de la demande complète")
    verifier("elle porte le nom de l'étape", regle?.title, "Dépôt de la demande complète")
    verifier("elle est marquée réglementaire", regle?.is_regulatory, true)
    verifier("échue 60 jours après l'ouverture", regle?.due_on, jour(60))

    // -----------------------------------------------------------------------
    console.log("\nmatters.deadline devient une projection, jamais une seconde vérité")
    // -----------------------------------------------------------------------
    verifier("la date du dossier suit la plus proche", await dateDossier(), jour(60))

    const { error: eAjout } = await consultant.session.from("matter_deadlines").insert({
      firm_id: cabinetA, matter_id: dossier, title: "Examen médical",
      due_on: jour(20), priority: "high", assignee_id: adjointe.profileId,
    })
    verifier("une échéance plus proche s'ajoute", eAjout ? eAjout.message : "ok", "ok")
    verifier("la date du dossier se réaligne", await dateDossier(), jour(20))

    const { data: apresAjout } = await admin.rpc("matter_deadlines_view", { m_id: dossier })
    const medical = apresAjout.find((d) => d.title === "Examen médical")
    verifier("le responsable est nommé", medical.assignee_name, "adjointe d'épreuve")
    verifier("la priorité est conservée", medical.priority, "high")

    // -----------------------------------------------------------------------
    console.log("\n« En retard » se déduit, il ne se stocke pas")
    // -----------------------------------------------------------------------
    await consultant.session.from("matter_deadlines").insert({
      firm_id: cabinetA, matter_id: dossier, title: "Biométrie", due_on: jour(-3),
    })
    const enRetard = (await vue()).find((d) => d.title === "Biométrie")
    verifier("une date passée devient « en retard »", enRetard.status, "overdue")
    verifier("sans qu'aucun traitement de nuit ne tourne", enRetard.completed_at, null)
    verifier("et elle passe en tête de liste", (await vue())[0]?.title, "Biométrie")

    // -----------------------------------------------------------------------
    console.log("\nLes alertes du cabinet")
    // -----------------------------------------------------------------------
    await consultant.session.from("matter_deadlines").insert({
      firm_id: cabinetA, matter_id: dossier, title: "Appel du client", due_on: jour(0),
    })
    const { data: alertes } = await admin.rpc("firm_deadline_alerts", { f_id: cabinetA, jours: 7 })
    const a = Array.isArray(alertes) ? alertes[0] : alertes
    verifier("dépassées", a.depassees, 1)
    verifier("aujourd'hui", a.aujourdhui, 1)
    verifier("à venir sous 7 jours", a.a_venir, 0)

    // -----------------------------------------------------------------------
    console.log("\nTerminer, puis rouvrir")
    // -----------------------------------------------------------------------
    const bio = (await vue()).find((d) => d.title === "Biométrie")
    await consultant.session.from("matter_deadlines")
      .update({ status: "done", completed_by: consultant.profileId }).eq("id", bio.id)

    const termine = (await vue()).find((d) => d.title === "Biométrie")
    verifier("le statut passe à « terminé »", termine.status, "done")
    verifier("la date de réalisation est posée d'office", termine.completed_at !== null, true)
    verifier("elle sort du compte des dépassées",
      (Array.isArray(await admin.rpc("firm_deadline_alerts", { f_id: cabinetA }).then(r => r.data))
        ? (await admin.rpc("firm_deadline_alerts", { f_id: cabinetA })).data[0]
        : (await admin.rpc("firm_deadline_alerts", { f_id: cabinetA })).data).depassees, 0)

    await consultant.session.from("matter_deadlines")
      .update({ status: "todo" }).eq("id", bio.id)
    const rouverte = (await vue()).find((d) => d.title === "Biométrie")
    verifier("rouverte, la date de réalisation s'efface", rouverte.completed_at, null)
    verifier("et elle redevient « en retard »", rouverte.status, "overdue")

    // -----------------------------------------------------------------------
    console.log("\nLa dernière échéance retirée laisse le dossier sans date")
    // -----------------------------------------------------------------------
    await admin.from("matter_deadlines").delete().eq("matter_id", dossier)
    verifier("plus aucune échéance", (await vue()).length, 0)
    verifier("la date du dossier est vidée", await dateDossier(), null)

    // -----------------------------------------------------------------------
    console.log("\nCloisonnement")
    // -----------------------------------------------------------------------
    await consultant.session.from("matter_deadlines").insert({
      firm_id: cabinetA, matter_id: dossier, title: "Confidentielle", due_on: jour(5),
    })
    const { data: vues } = await intrus.session.from("matter_deadlines").select("id")
    verifier("un autre cabinet ne voit rien", vues?.length ?? 0, 0)

    const avant = (await vue())[0].due_on
    await intrus.session.from("matter_deadlines")
      .update({ due_on: jour(99) }).eq("matter_id", dossier)
    verifier("ni ne peut rien déplacer", (await vue())[0].due_on, avant)
  } finally {
    for (const id of [cabinetA, cabinetB]) if (id) await admin.rpc("purger_cabinet_epreuve", { p_firm_id: id })
    for (const c of comptes) await admin.auth.admin.deleteUser(c.userId).catch(() => {})
    console.log("\nCabinets, dossiers et comptes d'épreuve supprimés.")
  }

  console.log(echecs === 0 ? "\n✓ Échéances vérifiées, 0 échec." : `\n✗ ${echecs} échec(s).`)
  process.exit(echecs === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error("\nÉchec :", e.message)
  process.exit(1)
})
