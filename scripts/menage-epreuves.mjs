#!/usr/bin/env node
/**
 * Recense — et sur demande efface — le décor laissé par les scripts d'épreuve.
 *
 *   ./cric menage              recense, ne supprime rien
 *   ./cric menage --appliquer  efface
 *
 * MONTRER AVANT D'AGIR, ET NON L'INVERSE. Une commande qui supprime par défaut
 * finit toujours par être lancée une fois de trop, et sur une base qui porte
 * les dossiers réels d'un cabinet, cette fois-là coûte cher. Le recensement
 * est le comportement par défaut ; effacer demande un mot de plus.
 *
 * Le critère est dans `lib/menage.mjs` : le courriel du cabinet se termine par
 * un domaine que la RFC 2606 réserve. Il n'est pas là par commodité — c'est ce
 * qui rend impossible de désigner un vrai cabinet.
 */
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"
import { recenser, balayer } from "./lib/menage.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const env = Object.fromEntries(
  [...readFileSync(join(ROOT, ".env.local"), "utf8").matchAll(/^([A-Z0-9_]+)=(.*)$/gm)]
    .map((m) => [m[1], m[2].trim()])
)

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } })

const appliquer = process.argv.includes("--appliquer")

const { cabinets, comptes, gardes } = await recenser(admin)

console.log(`\nCABINETS D'ÉPREUVE : ${cabinets.length}`)
for (const f of cabinets.slice(0, 12)) {
  console.log(`   « ${f.name} »  <${f.email}>  ${f.rcic_license_number}  ${String(f.created_at).slice(0, 10)}`)
}
if (cabinets.length > 12) console.log(`   … et ${cabinets.length - 12} autre(s)`)

console.log(`\nCOMPTES D'ÉPREUVE : ${comptes.length}`)
console.log(`\nCONSERVÉS (courriel réel, donc cabinet réel) : ${gardes}`)

// Ce qui disparaîtra avec eux, énoncé avant plutôt qu'après : toutes les clés
// étrangères vers `firms` cascadent, et cela vaut aussi pour les demandes de
// signature dont l'accumulation a motivé cette commande.
if (cabinets.length) {
  const ids = cabinets.map((f) => f.id)
  const compter = async (table) => {
    const { count } = await admin.from(table).select("id", { count: "exact", head: true }).in("firm_id", ids)
    return count ?? 0
  }
  const [cl, dos, doc, sig] = await Promise.all(
    ["clients", "matters", "documents", "signature_requests"].map(compter)
  )
  console.log(`\nEMPORTÉS PAR LA CASCADE : ${cl} client(s), ${dos} dossier(s), ${doc} document(s), ${sig} demande(s) de signature`)
}

// ---------------------------------------------------------------------------
// Le mode diagnostic
// ---------------------------------------------------------------------------
// Il existe parce que le nettoyage de TOUS les scripts a échoué en silence
// pendant des jours : chacun appelle `.delete()` sans regarder l'erreur, et
// annonce « cabinet supprimé » quoi qu'il arrive. Une seule suppression est
// tentée ici, sur un cabinet d'épreuve, et son refus est rapporté mot pour
// mot — c'est le message que personne n'avait jamais lu.
if (process.argv.includes("--diagnostic")) {
  if (!cabinets.length) { console.log("\nAucun cabinet d'épreuve à interroger."); process.exit(0) }
  const cible = cabinets[0]
  console.log(`\nDIAGNOSTIC sur « ${cible.name} » <${cible.email}>`)
  const { error, count } = await admin
    .from("firms").delete({ count: "exact" }).eq("id", cible.id)
  console.log(`   erreur  : ${error ? `${error.code} — ${error.message}` : "aucune"}`)
  if (error?.details) console.log(`   détail  : ${error.details}`)
  if (error?.hint) console.log(`   piste   : ${error.hint}`)
  console.log(`   lignes  : ${count ?? "non rapporté"}`)
  const { data: reste } = await admin.from("firms").select("id").eq("id", cible.id).maybeSingle()
  console.log(`   présent : ${reste ? "OUI — la suppression n'a rien fait" : "non, il a bien disparu"}`)
  process.exit(0)
}

if (!appliquer) {
  console.log(cabinets.length
    ? "\nRien n'a été supprimé. Pour effacer :  ./cric menage --appliquer" +
      "\nPour comprendre pourquoi une suppression échoue :  ./cric menage --diagnostic"
    : "\nRien à balayer.")
  process.exit(0)
}

console.log("\nEffacement…")
const r = await balayer(admin)

// Les refus sont GROUPÉS par message : quatre-vingts lignes identiques
// noieraient le seul renseignement utile, qui est lequel de la base parle.
const parMessage = {}
for (const e of r.refuses) {
  const cle = `${e.code} — ${e.message}`
  ;(parMessage[cle] ??= []).push(e.quoi)
}
for (const [msg, quoi] of Object.entries(parMessage)) {
  console.log(`\n  ✗ ${quoi.length} refus : ${msg}`)
  console.log(`     ex. ${quoi[0]}`)
}

console.log(`\nCabinets : ${r.effaces.cabinets}/${r.tentes.cabinets} effacés`)
console.log(`Comptes  : ${r.effaces.comptes}/${r.tentes.comptes} effacés`)

if (r.effaces.cabinets < r.tentes.cabinets) {
  console.log(
    "\nUn cabinet ne s'efface pas tant qu'il porte un journal d'audit, et c'est\n" +
    "la garantie qui fonctionne : `audit_logs` cascade depuis `firms`, donc\n" +
    "supprimer le cabinet effacerait son journal. Rien ici ne contourne cela.\n" +
    "Les cabinets d'épreuve restent, invisibles de tout autre cabinet par RLS."
  )
}
process.exit(0)
