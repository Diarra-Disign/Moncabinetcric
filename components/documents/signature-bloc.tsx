"use client"

import * as React from "react"
import { PenLine, ShieldCheck, AlertTriangle, Loader2, Check, Clock } from "lucide-react"
import { etatSignatureDocument, type EtatSignatureDocument } from "@/lib/data/signatures"
import {
  LIBELLE_DEMANDE, LIBELLE_DESTINATAIRE, libelleRole,
  type StatutDestinataire,
} from "@/lib/signature/statuts"
import { cn } from "@/lib/utils"

/**
 * L'état de signature d'un document, au bord de sa fiche.
 *
 * ─── EN LECTURE SEULE, ET C'EST UN CHOIX ───────────────────────────────────
 *
 * Ce bloc envoyait autrefois le document en signature d'un seul bouton. Il
 * créait alors une demande SANS DESTINATAIRE : personne à prévenir, aucun lien
 * à transmettre, rien à signer. Le geste avait l'air de fonctionner et ne
 * menait nulle part.
 *
 * Envoyer suppose de désigner qui signe et dans quel ordre. Cela se décide
 * depuis l'entente de service ou l'onglet Signature du dossier, où le client et
 * le consultant sont déjà connus — pas dans une vignette latérale.
 *
 * ─── ET LE CLIENT NE SIGNE PLUS ICI ────────────────────────────────────────
 *
 * Il signe par le lien personnel qu'il reçoit par courriel, sans compte. Le
 * portail lui montre où en est le document ; il ne lui demande pas de se
 * connecter pour apposer une signature.
 */

const COULEUR: Record<StatutDestinataire, string> = {
  pending: "text-muted-foreground",
  viewed: "text-warning-strong",
  signed: "text-success-strong",
  declined: "text-error-strong",
  expired: "text-muted-foreground",
}

export function SignatureBloc({ documentId }: { documentId: string }) {
  const [etat, setEtat] = React.useState<EtatSignatureDocument | null>(null)

  React.useEffect(() => {
    let actif = true
    void etatSignatureDocument(documentId).then((r) => { if (actif) setEtat(r) })
    return () => { actif = false }
  }, [documentId])

  if (!etat) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden />
        <span className="text-[11px] text-muted-foreground">Lecture de l&apos;état…</span>
      </div>
    )
  }

  if (!etat.fichierPresent) {
    return (
      <p className="rounded-lg border border-border bg-muted/30 p-3 text-[11px] text-muted-foreground">
        Aucun fichier déposé : il n&apos;y a rien à signer.
      </p>
    )
  }

  if (!etat.demandeId && etat.signatures.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-3 text-[11px] text-muted-foreground">
        Ce document n&apos;est pas en signature. Envoyez-le depuis l&apos;entente de
        service ou l&apos;onglet Signature du dossier.
      </p>
    )
  }

  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
      {etat.statut && (
        <p className="flex items-center gap-1.5 text-[11px] font-bold text-foreground">
          {etat.statut === "completed"
            ? <Check className="h-3.5 w-3.5 text-success-strong" aria-hidden />
            : <Clock className="h-3.5 w-3.5 text-warning-strong" aria-hidden />}
          {LIBELLE_DEMANDE[etat.statut]}
        </p>
      )}

      {etat.destinataires.length > 0 && (
        <ul className="space-y-0.5">
          {etat.destinataires.map((r) => (
            <li key={r.id} className="flex flex-wrap items-baseline gap-x-2 text-[11px]">
              <span className={cn("font-bold", COULEUR[r.statut])}>
                {r.statut === "signed" ? "✓" : r.statut === "declined" ? "✗" : "○"}
              </span>
              <span className="font-semibold text-foreground">{r.nom}</span>
              <span className="text-muted-foreground">{libelleRole(r.role)}</span>
              <span className={cn("ml-auto", COULEUR[r.statut])}>
                {LIBELLE_DESTINATAIRE[r.statut]}
              </span>
            </li>
          ))}
        </ul>
      )}

      {etat.signatures.length > 0 && (
        <ul className="space-y-0.5 border-t border-border pt-2">
          {etat.signatures.map((s, i) => (
            <li key={i} className="flex flex-wrap items-baseline gap-x-2 text-[11px]">
              <ShieldCheck className="h-3 w-3 shrink-0 text-success-strong" aria-hidden />
              <span className="font-semibold text-foreground">{s.signerName}</span>
              <span className="ml-auto font-mono text-muted-foreground">
                {s.signedAt ? new Date(s.signedAt).toLocaleDateString("fr-CA") : ""}
              </span>
            </li>
          ))}
        </ul>
      )}

      {etat.divergence && (
        <p className="flex items-start gap-1.5 rounded-lg border border-error/30 bg-error/10 px-2 py-1.5 text-[11px] font-bold text-error-strong">
          <AlertTriangle className="mt-px h-3 w-3 shrink-0" aria-hidden />
          Le fichier a changé depuis qu&apos;il a été signé.
        </p>
      )}

      {etat.documentSigneId && (
        <a
          href={`/api/documents/${etat.documentSigneId}`}
          target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-success/15 px-2.5 py-1.5 text-[11px] font-bold text-success-strong hover:bg-success/25"
        >
          <PenLine className="h-3 w-3" aria-hidden /> Document signé
        </a>
      )}
    </div>
  )
}
