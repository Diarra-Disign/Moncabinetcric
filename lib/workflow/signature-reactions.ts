import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { EvenementSignature } from "@/lib/signature/statuts"

/**
 * Ce que le CRM fait quand une signature avance.
 *
 * ─── LE SENS DE LA DÉPENDANCE ──────────────────────────────────────────────
 *
 * Ce fichier importe le VOCABULAIRE de la signature — des types, effacés à la
 * compilation. Le module de signature, lui, n'importe rien d'ici. La flèche ne
 * va que dans un sens, et c'est ce qui rend le fournisseur remplaçable :
 * PandaDoc emportera le moteur, pas les règles du cabinet.
 *
 * ─── CE QUI EST DÉCIDÉ ICI, ET NULLE PART AILLEURS ─────────────────────────
 *
 * Qu'une entente devienne « signée ». Qu'une notification parte. Qu'un
 * consultant soit prévenu. Le §17 est explicite : « ne code pas directement
 * si signature terminée alors créer facture dans le moteur de signature ».
 *
 * ─── CE QUI N'EST PAS FAIT AUTOMATIQUEMENT ─────────────────────────────────
 *
 * Aucune facture n'est créée. Un numéro de facture appartient à une suite
 * continue et ne se reprend pas : une facture née d'un automatisme au mauvais
 * moment devrait être ANNULÉE, pas supprimée, et laisserait un trou à
 * expliquer. Le consultant décide, étape par étape — c'est déjà la règle du
 * module de facturation, et elle ne change pas parce qu'une signature arrive.
 *
 * Ce qui est fait : on PRÉVIENT. Le reste lui appartient.
 */

export interface ContexteReaction {
  firmId: string
  profileId?: string | null
  fullName?: string
  email?: string
}

export interface Reaction {
  /** Ce qui a été fait, en clair, pour le journal de l'appelant. */
  faits: string[]
}

/**
 * Réagit à un événement de signature.
 *
 * AUCUNE RÉACTION NE FAIT ÉCHOUER L'ACTE qui l'a déclenchée. Une signature est
 * apposée ; si la notification ne part pas, la signature reste valide. L'ordre
 * inverse — annuler une signature parce qu'un courriel a échoué — serait
 * absurde et impossible à expliquer au signataire.
 */
export async function reagirASignature(
  sb: SupabaseClient,
  ctx: ContexteReaction,
  evenement: EvenementSignature,
  requestId: string
): Promise<Reaction> {
  const faits: string[] = []

  try {
    const { data: demande } = await sb
      .from("signature_requests")
      .select("id, status, document_id, client_id")
      .eq("id", requestId)
      .maybeSingle()
    if (!demande) return { faits }

    // ── L'ENTENTE SUIT SON DOCUMENT ────────────────────────────────────────
    // Le lien se fait par le document : `agreements.document_id` désigne le
    // PDF émis, et c'est lui qu'on fait signer. Aucune colonne nouvelle n'est
    // nécessaire — la relation existait déjà, personne ne la lisait.
    const { data: entente } = await sb
      .from("agreements")
      .select("id, reference, status")
      .eq("document_id", demande.document_id)
      .maybeSingle()

    if (entente) {
      const nouveau =
        evenement === "signature.completed" ? "signed"
        : evenement === "signature.declined" ? "declined"
        : evenement === "signature.signed" ? "partially_signed"
        : evenement === "signature.request.cancelled" ? "cancelled"
        : null

      // On ne redescend jamais un état : une entente signée ne redevient pas
      // « partiellement signée » parce qu'un événement arrive dans le désordre.
      const dejaFinie = ["signed", "declined", "cancelled"].includes(String(entente.status))

      if (nouveau && !dejaFinie && entente.status !== nouveau) {
        const { error } = await sb
          .from("agreements").update({ status: nouveau }).eq("id", entente.id)
        if (!error) faits.push(`Entente ${entente.reference} : ${nouveau}.`)
      }
    }

    // ── ON PRÉVIENT ────────────────────────────────────────────────────────
    // La table `notifications` existait et rien ne l'écrivait. Elle vise un
    // membre OU un client, jamais les deux — la contrainte de la base le dit.
    const messages: Record<string, { titre: string; corps: string } | undefined> = {
      "signature.completed": {
        titre: "Document signé",
        corps: entente
          ? `L'entente ${entente.reference} a été signée par toutes les parties.`
          : "Toutes les signatures attendues ont été apposées.",
      },
      "signature.declined": {
        titre: "Signature refusée",
        corps: entente
          ? `Un signataire a refusé l'entente ${entente.reference}.`
          : "Un signataire a refusé de signer le document.",
      },
      "signature.signed": {
        titre: "Une signature de plus",
        corps: "Un signataire vient de signer ; il en reste au moins un.",
      },
    }

    const message = messages[evenement]
    if (message) {
      // PAR UNE FONCTION, PAS PAR UN INSERT. La table n'a que des politiques
      // de LECTURE — deux pour lire, aucune pour écrire — et ce n'est pas un
      // oubli : une notification est produite par le système, jamais par un
      // utilisateur. Ouvrir une politique d'insertion permettrait à un membre
      // de fabriquer des notifications en se faisant passer pour le système.
      const { data, error } = await sb.rpc("notifier_signature", {
        p_request_id: requestId,
        p_kind: evenement,
        p_title: message.titre,
        p_body: message.corps,
        p_link: entente ? "/agreements" : "/signatures",
        p_client_id: null,
      })
      if (!error && data) faits.push("Notification déposée.")
      else if (error) console.error("notifier_signature :", error.message)
    }
  } catch (e) {
    // Voir l'en-tête : une réaction qui échoue ne défait pas l'acte.
    console.error("reagirASignature :", evenement, "—", e instanceof Error ? e.message : e)
  }

  return { faits }
}
