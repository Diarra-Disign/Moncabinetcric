#!/usr/bin/env node
/**
 * La page publique de réservation, éprouvée avec la CLÉ ANONYME.
 *
 * Le point du script : se mettre à la place d'un visiteur inconnu. Employer la
 * clé de service prouverait seulement que les données existent ; c'est ce qu'un
 * ÉTRANGER peut lire et écrire qui compte.
 */
import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")])
)
const service = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const visiteur = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })

let echecs = 0
const verifier = (nom, ok, detail = "") => {
  if (ok) console.log(`  ✓ ${nom}`)
  else { echecs++; console.log(`  ✗ ${nom}${detail ? ` — ${detail}` : ""}`) }
}

const m = Date.now()
const slug = `epreuve-rdv-${String(m).slice(-8)}`
const { data: cab, error: eCab } = await service.from("firms").insert({
  name: `RDV ${m}`, rcic_license_number: `R773${String(m).slice(-4)}`,
  owner_name: "Épreuve", email: `rdv-${m}@example.invalid`, plan: "courtoisie", status: "active",
  booking_slug: slug, booking_enabled: true, booking_slot_minutes: 60,
  booking_lead_hours: 24, booking_horizon_days: 30,
  meeting_room_url: "https://meet.google.com/abc-defg-hij",
}).select("id").single()
if (eCab) throw new Error(`Cabinet : ${eCab.message}`)

// Un client réel du cabinet, dont le nom NE DOIT JAMAIS sortir.
const { data: cli } = await service.from("clients").insert({
  firm_id: cab.id, name: "Confidentielle Tremblay", email: `ct-${m}@example.invalid`,
  file_number: "RDV-1", program: "RP", status: "active", client_type: "individual",
}).select("id").single()

// Toutes les journées ouvertes, pour que le calcul trouve toujours un créneau.
for (let j = 0; j <= 6; j++) {
  await service.from("firm_availability").insert({
    firm_id: cab.id, weekday: j, start_time: "09:00", end_time: "17:00",
  })
}

console.log("\nLa page publique de réservation\n")

// ── 1. Ce que le visiteur peut lire ───────────────────────────────────────
const { data: pub } = await visiteur.rpc("cabinet_public", { p_slug: slug })
verifier("le visiteur obtient le cabinet par son adresse", (pub ?? []).length === 1)
verifier("il reçoit la salle de rencontre", pub?.[0]?.salle?.includes("meet.google.com"))
const champs = Object.keys(pub?.[0] ?? {})
verifier("aucun courriel ni téléphone de cabinet n'est exposé",
  !champs.some((c) => /email|phone|courriel|telephone/i.test(c)), champs.join(", "))

// ── 2. LE POINT CRITIQUE : un créneau occupé ne dit pas par qui ────────────
const dans7 = new Date(Date.now() + 7 * 86400000)
const dateOccupee = dans7.toISOString().slice(0, 10)
await service.from("calendar_events").insert({
  firm_id: cab.id, client_id: cli.id, title: "Demande d'asile — dossier sensible",
  client_name: "Confidentielle Tremblay", type: "consultation", status: "confirmed",
  date: dateOccupee, time: "14:00", hour: 14, duration_minutes: 60, source: "manuel",
})
const { data: pris } = await visiteur.rpc("creneaux_pris", {
  p_slug: slug, p_du: dateOccupee, p_au: dateOccupee,
})
verifier("le créneau occupé est signalé au visiteur", (pris ?? []).length === 1)
const brut = JSON.stringify(pris ?? [])
verifier("le NOM du client ne sort jamais", !brut.includes("Confidentielle"), brut.slice(0, 120))
verifier("le MOTIF du rendez-vous ne sort jamais", !brut.includes("asile"), brut.slice(0, 120))
verifier("l'identifiant du rendez-vous ne sort pas", !/\bid\b/.test(Object.keys(pris?.[0] ?? {}).join(",")))

// ── 3. La table des plages reste fermée en lecture directe ────────────────
const { data: vuePlages, error: ePlages } = await visiteur.from("firm_availability").select("*")
verifier("le visiteur ne lit pas firm_availability directement",
  !!ePlages || (vuePlages ?? []).length === 0)
const { data: vueEvents } = await visiteur.from("calendar_events").select("*")
verifier("le visiteur ne lit pas calendar_events directement", (vueEvents ?? []).length === 0)

// ── 4. Les bornes, imposées par la BASE et non par l'écran ────────────────
const dansUneHeure = new Date(Date.now() + 3600_000).toISOString()
const { error: eTrop } = await visiteur.rpc("reserver_creneau", {
  p_slug: slug, p_debut: dansUneHeure, p_nom: "Robot", p_courriel: "r@example.invalid",
})
verifier("un créneau sous le préavis est refusé", !!eTrop, "accepté")

const dansUnAn = new Date(Date.now() + 400 * 86400000).toISOString()
const { error: eLoin } = await visiteur.rpc("reserver_creneau", {
  p_slug: slug, p_debut: dansUnAn, p_nom: "Robot", p_courriel: "r@example.invalid",
})
verifier("un créneau au-delà de l'horizon est refusé", !!eLoin, "accepté")

const { error: eMail } = await visiteur.rpc("reserver_creneau", {
  p_slug: slug, p_debut: `${dateOccupee}T13:00:00-04:00`,
  p_nom: "Sans courriel", p_courriel: "pas-une-adresse",
})
verifier("un courriel malformé est refusé", !!eMail, "accepté")

// Hors des plages déclarées : 22 h n'est dans aucune.
const { error: eHors } = await visiteur.rpc("reserver_creneau", {
  p_slug: slug, p_debut: `${dateOccupee}T22:00:00-04:00`,
  p_nom: "Nuit", p_courriel: "n@example.invalid",
})
verifier("un moment hors des plages déclarées est refusé", !!eHors, "accepté")

// ── 5. Une réservation légitime ───────────────────────────────────────────
const libre = `${dateOccupee}T10:00:00-04:00`
const { data: idRdv, error: eOk } = await visiteur.rpc("reserver_creneau", {
  p_slug: slug, p_debut: libre, p_nom: "Awa Diallo",
  p_courriel: "awa@example.invalid", p_telephone: "819-555-0100", p_motif: "Résidence permanente",
})
verifier("une réservation valide aboutit", !eOk && !!idRdv, eOk?.message)

const { data: cree } = await service.from("calendar_events")
  .select("client_id, source, link, client_name, notes, duration_minutes")
  .eq("id", idRdv).maybeSingle()
verifier("le rendez-vous porte la source « reservation »", cree?.source === "reservation")
verifier("il porte le lien de la salle du cabinet", cree?.link?.includes("meet.google.com"))
verifier("aucune fiche client n'est créée", cree?.client_id === null)
verifier("le courriel du client est conservé dans les notes", cree?.notes?.includes("awa@example.invalid"))

// ── 6. LA COURSE ──────────────────────────────────────────────────────────
// Deux visiteurs cliquent le même créneau à la même seconde. Sans le verrou,
// le consultant se retrouve avec deux clients à la même heure.
const dispute = `${dateOccupee}T11:00:00-04:00`
const [a, b] = await Promise.all([
  visiteur.rpc("reserver_creneau", { p_slug: slug, p_debut: dispute, p_nom: "Premier", p_courriel: "p@example.invalid" }),
  visiteur.rpc("reserver_creneau", { p_slug: slug, p_debut: dispute, p_nom: "Second", p_courriel: "s@example.invalid" }),
])
const reussites = [a, b].filter((r) => !r.error).length
verifier("deux réservations simultanées n'en écrivent qu'UNE", reussites === 1,
  `${reussites} ont réussi`)
const perdant = [a, b].find((r) => r.error)
verifier("le perdant reçoit un message compréhensible",
  Boolean(perdant?.error?.message && /pris|autre/i.test(perdant.error.message)),
  perdant?.error?.message)

const { count } = await service.from("calendar_events")
  .select("id", { count: "exact", head: true })
  .eq("firm_id", cab.id).eq("date", dateOccupee).eq("time", "11:00")
verifier("une seule ligne existe pour le créneau disputé", count === 1, `${count} lignes`)

// ── 7. Un cabinet fermé n'offre rien ──────────────────────────────────────
await service.from("firms").update({ booking_enabled: false }).eq("id", cab.id)
const { data: ferme } = await visiteur.rpc("cabinet_public", { p_slug: slug })
verifier("une page fermée ne rend aucun cabinet", (ferme ?? []).length === 0)
const { error: eFerme } = await visiteur.rpc("reserver_creneau", {
  p_slug: slug, p_debut: `${dateOccupee}T15:00:00-04:00`,
  p_nom: "Tardif", p_courriel: "t@example.invalid",
})
verifier("on ne réserve pas sur une page fermée", !!eFerme, "accepté")

// ── 8. Une adresse inconnue ne révèle rien ────────────────────────────────
const { data: inconnu } = await visiteur.rpc("cabinet_public", { p_slug: "cabinet-qui-nexiste-pas" })
verifier("une adresse inconnue rend une liste vide", (inconnu ?? []).length === 0)

await service.rpc("purger_cabinet_epreuve", { p_firm_id: cab.id })

console.log(echecs === 0 ? `\n✓ Page de réservation vérifiée, 0 échec.\n` : `\n✗ ${echecs} échec(s).\n`)
process.exit(echecs === 0 ? 0 : 1)
