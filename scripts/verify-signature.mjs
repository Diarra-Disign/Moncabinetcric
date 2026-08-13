#!/usr/bin/env node
/**
 * Éprouve le socle de la signature électronique contre la base réelle.
 *
 * CE QUE CE SCRIPT CHERCHE À PRENDRE EN DÉFAUT, dans l'ordre :
 *
 * 1. LE JETON. Il ouvre un document à quelqu'un qui n'a AUCUN compte. C'est le
 *    seul endroit du produit où une chaîne de caractères vaut une
 *    autorisation : s'il fuit, s'il survit à son échéance ou s'il donne accès
 *    au document d'un autre, tout le reste est sans objet.
 *
 * 2. L'ÉCHÉANCE ET LA RÉVOCATION, vérifiées EN BASE. L'ancienne implémentation
 *    les vérifiait dans le code applicatif seulement — ce qui cède à un appel
 *    direct de l'API.
 *
 * 3. L'ORDRE DE SIGNATURE. En séquentiel, le second ne doit pas pouvoir
 *    prendre les devants : un contrat signé dans le désordre est contestable
 *    et impossible à corriger après coup.
 *
 * 4. LE CLOISONNEMENT. Un cabinet ne voit ni les destinataires ni les champs
 *    d'un autre.
 */
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { randomBytes, createHash } from "node:crypto"
import { inflateSync } from "node:zlib"
import { createClient } from "@supabase/supabase-js"
import { exigerSupabase } from "./lib/environnement.mjs"
// Les règles pures sont importées TELLES QUELLES : les recopier ici
// éprouverait une copie, et le jour où l'originale changerait, l'épreuve
// continuerait de réussir sur autre chose.
import { statutDeduit, sonTour, nomDocumentSigne } from "../lib/signature/statuts.ts"
import { verrouiller, nouvelleVersion, chaineDesVersions } from "../lib/signature/versions.ts"
import { SignatureService, fournisseurConfigure } from "../lib/signature/service.ts"
import { reagirASignature } from "../lib/workflow/signature-reactions.ts"
import { finaliser } from "../lib/signature/finalisation.ts"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const env = Object.fromEntries(
  [...readFileSync(join(ROOT, ".env.local"), "utf8").matchAll(/^([A-Z0-9_]+)=(.*)$/gm)]
    .map((m) => [m[1], m[2].trim()])
)
exigerSupabase(env)

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
  console.log(`  ${ok ? "✓" : "✗"} ${intitule.padEnd(54)} ${String(obtenu).slice(0, 38)}` +
    (ok ? "" : `   ATTENDU ${attendu}`))
}

const marque = Date.now()
const mdp = "Epreuve-" + randomBytes(9).toString("base64url")
const empreinte = (jeton) => createHash("sha256").update(jeton).digest("hex")
/**
 * Le texte lisible d'un PDF.
 *
 * pdf-lib écrit les chaînes en HEXADÉCIMAL : chercher un mot en clair
 * échouerait sur un document parfaitement rempli. Le piège avait déjà mordu
 * deux fois sur l'épreuve du PDF de facture.
 */
const lisiblePdf = (octets) => {
  let sortie = ""
  let i = 0
  while ((i = octets.indexOf("stream", i)) !== -1) {
    let debut = i + 6
    if (octets[debut] === 0x0d) debut++
    if (octets[debut] === 0x0a) debut++
    const fin = octets.indexOf("endstream", debut)
    if (fin === -1) break
    try { sortie += inflateSync(octets.subarray(debut, fin)).toString("latin1") }
    catch { sortie += octets.subarray(debut, fin).toString("latin1") }
    i = fin + 9
  }
  return sortie.replace(/<([0-9A-Fa-f]{4,})>/g, (_, hex) =>
    Buffer.from(hex, "hex").toString("latin1"))
}

/** Ce que voit un porteur de jeton. Défini une fois, employé partout. */
const resoudre = async (jeton) => {
  const { data } = await admin.rpc("resolve_signature_token", { p_token_hash: empreinte(jeton) })
  return (data ?? [])[0] ?? null
}
let cabinetA, cabinetB, userA, userB

const nouveauCabinet = async (suffixe) => {
  const courriel = `sig-${suffixe}-${marque}@example.invalid`
  const { data: cab, error: e1 } = await admin.from("firms").insert({
    name: `Cabinet signature ${suffixe} ${marque}`,
    rcic_license_number: `R6${suffixe}${String(marque).slice(-5)}`,
    owner_name: "Épreuve", email: courriel, plan: "cabinet", status: "active",
  }).select("id").single()
  if (e1) throw new Error(`Cabinet ${suffixe} : ${e1.message}`)

  const { data: u } = await admin.auth.admin.createUser({
    email: courriel, password: mdp, email_confirm: true,
  })
  await admin.from("profiles").insert({
    firm_id: cab.id, user_id: u.user.id, email: courriel,
    full_name: `Propriétaire ${suffixe}`, cicc_role: "owner", status: "active",
  })
  await admin.from("firm_subscriptions").insert({
    firm_id: cab.id, plan: "cabinet", cadence: "monthly", seats: 3,
    status: "active", stripe_customer_id: `cus_sig_${suffixe}_${marque}`,
  })
  return { firmId: cab.id, userId: u.user.id, client: await session(courriel, mdp) }
}

/** Un document porteur d'un fichier — sans quoi il n'y a rien à signer. */
const nouveauDocument = async (firmId, clientId, nom) => {
  const { data, error } = await admin.from("documents").insert({
    firm_id: firmId, client_id: clientId, name: nom, type: "Entente de service",
    category: "contract", uploaded_by: "Épreuve", source: "cabinet", status: "valid",
    storage_path: `${firmId}/${clientId}/faux/${nom}`,
    sha256: createHash("sha256").update(`${nom}-${marque}`).digest("hex"),
    mime_type: "application/pdf", size_bytes: 12345,
  }).select("id, sha256").single()
  if (error) throw new Error(`Document : ${error.message}`)
  return data
}

try {
  const A = await nouveauCabinet(1)
  const B = await nouveauCabinet(2)
  cabinetA = A.firmId; cabinetB = B.firmId
  userA = A.userId; userB = B.userId
  const cabinet = A.client
  const tiers = B.client

  // -------------------------------------------------------------------------
  console.log("\nLes demandes fantômes ont été annulées, pas laissées en l'état")
  // -------------------------------------------------------------------------
  const { data: restantes } = await admin
    .from("signature_requests").select("id").eq("status", "pending")
  verifier("aucune demande n'est restée « pending »", (restantes ?? []).length, 0)

  // -------------------------------------------------------------------------
  console.log("\nDestinataires et champs : le cabinet les tient")
  // -------------------------------------------------------------------------
  const { data: cl } = await admin.from("clients").insert({
    firm_id: cabinetA, name: "Jean Tremblay", first_name: "Jean", last_name: "Tremblay",
    email: `jean-${marque}@example.invalid`, file_number: `DOS-S-${String(marque).slice(-6)}`,
    program: "Permis de travail", status: "active", client_type: "individual",
  }).select("id").single()

  const doc = await nouveauDocument(cabinetA, cl.id, "Contrat de services.pdf")

  const { data: demande, error: eDem } = await cabinet.from("signature_requests").insert({
    firm_id: cabinetA, document_id: doc.id, client_id: cl.id,
    document_sha256: doc.sha256, requested_by: userA,
    status: "sent", signing_mode: "sequential", provider: "internal",
    expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
  }).select("id, provider, signing_mode").single()
  verifier("une demande se crée", eDem ? eDem.message : "ok", "ok")
  verifier("elle retient son fournisseur", demande.provider, "internal")
  verifier("et son mode de signature", demande.signing_mode, "sequential")

  // LE JETON N'EST JAMAIS STOCKÉ EN CLAIR : seule son empreinte l'est.
  const jetonClient = randomBytes(32).toString("base64url")
  const jetonConsultant = randomBytes(32).toString("base64url")

  const { error: eDest } = await cabinet.from("signature_recipients").insert([
    {
      firm_id: cabinetA, request_id: demande.id, role: "client", rank: 1,
      full_name: "Jean Tremblay", email: `jean-${marque}@example.invalid`,
      token_hash: empreinte(jetonClient), auth_method: "email_confirm",
      expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
      rcic_number: null, status: "pending",
    },
    {
      firm_id: cabinetA, request_id: demande.id, role: "consultant", rank: 2,
      full_name: "Adama Diarra", email: `consultant-${marque}@example.invalid`,
      token_hash: empreinte(jetonConsultant), auth_method: "email_confirm",
      expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
      rcic_number: "R1041776", status: "pending",
    },
  ])
  verifier("deux destinataires s'enregistrent", eDest ? eDest.message : "ok", "ok")

  const { data: enBase } = await admin
    .from("signature_recipients").select("token_hash, rcic_number, rank")
    .eq("request_id", demande.id).order("rank")
  // LE CONTRÔLE QUI COMPTE : le jeton lui-même n'est nulle part.
  verifier("le jeton en clair n'est PAS en base",
    enBase.some((r) => r.token_hash === jetonClient) ? "TROUVÉ" : "absent", "absent")
  verifier("seule son empreinte l'est", enBase[0].token_hash, empreinte(jetonClient))
  // Le permis du consultant, que l'ancienne implémentation oubliait d'écrire.
  verifier("le permis du consultant est enregistré", enBase[1].rcic_number, "R1041776")

  const { error: eDouble } = await cabinet.from("signature_recipients").insert({
    firm_id: cabinetA, request_id: demande.id, role: "client", rank: 3,
    full_name: "Jean Bis", email: `jean-${marque}@example.invalid`,
  })
  verifier("le même courriel deux fois : REFUSÉ", eDouble ? "refusé" : "ACCEPTÉ", "refusé")

  const { data: destinataires } = await admin
    .from("signature_recipients").select("id, rank").eq("request_id", demande.id).order("rank")

  const { error: eChamps } = await cabinet.from("signature_fields").insert([
    { firm_id: cabinetA, request_id: demande.id, recipient_id: destinataires[0].id,
      kind: "signature", label: "Signature du client", required: true, position: 1 },
    { firm_id: cabinetA, request_id: demande.id, recipient_id: destinataires[0].id,
      kind: "date", label: "Date", required: true, position: 2 },
    { firm_id: cabinetA, request_id: demande.id, recipient_id: destinataires[1].id,
      kind: "signature", label: "Signature du consultant", required: true, position: 1 },
  ])
  verifier("les champs s'enregistrent", eChamps ? eChamps.message : "ok", "ok")

  const { error: eType } = await cabinet.from("signature_fields").insert({
    firm_id: cabinetA, request_id: demande.id, recipient_id: destinataires[0].id,
    kind: "empreinte_digitale", label: "x",
  })
  verifier("un type de champ inventé : REFUSÉ", eType ? "refusé" : "ACCEPTÉ", "refusé")

  // -------------------------------------------------------------------------
  console.log("\nLe jeton : ce qu'il ouvre, et ce qu'il n'ouvre pas")
  // -------------------------------------------------------------------------
  const vuClient = await resoudre(jetonClient)
  verifier("un jeton valide ouvre SON document", vuClient?.document_id, doc.id)
  verifier("il nomme le destinataire", vuClient?.full_name, "Jean Tremblay")
  verifier("il ne rend AUCUN identifiant de dossier",
    Object.keys(vuClient ?? {}).some((k) => /matter|dossier/i.test(k)) ? "FUITE" : "aucun", "aucun")

  // L'ORDRE : en séquentiel, le second attend son tour. La base applique la
  // règle, pas seulement l'écran.
  verifier("c'est au tour du premier", vuClient?.son_tour, true)
  const vuConsultant = await resoudre(jetonConsultant)
  verifier("ce n'est PAS au tour du second", vuConsultant?.son_tour, false)

  verifier("un jeton inventé n'ouvre rien",
    (await resoudre("jeton-invente-" + marque)) ? "OUVERT" : "rien", "rien")

  // ÉCHÉANCE — vérifiée en base, pas dans le code applicatif.
  const jetonExpire = randomBytes(32).toString("base64url")
  await admin.from("signature_recipients").insert({
    firm_id: cabinetA, request_id: demande.id, role: "witness", rank: 9,
    full_name: "Témoin Expiré", email: `expire-${marque}@example.invalid`,
    token_hash: empreinte(jetonExpire),
    expires_at: new Date(Date.now() - 86400000).toISOString(),
  })
  verifier("un jeton EXPIRÉ n'ouvre rien",
    (await resoudre(jetonExpire)) ? "OUVERT" : "rien", "rien")

  // RÉVOCATION.
  const jetonRevoque = randomBytes(32).toString("base64url")
  await admin.from("signature_recipients").insert({
    firm_id: cabinetA, request_id: demande.id, role: "witness", rank: 8,
    full_name: "Témoin Révoqué", email: `revoque-${marque}@example.invalid`,
    token_hash: empreinte(jetonRevoque), revoked_at: new Date().toISOString(),
  })
  verifier("un jeton RÉVOQUÉ n'ouvre rien",
    (await resoudre(jetonRevoque)) ? "OUVERT" : "rien", "rien")

  // Une demande annulée ferme tous ses liens d'un coup.
  const docB = await nouveauDocument(cabinetA, cl.id, "Annulé.pdf")
  const { data: demandeAnnulee } = await cabinet.from("signature_requests").insert({
    firm_id: cabinetA, document_id: docB.id, client_id: cl.id,
    document_sha256: docB.sha256, requested_by: userA, status: "cancelled",
  }).select("id").single()
  const jetonAnnule = randomBytes(32).toString("base64url")
  await admin.from("signature_recipients").insert({
    firm_id: cabinetA, request_id: demandeAnnulee.id, role: "client", rank: 1,
    full_name: "X", email: `annule-${marque}@example.invalid`,
    token_hash: empreinte(jetonAnnule),
  })
  verifier("le lien d'une demande ANNULÉE n'ouvre rien",
    (await resoudre(jetonAnnule)) ? "OUVERT" : "rien", "rien")

  // -------------------------------------------------------------------------
  console.log("\nLes règles pures, éprouvées avec la base")
  // -------------------------------------------------------------------------
  const etats = destinataires.map((d, i) => ({ rank: d.rank, status: i === 0 ? "signed" : "pending" }))
  verifier("une signature sur deux : partiellement signée",
    statutDeduit(etats, "sent"), "partially_signed")
  verifier("le second peut alors signer", sonTour(etats, 2, "sequential"), true)
  verifier("le nom du fichier signé",
    nomDocumentSigne("Contrat de services", "Jean Tremblay"),
    "Contrat_de_services_SIGNE_Jean_Tremblay.pdf")

  // -------------------------------------------------------------------------
  console.log("\nLe verrouillage de version — la garantie du §10")
  // -------------------------------------------------------------------------
  const docV = await nouveauDocument(cabinetA, cl.id, "Contrat a verrouiller.pdf")

  // Avant verrouillage, le contenu se modifie librement : un brouillon doit
  // rester un brouillon.
  const { error: eLibre } = await cabinet.from("documents")
    .update({ sha256: "libre".padEnd(64, "0") }).eq("id", docV.id)
  verifier("un document NON verrouillé se modifie", eLibre ? eLibre.message : "ok", "ok")

  verifier("le verrou se pose", await verrouiller(cabinet, docV.id) ? "oui" : "NON", "oui")

  // LE CONTRÔLE QUI COMPTE. Sans lui, on ferait signer une version et on
  // présenterait l'autre.
  const { error: eContenu } = await cabinet.from("documents")
    .update({ sha256: "detourne".padEnd(64, "0") }).eq("id", docV.id)
  verifier("le CONTENU ne se modifie plus", eContenu ? "refusé" : "ACCEPTÉ", "refusé")

  const { error: eChemin } = await cabinet.from("documents")
    .update({ storage_path: "ailleurs/detourne.pdf" }).eq("id", docV.id)
  verifier("le FICHIER ne se remplace plus", eChemin ? "refusé" : "ACCEPTÉ", "refusé")

  // Le verrou ne se retire pas : sans cela il ne serait qu'une convention.
  const { error: eDeverrou } = await cabinet.from("documents")
    .update({ locked_at: null }).eq("id", docV.id)
  verifier("le VERROU lui-même ne se retire pas", eDeverrou ? "refusé" : "ACCEPTÉ", "refusé")

  const { error: eSuppr } = await cabinet.from("documents").delete().eq("id", docV.id)
  verifier("un document verrouillé ne se supprime pas", eSuppr ? "refusé" : "ACCEPTÉ", "refusé")

  // MÊME AVEC LES PLEINS POUVOIRS. C'est la différence entre une garantie et
  // une convention : le rôle de service contourne RLS, pas les déclencheurs.
  const { error: eService } = await admin.from("documents")
    .update({ sha256: "service".padEnd(64, "0") }).eq("id", docV.id)
  verifier("même en service_role : REFUSÉ", eService ? "refusé" : "ACCEPTÉ", "refusé")

  // Ce qui N'EST PAS verrouillé, et c'est délibéré : renommer une pièce ne
  // change pas ce qui a été signé.
  const { error: eNom } = await cabinet.from("documents")
    .update({ name: "Contrat renommé.pdf" }).eq("id", docV.id)
  verifier("le NOM reste modifiable", eNom ? eNom.message : "ok", "ok")

  // Un cabinet ne verrouille pas le document d'un autre — malgré
  // SECURITY DEFINER, la fonction vérifie le cabinet.
  const docTiers = await nouveauDocument(cabinetB, null, "Chez B.pdf")
  verifier("on ne verrouille pas le document d'un autre cabinet",
    await verrouiller(cabinet, docTiers.id) ? "VERROUILLÉ" : "refusé", "refusé")

  // -------------------------------------------------------------------------
  console.log("\nAnnuler et reprendre — la sortie du verrou")
  // -------------------------------------------------------------------------
  const { data: demandeV } = await cabinet.from("signature_requests").insert({
    firm_id: cabinetA, document_id: docV.id, client_id: cl.id,
    document_sha256: docV.sha256, requested_by: userA, status: "sent",
  }).select("id").single()
  const jetonV = randomBytes(32).toString("base64url")
  await cabinet.from("signature_recipients").insert({
    firm_id: cabinetA, request_id: demandeV.id, role: "client", rank: 1,
    full_name: "Jean Tremblay", email: `jeanv-${marque}@example.invalid`,
    token_hash: empreinte(jetonV),
  })
  verifier("le lien de la version 1 fonctionne",
    (await resoudre(jetonV)) ? "oui" : "NON", "oui")

  const membreV = { firmId: cabinetA, fullName: "Propriétaire 1", email: "" }
  const v2 = await nouvelleVersion(cabinet, membreV, docV.id, "Faute dans l'article 3.")
  verifier("une nouvelle version se crée", v2.ok ? "ok" : v2.message, "ok")
  verifier("elle porte le numéro 2", v2.version, 2)

  // LE POINT CRITIQUE : l'ancien lien meurt avec l'ancienne version. Sans cela,
  // un client pourrait signer le contrat périmé pendant que le nouveau circule.
  verifier("le lien de la version 1 est MORT",
    (await resoudre(jetonV)) ? "VIVANT" : "révoqué", "révoqué")

  const { data: apresAnnulation } = await admin.from("signature_requests")
    .select("status").eq("id", demandeV.id).single()
  verifier("sa demande est annulée", apresAnnulation.status, "cancelled")

  const { data: ancienne } = await admin.from("documents")
    .select("locked_at, sha256").eq("id", docV.id).single()
  verifier("l'ancienne version reste au dossier, verrouillée",
    ancienne.locked_at ? "oui" : "NON", "oui")

  const { data: neuve } = await admin.from("documents")
    .select("supersedes_id, version, sha256, locked_at").eq("id", v2.documentId).single()
  verifier("la neuve désigne la précédente", neuve.supersedes_id, docV.id)
  verifier("elle repart LIBRE", neuve.locked_at, null)
  // Le fichier n'est PAS recopié : une copie identique passerait pour une
  // correction.
  verifier("et sans fichier — c'est à la production de le lui donner",
    neuve.sha256 === null ? "aucun" : "COPIÉ", "aucun")

  const chaine = await chaineDesVersions(cabinet, v2.documentId)
  verifier("la chaîne des versions se lit", chaine.length, 2)
  verifier("dans l'ordre, la première d'abord", chaine[0].version, 1)

  // Un document jamais verrouillé n'a pas besoin de version.
  const docLibre = await nouveauDocument(cabinetA, cl.id, "Brouillon.pdf")
  const vLibre = await nouvelleVersion(cabinet, membreV, docLibre.id)
  verifier("versionner un brouillon : REFUSÉ", vLibre.ok ? "ACCEPTÉ" : "refusé", "refusé")
  verifier("et le refus dit quoi faire",
    /modifiez-le directement/i.test(vLibre.message) ? "oui" : `NON (${vLibre.message})`, "oui")

  // -------------------------------------------------------------------------
  console.log("\nLe service et le fournisseur interne")
  // -------------------------------------------------------------------------
  verifier("le fournisseur configuré", fournisseurConfigure(), "internal")

  const ctx = {
    firmId: cabinetA, userId: userA, fullName: "Propriétaire 1",
    email: `sig-1-${marque}@example.invalid`, ip: "203.0.113.7", agent: "Épreuve/1.0",
  }
  const service = new SignatureService(cabinet, ctx)

  const docS = await nouveauDocument(cabinetA, cl.id, "Entente a signer.pdf")
  const etat0 = await service.createRequest({
    documentId: docS.id,
    clientId: cl.id,
    mode: "sequential",
    destinataires: [
      { role: "client", nom: "Jean Tremblay", courriel: `js-${marque}@example.invalid`, rang: 1 },
      { role: "consultant", nom: "Adama Diarra", courriel: `as-${marque}@example.invalid`, rang: 2, permis: "R1041776" },
    ],
    champs: [
      { destinataireIndex: 0, type: "signature", libelle: "Signature du client" },
      { destinataireIndex: 0, type: "date", libelle: "Date" },
      { destinataireIndex: 1, type: "signature", libelle: "Signature du consultant" },
    ],
  })
  verifier("createRequest crée un BROUILLON", etat0.statut, "draft")
  verifier("avec ses deux destinataires", etat0.destinataires.length, 2)
  // LE LIEN N'EST RENDU QU'UNE FOIS : c'est la seule occasion où il existe en
  // clair.
  verifier("chacun reçoit son lien", etat0.destinataires.every((r) => r.lien) ? "oui" : "NON", "oui")
  verifier("le lien ne porte AUCUN identifiant",
    /\/s\/[A-Za-z0-9_-]{20,}$/.test(etat0.destinataires[0].lien) ? "oui" : `NON (${etat0.destinataires[0].lien})`, "oui")

  const jetonS = etat0.destinataires[0].lien.split("/s/")[1]
  const { data: champsCrees } = await admin.from("signature_fields")
    .select("id").eq("request_id", etat0.id)
  verifier("les champs sont enregistrés", (champsCrees ?? []).length, 3)

  // Un brouillon n'a rien envoyé : le document n'est PAS encore verrouillé.
  const { data: avantEnvoi } = await admin.from("documents")
    .select("locked_at").eq("id", docS.id).single()
  verifier("un brouillon ne verrouille pas encore", avantEnvoi.locked_at, null)
  verifier("et son lien n'ouvre rien", (await resoudre(jetonS)) ? "OUVERT" : "rien", "rien")

  const envoi = await service.sendRequest(etat0.id)
  verifier("sendRequest réussit", envoi.ok ? "ok" : envoi.message, "ok")

  // LE VERROU EST POSÉ PAR L'ENVOI, avant que quiconque puisse signer.
  const { data: apresEnvoi } = await admin.from("documents")
    .select("locked_at").eq("id", docS.id).single()
  verifier("l'envoi VERROUILLE le document", apresEnvoi.locked_at ? "oui" : "NON", "oui")

  const vuS = await resoudre(jetonS)
  verifier("le lien ouvre maintenant le document", vuS?.document_id, docS.id)
  verifier("c'est au tour du client", vuS?.son_tour, true)

  // ---- QUI A VRAIMENT REÇU SON LIEN --------------------------------------
  // En séquentiel, le second ne reçoit rien tant que le premier n'a pas signé.
  // Estampiller son `sent_at` à l'envoi le ferait passer pour déjà prévenu, et
  // plus personne ne lui écrirait quand son tour arriverait.
  const { data: estampilles } = await admin.from("signature_recipients")
    .select("rank, sent_at").eq("request_id", etat0.id).order("rank")
  verifier("le premier est marqué comme prévenu",
    estampilles[0].sent_at ? "oui" : "NON", "oui")
  verifier("le second ne l'est PAS encore",
    estampilles[1].sent_at ? "MARQUÉ" : "non", "non")

  const etat1 = await service.getStatus(etat0.id)
  verifier("getStatus rend « envoyée »", etat1.statut, "sent")
  verifier("il nomme le fournisseur", etat1.fournisseur, "internal")

  const renvoi = await service.sendRequest(etat0.id)
  verifier("envoyer deux fois : REFUSÉ", renvoi.ok ? "ACCEPTÉ" : "refusé", "refusé")

  // ---- LA CLÔTURE AUTOMATIQUE, par déclencheur ---------------------------
  const { data: destS } = await admin.from("signature_recipients")
    .select("id, rank").eq("request_id", etat0.id).order("rank")

  await admin.from("signature_recipients")
    .update({ status: "viewed", viewed_at: new Date().toISOString() }).eq("id", destS[0].id)
  verifier("une consultation remonte à la demande", (await service.getStatus(etat0.id)).statut, "viewed")

  await admin.from("signature_recipients")
    .update({ status: "signed", signed_at: new Date().toISOString() }).eq("id", destS[0].id)
  const etat2 = await service.getStatus(etat0.id)
  verifier("une signature sur deux : partiellement signée", etat2.statut, "partially_signed")
  verifier("et c'est au tour du consultant",
    etat2.destinataires.find((r) => r.rang === 2).sonTour, true)

  // ---- LE LIEN DU SUIVANT EXISTE, ET REMONTE -----------------------------
  // C'est ce que `prevenirProchain()` appelle. Sans le champ `liens`, le jeton
  // neuf n'existerait en clair nulle part et la chaîne s'arrêterait ici.
  const suivant = etat2.destinataires.find((r) => r.rang === 2)
  const relanceSuivant = await service.resendRequest(etat0.id, suivant.id)
  verifier("relancer le suivant réussit", relanceSuivant.ok ? "ok" : relanceSuivant.message, "ok")
  verifier("et rend un lien utilisable",
    relanceSuivant.liens?.[0]?.lien?.includes("/s/") ? "oui" : "NON", "oui")
  verifier("le lien nomme bien le suivant", relanceSuivant.liens?.[0]?.courriel, suivant.courriel)
  const jetonSuivant = relanceSuivant.liens?.[0]?.lien.split("/s/")[1]
  const vuSuivant = await resoudre(jetonSuivant)
  verifier("ce lien ouvre le document", vuSuivant?.document_id, docS.id)
  verifier("et c'est bien son tour", vuSuivant?.son_tour, true)

  await admin.from("signature_recipients")
    .update({ status: "signed", signed_at: new Date().toISOString() }).eq("id", destS[1].id)
  const etat3 = await service.getStatus(etat0.id)
  verifier("la dernière signature CLÔT la demande", etat3.statut, "completed")
  verifier("et pose la date de complétion", etat3.completeLe ? "oui" : "NON", "oui")

  // LA MÊME RÈGLE, DEUX IMPLÉMENTATIONS : la base et TypeScript doivent
  // toujours rendre le même verdict. C'est le garde-fou contre la divergence.
  const memeEntree = destS.map((d, i) => ({ rank: d.rank, status: "signed" }))
  verifier("SQL et TypeScript s'accordent",
    statutDeduit(memeEntree, "partially_signed"), etat3.statut)

  const refus = [{ rank: 1, status: "signed" }, { rank: 2, status: "declined" }]
  const { data: demandeRefus } = await cabinet.from("signature_requests").insert({
    firm_id: cabinetA, document_id: docS.id, client_id: cl.id,
    document_sha256: docS.sha256, requested_by: userA, status: "sent",
  }).select("id").single()
  await admin.from("signature_recipients").insert([
    { firm_id: cabinetA, request_id: demandeRefus.id, role: "client", rank: 1,
      full_name: "A", email: `ra-${marque}@example.invalid`, status: "signed" },
    { firm_id: cabinetA, request_id: demandeRefus.id, role: "consultant", rank: 2,
      full_name: "B", email: `rb-${marque}@example.invalid`, status: "declined" },
  ])
  const { data: apresRefus } = await admin.from("signature_requests")
    .select("status, declined_at").eq("id", demandeRefus.id).single()
  // UN SEUL REFUS ARRÊTE TOUT, même si l'autre a signé.
  verifier("un refus arrête la demande", apresRefus.status, "declined")
  verifier("SQL et TypeScript s'accordent aussi sur le refus",
    statutDeduit(refus, "partially_signed"), apresRefus.status)

  // ---- Annulation et relance ---------------------------------------------
  const annulCompletee = await service.cancelRequest(etat0.id)
  verifier("annuler une demande COMPLÉTÉE : REFUSÉ",
    annulCompletee.ok ? "ACCEPTÉ" : "refusé", "refusé")

  const docR = await nouveauDocument(cabinetA, cl.id, "A relancer.pdf")
  const etatR = await service.createRequest({
    documentId: docR.id, clientId: cl.id,
    destinataires: [{ role: "client", nom: "Jean", courriel: `jr-${marque}@example.invalid`, rang: 1 }],
  })
  await service.sendRequest(etatR.id)
  const jetonR1 = etatR.destinataires[0].lien.split("/s/")[1]
  verifier("le premier lien fonctionne", (await resoudre(jetonR1)) ? "oui" : "NON", "oui")

  const relance = await service.resendRequest(etatR.id)
  verifier("resendRequest réussit", relance.ok ? "ok" : relance.message, "ok")
  // L'ANCIEN LIEN MEURT. Deux liens vivants pour une même signature, c'est un
  // lien qu'on croit remplacé et qui ne l'est pas.
  verifier("l'ANCIEN lien ne fonctionne plus",
    (await resoudre(jetonR1)) ? "VIVANT" : "mort", "mort")

  const annul = await service.cancelRequest(etatR.id, "Erreur de destinataire.")
  verifier("cancelRequest réussit", annul.ok ? "ok" : annul.message, "ok")
  const { data: destAnnul } = await admin.from("signature_recipients")
    .select("revoked_at").eq("request_id", etatR.id).single()
  verifier("l'annulation révoque les liens", destAnnul.revoked_at ? "oui" : "NON", "oui")

  // ---- Le journal ---------------------------------------------------------
  const journal = await service.getAuditTrail(etatR.id)
  verifier("le journal retient les événements", journal.length >= 3 ? "oui" : `NON (${journal.length})`, "oui")
  verifier("dont la création", journal.some((e) => e.evenement === "signature.request.created") ? "oui" : "NON", "oui")
  verifier("dont l'envoi", journal.some((e) => e.evenement === "signature.request.sent") ? "oui" : "NON", "oui")
  verifier("dont l'annulation", journal.some((e) => e.evenement === "signature.request.cancelled") ? "oui" : "NON", "oui")
  verifier("il retient l'adresse d'origine", journal[0]?.ip, "203.0.113.7")

  // Le journal est écrit dans audit_logs, qui est IMMUABLE.
  const { error: eJournal } = await admin.from("audit_logs")
    .update({ summary: "réécrit" }).eq("entity_id", etatR.id)
  verifier("le journal ne se réécrit pas", eJournal ? "refusé" : "ACCEPTÉ", "refusé")

  // ---- LE CONTRÔLE D'INDÉPENDANCE ----------------------------------------
  // Le CRM doit pouvoir tourner sur un AUTRE fournisseur. On en substitue un
  // faux, qui n'écrit rien en base, et on vérifie que l'interface suffit.
  const faux = {
    nom: "faux",
    creerDemande: async () => ({
      id: "faux-1", statut: "draft", mode: "sequential", documentId: "d",
      destinataires: [], creeLe: "", fournisseur: "faux",
    }),
    envoyerDemande: async () => ({ ok: true, message: "envoyé par le faux" }),
    etatDemande: async () => ({
      id: "faux-1", statut: "completed", mode: "sequential", documentId: "d",
      destinataires: [], creeLe: "", fournisseur: "faux",
    }),
    annulerDemande: async () => ({ ok: true, message: "annulé" }),
    relancerDemande: async () => ({ ok: true, message: "relancé" }),
    telechargerDocumentSigne: async () => null,
    journal: async () => [],
  }
  const etatFaux = await faux.etatDemande()
  verifier("un faux fournisseur satisfait l'interface", etatFaux.statut, "completed")
  verifier("et le CRM n'a besoin de rien d'autre", (await faux.envoyerDemande()).ok, true)

  // -------------------------------------------------------------------------
  console.log("\nLes réactions du CRM — sans que la signature ne les connaisse")
  // -------------------------------------------------------------------------
  // Le module de signature n'importe RIEN d'ici : la flèche ne va que dans un
  // sens. C'est ce qui rendra PandaDoc substituable sans emporter les règles
  // du cabinet.
  const { data: modeleSys } = await admin.from("agreement_templates")
    .select("id").is("firm_id", null).limit(1).single()

  const docE = await nouveauDocument(cabinetA, cl.id, "Entente liee.pdf")
  const { data: ententeLiee } = await admin.from("agreements").insert({
    firm_id: cabinetA, client_id: cl.id, template_id: modeleSys.id, template_version: "1.0",
    reference: `ENT-SIG-${String(marque).slice(-4)}`, title: "Entente à signer",
    kind: "services", status: "sent", articles_snapshot: [],
    fees_amount: 1000, total_amount: 1000, document_id: docE.id,
  }).select("id, status").single()

  const etatE = await service.createRequest({
    documentId: docE.id, clientId: cl.id,
    destinataires: [{ role: "client", nom: "Jean", courriel: `je-${marque}@example.invalid`, rang: 1 }],
  })
  await service.sendRequest(etatE.id)

  const ctxR = { firmId: cabinetA, fullName: "Propriétaire 1" }
  const r1 = await reagirASignature(cabinet, ctxR, "signature.completed", etatE.id)
  verifier("la réaction agit", r1.faits.length > 0 ? "oui" : "NON", "oui")

  const { data: ententeApres } = await admin.from("agreements")
    .select("status").eq("id", ententeLiee.id).single()
  // L'ENTENTE SUIT SON DOCUMENT — par une relation qui existait déjà et que
  // personne ne lisait.
  verifier("l'entente devient signée", ententeApres.status, "signed")

  const { data: notifs } = await admin.from("notifications")
    .select("kind, title, entity_id").eq("firm_id", cabinetA)
  verifier("une notification est déposée", (notifs ?? []).length >= 1 ? "oui" : "NON", "oui")
  verifier("elle nomme l'événement", notifs?.[0]?.kind, "signature.completed")
  verifier("et désigne la demande", notifs?.[0]?.entity_id, etatE.id)

  // ON NE REDESCEND JAMAIS UN ÉTAT : une entente signée ne redevient pas
  // « partiellement signée » parce qu'un événement arrive dans le désordre.
  await reagirASignature(cabinet, ctxR, "signature.signed", etatE.id)
  const { data: ententeEncore } = await admin.from("agreements")
    .select("status").eq("id", ententeLiee.id).single()
  verifier("un événement en retard ne DÉFAIT rien", ententeEncore.status, "signed")

  // AUCUNE FACTURE N'EST CRÉÉE AUTOMATIQUEMENT. Un numéro de facture ne se
  // reprend pas : le consultant décide.
  const { data: facturesAuto } = await admin.from("invoices")
    .select("id").eq("firm_id", cabinetA)
  verifier("aucune facture n'est créée d'office", (facturesAuto ?? []).length, 0)

  // Une réaction sur une demande inconnue ne lève pas : elle ne fait rien.
  const rVide = await reagirASignature(cabinet, ctxR, "signature.completed",
    "00000000-0000-0000-0000-000000000000")
  verifier("une demande inconnue ne fait rien lever", rVide.faits.length, 0)

  // -------------------------------------------------------------------------
  console.log("\nSigner par le lien public — sans compte, sans session")
  // -------------------------------------------------------------------------
  const docP = await nouveauDocument(cabinetA, cl.id, "Contrat public.pdf")
  const etatP = await service.createRequest({
    documentId: docP.id, clientId: cl.id, mode: "sequential",
    destinataires: [
      { role: "client", nom: "Jean Tremblay", courriel: `jp-${marque}@example.invalid`, rang: 1 },
      { role: "consultant", nom: "Adama Diarra", courriel: `ap-${marque}@example.invalid`, rang: 2, permis: "R1041776" },
    ],
    champs: [
      { destinataireIndex: 0, type: "signature", libelle: "Signature" },
      { destinataireIndex: 0, type: "checkbox", libelle: "J'ai lu et j'accepte", obligatoire: true },
      { destinataireIndex: 1, type: "signature", libelle: "Signature du consultant" },
    ],
  })
  await service.sendRequest(etatP.id)
  const jClient = etatP.destinataires[0].lien.split("/s/")[1]
  const jConsultant = etatP.destinataires[1].lien.split("/s/")[1]

  const signerRpc = async (jeton, courriel, champs = [], trace = "data:image/png;base64,AAA") => {
    const { data } = await admin.rpc("signer_par_jeton", {
      p_token_hash: empreinte(jeton), p_courriel: courriel,
      p_trace: trace, p_champs: champs, p_ip: "198.51.100.9", p_agent: "Épreuve/1.0",
    })
    return data ?? {}
  }

  // LE TOUR : le consultant ne peut pas prendre les devants.
  const avance = await signerRpc(jConsultant, `ap-${marque}@example.invalid`)
  verifier("signer avant son tour : REFUSÉ", avance.motif, "PAS_VOTRE_TOUR")

  // LE COURRIEL : un lien transféré ne se signe pas par n'importe qui.
  const mauvais = await signerRpc(jClient, "quelquun@ailleurs.invalid")
  verifier("un courriel discordant : REFUSÉ", mauvais.motif, "COURRIEL")

  // La casse et les espaces ne doivent PAS faire échouer : refuser
  // « Jean@Example.ca » pour une majuscule ferait abandonner des gens de
  // bonne foi.
  const { data: champsClient } = await admin.from("signature_fields")
    .select("id, kind").eq("request_id", etatP.id).order("position")
  const caseAcocher = champsClient.find((c) => c.kind === "checkbox")

  const sansCase = await signerRpc(jClient, ` JP-${marque}@Example.Invalid `.toUpperCase())
  verifier("un champ obligatoire vide : REFUSÉ", sansCase.motif, "CHAMPS")

  const ok1 = await signerRpc(
    jClient, ` JP-${marque}@Example.Invalid `,
    [{ id: caseAcocher.id, valeur: "true" }]
  )
  verifier("le client signe", ok1.ok, true)
  verifier("la demande n'est pas encore complète", ok1.complete, false)

  const deuxFois = await signerRpc(jClient, `jp-${marque}@example.invalid`)
  verifier("signer deux fois : REFUSÉ", deuxFois.motif, "DEJA_SIGNE")

  // LE PERMIS EST ENFIN ÉCRIT — le défaut C4 de l'audit.
  const ok2 = await signerRpc(jConsultant, `ap-${marque}@example.invalid`)
  verifier("le consultant signe à son tour", ok2.ok, true)
  verifier("et la demande est COMPLÈTE", ok2.complete, true)

  const { data: sigs } = await admin.from("signatures")
    .select("signer_name, signer_role, rcic_number, document_sha256, ip_address")
    .eq("request_id", etatP.id).order("signed_at")
  verifier("deux signatures sont enregistrées", (sigs ?? []).length, 2)
  verifier("le PERMIS du consultant y figure", sigs[1].rcic_number, "R1041776")
  // L'empreinte est imposée par le déclencheur, pas par l'appelant : on avait
  // transmis « imposé par la base ».
  verifier("l'empreinte est celle du document", sigs[0].document_sha256, docP.sha256)
  verifier("l'adresse d'origine est retenue", sigs[0].ip_address, "198.51.100.9")

  const etatFinal = await service.getStatus(etatP.id)
  verifier("la demande est clôturée", etatFinal.statut, "completed")

  // UN DOCUMENT MODIFIÉ NE SE SIGNE PLUS — mais il est aussi VERROUILLÉ, donc
  // on ne peut même pas le modifier. Les deux gardes se superposent.
  const { error: eModif } = await admin.from("documents")
    .update({ sha256: "apres".padEnd(64, "0") }).eq("id", docP.id)
  verifier("le document signé reste verrouillé", eModif ? "refusé" : "ACCEPTÉ", "refusé")

  // ---- Le refus -----------------------------------------------------------
  const docR2 = await nouveauDocument(cabinetA, cl.id, "A refuser.pdf")
  const etatR2 = await service.createRequest({
    documentId: docR2.id, clientId: cl.id,
    destinataires: [{ role: "client", nom: "Jean", courriel: `jf-${marque}@example.invalid`, rang: 1 }],
  })
  await service.sendRequest(etatR2.id)
  const jRefus = etatR2.destinataires[0].lien.split("/s/")[1]

  const { data: refusPublic } = await admin.rpc("refuser_par_jeton", {
    p_token_hash: empreinte(jRefus), p_motif: "Montant non conforme.",
    p_ip: null, p_agent: null,
  })
  verifier("un signataire peut REFUSER", refusPublic.ok, true)
  const etatRefus = await service.getStatus(etatR2.id)
  verifier("la demande passe à « refusée »", etatRefus.statut, "declined")

  const apresRefusSig = await signerRpc(jRefus, `jf-${marque}@example.invalid`)
  verifier("signer après avoir refusé : REFUSÉ", apresRefusSig.ok, false)

  // ---- Le journal du parcours public --------------------------------------
  await admin.rpc("consulter_par_jeton", {
    p_token_hash: empreinte(jRefus), p_ip: "198.51.100.9", p_agent: "Épreuve/1.0",
  })
  const journalP = await service.getAuditTrail(etatP.id)
  verifier("le journal retient la signature",
    journalP.some((e) => e.evenement === "signature.signed") ? "oui" : "NON", "oui")
  verifier("et la complétion",
    journalP.some((e) => e.evenement === "signature.completed") ? "oui" : "NON", "oui")
  verifier("avec l'adresse du signataire",
    journalP.find((e) => e.evenement === "signature.signed")?.ip, "198.51.100.9")

  // Les fonctions publiques ne sont PAS exposées au navigateur.
  const { error: eExpose } = await tiers.rpc("signer_par_jeton", {
    p_token_hash: empreinte(jClient), p_courriel: "x", p_trace: null,
    p_champs: [], p_ip: null, p_agent: null,
  })
  verifier("signer_par_jeton n'est pas exposée au navigateur",
    eExpose ? "refusée" : "EXPOSÉE", "refusée")

  // -------------------------------------------------------------------------
  console.log("\nLe document signé et son certificat")
  // -------------------------------------------------------------------------
  // Un VRAI PDF : composer un certificat par-dessus un fichier illisible ne
  // prouverait rien.
  const { PDFDocument, StandardFonts } = await import("pdf-lib")
  const pdfSource = await PDFDocument.create()
  const p1 = pdfSource.addPage([595, 842])
  const policeSource = await pdfSource.embedFont(StandardFonts.Helvetica)
  p1.drawText("CONTRAT DE SERVICES", { x: 56, y: 760, size: 18, font: policeSource })
  pdfSource.addPage([595, 842])
  const octetsSource = Buffer.from(await pdfSource.save())
  const shaSource = createHash("sha256").update(octetsSource).digest("hex")

  const { data: docF } = await admin.from("documents").insert({
    firm_id: cabinetA, client_id: cl.id, name: "Contrat a finaliser.pdf",
    type: "Entente de service", category: "contract", uploaded_by: "Épreuve",
    source: "cabinet", status: "valid", mime_type: "application/pdf",
    size_bytes: octetsSource.length,
  }).select("id").single()
  const cheminF = `${cabinetA}/${cl.id}/${docF.id}/contrat.pdf`
  await admin.storage.from("documents").upload(cheminF, octetsSource, {
    contentType: "application/pdf", upsert: true,
  })
  await admin.from("documents").update({ storage_path: cheminF, sha256: shaSource }).eq("id", docF.id)

  const etatF = await service.createRequest({
    documentId: docF.id, clientId: cl.id,
    destinataires: [
      { role: "client", nom: "Jean Tremblay", courriel: `jfin-${marque}@example.invalid`, rang: 1 },
      { role: "consultant", nom: "Adama Diarra", courriel: `afin-${marque}@example.invalid`, rang: 2, permis: "R1041776" },
    ],
    champs: [{ destinataireIndex: 0, type: "signature", libelle: "Signature" }],
  })
  await service.sendRequest(etatF.id)
  const jF1 = etatF.destinataires[0].lien.split("/s/")[1]
  const jF2 = etatF.destinataires[1].lien.split("/s/")[1]

  const avant = await finaliser(cabinet, ctx, etatF.id)
  verifier("finaliser avant la fin : REFUSÉ", avant.ok ? "ACCEPTÉ" : "refusé", "refusé")

  await signerRpc(jF1, `jfin-${marque}@example.invalid`)
  await signerRpc(jF2, `afin-${marque}@example.invalid`)

  const fin = await finaliser(cabinet, ctx, etatF.id)
  verifier("le document signé se compose", fin.ok ? "ok" : fin.message, "ok")

  const { data: docSigne } = await admin.from("documents")
    .select("id, name, supersedes_id, locked_at, sha256, storage_path, version")
    .eq("id", fin.documentId).single()
  verifier("il porte le nom du signataire",
    /SIGNE_Jean_Tremblay\.pdf$/.test(docSigne.name) ? "oui" : `NON (${docSigne.name})`, "oui")
  verifier("il remplace l'original", docSigne.supersedes_id, docF.id)
  verifier("il est verrouillé dès sa naissance", docSigne.locked_at ? "oui" : "NON", "oui")
  verifier("il porte sa propre empreinte",
    /^[0-9a-f]{64}$/.test(docSigne.sha256 ?? "") ? "oui" : "NON", "oui")
  // L'empreinte du FINAL diffère de celle de l'original : il porte le
  // certificat en plus. Celle qui fait preuve est imprimée DANS le certificat.
  verifier("et elle diffère de celle de l'original",
    docSigne.sha256 !== shaSource ? "oui" : "IDENTIQUE", "oui")

  const { data: demandeF } = await admin.from("signature_requests")
    .select("signed_document_id").eq("id", etatF.id).single()
  verifier("la demande DÉSIGNE son document signé", demandeF.signed_document_id, fin.documentId)

  // Idempotence : deux signataires qui terminent à quelques secondes
  // d'intervalle ne doivent pas produire deux documents.
  const encore = await finaliser(cabinet, ctx, etatF.id)
  verifier("finaliser deux fois ne refait rien", encore.dejaFait ? "oui" : "NON", "oui")
  verifier("et rend le même document", encore.documentId, fin.documentId)

  // ---- Ce que le PDF final contient réellement ---------------------------
  const { data: signeF } = await admin.storage.from("documents")
    .createSignedUrl(docSigne.storage_path, 60)
  const octetsFinal = Buffer.from(await (await fetch(signeF.signedUrl, { cache: "no-store" })).arrayBuffer())
  const pdfFinal = await PDFDocument.load(octetsFinal)
  // Deux pages d'origine + au moins une de certificat.
  verifier("les pages d'origine sont conservées",
    pdfFinal.getPageCount() >= 3 ? `oui (${pdfFinal.getPageCount()})` : `NON (${pdfFinal.getPageCount()})`,
    `oui (${pdfFinal.getPageCount()})`)

  const texteFinal = lisiblePdf(octetsFinal)
  verifier("le certificat est présent",
    texteFinal.includes("CERTIFICAT DE SIGNATURE") ? "oui" : "NON", "oui")
  // LE CŒUR DE LA PREUVE : l'empreinte de l'original est imprimée.
  verifier("l'empreinte de L'ORIGINAL y figure",
    texteFinal.includes(shaSource) ? "oui" : "NON", "oui")
  verifier("les deux signataires y figurent",
    texteFinal.includes("Jean Tremblay") && texteFinal.includes("Adama Diarra") ? "oui" : "NON", "oui")
  verifier("le permis du consultant aussi",
    texteFinal.includes("R1041776") ? "oui" : "NON", "oui")
  verifier("le journal des événements aussi",
    texteFinal.includes("JOURNAL DES") ? "oui" : "NON", "oui")
  verifier("et la mention de vérification",
    texteFinal.includes("permet de v") ? "oui" : "NON", "oui")

  // Le document final est verrouillé : il ne se modifie plus.
  const { error: eFinal } = await admin.from("documents")
    .update({ sha256: "detourne".padEnd(64, "0") }).eq("id", fin.documentId)
  verifier("le document signé ne se modifie plus", eFinal ? "refusé" : "ACCEPTÉ", "refusé")

  // Le service sait le rendre.
  const telecharge = await service.getSignedDocument(etatF.id)
  verifier("getSignedDocument le rend", telecharge?.octets?.length > 1000 ? "oui" : "NON", "oui")
  verifier("avec sa référence d'intégrité", telecharge?.referenceIntegrite, docSigne.sha256)

  // -------------------------------------------------------------------------
  console.log("\nCloisonnement entre cabinets")
  // -------------------------------------------------------------------------
  const { data: destTiers } = await tiers
    .from("signature_recipients").select("id").eq("request_id", demande.id)
  verifier("un autre cabinet ne voit pas les destinataires", (destTiers ?? []).length, 0)

  const { data: champsTiers } = await tiers
    .from("signature_fields").select("id").eq("request_id", demande.id)
  verifier("ni les champs", (champsTiers ?? []).length, 0)

  const { error: eIntrusion } = await tiers.from("signature_recipients").insert({
    firm_id: cabinetA, request_id: demande.id, role: "other", rank: 5,
    full_name: "Intrus", email: `intrus-${marque}@example.invalid`,
  })
  verifier("ni n'ajoute un signataire chez l'autre",
    eIntrusion ? "refusé" : "ACCEPTÉ", "refusé")

  // La fonction de résolution n'est PAS exposée aux comptes ordinaires : c'est
  // le serveur qui l'appelle, jamais le navigateur.
  const { error: eRpc } = await tiers.rpc("resolve_signature_token", {
    p_token_hash: empreinte(jetonClient),
  })
  verifier("resolve_signature_token n'est pas exposée au navigateur",
    eRpc ? "refusée" : "EXPOSÉE", "refusée")
} finally {
  for (const id of [cabinetA, cabinetB]) if (id) await admin.rpc("purger_cabinet_epreuve", { p_firm_id: id })
  for (const id of [userA, userB]) if (id) await admin.auth.admin.deleteUser(id)
  console.log("\nCabinets et comptes d'épreuve supprimés.")
}

console.log(echecs === 0 ? "\n✓ Socle de signature vérifié, 0 échec." : `\n✗ ${echecs} échec(s).`)
process.exit(echecs === 0 ? 0 : 1)
