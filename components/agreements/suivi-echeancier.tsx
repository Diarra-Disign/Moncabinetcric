"use client"

import * as React from "react"
import {
  X, Loader2, Receipt, Check, AlertTriangle, Clock, CircleDollarSign, Eye,
} from "lucide-react"
import { suiviEcheancier, facturerEtapeEntente } from "@/lib/data/ententes-actions"
import { LIBELLE_STATUT, libelleMode, type StatutEtape } from "@/lib/ententes/echeancier"
import { cn } from "@/lib/utils"

/**
 * Le suivi de l'échéancier : où en est chaque versement (§27, §28).
 *
 * L'ÉTAT N'EST PAS LU SUR LE CONTRAT, il est DÉDUIT de la facture. Le contrat
 * dit ce qui est convenu ; la facturation dit ce qui est encaissé. Recopier
 * « payé » dans l'échéancier créerait une seconde vérité qui dériverait au
 * premier encaissement saisi ailleurs — le contrat dirait « payé » et le
 * registre « il reste 500 $ ».
 *
 * LA FACTURE NE SE CRÉE JAMAIS TOUTE SEULE. Un numéro de facture appartient à
 * une suite continue et ne se reprend pas : une facture créée au mauvais
 * moment devrait être ANNULÉE, pas supprimée, et laisserait un trou à
 * expliquer. C'est pourquoi le geste demande confirmation et nomme le montant.
 */

const COULEURS: Record<StatutEtape, string> = {
  a_venir: "bg-muted text-muted-foreground border-border",
  a_facturer: "bg-primary/10 text-primary-strong border-primary/30",
  facture: "bg-warning/15 text-warning-strong border-warning/40",
  partiellement_paye: "bg-warning/15 text-warning-strong border-warning/40",
  paye: "bg-success/15 text-success-strong border-success/40",
  en_retard: "bg-error/10 text-error-strong border-error/40",
}

const argent = (v: number) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(v)

type Suivi = Awaited<ReturnType<typeof suiviEcheancier>>

export function SuiviEcheancier({
  agreementId,
  reference,
  onFerme,
}: {
  agreementId: string
  reference: string
  onFerme: () => void
}) {
  const [suivi, setSuivi] = React.useState<Suivi>(null)
  const [chargement, setChargement] = React.useState(true)
  const [enCours, setEnCours] = React.useState<number | null>(null)
  const [aConfirmer, setAConfirmer] = React.useState<number | null>(null)
  const recharger = React.useCallback(async () => {
    const s = await suiviEcheancier(agreementId)
    setSuivi(s)
    setChargement(false)
  }, [agreementId])

  React.useEffect(() => {
    let actif = true
    void (async () => {
      const s = await suiviEcheancier(agreementId)
      if (actif) {
        setSuivi(s)
        setChargement(false)
      }
    })()
    return () => { actif = false }
  }, [agreementId])

  const facturer = async (rang: number) => {
    setEnCours(rang)
    setMessage(null)
    const r = await facturerEtapeEntente(agreementId, rang)
    setMessage({ ok: r.ok, texte: r.message })
    setEnCours(null)
    setAConfirmer(null)
    // On RELIT plutôt que de poser l'état à la main : le statut vient de la
    // base, et l'écrire ici ferait exactement la seconde vérité qu'on évite.
    if (r.ok) await recharger()
  }

  const etapes = suivi?.etapes ?? []
  const total = etapes.reduce((t, e) => t + Number(e.montant || 0), 0)
  const encaisse = etapes.reduce((t, e) => t + Number(e.regle || 0), 0)

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-foreground/50 p-4">
      <div className="bg-card w-full max-w-4xl rounded-2xl border border-border shadow-2xl flex flex-col max-h-[92vh]">
        <header className="p-5 border-b border-border flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-foreground">
              Échéancier — {reference}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              L&apos;état de chaque versement vient de sa facture, jamais du contrat.
            </p>
          </div>
          <button type="button" onClick={onFerme} aria-label="Fermer"
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </header>

        {message && (
          <p role="status" className={cn(
            "mx-5 mt-3 rounded-xl border p-3 text-xs font-bold",
            message.ok
              ? "border-success/40 bg-success/10 text-success-strong"
              : "border-error/40 bg-error/10 text-error-strong"
          )}>
            {message.texte}
          </p>
        )}

        <div className="flex-1 overflow-y-auto p-5">
          {chargement ? (
            <div className="py-12 text-center">
              <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
            </div>
          ) : etapes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
              <CircleDollarSign className="mx-auto h-7 w-7 text-muted-foreground/70" />
              <p className="mt-2 text-xs font-bold text-foreground">Aucun échéancier</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Ce contrat annonce ses honoraires en un seul montant. L&apos;échéancier
                se définit à la rédaction du brouillon.
              </p>
            </div>
          ) : (
            <>
              <ul className="space-y-2">
                {etapes.map((e) => (
                  <li key={e.position} className="rounded-xl border border-border bg-muted/20 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-black text-foreground">
                          <span className="text-primary-strong">{e.position}.</span> {e.description}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {[
                            e.declenchement,
                            e.mode ? libelleMode(e.mode) : "",
                            e.fideicommis ? "En fidéicommis (art. 13)" : "",
                            e.factureNumero ? `Facture ${e.factureNumero}` : "",
                          ].filter(Boolean).join(" · ") || "—"}
                        </p>
                        {/* Ce qui est encaissé n'apparaît que s'il y a quelque
                            chose à dire : « 0,00 $ encaissé » sur une étape
                            non facturée est du bruit. */}
                        {e.regle > 0 && e.regle < Number(e.montant) && (
                          <p className="mt-0.5 text-[11px] font-semibold text-warning-strong">
                            {argent(e.regle)} encaissé sur {argent(Number(e.montant))}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-xs font-black text-foreground">
                          {argent(Number(e.montant))}
                        </span>
                        <span className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold",
                          COULEURS[e.statutCalcule]
                        )}>
                          {e.statutCalcule === "paye" ? <Check className="h-3 w-3" />
                            : e.statutCalcule === "en_retard" ? <AlertTriangle className="h-3 w-3" />
                            : <Clock className="h-3 w-3" />}
                          {LIBELLE_STATUT[e.statutCalcule]}
                        </span>

                        {e.factureId ? (
                          <a
                            href={`/api/invoices/${e.factureId}/pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-bold text-foreground hover:bg-muted"
                          >
                            <Eye className="h-3 w-3" /> Voir la facture
                          </a>
                        ) : e.facturable ? (
                          <button
                            type="button"
                            onClick={() => setAConfirmer(e.position)}
                            disabled={enCours !== null}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 cursor-pointer"
                          >
                            {enCours === e.position
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <Receipt className="h-3 w-3" />}
                            Créer la facture
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {/* §27 — la confirmation NOMME le montant et le numéro à
                        venir. Un numéro de facture ne se reprend pas : une
                        facture créée par mégarde devra être annulée, et son
                        numéro laissera un trou dans le registre. */}
                    {aConfirmer === e.position && (
                      <div className="mt-3 rounded-lg border border-warning/40 bg-warning/10 p-3">
                        <p className="text-[11px] font-black text-warning-strong">
                          Créer une facture de {argent(Number(e.montant))} pour cette étape ?
                        </p>
                        <p className="mt-1 text-[11px] text-foreground">
                          Elle recevra le prochain numéro du cabinet. Un numéro attribué ne se
                          reprend pas : une facture créée par erreur devra être annulée, et son
                          numéro restera dans la suite.
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <button type="button" onClick={() => facturer(e.position)}
                            className="rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-bold text-primary-foreground hover:bg-primary/90 cursor-pointer">
                            Créer la facture
                          </button>
                          <button type="button" onClick={() => setAConfirmer(null)}
                            className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-bold text-foreground hover:bg-muted cursor-pointer">
                            Annuler
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 p-3">
                <span className="text-[11px] font-bold text-muted-foreground">
                  {etapes.length} versement{etapes.length > 1 ? "s" : ""}
                </span>
                <span className="text-xs font-black text-foreground">
                  Encaissé {argent(encaisse)} sur {argent(total)}
                </span>
              </div>

              {suivi?.statut === "draft" && (
                <p className="mt-3 text-[11px] text-muted-foreground">
                  Cette entente est encore un brouillon : émettez-la avant de facturer.
                  Un montant qui peut changer ne se facture pas.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
