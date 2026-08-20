"use client"

import * as React from "react"
import { useTranslations, useLocale } from "next-intl"
import { useRouter } from "@/i18n/routing"
import {
  Landmark, Plus, Eye, Lock, AlertTriangle, X, Trash2, CheckCircle2, Scale,
} from "lucide-react"
import type { RegistreFideicommis, RapprochementVue, EcartRapprochement } from "@/lib/data/trust"
import {
  enregistrerMouvementFideicommis, enregistrerRapprochement,
  cloreRapprochement, supprimerRapprochement,
} from "@/lib/data/trust-actions"
import { PageHeader } from "@/components/app-shell/page-header"
import { cn } from "@/lib/utils"

/**
 * Le registre du fidéicommis et son rapprochement.
 *
 * DEUX PARTIS PRIS qui gouvernent tout l'écran.
 *
 * 1. LE SOLDE PAR CLIENT EST AUSSI VISIBLE QUE LE TOTAL. Un total juste peut
 *    masquer un client débiteur compensé par un autre — la faute la plus grave
 *    en matière de fidéicommis. La base l'interdit par déclencheur ; l'écran
 *    doit quand même la rendre lisible, parce qu'une règle qu'on ne voit pas
 *    appliquée finit par ne plus être crue.
 *
 * 2. LE RAPPROCHEMENT NE S'ARRÊTE PAS TANT QUE L'ÉCART N'EST PAS EXPLIQUÉ.
 *    Le refus vient du serveur et dit combien il reste à justifier. Un état
 *    conservé avec un écart inexpliqué n'atteste rien.
 */

const TYPES_CONFIG = [
  { valeur: "deposit", labelKey: "typeDeposit", helpKey: "typeDepositHelp", sens: 1 },
  { valeur: "withdrawal", labelKey: "typeWithdrawal", helpKey: "typeWithdrawalHelp", sens: -1 },
  { valeur: "transfer_to_business", labelKey: "typeTransferToBusiness", helpKey: "typeTransferToBusinessHelp", sens: -1 },
  { valeur: "refund_to_client", labelKey: "typeRefundToClient", helpKey: "typeRefundToClientHelp", sens: -1 },
] as const

const CHAMP =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"

export function FideicommisClient({
  registre, clients,
}: {
  registre: RegistreFideicommis
  clients: { id: string; nom: string; numero: string }[]
}) {
  const t = useTranslations("Trust")
  const locale = useLocale()
  const routeur = useRouter()
  const [enCours, demarrer] = React.useTransition()
  const [resultat, setResultat] = React.useState<{ ok: boolean; message: string } | null>(null)
  const [mouvement, setMouvement] = React.useState(false)
  const [rapprochement, setRapprochement] = React.useState<RapprochementVue | "nouveau" | null>(null)

  const argent = React.useCallback(
    (v: number) =>
      new Intl.NumberFormat(locale === "en" ? "en-CA" : "fr-CA", { style: "currency", currency: "CAD" }).format(v),
    [locale]
  )

  const agir = (action: () => Promise<{ ok: boolean; message: string }>) =>
    demarrer(async () => {
      const r = await action()
      setResultat(r)
      if (r.ok) routeur.refresh()
    })

  const debiteurs = registre.parClient.filter((c) => c.solde < 0)
  
  // Règle F25 CICC : Alerte sur les fonds détenus en fidéicommis sans mouvement depuis > 30 jours
  const aujourdhui = new Date()
  const fondsDormants = registre.parClient.filter((c) => {
    if (c.solde <= 0 || !c.dernierMouvement) return false
    const dateMvt = new Date(c.dernierMouvement)
    const diffJours = Math.floor((aujourdhui.getTime() - dateMvt.getTime()) / (1000 * 60 * 60 * 24))
    return diffJours >= 30
  })

  return (
    <div className="flex flex-col gap-6 pb-16">
      {resultat && (
        <div
          role="status"
          className={cn(
            "rounded-2xl border p-4 text-xs font-bold",
            resultat.ok
              ? "border-success/30 bg-success/10 text-success-strong"
              : "border-error/30 bg-error/10 text-error-strong"
          )}
        >
          {resultat.message}
        </div>
      )}

      <PageHeader
        title={t("headerTitle")}
        subtitle={t("headerSubtitle")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setMouvement(true)}
              className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2 text-xs font-bold text-foreground hover:bg-muted cursor-pointer"
            >
              <Plus className="h-4 w-4" /> {t("recordMovement")}
            </button>
            <button
              type="button"
              onClick={() => setRapprochement("nouveau")}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 cursor-pointer"
            >
              <Scale className="h-4 w-4" /> {t("reconcilePeriod")}
            </button>
          </div>
        }
      />

      {/* L'alerte du §F25 : elle ne s'affiche que s'il y a quelque chose à
          rapprocher. Reprocher un retard à un cabinet sans mouvement en
          fidéicommis apprendrait à ignorer l'avertissement. */}
      {registre.suivi.enRetard && (
        <div className="flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4">
          <AlertTriangle aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-warning-strong" />
          <div>
            <p className="text-sm font-black text-warning-strong">
              {registre.suivi.dernierePeriode
                ? t("noReconciliationSinceDays", { days: registre.suivi.joursDepuis })
                : t("noReconciliationEver")}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("monthlyReconciliationWarning")}
            </p>
          </div>
        </div>
      )}

      {debiteurs.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-error/40 bg-error/10 p-4">
          <AlertTriangle aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-error-strong" />
          <p className="text-sm font-black text-error-strong">
            {t("debtorClientsAlert", { count: debiteurs.length })}
          </p>
        </div>
      )}

      {fondsDormants.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4">
          <AlertTriangle aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-warning-strong" />
          <div>
            <p className="text-sm font-black text-warning-strong">
              {t("ciccAlertArt28", { count: fondsDormants.length })}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("ciccAlertArt28Help")}
            </p>
          </div>
        </div>
      )}

      {/* ---- Le solde ---- */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{t("trustBalance")}</p>
          <p className="mt-1 flex items-center gap-2 text-2xl font-black tabular-nums text-foreground">
            <Landmark aria-hidden className="h-5 w-5 text-primary" />
            {argent(registre.soldeTotal)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {t("trustBalanceHelp")}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{t("clientsConcerned")}</p>
          <p className="mt-1 text-2xl font-black tabular-nums text-foreground">{registre.parClient.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{t("lastReconciliation")}</p>
          <p className="mt-1 text-2xl font-black tabular-nums text-foreground">
            {registre.suivi.dernierePeriode ?? "—"}
          </p>
        </div>
      </div>

      {/* ---- Ventilation par client ---- */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-black text-foreground">{t("clientBalanceTitle")}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t("clientBalanceSubtitle")}
        </p>
        {registre.parClient.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            {t("noClientMovements")}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {registre.parClient.map((c) => {
              const estDormant = fondsDormants.some((fd) => fd.clientId === c.clientId)
              return (
                <li key={c.clientId} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-foreground">{c.clientNom}</p>
                      {estDormant && (
                        <span className="rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-warning/15 text-warning-strong border border-warning/30">
                          {t("inactiveOver30d")}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {t("clientEntriesCount", { count: c.ecritures })}{c.dernierMouvement ? t("lastMovementOn", { date: c.dernierMouvement }) : ""}
                    </p>
                  </div>
                  <span className={cn(
                    "shrink-0 text-sm font-black tabular-nums",
                    c.solde < 0 ? "text-error-strong" : "text-foreground"
                  )}>
                    {argent(c.solde)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* ---- Les rapprochements ---- */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-black text-foreground">{t("statementsTitle")}</h2>
        {registre.rapprochements.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            {t("noStatements")}
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {registre.rapprochements.map((r) => {
              const explique = r.ecarts.reduce((t, e) => t + e.montant, 0)
              const residuel = Math.round((r.soldeBancaire + explique - r.soldeRegistre) * 100) / 100
              return (
                <article key={r.id} className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="flex items-center gap-2 text-sm font-black text-foreground">
                        {t("periodEndedOn", { date: r.periodeFin })}
                        <span className={cn(
                          "rounded px-2 py-0.5 text-[10px] font-bold uppercase",
                          r.statut === "closed"
                            ? "bg-success/15 text-success-strong"
                            : "bg-warning/15 text-warning-strong"
                        )}>
                          {r.statut === "closed" ? t("statusClosed") : t("statusDraft")}
                        </span>
                      </h3>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {t("statementSummary", { bank: argent(r.soldeBancaire), ledger: argent(r.soldeRegistre) })}
                        <span className={residuel === 0 ? "text-success-strong font-bold" : "text-error-strong font-bold"}>
                          {t("residualDiscrepancy", { amount: argent(residuel) })}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <a
                      href={`/api/trust/${r.id}/statement?lang=${locale}`}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[11px] font-bold text-foreground hover:bg-muted cursor-pointer"
                    >
                      <Eye className="h-3.5 w-3.5" /> {t("viewStatement")}
                    </a>
                    {r.statut === "draft" && (
                      <>
                        <button
                          type="button"
                          disabled={enCours}
                          onClick={() => setRapprochement(r)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[11px] font-bold text-foreground hover:bg-muted cursor-pointer disabled:opacity-40"
                        >
                          {t("editStatement")}
                        </button>
                        <button
                          type="button"
                          disabled={enCours}
                          onClick={() => agir(() => {
                            const fd = new FormData()
                            fd.set("id", r.id); fd.set("locale", locale)
                            return cloreRapprochement(fd)
                          })}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground hover:bg-primary/90 cursor-pointer disabled:opacity-40"
                        >
                          <Lock className="h-3.5 w-3.5" /> {t("closePeriod")}
                        </button>
                        <button
                          type="button"
                          disabled={enCours}
                          onClick={() => agir(() => {
                            const fd = new FormData()
                            fd.set("id", r.id); fd.set("locale", locale)
                            return supprimerRapprochement(fd)
                          })}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[11px] font-bold text-muted-foreground hover:bg-error/10 hover:text-error-strong cursor-pointer disabled:opacity-40"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> {t("deleteStatement")}
                        </button>
                      </>
                    )}
                    {r.statut === "closed" && (
                      <span className="inline-flex items-center gap-1.5 px-2 text-[11px] font-bold text-muted-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5 text-success-strong" />
                        {t("statementFrozen", { date: r.closLe?.slice(0, 10) ?? "" })}
                      </span>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {/* ---- Le registre ---- */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-black text-foreground">{t("ledgerTitle")}</h2>
        {registre.mouvements.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            {t("noLedgerEntries")}
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-2 pr-3 font-bold">{t("ledgerColDate")}</th>
                  <th className="py-2 pr-3 font-bold">{t("ledgerColClient")}</th>
                  <th className="py-2 pr-3 font-bold">{t("ledgerColMovement")}</th>
                  <th className="py-2 pr-3 font-bold">{t("ledgerColMemo")}</th>
                  <th className="py-2 pl-3 text-right font-bold">{t("ledgerColAmount")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {registre.mouvements.map((m) => {
                  const typeCfg = TYPES_CONFIG.find((tc) => tc.valeur === m.type)
                  return (
                    <tr key={m.id}>
                      <td className="py-2.5 pr-3 font-mono text-muted-foreground">{m.date}</td>
                      <td className="py-2.5 pr-3 font-bold text-foreground">{m.clientNom}</td>
                      <td className="py-2.5 pr-3 text-muted-foreground">
                        {typeCfg ? t(typeCfg.labelKey) : m.type}
                      </td>
                      <td className="py-2.5 pr-3 text-muted-foreground">
                        {m.memo || m.factureNumero || m.dossierReference || "—"}
                      </td>
                      <td className={cn(
                        "py-2.5 pl-3 text-right font-bold tabular-nums",
                        m.montantSigne < 0 ? "text-error-strong" : "text-success-strong"
                      )}>
                        {m.montantSigne < 0 ? "−" : "+"}{argent(m.montant)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {mouvement && (
        <ModaleMouvement
          clients={clients}
          enCours={enCours}
          onFermer={() => setMouvement(false)}
          onEnregistrer={(fd) => agir(async () => {
            const r = await enregistrerMouvementFideicommis(fd)
            if (r.ok) setMouvement(false)
            return r
          })}
        />
      )}

      {rapprochement && (
        <ModaleRapprochement
          existant={rapprochement === "nouveau" ? null : rapprochement}
          soldeRegistre={registre.soldeTotal}
          enCours={enCours}
          onFermer={() => setRapprochement(null)}
          onEnregistrer={(fd) => agir(async () => {
            const r = await enregistrerRapprochement(fd)
            if (r.ok) setRapprochement(null)
            return r
          })}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function ModaleMouvement({
  clients, enCours, onFermer, onEnregistrer,
}: {
  clients: { id: string; nom: string; numero: string }[]
  enCours: boolean
  onFermer: () => void
  onEnregistrer: (fd: FormData) => void
}) {
  const t = useTranslations("Trust")
  const locale = useLocale()
  const [type, setType] = React.useState("deposit")
  const choisi = TYPES_CONFIG.find((tc) => tc.valeur === type)

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[200] flex items-center justify-center bg-foreground/50 p-4">
      <form
        onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); fd.set("locale", locale); onEnregistrer(fd) }}
        className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-2xl border border-border bg-card shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div>
            <h2 className="text-base font-black text-foreground">{t("modalMovementTitle")}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("modalMovementSubtitle")}
            </p>
          </div>
          <button type="button" onClick={onFermer} aria-label={t("close")} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-3 overflow-y-auto p-5">
          <label className="block">
            <span className="text-[11px] font-bold text-muted-foreground">{t("movementNature")}</span>
            <select name="type" value={type} onChange={(e) => setType(e.target.value)} className={cn(CHAMP, "mt-1")}>
              {TYPES_CONFIG.map((tc) => <option key={tc.valeur} value={tc.valeur}>{t(tc.labelKey)}</option>)}
            </select>
            {choisi && <span className="mt-1 block text-[11px] text-muted-foreground">{t(choisi.helpKey)}</span>}
          </label>

          <label className="block">
            <span className="text-[11px] font-bold text-muted-foreground">{t("selectClient")}</span>
            <select name="clientId" required className={cn(CHAMP, "mt-1")} defaultValue="">
              <option value="" disabled>{t("selectClientPlaceholder")}</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.nom}{c.numero ? ` — ${c.numero}` : ""}</option>)}
            </select>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[11px] font-bold text-muted-foreground">{t("amount")}</span>
              <input name="montant" inputMode="decimal" required placeholder="0,00" className={cn(CHAMP, "mt-1 font-mono")} />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold text-muted-foreground">{t("date")}</span>
              <input type="date" name="date" defaultValue={new Date().toISOString().slice(0, 10)} className={cn(CHAMP, "mt-1")} />
            </label>
          </div>

          <label className="block">
            <span className="text-[11px] font-bold text-muted-foreground">{t("memo")}</span>
            <input name="memo" placeholder={t("memoPlaceholder")} className={cn(CHAMP, "mt-1")} />
          </label>

          {choisi?.sens === -1 && (
            <p className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-[11px] text-warning-strong">
              {t("withdrawalConstraintWarning")}
            </p>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-border p-5">
          <button type="button" onClick={onFermer} className="rounded-xl border border-border px-4 py-2 text-xs font-bold text-foreground hover:bg-muted cursor-pointer">
            {t("cancel")}
          </button>
          <button type="submit" disabled={enCours} className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 cursor-pointer">
            {enCours ? t("saving") : t("saveToLedger")}
          </button>
        </footer>
      </form>
    </div>
  )
}

// ---------------------------------------------------------------------------

function ModaleRapprochement({
  existant, soldeRegistre, enCours, onFermer, onEnregistrer,
}: {
  existant: RapprochementVue | null
  soldeRegistre: number
  enCours: boolean
  onFermer: () => void
  onEnregistrer: (fd: FormData) => void
}) {
  const t = useTranslations("Trust")
  const locale = useLocale()
  const finDuMoisDernier = React.useMemo(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 0).toISOString().slice(0, 10)
  }, [])

  const [periode, setPeriode] = React.useState(existant?.periodeFin ?? finDuMoisDernier)
  const [banque, setBanque] = React.useState(String(existant?.soldeBancaire ?? ""))
  const [ecarts, setEcarts] = React.useState<EcartRapprochement[]>(existant?.ecarts ?? [])
  const [notes, setNotes] = React.useState(existant?.notes ?? "")

  const registre = existant?.soldeRegistre ?? soldeRegistre
  const banqueNum = Number(String(banque).replace(",", ".")) || 0
  const explique = ecarts.reduce((t, e) => t + (Number(e.montant) || 0), 0)
  const residuel = Math.round((banqueNum + explique - registre) * 100) / 100

  const argent = (v: number) =>
    new Intl.NumberFormat(locale === "en" ? "en-CA" : "fr-CA", { style: "currency", currency: "CAD" }).format(v)

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[200] flex items-center justify-center bg-foreground/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-card shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div>
            <h2 className="text-base font-black text-foreground">{t("modalReconcileTitle")}</h2>
            <p className="mt-0.5 max-w-prose text-xs text-muted-foreground">
              {t("modalReconcileSubtitle")}
            </p>
          </div>
          <button type="button" onClick={onFermer} aria-label={t("close")} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-4 overflow-y-auto p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-[11px] font-bold text-muted-foreground">{t("periodEnd")}</span>
              <input type="date" value={periode} onChange={(e) => setPeriode(e.target.value)} className={cn(CHAMP, "mt-1")} />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold text-muted-foreground">{t("bankStatementBalance")}</span>
              <input inputMode="decimal" value={banque} onChange={(e) => setBanque(e.target.value)} placeholder="0,00" className={cn(CHAMP, "mt-1 font-mono")} />
            </label>
          </div>

          <div className="rounded-xl border border-border bg-muted/40 p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{t("ledgerBalance")}</span>
              <span className="font-bold tabular-nums text-foreground">{argent(registre)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{t("bankPlusExplained")}</span>
              <span className="font-bold tabular-nums text-foreground">{argent(banqueNum + explique)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-sm">
              <span className="font-black text-foreground">{t("residualDiscrepancyLabel")}</span>
              <span className={cn("font-black tabular-nums", residuel === 0 ? "text-success-strong" : "text-error-strong")}>
                {argent(residuel)}
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground">{t("reconciliationItems")}</span>
              <button
                type="button"
                onClick={() => setEcarts((e) => [...e, { libelle: "", montant: 0 }])}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] font-bold text-foreground hover:bg-muted cursor-pointer"
              >
                <Plus className="h-3 w-3" /> {t("addItem")}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t("reconciliationItemsHelp")}
            </p>
            <div className="mt-2 space-y-2">
              {ecarts.length === 0 && (
                <p className="rounded-lg border border-dashed border-border p-3 text-center text-[11px] text-muted-foreground">
                  {t("noItemsResidualZero")}
                </p>
              )}
              {ecarts.map((e, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={e.libelle}
                    onChange={(ev) => setEcarts((l) => l.map((x, j) => j === i ? { ...x, libelle: ev.target.value } : x))}
                    placeholder={t("reconciliationItemPlaceholder")}
                    className={cn(CHAMP, "flex-1")}
                  />
                  <input
                    value={String(e.montant)}
                    onChange={(ev) => setEcarts((l) => l.map((x, j) => j === i ? { ...x, montant: Number(ev.target.value.replace(",", ".")) || 0 } : x))}
                    inputMode="decimal"
                    className={cn(CHAMP, "w-32 font-mono")}
                  />
                  <button
                    type="button"
                    onClick={() => setEcarts((l) => l.filter((_, j) => j !== i))}
                    aria-label={t("removeItem")}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-error/10 hover:text-error-strong cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="text-[11px] font-bold text-muted-foreground">{t("notes")}</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={cn(CHAMP, "mt-1 resize-y")} />
          </label>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-border p-5">
          <button type="button" onClick={onFermer} className="rounded-xl border border-border px-4 py-2 text-xs font-bold text-foreground hover:bg-muted cursor-pointer">
            {t("cancel")}
          </button>
          <button
            type="button"
            disabled={enCours}
            onClick={() => {
              const fd = new FormData()
              if (existant) fd.set("id", existant.id)
              fd.set("periodeFin", periode)
              fd.set("soldeBancaire", banque)
              fd.set("ecarts", JSON.stringify(ecarts))
              fd.set("notes", notes)
              fd.set("locale", locale)
              onEnregistrer(fd)
            }}
            className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 cursor-pointer"
          >
            {enCours ? t("saving") : t("saveReconciliation")}
          </button>
        </footer>
      </div>
    </div>
  )
}
