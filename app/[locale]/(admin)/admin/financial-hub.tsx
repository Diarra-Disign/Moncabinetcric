"use client"

import * as React from "react"
import { 
  TrendingUp, 
  DollarSign, 
  CreditCard, 
  Percent, 
  Tag, 
  Copy, 
  Check, 
  Mail, 
  Clock, 
  Sparkles
} from "lucide-react"
import type { AdminFirmRow } from "@/lib/data/admin"

interface FinancialHubProps {
  firms: AdminFirmRow[]
}

const PLAN_PRICES: Record<string, number> = {
  trial: 0,
  solo: 149,
  cabinet: 299,
  courtoisie: 0,
}

const COUPONS = [
  { code: "CICC-MEMBRE-20", label: "20% Réduction Permanence CICC", discount: "20% Off" },
  { code: "CAPIC-PROMO-1M", label: "1 Mois d'Essai Offert CAPIC", discount: "1 Mois Gratuit" },
  { code: "LANCEMENT-2026", label: "Tarif Préférentiel Lancement 2026", discount: "-50$/mois" },
]

export function FinancialHub({ firms }: FinancialHubProps) {
  const [copiedLink, setCopiedLink] = React.useState<string | null>(null)
  const [selectedPlan, setSelectedPlan] = React.useState<string>("solo")
  const [selectedCoupon, setSelectedCoupon] = React.useState<string>("CICC-MEMBRE-20")
  const [notice, setNotice] = React.useState<string | null>(null)

  // Calculs Financiers SaaS
  const mrr = firms.reduce((sum, f) => sum + (PLAN_PRICES[f.plan] ?? 0), 0)
  const arr = mrr * 12
  const paidFirms = firms.filter(f => f.plan === "solo" || f.plan === "cabinet")
  const arpu = paidFirms.length > 0 ? mrr / paidFirms.length : 0

  const trialFirms = firms.filter(f => f.plan === "trial")
  const conversionRate = firms.length > 0 ? Math.round((paidFirms.length / firms.length) * 100) : 0

  // Offres & Génération de liens Stripe
  const handleGenerateStripeLink = () => {
    const baseUrl = selectedPlan === "cabinet" 
      ? "https://buy.stripe.com/test_moncabinetcric_cabinet" 
      : "https://buy.stripe.com/test_moncabinetcric_solo"
    const finalUrl = `${baseUrl}?prefilled_promo_code=${selectedCoupon}`
    
    navigator.clipboard.writeText(finalUrl)
    setCopiedLink(finalUrl)
    setNotice(`💳 Lien Stripe avec coupon ${selectedCoupon} copié dans le presse-papier !`)
    setTimeout(() => setNotice(null), 5000)
  }

  return (
    <div className="space-y-6">
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
            {mrr.toLocaleString("fr-CA")} <span className="text-sm font-normal text-indigo-300">CAD / mo</span>
          </p>
          <div className="mt-2 flex items-center gap-1 text-[11px] text-emerald-400 font-bold">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Revenu récurrent mensuel</span>
          </div>
        </div>

        {/* ARR */}
        <div className="rounded-2xl border border-slate-200 bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">ARR (Projeté Annuel)</span>
            <div className="h-8 w-8 rounded-xl bg-muted flex items-center justify-center text-foreground">
              <Sparkles className="w-4 h-4 text-amber-500" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-black tabular-nums tracking-tight text-foreground">
            {arr.toLocaleString("fr-CA")} <span className="text-sm font-normal text-muted-foreground">CAD / an</span>
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">MRR × 12 mois</p>
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
            {Math.round(arpu).toLocaleString("fr-CA")} <span className="text-sm font-normal text-muted-foreground">CAD</span>
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">{paidFirms.length} cabinet(s) payant(s)</p>
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

      {/* 2. Générateur de Liens de Paiement & Code Promo Stripe CICC */}
      <div className="rounded-3xl border border-indigo-100 bg-gradient-to-r from-indigo-50/80 via-white to-slate-50 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-2xl bg-indigo-900 text-white flex items-center justify-center font-bold shrink-0">
            <Tag className="w-5 h-5 text-indigo-300" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900">Générateur de Liens Stripe avec Codes Promo CICC / CAPIC</h3>
            <p className="text-xs text-slate-500">Créez et copiez des liens de checkout Stripe pré-remplis avec réductions pour les consultants.</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3 items-end">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Forfait Cible</label>
            <select
              value={selectedPlan}
              onChange={(e) => setSelectedPlan(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              <option value="solo">Forfait Solo (149 $ CAD / mo)</option>
              <option value="cabinet">Forfait Cabinet (299 $ CAD / mo)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Code Promotionnel CICC / CAPIC</label>
            <select
              value={selectedCoupon}
              onChange={(e) => setSelectedCoupon(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              {COUPONS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.label} ({c.discount})
                </option>
              ))}
            </select>
          </div>

          <div>
            <button
              type="button"
              onClick={handleGenerateStripeLink}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-900 hover:bg-indigo-950 text-white text-xs font-bold shadow-md shadow-indigo-900/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Copy className="w-4 h-4 text-indigo-300" />
              <span>Générer & Copier le Lien Stripe</span>
            </button>
          </div>
        </div>

        {copiedLink && (
          <div className="mt-4 p-3 rounded-xl bg-white border border-indigo-200 font-mono text-[11px] text-indigo-950 flex items-center justify-between gap-2 overflow-hidden">
            <span className="truncate">{copiedLink}</span>
            <span className="shrink-0 font-sans font-bold text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">Copié</span>
          </div>
        )}
      </div>

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
                    href={`mailto:${f.email}?subject=Suite à votre période d'essai sur MonCabinetCRIC&body=Bonjour ${f.ownerName},%0D%0A%0D%0ANous espérons que votre essai de MonCabinetCRIC se passe au mieux.%0D%0A%0D%0APour poursuivre l'utilisation sans interruption, vous pouvez activer votre abonnement via le lien sécurisé Stripe ci-dessous :%0D%0Ahttps://buy.stripe.com/test_moncabinetcric_solo?prefilled_promo_code=CICC-MEMBRE-20%0D%0A%0D%0AUn code de réduction de 20% CICC y est pré-appliqué.%0D%0A%0D%0ACordialement,%0D%0AL'Équipe MonCabinetCRIC`}
                    className="flex-1 sm:flex-none px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-xs font-bold text-foreground transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Relancer par courriel</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => {
                      const link = `https://buy.stripe.com/test_moncabinetcric_solo?prefilled_promo_code=CICC-MEMBRE-20`
                      navigator.clipboard.writeText(link)
                      setNotice(`💳 Lien de paiement Stripe copié pour ${f.name} !`)
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
    </div>
  )
}
