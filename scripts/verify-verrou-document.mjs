#!/usr/bin/env node
/**
 * Éprouve le verrou de contenu d'un document, et sa levée.
 *
 *   ./cric verrou
 *
 * ─── CE QUE CE SCRIPT PROTÈGE, DANS LES DEUX SENS ──────────────────────────
 *
 * DANS UN SENS : qu'on ne puisse pas faire signer une version d'un contrat
 * puis lui en substituer une autre. Dès qu'UNE seule signature existe, le
 * verrou est définitif — annuler la demande n'y change rien, et un UPDATE
 * direct au rôle de service se heurte au déclencheur.
 *
 * DANS L'AUTRE : qu'un contrat envoyé par erreur, puis annulé avant que
 * quiconque ne l'ait signé, redevienne modifiable. Le déclencheur conseillait
 * « annulez la demande, puis créez une nouvelle version » alors qu'aucun
 * chemin ne retirait jamais le verrou : le conseil était impossible à suivre,
 * et la pièce restait figée pour toujours.
 *
 * Le contrôle le plus important de ce script est le NÉGATIF — celui qui
 * échouerait si la levée du verrou avait été écrite trop largement.
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
let cab, uid, echecs = 0

const v = (intitule, obtenu, attendu) => {
  const ok = String(obtenu) === String(attendu)
  if (!ok) echecs++
  console.log(`  ${ok ? "✓" : "✗"} ${intitule.padEnd(54)} ${String(obtenu).slice(0, 24)}` +
    (ok ? "" : `   ATTENDU ${attendu}`))
}

const verrouille = async (docId) => {
  const { data } = await admin.from("documents").select("locked_at").eq("id", docId).single()
  return data?.locked_at ? "verrouillé" : "libre"
}

try {
  const courriel = `verrou-${marque}@example.invalid`
  const { data: f } = await admin.from("firms").insert({
    name: "DGV Immigration", rcic_license_number: `R77${String(marque).slice(-5)}`,
    owner_name: "Adama Diarra", email: courriel, plan: "cabinet", status: "active",
  }).select("id").single()
  cab = f.id

  await admin.from("firm_subscriptions").insert({
    firm_id: cab, plan: "cabinet", cadence: "monthly", seats: 3,
    status: "active", stripe_customer_id: `cus_vr_${marque}`,
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
    email: `jt-${marque}@example.invalid`, file_number: `DOS-VR-${String(marque).slice(-6)}`,
    program: "Permis de travail", status: "active", client_type: "individual",
  }).select("id").single()

  const nouveauDoc = async (nom) => {
    const { data } = await admin.from("documents").insert({
      firm_id: cab, client_id: cl.id, name: nom, type: "Entente de service",
      category: "contract", uploaded_by: "Épreuve", source: "cabinet", status: "valid",
      storage_path: `${cab}/${cl.id}/faux/${nom}`, sha256: "b".repeat(64),
      mime_type: "application/pdf", size_bytes: 1234,
    }).select("id").single()
    return data.id
  }

  const nouvelleDemande = async (docId, statut, avecSignature) => {
    const { data: d } = await admin.from("signature_requests").insert({
      firm_id: cab, document_id: docId, client_id: cl.id,
      document_sha256: "b".repeat(64), status: "sent", signing_mode: "sequential",
      provider: "internal",
      expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    }).select("id").single()

    await admin.from("signature_recipients").insert({
      firm_id: cab, request_id: d.id, role: "client", rank: 1,
      full_name: "Jean Tremblay", email: `jt-${marque}@example.invalid`,
      status: avecSignature ? "signed" : "pending",
      signed_at: avecSignature ? new Date().toISOString() : null,
    })

    if (avecSignature) {
      await admin.from("signatures").insert({
        request_id: d.id, firm_id: cab, document_id: docId,
        signer_kind: "client", signer_name: "Jean Tremblay",
        signer_email: `jt-${marque}@example.invalid`, signer_role: "client",
        document_sha256: "imposé par la base", ip_address: "198.51.100.9",
      })
    }
    await admin.from("signature_requests").update({
      status: statut,
      cancelled_at: statut === "cancelled" ? new Date().toISOString() : null,
    }).eq("id", d.id)
    return d.id
  }

  // La session du cabinet : `deverrouiller_document()` lit `current_firm_id()`,
  // que la clé de service ne renseigne pas. Appelée avec elle, la fonction
  // refuserait TOUT et le script conclurait à une garantie qui n'existe pas.
  const cabinet = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } })
  await cabinet.auth.signInWithPassword({ email: courriel, password: mdp })

  const lever = async (docId) => {
    const { data, error } = await cabinet.rpc("deverrouiller_document", { p_document_id: docId })
    return error ? `ERREUR ${error.code}` : (data === true ? "levé" : "refusé")
  }

  // ── 1. Le verrou se pose ────────────────────────────────────────────────
  console.log("\nLe verrou se pose à l'envoi")
  const docA = await nouveauDoc("Contrat A.pdf")
  const { data: poseA } = await cabinet.rpc("verrouiller_document", { p_document_id: docA })
  v("verrouiller_document réussit", poseA, true)
  v("le document est verrouillé", await verrouille(docA), "verrouillé")

  const { error: eContenu } = await admin.from("documents")
    .update({ sha256: "c".repeat(64) }).eq("id", docA)
  v("son contenu ne se modifie plus", eContenu ? "refusé" : "ACCEPTÉ", "refusé")

  // ── 2. Un UPDATE direct ne retire pas le verrou ─────────────────────────
  // Même au rôle de service. C'est la règle du module : la garantie est en
  // base. Si ce contrôle tombe, le verrou n'est plus qu'une convention.
  console.log("\nLe verrou ne se retire pas à la main")
  const { error: eDirect } = await admin.from("documents")
    .update({ locked_at: null }).eq("id", docA)
  v("update locked_at = null est refusé, même au service", eDirect ? "refusé" : "ACCEPTÉ", "refusé")
  v("le document est toujours verrouillé", await verrouille(docA), "verrouillé")

  // ── 3. Une demande EN COURS tient le verrou ─────────────────────────────
  console.log("\nUne demande en cours tient le verrou")
  await nouvelleDemande(docA, "sent", false)
  v("la levée est refusée tant que la demande court", await lever(docA), "refusé")
  v("le document reste verrouillé", await verrouille(docA), "verrouillé")

  // ── 4. Annulée sans signature : le verrou tombe ─────────────────────────
  console.log("\nAnnulée sans signature : le verrou tombe")
  await admin.from("signature_requests")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("document_id", docA)
  v("la levée réussit", await lever(docA), "levé")
  v("le document est libre", await verrouille(docA), "libre")

  // Et c'est tout l'intérêt : la pièce redevient corrigeable.
  const { error: eApres } = await admin.from("documents")
    .update({ sha256: "d".repeat(64) }).eq("id", docA)
  v("son contenu se modifie de nouveau", eApres ? `REFUSÉ ${eApres.code}` : "accepté", "accepté")

  // ── 5. LE CONTRÔLE QUI COMPTE : une signature fige tout ─────────────────
  console.log("\nUne seule signature rend le verrou définitif")
  const docB = await nouveauDoc("Contrat B.pdf")
  await cabinet.rpc("verrouiller_document", { p_document_id: docB })
  await nouvelleDemande(docB, "cancelled", true)
  v("la levée est REFUSÉE malgré l'annulation", await lever(docB), "refusé")
  v("le document reste verrouillé", await verrouille(docB), "verrouillé")
  const { error: eB } = await admin.from("documents")
    .update({ sha256: "e".repeat(64) }).eq("id", docB)
  v("son contenu reste figé", eB ? "refusé" : "ACCEPTÉ", "refusé")

  // ── 6. Un document signé et abouti ──────────────────────────────────────
  console.log("\nUne demande aboutie ne rouvre rien")
  const docC = await nouveauDoc("Contrat C.pdf")
  await cabinet.rpc("verrouiller_document", { p_document_id: docC })
  await nouvelleDemande(docC, "completed", true)
  v("la levée est refusée", await lever(docC), "refusé")

  // ── 7. Le cloisonnement ─────────────────────────────────────────────────
  // `deverrouiller_document` est SECURITY DEFINER : sans le contrôle de
  // cabinet qu'elle porte, elle rouvrirait le contrat d'un tiers.
  console.log("\nOn ne lève pas le verrou du voisin")
  const { data: f2 } = await admin.from("firms").insert({
    name: "Cabinet voisin", rcic_license_number: `R78${String(marque).slice(-5)}`,
    owner_name: "Voisin", email: `voisin-${marque}@example.invalid`,
    plan: "solo", status: "active",
  }).select("id").single()
  const { data: docTiers } = await admin.from("documents").insert({
    firm_id: f2.id, name: "Contrat du voisin.pdf", type: "Entente de service",
    category: "contract", uploaded_by: "Épreuve", source: "cabinet", status: "valid",
    storage_path: `${f2.id}/faux/voisin.pdf`, sha256: "f".repeat(64),
    mime_type: "application/pdf", size_bytes: 10,
  }).select("id").single()
  await admin.from("documents").update({ locked_at: new Date().toISOString() }).eq("id", docTiers.id)
  v("la levée chez le voisin est refusée", await lever(docTiers.id), "refusé")
  v("son document reste verrouillé", await verrouille(docTiers.id), "verrouillé")
  await admin.rpc("purger_cabinet_epreuve", { p_firm_id: f2.id })

} finally {
  if (cab) await admin.rpc("purger_cabinet_epreuve", { p_firm_id: cab })
  if (uid) await admin.auth.admin.deleteUser(uid)
  console.log("\nCabinet et compte d'épreuve supprimés.")
}

console.log(echecs === 0 ? "\n✓ Le verrou tient dans les deux sens, 0 échec." : `\n✗ ${echecs} échec(s).`)
process.exit(echecs === 0 ? 0 : 1)
