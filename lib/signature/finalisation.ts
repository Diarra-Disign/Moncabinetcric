import "server-only"

import { createHash } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { deposerOctets } from "@/lib/data/depot"
import {
  documentAvecCertificat,
  type DonneesCertificat, type AppositionSignature,
} from "./certificat"
import { nomDocumentSigne, LIBELLE_EVENEMENT, type EvenementSignature } from "./statuts"
import { journaliser } from "./evenements"
import type { ContexteSignature } from "./contrat"

/**
 * La finalisation : produire le document signé et le classer.
 *
 * ─── QUAND ─────────────────────────────────────────────────────────────────
 *
 * Une seule fois, quand la demande passe à « completed ». L'appel est
 * IDEMPOTENT : si le document existe déjà, on le rend sans rien refaire. Deux
 * signataires qui terminent à quelques secondes d'intervalle ne doivent pas
 * produire deux documents signés portant deux empreintes différentes.
 *
 * ─── CE QUI EST CLASSÉ ─────────────────────────────────────────────────────
 *
 * Une ligne de `documents` de plus, qui REMPLACE l'originale par
 * `supersedes_id` — la chaîne des versions continue. Elle est verrouillée dès
 * sa naissance : un document signé ne se modifie pas.
 *
 * Le fichier n'est PAS le même que l'original : il porte le certificat en
 * plus. Son empreinte est donc différente, et c'est normal — celle qui fait
 * preuve est celle de l'original, imprimée DANS le certificat.
 */

export interface ResultatFinalisation {
  ok: boolean
  message: string
  documentId?: string
  dejaFait?: boolean
}

export async function finaliser(
  sb: SupabaseClient,
  ctx: ContexteSignature,
  requestId: string
): Promise<ResultatFinalisation> {
  try {
    const { data: demande } = await sb
      .from("signature_requests")
      .select("id, firm_id, status, document_id, client_id, signed_document_id, document_sha256")
      .eq("id", requestId)
      .maybeSingle()

    if (!demande) return { ok: false, message: "Cette demande est introuvable." }
    if (demande.signed_document_id) {
      return {
        ok: true, dejaFait: true,
        documentId: String(demande.signed_document_id),
        message: "Le document signé existe déjà.",
      }
    }
    if (demande.status !== "completed") {
      return {
        ok: false,
        message: "Toutes les signatures attendues ne sont pas apposées : rien à finaliser.",
      }
    }

    // ── Le document d'origine ──────────────────────────────────────────────
    const { data: doc } = await sb
      .from("documents")
      .select("id, name, storage_path, sha256, matter_id, client_id, type, doc_type, client_name, version")
      .eq("id", demande.document_id)
      .maybeSingle()
    if (!doc?.storage_path) return { ok: false, message: "Le document d'origine est introuvable." }

    const { data: signe } = await sb.storage
      .from("documents").createSignedUrl(String(doc.storage_path), 120)
    if (!signe?.signedUrl) return { ok: false, message: "Le fichier d'origine est illisible." }

    const reponse = await fetch(signe.signedUrl, { cache: "no-store" })
    if (!reponse.ok) return { ok: false, message: "Le fichier d'origine n'a pas pu être lu." }
    const octetsOriginal = new Uint8Array(await reponse.arrayBuffer())

    // ── Ce que le certificat doit dire ─────────────────────────────────────
    const [{ data: signatures }, { data: journal }, { data: firm }, { data: destinataires }, { data: champs }] =
      await Promise.all([
        sb.from("signatures")
          .select("signer_name, signer_email, signer_role, rcic_number, signed_at, ip_address, signature_image")
          .eq("request_id", requestId).order("signed_at"),
        sb.from("audit_logs")
          .select("action, occurred_at, actor_name")
          .eq("entity_type", "signature_request").eq("entity_id", requestId)
          .order("occurred_at"),
        sb.from("firms").select("name, rcic_license_number").eq("id", demande.firm_id).maybeSingle(),
        sb.from("signature_recipients")
          .select("id, email, full_name").eq("request_id", requestId),
        sb.from("signature_fields")
          .select("recipient_id, kind, page, pos_x, pos_y, width, height")
          .eq("request_id", requestId),
      ])

    const donnees: DonneesCertificat = {
      documentNom: String(doc.name ?? ""),
      reference: requestId,
      // L'EMPREINTE DE L'ORIGINAL, celle qui a été signée — pas celle du
      // fichier qu'on est en train de produire.
      empreinte: String(doc.sha256 ?? demande.document_sha256 ?? ""),
      cabinetNom: String(firm?.name ?? ""),
      cabinetPermis: String(firm?.rcic_license_number ?? ""),
      signataires: (signatures ?? []).map((s) => ({
        nom: String(s.signer_name ?? ""),
        courriel: String(s.signer_email ?? ""),
        role: String(s.signer_role ?? ""),
        permis: s.rcic_number ? String(s.rcic_number) : null,
        signeLe: String(s.signed_at ?? ""),
        ip: s.ip_address ? String(s.ip_address) : null,
        trace: s.signature_image ? String(s.signature_image) : null,
      })),
      evenements: (journal ?? []).map((e) => ({
        libelle: LIBELLE_EVENEMENT[String(e.action) as EvenementSignature] ?? String(e.action),
        survenuLe: String(e.occurred_at ?? ""),
        acteur: String(e.actor_name ?? "Système"),
      })),
      apposer: aApposer(signatures ?? [], destinataires ?? [], champs ?? []),
    }

    const octetsFinal = await documentAvecCertificat(octetsOriginal, donnees)

    // ── Le classement ──────────────────────────────────────────────────────
    const premier = donnees.signataires[0]?.nom ?? ""
    const nomFichier = nomDocumentSigne(String(doc.name ?? "Document").replace(/\.pdf$/i, ""), premier)

    const { data: neuf, error } = await sb
      .from("documents")
      .insert({
        firm_id: demande.firm_id,
        client_id: doc.client_id ?? demande.client_id ?? null,
        matter_id: doc.matter_id ?? null,
        name: nomFichier,
        type: String(doc.type ?? "Document signé"),
        category: "contract",
        doc_type: doc.doc_type ?? null,
        client_name: doc.client_name ?? null,
        uploaded_by: ctx.fullName || ctx.email || "Système",
        source: "cabinet",
        status: "valid",
        version: Number(doc.version ?? 1) + 1,
        supersedes_id: doc.id,
        mime_type: "application/pdf",
        size_bytes: octetsFinal.byteLength,
      })
      .select("id")
      .single()

    if (error || !neuf) return { ok: false, message: error?.message ?? "Classement impossible." }

    const depot = await deposerOctets(sb, {
      firmId: String(demande.firm_id),
      sousDossier: String(doc.client_id ?? demande.client_id ?? demande.firm_id),
      documentId: String(neuf.id),
      nom: nomFichier,
      octets: octetsFinal,
      mime: "application/pdf",
    })

    if (!depot.ok) {
      // Une fiche sans fichier s'afficherait au dossier et ne s'ouvrirait
      // jamais : pire qu'une pièce absente.
      await sb.from("documents").delete().eq("id", neuf.id)
      return { ok: false, message: depot.erreur ?? "Dépôt impossible." }
    }

    // Verrouillé dès sa naissance. Un document signé ne se modifie pas — et
    // celui-ci porte les signatures.
    await sb.rpc("verrouiller_document", { p_document_id: neuf.id })

    await sb
      .from("signature_requests")
      .update({ signed_document_id: neuf.id })
      .eq("id", requestId)

    await journaliser(sb, ctx, {
      requestId,
      evenement: "signature.document.created",
      details: { document_signe: String(neuf.id), empreinte: depot.sha256 },
    })

    return {
      ok: true,
      documentId: String(neuf.id),
      message: `${nomFichier} classé au dossier.`,
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

/**
 * Relie chaque signature apposée à l'emplacement qui lui revient dans le
 * contrat.
 *
 * ─── LE COURRIEL EST LA CHARNIÈRE ──────────────────────────────────────────
 *
 * `signatures` retient qui a signé — nom, courriel, tracé, horodatage.
 * `signature_fields` retient où signer, par destinataire. Le courriel est ce
 * que les deux tables partagent : il est unique par destinataire au sein d'une
 * demande, et c'est déjà lui qui autorise la signature côté base.
 *
 * ─── SANS EMPLACEMENT, RIEN N'EST POSÉ ─────────────────────────────────────
 *
 * Un PDF téléversé n'a pas d'encadré connu : ses champs naissent sans
 * coordonnées, `page` est nul, et le signataire n'apparaît alors que sur le
 * certificat. C'est le comportement d'avant cette amélioration, et il reste le
 * bon — une signature posée au jugé sur un document inconnu serait pire que
 * pas de signature du tout.
 */
function aApposer(
  signatures: Record<string, unknown>[],
  destinataires: Record<string, unknown>[],
  champs: Record<string, unknown>[]
): AppositionSignature[] {
  const parCourriel = new Map(
    destinataires.map((d) => [String(d.email ?? "").trim().toLowerCase(), String(d.id)])
  )

  const sorties: AppositionSignature[] = []
  for (const s of signatures) {
    const destinataireId = parCourriel.get(String(s.signer_email ?? "").trim().toLowerCase())
    if (!destinataireId) continue

    const siens = champs.filter((c) => String(c.recipient_id) === destinataireId)
    const trace = siens.find((c) => c.kind === "signature" && c.page !== null)
    const date = siens.find((c) => c.kind === "date" && c.page !== null)
    if (!trace && !date) continue

    const page = Number((trace ?? date)!.page)
    sorties.push({
      nom: String(s.signer_name ?? ""),
      signeLe: String(s.signed_at ?? ""),
      trace: s.signature_image ? String(s.signature_image) : null,
      page,
      signature: trace
        ? {
            x: Number(trace.pos_x ?? 0), y: Number(trace.pos_y ?? 0),
            largeur: Number(trace.width ?? 120), hauteur: Number(trace.height ?? 26),
          }
        : null,
      date: date
        ? { x: Number(date.pos_x ?? 0), y: Number(date.pos_y ?? 0), largeur: Number(date.width ?? 70) }
        : null,
    })
  }
  return sorties
}

/** L'empreinte du document final, pour qui veut la vérifier de son côté. */
export const empreinteDe = (octets: Uint8Array): string =>
  createHash("sha256").update(Buffer.from(octets)).digest("hex")
