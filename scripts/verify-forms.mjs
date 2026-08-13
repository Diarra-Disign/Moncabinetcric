#!/usr/bin/env node
/**
 * Éprouve les formulaires officiels au dossier.
 *
 *   ./cric formulaires
 *
 * Deux choses distinctes sont vérifiées :
 *
 *   1. Le CIRCUIT — pré-remplissage, versions, statuts, cloisonnement. Il ne
 *      dépend d'aucun fichier extérieur et s'éprouve entièrement.
 *
 *   2. Le REMPLISSAGE d'un PDF à champs. Éprouvé sur un PDF fabriqué ici, dont
 *      les champs portent des noms aussi retors que ceux d'IRCC — un point,
 *      des crochets, un indice. Ce qui reste à prouver sur le vrai formulaire,
 *      c'est la correspondance de ses noms de champs, et elle ne se devine
 *      pas : elle se relève dans le fichier officiel, à l'importation.
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

let echecs = 0
function verifier(intitule, obtenu, attendu) {
  const ok = String(obtenu) === String(attendu)
  if (!ok) echecs++
  console.log(
    `  ${ok ? "✓" : "✗"} ${intitule.padEnd(52)} ${String(obtenu).padEnd(18)}` +
      (ok ? "" : ` ATTENDU ${attendu}`)
  )
}

async function main() {
  const env = await loadEnv()
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const { champsDuFormulaire, remplirFormulaire } = await import("../lib/forms/pdf.ts")
  const { PDFDocument } = await import("pdf-lib")

  const session = async (courriel, mdp) => {
    const c = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
    const { error } = await c.auth.signInWithPassword({ email: courriel, password: mdp })
    if (error) throw new Error(`Connexion ${courriel} : ${error.message}`)
    return c
  }

  const marque = Date.now()
  const mdp = "Epreuve-" + randomBytes(9).toString("base64url")
  const users = []
  let cab, cli, dossier

  try {
    // -----------------------------------------------------------------------
    console.log("Remplir un PDF à champs, sans en inventer aucun")
    // -----------------------------------------------------------------------
    // Un formulaire fabriqué ici, avec des noms de champs du même acabit que
    // ceux d'IRCC : point, crochets, indice.
    const doc = await PDFDocument.create()
    const page = doc.addPage([612, 792])
    const f = doc.getForm()
    f.createTextField("form1[0].Page1[0].NomFamille[0]").addToPage(page, { x: 50, y: 700, width: 200, height: 20 })
    f.createTextField("form1[0].Page1[0].Prenom[0]").addToPage(page, { x: 50, y: 660, width: 200, height: 20 })
    f.createTextField("form1[0].Page2[0].NomFamille[0]").addToPage(page, { x: 50, y: 620, width: 200, height: 20 })
    f.createTextField("form1[0].Page1[0].NumeroPermis[0]").addToPage(page, { x: 50, y: 580, width: 200, height: 20 })
    f.createCheckBox("form1[0].Page1[0].Consent[0]").addToPage(page, { x: 50, y: 540, width: 15, height: 15 })
    const vierge = await doc.save()

    const champs = await champsDuFormulaire(vierge)
    verifier("les champs se relèvent dans le fichier", champs.length, 5)
    verifier("leurs types sont reconnus",
      champs.filter((c) => c.type === "texte").length + "t/" + champs.filter((c) => c.type === "case").length + "c",
      "4t/1c")

    const correspondance = {
      "form1[0].Page1[0].NomFamille[0]": "client_nom",
      "form1[0].Page2[0].NomFamille[0]": "client_nom",
      "form1[0].Page1[0].Prenom[0]": "client_prenom",
      "form1[0].Page1[0].NumeroPermis[0]": "representant_permis",
      "form1[0].Page1[0].Consent[0]": "consentement",
      "form1[0].Page1[0].ChampInexistant[0]": "client_courriel",
    }

    const r = await remplirFormulaire({
      pdf: vierge,
      correspondance,
      donnees: { client_nom: "Tremblay", client_prenom: "Marie", consentement: "oui" },
    })

    verifier("les champs présents sont remplis", r.remplis.length, 4)
    verifier("un même renseignement alimente deux pages",
      r.remplis.filter((c) => c.includes("NomFamille")).length, 2)
    verifier("un champ absent du PDF est signalé", r.introuvables.length, 1)
    // client_courriel n'apparaît PLUS ici : son champ n'existe pas dans le
    // PDF, il est donc signalé comme introuvable et la donnée n'est jamais
    // cherchée. Les deux causes ne se confondent plus — « la correspondance
    // est périmée » et « la donnée manque » n'appellent pas la même correction.
    verifier("une donnée absente laisse la case VIDE et se signale",
      r.manquantes.join(","), "representant_permis")

    // Le contrôle qui compte : la valeur est-elle vraiment dans le fichier ?
    const relu = await PDFDocument.load(r.pdf)
    verifier("la valeur est bien écrite dans le PDF",
      relu.getForm().getTextField("form1[0].Page1[0].NomFamille[0]").getText(), "Tremblay")
    verifier("la case cochée l'est réellement",
      relu.getForm().getCheckBox("form1[0].Page1[0].Consent[0]").isChecked(), true)
    verifier("le champ sans donnée est resté vide",
      relu.getForm().getTextField("form1[0].Page1[0].NumeroPermis[0]").getText() ?? "", "")

    const aplati = await remplirFormulaire({
      pdf: vierge, correspondance, donnees: { client_nom: "Tremblay" }, aplatir: true,
    })
    const fige = await PDFDocument.load(aplati.pdf)
    verifier("aplati, le formulaire n'est plus modifiable", fige.getForm().getFields().length, 0)

    // -----------------------------------------------------------------------
    // Le décor
    // -----------------------------------------------------------------------
    const { data: fr } = await admin.from("firms").insert({
      name: `Cabinet formulaires ${marque}`,
      rcic_license_number: `R51${String(marque).slice(-4)}`,
      owner_name: "Adama Diarra", email: `form-${marque}@example.invalid`,
      phone: "819-555-0100", address: "88 Rue Dollard-Des Ormeaux, Gatineau",
      plan: "cabinet", status: "active",
    }).select("id").single()
    cab = fr.id
    await admin.from("firm_subscriptions").insert({
      firm_id: cab, plan: "cabinet", cadence: "monthly", seats: 3,
      status: "active", stripe_customer_id: `cus_form_${marque}`,
    })

    const creerMembre = async (nom, role) => {
      const courriel = `${nom}-${marque}@example.invalid`
      const { data } = await admin.auth.admin.createUser({ email: courriel, password: mdp, email_confirm: true })
      const { data: p } = await admin.from("profiles").insert({
        firm_id: cab, user_id: data.user.id, email: courriel,
        full_name: `${nom} d'épreuve`, cicc_role: role,
      }).select("id").single()
      users.push(data.user.id)
      return { userId: data.user.id, profileId: p.id, s: await session(courriel, mdp) }
    }
    const consultant = await creerMembre("consultant", "rcic")
    const lecteur = await creerMembre("lecteur", "readonly")

    const { data: c } = await admin.from("clients").insert({
      firm_id: cab, name: "Marie Tremblay", first_name: "Marie", last_name: "Tremblay",
      email: `tremblay-${marque}@example.invalid`, phone: "514-555-0199",
      citizenship: "Française", residence: "France", province: "QC",
      file_number: `DOS-${String(marque).slice(-6)}`, program: "Express Entry",
      status: "active", client_type: "individual",
    }).select("id").single()
    cli = c.id

    const { data: m } = await admin.from("matters").insert({
      firm_id: cab, client_id: cli, reference: `M-${marque}`,
      client_name: "Marie Tremblay", program: "Express Entry", category: "pr",
      rcic: "Adama Diarra", status: "pending", client_type: "b2c",
      opened_date: new Date().toISOString().slice(0, 10),
    }).select("id").single()
    dossier = m.id

    // -----------------------------------------------------------------------
    console.log("\nLe pré-remplissage vient du dossier, jamais d'une saisie")
    // -----------------------------------------------------------------------
    const { data: pre } = await admin.rpc("form_prefill", { m_id: dossier })
    verifier("le nom du client", pre.client_nom, "Tremblay")
    verifier("le prénom", pre.client_prenom, "Marie")
    verifier("le numéro de dossier", pre.dossier_reference, `M-${marque}`)
    verifier("le représentant", pre.representant_nom, "Adama Diarra")
    verifier("son numéro de permis", pre.representant_permis, `R51${String(marque).slice(-4)}`)
    verifier("l'organisme de réglementation", pre.representant_organisme, "CCIC")

    // -----------------------------------------------------------------------
    console.log("\nOuvrir un exemplaire, puis le corriger")
    // -----------------------------------------------------------------------
    const { data: id1, error: e1 } = await consultant.s.rpc("open_matter_form", { p_matter: dossier, p_code: "IMM5476" })
    verifier("l'exemplaire s'ouvre", e1 ? e1.message : "ok", "ok")

    const { data: ex1 } = await admin.from("matter_forms").select("*").eq("id", id1).single()
    verifier("version 1", ex1.version, 1)
    verifier("statut « en préparation »", ex1.status, "in_preparation")
    verifier("les données sont pré-remplies", ex1.data.client_nom, "Tremblay")

    await consultant.s.from("matter_forms")
      .update({ status: "sent_to_client" }).eq("id", id1)
    const { data: envoye } = await admin.from("matter_forms").select("sent_at, status").eq("id", id1).single()
    verifier("la date d'envoi se pose d'office", envoye.sent_at !== null, true)

    await consultant.s.from("matter_forms").update({ status: "signed" }).eq("id", id1)
    const { data: signe } = await admin.from("matter_forms").select("signed_at").eq("id", id1).single()
    verifier("la date de signature aussi", signe.signed_at !== null, true)

    // Une correction ouvre une version 2 et archive la 1.
    const { data: id2 } = await consultant.s.rpc("open_matter_form", { p_matter: dossier, p_code: "IMM5476" })
    const { data: toutes } = await admin.from("matter_forms")
      .select("version, status").eq("matter_id", dossier).order("version")
    verifier("deux versions coexistent", toutes.length, 2)
    verifier("la première est archivée, pas supprimée", toutes[0].status, "archived")
    verifier("la seconde est en préparation", toutes[1].status, "in_preparation")
    verifier("elle reprend les données de la précédente",
      (await admin.from("matter_forms").select("data").eq("id", id2).single()).data.data.client_nom, "Tremblay")

    // -----------------------------------------------------------------------
    console.log("\nCe qui est refusé")
    // -----------------------------------------------------------------------
    const { error: eLecteur } = await lecteur.s.rpc("open_matter_form", { p_matter: dossier, p_code: "IMM5476" })
    verifier("un lecteur seul ne peut pas ouvrir d'exemplaire", eLecteur ? "refusé" : "ACCEPTÉ", "refusé")

    const { data: pdfManquant } = await admin.from("form_definitions")
      .select("code, blank_path").eq("code", "IMM5476").single()
    verifier("le PDF officiel n'est pas encore importé", pdfManquant.blank_path, null)
  } finally {
    if (cab) await admin.rpc("purger_cabinet_epreuve", { p_firm_id: cab })
    for (const u of users) await admin.auth.admin.deleteUser(u).catch(() => {})
    console.log("\nCabinet, dossier et comptes d'épreuve supprimés.")
  }

  console.log(echecs === 0 ? "\n✓ Formulaires vérifiés, 0 échec." : `\n✗ ${echecs} échec(s).`)
  process.exit(echecs === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error("\nÉchec :", e.message)
  process.exit(1)
})
