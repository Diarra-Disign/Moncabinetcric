"use server"

import { revalidatePath } from "next/cache"
import { getServerSupabase } from "@/lib/supabase/server"
import { exigerPermission } from "@/lib/auth/permissions"
import { messageErreur } from "@/lib/data/erreurs"
import {
  resoudreCompte,
  listerRendezVous,
  premierParticipant,
  apparierClient,
  convertirEvenement,
  type FicheClient,
} from "@/lib/calendrier/calendly"

/**
 * Le raccordement du cabinet à Calendly, et la relève de ses rendez-vous.
 *
 * ─── POURQUOI LA CLÉ DE SERVICE, ET NON LA SESSION ─────────────────────────
 *
 * `firm_calendly` est fermée par RLS SANS AUCUNE POLITIQUE : le client de
 * session ne peut ni la lire ni l'écrire, et c'est voulu. Le jeton qu'elle
 * contient lit tout le compte Calendly du consultant ; il ne doit jamais
 * atteindre le navigateur.
 *
 * Le cabinet vient donc de la SESSION — `exigerPermission()` le résout — et
 * jamais d'un paramètre. C'est la leçon des dix-sept fonctions du 2026-08-16 :
 * dès qu'un cabinet s'écrit dans un appel, il devient la faille.
 */

const FUSEAU = "America/Toronto"

export interface ResultatCalendly {
  ok: boolean
  message: string
  /** Nombre de rendez-vous ajoutés ou mis à jour par la relève. */
  releves?: number
}

/**
 * Enregistre le jeton — après l'avoir éprouvé.
 *
 * L'appel à `resoudreCompte()` n'est pas une politesse : il vérifie que le
 * jeton fonctionne AVANT l'écriture. Sans lui, une faute de copier-coller
 * s'enregistrerait sans bruit, et le calendrier cesserait de se remplir sans
 * que rien ne l'explique.
 */
export async function enregistrerJetonCalendly(formData: FormData): Promise<ResultatCalendly> {
  try {
    const membre = await exigerPermission("firm.connector")
    const jeton = String(formData.get("jeton") ?? "").trim()

    if (!jeton) {
      // Champ vidé : le cabinet se déconnecte de Calendly.
      await getServerSupabase().from("firm_calendly").delete().eq("firm_id", membre.firmId)
      revalidatePath("/settings")
      revalidatePath("/calendar")
      return { ok: true, message: "Raccordement à Calendly retiré." }
    }

    const compte = await resoudreCompte(jeton)
    if (!compte.ok) {
      return { ok: false, message: compte.erreur ?? "Jeton refusé par Calendly." }
    }

    const { error } = await getServerSupabase().from("firm_calendly").upsert(
      {
        firm_id: membre.firmId,
        access_token: jeton,
        calendly_user_uri: compte.donnees,
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "firm_id" }
    )
    if (error) return { ok: false, message: messageErreur(error) }

    revalidatePath("/settings")
    revalidatePath("/calendar")
    return { ok: true, message: "Calendly raccordé. Vos rendez-vous seront relevés à l'ouverture du calendrier." }
  } catch (e) {
    return { ok: false, message: messageErreur(e) }
  }
}

/** Ce que l'écran a le droit de savoir — jamais le jeton. */
export interface EtatCalendly {
  raccorde: boolean
  derniereReleve: string | null
  derniereErreur: string | null
}

export async function etatCalendly(): Promise<EtatCalendly> {
  try {
    const membre = await exigerPermission("firm.connector")
    const { data } = await getServerSupabase()
      .from("firm_calendly")
      // `access_token` est ABSENT de cette sélection, et doit le rester : ce
      // que rend cette fonction part vers le navigateur.
      .select("calendly_user_uri, last_synced_at, last_error")
      .eq("firm_id", membre.firmId)
      .maybeSingle()

    return {
      raccorde: Boolean(data?.calendly_user_uri),
      derniereReleve: (data?.last_synced_at as string) ?? null,
      derniereErreur: (data?.last_error as string) ?? null,
    }
  } catch {
    return { raccorde: false, derniereReleve: null, derniereErreur: null }
  }
}

/** Le verrou : deux minutes entre deux relèves. */
const VERROU_MS = 2 * 60 * 1000

/**
 * Relève les rendez-vous et les range dans le calendrier.
 *
 * ─── ELLE NE LÈVE JAMAIS ───────────────────────────────────────────────────
 *
 * Elle est appelée à l'affichage du calendrier. Une exception y ferait échouer
 * la page parce qu'un service tiers est en panne — mauvais échange. Tout échec
 * se range dans `last_error`, visible dans les réglages, et la page s'ouvre sur
 * ce que la base contient déjà.
 *
 * `forcee` court-circuite le verrou : c'est le bouton « Relever maintenant ».
 */
export async function releverCalendly(forcee = false): Promise<ResultatCalendly> {
  let firmId = ""
  const sb = getServerSupabase()

  try {
    const membre = await exigerPermission("firm.connector")
    firmId = membre.firmId

    const { data: lien } = await sb
      .from("firm_calendly")
      .select("access_token, calendly_user_uri, last_synced_at")
      .eq("firm_id", firmId)
      .maybeSingle()

    if (!lien?.access_token || !lien?.calendly_user_uri) {
      return { ok: false, message: "Aucun compte Calendly raccordé." }
    }

    // Le verrou. Dix allers-retours entre le tableau de bord et le calendrier
    // ne doivent produire qu'une interrogation.
    if (!forcee && lien.last_synced_at) {
      const depuis = Date.now() - new Date(lien.last_synced_at as string).getTime()
      if (depuis < VERROU_MS) return { ok: true, message: "Déjà à jour.", releves: 0 }
    }

    const jeton = lien.access_token as string
    const evenements = await listerRendezVous(jeton, lien.calendly_user_uri as string)
    if (!evenements.ok) {
      await sb.from("firm_calendly")
        .update({ last_error: evenements.erreur, updated_at: new Date().toISOString() })
        .eq("firm_id", firmId)
      return { ok: false, message: evenements.erreur ?? "Relève impossible." }
    }

    // Les fiches du cabinet, lues UNE fois. Une lecture par rendez-vous
    // multiplierait les allers-retours pour la même réponse.
    const { data: fiches } = await sb
      .from("clients").select("id, name, email").eq("firm_id", firmId)
    const annuaire = (fiches ?? []) as FicheClient[]

    let releves = 0
    for (const evenement of evenements.donnees ?? []) {
      const participant = await premierParticipant(jeton, evenement.uri)
      // Un rendez-vous sans participant lisible est sauté, pas fatal : les
      // suivants doivent quand même arriver.
      if (!participant.ok || !participant.donnees) continue

      const fiche = apparierClient(annuaire, participant.donnees.email)
      const ligne = convertirEvenement(evenement, participant.donnees, fiche, FUSEAU)

      // `onConflict` sur l'index unique : relever dix fois n'écrit qu'une
      // ligne, et une annulation chez Calendly met à jour celle qui existe.
      const { error } = await sb.from("calendar_events").upsert(
        { firm_id: firmId, ...ligne },
        { onConflict: "firm_id,source,external_id" }
      )
      if (!error) releves++
    }

    await sb.from("firm_calendly")
      .update({ last_synced_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() })
      .eq("firm_id", firmId)

    revalidatePath("/calendar")
    return {
      ok: true,
      releves,
      message: releves > 0 ? `${releves} rendez-vous relevé(s).` : "Aucun nouveau rendez-vous.",
    }
  } catch (e) {
    const message = messageErreur(e)
    if (firmId) {
      await sb.from("firm_calendly")
        .update({ last_error: message, updated_at: new Date().toISOString() })
        .eq("firm_id", firmId)
        .then(() => {}, () => {})
    }
    return { ok: false, message }
  }
}
