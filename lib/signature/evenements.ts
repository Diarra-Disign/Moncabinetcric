import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import type { EvenementSignature } from "./statuts"
import type { ContexteSignature } from "./contrat"

/**
 * L'émission des événements de signature.
 *
 * ─── CE FICHIER N'IMPORTE AUCUN AUTRE MODULE DU CRM ────────────────────────
 *
 * Ni les ententes, ni la facturation, ni les notifications. C'est la règle du
 * §17 et elle est absolue : écrire « si signature terminée alors marquer
 * l'entente signée » ICI rendrait le module de signature impossible à
 * remplacer, puisqu'un fournisseur externe emporterait la logique métier avec
 * lui.
 *
 * Le module DIT ce qui s'est passé. Ce que le CRM en fait est décidé ailleurs,
 * dans `lib/workflow/signature-reactions.ts`.
 *
 * ─── POURQUOI PAS UN BUS D'ÉVÉNEMENTS ──────────────────────────────────────
 *
 * Un registre d'abonnés peuplé au chargement des modules paraît plus élégant.
 * Il ne l'est pas ici : les fonctions serveur de ce produit sont recréées à
 * chaque requête, et un abonnement posé au chargement d'un module qui n'est pas
 * importé par le chemin courant ne serait jamais enregistré. On obtiendrait des
 * réactions qui marchent depuis un écran et pas depuis un autre — le pire des
 * défauts, parce qu'il est intermittent.
 *
 * L'appelant appelle donc `reagir()` explicitement. C'est visible, c'est
 * traçable, et cela ne dépend d'aucun ordre de chargement.
 *
 * ─── LE JOURNAL NE BLOQUE JAMAIS ───────────────────────────────────────────
 *
 * Une trace qui ne s'écrit pas est un défaut à corriger, pas une raison de
 * refuser une signature. Refuser punirait le signataire pour un défaut qui
 * n'est pas le sien — et le journal, lui, dirait qu'il n'a rien signé.
 */

export interface EmissionSignature {
  requestId: string
  evenement: EvenementSignature
  destinataireId?: string | null
  /** Ce que l'événement veut ajouter. Aucune forme imposée. */
  details?: Record<string, unknown>
}

/**
 * Écrit l'événement au journal immuable.
 *
 * Passe par `signature_event()`, SECURITY DEFINER, parce que le signataire n'a
 * aucun compte : c'est tout l'objet du lien public. Sans cette fonction, les
 * événements les plus importants — « document ouvert », « signature
 * apposée » — seraient les seuls à manquer au journal.
 */
export async function journaliser(
  sb: SupabaseClient,
  ctx: ContexteSignature,
  e: EmissionSignature
): Promise<void> {
  const { error } = await sb.rpc("signature_event", {
    p_request_id: e.requestId,
    p_event: e.evenement,
    p_actor: ctx.fullName || ctx.email || "",
    p_recipient_id: e.destinataireId ?? null,
    p_ip: ctx.ip ?? null,
    p_agent: ctx.agent ?? null,
    p_details: e.details ?? {},
  })
  if (error) console.error("journaliser :", e.evenement, "—", error.message)
}
