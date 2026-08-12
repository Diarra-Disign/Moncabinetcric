import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Les versions d'un document, et le geste « annuler et reprendre ».
 *
 * ─── POURQUOI CE MODULE EXISTE ─────────────────────────────────────────────
 *
 * Le verrou posé en base empêche de modifier un document envoyé en signature.
 * Seul, il serait une impasse : le consultant qui découvre une faute dans un
 * contrat parti en signature n'aurait plus aucun geste possible.
 *
 * La sortie est une NOUVELLE VERSION qui désigne la précédente. Les deux
 * coexistent : l'ancienne reste, verrouillée, avec ce qui a pu être signé
 * dessus ; la nouvelle repart libre. On ne perd rien et on ne réécrit rien.
 *
 * ─── CE QUE CE MODULE NE FAIT PAS ──────────────────────────────────────────
 *
 * Il ne recopie PAS le fichier. La nouvelle version naît sans contenu, et
 * c'est ce qui la produit — la réémission d'une entente, un nouveau dépôt —
 * qui le lui donne. Recopier l'ancien fichier créerait une version identique
 * à la précédente, qu'on croirait corrigée.
 *
 * Séparé de la session pour la même raison que partout ailleurs dans ce
 * projet : ce qu'aucune épreuve ne peut appeler n'est vérifié qu'en
 * production.
 */

export interface ResultatVersion {
  ok: boolean
  message: string
  documentId?: string
  version?: number
}

/**
 * Verrouille un document au moment où il part en signature.
 *
 * Passe par la fonction de la base plutôt que par un UPDATE : le jour où un
 * second chemin enverra un document en signature, il ne pourra pas oublier de
 * verrouiller.
 */
export async function verrouiller(
  sb: SupabaseClient,
  documentId: string
): Promise<boolean> {
  const { data, error } = await sb.rpc("verrouiller_document", { p_document_id: documentId })
  if (error) return false
  return data === true
}

/**
 * Crée la version suivante d'un document verrouillé.
 *
 * LES DEMANDES EN COURS SONT ANNULÉES D'ABORD, et ce n'est pas une politesse :
 * laisser vivre l'ancien lien pendant qu'une nouvelle version circule
 * permettrait à un client de signer la version périmée. Les liens des
 * destinataires sont révoqués dans le même geste — un jeton révoqué n'ouvre
 * plus rien, la base le vérifie.
 */
export async function nouvelleVersion(
  sb: SupabaseClient,
  membre: { firmId: string; fullName?: string; email?: string },
  documentId: string,
  motif?: string
): Promise<ResultatVersion> {
  try {
    const { data: source } = await sb
      .from("documents")
      .select("id, firm_id, client_id, matter_id, requirement_id, name, type, category, doc_type, client_name, version, locked_at")
      .eq("id", documentId)
      .maybeSingle()

    if (!source) return { ok: false, message: "Ce document est introuvable." }

    // Un document jamais verrouillé se corrige directement : lui fabriquer une
    // version serait un empilement inutile, et la chaîne des versions perdrait
    // son sens si elle comptait aussi les brouillons.
    if (!source.locked_at) {
      return {
        ok: false,
        message: "Ce document n'a pas été envoyé en signature : modifiez-le directement.",
      }
    }

    // ── 1. Refermer ce qui vit encore sur l'ancienne version ────────────────
    const { data: demandes } = await sb
      .from("signature_requests")
      .select("id, status")
      .eq("document_id", documentId)
      .not("status", "in", "(completed,cancelled,declined,expired)")

    for (const d of demandes ?? []) {
      await sb
        .from("signature_requests")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          note: motif
            ? `Annulée : nouvelle version du document. ${motif}`
            : "Annulée : nouvelle version du document.",
        })
        .eq("id", d.id)

      // Les liens meurent avec la demande. Sans cela, un destinataire pourrait
      // encore signer la version périmée.
      await sb
        .from("signature_recipients")
        .update({ revoked_at: new Date().toISOString() })
        .eq("request_id", d.id)
        .is("revoked_at", null)
    }

    // ── 2. La version suivante ──────────────────────────────────────────────
    const versionSuivante = Number(source.version ?? 1) + 1

    const { data: neuf, error } = await sb
      .from("documents")
      .insert({
        firm_id: source.firm_id,
        client_id: source.client_id,
        matter_id: source.matter_id,
        requirement_id: source.requirement_id,
        // Le nom ne porte PAS le numéro de version : il est déjà dans la
        // colonne, et deux sources pour un même nombre finissent par diverger.
        name: source.name,
        type: source.type,
        category: source.category,
        doc_type: source.doc_type,
        client_name: source.client_name,
        uploaded_by: membre.fullName || membre.email || "Cabinet",
        source: "cabinet",
        status: "valid",
        version: versionSuivante,
        supersedes_id: documentId,
        // Ni fichier ni empreinte : c'est ce qui produira cette version qui les
        // lui donnera. Une copie de l'ancien fichier passerait pour une
        // correction.
      })
      .select("id")
      .single()

    if (error || !neuf) return { ok: false, message: error?.message ?? "Création impossible." }

    return {
      ok: true,
      message: `Version ${versionSuivante} créée. La précédente reste au dossier, verrouillée.`,
      documentId: String(neuf.id),
      version: versionSuivante,
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

export interface VersionDocument {
  id: string
  version: number
  nom: string
  verrouilleLe: string | null
  creeLe: string
  sha256: string | null
}

/**
 * La chaîne des versions d'un document, de la première à la dernière.
 *
 * Remonte par `supersedes_id` plutôt que de descendre : on part toujours de la
 * version qu'on a sous les yeux, et c'est son passé qu'on veut lire.
 */
export async function chaineDesVersions(
  sb: SupabaseClient,
  documentId: string,
  profondeurMax = 20
): Promise<VersionDocument[]> {
  const chaine: VersionDocument[] = []
  let courant: string | null = documentId

  while (courant && chaine.length < profondeurMax) {
    // Le type est annoté explicitement : la boucle réaffecte `courant` depuis
    // sa propre lecture, et TypeScript refuse d'inférer un type qui dépend de
    // lui-même.
    const { data } = (await sb
      .from("documents")
      .select("id, version, name, locked_at, created_at, sha256, supersedes_id")
      .eq("id", courant)
      .maybeSingle()) as { data: Record<string, unknown> | null }
    if (!data) break

    chaine.push({
      id: String(data.id),
      version: Number(data.version ?? 1),
      nom: String(data.name ?? ""),
      verrouilleLe: data.locked_at ? String(data.locked_at) : null,
      creeLe: String(data.created_at ?? ""),
      sha256: data.sha256 ? String(data.sha256) : null,
    })
    courant = data.supersedes_id ? String(data.supersedes_id) : null
  }

  return chaine.reverse()
}
