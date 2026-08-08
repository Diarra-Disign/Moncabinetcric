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
  Sparkles,
  Plus,
  Trash2,
  Settings,
  ShieldCheck,
  Package
} from "lucide-react"
import type { AdminFirmRow } from "@/lib/data/admin"

interface FinancialHubProps {
  firms: AdminFirmRow[]
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

export function FinancialHub({ firms }: FinancialHubProps) {
  // Config dynamique et modifiable des forfaits (Ajout, Modification, Suppression)
  const [plans, setPlans] = React.useState<PlanItem[]>([
    { id: "p-solo", key: "solo", name: "Forfait Solo", price: 49, isSystem: true },
    { id: "p-cabinet", key: "cabinet", name: "Forfait Cabinet Pro", price: 79, isSystem: true },
    { id: "p-trial", key: "trial", name: "Période d'Essai (30 jours)", price: 0, isSystem: true },
    { id: "p-courtoisie", key: "courtoisie", name: "Forfait Courtoisie / Partenaire", price: 0, isSystem: true },
  ])
  const [showEditPricesModal, setShowEditPricesModal] = React.useState(false)

  // Formulaire d'ajout de nouveau forfait
  const [showAddPlanForm, setShowAddPlanForm] = React.useState(false)
  const [newPlanName, setNewPlanName] = React.useState("")
  const [newPlanPrice, setNewPlanPrice] = React.useState<number>(99)

  // Liste modifiable des codes promo
  const [coupons, setCoupons] = React.useState<CouponItem[]>([
    { id: "c1", code: "CICC-MEMBRE-20", label: "20% Réduction Permanence CICC", discount: "20% Off" },
    { id: "c2", code: "CAPIC-PROMO-1M", label: "1 Mois d'Essai Offert CAPIC", discount: "1 Mois Gratuit" },
    { id: "c3", code: "LANCEMENT-2026", label: "Tarif Préférentiel Lancement 2026", discount: "-15 $/mois" },
  ])

  // Modals et formulaire d'ajout promo
  const [showAddCouponModal, setShowAddCouponModal] = React.useState(false)
  const [newCode, setNewCode] = React.useState("")
  const [newLabel, setNewLabel] = React.useState("")
  const [newDiscount, setNewDiscount] = React.useState("")

  const [copiedLink, setCopiedLink] = React.useState<string | null>(null)
  const [selectedPlanKey, setSelectedPlanKey] = React.useState<string>("solo")
  const [selectedCouponCode, setSelectedCouponCode] = React.useState<string>("CICC-MEMBRE-20")
  const [notice, setNotice] = React.useState<string | null>(null)

  // Helper pour trouver le prix d'un forfait
  const getPlanPrice = (planKey: string): number => {
    const found = plans.find((p) => p.key === planKey)
    return found ? found.price : 0
  }

  // Calculs Financiers SaaS Réactifs
  const mrr = firms.reduce((sum, f) => sum + getPlanPrice(f.plan), 0)
  const arr = mrr * 12
  const paidFirms = firms.filter((f) => getPlanPrice(f.plan) > 0)
  const arpu = paidFirms.length > 0 ? mrr / paidFirms.length : 0

  const trialFirms = firms.filter((f) => f.plan === "trial")
  const conversionRate = firms.length > 0 ? Math.round((paidFirms.length / firms.length) * 100) : 0

  // Offres & Génération de liens Stripe
  const handleGenerateStripeLink = () => {
    const activePlan = plans.find((p) => p.key === selectedPlanKey) || plans[0]
    const baseUrl = `https://buy.stripe.com/test_moncabinetcric_${activePlan.key}`
    const finalUrl = `${baseUrl}?prefilled_promo_code=${selectedCouponCode}`
    
    navigator.clipboard.writeText(finalUrl)
    setCopiedLink(finalUrl)
    setNotice(`💳 Lien Stripe (${activePlan.name} - ${activePlan.price} $ CAD) avec coupon ${selectedCouponCode} copié !`)
    setTimeout(() => setNotice(null), 5000)
  }

  // Ajout de nouveau forfait
  const handleAddPlan = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPlanName.trim()) return

    const key = newPlanName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_")
    const newPlan: PlanItem = {
      id: `plan-${Date.now()}`,
      key,
      name: newPlanName.trim(),
      price: Number(newPlanPrice) || 0,
      isSystem: false,
    }

    setPlans((prev) => [...prev, newPlan])
    setSelectedPlanKey(key)
    setNewPlanName("")
    setNewPlanPrice(99)
    setShowAddPlanForm(false)
    setNotice(`✨ NOUVEAU FORFAIT "${newPlan.name}" (${newPlan.price} $ CAD/mo) CRÉÉ ET AJOUTÉ !`)
    setTimeout(() => setNotice(null), 5000)
  }

  // Modification du prix d'un forfait
  const handleUpdatePrice = (id: string, newPrice: number) => {
    setPlans((prev) =>
      prev.map((p) => (p.id === id ? { ...p, price: Math.max(0, newPrice) } : p))
    )
  }

  // Modification du nom d'un forfait
  const handleUpdateName = (id: string, newName: string) => {
    setPlans((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name: newName } : p))
    )
  }

  // Suppression d'un forfait
  const handleDeletePlan = (id: string, name: string) => {
    if (plans.length <= 1) {
      alert("Il faut au moins garder un forfait actif.")
      return
    }
    setPlans((prev) => prev.filter((p) => p.id !== id))
    setNotice(`🗑️ Forfait "${name}" supprimé.`)
    setTimeout(() => setNotice(null), 5000)
  }

  // Ajout de code promo
  const handleAddCoupon = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCode.trim()) return

    const formattedCode = newCode.trim().toUpperCase().replace(/\s+/g, "-")
    const newCouponItem: CouponItem = {
      id: `coupon-${Date.now()}`,
      code: formattedCode,
      label: newLabel.trim() || "Remise promotionnelle",
      discount: newDiscount.trim() || "Réduction spéciale",
    }

    setCoupons((prev) => [...prev, newCouponItem])
    setSelectedCouponCode(formattedCode)
    setShowAddCouponModal(false)
    setNewCode("")
    setNewLabel("")
    setNewDiscount("")
    setNotice(`🏷️ NOUVEAU CODE PROMO ${formattedCode} CRÉÉ ET ACTIVÉ !`)
    setTimeout(() => setNotice(null), 5000)
  }

  // Suppression de code promo
  const handleDeleteCoupon = (id: string, code: string) => {
    setCoupons((prev) => prev.filter((c) => c.id !== id))
    if (selectedCouponCode === code && coupons.length > 1) {
      const remaining = coupons.filter((c) => c.id !== id)
      if (remaining[0]) setSelectedCouponCode(remaining[0].code)
    }
    setNotice(`🗑️ Code promo ${code} supprimé avec succès.`)
    setTimeout(() => setNotice(null), 5000)
  }

  return (
    <div className="space-y-6">
      {/* En-tête avec bouton de gestion dynamique des forfaits */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/40 p-4 rounded-2xl border border-border">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold">
            <DollarSign className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <span className="text-xs font-black text-foreground">Gestion des Tarifs & Forfaits SaaS ({plans.length})</span>
            <p className="text-[11px] text-muted-foreground flex flex-wrap gap-2 mt-0.5">
              {plans.map((p) => (
                <span key={p.id} className="bg-background px-2 py-0.5 rounded border border-border font-mono text-[10px]">
                  <strong>{p.name}</strong> : {p.price} $ CAD/mo
                </span>
              ))}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowEditPricesModal(true)}
          className="px-3.5 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-xs font-bold text-foreground transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
        >
          <Settings className="w-3.5 h-3.5 text-indigo-600" />
          <span>Gérer / Modifier / Ajouter les Forfaits</span>
        </button>
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
            {mrr.toLocaleString("fr-CA")} <span className="text-sm font-normal text-indigo-300">CAD / mo</span>
          </p>
          <div className="mt-2 flex items-center gap-1 text-[11px] text-emerald-400 font-bold">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Basé sur {plans.length} forfait(s) configuré(s)</span>
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

      {/* 2. Générateur de Liens de Paiement & Gestion Dynamique des Coupons Stripe */}
      <div className="rounded-3xl border border-indigo-100 bg-gradient-to-r from-indigo-50/80 via-white to-slate-50 p-6 shadow-sm space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-indigo-900 text-white flex items-center justify-center font-bold shrink-0">
              <Tag className="w-5 h-5 text-indigo-300" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Générateur & Gestion des Codes Promo Stripe</h3>
              <p className="text-xs text-slate-500">Ajoutez, supprimez et appliquez des codes promotionnels (CICC, CAPIC, etc.) sur les liens de paiement.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowAddCouponModal(true)}
            className="px-4 py-2 rounded-xl bg-indigo-900 hover:bg-indigo-950 text-white text-xs font-bold transition-all shadow-md shadow-indigo-900/20 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-indigo-300" />
            <span>Créer un Code Promo</span>
          </button>
        </div>

        {/* Liste interactive des codes promo actifs */}
        <div>
          <label className="block text-slate-500 font-bold text-[10px] uppercase mb-2">Codes Promotionnels Actifs ({coupons.length})</label>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {coupons.map((c) => (
              <div
                key={c.id}
                onClick={() => setSelectedCouponCode(c.code)}
                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                  selectedCouponCode === c.code
                    ? "border-indigo-600 bg-indigo-50/80 shadow-xs"
                    : "border-slate-200 bg-white hover:border-indigo-300"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-extrabold text-indigo-900">{c.code}</span>
                    <span className="text-[10px] font-bold bg-indigo-200/80 text-indigo-900 px-1.5 py-0.2 rounded">{c.discount}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">{c.label}</p>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteCoupon(c.id, c.code)
                  }}
                  title="Supprimer ce code promo"
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors shrink-0 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Formulaire de Génération du lien de paiement */}
        <div className="grid gap-4 md:grid-cols-3 items-end pt-2">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Forfait Cible</label>
            <select
              value={selectedPlanKey}
              onChange={(e) => setSelectedPlanKey(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              {plans.map((p) => (
                <option key={p.id} value={p.key}>
                  {p.name} ({p.price} $ CAD / mo)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Code Promo Appliqué</label>
            <select
              value={selectedCouponCode}
              onChange={(e) => setSelectedCouponCode(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600"
            >
              {coupons.map((c) => (
                <option key={c.id} value={c.code}>
                  {c.code} — {c.label} ({c.discount})
                </option>
              ))}
            </select>
          </div>

          <div>
            <button
              type="button"
              onClick={handleGenerateStripeLink}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-950 text-white text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Copy className="w-4 h-4 text-indigo-300" />
              <span>Générer & Copier le Lien Stripe</span>
            </button>
          </div>
        </div>

        {copiedLink && (
          <div className="p-3 rounded-xl bg-white border border-indigo-200 font-mono text-[11px] text-indigo-950 flex items-center justify-between gap-2 overflow-hidden">
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
                    href={`mailto:${f.email}?subject=Suite à votre période d'essai sur MonCabinetCRIC&body=Bonjour ${f.ownerName},%0D%0A%0D%0ANous espérons que votre essai de MonCabinetCRIC se passe au mieux.%0D%0A%0D%0APour poursuivre l'utilisation sans interruption, vous pouvez activer votre abonnement via le lien sécurisé Stripe ci-dessous :%0D%0Ahttps://buy.stripe.com/test_moncabinetcric_solo?prefilled_promo_code=${selectedCouponCode}%0D%0A%0D%0AUn code de réduction y est pré-appliqué.%0D%0A%0D%0ACordialement,%0D%0AL'Équipe MonCabinetCRIC`}
                    className="flex-1 sm:flex-none px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-xs font-bold text-foreground transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Relancer par courriel</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => {
                      const link = `https://buy.stripe.com/test_moncabinetcric_solo?prefilled_promo_code=${selectedCouponCode}`
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

      {/* MODAL GESTION DYNAMIQUE DES FORFAITS (MODIFIER, AJOUTER, SUPPRIMER) */}
      {showEditPricesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-4 animate-fadeIn" onClick={() => setShowEditPricesModal(false)}>
          <div className="bg-white w-full max-w-xl rounded-3xl border border-slate-200 shadow-2xl p-6 flex flex-col gap-4 overflow-hidden max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-indigo-900 text-white flex items-center justify-center font-bold">
                  <Package className="w-4 h-4 text-indigo-300" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Gestion des Tarifs & Forfaits SaaS</h3>
                  <p className="text-xs text-slate-500">Modifiez le nom et le prix des forfaits existants, ou ajoutez/supprimez de nouvelles formules.</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowEditPricesModal(false)} className="w-8 h-8 rounded-full bg-slate-100 font-bold flex items-center justify-center cursor-pointer">✕</button>
            </div>

            <div className="overflow-y-auto space-y-4 pr-1 text-xs">
              {/* Liste des forfaits configurés */}
              <div className="space-y-3">
                <label className="block text-slate-500 font-bold text-[10px] uppercase">Forfaits Actuels ({plans.length})</label>
                {plans.map((p) => (
                  <div key={p.id} className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50 flex items-center gap-3">
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Nom du Forfait</label>
                        <input
                          type="text"
                          value={p.name}
                          onChange={(e) => handleUpdateName(p.id, e.target.value)}
                          className="w-full p-2 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Prix ($ CAD / mois)</label>
                        <input
                          type="number"
                          min={0}
                          value={p.price}
                          onChange={(e) => handleUpdatePrice(p.id, Number(e.target.value))}
                          className="w-full p-2 bg-white border border-slate-300 rounded-xl font-bold font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeletePlan(p.id, p.name)}
                      title="Supprimer ce forfait"
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer shrink-0 mt-3"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Formulaire d'ajout de nouveau forfait */}
              {showAddPlanForm ? (
                <form onSubmit={handleAddPlan} className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <strong className="text-xs font-bold text-indigo-950">➕ Créer un Nouveau Forfait SaaS</strong>
                    <button type="button" onClick={() => setShowAddPlanForm(false)} className="text-[11px] text-slate-500 hover:text-slate-800 font-bold">Annuler</button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Nom du Forfait (ex: Enterprise)</label>
                      <input
                        type="text"
                        required
                        value={newPlanName}
                        onChange={(e) => setNewPlanName(e.target.value)}
                        placeholder="ex: Forfait Réseau Multi-Cabinets"
                        className="w-full p-2 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">Prix Mensuel ($ CAD / mo)</label>
                      <input
                        type="number"
                        required
                        min={0}
                        value={newPlanPrice}
                        onChange={(e) => setNewPlanPrice(Number(e.target.value))}
                        className="w-full p-2 bg-white border border-slate-300 rounded-xl font-bold font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 bg-indigo-900 hover:bg-indigo-950 text-white font-bold rounded-xl text-xs transition-all cursor-pointer"
                  >
                    Ajouter ce Forfait
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowAddPlanForm(true)}
                  className="w-full py-2.5 rounded-2xl border border-dashed border-indigo-300 bg-indigo-50/50 hover:bg-indigo-100 text-indigo-900 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-indigo-600" />
                  <span>Ajouter une nouvelle formule / Forfait personnalisé</span>
                </button>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowEditPricesModal(false)
                  setNotice("⚙️ Configuration des forfaits enregistrée avec succès.")
                  setTimeout(() => setNotice(null), 5000)
                }}
                className="px-6 py-2.5 rounded-xl bg-indigo-900 hover:bg-indigo-950 text-white font-bold text-xs transition-all cursor-pointer shadow-md"
              >
                Fermer et Appliquer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CRÉATION NOUVEAU CODE PROMO */}
      {showAddCouponModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-4 animate-fadeIn" onClick={() => setShowAddCouponModal(false)}>
          <div className="bg-white w-full max-w-md rounded-3xl border border-slate-200 shadow-2xl p-6 flex flex-col gap-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-indigo-900 text-white flex items-center justify-center font-bold">
                  <Tag className="w-4 h-4 text-indigo-300" />
                </div>
                <h3 className="text-base font-black text-slate-900">Ajouter un Code Promotionnel</h3>
              </div>
              <button type="button" onClick={() => setShowAddCouponModal(false)} className="w-8 h-8 rounded-full bg-slate-100 font-bold flex items-center justify-center cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleAddCoupon} className="space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Code Promotionnel (ex: CAPIC-PROMO-2026)</label>
                <input
                  type="text"
                  required
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  placeholder="ex: CICC-SPECIAL-15"
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-bold font-mono text-slate-900 uppercase focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description / Intitulé</label>
                <input
                  type="text"
                  required
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="ex: Remise 15% pour membres CAPIC"
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Montant / Type de Réduction</label>
                <input
                  type="text"
                  required
                  value={newDiscount}
                  onChange={(e) => setNewDiscount(e.target.value)}
                  placeholder="ex: -15 $/mo ou 20% Off"
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddCouponModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-900 hover:bg-indigo-950 text-white font-bold transition-all cursor-pointer"
                >
                  Créer le Code Promo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
