"use server"

import { getSessionSupabase, getCurrentMember, getCurrentPortalClient } from "@/lib/supabase/session"
import { sonTour, type StatutDemande, type StatutDestinataire, type ModeSignature } from "@/lib/signature/statuts"

/**
 * Ce que le cabinet voit de ses signatures.
 *
 * ─── CE MODULE NE SAIT PLUS ÉCRIRE, ET C'EST VOULU ─────────────────────────
 *
 * Il ne fait que LIRE. Créer une demande ou apposer une signature passe
 * désormais par `SignatureService` — un seul écrivain sur `signature_requests`.
 *
 * Avant, deux chemins y écrivaient : celui-ci, hérité, et le module de
 * signature. Le premier insérait une demande NUE — sans destinataire, sans
 * champ, sans jeton, sans verrou et sans courriel. Le bouton « Envoyer pour
 * signature » des ententes empruntait ce chemin : il créait une ligne que
 * personne ne pouvait ni recevoir ni signer.
 *
 * ─── ET IL NE CHERCHE PLUS « pending » ─────────────────────────────────────
 *
 * Le second défaut tenait en un mot. Le vocabulaire des statuts a changé quand
 * le module est arrivé : `pending` n'existe plus. Cette fonction le cherchait
 * toujours, donc ne trouvait RIEN — et tous les documents tombaient dans le
 * cas par défaut, « prêts à envoyer ». D'où un écran qui montrait des dizaines
 * de documents prétendument prêts et une section « à signer par vous »
 * structurellement vide.
 *
 * Les sections sont maintenant déduites de l'état RÉEL de la demande et de ses
 * destinataires. Aucune ne repose sur la simple existence d'un fichier.
 */

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

export interface DestinataireLigne {
  id: string
  nom: string
  courriel: string
  role: string
  rang: number
  statut: StatutDestinataire
  envoyeLe: string | null
  signeLe: string | null
  /** Est-ce à cette personne de signer maintenant ? */
  sonTour: boolean
}

export interface LigneTableau {
  demandeId: string
  documentId: string
  documentName: string
  clientName: string | null
  matterId: string | null
  statut: StatutDemande
  requestedAt: string | null
  /** Date d'envoi au premier destinataire, quand elle existe. */
  sentAt: string | null
  expiresAt: string | null
  destinataires: DestinataireLigne[]
  signatures: LigneCertificat[]
  /** Le document signé, une fois la demande complète. */
  documentSigneId: string | null
  /** L'appelant est-il le destinataire attendu, maintenant ? */
  monTour: boolean
  /** L'appelant a-t-il déjà signé cette demande ? */
  dejaSigne: boolean
  /** Un fichier a changé depuis qu'il a été signé. */
  divergence: boolean
}

export interface TableauSignatures {
  /** Demandes préparées mais pas encore parties. */
  pretsAEnvoyer: LigneTableau[]
  /** C'est à l'appelant de signer, maintenant. */
  aSigner: LigneTableau[]
  /** Parties, en attente de quelqu'un d'autre. */
  enAttenteDAutrui: LigneTableau[]
  signes: LigneTableau[]
  refuses: LigneTableau[]
  /** Annulées ou expirées : closes sans signature. */
  closes: LigneTableau[]
}

const VIDE: TableauSignatures = {
  pretsAEnvoyer: [], aSigner: [], enAttenteDAutrui: [],
  signes: [], refuses: [], closes: [],
}

interface DestinataireBrut {
  id: string
  full_name: string | null
  email: string | null
  role: string | null
  rank: number | null
  status: string | null
  sent_at: string | null
  signed_at: string | null
}

/**
 * Vue d'ensemble des signatures du cabinet, ou du client.
 *
 * LES SECTIONS SONT CALCULÉES, PAS STOCKÉES. Aucune colonne ne dit « ceci va
 * dans À signer par vous » : cela se déduit du statut de la demande, du rang
 * des destinataires et de qui appelle. Une colonne de plus se serait
 * désynchronisée dès la première signature apposée hors de cet écran.
 */
export async function tableauSignatures(): Promise<TableauSignatures> {
  const membre = await getCurrentMember()
  const client = membre ? null : await getCurrentPortalClient()
  if (!membre && !client) return VIDE

  const monCourriel = (membre?.email ?? client?.email ?? "").trim().toLowerCase()
  const supabase = await getSessionSupabase()

  // LA CLÉ ÉTRANGÈRE EST NOMMÉE : `signature_requests` pointe deux fois vers
  // `documents` — le document envoyé, et le document signé qui en naît.
  // Sans le nom, PostgREST refuse la jointure comme ambiguë et rend null.
  const { data, error } = await supabase
    .from("signature_requests")
    .select(
      "id, status, signing_mode, requested_at, expires_at, signed_document_id, " +
      "documents!signature_requests_document_id_fkey(id, name, client_name, matter_id, sha256), " +
      "signature_recipients(id, full_name, email, role, rank, status, sent_at, signed_at)"
    )
    .order("requested_at", { ascending: false })
    .limit(200)

  // Une erreur de requête ne doit pas se déguiser en « rien à afficher ».
  if (error) {
    console.error("tableauSignatures :", error.message)
    return VIDE
  }

  const lignes = (data ?? []) as unknown as {
    id: string
    status: string
    signing_mode: string | null
    requested_at: string | null
    expires_at: string | null
    signed_document_id: string | null
    documents: { id: string; name: string | null; client_name: string | null; matter_id: string | null; sha256: string | null } | null
    signature_recipients: DestinataireBrut[] | null
  }[]

  if (lignes.length === 0) return VIDE

  // Les signatures apposées, pour le certificat et la détection de divergence.
  const { data: sigs } = await supabase
    .from("signatures")
    .select("request_id, signer_name, signer_email, signer_kind, signer_role, rcic_number, signed_at, ip_address, document_sha256")
    .in("request_id", lignes.map((l) => l.id))

  const resultat: TableauSignatures = {
    pretsAEnvoyer: [], aSigner: [], enAttenteDAutrui: [],
    signes: [], refuses: [], closes: [],
  }

  for (const l of lignes) {
    const doc = l.documents
    const mode = (l.signing_mode ?? "sequential") as ModeSignature
    const bruts = l.signature_recipients ?? []
    const etats = bruts.map((r) => ({ rank: Number(r.rank ?? 1), status: String(r.status ?? "pending") }))

    const destinataires: DestinataireLigne[] = bruts
      .map((r) => ({
        id: String(r.id),
        nom: String(r.full_name ?? ""),
        courriel: String(r.email ?? ""),
        role: String(r.role ?? ""),
        rang: Number(r.rank ?? 1),
        statut: String(r.status ?? "pending") as StatutDestinataire,
        envoyeLe: r.sent_at,
        signeLe: r.signed_at,
        // Même règle que la base et que le fournisseur : trois populations,
        // un seul verdict. Voir `signature_recalculer_demande()`.
        sonTour: sonTour(etats, Number(r.rank ?? 1), mode),
      }))
      .sort((a, b) => a.rang - b.rang)

    const propres: LigneCertificat[] = (sigs ?? [])
      .filter((s) => s.request_id === l.id)
      .map((s) => ({
        signerName: String(s.signer_name ?? ""),
        signerEmail: String(s.signer_email ?? ""),
        signerKind: String(s.signer_kind ?? ""),
        signerRole: (s.signer_role as string) ?? null,
        rcicNumber: (s.rcic_number as string) ?? null,
        signedAt: String(s.signed_at ?? ""),
        ipAddress: (s.ip_address as string) ?? null,
        signedSha256: String(s.document_sha256 ?? ""),
        currentSha256: doc?.sha256 ?? null,
        stillMatching: s.document_sha256 === doc?.sha256,
      }))

    // MON TOUR SE RECONNAÎT AU COURRIEL, pas au rôle. Dans un cabinet de trois
    // consultants, filtrer sur « role = consultant » montrerait à chacun les
    // signatures des deux autres — et les inviterait à signer à leur place.
    const moi = destinataires.find((r) => r.courriel.trim().toLowerCase() === monCourriel)

    const ligne: LigneTableau = {
      demandeId: String(l.id),
      documentId: String(doc?.id ?? ""),
      documentName: String(doc?.name ?? ""),
      clientName: doc?.client_name ?? null,
      matterId: doc?.matter_id ?? null,
      statut: String(l.status) as StatutDemande,
      requestedAt: l.requested_at,
      sentAt: destinataires.find((r) => r.envoyeLe)?.envoyeLe ?? null,
      expiresAt: l.expires_at,
      destinataires,
      signatures: propres,
      documentSigneId: l.signed_document_id,
      monTour: Boolean(moi && moi.statut === "pending" && moi.sonTour),
      dejaSigne: Boolean(moi && moi.statut === "signed"),
      divergence: propres.some((s) => !s.stillMatching),
    }

    switch (ligne.statut) {
      case "draft":
      case "ready":
        resultat.pretsAEnvoyer.push(ligne)
        break
      case "sent":
      case "viewed":
      case "partially_signed":
        // C'est le seul aiguillage qui dépend de QUI regarde.
        if (ligne.monTour) resultat.aSigner.push(ligne)
        else resultat.enAttenteDAutrui.push(ligne)
        break
      case "completed":
        resultat.signes.push(ligne)
        break
      case "declined":
        resultat.refuses.push(ligne)
        break
      default:
        resultat.closes.push(ligne)
    }
  }

  return resultat
}

export interface EtatSignatureDocument {
  demandeId: string | null
  statut: StatutDemande | null
  expiresAt: string | null
  destinataires: DestinataireLigne[]
  signatures: LigneCertificat[]
  documentSigneId: string | null
  /** Le document porte-t-il un fichier ? Sans fichier, rien à signer. */
  fichierPresent: boolean
  divergence: boolean
}

/**
 * L'état de signature d'UN document, pour l'afficher à côté de sa fiche.
 *
 * EN LECTURE SEULE. L'envoi se fait depuis l'onglet Signature du dossier ou
 * depuis l'entente de service, parce qu'il faut y désigner des signataires —
 * ce qu'une vignette au bord d'une fiche ne peut pas faire correctement.
 */
export async function etatSignatureDocument(documentId: string): Promise<EtatSignatureDocument> {
  const supabase = await getSessionSupabase()

  const [{ data: doc }, { data: demandes }] = await Promise.all([
    supabase.from("documents").select("sha256, storage_path").eq("id", documentId).maybeSingle(),
    supabase
      .from("signature_requests")
      .select(
        "id, status, signing_mode, expires_at, signed_document_id, " +
        "signature_recipients(id, full_name, email, role, rank, status, sent_at, signed_at)"
      )
      .eq("document_id", documentId)
      .order("requested_at", { ascending: false })
      .limit(1),
  ])

  const vide: EtatSignatureDocument = {
    demandeId: null, statut: null, expiresAt: null, destinataires: [],
    signatures: [], documentSigneId: null,
    fichierPresent: Boolean(doc?.storage_path && doc?.sha256),
    divergence: false,
  }

  const l = (demandes ?? [])[0] as unknown as {
    id: string
    status: string
    signing_mode: string | null
    expires_at: string | null
    signed_document_id: string | null
    signature_recipients: DestinataireBrut[] | null
  } | undefined

  const signatures = await certificat(documentId)
  if (!l) return { ...vide, signatures, divergence: signatures.some((s) => !s.stillMatching) }

  const mode = (l.signing_mode ?? "sequential") as ModeSignature
  const bruts = l.signature_recipients ?? []
  const etats = bruts.map((r) => ({ rank: Number(r.rank ?? 1), status: String(r.status ?? "pending") }))

  return {
    demandeId: String(l.id),
    statut: String(l.status) as StatutDemande,
    expiresAt: l.expires_at,
    destinataires: bruts
      .map((r) => ({
        id: String(r.id),
        nom: String(r.full_name ?? ""),
        courriel: String(r.email ?? ""),
        role: String(r.role ?? ""),
        rang: Number(r.rank ?? 1),
        statut: String(r.status ?? "pending") as StatutDestinataire,
        envoyeLe: r.sent_at,
        signeLe: r.signed_at,
        sonTour: sonTour(etats, Number(r.rank ?? 1), mode),
      }))
      .sort((a, b) => a.rang - b.rang),
    signatures,
    documentSigneId: l.signed_document_id,
    fichierPresent: Boolean(doc?.storage_path && doc?.sha256),
    divergence: signatures.some((s) => !s.stillMatching),
  }
}
