"use server"

import { reserverCreneau } from "@/lib/data/reservation"
import { autorise, TROP_DE_TENTATIVES } from "@/lib/securite/limiter"
import { getServerSupabase } from "@/lib/supabase/server"
import { envoyerCourriel } from "@/lib/email/send"
import { courrielRendezVous, composerMomentRendezVous } from "@/lib/email/templates"

/**
 * La réservation depuis la page publique.
 *
 * ─── CE QUI PROTÈGE UN CHEMIN OUVERT À TOUS ────────────────────────────────
 *
 * Quatre gardes, chacune contre une menace distincte :
 *
 *   1. LE QUOTA — trois réservations par heure et par adresse. Un client
 *      honnête en fait une ; qui voudrait remplir l'agenda du cabinet est
 *      arrêté au quatrième essai.
 *   2. LE CHAMP-PIÈGE — un champ invisible qu'un humain ne peut pas remplir.
 *      Les robots remplissent tout ce qu'ils trouvent : s'il est rempli, on
 *      annonce un succès SANS RIEN ÉCRIRE. Répondre « refusé » apprendrait au
 *      robot à contourner ; répondre « accepté » le renvoie satisfait.
 *   3. LE VERROU EN BASE — deux clics simultanés sur le même créneau ne
 *      produisent jamais deux rendez-vous. Voir `reserver_creneau()`.
 *   4. LES BORNES REVÉRIFIÉES EN BASE — préavis, horizon, plage déclarée. Un
 *      robot n'exécute pas le JavaScript de l'écran : les contrôles qui
 *      comptent sont ceux que Postgres applique.
 */

export interface ResultatReservationPublique {
  ok: boolean
  message: string
  /** Vrai quand le rendez-vous est pris — l'écran bascule alors sur la confirmation. */
  confirme?: boolean
}

export async function reserverDepuisLaPagePublique(
  formData: FormData
): Promise<ResultatReservationPublique> {
  // Garde 2 : le champ-piège, avant toute autre chose.
  if (String(formData.get("site") ?? "").trim() !== "") {
    return { ok: true, confirme: true, message: "Votre rendez-vous est confirmé." }
  }

  // Garde 1 : le quota.
  if (!(await autorise("rdvEcriture"))) {
    return { ok: false, message: TROP_DE_TENTATIVES }
  }

  const slug = String(formData.get("slug") ?? "").trim()
  const debutIso = String(formData.get("debut") ?? "").trim()
  const nom = String(formData.get("nom") ?? "").trim()
  const courriel = String(formData.get("courriel") ?? "").trim()
  const telephone = String(formData.get("telephone") ?? "").trim()
  const motif = String(formData.get("motif") ?? "").trim()

  if (!slug || !debutIso || !nom || !courriel) {
    return { ok: false, message: "Votre nom et votre courriel sont nécessaires." }
  }
  if (Number.isNaN(Date.parse(debutIso))) {
    return { ok: false, message: "Ce créneau n'est plus valide. Rechargez la page." }
  }

  const resultat = await reserverCreneau({ slug, debutIso, nom, courriel, telephone, motif })
  if (!resultat.ok) return resultat

  // ── Les courriels, APRÈS l'écriture et sans jamais la compromettre ───────
  //
  // Le rendez-vous est pris ; si Resend est en panne, il le reste. On le dit
  // au client plutôt que de laisser croire qu'un courriel arrive.
  let courrielParti = true
  try {
    courrielParti = await annoncer({ slug, debutIso, nom, courriel, motif })
  } catch {
    courrielParti = false
  }

  return {
    ok: true,
    confirme: true,
    message: courrielParti
      ? "Votre rendez-vous est confirmé. Un courriel vient de vous être envoyé."
      : "Votre rendez-vous est confirmé. Le courriel de confirmation n'a pas pu être envoyé — notez bien la date ci-dessous.",
  }
}

/** Prévient le client, puis le cabinet. */
async function annoncer(opts: {
  slug: string
  debutIso: string
  nom: string
  courriel: string
  motif: string
}): Promise<boolean> {
  const sb = getServerSupabase()
  const { data: cabinet } = await sb
    .from("firms")
    .select("id, name, reply_to_email, email, email_sender_name, meeting_room_url, booking_slot_minutes")
    .eq("booking_slug", opts.slug)
    .maybeSingle()
  if (!cabinet) return false

  const debut = new Date(opts.debutIso)
  const local = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto", hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(debut)
  const p = Object.fromEntries(local.map((x) => [x.type, x.value])) as Record<string, string>
  const date = `${p.year}-${p.month}-${p.day}`
  const heure = `${p.hour === "24" ? "00" : p.hour}:${p.minute}`

  const moment = composerMomentRendezVous(date, heure, "fr")
  const repondreA = (cabinet.reply_to_email as string) || (cabinet.email as string) || ""

  const compose = courrielRendezVous({
    langue: "fr",
    nomClient: opts.nom,
    nomCabinet: (cabinet.name as string) ?? "",
    motif: opts.motif || "Consultation",
    ...moment,
    dureeMinutes: Number(cabinet.booking_slot_minutes ?? 30),
    modalite: cabinet.meeting_room_url ? "Visioconférence" : undefined,
    lienRencontre: (cabinet.meeting_room_url as string) || undefined,
    reponsePossible: Boolean(repondreA),
  })

  const envoi = await envoyerCourriel({
    destinataire: opts.courriel,
    sujet: compose.sujet,
    html: compose.html,
    texte: compose.texte,
    repondreA: repondreA || undefined,
    nomExpediteur: (cabinet.email_sender_name as string) || undefined,
  })

  // Le cabinet est prévenu à son tour. Une notification en base plutôt qu'un
  // courriel de plus : elle apparaît dans l'application, où le consultant
  // travaille déjà, et ne dépend pas de la délivrabilité.
  await sb.rpc("notifier", {
    p_firm_id: cabinet.id,
    p_kind: "rendez_vous",
    p_title: "Nouveau rendez-vous réservé en ligne",
    p_body: `${opts.nom} — ${moment.dateLisible} à ${moment.heureLisible}`,
    p_link: "/calendar",
  }).then(() => {}, () => {})

  return envoi.envoye
}
