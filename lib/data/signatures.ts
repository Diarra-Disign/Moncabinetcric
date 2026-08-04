"use server"

import { headers } from "next/headers"
import { getSessionSupabase, getCurrentMember, getCurrentPortalClient } from "@/lib/supabase/session"

/**
 * Signature électronique.
 *
 * Ce module ne décide de presque rien : l'horodatage, l'empreinte du
 * document et le refus de signer un document modifié sont imposés par la
 * base. Une date de signature fournie par l'appelant serait antidatable,
 * une empreinte fournie n'attesterait que d'une déclaration.
 *
 * Le tracé manuscrit est conservé à titre illustratif. Ce qui fait preuve
 * est l'empreinte figée au moment de la signature : c'est elle qui permet
 * d'affirmer, plus tard, que le document produit est bien celui qui a été
 * signé.
 */

export interface ResultatSignature {
  ok: boolean
  erreur?: string
  signatureId?: string
  empreinte?: string
}

/** Adresse d'origine, telle que vue par le serveur. */
async function origine(): Promise<{ ip: string; agent: string }> {
  const h = await headers()
  return {
    // On retient la première adresse de la chaîne : les suivantes sont
    // celles des relais.
    ip: (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "",
    agent: h.get("user-agent") ?? "",
  }
}

/**
 * Ouvre une demande de signature sur un document.
 *
 * Fige l'empreinte du fichier au moment de l'envoi : si le document change
 * ensuite, la signature sera refusée plutôt que d'être apposée sur un
 * contenu différent de celui qui a été présenté.
 */
export async function demanderSignature(
  documentId: string,
  note?: string,
  joursValidite = 30
): Promise<{ ok: boolean; erreur?: string; requestId?: string }> {
  const membre = await getCurrentMember()
  if (!membre) return { ok: false, erreur: "Réservé aux membres du cabinet." }

  const supabase = await getSessionSupabase()

  const { data: doc } = await supabase
    .from("documents")
    .select("id, client_id, sha256, storage_path")
    .eq("id", documentId)
    .maybeSingle()

  if (!doc) return { ok: false, erreur: "Document introuvable." }
  if (!doc.storage_path || !doc.sha256) {
    return { ok: false, erreur: "Aucun fichier déposé : il n'y a rien à signer." }
  }

  const { data, error } = await supabase
    .from("signature_requests")
    .insert({
      firm_id: membre.firmId,
      document_id: documentId,
      client_id: doc.client_id,
      document_sha256: doc.sha256,
      requested_by: membre.userId,
      expires_at: new Date(Date.now() + joursValidite * 86400000).toISOString(),
      note: note ?? null,
    })
    .select("id")
    .single()

  if (error) return { ok: false, erreur: error.message }
  return { ok: true, requestId: data.id as string }
}

/**
 * Appose une signature.
 *
 * L'identité du signataire vient de la session, jamais des paramètres :
 * signer pour autrui doit être impossible, et la politique d'insertion
 * exige de surcroît que signer_user_id soit l'appelant.
 */
export async function signer(
  requestId: string,
  traceImage?: string
): Promise<ResultatSignature> {
  const membre = await getCurrentMember()
  const client = membre ? null : await getCurrentPortalClient()
  if (!membre && !client) return { ok: false, erreur: "Session absente." }

  const supabase = await getSessionSupabase()

  const { data: demande } = await supabase
    .from("signature_requests")
    .select("id, firm_id, document_id, status, expires_at")
    .eq("id", requestId)
    .maybeSingle()

  if (!demande) return { ok: false, erreur: "Demande introuvable." }
  if (demande.status !== "pending") {
    return { ok: false, erreur: "Cette demande n'est plus en attente." }
  }
  if (demande.expires_at && new Date(demande.expires_at as string) < new Date()) {
    return { ok: false, erreur: "Cette demande de signature a expiré." }
  }

  const { ip, agent } = await origine()

  // Ni signed_at ni document_sha256 ne sont transmis : le déclencheur les
  // impose, et refuse si le document a changé depuis la demande.
  const { data, error } = await supabase
    .from("signatures")
    .insert({
      request_id: requestId,
      firm_id: demande.firm_id,
      document_id: demande.document_id,
      signer_kind: membre ? "member" : "client",
      signer_user_id: membre?.userId ?? client!.userId,
      signer_name: membre?.fullName ?? client!.name,
      signer_email: membre?.email ?? client!.email,
      signer_role: membre?.ciccRole ?? "client",
      document_sha256: "imposé par la base",
      ip_address: ip,
      user_agent: agent,
      signature_image: traceImage ?? null,
    })
    .select("id, document_sha256")
    .single()

  if (error) {
    if (/déjà|duplicate|unique/i.test(error.message)) {
      return { ok: false, erreur: "Vous avez déjà signé ce document." }
    }
    return { ok: false, erreur: error.message }
  }

  return { ok: true, signatureId: data.id as string, empreinte: data.document_sha256 as string }
}

export interface LigneCertificat {
  signerName: string
  signerEmail: string
  signerKind: string
  signerRole: string | null
  rcicNumber: string | null
  signedAt: string
  ipAddress: string | null
  signedSha256: string
  currentSha256: string | null
  stillMatching: boolean
}

/**
 * Certificat de signature : qui a signé, quand, sur quelle empreinte, et si
 * le fichier actuel correspond toujours.
 *
 * `stillMatching` à faux ne signifie pas que la signature était invalide :
 * il signifie que le fichier a changé depuis. C'est exactement ce qu'il
 * faut pouvoir démontrer en cas de contestation.
 */
export async function certificat(documentId: string): Promise<LigneCertificat[]> {
  const supabase = await getSessionSupabase()
  const { data, error } = await supabase.rpc("signature_certificate", { doc_id: documentId })
  if (error || !data) return []

  return (data as Record<string, unknown>[]).map((r) => ({
    signerName: (r.signer_name as string) ?? "",
    signerEmail: (r.signer_email as string) ?? "",
    signerKind: (r.signer_kind as string) ?? "",
    signerRole: (r.signer_role as string) ?? null,
    rcicNumber: (r.rcic_number as string) ?? null,
    signedAt: (r.signed_at as string) ?? "",
    ipAddress: (r.ip_address as string) ?? null,
    signedSha256: (r.signed_sha256 as string) ?? "",
    currentSha256: (r.current_sha256 as string) ?? null,
    stillMatching: Boolean(r.still_matching),
  }))
}
