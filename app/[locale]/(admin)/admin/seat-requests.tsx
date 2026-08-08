"use client"

import * as React from "react"
import { Users, Check, AlertTriangle } from "lucide-react"
import { repondreDemandeSieges, type ResultatSieges } from "@/lib/data/seat-requests"
import { cn } from "@/lib/utils"

const CHAMP =
  "w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"

export interface DemandeSiegeVue {
  id: string
  firmName: string
  plan: string
  demandeur: string
  seats: number
  roleHint: string
  justification: string
  statut: string
  creeLe: string
  placesOccupees: number
  placesMax: number | null
}

/**
 * Demandes de places en attente, côté exploitant.
 *
 * Placées près des demandes de démonstration, pour la même raison : c'est ce
 * qui attend une décision, et le reste de la console est de la consultation.
 */
export function SeatRequests({ demandes }: { demandes: DemandeSiegeVue[] }) {
  const [resultat, setResultat] = React.useState<ResultatSieges | null>(null)
  const [enCours, demarrer] = React.useTransition()

  const executer = (fd: FormData) =>
    demarrer(async () => setResultat(await repondreDemandeSieges(fd)))

  if (demandes.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
        Aucune demande de place en attente.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {resultat && (
        <p
          role="status"
          className={cn(
            "flex items-start gap-2 rounded-xl px-4 py-3 text-xs font-bold leading-relaxed",
            resultat.ok ? "bg-success/10 text-success" : "bg-error/10 text-error"
          )}
        >
          {resultat.ok ? (
            <Check aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" />
          ) : (
            <AlertTriangle aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" />
          )}
          {resultat.message}
        </p>
      )}

      {demandes.map((d) => (
        <div key={d.id} className="rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-black text-foreground">
                <Users aria-hidden className="h-4 w-4 text-muted-foreground" />
                {d.firmName}
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  {d.plan}
                </span>
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {d.demandeur} demande <strong className="text-foreground">{d.seats} place(s)</strong>
                {d.roleHint && ` pour : ${d.roleHint}`} · le {d.creeLe}
              </p>
              {/* L'état des places est montré à côté de la demande : sans lui,
                  l'exploitant devrait aller le chercher ailleurs pour juger. */}
              <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                {d.placesOccupees} occupée(s) sur {d.placesMax === null ? "∞" : d.placesMax}
              </p>
              {d.justification && (
                <p className="mt-2 max-w-prose rounded-lg bg-muted px-3 py-2 text-xs italic text-muted-foreground">
                  « {d.justification} »
                </p>
              )}
            </div>
          </div>

          <form action={executer} className="mt-4 grid gap-3 sm:grid-cols-4">
            <input type="hidden" name="id" value={d.id} />
            <label className="text-[11px] font-bold text-muted-foreground">
              Places accordées
              <input
                name="accordees"
                type="number"
                min={0}
                max={50}
                defaultValue={d.seats}
                className={cn(CHAMP, "mt-1 font-mono")}
              />
            </label>
            <label className="text-[11px] font-bold text-muted-foreground sm:col-span-3">
              Réponse au cabinet (facultative)
              <input name="reponse" placeholder="ex : accordé jusqu'au renouvellement" className={cn(CHAMP, "mt-1")} />
            </label>

            <div className="flex flex-wrap items-center gap-2 sm:col-span-4">
              <button
                type="submit"
                name="decision"
                value="approved"
                disabled={enCours}
                className="inline-flex min-h-9 items-center rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                Accorder
              </button>
              <button
                type="submit"
                name="decision"
                value="info_requested"
                disabled={enCours}
                className="inline-flex min-h-9 items-center rounded-xl border border-border px-3 py-2 text-xs font-bold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
              >
                Demander des précisions
              </button>
              <button
                type="submit"
                name="decision"
                value="refused"
                disabled={enCours}
                className="inline-flex min-h-9 items-center rounded-xl border border-error/30 px-3 py-2 text-xs font-bold text-error transition-colors hover:bg-error/10 disabled:opacity-50"
              >
                Refuser
              </button>

              {/* Dit au moment de décider, et non découvert sur un relevé. */}
              <span className="text-[11px] text-muted-foreground">
                Les places accordées ne sont pas facturées automatiquement.
              </span>
            </div>
          </form>
        </div>
      ))}
    </div>
  )
}
