import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { pdfDEntente } from "./document"
import { deposerOctets } from "@/lib/data/depot"

/**
 * L'émission d'une entente : composer, classer, désigner.
 *
 * Cette fonction reçoit son client Supabase et son membre au lieu de les tirer
 * de la session, et ce n'est pas une coquetterie. L'action serveur qui
 * l'enveloppe n'est appelable que depuis une requête HTTP : tant que le
 * classement vivait DEDANS, il ne pouvait s'éprouver qu'en production. Or c'est
 * précisément l'endroit où une erreur produit une entente qui figure dans la
 * liste et dont le fichier ne s'ouvre jamais.
 *
 * Aucun droit n'est décidé ici. Le client passé porte la session, donc RLS ;
 * la politique du compartiment de stockage compare de son côté le premier
 * segment du chemin à `current_firm_id()`. Un appelant qui mentirait sur le
 * cabinet serait refusé par la base, pas par ce module.
 *
 * UN CONTRAT EST UN DOCUMENT, et c'est toute l'architecture de cette étape. La
 * chaîne de signature du produit s'accroche à `documents` — `signature_requests`
 * porte un `document_id` et une empreinte. Donner au contrat sa propre chaîne
 * aurait dupliqué ce qui existe, et laissé deux façons de répondre à
 * « ce fichier est-il encore celui qui a été signé ? ».
 */

export interface MembreEmetteur {
  firmId: string
  profileId?: string
  userId: string
  fullName?: string
  email?: string
}

export interface ResultatEmission {
  ok: boolean
  message: string
  documentId?: string
  reference?: string
}

export async function emettre(
  sb: SupabaseClient,
  membre: MembreEmetteur,
  id: string
): Promise<ResultatEmission> {
  // LE STATUT IMPRIMÉ EST « ready », PAS CELUI ENCORE EN BASE. L'entente n'y
  // passe qu'à la fin de cette fonction : composer avant, sans le dire, a
  // longtemps produit un document classé — puis envoyé signer, puis intégré au
  // contrat signé — estampé BROUILLON sur toutes ses pages.
  const compose = await pdfDEntente(sb, id, "fr", { statutImprime: "ready" })
  if (!compose) return { ok: false, message: "Cette entente est introuvable." }

  // Une entente déjà émise ne se réémet pas en silence : son PDF a pu être
  // envoyé, voire signé. Le remplacer changerait le document sous la signature
  // — exactement ce que l'empreinte sert à empêcher.
  if (compose.documentId) {
    return {
      ok: false,
      message: `${compose.reference} a déjà été émise. Créez un avenant pour la modifier.`,
    }
  }

  const nomFichier = `${compose.reference}.pdf`

  // La FICHE d'abord, le FICHIER ensuite : le dépôt a besoin de l'identifiant
  // du document pour le ranger, et un fichier déposé sans fiche serait un objet
  // du stockage que rien ne référence.
  const { data: doc, error } = await sb
    .from("documents")
    .insert({
      firm_id: membre.firmId,
      client_id: compose.clientId,
      matter_id: compose.matterId,
      name: `${compose.reference} — ${compose.titre}`,
      type: "Entente de service",
      category: "contract",
      uploaded_by: membre.fullName || membre.email || "Cabinet",
      uploaded_by_user_id: membre.userId,
      source: "cabinet",
      // Le cabinet produit cette pièce : elle n'a pas à passer par la file de
      // vérification qui existe pour ce que le client dépose.
      status: "valid",
      client_name: compose.contractantNom,
      mime_type: "application/pdf",
      size_bytes: compose.octets.byteLength,
      // Où signer, tel que le générateur vient de le mesurer. Sans ces
      // repères, la signature ne pourrait être qu'ajoutée en fin de document.
      signature_anchors: compose.emplacements.length > 0 ? compose.emplacements : null,
    })
    .select("id")
    .single()

  if (error || !doc) return { ok: false, message: error?.message ?? "Classement impossible." }

  const depot = await deposerOctets(sb, {
    firmId: membre.firmId,
    // Le client s'il existe, sinon le prospect : une entente peut précéder la
    // conversion, et son PDF doit exister dès ce moment-là.
    sousDossier: compose.clientId ?? compose.leadId ?? membre.firmId,
    documentId: String(doc.id),
    nom: nomFichier,
    octets: compose.octets,
    mime: "application/pdf",
  })

  if (!depot.ok) {
    // La fiche est retirée : un document qui s'affiche au dossier et ne s'ouvre
    // jamais est pire qu'un document absent.
    await sb.from("documents").delete().eq("id", doc.id)
    return { ok: false, message: depot.erreur ?? "Dépôt impossible." }
  }

  const { error: eMaj } = await sb
    .from("agreements")
    .update({ document_id: doc.id, status: "ready", issued_at: new Date().toISOString() })
    .eq("id", id)

  if (eMaj) return { ok: false, message: eMaj.message }

  return {
    ok: true,
    message: `${compose.reference} est émise et classée au dossier.`,
    documentId: String(doc.id),
    reference: compose.reference,
  }
}
