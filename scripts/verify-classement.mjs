#!/usr/bin/env node
/**
 * Éprouve le classement automatique des documents signés.
 *
 *   ./cric classement
 *
 * ─── LE DÉFAUT QUE CE SCRIPT SURVEILLE ─────────────────────────────────────
 *
 * `finalisation.ts` écrivait `category: "contract"` en dur : un IMM 5476 signé
 * devenait un « contrat », une lettre explicative signée aussi. Ce n'était pas
 * cosmétique — chaque section du dossier est une vue filtrée par catégorie, et
 * « contrat » n'était affiché nulle part. Le document sortait donc du dossier
 * au moment même où il devenait la pièce qui compte.
 *
 * ─── LE CONTRÔLE LE PLUS IMPORTANT EST NÉGATIF ─────────────────────────────
 *
 * Reclasser un document signé ne doit RIEN toucher d'autre que sa section :
 * ni le fichier, ni son empreinte, ni son verrou, ni sa place dans l'historique
 * des signatures. C'est ce qui rend le geste sûr sur une pièce qui porte des
 * signatures — et c'est le contrôle qui tomberait si le déplacement avait été
 * écrit comme un vrai déplacement.
 *
 * Tout est supprimé à la fin, même en cas d'échec.
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

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } })

const marque = Date.now()
const mdp = "Epreuve-" + randomBytes(9).toString("base64url")
let cab, uid, cabTiers, echecs = 0

const v = (intitule, obtenu, attendu) => {
  const ok = String(obtenu) === String(attendu)
  if (!ok) echecs++
  console.log(`  ${ok ? "✓" : "✗"} ${intitule.padEnd(54)} ${String(obtenu).slice(0, 24)}` +
    (ok ? "" : `   ATTENDU ${attendu}`))
}

try {
  // ── Le décor ────────────────────────────────────────────────────────────
  const courriel = `clas-${marque}@example.invalid`
  const { data: f } = await admin.from("firms").insert({
    name: "DGV Immigration", rcic_license_number: `R66${String(marque).slice(-5)}`,
    owner_name: "Adama Diarra", email: courriel, plan: "cabinet", status: "active",
  }).select("id").single()
  cab = f.id

  await admin.from("firm_subscriptions").insert({
    firm_id: cab, plan: "cabinet", cadence: "monthly", seats: 3,
    status: "active", stripe_customer_id: `cus_cl_${marque}`,
  })
  const { data: u } = await admin.auth.admin.createUser({
    email: courriel, password: mdp, email_confirm: true,
  })
  uid = u.user.id
  await admin.from("profiles").insert({
    firm_id: cab, user_id: uid, email: courriel,
    full_name: "Adama Diarra", cicc_role: "owner", status: "active",
  })

  const { data: cl } = await admin.from("clients").insert({
    firm_id: cab, name: "Jean Tremblay", first_name: "Jean", last_name: "Tremblay",
    email: `jt-${marque}@example.invalid`, file_number: `DOS-CL-${String(marque).slice(-6)}`,
    program: "Permis de travail", status: "active", client_type: "individual",
  }).select("id").single()

  const { data: dossier, error: eDossier } = await admin.from("matters").insert({
    firm_id: cab, client_id: cl.id, reference: `#DOS-CL${String(marque).slice(-5)}`,
    client_name: "Jean Tremblay", client_type: "b2c", program: "Permis de travail",
    category: "work", opened_date: new Date().toISOString().slice(0, 10),
    deadline: new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10),
    rcic: "Adama Diarra", status: "valid", urgency_days: 0, notes: "", is_priority: false,
  }).select("id, reference").single()
  if (eDossier || !dossier) throw new Error(`décor impossible : ${eDossier?.message}`)

  const nouveauDoc = async (nom, categorie, type) => {
    const { data } = await admin.from("documents").insert({
      firm_id: cab, client_id: cl.id, matter_id: dossier.id, name: nom, type,
      category: categorie, uploaded_by: "Épreuve", source: "cabinet", status: "valid",
      storage_path: `${cab}/${cl.id}/faux/${nom}`, sha256: "b".repeat(64),
      mime_type: "application/pdf", size_bytes: 1234,
    }).select("id").single()
    return data.id
  }

  /** Une demande signée jusqu'au bout, avec son document signé. */
  const signerJusquAuBout = async (docId, categorieSignee) => {
    const { data: d } = await admin.from("signature_requests").insert({
      firm_id: cab, document_id: docId, client_id: cl.id,
      document_sha256: "b".repeat(64), status: "sent", signing_mode: "sequential",
      provider: "internal",
      expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    }).select("id").single()

    await admin.from("signature_recipients").insert([
      { firm_id: cab, request_id: d.id, role: "client", rank: 1,
        full_name: "Jean Tremblay", email: `jt-${marque}@example.invalid`,
        status: "signed", signed_at: new Date().toISOString() },
      { firm_id: cab, request_id: d.id, role: "consultant", rank: 2,
        full_name: "Adama Diarra", email: courriel,
        status: "signed", signed_at: new Date().toISOString() },
    ])

    // Le document signé, tel que `finaliser()` le crée désormais : la
    // catégorie est celle qu'on lui passe, pour pouvoir éprouver les deux cas.
    const { data: signe } = await admin.from("documents").insert({
      firm_id: cab, client_id: cl.id, matter_id: dossier.id,
      name: "Document_SIGNE.pdf", type: "Document signé",
      category: categorieSignee, uploaded_by: "Système", source: "cabinet",
      status: "valid", version: 2, supersedes_id: docId,
      storage_path: `${cab}/${cl.id}/faux/signe-${randomBytes(4).toString("hex")}.pdf`,
      sha256: "c".repeat(64), mime_type: "application/pdf", size_bytes: 4321,
    }).select("id").single()

    await admin.from("signature_requests")
      .update({ status: "completed", signed_document_id: signe.id, completed_at: new Date().toISOString() })
      .eq("id", d.id)
    await admin.rpc("verrouiller_document", { p_document_id: signe.id })
    return { demandeId: d.id, signeId: signe.id }
  }

  const categorieDe = async (id) => {
    const { data } = await admin.from("documents").select("category").eq("id", id).single()
    return data?.category
  }

  // ── 1. LA REPRISE : la migration reclasse ce qui l'était mal ────────────
  // Un document signé né AVANT le correctif porte « contract » alors que son
  // original est un formulaire. C'est le cas que la migration doit rattraper.
  console.log("\nLa migration rattrape ce qui était mal rangé")
  const formOrigine = await nouveauDoc("IMM5476.pdf", "ircc_form", "Formulaire")
  const malRange = await signerJusquAuBout(formOrigine, "contract")
  v("avant : le formulaire signé est un « contrat »", await categorieDe(malRange.signeId), "contract")

  // La règle de `20260816090000`, rejouée à l'identique sur le décor : le
  // document signé reprend la catégorie de l'original que `supersedes_id`
  // désigne, et seules les lignes visées par un `signed_document_id` sont
  // touchées. La migration réelle a déjà été appliquée à la base ; ce qu'on
  // éprouve ici, c'est que sa RÈGLE produit le bon résultat.
  const { data: aReclasser } = await admin
    .from("signature_requests").select("signed_document_id, document_id")
    .eq("firm_id", cab).not("signed_document_id", "is", null)
  for (const r of aReclasser ?? []) {
    const origine = await categorieDe(r.document_id)
    const signee = await categorieDe(r.signed_document_id)
    if (origine && signee !== origine) {
      await admin.from("documents").update({ category: origine }).eq("id", r.signed_document_id)
    }
  }
  v("après : il a retrouvé « ircc_form »", await categorieDe(malRange.signeId), "ircc_form")

  // Un signé dont l'original ÉTAIT bien un contrat ne doit pas bouger.
  const contratOrigine = await nouveauDoc("Entente.pdf", "contract", "Entente de service")
  const bienRange = await signerJusquAuBout(contratOrigine, "contract")
  v("un contrat signé reste un contrat", await categorieDe(bienRange.signeId), "contract")

  // ── 2. L'AFFICHAGE : chaque section retrouve sa pièce ───────────────────
  console.log("\nChaque section du dossier retrouve sa pièce")
  const autreOrigine = await nouveauDoc("Lettre explicative.pdf", "other", "Autre document")
  const autreSigne = await signerJusquAuBout(autreOrigine, "other")

  const { data: tous } = await admin
    .from("documents").select("id, category").eq("matter_id", dossier.id).is("archived_at", null)
  const parCat = (c) => (tous ?? []).filter((d) => d.category === c).length
  v("Formulaires : l'original et sa version signée", parCat("ircc_form"), 2)
  v("Autres documents : idem", parCat("other"), 2)
  v("Ententes : idem", parCat("contract"), 2)

  // ── 3. LE CONTRÔLE NÉGATIF QUI COMPTE ──────────────────────────────────
  console.log("\nReclasser ne touche RIEN d'autre que la section")
  const { data: avant } = await admin.from("documents")
    .select("storage_path, sha256, locked_at, size_bytes")
    .eq("id", autreSigne.signeId).single()

  await admin.from("documents").update({ category: "consultant_upload" }).eq("id", autreSigne.signeId)

  const { data: apres } = await admin.from("documents")
    .select("category, storage_path, sha256, locked_at, size_bytes")
    .eq("id", autreSigne.signeId).single()

  v("la section a changé", apres.category, "consultant_upload")
  v("le fichier n'a pas bougé", apres.storage_path === avant.storage_path, true)
  v("l'empreinte est intacte", apres.sha256 === avant.sha256, true)
  v("le verrou tient toujours", Boolean(apres.locked_at) && apres.locked_at === avant.locked_at, true)
  v("la taille est inchangée", apres.size_bytes === avant.size_bytes, true)

  const { data: dem } = await admin.from("signature_requests")
    .select("status, signed_document_id").eq("id", autreSigne.demandeId).single()
  v("la demande reste « completed »", dem.status, "completed")
  v("elle désigne toujours le même document", dem.signed_document_id, autreSigne.signeId)

  // ── 4. Le verrou refuse toujours ce qu'il doit refuser ─────────────────
  // Si ce contrôle tombait, le reclassement aurait ouvert une brèche dans le
  // gel du contenu — ce qu'il ne doit surtout pas faire.
  console.log("\nLe verrou n'a pas été affaibli au passage")
  const { error: eContenu } = await admin.from("documents")
    .update({ sha256: "d".repeat(64) }).eq("id", autreSigne.signeId)
  v("le contenu d'un document signé reste figé", eContenu ? "refusé" : "ACCEPTÉ", "refusé")
  const { error: eSuppr } = await admin.from("documents").delete().eq("id", autreSigne.signeId)
  v("il ne se supprime pas davantage", eSuppr ? "refusé" : "ACCEPTÉ", "refusé")

  // ── 5. LE CLOISONNEMENT ────────────────────────────────────────────────
  console.log("\nOn ne reclasse pas la pièce du voisin")
  const { data: f2 } = await admin.from("firms").insert({
    name: "Cabinet voisin", rcic_license_number: `R67${String(marque).slice(-5)}`,
    owner_name: "Voisin", email: `voisin-${marque}@example.invalid`,
    plan: "solo", status: "active",
  }).select("id").single()
  cabTiers = f2.id
  const { data: docTiers } = await admin.from("documents").insert({
    firm_id: f2.id, name: "Pièce du voisin.pdf", type: "Document",
    category: "other", uploaded_by: "Épreuve", source: "cabinet", status: "valid",
    storage_path: `${f2.id}/faux/voisin.pdf`, sha256: "f".repeat(64),
    mime_type: "application/pdf", size_bytes: 10,
  }).select("id").single()

  const cabinet = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } })
  await cabinet.auth.signInWithPassword({ email: courriel, password: mdp })

  const { data: vu } = await cabinet.from("documents").select("id").eq("id", docTiers.id).maybeSingle()
  v("le document du voisin est invisible", vu ? "VU" : "invisible", "invisible")

  await cabinet.from("documents").update({ category: "contract" }).eq("id", docTiers.id)
  const { data: inchange } = await admin.from("documents")
    .select("category").eq("id", docTiers.id).single()
  v("et son classement n'a pas bougé", inchange.category, "other")

  // ── 6. Une destination inventée est refusée ────────────────────────────
  console.log("\nLa base refuse une destination qui n'existe pas")
  const { error: eFaux } = await admin.from("documents")
    .update({ category: "fideicommis" }).eq("id", autreOrigine)
  v("« fideicommis » n'est pas une catégorie", eFaux ? "refusé" : "ACCEPTÉ", "refusé")

} finally {
  if (cabTiers) await admin.rpc("purger_cabinet_epreuve", { p_firm_id: cabTiers })
  if (cab) await admin.rpc("purger_cabinet_epreuve", { p_firm_id: cab })
  if (uid) await admin.auth.admin.deleteUser(uid)
  console.log("\nCabinets et compte d'épreuve supprimés.")
}

console.log(echecs === 0
  ? "\n✓ Le classement suit l'origine, 0 échec."
  : `\n✗ ${echecs} échec(s).`)
process.exit(echecs === 0 ? 0 : 1)
