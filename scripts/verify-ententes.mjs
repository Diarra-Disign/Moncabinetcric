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
import { inflateSync } from "node:zlib"
import { createClient } from "@supabase/supabase-js"
// Le module de substitution est importé TEL QUEL : contrôler les modèles
// contre une liste de variables recopiée ici les aurait éprouvés contre une
// copie, qui aurait divergé au premier ajout.
import { variablesDe, substituer } from "../lib/ententes/variables.ts"
// L'émission est importée TELLE QUELLE, pour la même raison. C'est elle qui
// compose le PDF, le classe dans « documents » et pose l'empreinte : la
// réécrire ici éprouverait une copie, et le jour où l'originale changerait,
// l'épreuve continuerait de réussir sur autre chose.
import { emettre } from "../lib/ententes/emission.ts"
import { PDFDocument } from "pdf-lib"

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
/** Chemins déposés dans le stockage : le cabinet supprimé n'emporte pas ses
 *  objets, et une épreuve qui laisse des fichiers finit par coûter cher. */
const deposes = []

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
    // L'adresse professionnelle COMPLÈTE : sans elle, verifierAvantGeneration()
    // refuse désormais toute création, et l'épreuve échouerait pour la bonne
    // raison au mauvais endroit.
    address: "88 rue Dollard-des-Ormeaux", address_line2: "Bureau 801",
    city: "Gatineau", province: "Québec", postal_code: "J8X 0B9", country: "Canada",
    phone: "+1 819 555 0100", website: "www.exemple.invalid",
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
  console.log("\nL'émission : le PDF, son classement, son empreinte")
  // -------------------------------------------------------------------------
  // Un contrat EST un document. Ce que ces contrôles cherchent à prendre en
  // défaut, c'est l'entente qui figure dans la liste et dont le fichier ne
  // s'ouvre jamais — la fiche posée sans son fichier, ou l'inverse.
  const membre = { firmId: cabinetA, userId: userA, fullName: "Propriétaire 1", email: "" }

  // Des articles LONGS et en alinéas : c'est ce qui force l'enveloppement du
  // texte et le passage à la page suivante, les deux endroits où une erreur
  // fait disparaître du texte sans rien lever.
  const corps =
    "Le consultant s'engage à representer le Client devant Immigration, Refugies et " +
    "Citoyennete Canada dans le cadre du mandat decrit au present article.\n\n" +
    "a) Le present mandat ne comporte aucune garantie de resultat, la decision " +
    "appartenant exclusivement a l'autorite competente.\n" +
    "b) Le Client demeure responsable de l'exactitude des renseignements fournis."
  const longs = Array.from({ length: 9 }, (_, i) => ({
    position: i + 1, code: `art_${i + 1}`,
    title_fr: `Article numero ${i + 1}`, title_en: `Article ${i + 1}`,
    body_fr: corps, level: i === 0 ? "structural" : "free",
  }))

  const { data: aEmettre } = await cabinet.from("agreements").insert({
    firm_id: cabinetA, client_id: cl.id, template_id: modele.id, template_version: "1.0",
    reference: `ENT-EM-${marque}`, title: "Entente de services professionnels",
    kind: "services", status: "draft", articles_snapshot: longs,
    fees_amount: 4500, taxes_amount: 673.88, total_amount: 5173.88,
  }).select("id").single()

  await cabinet.from("agreement_parties").insert([
    { firm_id: cabinetA, agreement_id: aEmettre.id, role: "client", civility: "mrs",
      first_name: "Awa", last_name: "Diallo", legal_name: "", email: `awa-${marque}@example.invalid`,
      phone: "+1 514 555 0123", address: "456 rue Exemple", address_line2: "Appartement 4",
      city: "Montreal", province: "Québec", postal_code: "H2X 1Y4", country: "Canada",
      // license_number, même vide : PostgREST unifie le jeu de colonnes d'un
      // insert groupé, et l'omettre ici enverrait NULL sur une colonne NOT
      // NULL — faisant échouer l'insert des DEUX parties. Le piège est le même
      // qu'au premier jour, sur une colonne neuve.
      license_number: "", signing_order: 1 },
    { firm_id: cabinetA, agreement_id: aEmettre.id, role: "consultant", civility: "mr",
      first_name: "", last_name: "Proprietaire 1", legal_name: `Cabinet ententes 1 ${marque}`,
      email: "consultant@example.invalid", phone: "+1 819 555 0100",
      address: "88 rue Dollard-des-Ormeaux", address_line2: "Bureau 801",
      city: "Gatineau", province: "Québec", postal_code: "J8X 0B9", country: "Canada",
      license_number: `R51${String(marque).slice(-5)}`, signing_order: 2 },
  ])

  const emission = await emettre(cabinet, membre, aEmettre.id)
  verifier("l'entente s'émet", emission.ok ? "ok" : emission.message, "ok")

  const { data: apresEmission } = await admin
    .from("agreements").select("document_id, status, issued_at").eq("id", aEmettre.id).single()
  verifier("elle désigne son document", apresEmission.document_id ? "oui" : "NON", "oui")
  verifier("son statut passe à « prête »", apresEmission.status, "ready")
  verifier("et elle porte sa date d'émission", apresEmission.issued_at ? "oui" : "NON", "oui")

  const { data: piece } = await admin
    .from("documents")
    .select("category, status, sha256, storage_path, mime_type, size_bytes, client_id")
    .eq("id", apresEmission.document_id).single()
  if (piece?.storage_path) deposes.push(piece.storage_path)

  verifier("classée comme un contrat", piece.category, "contract")
  verifier("rattachée au client", piece.client_id, cl.id)
  verifier("le fichier est là", piece.storage_path ? "oui" : "NON", "oui")
  // L'empreinte est ce qui rendra la signature opposable. Une fiche sans
  // empreinte donnerait une signature qu'on ne peut rattacher à rien.
  verifier("elle porte son empreinte", /^[0-9a-f]{64}$/.test(piece.sha256 ?? "") ? "oui" : "NON", "oui")
  verifier("et sa taille réelle", piece.size_bytes > 1000 ? "oui" : `NON (${piece.size_bytes})`, "oui")

  // L'empreinte enregistrée doit être celle du fichier RÉELLEMENT déposé, pas
  // celle d'octets calculés à côté.
  const { data: signe } = await admin.storage.from("documents").createSignedUrl(piece.storage_path, 60)
  const octetsDeposes = Buffer.from(await (await fetch(signe.signedUrl, { cache: "no-store" })).arrayBuffer())
  const { createHash } = await import("node:crypto")
  verifier("l'empreinte correspond aux octets déposés",
    createHash("sha256").update(octetsDeposes).digest("hex"), piece.sha256)

  // ---- Le contenu du PDF --------------------------------------------------
  const lisiblePdf = (octets) => {
    let sortie = ""
    let i = 0
    while ((i = octets.indexOf("stream", i)) !== -1) {
      let debut = i + 6
      if (octets[debut] === 0x0d) debut++
      if (octets[debut] === 0x0a) debut++
      const fin = octets.indexOf("endstream", debut)
      if (fin === -1) break
      try {
        sortie += inflateSync(octets.subarray(debut, fin)).toString("latin1")
      } catch {
        sortie += octets.subarray(debut, fin).toString("latin1")
      }
      i = fin + 9
    }
    // pdf-lib écrit les chaînes en HEXADÉCIMAL : <5A656E697468> est « Zenith ».
    // Chercher le mot en clair échouerait donc sur un document parfaitement
    // rempli.
    return sortie.replace(/<([0-9A-Fa-f]{4,})>/g, (_, hex) => Buffer.from(hex, "hex").toString("latin1"))
  }

  const texte = lisiblePdf(octetsDeposes)
  const pages = (await PDFDocument.load(octetsDeposes)).getPageCount()

  // NEUF articles longs ne tiennent pas sur une page. Si le document en compte
  // une seule, c'est que le texte a débordé dans le vide — le défaut le plus
  // grave possible ici, puisqu'il est invisible.
  verifier("le document enjambe les pages", pages > 1 ? `oui (${pages})` : "UNE SEULE", `oui (${pages})`)

  // Chaque article doit s'y trouver. Un article manquant dans un contrat signé
  // se découvrirait devant le Collège.
  const absents = longs.filter((a) => !texte.includes(a.title_fr.toUpperCase())).map((a) => a.code)
  verifier("tous les articles sont imprimés", absents.join(", ") || "tous", "tous")

  verifier("la référence figure au document", texte.includes(`ENT-EM-${marque}`) ? "oui" : "NON", "oui")
  // Le permis atteste que le signataire est autorisé à représenter devant
  // IRCC. Un contrat qui ne le porte pas n'identifie pas son consultant.
  const { data: cabLu } = await admin.from("firms").select("rcic_license_number").eq("id", cabinetA).single()
  verifier("le permis du consultant y figure", texte.includes(cabLu.rcic_license_number) ? "oui" : "NON", "oui")
  // Le §25 : le consultant signe aussi. Deux blocs de signature, pas un.
  verifier("le client ET le consultant signent",
    texte.includes("Diallo") && texte.includes("Consultant") ? "oui" : "NON", "oui")
  // Les alinéas du modèle ne doivent pas devenir des « ? ». Le retour à la
  // ligne n'appartient pas au WinAnsi : assaini avant d'être découpé, il
  // effaçait les alinéas de tous les articles.
  verifier("les alinéas ne deviennent pas des « ? »", texte.includes("??") ? "OUI" : "non", "non")

  // ---- LES DEUX BLOCS D'IDENTIFICATION (§8) -------------------------------
  // Le contrat n'identifiait qu'une des deux parties qui s'engagent : le
  // cabinet ne figurait que dans l'en-tête, avec une adresse d'UNE ligne.
  // Les panneaux sont NUMÉROTÉS : un contrat se cite, et « la partie désignée
  // au paragraphe 1 » a besoin d'un paragraphe 1.
  verifier("le panneau 1 — consultant",
    texte.includes("1. CONSULTANT / REPRÉSENTANT") ? "oui" : "NON", "oui")
  verifier("le panneau 2 — client",
    texte.includes("2. CLIENT / CONTRACTANT") ? "oui" : "NON", "oui")
  // Le pied porte la référence à côté de la pagination : une page détachée
  // doit pouvoir être rattachée à son document.
  verifier("le pied rattache la page à son contrat",
    texte.includes(`ENT-EM-${marque}  ·  Page`) ? "oui" : "NON", "oui")
  verifier("l'adresse professionnelle y figure en entier",
    texte.includes("Gatineau (Québec) J8X 0B9") ? "oui" : "NON", "oui")
  verifier("l'adresse du client y figure en entier",
    texte.includes("Montreal (Québec) H2X 1Y4") ? "oui" : "NON", "oui")
  // Le bureau du consultant et l'appartement du client sont deux lignes
  // différentes : les confondre serait exactement ce que le §8 interdit.
  verifier("le bureau du consultant", texte.includes("Bureau 801") ? "oui" : "NON", "oui")
  verifier("l'appartement du client", texte.includes("Appartement 4") ? "oui" : "NON", "oui")
  verifier("le permis est FIGÉ sur la partie, pas relu sur le cabinet",
    texte.includes(`R51${String(marque).slice(-5)}`) ? "oui" : "NON", "oui")

  // AUCUNE LIGNE VIDE (§4). Un bloc composé naïvement produit « , , » ou
  // « () » quand un morceau manque. On l'éprouve sur une entente dont le
  // consultant n'a NI bureau NI province.
  const { data: nu } = await cabinet.from("agreements").insert({
    firm_id: cabinetA, client_id: cl.id, template_id: modele.id, template_version: "1.0",
    reference: `ENT-NU-${marque}`, title: "Adresse partielle", kind: "services",
    status: "draft", articles_snapshot: [{ position: 1, code: "x", title_fr: "Objet", body_fr: "Texte.", level: "free" }],
    fees_amount: 100, total_amount: 100,
  }).select("id").single()
  await cabinet.from("agreement_parties").insert([
    { firm_id: cabinetA, agreement_id: nu.id, role: "client", civility: "mrs",
      first_name: "Awa", last_name: "Diallo", legal_name: "", email: "a@b.invalid",
      phone: "", address: "1 rue Seule", address_line2: "", city: "", province: "",
      postal_code: "", country: "", license_number: "", signing_order: 1 },
    { firm_id: cabinetA, agreement_id: nu.id, role: "consultant", civility: "mr",
      first_name: "", last_name: "Proprietaire 1", legal_name: "", email: "",
      phone: "", address: "88 rue Dollard-des-Ormeaux", address_line2: "",
      city: "Gatineau", province: "", postal_code: "", country: "",
      license_number: "", signing_order: 2 },
  ])
  const { pdfDEntente } = await import("../lib/ententes/document.ts")
  const partiel = await pdfDEntente(cabinet, nu.id)
  const texteNu = lisiblePdf(Buffer.from(partiel.octets))
  verifier("aucune parenthèse vide quand la province manque",
    /\(\s*\)/.test(texteNu) ? "OUI" : "non", "non")
  verifier("aucune virgule orpheline", /,\s*,/.test(texteNu) ? "OUI" : "non", "non")
  verifier("la ville seule s'imprime quand même",
    texteNu.includes("Gatineau") ? "oui" : "NON", "oui")

  // ---- Réémettre --------------------------------------------------------
  // Le PDF a pu être envoyé, voire signé. Le remplacer changerait le document
  // sous la signature — ce que l'empreinte sert précisément à empêcher.
  const seconde = await emettre(cabinet, membre, aEmettre.id)
  verifier("réémettre une entente déjà émise : REFUSÉ", seconde.ok ? "ACCEPTÉ" : "refusé", "refusé")

  // ---- La signature réutilise la chaîne existante -------------------------
  const { data: demande, error: eDem } = await cabinet.from("signature_requests").insert({
    firm_id: cabinetA, document_id: apresEmission.document_id, client_id: cl.id,
    document_sha256: piece.sha256, requested_by: userA,
    expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
  }).select("id, document_sha256").single()
  verifier("une demande de signature s'ouvre dessus", eDem ? eDem.message : "ok", "ok")
  verifier("elle fige l'empreinte du document", demande?.document_sha256, piece.sha256)

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
  console.log("\nLa conversion emmène les ententes (§22)")
  // -------------------------------------------------------------------------
  // Le cas est ordinaire : le consultant fait signer une entente de
  // consultation AU PROSPECT, puis le convertit. `lead_id` est « on delete
  // cascade » — sans transfert, un ménage de pipeline détruirait un contrat
  // signé.
  const { data: prospect2 } = await admin.from("leads").insert({
    firm_id: cabinetA, name: "Kofi Mensah", email: `kofi-${marque}@example.invalid`,
    phone: "+1 514 555 0177", type: "b2c", visa_type: "Résidence permanente",
    estimated_value: 3200, score: 65, score_label: "med", stage: "consultation",
    last_contact: new Date().toISOString().slice(0, 10), notes: "", civility: "mr",
  }).select("id").single()

  const { data: entProspect } = await cabinet.from("agreements").insert({
    firm_id: cabinetA, lead_id: prospect2.id, template_id: modele.id,
    template_version: "1.0", reference: `ENT-CV-${marque}`,
    title: "Consultation initiale", kind: "consultation", status: "draft",
    articles_snapshot: [], fees_amount: 200, total_amount: 200,
  }).select("id").single()

  const { data: client2 } = await admin.from("clients").insert({
    firm_id: cabinetA, name: "Kofi Mensah", email: `kofi-cli-${marque}@example.invalid`,
    file_number: `DOS-C-${String(marque).slice(-6)}`, program: "Résidence permanente",
    status: "active", client_type: "individual", civility: "mr",
  }).select("id").single()

  // Le geste exact de convertLeadToClient() : UN SEUL update, les deux
  // colonnes ensemble, parce que agreements_destinataire refuse l'état
  // intermédiaire.
  const { error: eSuivi } = await cabinet.from("agreements")
    .update({ client_id: client2.id, lead_id: null })
    .eq("firm_id", cabinetA).eq("lead_id", prospect2.id)
  verifier("l'entente suit la conversion", eSuivi ? eSuivi.message : "ok", "ok")

  // Poser client_id SANS vider lead_id doit être refusé : c'est l'état que la
  // contrainte existe pour empêcher, et c'est celui qu'un transfert écrit en
  // deux temps produirait.
  const { data: entDeuxTemps } = await cabinet.from("agreements").insert({
    firm_id: cabinetA, lead_id: prospect2.id, template_id: modele.id,
    template_version: "1.0", reference: `ENT-2T-${marque}`, title: "Deux temps",
    kind: "consultation", status: "draft", articles_snapshot: [],
  }).select("id").single()
  const { error: eDeuxTemps } = await cabinet.from("agreements")
    .update({ client_id: client2.id }).eq("id", entDeuxTemps.id)
  verifier("un transfert en deux temps : REFUSÉ", eDeuxTemps ? "refusé" : "ACCEPTÉ", "refusé")

  // LE CONTRÔLE QUI COMPTE. Le prospect est effacé ; l'entente transférée doit
  // survivre. C'est ce que vider lead_id protège.
  await admin.from("leads").delete().eq("id", prospect2.id)
  const { data: survivante } = await admin
    .from("agreements").select("id, client_id").eq("id", entProspect.id).maybeSingle()
  verifier("effacer le prospect ne détruit pas l'entente", survivante ? "elle vit" : "DÉTRUITE", "elle vit")
  verifier("et elle est désormais au dossier du client", survivante?.client_id, client2.id)

  // -------------------------------------------------------------------------
  console.log("\nModifier la fiche : les documents passés ne bougent pas (§5)")
  // -------------------------------------------------------------------------
  // LE SCÉNARIO DU §14, JOUÉ EN ENTIER. C'est le contrôle qui compte le plus de
  // tout ce fichier : un client déménage, et le contrat qu'il a signé le mois
  // dernier doit rester exactement ce qu'il a signé.
  const { modifierFiche } = await import("../lib/data/fiche-modification.ts")
  const { journalDeLaFiche } = await import("../lib/data/journal.ts")
  // Le PROFIL, pas l'utilisateur : audit_logs.actor_member_id est NOT NULL et
  // référence profiles. Passer null faisait échouer l'insertion du journal —
  // en silence, puisque le journal ne doit pas faire échouer la modification.
  // C'est cette épreuve qui l'a montré.
  const { data: profilA } = await admin
    .from("profiles").select("id").eq("user_id", userA).single()
  const membreFiche = {
    firmId: cabinetA, profileId: profilA.id, userId: userA,
    fullName: "Propriétaire 1", email: "", role: "owner",
  }

  // L'entente ENT-EM a été émise plus haut, avec l'adresse « 456 rue Exemple ».
  const { data: avantModif } = await admin
    .from("agreement_parties").select("address, city")
    .eq("agreement_id", aEmettre.id).eq("role", "client").single()
  verifier("le contrat porte l'adresse d'origine", avantModif.address, "456 rue Exemple")

  const r = await modifierFiche(cabinet, membreFiche, "client", cl.id, {
    address: "999 boulevard du Déménagement",
    city: "Québec",
    postal_code: "G1R 2B5",
  })
  verifier("la fiche se modifie", r.ok ? "ok" : r.message, "ok")

  const { data: apresModif } = await admin
    .from("clients").select("address, city, postal_code").eq("id", cl.id).single()
  verifier("la fiche porte la nouvelle adresse", apresModif.address, "999 boulevard du Déménagement")

  // LE CONTRÔLE QUI COMPTE (§5). Le contrat signé ne bouge pas.
  const { data: partieApresModif } = await admin
    .from("agreement_parties").select("address, city")
    .eq("agreement_id", aEmettre.id).eq("role", "client").single()
  verifier("le contrat DÉJÀ ÉMIS garde son adresse", partieApresModif.address, "456 rue Exemple")
  verifier("et sa ville", partieApresModif.city, "Montreal")

  // Le PDF classé au dossier non plus : son empreinte le prouve.
  const { data: pieceApres } = await admin
    .from("documents").select("sha256").eq("id", apresEmission.document_id).single()
  verifier("le PDF classé est intact", pieceApres.sha256, piece.sha256)

  // Un NOUVEAU contrat prend la nouvelle adresse (§4).
  const { chargerContractantAvec } = await import("../lib/data/contractant-lecture.ts")
  const source = await chargerContractantAvec(cabinet, { firmId: cabinetA }, "client", cl.id)
  verifier("un nouveau contrat prendrait la nouvelle adresse",
    source.partie.address, "999 boulevard du Déménagement")

  // ---- Le journal (§6) ----------------------------------------------------
  const entrees = await journalDeLaFiche(cabinet, "client", cl.id)
  verifier("la modification est journalisée", entrees.length > 0 ? "oui" : "NON", "oui")
  const champs = (entrees[0]?.changements ?? []).map((c) => c.champ).sort().join(",")
  verifier("le journal nomme les champs modifiés", champs, "address,city,postal_code")
  const adresseJournal = (entrees[0]?.changements ?? []).find((c) => c.champ === "address")
  // La valeur d'avant est celle de la FICHE, pas celle du contrat : le contrôle
  // précédent visait la copie figée dans agreement_parties, celui-ci vise le
  // CRM. La fiche portait « 7 avenue du Déménagement » depuis l'épreuve du §6.
  verifier("il garde la valeur d'AVANT", adresseJournal?.avant, "7 avenue du Déménagement")
  verifier("et celle d'APRÈS", adresseJournal?.apres, "999 boulevard du Déménagement")
  verifier("il nomme l'auteur", entrees[0]?.acteur, "Propriétaire 1")

  // Une modification qui ne change RIEN n'écrit rien : ouvrir un formulaire et
  // le refermer ne doit pas gonfler le journal.
  await modifierFiche(cabinet, membreFiche, "client", cl.id, { city: "Québec" })
  const entrees2 = await journalDeLaFiche(cabinet, "client", cl.id)
  verifier("une modification sans changement n'écrit rien", entrees2.length, entrees.length)

  // LE JOURNAL EST IMMUABLE, et le contrôle porte sur le RÉSULTAT, pas sur le
  // code de retour.
  //
  // PostgREST ne rend AUCUNE erreur ici : RLS ne publie qu'une politique
  // d'insertion et une de lecture, donc un UPDATE ne trouve simplement aucune
  // ligne à modifier et rend « succès, zéro ligne ». Chercher une erreur
  // aurait donc conclu à tort que le journal est réécrivable. Ce qui compte
  // est qu'il n'ait PAS bougé — et il faut le relire pour le savoir.
  await cabinet.from("audit_logs").update({ summary: "réécrit" }).eq("id", entrees[0].id)
  const { data: apresTentativeMaj } = await admin
    .from("audit_logs").select("summary").eq("id", entrees[0].id).maybeSingle()
  verifier("réécrire le journal ne change rien", apresTentativeMaj?.summary, entrees[0].resume)

  await cabinet.from("audit_logs").delete().eq("id", entrees[0].id)
  const { data: apresTentativeSup } = await admin
    .from("audit_logs").select("id").eq("id", entrees[0].id).maybeSingle()
  verifier("l'effacer ne l'efface pas", apresTentativeSup ? "toujours là" : "EFFACÉ", "toujours là")

  // Et même avec les pleins pouvoirs — le déclencheur, lui, LÈVE.
  const { error: eForce } = await admin
    .from("audit_logs").update({ summary: "forcé" }).eq("id", entrees[0].id)
  verifier("même en service_role : REFUSÉ", eForce ? "refusé" : "ACCEPTÉ", "refusé")

  // Un autre cabinet ne lit pas ce journal.
  const { data: jTiers } = await tiers.from("audit_logs").select("id").eq("entity_id", cl.id)
  verifier("un autre cabinet ne voit pas le journal", (jTiers ?? []).length, 0)

  // -------------------------------------------------------------------------
  console.log("\nCréer une fiche : le MÊME chemin que la modifier (§17)")
  // -------------------------------------------------------------------------
  const { creerFiche } = await import("../lib/data/fiche-creation.ts")

  const rProspect = await creerFiche(cabinet, membreFiche, "lead", {
    civility: "mrs", first_name: "Aïcha", last_name: "Ndiaye",
    email: `aicha-${marque}@example.invalid`, phone: "+1 514 555 0188",
    address: "789 rue Neuve", address_line2: "Appartement 12",
    city: "Laval", province: "Québec", postal_code: "H7N 1A1", country: "Canada",
    visa_type: "Permis de travail", estimated_value: 3200, score_label: "high",
    contact_intent: "mandate", source: "Épreuve",
  })
  verifier("un prospect se crée", rProspect.ok ? "ok" : rProspect.message, "ok")

  const { data: prospectCree } = await admin
    .from("leads")
    .select("name, civility, address, address_line2, city, province, postal_code, country, score, stage, type")
    .eq("id", rProspect.id).single()
  // L'ADRESSE COMPLÈTE est disponible IMMÉDIATEMENT (§19) : c'est tout l'objet
  // du lot. Le formulaire de création la collectait sans que la colonne
  // address_line2 existe.
  verifier("son nom est composé", prospectCree.name, "Aïcha Ndiaye")
  verifier("son appartement est enregistré", prospectCree.address_line2, "Appartement 12")
  verifier("sa province aussi", prospectCree.province, "Québec")
  // Le score chiffré suit l'étiquette : c'est lui que le pipeline trie.
  verifier("le score suit la faisabilité", prospectCree.score, 90)
  verifier("il entre à l'étape « nouveau »", prospectCree.stage, "newLead")

  // Sans nom ni courriel, la création est REFUSÉE — à l'action, pas seulement
  // à l'écran : l'action reste appelable sans lui.
  const rVide = await creerFiche(cabinet, membreFiche, "lead", { first_name: "Sans" })
  verifier("sans nom ni courriel : REFUSÉ", rVide.ok ? "ACCEPTÉ" : "refusé", "refusé")
  const rCourriel = await creerFiche(cabinet, membreFiche, "lead", {
    last_name: "Test", email: "pas-un-courriel",
  })
  verifier("un courriel incomplet : REFUSÉ", rCourriel.ok ? "ACCEPTÉ" : "refusé", "refusé")

  const rClient = await creerFiche(cabinet, membreFiche, "client", {
    civility: "mr", first_name: "Ibrahim", last_name: "Sow",
    email: `ibrahim-${marque}@example.invalid`, phone: "+1 438 555 0199",
    address: "12 avenue Neuve", city: "Sherbrooke", province: "Québec",
    postal_code: "J1H 1A1", country: "Canada",
    program: "Résidence permanente", citizenship: "Sénégal", residence: "International",
  })
  verifier("un client se crée", rClient.ok ? "ok" : rClient.message, "ok")
  // LE NUMÉRO VIENT DE LA BASE, pas du navigateur : l'écran le composait à
  // partir de la longueur de sa propre liste, donc deux consultants créant une
  // fiche en même temps obtenaient le même.
  verifier("son numéro de dossier est attribué",
    /^[A-Z]+-\d{4}-\d+$/.test(rClient.reference ?? "") ? "oui" : `NON (${rClient.reference})`, "oui")

  // Deux créations de suite ne peuvent pas porter le même numéro.
  const rClient2 = await creerFiche(cabinet, membreFiche, "client", {
    last_name: "Bis", email: `bis-${marque}@example.invalid`,
  })
  verifier("deux clients, deux numéros",
    rClient2.reference !== rClient.reference ? "oui" : `MÊME (${rClient.reference})`, "oui")

  // La création est journalisée elle aussi.
  const jCreation = await journalDeLaFiche(cabinet, "client", rClient.id)
  verifier("la création entre au journal", jCreation.length > 0 ? "oui" : "NON", "oui")
  verifier("et nomme le dossier attribué",
    jCreation[0]?.resume?.includes(rClient.reference) ? "oui" : "NON", "oui")

  // §21 : ce qui a été SAISI se relit tel quel dans le formulaire de
  // modification. C'est la cohérence que le §18 exige entre les deux modes.
  const { data: clientRelu } = await admin
    .from("clients")
    .select("civility, first_name, last_name, address, city, province, postal_code, country, citizenship, residence")
    .eq("id", rClient.id).single()
  verifier("la civilité se relit", clientRelu.civility, "mr")
  verifier("l'adresse se relit", clientRelu.address, "12 avenue Neuve")
  verifier("la province se relit", clientRelu.province, "Québec")
  verifier("le lieu de résidence se relit", clientRelu.residence, "International")

  // -------------------------------------------------------------------------
  console.log("\nServices, échéancier et brouillon (§6, §9, §24, §26)")
  // -------------------------------------------------------------------------
  const { verifierEcheancier, recalculer } = await import("../lib/ententes/echeancier.ts")

  const echeancier = [
    // L'étape 1 est un ACOMPTE : la somme arrive avant tout service rendu, donc
    // elle entre en fidéicommis (art. 13). C'est le cas le plus fréquent, et
    // le plus souvent mal traité.
    { position: 1, description: "Paiement initial", declenchement: "À la signature", mode: "interac", base: "montant", montant: 1000, fideicommis: true },
    { position: 2, description: "Dossier complet", declenchement: "Étape 2", mode: "card", base: "montant", montant: 1000 },
    { position: 3, description: "Présentation IRCC", declenchement: "Étape 3", mode: "bank_transfer", base: "montant", montant: 1500 },
    { position: 4, description: "Fin du mandat", declenchement: "Étape 4", mode: "cheque", base: "montant", montant: 1000 },
  ]
  verifier("un échéancier équilibré passe la validation",
    verifierEcheancier(echeancier, 4500).length, 0)

  const { data: brouillon } = await cabinet.from("agreements").insert({
    firm_id: cabinetA, client_id: cl.id, template_id: modele.id, template_version: "1.0",
    reference: `ENT-SV-${marque}`, title: "Permis de travail", kind: "services",
    status: "draft",
    articles_snapshot: [{ position: 1, code: "objet", title_fr: "Objet", body_fr: "Texte.", level: "structural" }],
    fees_amount: 4500, taxes_amount: 673.88, total_amount: 5173.88,
    services_description: "Services professionnels relatifs à la préparation d'une demande de permis de travail.",
    services_items: [
      { position: 1, libelle: "Analyse initiale du dossier" },
      { position: 2, libelle: "Préparation des formulaires" },
    ],
    payment_schedule: echeancier,
    payment_methods: ["interac", "bank_transfer"],
    payment_conditions: "Paiement exigible avant le début des travaux correspondants.",
    excluded_fees: "Frais gouvernementaux, biométrie et traduction non inclus.",
  }).select("id").single()
  verifier("un brouillon porte son contenu personnalisé", brouillon ? "oui" : "NON", "oui")

  // §24, §25 : on rouvre et on modifie.
  const { error: eBrouillon } = await cabinet.from("agreements").update({
    payment_schedule: recalculer(
      [...echeancier.slice(0, 3), { ...echeancier[3], montant: 1200 }], 4700
    ),
    fees_amount: 4700, total_amount: 5373.88,
  }).eq("id", brouillon.id).eq("status", "draft")
  verifier("un BROUILLON se modifie", eBrouillon ? eBrouillon.message : "ok", "ok")

  const { data: apresBrouillon } = await admin.from("agreements")
    .select("payment_schedule, fees_amount").eq("id", brouillon.id).single()
  verifier("la 4e étape est à jour", apresBrouillon.payment_schedule[3].montant, 1200)
  verifier("les honoraires aussi", Number(apresBrouillon.fees_amount), 4700)

  // §26 : une fois émise, elle est FIGÉE. Le filtre sur « draft » ne trouve
  // plus rien — et c'est « zéro ligne », pas une erreur : sans relecture, on
  // conclurait au succès. Le même piège que sur les paramètres du cabinet.
  await cabinet.from("agreements").update({ status: "ready" }).eq("id", brouillon.id)
  await cabinet.from("agreements")
    .update({ services_description: "RÉÉCRIT APRÈS ÉMISSION" })
    .eq("id", brouillon.id).eq("status", "draft")
  const { data: apresEmise } = await admin.from("agreements")
    .select("services_description").eq("id", brouillon.id).single()
  verifier("une entente ÉMISE ne se modifie plus",
    apresEmise.services_description.startsWith("Services professionnels") ? "figée" : "RÉÉCRITE", "figée")

  // Le PDF porte réellement l'échéancier.
  const { pdfDEntente: composer } = await import("../lib/ententes/document.ts")
  const avecEcheancier = await composer(cabinet, brouillon.id)
  const texteEch = lisiblePdf(Buffer.from(avecEcheancier.octets))
  verifier("le PDF porte le titre de l'échéancier",
    texteEch.includes("ÉCHÉANCIER DES HONORAIRES") ? "oui" : "NON", "oui")
  verifier("il porte la description des services",
    texteEch.includes("DESCRIPTION DES SERVICES") ? "oui" : "NON", "oui")
  verifier("il porte les services décomposés",
    texteEch.includes("Analyse initiale du dossier") ? "oui" : "NON", "oui")
  verifier("il porte les quatre étapes",
    ["Paiement initial", "Dossier complet", "Présentation IRCC", "Fin du mandat"]
      .every((d) => texteEch.includes(d)) ? "oui" : "NON", "oui")
  // Le mode est TRADUIT : « interac » imprimé tel quel ferait amateur.
  verifier("les modes sont traduits, pas bruts",
    texteEch.includes("Virement Interac") && !texteEch.includes("bank_transfer") ? "oui" : "NON", "oui")
  verifier("il porte les frais non inclus",
    texteEch.includes("FRAIS NON INCLUS") ? "oui" : "NON", "oui")
  verifier("et le total de l'échéancier",
    texteEch.includes("Total des honoraires") ? "oui" : "NON", "oui")

  // -------------------------------------------------------------------------
  console.log("\nDu contrat à la facture : facturer une étape (§27, §28)")
  // -------------------------------------------------------------------------
  const { facturerEtape, suivreEcheancier } = await import("../lib/ententes/facturation.ts")
  const membreFact = { firmId: cabinetA }

  // L'entente ENT-SV est passée en « ready » plus haut, avec quatre étapes.
  const suivi0 = await suivreEcheancier(cabinet, brouillon.id)
  verifier("le suivi rend les quatre étapes", suivi0.etapes.length, 4)
  verifier("aucune n'est facturée au départ", suivi0.etapes[0].statutCalcule, "a_venir")
  verifier("mais elles sont facturables", suivi0.etapes[0].facturable ? "oui" : "NON", "oui")

  const f1 = await facturerEtape(cabinet, membreFact, brouillon.id, 1)
  verifier("l'étape 1 se facture", f1.ok ? "ok" : f1.message, "ok")
  verifier("la facture porte un numéro", /\d/.test(f1.numero ?? "") ? "oui" : "NON", "oui")

  const { data: factureLue } = await admin.from("invoices")
    .select("agreement_id, agreement_step, amount, client_id").eq("id", f1.factureId).single()
  verifier("elle est rattachée à l'entente", factureLue.agreement_id, brouillon.id)
  verifier("et à l'étape 1", factureLue.agreement_step, 1)
  // LE MONTANT EST TAXES COMPRISES. `sync_invoice_amount` le calcule depuis
  // les lignes et les taux du cabinet : l'étape vaut 1 000 $ d'honoraires, la
  // facture 1 149,75 $. C'est voulu — le contrat annonce des honoraires
  // hors taxes, la facture réclame ce que le client doit payer.
  verifier("son montant est taxes comprises", Number(factureLue.amount) > 1000 ? "oui" : `NON (${factureLue.amount})`, "oui")

  // §28 — le statut est DÉDUIT, pas recopié.
  const suivi1 = await suivreEcheancier(cabinet, brouillon.id)
  verifier("l'étape 1 est désormais « facturée »", suivi1.etapes[0].statutCalcule, "facture")
  verifier("elle porte le numéro de sa facture",
    suivi1.etapes[0].factureNumero === f1.numero ? "oui" : "NON", "oui")
  verifier("elle n'est plus facturable", suivi1.etapes[0].facturable ? "OUI" : "non", "non")
  verifier("les autres restent à venir", suivi1.etapes[1].statutCalcule, "a_venir")

  // UNE ÉTAPE NE SE FACTURE QU'UNE FOIS. L'index unique le tient en base :
  // deux clics ne peuvent pas produire deux factures pour le même versement.
  const f1bis = await facturerEtape(cabinet, membreFact, brouillon.id, 1)
  verifier("refacturer la même étape : REFUSÉ", f1bis.ok ? "ACCEPTÉ" : "refusé", "refusé")
  verifier("et le refus est en français",
    /déjà sa facture/.test(f1bis.message) ? "oui" : `NON (${f1bis.message})`, "oui")

  // Un encaissement PARTIEL déplace le statut, sans qu'on l'écrive nulle part.
  await admin.from("invoices").update({ status: "issued" }).eq("id", f1.factureId)
  await admin.from("payments").insert({
    firm_id: cabinetA, client_id: cl.id, invoice_id: f1.factureId,
    amount: 400, paid_on: new Date().toISOString().slice(0, 10),
    // « business », pas « operating » : la contrainte n'accepte que « trust »
    // ou « business ». Un libellé inventé faisait échouer l'insert en silence.
    method: "interac", destination: "business",
  })
  const suivi2 = await suivreEcheancier(cabinet, brouillon.id)
  verifier("un encaissement partiel se voit", suivi2.etapes[0].statutCalcule, "partiellement_paye")
  verifier("et le montant encaissé aussi", suivi2.etapes[0].regle, 400)

  // Le solde règle la facture : l'étape passe à « payé » SANS écriture dans
  // l'échéancier. C'est tout l'objet du §28.
  const { data: totaux } = await admin.rpc("invoice_totals", { p_invoice_id: f1.factureId })
  const reste = Number((Array.isArray(totaux) ? totaux[0] : totaux)?.total ?? 0) - 400
  await admin.from("payments").insert({
    firm_id: cabinetA, client_id: cl.id, invoice_id: f1.factureId,
    amount: reste, paid_on: new Date().toISOString().slice(0, 10),
    method: "interac", destination: "business",
  })
  const suivi3 = await suivreEcheancier(cabinet, brouillon.id)
  verifier("le solde encaissé fait passer l'étape à « payé »", suivi3.etapes[0].statutCalcule, "paye")

  const { data: echeancierEnBase } = await admin.from("agreements")
    .select("payment_schedule").eq("id", brouillon.id).single()
  // LE CONTRÔLE QUI COMPTE : rien n'a été écrit dans le contrat. Le statut se
  // déduit, il ne se recopie pas — sinon le contrat dirait « payé » et le
  // registre « il reste 500 $ ».
  verifier("le contrat n'a PAS été réécrit",
    echeancierEnBase.payment_schedule[0].statut ?? "a_venir", "a_venir")

  // ---- LE FIDÉICOMMIS SUIT LE CONTRAT (art. 13) ---------------------------
  // Une somme reçue AVANT que le service ne soit rendu n'appartient pas encore
  // au cabinet. L'intention déclarée au contrat doit suivre jusqu'à la facture,
  // sinon il faut y penser une seconde fois au moment d'encaisser — et c'est
  // là qu'on l'oublie.
  const { data: factureFiducie } = await admin.from("invoices")
    .select("is_trust_account").eq("id", f1.factureId).single()
  verifier("l'étape en fidéicommis marque sa facture",
    factureFiducie.is_trust_account === true ? "oui" : "NON", "oui")

  // Une étape ORDINAIRE ne marque pas la sienne : la mention de l'article 13
  // sur un honoraire déjà gagné serait fausse.
  const f2 = await facturerEtape(cabinet, membreFact, brouillon.id, 2)
  verifier("l'étape 2 se facture", f2.ok ? "ok" : f2.message, "ok")
  const { data: facture2 } = await admin.from("invoices")
    .select("is_trust_account").eq("id", f2.factureId).single()
  verifier("une étape ordinaire ne l'est PAS",
    facture2.is_trust_account === true ? "OUI" : "non", "non")

  // Le PDF porte la marque ET la mention réglementaire.
  const avecFiducie = await composer(cabinet, brouillon.id)
  const texteFid = lisiblePdf(Buffer.from(avecFiducie.octets))
  verifier("le contrat marque le versement en fiducie",
    texteFid.includes("(fidéicommis)") ? "oui" : "NON", "oui")
  verifier("et porte la mention de l'article 13",
    texteFid.includes("détenus en fiducie") ? "oui" : "NON", "oui")

  // Un encaissement vers le compte de FIDUCIE alimente le registre — c'est le
  // déclencheur `payments_trust_deposit` qui l'écrit, pas nous.
  await admin.from("payments").insert({
    firm_id: cabinetA, client_id: cl.id, invoice_id: f2.factureId,
    amount: 100, paid_on: new Date().toISOString().slice(0, 10),
    method: "interac", destination: "trust",
  })
  const { data: registre } = await admin.from("trust_ledger")
    .select("entry_type, amount").eq("invoice_id", f2.factureId)
  verifier("un encaissement en fiducie entre au registre", (registre ?? []).length, 1)
  verifier("comme un dépôt", registre?.[0]?.entry_type, "deposit")

  // Un BROUILLON ne se facture pas : son montant peut encore changer.
  const { data: brouillon2 } = await cabinet.from("agreements").insert({
    firm_id: cabinetA, client_id: cl.id, template_id: modele.id, template_version: "1.0",
    reference: `ENT-BR-${marque}`, title: "Brouillon", kind: "services", status: "draft",
    articles_snapshot: [], fees_amount: 1000, total_amount: 1000,
    payment_schedule: [{ position: 1, description: "Acompte", base: "montant", montant: 1000 }],
  }).select("id").single()
  const fBrouillon = await facturerEtape(cabinet, membreFact, brouillon2.id, 1)
  verifier("facturer un BROUILLON : REFUSÉ", fBrouillon.ok ? "ACCEPTÉ" : "refusé", "refusé")

  // Une entente qui vise un PROSPECT n'a pas de destinataire de facture.
  const { data: entProspect2 } = await cabinet.from("agreements").insert({
    firm_id: cabinetA, lead_id: prospect.id, template_id: modele.id, template_version: "1.0",
    reference: `ENT-PR-${marque}`, title: "Prospect", kind: "services", status: "ready",
    articles_snapshot: [], fees_amount: 500, total_amount: 500,
    payment_schedule: [{ position: 1, description: "Acompte", base: "montant", montant: 500 }],
  }).select("id").single()
  const fProspect = await facturerEtape(cabinet, membreFact, entProspect2.id, 1)
  verifier("facturer un PROSPECT : REFUSÉ", fProspect.ok ? "ACCEPTÉ" : "refusé", "refusé")
  verifier("et le refus dit quoi faire",
    /Convertissez/.test(fProspect.message) ? "oui" : `NON (${fProspect.message})`, "oui")

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
  if (deposes.length) await admin.storage.from("documents").remove(deposes)
  for (const id of [cabinetA, cabinetB]) if (id) await admin.rpc("purger_cabinet_epreuve", { p_firm_id: id })
  for (const id of [userA, userB]) if (id) await admin.auth.admin.deleteUser(id)
  console.log("\nCabinets et comptes d'épreuve supprimés.")
}

console.log(echecs === 0 ? "\n✓ Socle des ententes vérifié, 0 échec." : `\n✗ ${echecs} échec(s).`)
process.exit(echecs === 0 ? 0 : 1)
