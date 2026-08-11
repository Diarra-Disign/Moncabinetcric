#!/usr/bin/env node
/**
 * Éprouve la bibliothèque de questionnaires contre la base réelle.
 *
 * Ce que ce script cherche à prendre en défaut, dans l'ordre :
 *
 * 1. L'EMPREINTE. Le jeton est haché par Node à l'envoi et par Postgres à
 *    l'ouverture. Si les deux calculs divergent d'un octet, TOUS les liens
 *    émis sont refusés — et rien d'autre ne le signalerait, puisque chaque
 *    moitié fonctionne parfaitement de son côté.
 *
 * 2. Ce qu'un destinataire ne peut pas faire. Row Level Security n'attribue
 *    que des lignes ; les colonnes sont gardées par un déclencheur, dont le
 *    corps PL/pgSQL n'est analysé qu'à sa PREMIÈRE EXÉCUTION.
 *
 * 3. Le cloisonnement. Un jeton n'ouvre qu'un questionnaire ; un cabinet ne
 *    voit pas les envois d'un autre.
 */
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { randomBytes, createHash } from "node:crypto"
import { createClient } from "@supabase/supabase-js"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const env = Object.fromEntries(
  [...readFileSync(join(ROOT, ".env.local"), "utf8").matchAll(/^([A-Z0-9_]+)=(.*)$/gm)]
    .map((m) => [m[1], m[2].trim()])
)

const url = env.NEXT_PUBLIC_SUPABASE_URL
const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const anon = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })

const session = async (courriel, mdp) => {
  const c = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  const { error } = await c.auth.signInWithPassword({ email: courriel, password: mdp })
  if (error) throw new Error(`Connexion ${courriel} : ${error.message}`)
  return c
}

let echecs = 0
/** Comparaison de structures indépendante de l'ordre des clés — jsonb le
 *  réordonne, et cet ordre ne veut rien dire. */
const canonique = (v) =>
  Array.isArray(v) ? `[${v.map(canonique).join(",")}]`
  : v && typeof v === "object"
    ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonique(v[k])}`).join(",")}}`
    : JSON.stringify(v)

const verifier = (intitule, obtenu, attendu) => {
  const ok = String(obtenu) === String(attendu)
  if (!ok) echecs++
  console.log(`  ${ok ? "✓" : "✗"} ${intitule.padEnd(50)} ${String(obtenu).slice(0, 38).padEnd(12)}` +
    (ok ? "" : ` ATTENDU ${attendu}`))
}

const marque = Date.now()
const mdp = "Epreuve-" + randomBytes(9).toString("base64url")
let cabinetA, cabinetB, userA, userB, userPortail

const jeton = () => {
  const j = randomBytes(32).toString("base64url")
  return { j, h: createHash("sha256").update(j).digest("hex") }
}

const creerCabinet = async (nom, suffixe) => {
  const { data: f, error } = await admin.from("firms").insert({
    name: `${nom} ${marque}`, rcic_license_number: `R${suffixe}${String(marque).slice(-4)}`,
    owner_name: "Épreuve", email: `${suffixe}-${marque}@example.invalid`,
    plan: "cabinet", status: "active",
  }).select("id").single()
  if (error) throw new Error(`Cabinet : ${error.message}`)
  await admin.from("firm_subscriptions").insert({
    firm_id: f.id, plan: "cabinet", cadence: "monthly", seats: 3,
    status: "active", stripe_customer_id: `cus_q${suffixe}_${marque}`,
  })
  return f.id
}

const creerConsultant = async (firmId, etiquette) => {
  const courriel = `${etiquette}-${marque}@example.invalid`
  const { data: u, error } = await admin.auth.admin.createUser({
    email: courriel, password: mdp, email_confirm: true,
  })
  if (error) throw new Error(`Compte : ${error.message}`)
  await admin.from("profiles").insert({
    firm_id: firmId, user_id: u.user.id, email: courriel,
    full_name: `${etiquette} d'épreuve`, cicc_role: "rcic",
  })
  return { userId: u.user.id, courriel }
}

try {
  cabinetA = await creerCabinet("Cabinet questionnaires", "666")
  cabinetB = await creerCabinet("Cabinet tiers", "555")
  const consultantA = await creerConsultant(cabinetA, "consultant")
  const consultantB = await creerConsultant(cabinetB, "tiers")
  userA = consultantA.userId
  userB = consultantB.userId

  const cabinet = await session(consultantA.courriel, mdp)
  const tiers = await session(consultantB.courriel, mdp)

  // -------------------------------------------------------------------------
  console.log("\nLa bibliothèque")
  // -------------------------------------------------------------------------
  const { data: systeme } = await cabinet
    .from("questionnaire_templates").select("id, slug, is_default_preconsultation").is("firm_id", null)
  verifier("les modèles fournis sont visibles", (systeme ?? []).length, 8)
  verifier("un seul est proposé par défaut aux prospects",
    (systeme ?? []).filter((m) => m.is_default_preconsultation).length, 1)

  const modelePre = (systeme ?? []).find((m) => m.slug === "preconsultation")

  const { error: eEcrire } = await cabinet
    .from("questionnaire_templates").update({ title_fr: "Détourné" }).eq("id", modelePre.id)
  const { data: apresTentative } = await admin
    .from("questionnaire_templates").select("title_fr").eq("id", modelePre.id).single()
  verifier("un modèle fourni ne peut pas être réécrit",
    apresTentative.title_fr === "Détourné" ? "RÉÉCRIT" : "intact", "intact")
  void eEcrire

  // -------------------------------------------------------------------------
  console.log("\nCe que reçoit un cabinet NEUF, sans rien configurer")
  // -------------------------------------------------------------------------
  // La question n'est pas « le cloisonnement tient-il » — c'est vérifié plus
  // bas — mais « le deuxième cabinet qui s'abonne trouve-t-il quelque chose ».
  const { data: sysPourB } = await tiers
    .from("questionnaire_templates").select("id, slug").is("firm_id", null)
  verifier("il voit les 8 modèles fournis", (sysPourB ?? []).length, 8)

  const { data: sesModeles } = await tiers
    .from("questionnaire_templates").select("id").eq("firm_id", cabinetB)
  verifier("et aucun modèle à lui, tant qu'il n'en crée pas", (sesModeles ?? []).length, 0)

  const { data: defautB } = await tiers
    .from("questionnaire_templates").select("slug")
    .eq("is_default_preconsultation", true).eq("active", true)
  verifier("un questionnaire lui est proposé par défaut", (defautB ?? [])[0]?.slug, "preconsultation")

  const modeleSysB = (sysPourB ?? []).find((m) => m.slug === "preconsultation")
  const { data: src } = await admin.from("questionnaire_templates")
    .select("sections, message_fr, message_en, description_fr, description_en")
    .eq("id", modeleSysB.id).single()
  const { error: eDup } = await tiers.from("questionnaire_templates").insert({
    firm_id: cabinetB, slug: "preconsultation", title_fr: "Préconsultation — ma version",
    title_en: "Pre-consultation — my version", sections: src.sections,
    description_fr: src.description_fr, description_en: src.description_en,
    message_fr: src.message_fr, message_en: src.message_en,
  })
  verifier("il duplique sous son propre slug", eDup ? eDup.message : "ok", "ok")

  const { data: sysApres } = await admin.from("questionnaire_templates")
    .select("title_fr").eq("id", modeleSysB.id).single()
  verifier("l'original fourni n'a pas bougé", sysApres.title_fr, "Questionnaire de préconsultation")

  const { data: vuParA } = await cabinet
    .from("questionnaire_templates").select("id").eq("firm_id", cabinetB)
  verifier("le premier cabinet ne voit pas sa copie", (vuParA ?? []).length, 0)

  const { data: idB } = await admin.from("firms")
    .select("name, email, reply_to_email, email_sender_name").eq("id", cabinetB).single()
  verifier("aucune identité courriel imposée", String(idB.reply_to_email), "null")
  verifier("le repli existe : son courriel de cabinet", Boolean(idB.email), true)

  // -------------------------------------------------------------------------
  console.log("\nUn envoi à un PROSPECT — sans client, sans dossier")
  // -------------------------------------------------------------------------
  const { data: prospect, error: eProspect } = await admin.from("leads").insert({
    firm_id: cabinetA, name: "Awa Diallo", email: `awa-${marque}@example.invalid`,
    phone: "+1 514 555 0199", type: "b2c", visa_type: "Permis d'études",
    estimated_value: 2500, score: 70, score_label: "med", stage: "newLead",
    last_contact: new Date().toISOString().slice(0, 10), notes: "",
  }).select("id").single()
  if (eProspect) throw new Error(`Prospect : ${eProspect.message}`)

  const { j, h } = jeton()
  const { data: envoi, error: eEnvoi } = await cabinet.from("client_questionnaires").insert({
    firm_id: cabinetA, lead_id: prospect.id, client_id: null, matter_id: null,
    template_id: modelePre.id, title: "Questionnaire de préconsultation",
    sections: [{ id: "s1", titleFr: "Vous", titleEn: "You", fields: [
      { key: "firstName", labelFr: "Prénom", labelEn: "First name", type: "text", required: true },
      { key: "projectType", labelFr: "Projet", labelEn: "Project", type: "text", required: true },
    ] }],
    prefill: { firstName: "Awa" },
    status: "sent", sent_at: new Date().toISOString(), token_hash: h,
  }).select("id").single()
  verifier("le questionnaire part vers un prospect", eEnvoi ? eEnvoi.message : "ok", "ok")

  const { error: eDeux } = await cabinet.from("client_questionnaires").insert({
    firm_id: cabinetA, lead_id: prospect.id, client_id: prospect.id,
    template_id: modelePre.id, title: "Deux destinataires", sections: [], token_hash: jeton().h,
  })
  verifier("un client ET un prospect à la fois : REFUSÉ", eDeux ? "refusé" : "ACCEPTÉ", "refusé")

  const { error: eAucun } = await cabinet.from("client_questionnaires").insert({
    firm_id: cabinetA, title: "Sans destinataire", sections: [], token_hash: jeton().h,
  })
  verifier("aucun destinataire : REFUSÉ", eAucun ? "refusé" : "ACCEPTÉ", "refusé")

  // -------------------------------------------------------------------------
  console.log("\nLe lien sécurisé — Node et Postgres doivent s'accorder")
  // -------------------------------------------------------------------------
  const { data: empreinteSql } = await admin.rpc("questionnaire_empreinte", { p_token: j })
  verifier("l'empreinte SQL égale l'empreinte Node", empreinteSql === h ? "identiques" : "DIVERGENTES", "identiques")

  const { data: ouvert, error: eOuvrir } = await anon.rpc("questionnaire_ouvrir", { p_token: j })
  verifier("le jeton ouvre le questionnaire", eOuvrir ? eOuvrir.message : ouvert?.title, "Questionnaire de préconsultation")
  verifier("le pré-remplissage voyage à part", ouvert?.prefill?.firstName, "Awa")
  verifier("les réponses sont encore vides", JSON.stringify(ouvert?.answers ?? {}), "{}")

  const { data: apresOuverture } = await admin
    .from("client_questionnaires").select("status, opened_at").eq("id", envoi.id).single()
  verifier("l'ouverture est datée", apresOuverture.opened_at ? "oui" : "non", "oui")
  verifier("le statut passe à « ouvert »", apresOuverture.status, "opened")

  const { error: eFaux } = await anon.rpc("questionnaire_ouvrir", { p_token: randomBytes(32).toString("base64url") })
  verifier("un jeton inventé n'ouvre rien", eFaux ? "refusé" : "ACCEPTÉ", "refusé")

  const { error: eCourt } = await anon.rpc("questionnaire_ouvrir", { p_token: "" })
  verifier("un jeton vide n'ouvre rien", eCourt ? "refusé" : "ACCEPTÉ", "refusé")

  // -------------------------------------------------------------------------
  console.log("\nCe que le rôle anonyme ne peut PAS faire")
  // -------------------------------------------------------------------------
  const { data: volTable, error: eTable } = await anon.from("client_questionnaires").select("id, answers")
  verifier("lire la table directement", (volTable ?? []).length === 0 || eTable ? "refusé" : "ACCEPTÉ", "refusé")

  const { data: volModeles } = await anon.from("questionnaire_templates").select("id")
  verifier("lire la bibliothèque directement", (volModeles ?? []).length, 0)

  // -------------------------------------------------------------------------
  console.log("\nLe prospect répond, puis transmet")
  // -------------------------------------------------------------------------
  const { error: eEnr } = await anon.rpc("questionnaire_enregistrer", {
    p_token: j, p_answers: { firstName: "Awa", projectType: "Permis d'études" }, p_progress: 100,
  })
  verifier("enregistrer ses réponses", eEnr ? eEnr.message : "ok", "ok")

  const { data: enCours } = await admin
    .from("client_questionnaires").select("status, progress, answers").eq("id", envoi.id).single()
  verifier("le statut suit le geste", enCours.status, "in_progress")
  verifier("la progression est retenue", enCours.progress, 100)

  const { error: eSoum } = await anon.rpc("questionnaire_soumettre", { p_token: j })
  verifier("transmettre au cabinet", eSoum ? eSoum.message : "ok", "ok")

  const { data: soumis } = await admin
    .from("client_questionnaires").select("status, submitted_at").eq("id", envoi.id).single()
  verifier("le questionnaire est soumis", soumis.status, "submitted")

  // -------------------------------------------------------------------------
  console.log("\nLe prospect devient client — son questionnaire le suit")
  // -------------------------------------------------------------------------
  // Sans ce transfert, les réponses restaient accrochées au lead_id. Le
  // portail du nouveau client lit par client_id : il annonçait « Aucun
  // questionnaire ne vous est attribué » à quelqu'un qui venait d'en remplir
  // un, et le cabinet le lui redemandait.
  //
  // Ce que ce bloc éprouve : que le déplacement soit LÉGAL au regard du
  // schéma, et qu'il ne perde rien. Ce qu'il n'éprouve PAS : que le bouton de
  // conversion l'appelle — ça se joue dans le navigateur, sur un écran dont
  // la refonte est en cours.
  const { data: avantTransfert } = await admin
    .from("client_questionnaires").select("answers, status, token_hash").eq("id", envoi.id).single()

  const { data: clientIssu, error: eClient } = await admin.from("clients").insert({
    firm_id: cabinetA, name: "Awa Diallo", email: `awa-cli-${marque}@example.invalid`,
    file_number: `DOS-CV-${String(marque).slice(-6)}`, program: "Permis d'études",
    status: "active", client_type: "individual",
  }).select("id").single()
  if (eClient) throw new Error(`Client issu du prospect : ${eClient.message}`)

  // Les DEUX colonnes dans le même UPDATE. La contrainte
  // client_questionnaires_destinataire impose
  // (client_id is not null) <> (lead_id is not null) : en deux temps, l'état
  // intermédiaire est refusé par la base.
  const { data: deplaces, error: eMove } = await cabinet
    .from("client_questionnaires")
    .update({ client_id: clientIssu.id, lead_id: null })
    .eq("firm_id", cabinetA).eq("lead_id", prospect.id)
    .select("id")
  verifier("le transfert est accepté", eMove ? eMove.message : "ok", "ok")
  verifier("il déplace le questionnaire rempli", (deplaces ?? []).length, 1)

  const { data: apresTransfert } = await admin
    .from("client_questionnaires").select("client_id, lead_id, answers, status, token_hash")
    .eq("id", envoi.id).single()
  verifier("il vise désormais le client", apresTransfert.client_id, clientIssu.id)
  verifier("et plus le prospect", String(apresTransfert.lead_id), "null")

  // Le contrôle qui compte : un transfert qui perdrait les réponses serait
  // pire que pas de transfert du tout.
  verifier("LES RÉPONSES SONT INTACTES",
    JSON.stringify(apresTransfert.answers), JSON.stringify(avantTransfert.answers))
  verifier("le statut ne recule pas", apresTransfert.status, avantTransfert.status)

  // Le lien déjà transmis doit survivre : la personne qui remplit le
  // formulaire n'a pas à savoir qu'elle a changé de statut dans notre base.
  verifier("l'empreinte du jeton est inchangée", apresTransfert.token_hash, avantTransfert.token_hash)
  const { data: ouvertApres, error: eOuvrirApres } = await anon.rpc("questionnaire_ouvrir", { p_token: j })
  verifier("le lien déjà envoyé ouvre toujours", eOuvrirApres ? eOuvrirApres.message : "ok", "ok")
  verifier("et sert les mêmes réponses",
    JSON.stringify(ouvertApres?.answers ?? {}), JSON.stringify(avantTransfert.answers))

  // Effacer le prospect ne doit plus emporter le questionnaire : lead_id est
  // « on delete cascade », et c'est précisément pourquoi on le vide.
  await admin.from("leads").delete().eq("id", prospect.id)
  const { data: survivant } = await admin
    .from("client_questionnaires").select("id").eq("id", envoi.id).maybeSingle()
  verifier("effacer le prospect n'emporte plus ses réponses", survivant ? "conservé" : "PERDU", "conservé")

  // -------------------------------------------------------------------------
  console.log("\nLe statut « expiré » se calcule, il ne se stocke pas")
  // -------------------------------------------------------------------------
  const { data: statuts } = await admin.rpc("questionnaire_status", {
    p_status: "sent", p_due_date: new Date(Date.now() - 86400000).toISOString(), p_token_revoked_at: null,
  })
  verifier("une date limite passée rend « expiré »", statuts, "expired")

  const { data: rendu } = await admin.rpc("questionnaire_status", {
    p_status: "submitted", p_due_date: new Date(Date.now() - 86400000).toISOString(), p_token_revoked_at: null,
  })
  verifier("un questionnaire rendu n'expire pas après coup", rendu, "submitted")

  // -------------------------------------------------------------------------
  console.log("\nLes notifications suivent les états, sans code applicatif")
  // -------------------------------------------------------------------------
  // Le déclencheur est la seule source : les trois chemins qui changent l'état
  // — le consultant, le portail, le jeton anonyme — passent tous par lui. Les
  // événements ci-dessous ont été produits plus haut PAR L'USAGE, pas par un
  // appel dédié.
  const notifs = async (kind) => {
    const { data } = await admin.from("notifications")
      .select("id, title, body, client_id").eq("firm_id", cabinetA).eq("kind", kind)
    return data ?? []
  }

  verifier("l'envoi vers un prospect ne notifie pas de portail", (await notifs("questionnaire_sent")).length, 0)
  verifier("l'ouverture est notifiée au cabinet", (await notifs("questionnaire_opened")).length, 1)
  verifier("le début de saisie aussi", (await notifs("questionnaire_started")).length, 1)
  verifier("la transmission aussi", (await notifs("questionnaire_submitted")).length, 1)

  const ouverture = (await notifs("questionnaire_opened"))[0]
  verifier("la notification nomme la personne", /Awa Diallo/.test(ouverture?.title ?? "") ? "oui" : "non", "oui")
  verifier("elle ne vise aucun client", ouverture?.client_id, "null")

  // Un enregistrement qui ne change pas l'état ne doit RIEN produire : sans
  // cette garde, chaque sauvegarde automatique — toutes les secondes et demie
  // pendant la saisie — aurait sa notification.
  const avant = (await notifs("questionnaire_started")).length
  await admin.from("client_questionnaires")
    .update({ answers: { firstName: "Awa" }, updated_at: new Date().toISOString() }).eq("id", envoi.id)
  verifier("une écriture sans changement d'état ne notifie pas",
    (await notifs("questionnaire_started")).length, avant)

  // « Lu » est propre à chaque membre : l'un ne doit pas faire disparaître la
  // notification de l'autre.
  const { data: profilA } = await admin.from("profiles").select("id").eq("user_id", userA).single()
  await admin.from("notification_reads").insert({ notification_id: ouverture.id, profile_id: profilA.id })
  const { data: luesA } = await cabinet.from("notification_reads").select("notification_id")
  verifier("le membre qui a lu voit sa marque", (luesA ?? []).length, 1)
  const { data: luesTiers } = await tiers.from("notification_reads").select("notification_id")
  verifier("un autre cabinet ne voit pas ses marques", (luesTiers ?? []).length, 0)

  const { data: notifsTiers } = await tiers.from("notifications").select("id").eq("firm_id", cabinetA)
  verifier("ni ses notifications", (notifsTiers ?? []).length, 0)

  // -------------------------------------------------------------------------
  console.log("\nRemanier un modèle ne déplace pas le sol sous un envoi en cours")
  // -------------------------------------------------------------------------
  // La base le promet en toutes lettres sur la colonne sections : « Instantané
  // du modèle au moment de l'envoi. » Personne ne l'avait encore éprouvé, faute
  // de pouvoir modifier un modèle — c'est précisément ce que l'éditeur rend
  // possible, donc ce qui met la promesse à l'épreuve pour la première fois.
  const sectionsDorigine = [{ id: "s1", titleFr: "Vous", titleEn: "You", fields: [
    { key: "prenom", labelFr: "Prénom", labelEn: "First name", type: "text", required: true },
  ] }]

  const { data: modeleCabinet, error: eMod } = await cabinet.from("questionnaire_templates").insert({
    firm_id: cabinetA, slug: `edite-${marque}`,
    title_fr: "Modèle du cabinet", title_en: "Firm template",
    description_fr: "", description_en: "", message_fr: "", message_en: "",
    sections: sectionsDorigine,
  }).select("id").single()
  verifier("le cabinet crée son propre modèle", eMod ? eMod.message : "ok", "ok")

  const { data: envoiFige } = await cabinet.from("client_questionnaires").insert({
    firm_id: cabinetA, client_id: clientIssu.id, template_id: modeleCabinet.id,
    title: "Envoi figé", sections: sectionsDorigine, status: "sent",
    sent_at: new Date().toISOString(), token_hash: jeton().h,
  }).select("id").single()

  // Le modèle est réécrit de fond en comble : la question d'origine disparaît.
  const { error: eEdit } = await cabinet.from("questionnaire_templates")
    .update({ sections: [{ id: "s9", titleFr: "Tout autre chose", titleEn: "Something else", fields: [
      { key: "autre", labelFr: "Autre", labelEn: "Other", type: "text", required: false },
    ] }] })
    .eq("id", modeleCabinet.id)
  verifier("le modèle du cabinet se modifie", eEdit ? eEdit.message : "ok", "ok")

  const { data: apresEdition } = await admin
    .from("client_questionnaires").select("sections").eq("id", envoiFige.id).single()
  verifier("l'envoi déjà parti garde SES questions",
    canonique(apresEdition.sections), canonique(sectionsDorigine))

  const { data: modeleRelu } = await admin
    .from("questionnaire_templates").select("sections").eq("id", modeleCabinet.id).single()
  verifier("le modèle, lui, a bien changé", modeleRelu.sections[0].titleFr, "Tout autre chose")

  // Et un cabinet tiers ne remanie pas le modèle d'un autre.
  const { error: eEditTiers } = await tiers.from("questionnaire_templates")
    .update({ sections: [] }).eq("id", modeleCabinet.id)
  const { data: intact } = await admin
    .from("questionnaire_templates").select("sections").eq("id", modeleCabinet.id).single()
  verifier("un autre cabinet ne le remanie pas",
    (eEditTiers || intact.sections.length > 0) ? "protégé" : "MODIFIÉ", "protégé")

  // -------------------------------------------------------------------------
  console.log("\nUn lien désactivé cesse d'ouvrir")
  // -------------------------------------------------------------------------
  await cabinet.from("client_questionnaires")
    .update({ token_revoked_at: new Date().toISOString() }).eq("id", envoi.id)
  const { error: eRevoque } = await anon.rpc("questionnaire_ouvrir", { p_token: j })
  verifier("le lien révoqué est refusé", eRevoque ? "refusé" : "ACCEPTÉ", "refusé")
  verifier("et le refus nomme la raison", /désactivé/i.test(eRevoque?.message ?? "") ? "oui" : "non", "oui")

  // -------------------------------------------------------------------------
  console.log("\nCloisonnement entre cabinets")
  // -------------------------------------------------------------------------
  const { data: vuTiers } = await tiers.from("client_questionnaires").select("id").eq("id", envoi.id)
  verifier("un autre cabinet ne voit pas l'envoi", (vuTiers ?? []).length, 0)

  const { data: modelesTiers } = await tiers
    .from("questionnaire_templates").select("id").eq("firm_id", cabinetA)
  verifier("ni les modèles du premier", (modelesTiers ?? []).length, 0)
} finally {
  for (const id of [cabinetA, cabinetB]) if (id) await admin.from("firms").delete().eq("id", id)
  for (const id of [userA, userB, userPortail]) if (id) await admin.auth.admin.deleteUser(id)
  console.log("\nCabinets et comptes d'épreuve supprimés.")
}

console.log(echecs === 0 ? "\n✓ Questionnaires vérifiés, 0 échec." : `\n✗ ${echecs} échec(s).`)
process.exit(echecs === 0 ? 0 : 1)
