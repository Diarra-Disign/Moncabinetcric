#!/usr/bin/env node
/**
 * Éprouve le socle des ententes de service contre la base réelle.
 *
 * Ce que ce script cherche à prendre en défaut, dans l'ordre :
 *
 * 1. L'INSTANTANÉ. Le §18 du brief exige qu'un contrat déjà émis ne change pas
 *    quand son modèle change. C'est la garantie la plus facile à croire acquise
 *    et la plus coûteuse à perdre : un client pourrait contester un contrat
 *    dont le texte ne serait plus celui qu'il a signé.
 *
 * 2. LE MODÈLE SYSTÈME. Il est partagé par tous les cabinets. Un cabinet qui
 *    pourrait le réécrire changerait les contrats de ses confrères.
 *
 * 3. LE RATTACHEMENT. Une entente vise un client OU un prospect, jamais les
 *    deux — même contrainte que les questionnaires, et pour la même raison :
 *    ce qui peut viser les deux finit par ne viser personne.
 *
 * 4. LE CLOISONNEMENT. Un cabinet ne voit ni les ententes ni les parties d'un
 *    autre.
 */
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { randomBytes } from "node:crypto"
import { createClient } from "@supabase/supabase-js"
// Le module de substitution est importé TEL QUEL : contrôler les modèles
// contre une liste de variables recopiée ici les aurait éprouvés contre une
// copie, qui aurait divergé au premier ajout.
import { variablesDe, substituer } from "../lib/ententes/variables.ts"

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
/** jsonb réordonne les clés d'un objet, et cet ordre ne veut rien dire. */
const canonique = (v) =>
  Array.isArray(v) ? `[${v.map(canonique).join(",")}]`
  : v && typeof v === "object"
    ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonique(v[k])}`).join(",")}}`
    : JSON.stringify(v)

const verifier = (intitule, obtenu, attendu) => {
  const ok = String(obtenu) === String(attendu)
  if (!ok) echecs++
  console.log(`  ${ok ? "✓" : "✗"} ${intitule.padEnd(52)} ${String(obtenu).slice(0, 44)}` +
    (ok ? "" : `   ATTENDU ${attendu}`))
}

const marque = Date.now()
const mdp = "Epreuve-" + randomBytes(9).toString("base64url")
let cabinetA, cabinetB, userA, userB

const nouveauCabinet = async (suffixe) => {
  const courriel = `ent-${suffixe}-${marque}@example.invalid`
  const { data: cab, error: e1 } = await admin.from("firms").insert({
    name: `Cabinet ententes ${suffixe} ${marque}`,
    rcic_license_number: `R5${suffixe}${String(marque).slice(-5)}`,
    owner_name: "Épreuve", email: courriel, plan: "cabinet", status: "active",
  }).select("id").single()
  if (e1) throw new Error(`Cabinet ${suffixe} : ${e1.message}`)

  const { data: u, error: e2 } = await admin.auth.admin.createUser({
    email: courriel, password: mdp, email_confirm: true,
  })
  if (e2) throw new Error(`Compte ${suffixe} : ${e2.message}`)

  // current_firm_id() exige un profil ACTIF et un abonnement ouvert. Sans
  // l'un des deux, la fonction rend NULL et toutes les politiques RLS du
  // cabinet refusent — ce qui ressemble à un défaut de politique alors que
  // c'est la monture qui est incomplète.
  await admin.from("profiles").insert({
    firm_id: cab.id, user_id: u.user.id, email: courriel,
    full_name: `Propriétaire ${suffixe}`, cicc_role: "owner", status: "active",
  })

  await admin.from("firm_subscriptions").insert({
    firm_id: cab.id, plan: "cabinet", cadence: "monthly", seats: 3,
    status: "active", stripe_customer_id: `cus_ent_${suffixe}_${marque}`,
  })
  return { firmId: cab.id, userId: u.user.id, client: await session(courriel, mdp) }
}

try {
  const A = await nouveauCabinet(1)
  const B = await nouveauCabinet(2)
  cabinetA = A.firmId; userA = A.userId
  cabinetB = B.firmId; userB = B.userId
  const cabinet = A.client
  const tiers = B.client

  // -------------------------------------------------------------------------
  console.log("\nLe modèle système appartient à tout le monde, donc à personne")
  // -------------------------------------------------------------------------
  const { data: systeme, error: eSys } = await admin.from("agreement_templates").insert({
    firm_id: null, code: `sys-${marque}`, kind: "services",
    title_fr: "Entente de services professionnels", title_en: "Professional services agreement",
    version: "1.0",
  }).select("id").single()
  verifier("un modèle système existe", eSys ? eSys.message : "ok", "ok")

  const { data: vuParCabinet } = await cabinet
    .from("agreement_templates").select("id").eq("id", systeme.id)
  verifier("chaque cabinet le VOIT", (vuParCabinet ?? []).length, 1)

  await cabinet.from("agreement_templates").update({ title_fr: "Détourné" }).eq("id", systeme.id)
  const { data: apresTentative } = await admin
    .from("agreement_templates").select("title_fr").eq("id", systeme.id).single()
  verifier("aucun cabinet ne le RÉÉCRIT", apresTentative.title_fr, "Entente de services professionnels")

  // -------------------------------------------------------------------------
  console.log("\nLe modèle du cabinet, et ses articles")
  // -------------------------------------------------------------------------
  const { data: modele, error: eMod } = await cabinet.from("agreement_templates").insert({
    firm_id: cabinetA, code: `cab-${marque}`, kind: "services",
    title_fr: "Mon entente", title_en: "My agreement", version: "1.0",
  }).select("id").single()
  verifier("le cabinet crée le sien", eMod ? eMod.message : "ok", "ok")

  const articles = [
    { position: 1, code: "objet", title_fr: "Objet du mandat", title_en: "Scope", body_fr: "Le cabinet représente le Client.", body_en: "The firm represents the Client.", level: "structural" },
    { position: 2, code: "honoraires", title_fr: "Honoraires", title_en: "Fees", body_fr: "Les honoraires s'élèvent à {{honoraires}}.", body_en: "Fees amount to {{honoraires}}.", level: "free" },
  ]
  const { error: eArt } = await cabinet.from("agreement_template_articles")
    .insert(articles.map((a) => ({ ...a, firm_id: cabinetA, template_id: modele.id })))
  verifier("ses articles s'enregistrent", eArt ? eArt.message : "ok", "ok")

  const { error: eNiveau } = await cabinet.from("agreement_template_articles").insert({
    firm_id: cabinetA, template_id: modele.id, position: 3, code: "x",
    title_fr: "x", title_en: "x", body_fr: "x", body_en: "x", level: "inventé",
  })
  verifier("un niveau hors vocabulaire : REFUSÉ", eNiveau ? "refusé" : "ACCEPTÉ", "refusé")

  const { error: eDouble } = await cabinet.from("agreement_template_articles").insert({
    firm_id: cabinetA, template_id: modele.id, position: 1, code: "objet",
    title_fr: "Doublon", title_en: "Dup", body_fr: "x", body_en: "x", level: "free",
  })
  // Deux articles de même code dans un modèle : la substitution ne saurait
  // lequel garder, et l'un des deux disparaîtrait du contrat sans le dire.
  verifier("deux articles de même code : REFUSÉS", eDouble ? "refusés" : "ACCEPTÉS", "refusés")

  // -------------------------------------------------------------------------
  console.log("\nUne entente émise, et son instantané")
  // -------------------------------------------------------------------------
  const { data: prospect } = await admin.from("leads").insert({
    firm_id: cabinetA, name: "Awa Diallo", email: `awa-${marque}@example.invalid`,
    phone: "+1 514 555 0199", type: "b2c", visa_type: "Permis d'études",
    estimated_value: 2500, score: 70, score_label: "med", stage: "consultation",
    last_contact: new Date().toISOString().slice(0, 10), notes: "", civility: "mrs",
  }).select("id").single()

  const instantane = articles.map((a) => ({ ...a }))
  const { data: entente, error: eEnt } = await cabinet.from("agreements").insert({
    firm_id: cabinetA, lead_id: prospect.id, template_id: modele.id,
    template_version: "1.0", reference: `ENT-${marque}`,
    title: "Mon entente", kind: "services", status: "draft",
    articles_snapshot: instantane, fees_amount: 4500,
  }).select("id").single()
  verifier("une entente vise un PROSPECT", eEnt ? eEnt.message : "ok", "ok")

  const { data: cl } = await admin.from("clients").insert({
    firm_id: cabinetA, name: "Awa Diallo", email: `awa-cli-${marque}@example.invalid`,
    file_number: `DOS-E-${String(marque).slice(-6)}`, program: "Permis d'études",
    status: "active", client_type: "individual", civility: "mrs",
  }).select("id").single()

  const { error: eDeux } = await cabinet.from("agreements").insert({
    firm_id: cabinetA, lead_id: prospect.id, client_id: cl.id, template_id: modele.id,
    template_version: "1.0", reference: `ENT-X-${marque}`, title: "Deux", kind: "services",
    status: "draft", articles_snapshot: [],
  })
  verifier("un client ET un prospect à la fois : REFUSÉ", eDeux ? "refusé" : "ACCEPTÉ", "refusé")

  const { error: eAucun } = await cabinet.from("agreements").insert({
    firm_id: cabinetA, template_id: modele.id, template_version: "1.0",
    reference: `ENT-Y-${marque}`, title: "Sans", kind: "services", status: "draft",
    articles_snapshot: [],
  })
  verifier("aucun destinataire : REFUSÉ", eAucun ? "refusé" : "ACCEPTÉ", "refusé")

  // LE CONTRÔLE QUI COMPTE. Le modèle est réécrit de fond en comble.
  await cabinet.from("agreement_template_articles").delete().eq("template_id", modele.id)
  await cabinet.from("agreement_template_articles").insert({
    firm_id: cabinetA, template_id: modele.id, position: 1, code: "tout_autre",
    title_fr: "Tout autre chose", title_en: "Something else",
    body_fr: "Rien à voir.", body_en: "Nothing alike.", level: "free",
  })
  await cabinet.from("agreement_templates").update({ version: "2.0" }).eq("id", modele.id)

  const { data: apresRefonte } = await admin
    .from("agreements").select("articles_snapshot, template_version").eq("id", entente.id).single()
  verifier("l'entente émise garde SES articles",
    canonique(apresRefonte.articles_snapshot), canonique(instantane))
  verifier("et la version qu'elle a utilisée", apresRefonte.template_version, "1.0")

  // -------------------------------------------------------------------------
  console.log("\nLes parties au contrat")
  // -------------------------------------------------------------------------
  // PostgREST UNIFIE le jeu de colonnes d'un insert groupé : une ligne qui
  // omet « email » reçoit NULL, et non la valeur par défaut de la colonne.
  // Le conjoint n'a pas de courriel — il faut donc l'écrire explicitement
  // vide, sinon l'insert entier échoue. Le piège vaut pour tout code
  // applicatif qui insérera plusieurs parties d'un coup.
  const { error: eParties } = await cabinet.from("agreement_parties").insert([
    { firm_id: cabinetA, agreement_id: entente.id, role: "client", civility: "mrs",
      first_name: "Awa", last_name: "Diallo", email: `awa-${marque}@example.invalid` },
    { firm_id: cabinetA, agreement_id: entente.id, role: "spouse", civility: "mr",
      first_name: "Ibrahim", last_name: "Diallo", email: "" },
  ])
  verifier("plusieurs parties se rattachent", eParties ? eParties.message : "ok", "ok")

  const { data: partiesLues } = await cabinet
    .from("agreement_parties").select("id").eq("agreement_id", entente.id)
  verifier("le cabinet les relit", (partiesLues ?? []).length, 2)

  const { error: eRole } = await cabinet.from("agreement_parties").insert({
    firm_id: cabinetA, agreement_id: entente.id, role: "inventé", first_name: "X", last_name: "Y",
  })
  verifier("un rôle hors vocabulaire : REFUSÉ", eRole ? "refusé" : "ACCEPTÉ", "refusé")

  // -------------------------------------------------------------------------
  console.log("\nUne correction du contrat ne réécrit pas la fiche (§6)")
  // -------------------------------------------------------------------------
  // Le contrat retient une COPIE. Le consultant corrige une adresse pour les
  // besoins du document ; la fiche client ne doit pas bouger sans qu'il l'ait
  // demandé. Et l'inverse compte autant : lire la fiche à chaque affichage
  // ferait changer l'adresse d'un contrat SIGNÉ le jour où le client déménage.
  await admin.from("clients").update({
    address: "12 rue des Érables", city: "Montréal", province: "QC",
    postal_code: "H2X 1Y4", country: "Canada",
  }).eq("id", cl.id)

  const { data: partieClient } = await cabinet
    .from("agreement_parties").select("id").eq("agreement_id", entente.id).eq("role", "client").single()

  await cabinet.from("agreement_parties")
    .update({ address: "99 boulevard Corrigé" }).eq("id", partieClient.id)

  const { data: ficheApres } = await admin
    .from("clients").select("address").eq("id", cl.id).single()
  verifier("la fiche client garde SON adresse", ficheApres.address, "12 rue des Érables")

  const { data: partieApres } = await admin
    .from("agreement_parties").select("address").eq("id", partieClient.id).single()
  verifier("le contrat garde la correction", partieApres.address, "99 boulevard Corrigé")

  // Et le déménagement du client ne réécrit pas le contrat.
  await admin.from("clients").update({ address: "7 avenue du Déménagement" }).eq("id", cl.id)
  const { data: partieEncore } = await admin
    .from("agreement_parties").select("address").eq("id", partieClient.id).single()
  verifier("un déménagement ne touche pas un contrat émis", partieEncore.address, "99 boulevard Corrigé")

  // -------------------------------------------------------------------------
  console.log("\nLes modèles fournis n'emploient aucune variable inconnue")
  // -------------------------------------------------------------------------
  // Une variable que la substitution ne connaît pas reste écrite « {{…}} »
  // dans le contrat imprimé. Silencieuse à la génération, visible pour le seul
  // client. Les quatre modèles fournis sont donc passés au crible.
  const connues = variablesDe({
    contractant: { civility: "mrs", firstName: "A", lastName: "B", email: "a@b.ca",
      phone: "1", address: "1 rue", city: "V", province: "QC", postalCode: "H0H 0H0", country: "Canada" },
    cabinet: { nom: "C", consultant: "D", permis: "R1", adresse: "a", courriel: "c@d.ca", telephone: "t" },
    montants: { honoraires: 1, taxes: 0, total: 1 },
    entente: { numero: "N", date: "2026-08-11", titre: "T" },
    locale: "fr",
  })

  const { data: modelesSysteme } = await admin
    .from("agreement_templates").select("code").is("firm_id", null).like("code", "sys\\_%")
  verifier("les quatre modèles fournis existent", (modelesSysteme ?? []).length, 4)

  const { data: tousArticles } = await admin
    .from("agreement_template_articles")
    .select("code, title_fr, body_fr, body_en, template_id, agreement_templates!inner(code, firm_id)")
    .is("firm_id", null)

  const inconnues = new Set()
  for (const a of tousArticles ?? []) {
    for (const texte of [a.title_fr, a.body_fr, a.body_en]) {
      for (const v of substituer(String(texte ?? ""), connues).inconnues) inconnues.add(`${a.code}:${v}`)
    }
  }
  verifier("aucune variable inconnue dans leurs textes", [...inconnues].join(", ") || "aucune", "aucune")

  // -------------------------------------------------------------------------
  console.log("\nCloisonnement entre cabinets")
  // -------------------------------------------------------------------------
  const { data: entTiers } = await tiers.from("agreements").select("id").eq("firm_id", cabinetA)
  verifier("un autre cabinet ne voit pas l'entente", (entTiers ?? []).length, 0)

  const { data: partTiers } = await tiers.from("agreement_parties").select("id").eq("agreement_id", entente.id)
  verifier("ni ses parties", (partTiers ?? []).length, 0)

  const { data: artTiers } = await tiers
    .from("agreement_template_articles").select("id").eq("template_id", modele.id)
  verifier("ni les articles de son modèle", (artTiers ?? []).length, 0)

  await admin.from("agreement_templates").delete().eq("id", systeme.id)
} finally {
  for (const id of [cabinetA, cabinetB]) if (id) await admin.from("firms").delete().eq("id", id)
  for (const id of [userA, userB]) if (id) await admin.auth.admin.deleteUser(id)
  console.log("\nCabinets et comptes d'épreuve supprimés.")
}

console.log(echecs === 0 ? "\n✓ Socle des ententes vérifié, 0 échec." : `\n✗ ${echecs} échec(s).`)
process.exit(echecs === 0 ? 0 : 1)
