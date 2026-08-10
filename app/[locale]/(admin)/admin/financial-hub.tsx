"use client"

import * as React from "react"
import Link from "next/link"
import { 
  TrendingUp, 
  DollarSign, 
  CreditCard, 
  Percent, 
  Check, 
  Mail, 
  Clock, 
  Settings,
} from "lucide-react"
import type { AdminFirmRow, AdminSubscriptionRow } from "@/lib/data/admin"
import { montant, formatMontant, type Cadence, type Plan } from "@/lib/billing/plans"

/**
 * Statuts d'abonnement qui produisent du revenu récurrent.
 *
 * « trialing » en est exclu : une période d'essai n'a encore rien encaissé,
 * et la compter gonflerait le MRR de clients qui peuvent tous partir avant
 * le premier prélèvement. « past_due » y figure au contraire : la somme est
 * due, le contrat court, et le cabinet garde son accès pendant le délai de
 * grâce — c'est du revenu en retard, pas du revenu disparu.
 */
const STATUTS_FACTURES = ["active", "past_due"]

/**
 * Revenu mensuel d'un abonnement, en cents.
 *
 * Le montant vient de `montant()` — la même fonction qui construit la
 * facture Stripe, places supplémentaires comprises. Le tableau de bord ne
 * refait donc aucun calcul de prix : il ne peut pas afficher un chiffre
 * d'affaires que personne n'a payé.
 *
 * L'annuel est ramené au mois. Sans cette division, un abonné annuel
 * comptait pour douze fois sa contribution réelle dans le MRR.
 */
function revenuMensuelCents(s: AdminSubscriptionRow | null, catalogue: Plan[]): number {
  if (!s || !STATUTS_FACTURES.includes(s.status)) return 0
  // Le forfait est cherché dans le catalogue en base : un palier ajouté depuis
  // la console entre dans le calcul sans qu'on touche à ce fichier.
  const p = catalogue.find((x) => x.key === s.plan)
  if (!p || p.monthly === null) return 0
  const total = montant(p, s.cadence as Cadence, s.seats)
  return s.cadence === "annual" ? Math.round(total / 12) : total
}

interface FinancialHubProps {
  firms: AdminFirmRow[]
  /** Catalogue lu en base par la page serveur. */
  catalogue: Plan[]
}

export interface CouponItem {
  id: string
  code: string
  label: string
  discount: string
}

export interface PlanItem {
  id: string
  key: string
  name: string
  price: number
  isSystem?: boolean
}

export function FinancialHub({ firms, catalogue }: FinancialHubProps) {
  // Chemin relatif, stable entre SSR et client — pas de branche
  // `typeof window` qui fabriquerait un href différent et ferait échouer
  // l'hydratation.
  const lienAbonnement = "/fr/settings/subscription"

  // Config dynamique et modifiable des forfaits (Ajout, Modification, Suppression)

  // Formulaire d'ajout de nouveau forfait

  // Liste modifiable des codes promo

  // Modals et formulaire d'ajout promo

  const [notice, setNotice] = React.useState<string | null>(null)

  // Calculs financiers, en cents et à partir des abonnements Stripe.
  //
  // La version précédente sommait le prix du plan porté par `firms.plan` —
  // celui que la console accorde à la main. Un cabinet qui résiliait gardait
  // « cabinet » jusqu'au prochain événement Stripe et continuait de compter
  // 79 $ ; un cabinet suspendu aussi. Le revenu affiché ne pouvait que
  // surestimer, et jamais se corriger de lui-même.
  const mrr = firms.reduce((sum, f) => sum + revenuMensuelCents(f.subscription, catalogue), 0)
  const arr = mrr * 12
  const paidFirms = firms.filter((f) => revenuMensuelCents(f.subscription, catalogue) > 0)
  const arpu = paidFirms.length > 0 ? Math.round(mrr / paidFirms.length) : 0

  const trialFirms = firms.filter((f) => f.plan === "trial")
  const conversionRate = firms.length > 0 ? Math.round((paidFirms.length / firms.length) * 100) : 0

  // Ce qui demande une intervention : prélèvement échoué, ou résiliation
  // annoncée. Deux situations distinctes, mais qui appellent toutes deux un
  // appel avant l'échéance.
  const enRetard = firms.filter(
    (f) => f.subscription && ["past_due", "unpaid"].includes(f.subscription.status)
  )
  const resiliations = firms.filter((f) => f.subscription?.cancelAtPeriodEnd)

  // Offres & Génération de liens Stripe

  // Ajout de nouveau forfait

  // Modification du prix d'un forfait

  // Modification du nom d'un forfait

  // Suppression d'un forfait

  // Ajout de code promo

  // Suppression de code promo

  return (
    <div className="space-y-6">
      {/* En-tête avec bouton de gestion dynamique des forfaits */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/40 p-4 rounded-2xl border border-border">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold">
            <DollarSign className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <span className="text-xs font-black text-foreground">Tarifs et forfaits ({catalogue.length})</span>
            <p className="text-[11px] text-muted-foreground flex flex-wrap gap-2 mt-0.5">
              {catalogue.map((p) => (
                <span key={p.key} className="bg-background px-2 py-0.5 rounded border border-border font-mono text-[10px]">
                  <strong>{p.labelFr}</strong>{" : "}
                  {p.monthly === null ? "sur mesure" : `${formatMontant(p.monthly, "fr")}/mois`}
                </span>
              ))}
            </p>
          </div>
        </div>

        {/* Ce bouton ouvrait un modal qui modifiait un tableau en mémoire :
            rien n'était enregistré, et un prix corrigé revenait à sa valeur
            d'origine au premier rafraîchissement. Il mène désormais à l'écran
            qui écrit vraiment dans plan_limits. */}
        <Link
          href="/fr/admin/catalogue"
          className="px-3.5 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-xs font-bold text-foreground transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
        >
          <Settings className="w-3.5 h-3.5 text-indigo-600" />
          <span>Forfaits et fonctionnalités</span>
        </Link>
      </div>

      {/* 1. KPIs Financiers SaaS */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* MRR */}
        <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-900 to-slate-900 p-5 text-white shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-300">MRR (Revenu Mensuel)</span>
            <div className="h-8 w-8 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-300">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-black tabular-nums tracking-tight">
            {formatMontant(mrr, "fr")} <span className="text-sm font-normal text-indigo-300">CAD / mois</span>
          </p>
          {/* Ce que compte le chiffre est dit sous le chiffre : « abonnements
              en cours » est vérifiable, « basé sur N forfaits configurés » ne
              renseignait sur rien. */}
          <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-emerald-400">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>
              {paidFirms.length} abonnement(s) facturé(s)
              {enRetard.length > 0 && `, dont ${enRetard.length} en retard`}
            </span>
          </div>
        </div>

        {/* ARR */}
        <div className="rounded-2xl border border-slate-200 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">ARR (Projeté Annuel)</span>
            <div className="h-8 w-8 rounded-xl bg-muted flex items-center justify-center text-foreground">
            </div>
          </div>
          <p className="mt-3 text-3xl font-black tabular-nums tracking-tight text-foreground">
            {formatMontant(arr, "fr")} <span className="text-sm font-normal text-muted-foreground">CAD / an</span>
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            MRR × 12, à composition constante — ce n&apos;est pas un encaissement prévu
          </p>
        </div>

        {/* ARPU */}
        <div className="rounded-2xl border border-slate-200 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">ARPU (Revenu Moyen / Cabinet)</span>
            <div className="h-8 w-8 rounded-xl bg-muted flex items-center justify-center text-foreground">
              <CreditCard className="w-4 h-4 text-indigo-600" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-black tabular-nums tracking-tight text-foreground">
            {formatMontant(arpu, "fr")} <span className="text-sm font-normal text-muted-foreground">CAD</span>
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {paidFirms.length} cabinet(s) payant(s)
            {resiliations.length > 0 && ` · ${resiliations.length} résiliation(s) annoncée(s)`}
          </p>
        </div>

        {/* Taux de conversion */}
        <div className="rounded-2xl border border-slate-200 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">Conversion Essai → Payant</span>
            <div className="h-8 w-8 rounded-xl bg-muted flex items-center justify-center text-foreground">
              <Percent className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-black tabular-nums tracking-tight text-foreground">
            {conversionRate}%
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">{trialFirms.length} cabinet(s) en essai</p>
        </div>
      </div>

      {/* Notice Toast */}
      {notice && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center justify-between shadow-xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{notice}</span>
          </div>
        </div>
      )}

      {/* Le générateur de liens de paiement et la gestion des codes promo ont
          été retirés. Le premier fabriquait des adresses par concaténation
          (« buy.stripe.com/test_moncabinetcric_solo » n'est pas un format
          d'identifiant Stripe) : le bouton annonçait « copié » et le lien ne
          menait nulle part. Les seconds — CICC-MEMBRE-20, CAPIC-PROMO-1M,
          LANCEMENT-2026 — vivaient en état React et n'ont jamais existé chez
          Stripe : un confrère à qui on les communiquait se faisait refuser au
          paiement. Les coupons Stripe se créent dans leur tableau de bord, et
          Checkout les accepte déjà sans code de notre côté. */}
{/* 3. Moniteur de Dunning / Relance d'Essais et Échéances */}
      <div className="rounded-3xl border border-border bg-card p-6 shadow-xs">
        <h3 className="text-base font-black tracking-tight text-foreground mb-1 flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-500" />
          <span>Suivi des Périodes d&apos;Essai & Relances de Paiement</span>
        </h3>
        <p className="text-xs text-muted-foreground mb-4">Cabinets en cours d&apos;essai gratuit nécessitant un suivi commercial ou une relance d&apos;abonnement.</p>

        {trialFirms.length === 0 ? (
          <div className="p-6 rounded-2xl border border-dashed border-border text-center text-xs text-muted-foreground">
            Aucun cabinet actuellement en période d&apos;essai expirante. Tous les cabinets sont actifs.
          </div>
        ) : (
          <div className="space-y-3">
            {trialFirms.map((f) => (
              <div key={f.id} className="p-4 rounded-2xl border border-border bg-muted/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <strong className="text-xs font-bold text-foreground">{f.name}</strong>
                    <span className="font-mono text-[10px] bg-amber-500/10 text-amber-600 border border-amber-500/20 px-2 py-0.5 rounded font-bold uppercase">
                      Essai (30 jours)
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Contact : {f.ownerName} ({f.email || "courriel non renseigné"})
                  </p>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <a
                    href={`mailto:${f.email}?subject=Suite à votre période d'essai sur MonCabinetCRIC&body=Bonjour ${f.ownerName},%0D%0A%0D%0ANous espérons que votre essai de MonCabinetCRIC se passe au mieux.%0D%0A%0D%0APour poursuivre l'utilisation sans interruption, vous pouvez activer votre abonnement via le lien sécurisé Stripe ci-dessous :%0D%0A${lienAbonnement}%0D%0A%0D%0AVous y choisirez votre formule et votre moyen de paiement.%0D%0A%0D%0ACordialement,%0D%0AL'Équipe MonCabinetCRIC`}
                    className="flex-1 sm:flex-none px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-xs font-bold text-foreground transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Relancer par courriel</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => {
                      const link = lienAbonnement
                      navigator.clipboard.writeText(link)
                      setNotice(`💳 Lien vers l'écran d'abonnement copié pour ${f.name}.`)
                      setTimeout(() => setNotice(null), 5000)
                    }}
                    className="flex-1 sm:flex-none px-3 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Lien Stripe</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL GESTION DYNAMIQUE DES FORFAITS (MODIFIER, AJOUTER, SUPPRIMER) */}
      

      {/* MODAL CRÉATION NOUVEAU CODE PROMO */}
      
    </div>
  )
}
