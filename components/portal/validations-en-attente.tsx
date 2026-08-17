"use client"

import * as React from "react"
import { CheckCircle2, AlertTriangle, FileText, Download, MessageSquare, Loader2, Send } from "lucide-react"
import { repondreValidation, type ResultatAction } from "@/lib/data/portal-review-actions"
import { useRouter } from "next/navigation"

export interface DemandeValidationVue {
  id: string
  documentId: string
  documentNom: string
  kind: string
  message: string | null
  requestedAt: string
  status: string
  downloadUrl?: string
}

export function ValidationsEnAttente({
  demandes = [],
}: {
  demandes: DemandeValidationVue[]
}) {
  const [resultat, setResultat] = React.useState<ResultatAction | null>(null)
  const [enCours, demarrer] = React.useTransition()
  const [erreurDocId, setErreurDocId] = React.useState<string | null>(null)
  const [commentaire, setCommentaire] = React.useState("")
  const router = useRouter()

  if (demandes.length === 0) return null

  const soumettre = (reviewId: string, decision: "confirmed" | "error_reported", comment?: string) => {
    demarrer(async () => {
      const fd = new FormData()
      fd.set("reviewId", reviewId)
      fd.set("decision", decision)
      if (comment) fd.set("comment", comment)
      const res = await repondreValidation(fd)
      setResultat(res)
      if (res.ok) {
        setErreurDocId(null)
        setCommentaire("")
        router.refresh()
      }
    })
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
          <FileText className="h-3.5 w-3.5" />
        </div>
        <h2 className="text-base font-black tracking-tight text-foreground">
          Documents à vérifier & valider ({demandes.length})
        </h2>
      </div>

      {resultat && (
        <div
          className={`p-3 rounded-xl text-xs font-bold ${
            resultat.ok
              ? "bg-success/15 text-success border border-success/20"
              : "bg-error/15 text-error border border-error/20"
          }`}
        >
          {resultat.message}
        </div>
      )}

      <div className="space-y-3">
        {demandes.map((d) => {
          const enModeSignalement = erreurDocId === d.id

          return (
            <div
              key={d.id}
              className="rounded-2xl border border-primary/20 bg-card p-4 sm:p-5 shadow-xs transition-shadow hover:shadow-sm"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-foreground">{d.documentNom}</span>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary uppercase">
                      {d.kind === "signature"
                        ? "Signature requise"
                        : d.kind === "validation_and_signature"
                        ? "Validation & Signature"
                        : "Validation requise"}
                    </span>
                  </div>
                  {d.message && (
                    <p className="text-xs text-muted-foreground flex items-start gap-1.5 pt-0.5">
                      <MessageSquare className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                      <span>{d.message}</span>
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    Demandé le {new Date(d.requestedAt).toLocaleDateString("fr-CA")}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0">
                  <a
                    href={`/api/documents/${d.documentId}`}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted font-bold text-xs text-foreground transition-colors cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" /> Consulter / Télécharger
                  </a>

                  {!enModeSignalement && (
                    <>
                      <button
                        type="button"
                        disabled={enCours}
                        onClick={() => soumettre(d.id, "confirmed")}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {enCours ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        Confirmer l&apos;exactitude
                      </button>

                      <button
                        type="button"
                        disabled={enCours}
                        onClick={() => {
                          setErreurDocId(d.id)
                          setCommentaire("")
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-warning/30 bg-warning/5 hover:bg-warning/15 font-bold text-xs text-amber-700 dark:text-amber-300 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <AlertTriangle className="h-3.5 w-3.5" /> Signaler une erreur
                      </button>
                    </>
                  )}
                </div>
              </div>

              {enModeSignalement && (
                <div className="mt-3 pt-3 border-t border-border space-y-2">
                  <label className="text-xs font-bold text-foreground block">
                    Veuillez décrire l&apos;erreur ou l&apos;information à corriger :
                  </label>
                  <textarea
                    rows={2}
                    value={commentaire}
                    onChange={(e) => setCommentaire(e.target.value)}
                    placeholder="Ex: Mon prénom comporte une faute de frappe, la date de naissance est incorrecte..."
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      disabled={enCours}
                      onClick={() => {
                        setErreurDocId(null)
                        setCommentaire("")
                      }}
                      className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      disabled={enCours || !commentaire.trim()}
                      onClick={() => soumettre(d.id, "error_reported", commentaire)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-warning text-warning-foreground font-bold text-xs hover:bg-warning/90 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {enCours ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                      Transmettre le signalement
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
