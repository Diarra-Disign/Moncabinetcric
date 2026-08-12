import "server-only"

import { createHash } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Le geste de dépôt, séparé de la session.
 *
 * Il vivait dans `storage.ts`, qui est un module « use server » : tout y passe
 * par `getCurrentMember()` et `headers()`, donc rien n'y est appelable hors
 * d'une requête. Tant que seul le navigateur déposait des fichiers, cela
 * suffisait. Une entente de service, elle, est produite PAR LE SERVEUR : le
 * PDF n'arrive d'aucun formulaire, et son classement devait pouvoir s'éprouver
 * autrement qu'en production.
 *
 * Ce fichier ne décide de rien sur les droits. Le cabinet et le sous-dossier
 * lui sont DONNÉS, jamais devinés — c'est l'appelant qui les tient de la
 * session — et la politique du compartiment compare de toute façon le premier
 * segment du chemin à `current_firm_id()`. Un appelant qui mentirait sur le
 * cabinet se verrait refuser par la base, pas par ce module.
 */

export const BUCKET = "documents"

/**
 * Types acceptés, alignés sur la contrainte du compartiment.
 *
 * Ce contrôle-ci ne fait que donner un message clair : le verrou réel est en
 * base, sur le compartiment, et s'applique même à un appel direct de l'API qui
 * contournerait cette application.
 */
export const TYPES_ACCEPTES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  // Format par défaut des iPhone.
  "image/heic",
])

export const TAILLE_MAX = 20 * 1024 * 1024

export interface ResultatDepot {
  ok: boolean
  erreur?: string
  sha256?: string
  chemin?: string
  taille?: number
}

/**
 * Nettoie un nom de fichier avant de l'employer dans un chemin.
 *
 * Un nom venu du navigateur peut contenir des séparateurs ou « .. » : sans
 * cette précaution, un client pourrait viser le dossier d'un autre en nommant
 * son fichier « ../autre-client/piece.pdf ».
 */
export function nomSur(nom: string): string {
  return (
    nom
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w.\- ]+/g, "_")
      .replace(/\.{2,}/g, ".")
      .slice(0, 120) || "fichier"
  )
}

/**
 * Dépose des octets et attache l'empreinte à la fiche.
 *
 * L'empreinte est calculée ICI, sur les octets réellement déposés. Une
 * empreinte fournie par l'appelant n'attesterait que d'une déclaration — et
 * c'est elle qui rendra une signature électronique opposable, la loi faisant
 * dépendre l'opposabilité de l'intégrité du document.
 *
 * `documentId` doit désigner une fiche existante : le fichier vient s'attacher
 * à une fiche, jamais l'inverse. On évite ainsi les fichiers orphelins qu'aucun
 * dossier ne référence.
 */
export async function deposerOctets(
  sb: SupabaseClient,
  depot: {
    firmId: string
    /** Deuxième segment du chemin : le client, ou le prospect à défaut. */
    sousDossier: string
    documentId: string
    nom: string
    octets: Uint8Array
    mime: string
  }
): Promise<ResultatDepot> {
  if (!TYPES_ACCEPTES.has(depot.mime)) {
    return { ok: false, erreur: `Type de fichier refusé : ${depot.mime || "inconnu"}.` }
  }
  if (depot.octets.byteLength > TAILLE_MAX) {
    return { ok: false, erreur: `Fichier trop volumineux (maximum ${TAILLE_MAX / 1024 / 1024} Mo).` }
  }
  if (depot.octets.byteLength === 0) return { ok: false, erreur: "Fichier vide." }

  const octets = Buffer.from(depot.octets)
  const sha256 = createHash("sha256").update(octets).digest("hex")
  const chemin = `${depot.firmId}/${depot.sousDossier}/${depot.documentId}/${nomSur(depot.nom)}`

  const { error } = await sb.storage.from(BUCKET).upload(chemin, octets, {
    contentType: depot.mime,
    // Sans cette consigne, une vérification d'intégrité ultérieure pourrait
    // lire une copie en cache et conclure à tort que le fichier est intact.
    cacheControl: "no-store",
    // Pas d'écrasement : une pièce remplacée doit laisser une trace, et le
    // client n'a de toute façon pas le droit de mettre à jour.
    upsert: false,
  })

  if (error) {
    return {
      ok: false,
      erreur: /exists/i.test(error.message)
        ? "Un fichier porte déjà ce nom pour cette pièce."
        : error.message,
    }
  }

  // La fiche ne porte l'empreinte qu'une fois le fichier réellement déposé :
  // l'inverse laisserait croire à un contenu vérifié qui n'existe pas.
  const { error: majErreur } = await sb
    .from("documents")
    .update({
      storage_path: chemin,
      sha256,
      mime_type: depot.mime,
      size_bytes: depot.octets.byteLength,
    })
    .eq("id", depot.documentId)

  if (majErreur) {
    // La fiche n'a pas suivi : on retire le fichier pour ne pas laisser un
    // dépôt que rien ne référence.
    await sb.storage.from(BUCKET).remove([chemin])
    return { ok: false, erreur: majErreur.message }
  }

  return { ok: true, sha256, chemin, taille: depot.octets.byteLength }
}
