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
import { createClient } from "@supabase/supabase-js"
import { exigerSupabase } from "./lib/environnement.mjs"
// Les règles pures sont importées TELLES QUELLES : les recopier ici
// éprouverait une copie, et le jour où l'originale changerait, l'épreuve
// continuerait de réussir sur autre chose.
import { statutDeduit, sonTour, nomDocumentSigne } from "../lib/signature/statuts.ts"

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
  const resoudre = async (jeton) => {
    const { data } = await admin.rpc("resolve_signature_token", { p_token_hash: empreinte(jeton) })
    return (data ?? [])[0] ?? null
  }

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
  for (const id of [cabinetA, cabinetB]) if (id) await admin.from("firms").delete().eq("id", id)
  for (const id of [userA, userB]) if (id) await admin.auth.admin.deleteUser(id)
  console.log("\nCabinets et comptes d'épreuve supprimés.")
}

console.log(echecs === 0 ? "\n✓ Socle de signature vérifié, 0 échec." : `\n✗ ${echecs} échec(s).`)
process.exit(echecs === 0 ? 0 : 1)
