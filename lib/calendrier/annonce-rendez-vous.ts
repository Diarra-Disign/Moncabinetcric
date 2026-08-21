import "server-only"

import { getServerSupabase } from "@/lib/supabase/server"
import { envoyerCourriel } from "@/lib/email/send"
import { courrielRendezVous, composerMomentRendezVous, type Langue } from "@/lib/email/templates"

/**
 * Annonce au client le rendez-vous que le cabinet vient de fixer.
 *
 * ─── ELLE NE LÈVE JAMAIS, ET C'EST LE POINT ────────────────────────────────
 *
 * Elle est appelée APRÈS l'insertion du rendez-vous. Si elle levait, le
 * consultant verrait « erreur » alors que son rendez-vous est bel et bien
 * enregistré — et il le saisirait une seconde fois. Un courriel manqué se
 * rattrape ; un rendez-vous en double dans un agenda, beaucoup moins.
 *
 * Elle rend donc un compte rendu, que l'écran affiche : « le client a été
 * prévenu », ou « le rendez-vous est enregistré mais le courriel n'est pas
 * parti ». Ne rien dire serait pire que les deux.
 */

export interface ResultatAnnonce {
  envoye: boolean
  /** Pourquoi ça n'est pas parti — pour l'afficher, non pour le journaliser seul. */
  raison?: string
}

export async function annoncerRendezVous(opts: {
  firmId: string
  courrielClient: string
  nomClient: string
  motif: string
  date: string
  heure: string
  dureeMinutes: number
  modalite?: string | null
  lienRencontre?: string | null
  langue?: Langue
}): Promise<ResultatAnnonce> {
  const destinataire = (opts.courrielClient ?? "").trim()
  if (!destinataire) return { envoye: false, raison: "Aucune adresse courriel pour ce contact." }

  try {
    const sb = getServerSupabase()
    const { data: cabinet } = await sb
      .from("firms")
      .select("name, reply_to_email, email, email_sender_name, booking_url")
      .eq("id", opts.firmId)
      .maybeSingle()

    const langue: Langue = opts.langue ?? "fr"
    const { dateLisible, heureLisible, fuseauLisible } = composerMomentRendezVous(
      opts.date, opts.heure, langue
    )

    // L'adresse de réponse d'abord, celle du cabinet ensuite. Sans l'une ni
    // l'autre, le gabarit n'invite pas à répondre plutôt que d'envoyer le
    // client écrire à une boîte que personne ne relève.
    const repondreA = (cabinet?.reply_to_email as string) || (cabinet?.email as string) || null

    const compose = courrielRendezVous({
      langue,
      nomClient: opts.nomClient,
      nomCabinet: (cabinet?.name as string) ?? "",
      motif: opts.motif,
      dateLisible,
      heureLisible,
      fuseauLisible,
      dureeMinutes: opts.dureeMinutes,
      modalite: opts.modalite ?? undefined,
      lienRencontre: opts.lienRencontre ?? undefined,
      // Le lien de réservation ne sert de repli que s'il n'y a pas de lien de
      // rencontre : proposer « choisissez un autre créneau » sous un bouton
      // « rejoindre » inviterait à déplacer ce qu'on vient de fixer.
      lienReservation: opts.lienRencontre ? undefined : ((cabinet?.booking_url as string) || undefined),
      reponsePossible: Boolean(repondreA),
    })

    const r = await envoyerCourriel({
      destinataire,
      sujet: compose.sujet,
      html: compose.html,
      texte: compose.texte,
      nomExpediteur: (cabinet?.email_sender_name as string) || (cabinet?.name as string) || null,
      repondreA,
    })

    if (!r.envoye) return { envoye: false, raison: "L'envoi de courriel a échoué." }
    return { envoye: true }
  } catch {
    return { envoye: false, raison: "L'envoi de courriel a échoué." }
  }
}
