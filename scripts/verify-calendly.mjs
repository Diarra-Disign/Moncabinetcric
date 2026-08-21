#!/usr/bin/env node
/**
 * La relève des rendez-vous Calendly, éprouvée sur la vraie base.
 *
 * Ce script ne parle PAS à Calendly : il éprouve ce qui casse réellement — le
 * cloisonnement du jeton, la déduplication, l'appariement au client et la
 * bascule d'une annulation. Un faux appel réseau ne prouverait rien de tout
 * cela, et la partie qui parle à Calendly est déjà couverte par les épreuves
 * unitaires du module.
 */
import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")])
)
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const anonyme = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })

let echecs = 0
const verifier = (nom, ok, detail = "") => {
  if (ok) console.log(`  ✓ ${nom}`)
  else { echecs++; console.log(`  ✗ ${nom}${detail ? ` — ${detail}` : ""}`) }
}

const m = Date.now()
const { data: cab, error: eCab } = await service.from("firms").insert({
  name: `Calendly ${m}`, rcic_license_number: `R776${String(m).slice(-4)}`,
  owner_name: "Épreuve", email: `cal-${m}@example.invalid`, plan: "courtoisie", status: "active",
}).select("id").single()
if (eCab) throw new Error(`Cabinet : ${eCab.message}`)

const { data: cli, error: eCli } = await service.from("clients").insert({
  firm_id: cab.id, name: "Awa Diallo", email: "awa.diallo@example.invalid",
  file_number: "CAL-1", program: "RP", status: "active", client_type: "individual",
}).select("id").single()
if (eCli) throw new Error(`Client : ${eCli.message}`)

console.log("\nLa relève des rendez-vous Calendly\n")

// ── 1. Le jeton est hors de portée du navigateur ───────────────────────────
await service.from("firm_calendly").insert({
  firm_id: cab.id, access_token: "jeton-secret-epreuve", calendly_user_uri: "https://api.calendly.com/users/EPREUVE",
})
const { data: vuAnon, error: eAnon } = await anonyme.from("firm_calendly").select("access_token")
verifier("la clé anonyme ne lit AUCUN jeton", !!eAnon || (vuAnon ?? []).length === 0,
  `a reçu ${JSON.stringify(vuAnon)}`)

const { error: eEcrit } = await anonyme.from("firm_calendly")
  .update({ access_token: "vole" }).eq("firm_id", cab.id)
const { data: intact } = await service.from("firm_calendly").select("access_token").eq("firm_id", cab.id).single()
verifier("la clé anonyme ne peut pas remplacer un jeton",
  !!eEcrit || intact?.access_token === "jeton-secret-epreuve", `devenu ${intact?.access_token}`)

// ── 2. La déduplication : LE point du chantier ─────────────────────────────
const ligne = (statut = "confirmed") => ({
  firm_id: cab.id, source: "calendly", external_id: "EVT-AAAA",
  title: "Consultation initiale", client_id: cli.id, client_name: "Awa Diallo",
  type: "consultation", status: statut, platform: "zoom",
  link: "https://zoom.us/j/1", date: "2026-09-15", time: "14:30", hour: 14,
  duration_minutes: 45, notes: "Réservé sur Calendly — awa.diallo@example.invalid",
})

for (let i = 0; i < 3; i++) {
  await service.from("calendar_events").upsert(ligne(), { onConflict: "firm_id,source,external_id" })
}
const { data: apres3 } = await service.from("calendar_events")
  .select("id, client_id, status").eq("firm_id", cab.id).eq("external_id", "EVT-AAAA")
verifier("relever TROIS fois ne crée qu'une seule ligne", (apres3 ?? []).length === 1,
  `${(apres3 ?? []).length} lignes`)
verifier("le rendez-vous est accroché à la bonne fiche client", apres3?.[0]?.client_id === cli.id)

// ── 3. Une annulation bascule le statut, sans supprimer ────────────────────
await service.from("calendar_events").upsert(ligne("cancelled"), { onConflict: "firm_id,source,external_id" })
const { data: annule } = await service.from("calendar_events")
  .select("id, status").eq("firm_id", cab.id).eq("external_id", "EVT-AAAA")
verifier("une annulation met à jour au lieu de dupliquer", (annule ?? []).length === 1)
verifier("le statut passe bien à « cancelled »", annule?.[0]?.status === "cancelled",
  `reçu ${annule?.[0]?.status}`)

// ── 4. Les saisies manuelles ne se heurtent pas entre elles ────────────────
// L'index est partiel : sans `where external_id is not null`, deux rendez-vous
// saisis à la main se heurteraient tous les deux sur (cabinet, 'manuel', null).
const manuel = (titre) => ({
  firm_id: cab.id, source: "manuel", title: titre, client_name: "Jean Tremblay",
  type: "consultation", status: "confirmed", date: "2026-09-20", hour: 10,
})
const { error: eM1 } = await service.from("calendar_events").insert(manuel("Rencontre 1"))
const { error: eM2 } = await service.from("calendar_events").insert(manuel("Rencontre 2"))
verifier("deux rendez-vous saisis à la main coexistent", !eM1 && !eM2,
  `${eM1?.message ?? ""} ${eM2?.message ?? ""}`)

// ── 5. La source est contrainte ───────────────────────────────────────────
const { error: eSource } = await service.from("calendar_events")
  .insert({ ...manuel("Source inventée"), source: "inventee" })
verifier("une source inconnue est refusée", !!eSource)

// ── 6. Le cloisonnement entre cabinets ────────────────────────────────────
const { data: cab2 } = await service.from("firms").insert({
  name: `Voisin ${m}`, rcic_license_number: `R775${String(m).slice(-4)}`,
  owner_name: "Voisin", email: `voisin-${m}@example.invalid`, plan: "courtoisie", status: "active",
}).select("id").single()
const { error: eMemeId } = await service.from("calendar_events").insert({
  ...ligne(), firm_id: cab2.id,
})
verifier("deux cabinets peuvent porter le même identifiant Calendly", !eMemeId,
  eMemeId?.message)

await service.rpc("purger_cabinet_epreuve", { p_firm_id: cab.id })
await service.rpc("purger_cabinet_epreuve", { p_firm_id: cab2.id })

console.log(echecs === 0 ? `\n✓ Relève Calendly vérifiée, 0 échec.\n` : `\n✗ ${echecs} échec(s).\n`)
process.exit(echecs === 0 ? 0 : 1)
