"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import {
  AlertTriangle,
  Building2,
  Check,
  CreditCard,
  Landmark,
  Lock,
  Receipt,
  User,
  Users,
} from "lucide-react"
import { PageHeader } from "@/components/app-shell/page-header"
import type { AbonnementVue } from "@/lib/data/subscription"
import {
  ouvrirPaiement,
  ouvrirPortail,
  type ResultatPaiement,
} from "@/lib/data/subscription-actions"
import {
  accroche,
  economieAnnuelle,
  equivalentMensuel,
  formatMontant,
  libelle,
  type Cadence,
  type Plan,
} from "@/lib/billing/plans"
import { cn } from "@/lib/utils"

interface SubscriptionClientProps {
  estProprietaire: boolean
  paiementConfigure: boolean
  abonnement: AbonnementVue
  /**
   * Forfaits souscriptibles, lus dans `plan_limits` par le composant serveur.
   *
   * Passés en propriétés plutôt qu'importés d'une constante : les prix vivent
   * en base et se modifient depuis la console d'exploitation. Un catalogue
   * figé dans le paquet client rendrait tout changement de tarif dépendant
   * d'un déploiement — et laisserait l'écran afficher un prix pendant que
   * Stripe en facturerait un autre.
   */
  plans: Plan[]
}

/** Correspondance des statuts Stripe vers une clé de traduction. */
const CLE_STATUT: Record<string, string> = {
  trialing: "statusTrialing",
  active: "statusActive",
  past_due: "statusPastDue",
  unpaid: "statusUnpaid",
  canceled: "statusCanceled",
  incomplete: "statusIncomplete",
  incomplete_expired: "statusIncompleteExpired",
  paused: "statusPaused",
}

/**
 * Phrases de vente, par clé de forfait.
 *
 * Un forfait ajouté depuis la console sans entrée ici s'affiche avec ses
 * places et son prix, sans liste d'avantages — dégradation volontaire. Une
 * liste inventée par défaut serait pire : elle promettrait ce que le forfait
 * ne donne pas.
 */
const AVANTAGES: Record<string, string[]> = {
  solo: ["solo2", "solo3", "solo4", "solo5", "solo6"],
  cabinet: ["cabinet2", "cabinet3", "cabinet4", "cabinet5"],
  business: ["cabinet2", "cabinet3", "cabinet4", "cabinet5"],
}

const TON_STATUT: Record<string, string> = {
  trialing: "bg-primary/10 text-primary-strong",
  active: "bg-success/10 text-success",
  past_due: "bg-warning/10 text-warning",
  unpaid: "bg-error/10 text-error",
  canceled: "bg-error/10 text-error",
  paused: "bg-muted text-muted-foreground",
}

export function SubscriptionClient({
  estProprietaire,
  paiementConfigure,
  abonnement,
  plans,
}: SubscriptionClientProps) {
  const t = useTranslations("Subscription")
  const locale = useLocale()
  const params = useSearchParams()

  const [cadence, setCadence] = React.useState<Cadence>(
    abonnement.cadence === "annual" ? "annual" : "monthly"
  )
  const [resultat, setResultat] = React.useState<ResultatPaiement | null>(null)
  const [enCours, demarrer] = React.useTransition()

  const prix = (cents: number) => formatMontant(cents, locale)

  // Un abonnement n'est considéré valide et en cours que si Stripe l'a confirmé
  // (status = active, trialing, past_due, unpaid, paused). Les statuts incomplete,
  // incomplete_expired ou canceled ne bloquent pas le choix des formules.
  const aUnAbonnementValide =
    abonnement.existe &&
    ["active", "trialing", "past_due", "unpaid", "paused"].includes(abonnement.statut)

  // Une action qui renvoie une adresse Stripe ne rend pas la main : la page
  // suivante est hébergée chez eux. La redirection est faite ici plutôt que
  // par redirect() côté serveur, afin que l'échec s'affiche sur cet écran
  // au lieu de produire une page d'erreur sans contexte.
  const lancer = (action: (fd: FormData) => Promise<ResultatPaiement>) => (fd: FormData) =>
    demarrer(async () => {
      fd.set("langue", locale)
      const r = await action(fd)
      setResultat(r)
      if (r.ok && r.url) window.location.href = r.url
    })

  const retour = params.get("paiement")

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {retour === "ok" && <Avis ton="success" texte={t("returnedOk")} />}
      {retour === "annule" && <Avis ton="muted" texte={t("returnedCancelled")} />}
      {!paiementConfigure && <Avis ton="warning" texte={t("notConfigured")} />}

      {/* ---------------------------------------------------------------
          État de l'abonnement en cours
          --------------------------------------------------------------- */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                aUnAbonnementValide && abonnement.statut === "active"
                  ? "bg-success/15 text-success"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <Receipt aria-hidden className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-sm font-black text-foreground">
                {aUnAbonnementValide
                  ? t("currentTitle")
                  : t("none")}
              </h2>
              {aUnAbonnementValide ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-bold text-foreground">
                    {libelle(
                      plans.find((p) => p.key === abonnement.plan) ?? plans[0],
                      locale
                    )}
                  </span>
                  <span aria-hidden>·</span>
                  <span>
                    {abonnement.cadence === "annual" ? t("cadenceAnnual") : t("cadenceMonthly")}
                  </span>
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                      TON_STATUT[abonnement.statut] ?? "bg-muted text-muted-foreground"
                    )}
                  >
                    {t(CLE_STATUT[abonnement.statut] ?? "statusIncomplete")}
                  </span>
                </div>
              ) : (
                <p className="mt-1 max-w-prose text-xs leading-relaxed text-muted-foreground">
                  {t("noneBody")}
                </p>
              )}
            </div>
          </div>

          {estProprietaire && aUnAbonnementValide && (
            <form action={lancer(ouvrirPortail)}>
              <button
                type="submit"
                disabled={enCours}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-4 py-2 text-xs font-bold text-foreground transition-colors hover:bg-muted disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <CreditCard aria-hidden className="h-4 w-4" />
                {enCours ? t("opening") : t("manage")}
              </button>
            </form>
          )}
        </div>

        {aUnAbonnementValide && (
          <dl className="mt-5 grid gap-4 border-t border-border pt-4 sm:grid-cols-3">
            <Donnee
              libelle={t("nextCharge")}
              valeur={abonnement.finDePeriode || "—"}
              icone={<Receipt aria-hidden className="h-3.5 w-3.5" />}
            />
            <Donnee
              libelle={t("paymentMethod")}
              valeur={
                abonnement.moyenPaiement === "card"
                  ? t("methodCard", { last4: abonnement.quatreDerniers || "••••" })
                  : t("methodPending")
              }
              icone={<CreditCard aria-hidden className="h-3.5 w-3.5" />}
            />
            <Donnee
              libelle={t("seats")}
              valeur={t("seatsUsage", {
                used: abonnement.placesOccupees,
                total: abonnement.placesMax === null ? t("seatsUnlimited") : abonnement.placesMax,
              })}
              icone={<Users aria-hidden className="h-3.5 w-3.5" />}
              note={t("seatsPending")}
            />
          </dl>
        )}

        {/* Ces deux avis sont les seuls moments où l'écran doit être lu. Ils
            portent une date, parce qu'« bientôt » ne permet à personne de
            s'organiser. */}
        {abonnement.resiliationDemandee && abonnement.finDePeriode && (
          <div className="mt-4">
            <Avis ton="warning" texte={t("cancelNotice", { date: abonnement.finDePeriode })} />
          </div>
        )}
        {abonnement.delaiDeGrace && (
          <div className="mt-4">
            <Avis ton="error" texte={t("graceNotice", { date: abonnement.delaiDeGrace })} />
          </div>
        )}

        {/* Le succès s'affiche aussi, et pas seulement l'échec. Un changement
            de forfait ne redirige plus vers Stripe : sans cet avis, l'écran
            ne renvoyait plus rien du tout, et l'opération réussie passait
            pour une opération sans effet. */}
        {resultat && !resultat.url && (
          <div className="mt-4">
            <Avis ton={resultat.ok ? "success" : "error"} texte={resultat.message} />
          </div>
        )}
      </section>

      {/* ---------------------------------------------------------------
          Choix de la formule
          --------------------------------------------------------------- */}
      {estProprietaire ? (
        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-black tracking-tight text-foreground">
              {aUnAbonnementValide ? t("changeTitle") : t("subscribe")}
            </h2>

            <div
              role="radiogroup"
              aria-label={t("cadenceMonthly") + " / " + t("cadenceAnnual")}
              className="inline-flex items-center gap-1 rounded-xl border border-border bg-card p-1"
            >
              {(["monthly", "annual"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={cadence === c}
                  onClick={() => setCadence(c)}
                  className={cn(
                    "min-h-10 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    cadence === c
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {c === "monthly" ? t("cadenceMonthly") : t("cadenceAnnual")}
                  {c === "annual" && (
                    <span className="ml-1.5 rounded bg-success/15 px-1.5 py-0.5 text-[10px] font-bold text-success">
                      {t("cadenceSaving")}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div
            className={cn(
              "grid gap-4",
              plans.length > 2 ? "lg:grid-cols-3" : "lg:grid-cols-2"
            )}
          >
            {plans.map((p) => (
              <CartePlan
                key={p.key}
                plan={p}
                cadence={cadence}
                // La CADENCE entre dans la comparaison. Sans elle, un cabinet
                // au mensuel voyait sa propre carte désactivée après avoir
                // basculé sur « Annuel » : le seul bouton menant à l'annuel
                // était celui qu'on venait de lui interdire.
                actuel={
                  aUnAbonnementValide &&
                  abonnement.plan === p.key &&
                  abonnement.cadence === cadence
                }
                dejaAbonne={aUnAbonnementValide}
                enCours={enCours}
                desactive={!paiementConfigure}
                prix={prix}
                locale={locale}
                onSoumettre={lancer(ouvrirPaiement)}
              />
            ))}
          </div>

          {/* Ce qui vaut pour les deux formules est dit une fois, en dessous,
              plutôt que dupliqué dans chaque carte : répété, on le lit comme
              un argument de vente ; isolé, on le lit comme un socle. */}
          <div className="mt-4 rounded-2xl border border-border bg-muted/40 p-5">
            <h3 className="text-xs font-black text-foreground">{t("commonTitle")}</h3>
            <ul className="mt-2 grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-2">
              {["common1", "common2", "common3", "common4"].map((k) => (
                <li key={k} className="flex items-start gap-2">
                  <Check aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                  {t(k)}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 space-y-2 text-xs leading-relaxed text-muted-foreground">
            <p className="flex items-start gap-2">
              <Landmark aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {t("methodsNote")}
            </p>
            <p className="flex items-start gap-2">
              <Lock aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {t("dataNote")}
            </p>
            <p className="flex items-start gap-2">
              <Receipt aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {t("taxNote")}
            </p>
          </div>
        </section>
      ) : (
        <Avis ton="muted" texte={t("ownerOnly")} />
      )}
    </div>
  )
}

function CartePlan({
  plan,
  cadence,
  actuel,
  dejaAbonne,
  enCours,
  desactive,
  prix,
  locale,
  onSoumettre,
}: {
  plan: Plan
  cadence: Cadence
  /** Ce forfait ET cette cadence sont ceux en cours. */
  actuel: boolean
  /** Le cabinet a un abonnement : le bouton propose un changement, pas un achat. */
  dejaAbonne: boolean
  enCours: boolean
  desactive: boolean
  prix: (cents: number) => string
  locale: string
  onSoumettre: (fd: FormData) => void
}) {
  const t = useTranslations("Subscription")

  // Les avantages viennent des traductions par clé de forfait : ce sont des
  // phrases de vente, pas des droits. Les droits, eux, sont dans
  // plan_features et c'est firm_has_feature() qui les applique — un écran
  // n'accorde rien.
  const avantages = AVANTAGES[plan.key] ?? []

  return (
    <form
      action={onSoumettre}
      className={cn(
        "flex flex-col rounded-2xl border bg-card p-5",
        actuel ? "border-primary" : "border-border"
      )}
    >
      <input type="hidden" name="plan" value={plan.key} />
      <input type="hidden" name="cadence" value={cadence} />

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            {plan.seatsIncluded === 1 ? (
              <User aria-hidden className="h-5 w-5" />
            ) : (
              <Building2 aria-hidden className="h-5 w-5" />
            )}
          </span>
          <div>
            <h3 className="text-sm font-black text-foreground">{libelle(plan, locale)}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{accroche(plan, locale)}</p>
          </div>
        </div>
        {actuel && (
          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-strong">
            {t("currentBadge")}
          </span>
        )}
      </div>

      <div className="mt-5">
        <p className="flex items-baseline gap-1.5">
          <span className="text-3xl font-black tabular-nums tracking-tight text-foreground">
            {prix(cadence === "annual" ? equivalentMensuel(plan) : plan.monthly ?? 0)}
          </span>
          <span className="text-xs font-bold text-muted-foreground">{t("perMonth")}</span>
        </p>
        {/* L'annuel s'affiche en équivalent mensuel : comparer 490 $ à 49 $ ne
            veut rien dire, et c'est la comparaison que fait l'œil. */}
        <p className="mt-1 min-h-8 text-xs text-muted-foreground">
          {cadence === "annual"
            ? t("annualSaving", { price: prix(economieAnnuelle(plan)) })
            : plan.extraSeatMonthly > 0
              ? t("extraSeat", { price: prix(plan.extraSeatMonthly) })
              : ""}
        </p>
      </div>

      <ul className="mt-4 flex-1 space-y-1.5 text-xs text-muted-foreground">
        <li className="flex items-start gap-2">
          <Check aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
          {t("seatsIncluded", { n: plan.seatsIncluded })}
        </li>
        {avantages.map((k) => (
          <li key={k} className="flex items-start gap-2">
            <Check aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
            {t(k)}
          </li>
        ))}
      </ul>

      {/* Le bouton soumet le formulaire, toujours. Il ouvrait auparavant, quand
          le paiement n'était pas configuré, une adresse buy.stripe.com
          fabriquée de toutes pièces — qui n'existait sur aucun compte Stripe.
          Le formulaire n'était alors jamais soumis : aucun forfait ne pouvait
          être choisi, dans un sens comme dans l'autre, et l'onglet ouvert
          affichait une page introuvable sans explication. */}
      <button
        type="submit"
        disabled={enCours || actuel || desactive}
        title={desactive ? t("unavailable") : undefined}
        className={cn(
          "mt-5 inline-flex min-h-10 w-full items-center justify-center rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 shadow-xs",
          actuel
            ? "border border-border bg-muted text-muted-foreground cursor-not-allowed"
            : plan.aiConnector || plan.key === "cabinet" || plan.key === "business"
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "border border-border text-foreground hover:bg-muted"
        )}
      >
        {enCours
          ? t("opening")
          : actuel
            ? t("currentBadge")
            : dejaAbonne
              ? t("changePlan")
              : t("subscribe")}
      </button>
    </form>
  )
}

function Donnee({
  libelle,
  valeur,
  icone,
  note,
}: {
  libelle: string
  valeur: string
  icone: React.ReactNode
  note?: string
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {icone}
        {libelle}
      </dt>
      <dd className="mt-1 text-sm font-bold text-foreground">{valeur}</dd>
      {note && <p className="mt-0.5 text-[11px] text-muted-foreground">{note}</p>}
    </div>
  )
}

function Avis({ ton, texte }: { ton: "success" | "warning" | "error" | "muted"; texte: string }) {
  const styles = {
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    error: "bg-error/10 text-error",
    muted: "bg-muted text-muted-foreground",
  }
  return (
    <p
      role="status"
      className={cn(
        "flex items-start gap-2 rounded-xl px-4 py-3 text-xs font-bold leading-relaxed",
        styles[ton]
      )}
    >
      {ton === "success" ? (
        <Check aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" />
      ) : (
        <AlertTriangle aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" />
      )}
      {texte}
    </p>
  )
}
