"use client"

import * as React from "react"
import {
  PenLine, Send, X, Clock, Check, AlertTriangle, Loader2,
  Download, History, ExternalLink,
} from "lucide-react"
import {
  annulerSignature, relancerSignature, journalSignature, lienPourSigner,
} from "@/lib/data/signature-actions"
import type { LigneTableau } from "@/lib/data/signatures"
import {
  LIBELLE_DEMANDE, LIBELLE_DESTINATAIRE, LIBELLE_EVENEMENT,
  libelleRole, type StatutDemande, type StatutDestinataire, type EvenementSignature,
} from "@/lib/signature/statuts"
import { cn } from "@/lib/utils"

/**
 * La liste des demandes de signature d'une section.
 *
 * ─── ELLE N'ENVOIE RIEN ────────────────────────────────────────────────────
 *
 * Ouvrir une demande suppose de désigner des signataires et un ordre : cela se
 * fait depuis l'entente de service ou l'onglet Signature du dossier, là où le
 * client et le consultant sont déjà connus. Cet écran SUIT ce qui est parti —
 * relancer, annuler, signer soi-même, consulter l'historique.
 *
 * ─── « SIGNER » OUVRE LA MÊME PAGE QUE LE CLIENT ───────────────────────────
 *
 * Le consultant est un destinataire comme un autre : il signe par son lien.
 * Un écran de signature séparé pour les membres serait une seconde
 * implémentation du geste le plus délicat du produit.
 */

const COULEUR_DEMANDE: Record<StatutDemande, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  ready: "bg-muted text-foreground border-border",
  sent: "bg-warning/15 text-warning-strong border-warning/40",
  viewed: "bg-warning/15 text-warning-strong border-warning/40",
  partially_signed: "bg-warning/15 text-warning-strong border-warning/40",
  completed: "bg-success/15 text-success-strong border-success/40",
  declined: "bg-error/10 text-error-strong border-error/40",
  cancelled: "bg-muted text-muted-foreground border-border",
  expired: "bg-muted text-muted-foreground border-border",
}

const COULEUR_DESTINATAIRE: Record<StatutDestinataire, string> = {
  pending: "text-muted-foreground",
  viewed: "text-warning-strong",
  signed: "text-success-strong",
  declined: "text-error-strong",
  expired: "text-muted-foreground",
}

const BOUTON =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 " +
  "text-[11px] font-bold text-foreground hover:bg-muted disabled:opacity-40"

const jour = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" }) : "—"

export function ListeSignatures({
  lignes,
  etiquettes,
}: {
  lignes: LigneTableau[]
  etiquettes: { divergence: string; requestedOn: string; expiresOn: string }
}) {
  const [message, setMessage] = React.useState<{ ok: boolean; texte: string } | null>(null)
  const [occupe, setOccupe] = React.useState<string | null>(null)
  const [historique, setHistorique] = React.useState<
    { id: string; entrees: Awaited<ReturnType<typeof journalSignature>> } | null
  >(null)

  const agir = async (id: string, action: () => Promise<{ ok: boolean; message: string }>) => {
    setOccupe(id)
    setMessage(null)
    const r = await action()
    setOccupe(null)
    setMessage({ ok: r.ok, texte: r.message })
    // La page est rendue au serveur : c'est lui qui recalcule les sections.
    if (r.ok) window.location.reload()
  }

  const signer = async (id: string) => {
    setOccupe(id)
    setMessage(null)
    const r = await lienPourSigner(id)
    setOccupe(null)
    if (!r.ok || !r.lien) {
      setMessage({ ok: false, texte: r.message })
      return
    }
    window.location.href = r.lien
  }

  const voirHistorique = async (id: string) => {
    if (historique?.id === id) { setHistorique(null); return }
    setHistorique({ id, entrees: await journalSignature(id) })
  }

  return (
    <>
      {message && (
        <p role="status" className={cn(
          "mb-3 rounded-xl border p-3 text-xs font-bold",
          message.ok
            ? "border-success/40 bg-success/10 text-success-strong"
            : "border-error/40 bg-error/10 text-error-strong"
        )}>
          {message.texte}
        </p>
      )}

      <ul className="space-y-3">
        {lignes.map((l) => (
          <li key={l.demandeId} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground">{l.documentName}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {l.clientName ?? "—"}
                  {l.requestedAt && ` · ${etiquettes.requestedOn} ${jour(l.requestedAt)}`}
                  {l.expiresAt && ` · ${etiquettes.expiresOn} ${jour(l.expiresAt)}`}
                </p>
              </div>
              <span className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold",
                COULEUR_DEMANDE[l.statut]
              )}>
                {l.statut === "completed" ? <Check className="h-3 w-3" aria-hidden />
                  : l.statut === "declined" ? <AlertTriangle className="h-3 w-3" aria-hidden />
                  : <Clock className="h-3 w-3" aria-hidden />}
                {LIBELLE_DEMANDE[l.statut]}
              </span>
            </div>

            {l.divergence && (
              <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-error/30 bg-error/10 px-2.5 py-1.5 text-[11px] font-bold text-error-strong">
                <AlertTriangle aria-hidden className="mt-px h-3 w-3 shrink-0" />
                {etiquettes.divergence}
              </p>
            )}

            {l.destinataires.length > 0 && (
              <ul className="mt-3 space-y-1">
                {l.destinataires.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-baseline gap-x-2 text-[11px]">
                    <span className={cn("font-bold", COULEUR_DESTINATAIRE[r.statut])}>
                      {r.statut === "signed" ? "✓" : r.statut === "declined" ? "✗" : "○"}
                    </span>
                    <span className="font-semibold text-foreground">{r.nom}</span>
                    <span className="text-muted-foreground">{libelleRole(r.role)}</span>
                    <span className={cn("ml-auto", COULEUR_DESTINATAIRE[r.statut])}>
                      {LIBELLE_DESTINATAIRE[r.statut]}
                      {r.signeLe && ` · ${jour(r.signeLe)}`}
                      {r.statut === "pending" && r.sonTour && " · c'est à lui"}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
              {l.monTour && (
                <button type="button" onClick={() => signer(l.demandeId)} disabled={occupe === l.demandeId}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-40">
                  {occupe === l.demandeId
                    ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                    : <PenLine className="h-3 w-3" aria-hidden />}
                  Signer
                </button>
              )}

              {l.documentSigneId && (
                <a href={`/api/documents/${l.documentSigneId}`} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-success/15 px-2.5 py-1.5 text-[11px] font-bold text-success-strong hover:bg-success/25">
                  <Download className="h-3 w-3" aria-hidden /> Document signé
                </a>
              )}

              {l.matterId && (
                <a href={`/fr/matters/${encodeURIComponent(l.matterId)}`}
                  className={BOUTON}>
                  <ExternalLink className="h-3 w-3" aria-hidden /> Le dossier
                </a>
              )}

              <button type="button" onClick={() => voirHistorique(l.demandeId)} className={BOUTON}>
                <History className="h-3 w-3" aria-hidden /> Historique
              </button>

              {["sent", "viewed", "partially_signed"].includes(l.statut) && (
                <>
                  <button type="button" disabled={occupe === l.demandeId}
                    onClick={() => agir(l.demandeId, () => relancerSignature(l.demandeId))}
                    className={BOUTON}>
                    <Send className="h-3 w-3" aria-hidden /> Renvoyer
                  </button>
                  <button type="button" disabled={occupe === l.demandeId}
                    onClick={() => agir(l.demandeId, () => annulerSignature(l.demandeId))}
                    className={cn(BOUTON, "text-error-strong hover:bg-error/10")}>
                    <X className="h-3 w-3" aria-hidden /> Annuler
                  </button>
                </>
              )}
            </div>

            {historique?.id === l.demandeId && (
              <ol className="mt-3 space-y-1 border-t border-border pt-3">
                {historique.entrees.length === 0 && (
                  <li className="text-[11px] text-muted-foreground">Aucun événement consigné.</li>
                )}
                {historique.entrees.map((e, i) => (
                  <li key={i} className="flex flex-wrap items-baseline gap-x-2 text-[11px]">
                    <span className="font-semibold text-foreground">
                      {LIBELLE_EVENEMENT[e.evenement as EvenementSignature] ?? e.evenement}
                    </span>
                    <span className="text-muted-foreground">{e.acteur}</span>
                    <span className="ml-auto font-mono text-muted-foreground">
                      {new Date(e.survenuLe).toLocaleString("fr-CA")}
                      {e.ip && ` · ${e.ip}`}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </li>
        ))}
      </ul>
    </>
  )
}
