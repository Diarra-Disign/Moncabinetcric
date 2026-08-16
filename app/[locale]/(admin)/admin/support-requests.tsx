"use client"

import * as React from "react"
import { LifeBuoy, Mail, Check, AlertTriangle } from "lucide-react"
import { marquerAideTraitee } from "@/lib/data/support-request"
import type { SupportRequestRow } from "@/lib/data/admin"

/**
 * Cabinets bloqués qui ont demandé de l'aide.
 *
 * ─── POURQUOI CE BLOC EXISTE, PUISQU'UN COURRIEL PART DÉJÀ ─────────────────
 *
 * Parce qu'un courriel se perd, se classe en indésirables, ou s'enterre sous
 * quarante autres. Le dispositif qu'on remplace tenait ENTIÈREMENT dans un
 * message — et c'est précisément ce qui l'a rendu invisible pendant des
 * semaines. La ligne fait foi ; le courriel n'est qu'un rappel.
 *
 * ─── CE QUE MONTRE CHAQUE CARTE, ET POURQUOI ───────────────────────────────
 *
 * L'état du cabinet TEL QU'IL ÉTAIT quand la personne a écrit. Neuf fois sur
 * dix il donne la réponse sans qu'il faille chercher : « solo / active /
 * canceled » se lit d'un coup d'œil — un abonnement résilié sur un forfait
 * payant, l'accès s'est refermé, et le sélecteur de plan quelques lignes plus
 * bas le rouvre.
 */
export function SupportRequests({
  requests,
  labels,
}: {
  requests: SupportRequestRow[]
  labels: Record<string, string>
}) {
  const [resultat, setResultat] = React.useState<string | null>(null)
  const [enCours, demarrer] = React.useTransition()

  if (requests.length === 0) return null

  return (
    <section className="mb-6 rounded-3xl border border-warning/40 bg-warning/5 p-5">
      <h2 className="mb-1 flex items-center gap-2 text-base font-black tracking-tight text-foreground">
        <LifeBuoy aria-hidden className="h-4 w-4 text-warning" />
        {labels.supportHeading}
      </h2>
      <p className="mb-4 max-w-prose text-xs text-muted-foreground">{labels.supportIntro}</p>

      {resultat && (
        <p className="mb-3 flex items-start gap-2 text-xs font-bold text-success">
          <Check aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" />
          {resultat}
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {requests.map((d) => (
          <li key={d.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-black text-foreground">{d.firmName || d.firmId}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {d.requesterName}
                  {d.requesterEmail && (
                    <>
                      {" — "}
                      <a
                        href={`mailto:${d.requesterEmail}`}
                        className="font-mono underline decoration-dotted underline-offset-2"
                      >
                        {d.requesterEmail}
                      </a>
                    </>
                  )}
                </p>
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">
                {d.createdAt.slice(0, 16).replace("T", " ")}
              </span>
            </div>

            {/* L'état au moment de l'écriture. Trois jetons, lus d'un trait. */}
            <div className="mt-3 flex flex-wrap gap-1.5 font-mono text-[10px] uppercase tracking-wide">
              <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                {labels.plan} {d.firmPlan || "—"}
              </span>
              <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
                {d.firmStatus || "—"}
              </span>
              <span className="rounded bg-error/10 px-1.5 py-0.5 text-error">
                {d.subscriptionStatus || labels.supportNoSub}
              </span>
            </div>

            <p className="mt-3 whitespace-pre-wrap rounded-xl bg-muted/50 p-3 text-sm leading-relaxed text-foreground">
              {d.message}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <a
                href={`mailto:${d.requesterEmail}`}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-[11px] font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Mail aria-hidden className="h-3 w-3" />
                {labels.supportReply}
              </a>

              <form
                action={(fd) =>
                  demarrer(async () => {
                    const r = await marquerAideTraitee(fd)
                    setResultat(r.ok ? labels.supportDone : labels.supportFailed)
                  })
                }
              >
                <input type="hidden" name="id" value={d.id} />
                <button
                  type="submit"
                  disabled={enCours}
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-success/30 px-2 py-1 text-[11px] font-bold text-success transition-colors hover:bg-success/10 disabled:opacity-50"
                >
                  <Check aria-hidden className="h-3 w-3" />
                  {labels.supportHandled}
                </button>
              </form>

              {/* Marquer traité N'OUVRE RIEN : c'est un geste de classement,
                  pas de déblocage. Le dire ici évite qu'on le prenne pour la
                  réponse au problème. */}
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <AlertTriangle aria-hidden className="h-3 w-3 shrink-0" />
                {labels.supportHandledHint}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
