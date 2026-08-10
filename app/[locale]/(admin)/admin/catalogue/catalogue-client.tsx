"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, Check, AlertTriangle, Lock, ScrollText } from "lucide-react"
import type { Plan } from "@/lib/billing/plans"
import { formatMontant } from "@/lib/billing/plans"
import type {
  FonctionnaliteVue,
  ExceptionVue,
  EntreeJournalExploitant,
} from "@/lib/data/catalogue-reads"
import {
  modifierForfait,
  basculerFonctionnalite,
  accorderException,
  retirerException,
  type ResultatCatalogue,
} from "@/lib/data/catalogue-actions"
import { cn } from "@/lib/utils"

const CHAMP =
  "w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"

interface CatalogueClientProps {
  plans: Plan[]
  fonctionnalites: FonctionnaliteVue[]
  matrice: Record<string, Record<string, boolean>>
  exceptions: ExceptionVue[]
  cabinets: { id: string; name: string; plan: string }[]
  journal: EntreeJournalExploitant[]
}

function Retour({ r }: { r: ResultatCatalogue | null }) {
  if (!r) return null
  return (
    <p
      role="status"
      className={cn(
        "mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-xs font-bold leading-relaxed",
        r.ok ? "bg-success/10 text-success" : "bg-error/10 text-error"
      )}
    >
      {r.ok ? (
        <Check aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" />
      ) : (
        <AlertTriangle aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" />
      )}
      {r.message}
    </p>
  )
}

export function CatalogueClient({
  plans,
  fonctionnalites,
  matrice,
  exceptions,
  cabinets,
  journal,
}: CatalogueClientProps) {
  const [resultat, setResultat] = React.useState<ResultatCatalogue | null>(null)
  const [enCours, demarrer] = React.useTransition()

  const executer =
    (action: (fd: FormData) => Promise<ResultatCatalogue>) => (fd: FormData) =>
      demarrer(async () => setResultat(await action(fd)))

  /** Montant en dollars pour un champ de saisie : « 49 », pas « 4900 ». */
  const dollars = (cents: number | null) => (cents === null ? "" : (cents / 100).toString())

  const vendables = fonctionnalites.filter((f) => !f.alwaysOn)
  const comprises = fonctionnalites.filter((f) => f.alwaysOn)

  return (
    <div className="space-y-10">
      <header>
        <Link
          href="/fr/admin"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" />
          Console d&apos;exploitation
        </Link>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
          Catalogue
        </h1>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          Forfaits, fonctionnalités et exceptions. Tout ce qui est modifié ici prend effet
          immédiatement, sans redéploiement — y compris sur la page publique.
        </p>
      </header>

      <Retour r={resultat} />

      {/* ---------------------------------------------------------------
          Forfaits
          --------------------------------------------------------------- */}
      <section>
        <h2 className="mb-1 text-base font-black tracking-tight text-foreground">Forfaits</h2>
        <p className="mb-4 max-w-prose text-xs text-muted-foreground">
          Les montants sont en dollars canadiens. Un forfait <strong>souscriptible</strong> apparaît
          dans le tunnel de paiement du cabinet ; les autres s&apos;accordent à la main ou se
          négocient. Modifier un prix ne change pas les abonnements en cours : Stripe garantit à
          chaque abonné le tarif auquel il a souscrit.
        </p>

        <div className="space-y-3">
          {plans.map((p) => (
            <form
              key={p.key}
              action={executer(modifierForfait)}
              className="rounded-2xl border border-border bg-card p-4"
            >
              <input type="hidden" name="plan" value={p.key} />

              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {p.key}
                </span>
                <label className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                  <input
                    type="checkbox"
                    name="purchasable"
                    value="1"
                    defaultChecked={p.purchasable}
                    className="h-3.5 w-3.5 accent-[var(--primary)]"
                  />
                  Souscriptible en ligne
                </label>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="text-[11px] font-bold text-muted-foreground">
                  Libellé (fr)
                  <input name="label_fr" defaultValue={p.labelFr} className={cn(CHAMP, "mt-1")} />
                </label>
                <label className="text-[11px] font-bold text-muted-foreground">
                  Libellé (en)
                  <input name="label_en" defaultValue={p.labelEn} className={cn(CHAMP, "mt-1")} />
                </label>
                <label className="text-[11px] font-bold text-muted-foreground">
                  Mensuel ($)
                  <input
                    name="monthly"
                    inputMode="decimal"
                    defaultValue={dollars(p.monthly)}
                    placeholder="sur mesure"
                    className={cn(CHAMP, "mt-1 font-mono")}
                  />
                </label>
                <label className="text-[11px] font-bold text-muted-foreground">
                  Annuel ($)
                  <input
                    name="annual"
                    inputMode="decimal"
                    defaultValue={dollars(p.annual)}
                    placeholder="sur mesure"
                    className={cn(CHAMP, "mt-1 font-mono")}
                  />
                </label>
                <label className="text-[11px] font-bold text-muted-foreground">
                  Places comprises
                  <input
                    name="seats_included"
                    inputMode="numeric"
                    defaultValue={p.seatsIncluded}
                    className={cn(CHAMP, "mt-1 font-mono")}
                  />
                </label>
                <label className="text-[11px] font-bold text-muted-foreground">
                  Places max (vide = ∞)
                  <input
                    name="max_seats"
                    inputMode="numeric"
                    defaultValue={p.maxSeats ?? ""}
                    placeholder="∞"
                    className={cn(CHAMP, "mt-1 font-mono")}
                  />
                </label>
                <label className="text-[11px] font-bold text-muted-foreground">
                  Place suppl. / mois ($)
                  <input
                    name="extra_monthly"
                    inputMode="decimal"
                    defaultValue={dollars(p.extraSeatMonthly)}
                    className={cn(CHAMP, "mt-1 font-mono")}
                  />
                </label>
                <label className="text-[11px] font-bold text-muted-foreground">
                  Place suppl. / an ($)
                  <input
                    name="extra_annual"
                    inputMode="decimal"
                    defaultValue={dollars(p.extraSeatAnnual)}
                    className={cn(CHAMP, "mt-1 font-mono")}
                  />
                </label>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-[11px] text-muted-foreground">
                  {p.monthly !== null
                    ? `Aujourd'hui : ${formatMontant(p.monthly, "fr")}/mois, ${p.seatsIncluded} place(s) comprise(s)`
                    : "Aucun tarif public — accordé ou négocié"}
                </p>
                <button
                  type="submit"
                  disabled={enCours}
                  className="min-h-8 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------
          Matrice
          --------------------------------------------------------------- */}
      <section>
        <h2 className="mb-1 text-base font-black tracking-tight text-foreground">
          Fonctionnalités par forfait
        </h2>
        <p className="mb-4 max-w-prose text-xs text-muted-foreground">
          Une case cochée ouvre la fonctionnalité à <strong>tous</strong> les cabinets de ce
          forfait, immédiatement.
        </p>

        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="px-4 py-3 font-bold">Fonctionnalité</th>
                {plans.map((p) => (
                  <th key={p.key} className="px-3 py-3 text-center font-bold">
                    {p.labelFr}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {vendables.map((f) => (
                <tr key={f.key}>
                  <td className="px-4 py-3">
                    <div className="text-xs font-bold text-foreground">{f.labelFr}</div>
                    {f.descriptionFr && (
                      <p className="mt-0.5 max-w-md text-[11px] leading-relaxed text-muted-foreground">
                        {f.descriptionFr}
                      </p>
                    )}
                  </td>
                  {plans.map((p) => {
                    const actif = matrice[p.key]?.[f.key] ?? false
                    return (
                      <td key={p.key} className="px-3 py-3 text-center">
                        <form action={executer(basculerFonctionnalite)}>
                          <input type="hidden" name="plan" value={p.key} />
                          <input type="hidden" name="feature" value={f.key} />
                          <input type="hidden" name="activer" value={actif ? "0" : "1"} />
                          <button
                            type="submit"
                            disabled={enCours}
                            aria-label={`${actif ? "Retirer" : "Activer"} ${f.labelFr} pour ${p.labelFr}`}
                            className={cn(
                              "inline-flex h-7 w-7 items-center justify-center rounded-lg border text-xs font-black transition-colors disabled:opacity-50",
                              actif
                                ? "border-success/40 bg-success/10 text-success hover:bg-success/20"
                                : "border-border text-muted-foreground hover:bg-muted"
                            )}
                          >
                            {actif ? "✓" : "—"}
                          </button>
                        </form>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Ce qui ne se vend pas est montré à part, avec sa raison. Le laisser
            dans la matrice avec des cases inertes ferait croire à une panne. */}
        <div className="mt-4 rounded-2xl border border-border bg-muted/40 p-4">
          <h3 className="flex items-center gap-2 text-xs font-black text-foreground">
            <Lock aria-hidden className="h-3.5 w-3.5 text-muted-foreground" />
            Comprises dans tous les forfaits, non retirables
          </h3>
          <ul className="mt-2 grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-2">
            {comprises.map((f) => (
              <li key={f.key} className="flex items-start gap-2">
                <Check aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                <span>
                  <strong className="text-foreground">{f.labelFr}</strong>
                  {f.descriptionFr && ` — ${f.descriptionFr}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------------------------------------------------------------
          Exceptions
          --------------------------------------------------------------- */}
      <section>
        <h2 className="mb-1 flex items-center gap-2 text-base font-black tracking-tight text-foreground">
          Exceptions accordées à un cabinet
        </h2>
        <p className="mb-4 max-w-prose text-xs text-muted-foreground">
          Ouvre ou retire une fonctionnalité à un seul cabinet, sans toucher à son forfait ni à sa
          facturation. <strong>Donnez une échéance</strong> : une faveur sans date devient un droit
          acquis que personne ne pense à retirer.
        </p>

        <form
          action={executer(accorderException)}
          className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5"
        >
          <label className="text-[11px] font-bold text-muted-foreground">
            Cabinet
            <select name="firmId" required className={cn(CHAMP, "mt-1")}>
              <option value="">—</option>
              {cabinets.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.plan})
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11px] font-bold text-muted-foreground">
            Fonctionnalité
            <select name="feature" required className={cn(CHAMP, "mt-1")}>
              {vendables.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.labelFr}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11px] font-bold text-muted-foreground">
            Sens
            <select name="activer" defaultValue="1" className={cn(CHAMP, "mt-1")}>
              <option value="1">Accorder</option>
              <option value="0">Retirer</option>
            </select>
          </label>
          <label className="text-[11px] font-bold text-muted-foreground">
            Durée (jours)
            <input
              name="jours"
              inputMode="numeric"
              placeholder="sans échéance"
              className={cn(CHAMP, "mt-1 font-mono")}
            />
          </label>
          <label className="text-[11px] font-bold text-muted-foreground">
            Motif (obligatoire)
            <input name="motif" required placeholder="ex : essai convenu" className={cn(CHAMP, "mt-1")} />
          </label>
          <div className="sm:col-span-2 lg:col-span-5">
            <button
              type="submit"
              disabled={enCours}
              className="min-h-9 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              Poser l&apos;exception
            </button>
          </div>
        </form>

        {exceptions.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  <th className="px-4 py-3 font-bold">Cabinet</th>
                  <th className="px-4 py-3 font-bold">Fonctionnalité</th>
                  <th className="px-4 py-3 font-bold">Sens</th>
                  <th className="px-4 py-3 font-bold">Échéance</th>
                  <th className="px-4 py-3 font-bold">Motif</th>
                  <th className="px-4 py-3 font-bold" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {exceptions.map((o) => (
                  <tr key={`${o.firmId}-${o.feature}`} className={cn(o.echue && "opacity-50")}>
                    <td className="px-4 py-3 text-xs font-bold text-foreground">
                      {cabinets.find((c) => c.id === o.firmId)?.name ?? o.firmId.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {fonctionnalites.find((f) => f.key === o.feature)?.labelFr ?? o.feature}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                          o.enabled ? "bg-success/10 text-success" : "bg-error/10 text-error"
                        )}
                      >
                        {o.enabled ? "accordée" : "retirée"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {o.expiresAt ? (o.echue ? `${o.expiresAt} — échue` : o.expiresAt) : "aucune"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{o.reason}</td>
                    <td className="px-4 py-3 text-right">
                      <form action={executer(retirerException)}>
                        <input type="hidden" name="firmId" value={o.firmId} />
                        <input type="hidden" name="feature" value={o.feature} />
                        <button
                          type="submit"
                          disabled={enCours}
                          className="min-h-8 rounded-lg px-2 py-1 text-xs font-bold text-error transition-colors hover:bg-error/10 disabled:opacity-50"
                        >
                          Retirer
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ---------------------------------------------------------------
          Journal
          --------------------------------------------------------------- */}
      <section>
        <h2 className="mb-1 flex items-center gap-2 text-base font-black tracking-tight text-foreground">
          <ScrollText aria-hidden className="h-4 w-4 text-muted-foreground" />
          Journal d&apos;exploitation
        </h2>
        <p className="mb-4 max-w-prose text-xs text-muted-foreground">
          Distinct du journal d&apos;audit des cabinets, qui ne doit accueillir que leurs propres
          gestes. Celui-ci n&apos;est pas modifiable, même par un administrateur.
        </p>

        {journal.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
            Aucun geste consigné pour l&apos;instant.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  <th className="px-4 py-3 font-bold">Quand</th>
                  <th className="px-4 py-3 font-bold">Qui</th>
                  <th className="px-4 py-3 font-bold">Action</th>
                  <th className="px-4 py-3 font-bold">Cabinet</th>
                  <th className="px-4 py-3 font-bold">Détail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {journal.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap text-muted-foreground">
                      {l.occurredAt}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {l.actorEmail}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-foreground">{l.action}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{l.firmName || "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{l.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
