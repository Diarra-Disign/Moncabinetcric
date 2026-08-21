#!/usr/bin/env node
/**
 * Le lien de prise de rendez-vous : de l'écran jusqu'à la base, et retour.
 *
 * Ce script existe à cause d'un défaut précis. L'onglet « Zoom & Google
 * Calendar » offrait quatre contrôles ; aucun n'était envoyé au serveur, et la
 * table `firms` n'avait aucune colonne où les écrire. L'écran annonçait
 * pourtant « enregistrés avec succès ».
 *
 * Éprouver l'aller seul n'aurait rien prouvé : c'est le RETOUR — relire la
 * ligne après écriture — qui distingue un enregistrement d'une illusion.
 */
import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")])
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

let echecs = 0
const verifier = (nom, condition, detail = "") => {
  if (condition) console.log(`  ✓ ${nom}`)
  else { echecs++; console.log(`  ✗ ${nom}${detail ? ` — ${detail}` : ""}`) }
}

const marque = Date.now()
const { data: cab, error: eCab } = await sb.from("firms").insert({
  name: `Rendez-vous ${marque}`, rcic_license_number: `R778${String(marque).slice(-4)}`,
  owner_name: "Épreuve", email: `rdv-${marque}@example.invalid`, plan: "courtoisie", status: "active",
}).select("id").single()
if (eCab) throw new Error(`Cabinet d'épreuve : ${eCab.message}`)

console.log("\nLe lien de prise de rendez-vous\n")

// 1. La colonne existe et part vide.
verifier("un cabinet neuf n'a aucun lien", cab && true)
const { data: neuf } = await sb.from("firms").select("booking_url").eq("id", cab.id).single()
verifier("la colonne booking_url existe et vaut null", neuf?.booking_url === null, `reçu ${JSON.stringify(neuf?.booking_url)}`)

// 2. L'aller-retour : c'est le cœur du défaut corrigé.
const lien = "https://calendly.com/epreuve-cric/consultation"
const { error: eMaj } = await sb.from("firms").update({ booking_url: lien }).eq("id", cab.id)
verifier("le lien s'écrit sans erreur", !eMaj, eMaj?.message)
const { data: relu } = await sb.from("firms").select("booking_url").eq("id", cab.id).single()
verifier("le lien RELU en base est bien celui écrit", relu?.booking_url === lien, `reçu ${JSON.stringify(relu?.booking_url)}`)

// 3. La contrainte : ce lien est publié à des candidats.
for (const mauvais of [
  "javascript:alert(1)",
  "data:text/html,<script>alert(1)</script>",
  "http://calendly.com/sans-chiffrement",
  "calendly.com/sans-schema",
]) {
  const { error } = await sb.from("firms").update({ booking_url: mauvais }).eq("id", cab.id)
  verifier(`la base refuse « ${mauvais.slice(0, 34)} »`, !!error, "acceptée alors qu'elle devrait être refusée")
}

// 4. Le lien légitime survit aux refus.
const { data: apres } = await sb.from("firms").select("booking_url").eq("id", cab.id).single()
verifier("le lien valide est intact après les refus", apres?.booking_url === lien, `reçu ${JSON.stringify(apres?.booking_url)}`)

// 5. On peut retirer le lien — laisser vide doit rester possible.
await sb.from("firms").update({ booking_url: null }).eq("id", cab.id)
const { data: vide } = await sb.from("firms").select("booking_url").eq("id", cab.id).single()
verifier("le lien peut être effacé", vide?.booking_url === null)

await sb.rpc("purger_cabinet_epreuve", { p_firm_id: cab.id })

console.log(
  echecs === 0
    ? `\n✓ Lien de rendez-vous vérifié, 0 échec.\n`
    : `\n✗ ${echecs} échec(s).\n`
)
process.exit(echecs === 0 ? 0 : 1)
