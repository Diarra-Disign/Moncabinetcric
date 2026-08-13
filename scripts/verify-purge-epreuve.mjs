#!/usr/bin/env node
/**
 * Éprouve la SEULE brèche existante dans l'inaltérabilité du journal d'audit.
 *
 *   ./cric purge
 *
 * `purger_cabinet_epreuve()` peut effacer un cabinet et son journal. C'est la
 * seule chose dans tout le produit qui le peut. Un contrôle qui se contenterait
 * de vérifier qu'elle fonctionne serait donc à côté du sujet : ce qui compte
 * est ce qu'elle REFUSE.
 *
 * Les quatre bornes, éprouvées une par une :
 *
 *   1. un cabinet au courriel RÉEL est refusé — c'est la borne qui protège le
 *      cabinet du consultant, et elle repose sur une impossibilité
 *      d'enregistrement (RFC 2606), pas sur une convention de nommage ;
 *   2. le journal reste INMODIFIABLE — la brèche ne s'ouvre que sur DELETE, et
 *      un UPDATE doit rester refusé, sinon on aurait échangé une garantie
 *      d'inaltérabilité contre une commodité de ménage ;
 *   3. une suppression directe de `audit_logs` reste refusée hors de la
 *      fonction, même au rôle de service ;
 *   4. un cabinet d'épreuve, lui, disparaît vraiment — journal compris.
 *
 * Le décor est supprimé à la fin, même en cas d'échec.
 */
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const env = Object.fromEntries(
  [...readFileSync(join(ROOT, ".env.local"), "utf8").matchAll(/^([A-Z0-9_]+)=(.*)$/gm)]
    .map((m) => [m[1], m[2].trim()])
)
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } })

const marque = Date.now()
let epreuve, reel, echecs = 0

const v = (intitule, obtenu, attendu) => {
  const ok = String(obtenu) === String(attendu)
  if (!ok) echecs++
  console.log(`  ${ok ? "✓" : "✗"} ${intitule.padEnd(56)} ${String(obtenu).slice(0, 22)}` +
    (ok ? "" : `   ATTENDU ${attendu}`))
}

const nouveauCabinet = async (courriel, suffixe) => {
  const { data, error } = await admin.from("firms").insert({
    name: `Cabinet ${suffixe} ${marque}`,
    rcic_license_number: `R44${String(marque).slice(-5)}${suffixe === "reel" ? "1" : "2"}`,
    owner_name: "Épreuve", email: courriel, plan: "solo", status: "active",
  }).select("id").single()
  if (error) throw new Error(`décor impossible : ${error.message}`)
  return data.id
}

/** Une entrée de journal, posée par le chemin normal. */
const journaliser = async (firmId) => {
  const { error } = await admin.from("audit_logs").insert({
    firm_id: firmId, action: "test.purge", entity_type: "firm", entity_id: firmId,
    actor_name: "Épreuve", summary: `épreuve ${marque}`, changes: { marque },
  })
  if (error) throw new Error(`journal impossible : ${error.message}`)
  const { count } = await admin.from("audit_logs")
    .select("id", { count: "exact", head: true }).eq("firm_id", firmId)
  return count ?? 0
}

const existe = async (firmId) => {
  const { data } = await admin.from("firms").select("id").eq("id", firmId).maybeSingle()
  return data ? "oui" : "non"
}

try {
  // Deux cabinets identiques en tout point SAUF le courriel. C'est bien le
  // courriel, et rien d'autre, qui doit décider du sort de chacun.
  epreuve = await nouveauCabinet(`purge-${marque}@example.invalid`, "epreuve")
  reel = await nouveauCabinet(`purge-${marque}@dgvimmigration.com`, "reel")

  console.log("\nLe décor")
  v("le cabinet d'épreuve porte une entrée de journal", await journaliser(epreuve), 1)
  v("le cabinet « réel » aussi", await journaliser(reel), 1)

  // ── 1. LA BORNE QUI PROTÈGE UN VRAI CABINET ─────────────────────────────
  console.log("\nUn cabinet au courriel réel est REFUSÉ")
  const { data: rReel, error: eReel } = await admin
    .rpc("purger_cabinet_epreuve", { p_firm_id: reel })
  v("la purge le refuse", eReel ? `ERREUR ${eReel.code}` : rReel, false)
  v("il est toujours là", await existe(reel), "oui")

  // ── 2. LE JOURNAL RESTE INMODIFIABLE ────────────────────────────────────
  // Si ce contrôle tombait, on aurait troqué l'inaltérabilité contre une
  // commodité de ménage — exactement ce que la brèche ne doit pas coûter.
  console.log("\nLe journal ne se réécrit toujours pas")
  const { data: entree } = await admin.from("audit_logs")
    .select("id").eq("firm_id", reel).limit(1).single()
  const { error: eMaj } = await admin.from("audit_logs")
    .update({ action: "falsifie" }).eq("id", entree.id)
  v("un UPDATE sur une entrée est refusé", eMaj ? "refusé" : "ACCEPTÉ", "refusé")

  // ── 3. NI NE S'EFFACE À LA MAIN ─────────────────────────────────────────
  const { error: eSup } = await admin.from("audit_logs").delete().eq("id", entree.id)
  v("un DELETE direct est refusé, même au service", eSup ? "refusé" : "ACCEPTÉ", "refusé")

  // ── 4. LE CABINET D'ÉPREUVE, LUI, DISPARAÎT ─────────────────────────────
  console.log("\nUn cabinet d'épreuve disparaît, journal compris")
  const { data: rEp, error: eEp } = await admin
    .rpc("purger_cabinet_epreuve", { p_firm_id: epreuve })
  v("la purge l'accepte", eEp ? `ERREUR ${eEp.message.slice(0, 40)}` : rEp, true)
  v("le cabinet a disparu", await existe(epreuve), "non")
  const { count: reste } = await admin.from("audit_logs")
    .select("id", { count: "exact", head: true }).eq("firm_id", epreuve)
  v("son journal est parti avec lui", reste ?? 0, 0)
  if (rEp === true) epreuve = null

  // ── 5. LA BRÈCHE S'EST REFERMÉE ─────────────────────────────────────────
  // Le drapeau est posé `is_local` : il doit être retombé. Sans ce contrôle,
  // une purge laisserait la porte ouverte pour le reste de la connexion.
  console.log("\nLa brèche s'est refermée derrière elle")
  const { data: e2 } = await admin.from("audit_logs")
    .select("id").eq("firm_id", reel).limit(1).single()
  const { error: eApres } = await admin.from("audit_logs").delete().eq("id", e2.id)
  v("après une purge, le journal est de nouveau intouchable",
    eApres ? "refusé" : "ACCEPTÉ", "refusé")

} finally {
  // Le cabinet « réel » de l'épreuve ne peut PAS être purgé — c'est tout
  // l'objet du contrôle 1. On le rend donc jetable avant de le retirer.
  if (reel) {
    await admin.from("firms").update({ email: `purge-${marque}@example.invalid` }).eq("id", reel)
    await admin.rpc("purger_cabinet_epreuve", { p_firm_id: reel })
  }
  if (epreuve) await admin.rpc("purger_cabinet_epreuve", { p_firm_id: epreuve })
  console.log("\nCabinets d'épreuve supprimés.")
}

console.log(echecs === 0
  ? "\n✓ La brèche est étroite et le journal tient, 0 échec."
  : `\n✗ ${echecs} échec(s).`)
process.exit(echecs === 0 ? 0 : 1)
