import type { AdminSubscriptionRow } from "@/lib/data/admin"
import { formatMontant, libelle, montant, type EtatCommercial, type Plan } from "@/lib/billing/plans"
import { cn } from "@/lib/utils"

/**
 * La couleur suit ce qu'il faut FAIRE, pas la gravité : orange quand une
 * action du client est attendue, rouge quand l'accès est compromis.
 */
const TON: Record<EtatCommercial, string> = {
  actif: "bg-success/10 text-success",
  courtoisie: "bg-success/10 text-success",
  essai: "bg-primary/10 text-primary",
  "resiliation-prevue": "bg-warning/15 text-warning-strong",
  "attente-souscription": "bg-warning/15 text-warning-strong",
  "attente-paiement": "bg-warning/15 text-warning-strong",
  "paiement-echoue": "bg-error/10 text-error",
  "essai-echu": "bg-error/10 text-error",
  suspendu: "bg-error/10 text-error",
  annule: "bg-muted text-muted-foreground",
  "en-pause": "bg-muted text-muted-foreground",
  "sans-abonnement": "bg-muted text-muted-foreground",
}

/**
 * Statut commercial et abonnement d'un cabinet, pour sa ligne de console.
 *
 * Le prix est celui du catalogue pour ce forfait, cette périodicité et ces
 * places — le même calcul que le bloc financier. Tout ce qui vient de Stripe
 * (échéance, moyen de paiement, identifiants) n'est affiché que si le webhook
 * l'a écrit : une offre en attente n'en a pas, et l'écran ne l'invente pas.
 */
export function EtatAbonnement({
  etat,
  abonnement,
  catalogue,
  langue,
  t,
}: {
  etat: EtatCommercial
  abonnement: AdminSubscriptionRow | null
  catalogue: Plan[]
  langue: string
  t: (cle: string) => string
}) {
  const forfait = abonnement ? catalogue.find((p) => p.key === abonnement.plan) : undefined
  const cadence = abonnement?.cadence === "annual" ? "annual" : "monthly"
  // Sans abonnement chez Stripe, la ligne n'est qu'une offre : rien n'est payé.
  const offre = !abonnement?.stripeSubscriptionId

  return (
    <div className="mt-1 space-y-1">
      <span
        className={cn(
          "inline-flex rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
          TON[etat]
        )}
      >
        {t(`etat_${etat}`)}
      </span>

      {/* Sans le catalogue (lecture échouée, forfait retiré), la clé du forfait
          tient lieu de libellé et le prix est tu : ce que Stripe a écrit —
          sursis, carte, identifiants — reste affiché. */}
      {abonnement && (
        <dl className="space-y-0.5 text-[10px] leading-relaxed text-muted-foreground">
          <div>
            <dt className="inline">{offre ? t("subOffer") : t("subPlan")} : </dt>
            <dd className="inline font-bold text-foreground">
              {forfait ? libelle(forfait, langue) : abonnement.plan} ·{" "}
              {cadence === "annual" ? t("cadenceAnnual") : t("cadenceMonthly")} ·{" "}
              {forfait && `${formatMontant(montant(forfait, cadence, abonnement.seats), langue)} · `}
              {abonnement.seats} {t("subSeats")}
            </dd>
          </div>
          {abonnement.currentPeriodEnd && (
            <div>
              <dt className="inline">{t("subNext")} : </dt>
              <dd className="inline font-mono">{abonnement.currentPeriodEnd}</dd>
            </div>
          )}
          {abonnement.graceUntil && (
            <div className="text-error">
              <dt className="inline">{t("subGrace")} : </dt>
              <dd className="inline font-mono">{abonnement.graceUntil}</dd>
            </div>
          )}
          {abonnement.paymentLast4 && (
            <div>
              <dt className="inline">{t("subPayment")} : </dt>
              <dd className="inline font-mono">•••• {abonnement.paymentLast4}</dd>
            </div>
          )}
          {(abonnement.stripeCustomerId || abonnement.stripeSubscriptionId) && (
            <div className="break-all font-mono">
              <dt className="sr-only">Stripe</dt>
              <dd>
                {abonnement.stripeCustomerId}
                {abonnement.stripeSubscriptionId && ` · ${abonnement.stripeSubscriptionId}`}
              </dd>
            </div>
          )}
        </dl>
      )}
    </div>
  )
}
