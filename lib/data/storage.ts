"use server"

import { createHash } from "node:crypto"
import { getSessionSupabase, getCurrentMember, getCurrentPortalClient } from "@/lib/supabase/session"
import { deposerOctets, BUCKET, type ResultatDepot } from "./depot"
import { messageErreur } from "@/lib/data/erreurs"

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

  const supabase = await getSessionSupabase()
  return deposerOctets(supabase, {
    firmId,
    sousDossier: clientId,
    documentId,
    nom: fichier.name,
    octets: new Uint8Array(await fichier.arrayBuffer()),
    mime: fichier.type,
  })
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
  if (error) return { erreur: messageErreur(error) }
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

  // Lecture forcée à la source. download() peut servir une copie mise en
  // cache : une vérification qui lit un cache ne détecte aucune
  // substitution, ce qui la rendrait pire qu'inutile — elle rassurerait à
  // tort. Constaté à l'essai, un fichier remplacé passait pour intact.
  const { data: signe, error: erreurLien } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(fiche.storage_path as string, 60)

  if (erreurLien || !signe?.signedUrl) {
    return { ok: false, message: `Fichier illisible : ${messageErreur(erreurLien)}` }
  }

  const reponse = await fetch(signe.signedUrl, { cache: "no-store" })
  if (!reponse.ok) {
    return { ok: false, message: `Fichier illisible : HTTP ${reponse.status}` }
  }

  const recalcule = createHash("sha256")
    .update(Buffer.from(await reponse.arrayBuffer()))
    .digest("hex")

  return recalcule === fiche.sha256
    ? { ok: true, message: "Le fichier est identique à celui qui a été déposé." }
    : { ok: false, message: "ALTÉRÉ : l'empreinte ne correspond plus au fichier déposé." }
}
