"use client"

import * as React from "react"
import { Plus, Ban, Play, Check, AlertTriangle } from "lucide-react"
import { creerCabinet, changerPlan, basculerAcces, type ResultatAction } from "@/lib/data/admin-actions"
import { cn } from "@/lib/utils"

const PLANS = ["trial", "solo", "cabinet", "courtoisie"] as const

const CHAMP =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"

function Retour({ resultat }: { resultat: ResultatAction | null }) {
  if (!resultat) return null
  return (
    <p
      role="status"
      className={cn(
        "mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-xs font-bold",
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
  )
}

/** Ouverture d'un cabinet : c'est l'acte qui donne accès à la plateforme. */
export function CreerCabinet({ labels }: { labels: Record<string, string> }) {
  const [ouvert, setOuvert] = React.useState(false)
  const [resultat, setResultat] = React.useState<ResultatAction | null>(null)
  const [enCours, demarrer] = React.useTransition()
  const [plan, setPlan] = React.useState<string>("trial")

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <Plus aria-hidden className="h-4 w-4" />
        {labels.newFirm}
      </button>
    )
  }

  return (
    <form
      action={(fd) => demarrer(async () => {
        const r = await creerCabinet(fd)
        setResultat(r)
        if (r.ok) setOuvert(false)
      })}
      className="w-full rounded-2xl border border-border bg-card p-5"
    >
      <h3 className="mb-4 text-sm font-black text-foreground">{labels.newFirm}</h3>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold text-foreground">
          {labels.firmName}
          <input name="nom" required className={cn(CHAMP, "mt-1 h-10 font-normal")} />
        </label>
        <label className="text-xs font-bold text-foreground">
          {labels.license}
          <input
            name="permis"
            required
            placeholder="R1234567"
            className={cn(CHAMP, "mt-1 h-10 font-mono font-normal")}
          />
        </label>
        <label className="text-xs font-bold text-foreground">
          {labels.consultant}
          <input name="proprietaire" required className={cn(CHAMP, "mt-1 h-10 font-normal")} />
        </label>
        <label className="text-xs font-bold text-foreground">
          {labels.email}
          <input name="courriel" type="email" className={cn(CHAMP, "mt-1 h-10 font-normal")} />
        </label>
        <label className="text-xs font-bold text-foreground">
          {labels.plan}
          <select
            name="plan"
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            className={cn(CHAMP, "mt-1 h-10 font-normal")}
          >
            {PLANS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        {/* L'échéance n'a de sens que pour un essai : les autres plans
            n'expirent pas d'eux-mêmes. */}
        {plan === "trial" && (
          <label className="text-xs font-bold text-foreground">
            {labels.trialDays}
            <input
              name="jours"
              type="number"
              min={1}
              defaultValue={30}
              className={cn(CHAMP, "mt-1 h-10 font-normal")}
            />
          </label>
        )}
      </div>

      <Retour resultat={resultat} />

      <div className="mt-4 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => { setOuvert(false); setResultat(null) }}
          className="min-h-10 rounded-xl px-3 py-2 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {labels.cancel}
        </button>
        <button
          type="submit"
          disabled={enCours}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {enCours ? labels.saving : labels.create}
        </button>
      </div>
    </form>
  )
}

/** Plan et accès d'un cabinet donné, modifiables sans terminal. */
export function ActionsCabinet({
  firmId,
  plan,
  accessOpen,
  labels,
}: {
  firmId: string
  plan: string
  accessOpen: boolean
  labels: Record<string, string>
}) {
  const [resultat, setResultat] = React.useState<ResultatAction | null>(null)
  const [enCours, demarrer] = React.useTransition()

  return (
    <div className="space-y-2">
      <form
        action={(fd) => demarrer(async () => setResultat(await changerPlan(fd)))}
        className="flex items-center gap-1.5"
      >
        <input type="hidden" name="firmId" value={firmId} />
        <input type="hidden" name="jours" value={30} />
        <select
          name="plan"
          defaultValue={plan}
          className="min-h-8 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {PLANS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={enCours}
          className="min-h-8 rounded-lg border border-border px-2 py-1 text-[11px] font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          {labels.apply}
        </button>
      </form>

      <form action={(fd) => demarrer(async () => setResultat(await basculerAcces(fd)))}>
        <input type="hidden" name="firmId" value={firmId} />
        <input type="hidden" name="suspendre" value={accessOpen ? "1" : "0"} />
        <button
          type="submit"
          disabled={enCours}
          className={cn(
            "inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-bold transition-colors disabled:opacity-50",
            accessOpen
              ? "border border-error/30 text-error hover:bg-error/10"
              : "border border-success/30 text-success hover:bg-success/10"
          )}
        >
          {accessOpen ? (
            <>
              <Ban aria-hidden className="h-3 w-3" />
              {labels.suspend}
            </>
          ) : (
            <>
              <Play aria-hidden className="h-3 w-3" />
              {labels.activate}
            </>
          )}
        </button>
      </form>

      <Retour resultat={resultat} />
    </div>
  )
}
