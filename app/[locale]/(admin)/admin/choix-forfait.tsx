"use client"

import { Bot, Info, Users } from "lucide-react"
import {
  PLANS_ACCORDES,
  accroche,
  formatMontant,
  libelle,
  modeOuverture,
  type Cadence,
  type ModeOuverture,
  type Plan,
} from "@/lib/billing/plans"
import { cn } from "@/lib/utils"

/**
 * Choix du forfait à l'ouverture d'un cabinet, tiré du catalogue en base.
 *
 * La liste n'est plus écrite dans ce fichier : elle suit `plan_limits`, et
 * `modeOuverture()` — la même règle que l'action de serveur — range chaque
 * forfait. Un forfait au catalogue qui ne peut pas être proposé reste visible,
 * désactivé, pour que l'exploitant sache qu'il existe et ce qui lui manque.
 */
export function ChoixForfait({
  forfaits,
  plan,
  onPlan,
  cadence,
  onCadence,
  langue,
  labels,
  classeChamp,
}: {
  forfaits: Plan[]
  plan: string
  onPlan: (cle: string) => void
  cadence: Cadence
  onCadence: (c: Cadence) => void
  langue: string
  labels: Record<string, string>
  classeChamp: string
}) {
  const payants = forfaits.filter((p) => modeOuverture(p) === "lien")
  const aConfigurer = forfaits.filter((p) => modeOuverture(p) === "a-configurer")
  const choisi = forfaits.find((p) => p.key === plan)
  const mode: ModeOuverture = (PLANS_ACCORDES as readonly string[]).includes(plan)
    ? "accorde"
    : choisi
      ? modeOuverture(choisi)
      : "a-configurer"
  const prix = (cents: number | null) => formatMontant(cents ?? 0, langue)
  const nomAccorde = (cle: string) => {
    const p = forfaits.find((f) => f.key === cle)
    return p ? libelle(p, langue) : cle
  }

  return (
    <div className="space-y-3 sm:col-span-2">
      <label className="block text-xs font-bold text-foreground">
        {labels.plan}
        <select
          name="plan"
          value={plan}
          onChange={(e) => onPlan(e.target.value)}
          className={cn(classeChamp, "mt-1 h-10 font-normal")}
        >
          <optgroup label={labels.groupGranted}>
            {PLANS_ACCORDES.map((cle) => (
              <option key={cle} value={cle}>
                {nomAccorde(cle)}
              </option>
            ))}
          </optgroup>
          {payants.length > 0 && (
            <optgroup label={labels.groupPaid}>
              {payants.map((p) => (
                <option key={p.key} value={p.key}>
                  {libelle(p, langue)} — {prix(p.monthly)} {labels.perMonth}
                </option>
              ))}
            </optgroup>
          )}
          {aConfigurer.length > 0 && (
            <optgroup label={labels.groupToConfigure}>
              {aConfigurer.map((p) => (
                <option key={p.key} value={p.key} disabled>
                  {libelle(p, langue)} — {labels.toConfigure}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </label>

      {forfaits.length === 0 && (
        <p className="text-[11px] text-warning-strong">{labels.catalogueUnavailable}</p>
      )}
      {aConfigurer.length > 0 && (
        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
          <Info aria-hidden className="mt-0.5 h-3 w-3 shrink-0" />
          {labels.toConfigureNote} {aConfigurer.map((p) => libelle(p, langue)).join(", ")}.
        </p>
      )}

      {mode === "lien" && choisi && (
        <fieldset>
          <legend className="text-xs font-bold text-foreground">{labels.cadence}</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {(["monthly", "annual"] as const).map((c) => (
              <label
                key={c}
                className={cn(
                  "inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-colors focus-within:ring-2 focus-within:ring-primary",
                  cadence === c
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                <input
                  type="radio"
                  name="cadence"
                  value={c}
                  checked={cadence === c}
                  onChange={() => onCadence(c)}
                  className="accent-primary"
                />
                {c === "monthly" ? labels.cadenceMonthly : labels.cadenceAnnual}
                <span className="font-mono font-normal">
                  {c === "monthly"
                    ? `${prix(choisi.monthly)} ${labels.perMonth}`
                    : `${prix(choisi.annual)} ${labels.perYear}`}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <DetailForfait forfait={choisi} cle={plan} mode={mode} langue={langue} labels={labels} />
    </div>
  )
}

/** Ce qu'on s'apprête à accorder ou à proposer, dit avant le clic. */
function DetailForfait({
  forfait,
  cle,
  mode,
  langue,
  labels,
}: {
  forfait: Plan | undefined
  cle: string
  mode: ModeOuverture
  langue: string
  labels: Record<string, string>
}) {
  const explication =
    mode === "lien"
      ? labels.modeLink
      : cle === "trial"
        ? labels.modeTrial
        : cle === "courtoisie"
          ? labels.modeCourtesy
          : labels.toConfigureNote

  return (
    // Annoncé au lecteur d'écran quand le forfait change : c'est ce qui dit
    // si le geste ouvre l'accès ou envoie un lien de paiement.
    <div
      aria-live="polite"
      className={cn(
        "rounded-xl border p-3 text-xs",
        mode === "lien" ? "border-primary/40 bg-primary/5" : "border-border bg-muted/40"
      )}
    >
      {forfait && (
        <p className="font-black text-foreground">
          {libelle(forfait, langue)}
          {accroche(forfait, langue) && (
            <span className="ml-1.5 font-normal text-muted-foreground">— {accroche(forfait, langue)}</span>
          )}
        </p>
      )}
      <p className="mt-1 leading-relaxed text-muted-foreground">{explication}</p>

      {forfait && (
        <dl className="mt-3 grid gap-2 border-t border-border pt-3 sm:grid-cols-3">
          <div>
            <dt className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Users aria-hidden className="h-3 w-3" />
              {labels.seatsIncluded}
            </dt>
            <dd className="font-bold text-foreground">
              {forfait.seatsIncluded}
              {forfait.maxSeats === null
                ? ` · ${labels.unlimited}`
                : forfait.maxSeats > forfait.seatsIncluded
                  ? ` · ${labels.maxSeats} ${forfait.maxSeats}`
                  : ""}
            </dd>
          </div>
          {forfait.extraSeatMonthly > 0 && (
            <div>
              <dt className="text-[11px] text-muted-foreground">{labels.extraSeat}</dt>
              <dd className="font-bold text-foreground">
                {formatMontant(forfait.extraSeatMonthly, langue)} {labels.perMonth}
              </dd>
            </div>
          )}
          <div>
            <dt className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Bot aria-hidden className="h-3 w-3" />
              {labels.aiConnector}
            </dt>
            <dd className="font-bold text-foreground">
              {forfait.aiConnector ? labels.included : labels.notIncluded}
            </dd>
          </div>
        </dl>
      )}
    </div>
  )
}
