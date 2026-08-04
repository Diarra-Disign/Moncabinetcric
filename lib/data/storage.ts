"use server"

import { createHash } from "node:crypto"
import { getSessionSupabase, getCurrentMember, getCurrentPortalClient } from "@/lib/supabase/session"

/**
 * Dépôt et récupération des fichiers.
 *
 * Deux principes qui expliquent la forme de ce module.
 *
 * L'empreinte est calculée ici, sur le serveur, à partir des octets reçus.
 * Une empreinte fournie par le navigateur ne prouve rien : elle atteste
 * seulement de ce que le client a bien voulu déclarer. C'est elle qui
 * rendra une signature électronique opposable, la loi faisant dépendre
 * l'opposabilité de l'intégrité du document.
 *
 * Aucune requête ne filtre par cabinet. Les politiques du compartiment
 * comparent le premier segment du chemin à current_firm_id() : un oubli de
 * filtre ne peut pas ouvrir l'accès, la base refusant d'elle-même.
 */

const BUCKET = "documents"

/** Extensions acceptées, alignées sur les types du compartiment. */
const TYPES_ACCEPTES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
])

const TAILLE_MAX = 20 * 1024 * 1024

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
 * cette précaution, un client pourrait viser le dossier d'un autre en
 * nommant son fichier « ../autre-client/piece.pdf ».
 */
function nomSur(nom: string): string {
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
 * Dépose un fichier et renvoie son empreinte.
 *
 * `documentId` doit désigner une fiche existante : le fichier vient
 * s'attacher à une fiche, jamais l'inverse. On évite ainsi les fichiers
 * orphelins qu'aucun dossier ne référence.
 */
export async function deposerFichier(
  documentId: string,
  clientId: string,
  fichier: File
): Promise<ResultatDepot> {
  if (!TYPES_ACCEPTES.has(fichier.type)) {
    return { ok: false, erreur: `Type de fichier refusé : ${fichier.type || "inconnu"}.` }
  }
  if (fichier.size > TAILLE_MAX) {
    return { ok: false, erreur: `Fichier trop volumineux (maximum ${TAILLE_MAX / 1024 / 1024} Mo).` }
  }
  if (fichier.size === 0) {
    return { ok: false, erreur: "Fichier vide." }
  }

  // Le cabinet vient de la session, jamais d'un paramètre : un identifiant
  // de cabinet transmis par l'appelant serait modifiable.
  const membre = await getCurrentMember()
  const client = membre ? null : await getCurrentPortalClient()
  const firmId = membre?.firmId ?? client?.firmId
  if (!firmId) return { ok: false, erreur: "Session absente." }

  // Un client ne dépose que dans son propre dossier.
  if (client && client.clientId !== clientId) {
    return { ok: false, erreur: "Dépôt refusé." }
  }

  const octets = Buffer.from(await fichier.arrayBuffer())
  const sha256 = createHash("sha256").update(octets).digest("hex")

  const chemin = `${firmId}/${clientId}/${documentId}/${nomSur(fichier.name)}`
  const supabase = await getSessionSupabase()

  const { error } = await supabase.storage.from(BUCKET).upload(chemin, octets, {
    contentType: fichier.type,
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
  const { error: majErreur } = await supabase
    .from("documents")
    .update({
      storage_path: chemin,
      sha256,
      mime_type: fichier.type,
      size_bytes: fichier.size,
    })
    .eq("id", documentId)

  if (majErreur) {
    // La fiche n'a pas suivi : on retire le fichier pour ne pas laisser un
    // dépôt que rien ne référence.
    await supabase.storage.from(BUCKET).remove([chemin])
    return { ok: false, erreur: majErreur.message }
  }

  return { ok: true, sha256, chemin, taille: fichier.size }
}

/**
 * URL de téléchargement, valable une heure.
 *
 * Signée et non publique : le compartiment reste fermé, et le lien expire.
 * Un lien permanent circulerait par courriel bien après que l'accès aurait
 * dû être retiré.
 */
export async function lienTelechargement(
  chemin: string,
  secondes = 3600
): Promise<{ url?: string; erreur?: string }> {
  const supabase = await getSessionSupabase()
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(chemin, secondes)
  if (error) return { erreur: error.message }
  return { url: data.signedUrl }
}

/**
 * Recalcule l'empreinte du fichier déposé et la compare à celle enregistrée.
 *
 * C'est la vérification que l'interface annonçait sans la faire. Elle
 * répond à une seule question : le fichier est-il encore celui qui a été
 * déposé ?
 */
export async function verifierEmpreinte(
  documentId: string
): Promise<{ ok: boolean; message: string }> {
  const supabase = await getSessionSupabase()

  const { data: fiche } = await supabase
    .from("documents")
    .select("storage_path, sha256, name")
    .eq("id", documentId)
    .maybeSingle()

  if (!fiche?.storage_path) return { ok: false, message: "Aucun fichier déposé pour cette pièce." }
  if (!fiche.sha256) return { ok: false, message: "Aucune empreinte enregistrée." }

  const { data: blob, error } = await supabase.storage
    .from(BUCKET)
    .download(fiche.storage_path as string)
  if (error || !blob) return { ok: false, message: `Fichier illisible : ${error?.message ?? ""}` }

  const recalcule = createHash("sha256")
    .update(Buffer.from(await blob.arrayBuffer()))
    .digest("hex")

  return recalcule === fiche.sha256
    ? { ok: true, message: "Le fichier est identique à celui qui a été déposé." }
    : { ok: false, message: "ALTÉRÉ : l'empreinte ne correspond plus au fichier déposé." }
}
