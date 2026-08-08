"use client"

import * as React from "react"
import { Users, Check, AlertTriangle, Clock, Send } from "lucide-react"
import { demanderSieges, type ResultatSieges } from "@/lib/data/seat-requests"
import { cn } from "@/lib/utils"

const CHAMP =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"

export interface DemandeVue {
  id: string
  seats: number
  statut: string
  accordees: number
  reponse: string
  creeLe: string
}

/**
 * Places du cabinet, et demande d'une place de plus.
 *
 * Un cabinet à court de places se heurtait au refus sec du déclencheur au
 * moment d'inviter quelqu'un, sans savoir quoi faire ensuite. L'état est
 * désormais affiché avant qu'on le rencontre, et le chemin de sortie est sur
 * le même écran.
 */
export function SeatRequestPanel({
  occupees,
  limite,
  demandes,
  peutDemander,
}: {
  occupees: number
  /** null = sans limite. */
  limite: number | null
  demandes: DemandeVue[]
  peutDemander: boolean
}) {
  const [resultat, setResultat] = React.useState<ResultatSieges | null>(null)
  const [ouvert, setOuvert] = React.useState(false)
  const [enCours, demarrer] = React.useTransition()

  const enAttente = demandes.find((d) => d.statut === "pending" || d.statut === "info_requested")
  const sature = limite !== null && occupees >= limite
  const restantes = limite === null ? null : Math.max(0, limite - occupees)

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              sature ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground"
            )}
          >
            <Users aria-hidden className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-sm font-black text-foreground">
              {occupees} place{occupees > 1 ? "s" : ""} occupée{occupees > 1 ? "s" : ""} sur{" "}
              {limite === null ? "un nombre illimité" : limite}
            </h2>
            <p className="mt-0.5 max-w-prose text-xs leading-relaxed text-muted-foreground">
              {/* Compter les invitations en attente est dit ici, parce que
                  c'est ce qui surprend : on invite trois personnes, aucune n'a
                  répondu, et la quatrième invitation est refusée. */}
              Les invitations en attente occupent une place jusqu&apos;à leur acceptation ou leur
              révocation. Suspendre un membre en libère une aussitôt.
              {restantes !== null &&
                (restantes > 0
                  ? ` Il vous en reste ${restantes}.`
                  : " Vous n'en avez plus de disponible.")}
            </p>
          </div>
        </div>

        {peutDemander && !enAttente && !ouvert && (
          <button
            type="button"
            onClick={() => setOuvert(true)}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-4 py-2 text-xs font-bold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <Send aria-hidden className="h-3.5 w-3.5" />
            Demander une place
          </button>
        )}
      </div>

      {resultat && (
        <p
          role="status"
          className={cn(
            "mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-xs font-bold leading-relaxed",
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

      {enAttente && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-muted px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          <Clock aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Demande de <strong className="text-foreground">{enAttente.seats} place(s)</strong>{" "}
            déposée le {enAttente.creeLe}, en attente de réponse.
            {enAttente.reponse && (
              <>
                {" "}
                <strong className="text-foreground">Précisions demandées :</strong> {enAttente.reponse}
              </>
            )}
          </span>
        </p>
      )}

      {ouvert && peutDemander && (
        <form
          action={(fd) =>
            demarrer(async () => {
              const r = await demanderSieges(fd)
              setResultat(r)
              if (r.ok) setOuvert(false)
            })
          }
          className="mt-4 grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-3"
        >
          <label className="text-xs font-bold text-foreground">
            Combien de places
            <input
              name="seats"
              type="number"
              min={1}
              max={50}
              defaultValue={1}
              required
              className={cn(CHAMP, "mt-1 h-10 font-normal")}
            />
          </label>
          <label className="text-xs font-bold text-foreground">
            Pour quel type de membre
            <select name="role" defaultValue="staff" className={cn(CHAMP, "mt-1 h-10 font-normal")}>
              <option value="rcic">Consultant réglementé</option>
              <option value="risia">Stagiaire en immigration</option>
              <option value="staff">Personnel administratif</option>
              <option value="bookkeeper">Tenue de livres</option>
              <option value="readonly">Lecture seule</option>
            </select>
          </label>
          <label className="text-xs font-bold text-foreground sm:col-span-3">
            Justification (facultative)
            <input
              name="justification"
              placeholder="ex : arrivée d'une adjointe en mars"
              className={cn(CHAMP, "mt-1 h-10 font-normal")}
            />
          </label>
          <div className="flex items-center gap-3 sm:col-span-3">
            <button
              type="submit"
              disabled={enCours}
              className="inline-flex min-h-10 items-center rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {enCours ? "Envoi…" : "Envoyer la demande"}
            </button>
            <button
              type="button"
              onClick={() => setOuvert(false)}
              className="min-h-10 rounded-xl px-3 py-2 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {/* L'historique inclut les refus. Une demande qui disparaît sans trace
          laisse croire qu'elle n'a jamais été envoyée. */}
      {demandes.length > 0 && (
        <ul className="mt-4 space-y-1.5 border-t border-border pt-3 text-xs text-muted-foreground">
          {demandes.map((d) => (
            <li key={d.id} className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-mono text-[11px]">{d.creeLe}</span>
              <span>{d.seats} place(s)</span>
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                  d.statut === "approved"
                    ? "bg-success/10 text-success"
                    : d.statut === "refused"
                      ? "bg-error/10 text-error"
                      : "bg-muted text-muted-foreground"
                )}
              >
                {d.statut === "approved"
                  ? `accordée : ${d.accordees}`
                  : d.statut === "refused"
                    ? "refusée"
                    : d.statut === "info_requested"
                      ? "précisions demandées"
                      : "en attente"}
              </span>
              {d.reponse && <span className="italic">« {d.reponse} »</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
