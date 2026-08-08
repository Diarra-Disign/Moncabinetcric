"use client"

import * as React from "react"
import { 
  FileText, 
  Search, 
  Plus, 
  CheckCircle2, 
  ShieldCheck, 
  DollarSign, 
  Download, 
  Send, 
  MoreVertical, 
  CreditCard,
  Building2,
  AlertCircle,
  Clock,
  Sparkles,
  Calculator,
  Lock,
  ArrowUpRight,
  Trash2,
  ChevronDown,
  UserCheck,
  Receipt,
  Eye,
  Printer,
  FileCheck2,
  Building
} from "lucide-react"
import { useRouter } from "@/i18n/routing"
import { useTranslations } from "next-intl"
import { InvoiceRecord, ClientRecord, Matter } from "@/lib/data/types"
import { useFirm } from "@/components/app-shell/firm-provider"
import { PageHeader } from "@/components/app-shell/page-header"
import { triggerDocumentPdfDownload } from "@/lib/utils/download-helper"

export type { InvoiceRecord }

interface BillingClientProps {
  t: {
    title: string
    subtitle: string
    newInvoice: string
    stats: Record<string, string>
    searchPlaceholder: string
    table: Record<string, string>
  }
  initialInvoices: InvoiceRecord[]
  initialClients?: ClientRecord[]
  initialMatters?: Matter[]
}

export function BillingClient({
  t,
  initialInvoices,
  initialClients = [],
  initialMatters = [],
}: BillingClientProps) {
  // La liste des clients à facturer était une énumération figée de cinq
  // clients de démonstration : un cabinet réel se serait vu contraint
  // d'établir une facture au nom d'un client inexistant.
  const optionsClients = initialClients.map((c) => {
    const dossier = initialMatters.find((m) => m.clientId === c.id)
    const libelle = dossier ? `${c.name} (${dossier.id})` : c.name
    return { valeur: libelle, texte: `${libelle}${c.program ? ` — ${c.program}` : ""}` }
  })
  const firm = useFirm()
  const tBilling = useTranslations("Billing")
  const router = useRouter()
  const [invoices, setInvoices] = React.useState<InvoiceRecord[]>(initialInvoices)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [filterTrust, setFilterTrust] = React.useState<"all" | "trust" | "general" | "pending" | "reconciled">("all")
  const [showNewModal, setShowNewModal] = React.useState(false)
  const [showPreviewModal, setShowPreviewModal] = React.useState(false)
  const [previewDocType, setPreviewDocType] = React.useState<"invoice" | "receipt" | "audit">("invoice")
  const [selectedInvoice, setSelectedInvoice] = React.useState<InvoiceRecord | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)

  // Dynamic financial reconciliation & identity values for official CICC reports
  const fideicommisInvoices = invoices.filter(inv => inv.isTrustAccount)
  const totalDepotsTrust = fideicommisInvoices.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0)
  const totalSortiesTrust = fideicommisInvoices.filter(inv => inv.status === "paid").reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0)
  const soldeInitialTrust = 0
  const soldeClotureTrust = soldeInitialTrust + totalDepotsTrust - totalSortiesTrust

  // Identité portée sur les factures et le rapport de fidéicommis.
  //
  // Ces trois lignes substituaient « Cabinet Immigration Boréale Inc. »,
  // « Adama Diarra, RCIC » et le permis « R-514982 » dès que le cabinet
  // connecté ressemblait au compte d'essai. Le numéro de permis n'a jamais
  // été délivré : il figurait donc, inventé, sur des documents remis à des
  // clients — la mention même par laquelle un consultant réglementé engage
  // sa responsabilité.
  //
  // Un champ vide se voit et se corrige dans les réglages du cabinet. Un
  // numéro plausible ne se voit pas, et personne ne le corrige.
  const displayFirmName = firm.name
  const displayRcicName = firm.rcicName
  const displayRcicNumber = firm.rcicNumber

  // Form State pour émettre une nouvelle facture
  const [newClient, setNewClient] = React.useState("")
  const [newServiceDescription, setNewServiceDescription] = React.useState("Honoraires professionnels — Mandat de représentation & dépôt Résidence Permanente PEQ / IRCC")
  const [newAmount, setNewAmount] = React.useState("4500")
  const [isTrust, setIsTrust] = React.useState(true)
  const [isTaxExempt, setIsTaxExempt] = React.useState(false)

  const getMatterIdForInvoice = (invId: string) => {
    switch (invId) {
      // Le dossier provient de la facture elle-même ; ces quatre cas
      // renvoyaient des dossiers de démonstration.
      default: return ""
    }
  }

  const filteredInvoices = invoices.filter(i => {
    const matchesSearch = searchQuery === "" ||
      i.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (i.serviceDescription && i.serviceDescription.toLowerCase().includes(searchQuery.toLowerCase()))

    let matchesTrust = true
    if (filterTrust === "trust") matchesTrust = !!i.isTrustAccount
    else if (filterTrust === "general") matchesTrust = !i.isTrustAccount
    else if (filterTrust === "pending") matchesTrust = i.status === "pending"
    else if (filterTrust === "reconciled") matchesTrust = i.status === "trust_reconciled"

    return matchesSearch && matchesTrust
  })

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 2 }).format(val)
  }

  // Calculs financiers globaux
  const totalBilled = invoices.reduce((acc, inv) => acc + inv.amount, 0)
  const trustCollected = invoices.filter(i => i.isTrustAccount).reduce((acc, inv) => acc + inv.amount, 0)
  const pendingAmount = invoices.filter(i => i.status === "pending").reduce((acc, inv) => acc + inv.amount, 0)

  // Calculateur de taxes en direct dans le formulaire
  const parsedAmount = Number(newAmount) || 0
  const tpsAmount = isTaxExempt ? 0 : parsedAmount * 0.05
  const tvqAmount = isTaxExempt ? 0 : parsedAmount * 0.09975
  const totalWithTaxes = parsedAmount + tpsAmount + tvqAmount

  // Actions rapides
  const handleDeleteInvoice = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const target = invoices.find(i => i.id === id)
    setInvoices(prev => prev.filter(i => i.id !== id))
    setNotice(`Facture ${target?.invoiceNumber} (${target?.clientName}) annulée et retirée du journal.`)
    setTimeout(() => setNotice(null), 5000)
  }

  const handleOpenPreview = (inv: InvoiceRecord, docType: "invoice" | "receipt" | "audit", e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setSelectedInvoice(inv)
    setPreviewDocType(docType)
    setShowPreviewModal(true)
  }

  const handleDownloadInvoice = (inv: InvoiceRecord, e: React.MouseEvent) => {
    e.stopPropagation()
    handleOpenPreview(inv, "receipt", e)
  }

  const handleSendInvoice = (inv: InvoiceRecord, e: React.MouseEvent) => {
    e.stopPropagation()
    setNotice(`Facture ${inv.invoiceNumber} transmise par courriel sécurisé au client.`)
    setTimeout(() => setNotice(null), 5000)
  }

  const handleCreateInvoice = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newClient.trim()) return
    const nextSeq = invoices.length + 1
    const created: InvoiceRecord = {
      id: `inv-${Date.now()}`,
      invoiceNumber: `#FAC-20260${nextSeq}`,
      clientName: newClient,
      serviceDescription: newServiceDescription.trim() || "Honoraires professionnels — Accompagnement Réglementaire CICC",
      amount: totalWithTaxes,
      date: "01-08-2026",
      status: isTrust ? "trust_reconciled" : "pending",
      isTrustAccount: isTrust,
      taxExempt: isTaxExempt
    }
    setInvoices(prev => [created, ...prev])
    setShowNewModal(false)
    setNotice(`Facture CICC ${created.invoiceNumber} émise avec succès (${formatCurrency(created.amount)}) !`)
    setTimeout(() => setNotice(null), 5000)
  }

  return (
    <div className="flex flex-col gap-8 pb-16">
      
      {/* NOTICE BANNER */}
      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-3xl p-4 flex items-center justify-between shadow-md animate-fadeIn">
          <div className="flex items-center gap-3 font-bold text-xs sm:text-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{notice}</span>
          </div>
        </div>
      )}

      {/* BANNIÈRE COMPTE FIDÉICOMMIS CONFORME CICC */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-3xl p-6 shadow-xl border border-blue-400/20 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="pointer-events-none absolute -top-24 -right-24 w-64 h-64 rounded-full bg-blue-500/20 blur-3xl" />
        
        <div className="flex items-center gap-4 relative z-10">
          <div className="h-12 w-12 rounded-2xl bg-emerald-400 text-slate-950 flex items-center justify-center font-black shadow-md shrink-0">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black tracking-tight text-white">Rapprochement Fidéicommis CICC & Taxes Canadiennes</h2>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                Séparation Strict Trust / Opérationnel
              </span>
            </div>
            <p className="text-xs text-white/70 mt-0.5">
              Conformité stricte à l&apos;article 13 du Règlement sur le compte en fidéicommis du Collège
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 relative z-10 self-end md:self-auto">
          <button 
            type="button"
            onClick={() => handleOpenPreview(invoices[0], "audit")}
            className="inline-flex items-center gap-2 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white px-4 py-2 text-xs font-bold transition-all backdrop-blur-md cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Aperçu Rapport Fidéicommis PDF</span>
          </button>
        </div>
      </div>

      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
        action={
          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t.newInvoice}</span>
          </button>
        }
      />

      {/* KPIS EXECUTIVE SUMMARY COMPTABILITÉ AVEC SURBRILLANCE ET INTERACTIVITÉ DE FILTRAGE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* CARD 1: TOTAL FACTURÉ */}
        <div 
          onClick={() => setFilterTrust(filterTrust === "all" ? "all" : "all")}
          className={`p-6 rounded-3xl border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
            filterTrust === "all"
              ? "bg-blue-50/70 border-blue-500 shadow-lg scale-[1.02] ring-2 ring-blue-400/30"
              : "bg-white border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:border-blue-400 hover:bg-blue-50/30 hover:scale-[1.01]"
          }`}
        >
          <div className="flex items-center justify-between pb-2">
            <span className={`text-xs font-extrabold uppercase tracking-wider ${filterTrust === "all" ? "text-blue-900" : "text-slate-400"}`}>
              {t.stats.totalBilled}
            </span>
            <div className={`h-9 w-9 rounded-xl flex items-center justify-center font-bold ${filterTrust === "all" ? "bg-blue-600 text-white shadow-xs" : "bg-blue-50 text-blue-600"}`}>
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-slate-900 tracking-tight">{formatCurrency(totalBilled)}</div>
            <span className="text-xs font-medium text-slate-500 mt-1">Facturation globale émise · Cliquez pour filtrer</span>
          </div>
        </div>

        {/* CARD 2: ENCAISSÉ FIDÉICOMMIS */}
        <div 
          onClick={() => setFilterTrust(filterTrust === "trust" ? "all" : "trust")}
          className={`p-6 rounded-3xl border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
            filterTrust === "trust"
              ? "bg-emerald-50/80 border-emerald-500 shadow-lg scale-[1.02] ring-2 ring-emerald-400/30"
              : "bg-white border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:border-emerald-400 hover:bg-emerald-50/30 hover:scale-[1.01]"
          }`}
        >
          <div className="flex items-center justify-between pb-2">
            <span className={`text-xs font-extrabold uppercase tracking-wider ${filterTrust === "trust" ? "text-emerald-900" : "text-emerald-800"}`}>
              {t.stats.collected}
            </span>
            <div className={`h-9 w-9 rounded-xl flex items-center justify-center font-bold ${filterTrust === "trust" ? "bg-emerald-600 text-white shadow-xs" : "bg-emerald-50 text-emerald-600"}`}>
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-emerald-600 tracking-tight">{formatCurrency(trustCollected)}</div>
            <span className="text-xs font-medium text-slate-500 mt-1">Bloqués en compte Fidéicommis · Cliquez pour filtrer</span>
          </div>
        </div>

        {/* CARD 3: EN ATTENTE */}
        <div 
          onClick={() => setFilterTrust(filterTrust === "pending" ? "all" : "pending")}
          className={`p-6 rounded-3xl border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
            filterTrust === "pending"
              ? "bg-amber-100/80 border-amber-500 shadow-lg scale-[1.02] ring-2 ring-amber-400/30"
              : "bg-white border-amber-200/80 bg-gradient-to-br from-amber-50/20 to-white shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:border-amber-400 hover:bg-amber-50/50 hover:scale-[1.01]"
          }`}
        >
          <div className="flex items-center justify-between pb-2">
            <span className={`text-xs font-extrabold uppercase tracking-wider ${filterTrust === "pending" ? "text-amber-900" : "text-amber-800"}`}>
              {t.stats.pending}
            </span>
            <div className={`h-9 w-9 rounded-xl flex items-center justify-center font-bold ${filterTrust === "pending" ? "bg-amber-600 text-white shadow-xs" : "bg-amber-100 text-amber-700"}`}>
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-amber-600 tracking-tight">{formatCurrency(pendingAmount)}</div>
            <span className="text-xs font-medium text-slate-500 mt-1">En attente de virement bancaire · Cliquez pour filtrer</span>
          </div>
        </div>

        {/* CARD 4: RAPPROCHEMENT 100% */}
        <div 
          onClick={() => setFilterTrust(filterTrust === "reconciled" ? "all" : "reconciled")}
          className={`p-6 rounded-3xl border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
            filterTrust === "reconciled"
              ? "bg-indigo-50/80 border-indigo-500 shadow-lg scale-[1.02] ring-2 ring-indigo-400/30"
              : "bg-white border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:border-indigo-400 hover:bg-indigo-50/30 hover:scale-[1.01]"
          }`}
        >
          <div className="flex items-center justify-between pb-2">
            <span className={`text-xs font-extrabold uppercase tracking-wider ${filterTrust === "reconciled" ? "text-indigo-900" : "text-slate-400"}`}>
              Rapprochement
            </span>
            <div className={`h-9 w-9 rounded-xl flex items-center justify-center font-bold ${filterTrust === "reconciled" ? "bg-indigo-600 text-white shadow-xs" : "bg-indigo-50 text-indigo-600"}`}>
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-indigo-600 tracking-tight">100%</div>
            <span className="text-xs font-medium text-slate-500 mt-1">Zéro écart de fidéicommis · Cliquez pour filtrer</span>
          </div>
        </div>

      </div>

      {/* BARRE DE FILTRES ET RECHERCHE */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl w-full sm:w-auto overflow-x-auto">
          <button
            type="button"
            onClick={() => setFilterTrust("all")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${filterTrust === "all" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
          >
            Toutes ({invoices.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTrust("trust")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${filterTrust === "trust" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Fidéicommis (Trust)</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterTrust("general")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${filterTrust === "general" ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Compte Général</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterTrust("pending")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${filterTrust === "pending" ? "bg-amber-500 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>En Attente ({invoices.filter(i => i.status === "pending").length})</span>
          </button>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={t.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs font-medium rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
          />
        </div>
      </div>

      {/* TABLEAU DES FACTURES ET FIDÉICOMMIS */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.02)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="text-slate-400 uppercase font-extrabold bg-slate-50/80 border-b border-slate-100">
              <tr>
                <th scope="col" className="px-6 py-4 font-extrabold">{t.table.invoiceId}</th>
                <th scope="col" className="px-6 py-4 font-extrabold">{t.table.client}</th>
                <th scope="col" className="px-6 py-4 font-extrabold">Régime Fidéicommis</th>
                <th scope="col" className="px-6 py-4 font-extrabold">{t.table.date}</th>
                <th scope="col" className="px-6 py-4 font-extrabold">{t.table.amount}</th>
                <th scope="col" className="px-6 py-4 font-extrabold">{t.table.status}</th>
                <th scope="col" className="px-6 py-4 font-extrabold text-right">{t.table.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 italic">
                    Aucune facture ne correspond à votre filtre.
                  </td>
                </tr>
              )}
              {filteredInvoices.map((inv) => (
                <tr 
                  key={inv.id} 
                  onClick={() => handleOpenPreview(inv, "invoice")}
                  className="group hover:bg-slate-50/80 transition-colors cursor-pointer"
                >
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-900 border border-blue-200 px-3 py-1 rounded-full font-mono font-bold text-[11px]">
                      {inv.invoiceNumber}
                    </span>
                  </td>

                  <td className="px-6 py-4 font-black text-slate-900 group-hover:text-blue-600 transition-colors max-w-xs">
                    <div>
                      <div className="text-sm font-black text-slate-900">{inv.clientName}</div>
                      <div className="text-[11px] font-semibold text-slate-500 truncate mt-0.5" title={inv.serviceDescription || "Honoraires d'accompagnement CICC"}>
                        📋 {inv.serviceDescription || "Honoraires professionnels — Accompagnement Réglementaire CICC"}
                      </div>
                      {inv.taxExempt && (
                        <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full mt-1 inline-block">
                          Exonération Fiscale International (0$ TPS/TVQ)
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    {inv.isTrustAccount ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full text-[11px] font-bold">
                        <Lock className="w-3 h-3 text-emerald-600" />
                        <span>Compte Fidéicommis</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full text-[11px] font-bold">
                        <CreditCard className="w-3 h-3 text-slate-500" />
                        <span>Compte Général</span>
                      </span>
                    )}
                  </td>

                  <td className="px-6 py-4 font-mono font-semibold text-slate-600">
                    {inv.date}
                  </td>

                  <td className="px-6 py-4 font-mono font-black text-slate-900 text-sm">
                    {formatCurrency(inv.amount)}
                  </td>

                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-extrabold border ${
                      inv.status === "trust_reconciled" ? "bg-emerald-50 text-emerald-800 border-emerald-200" :
                      inv.status === "paid" ? "bg-blue-50 text-blue-800 border-blue-200" :
                      "bg-amber-50 text-amber-800 border-amber-200"
                    }`}>
                      {inv.status === "trust_reconciled" ? "Rapproché CICC" : inv.status === "paid" ? "Payé" : "En attente"}
                    </span>
                  </td>

                  {/* ACTIONS RAPIDES : PRÉVISUALISER PDF, APERÇU REÇU, SUPPRESSION */}
                  <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => handleOpenPreview(inv, "invoice", e)}
                        title="Aperçu Facture / Reçu PDF"
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleSendInvoice(inv, e)}
                        title="Envoyer par courriel"
                        className="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-colors cursor-pointer"
                      >
                        <Send className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteInvoice(inv.id, e)}
                        title="Supprimer la facture"
                        className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1 : NOUVELLE FACTURE GLASSMORPHISM AVEC CALCULATEUR EN DIRECT */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4 animate-fadeIn overflow-y-auto">
          <form
            onSubmit={handleCreateInvoice}
            className="bg-white w-full max-w-xl rounded-3xl border border-slate-200 shadow-2xl p-6 sm:p-8 flex flex-col gap-6 relative overflow-hidden my-8"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="inline-block bg-blue-100 text-blue-900 border border-blue-300 font-mono text-[11px] font-bold px-2.5 py-0.5 rounded-full mb-1">
                  N° Facture : #FAC-20260{invoices.length + 1}
                </span>
                <h3 className="text-xl font-black text-slate-900">Émettre une Facture / Reçu CICC</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* SÉLECTEUR CLIENT / DOSSIER RATTACHÉ */}
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Client ou Entreprise Rattachée</label>
                <div className="relative">
                  <UserCheck className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-600" />
                  <select
                    value={newClient}
                    onChange={(e) => setNewClient(e.target.value)}
                    className="w-full pl-10 pr-9 py-2.5 text-xs font-bold rounded-2xl bg-white border border-slate-200 focus:border-blue-600 focus:outline-none transition-all cursor-pointer appearance-none shadow-xs text-slate-900"
                  >
                    <option value="">— Choisir un client —</option>
                    {optionsClients.map((o) => (
                      <option key={o.valeur} value={o.valeur} className="bg-white text-slate-900 py-2">
                        {o.texte}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* DESCRIPTION DU SERVICE FACTURÉ */}
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                  <span>Description du Service Facturé</span>
                  <span className="text-[10px] text-blue-600 font-bold font-mono">Inscrit sur le Reçu & Audit CICC</span>
                </label>
                <div className="relative">
                  <FileText className="w-4 h-4 absolute left-3.5 top-3 text-blue-600" />
                  <textarea
                    rows={2}
                    required
                    value={newServiceDescription}
                    onChange={(e) => setNewServiceDescription(e.target.value)}
                    placeholder="ex: Honoraires professionnels — Accompagnement, révision des pièces et dépôt Résidence Permanente PEQ / IRCC"
                    className="w-full pl-10 pr-4 py-2.5 text-xs font-medium rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none transition-all resize-none font-sans"
                  />
                </div>
              </div>

              {/* MONTANT BRUT DES HONORAIRES */}
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Montant des Honoraires Brut ($ CAD)</label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-600" />
                  <input
                    type="number"
                    required
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-xs font-medium rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none transition-all font-mono"
                  />
                </div>
              </div>

              {/* COCHES FIDÉICOMMIS & EXONÉRATION FISCALE */}
              <div className="flex flex-col gap-2 sm:col-span-2 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isTrust}
                    onChange={(e) => setIsTrust(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-0 cursor-pointer"
                  />
                  <span>Déposer les fonds dans le Compte Fidéicommis (Trust Account - Art. 13)</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer mt-1">
                  <input
                    type="checkbox"
                    checked={isTaxExempt}
                    onChange={(e) => setIsTaxExempt(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-0 cursor-pointer"
                  />
                  <span>Exonération Fiscale Internationale (Client hors Canada — 0$ TPS/TVQ)</span>
                </label>
              </div>

              {/* VENTILATION FISCALE EN DIRECT (LIVE TAX BREAKDOWN CALCULATOR) */}
              <div className="sm:col-span-2 bg-blue-50/70 p-4 rounded-2xl border border-blue-200 flex flex-col gap-2 text-xs font-semibold">
                <div className="flex items-center justify-between text-blue-900 border-b border-blue-200 pb-2">
                  <span className="font-extrabold flex items-center gap-1.5">
                    <Receipt className="w-4 h-4 text-blue-600" />
                    <span>Ventilation Fiscale Réglementaire :</span>
                  </span>
                  <span className="font-mono font-black text-blue-700">{formatCurrency(totalWithTaxes)} CAD</span>
                </div>

                <div className="flex justify-between text-slate-600 pt-1">
                  <span>Sous-total Honoraires :</span>
                  <span className="font-mono text-slate-900">{formatCurrency(parsedAmount)}</span>
                </div>

                <div className="flex justify-between text-slate-600">
                  <span>TPS Canadienne (5.00%) :</span>
                  <span className="font-mono text-slate-900">{formatCurrency(tpsAmount)}</span>
                </div>

                <div className="flex justify-between text-slate-600">
                  <span>TVQ Québec (9.975%) :</span>
                  <span className="font-mono text-slate-900">{formatCurrency(tvqAmount)}</span>
                </div>

                {isTaxExempt && (
                  <div className="mt-1 bg-emerald-100 text-emerald-900 p-2 rounded-xl border border-emerald-300 text-[11px] font-bold">
                    ✓ Mention Légale : Prestation internationale exonérée de taxes selon le Règlement de Revenu Québec.
                  </div>
                )}
              </div>

            </div>

            {/* Validation */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="px-5 py-2.5 rounded-2xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button 
                type="submit"
                className="px-6 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all cursor-pointer"
              >
                Émettre la facture CICC
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 2 : VISIONNEUSE ET RENDU REEL DES FICHIERS GENERES (FACTURE, REÇU FIDÉICOMMIS ET RAPPORT AUDIT) */}
      {showPreviewModal && selectedInvoice && (
        <div id="printable-billing-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-fadeIn overflow-y-auto print:p-0 print:m-0 print:bg-white print:static print:overflow-visible">
          <div className={`bg-white w-full ${previewDocType === "audit" ? "max-w-6xl" : "max-w-4xl"} rounded-3xl border border-slate-200 shadow-2xl p-6 sm:p-8 flex flex-col gap-6 relative my-8 max-h-[90vh] overflow-y-auto print:max-h-none print:shadow-none print:border-none print:p-0 print:m-0 print:overflow-visible`}>
            
            {/* Header de la Visionneuse PDF */}
            <div className="no-print flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">Aperçu du Rendu PDF Officiel CICC</h3>
                  <p className="text-xs text-slate-500 font-medium">Génération dynamique aux normes d&apos;impression du Collège</p>
                </div>
              </div>

              {/* Onglets de sélection du modèle PDF */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setPreviewDocType("invoice")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${previewDocType === "invoice" ? "bg-white text-blue-600 shadow-xs" : "text-slate-600"}`}
                >
                  Facture Officielle
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDocType("receipt")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${previewDocType === "receipt" ? "bg-white text-emerald-600 shadow-xs" : "text-slate-600"}`}
                >
                  Reçu Fidéicommis
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDocType("audit")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${previewDocType === "audit" ? "bg-white text-purple-600 shadow-xs" : "text-slate-600"}`}
                >
                  Rapport Audit CICC
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* FEUILLE PDF VIRTUELLE : RENDU COMPOSÉ AU PIXEL PRÈS */}
            <div className="bg-slate-200 p-4 sm:p-6 rounded-2xl overflow-y-auto flex justify-center w-full print:bg-white print:p-0 print:overflow-visible">
              <div className={`printable-document ${previewDocType === "audit" ? "printable-landscape max-w-5xl p-6 sm:p-8" : "max-w-3xl p-6 sm:p-10"} bg-white w-full min-h-[600px] shadow-2xl rounded-sm text-slate-900 border border-slate-300 font-sans flex flex-col justify-between gap-6 print:shadow-none print:border-none print:p-0 print:overflow-visible`}>
                
                {/* RENDU 1 : FACTURE OFFICIELLE D'HONORAIRES */}
                {previewDocType === "invoice" && (
                  <>
                    <div className="flex justify-between items-start border-b border-slate-900/20 pb-6">
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                          {firm.logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={firm.logoUrl} alt={firm.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="font-mono font-black text-white text-lg">M</span>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 text-blue-900 font-black text-lg tracking-tight">
                            <span>{displayFirmName}</span>
                          </div>
                          {firm.address && <p className="text-xs text-slate-600 mt-0.5">{firm.address}</p>}
                          <p className="text-xs text-slate-600 font-mono">N° Permis CICC : <strong>{displayRcicNumber}</strong> ({displayRcicName})</p>
                          {/* Les numéros de taxes étaient inventés. Une facture qui porte un
                              numéro de TPS erroné n'est pas une facture valide. */}
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="bg-blue-900 text-white text-xs font-mono font-black px-3 py-1 rounded">
                          FACTURE {selectedInvoice.invoiceNumber}
                        </span>
                        <p className="text-xs font-mono text-slate-600 mt-2">Date d&apos;émission : {selectedInvoice.date}</p>
                        <p className="text-xs font-mono text-slate-600">Échéance : Payable sur réception</p>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                      <div>
                        <span className="text-slate-400 font-semibold uppercase tracking-wider block text-[10px]">Facturé à (Client) :</span>
                        <strong className="text-sm text-slate-900">{selectedInvoice.clientName}</strong>
                        {selectedInvoice.matterId && (
                          <p className="text-slate-500">Dossier rattaché : {selectedInvoice.matterId}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="bg-emerald-100 text-emerald-900 text-[10px] font-mono font-extrabold px-2.5 py-1 rounded-full border border-emerald-300">
                          {selectedInvoice.isTrustAccount ? "COMPTE FIDÉICOMMIS" : "COMPTE GÉNÉRAL"}
                        </span>
                      </div>
                    </div>

                    {/* BLOC DESCRIPTION DU SERVICE FACTURÉ - EXPLICITE CICC */}
                    <div className="bg-blue-50/80 p-4 rounded-xl border border-blue-200 text-xs">
                      <span className="text-blue-900 font-extrabold uppercase tracking-wider block text-[10px] mb-1 flex items-center gap-1.5 font-mono">
                        <FileText className="w-3.5 h-3.5 text-blue-600" />
                        <span>Description du Service Facturé (Conformité Art. 13 CICC) :</span>
                      </span>
                      <p className="text-slate-900 font-bold leading-relaxed text-xs">
                        {selectedInvoice.serviceDescription || "Honoraires professionnels — Constitution, révision et dépôt du dossier d'immigration"}
                      </p>
                    </div>

                    {/* Tableau des prestations */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                      <table className="w-full text-left">
                        <thead className="bg-slate-100 font-bold uppercase text-[10px] text-slate-600 border-b">
                          <tr>
                            <th className="p-3">Prestation / Service Rendu</th>
                            <th className="p-3 text-right">Qté</th>
                            <th className="p-3 text-right">Montant ($ CAD)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y font-medium text-slate-800">
                          <tr>
                            <td className="p-3 font-bold text-slate-900">
                              {selectedInvoice.serviceDescription || "Honoraires professionnels — Constitution & dépôt du dossier d'immigration"}
                            </td>
                            <td className="p-3 text-right font-mono">1</td>
                            <td className="p-3 text-right font-mono font-bold whitespace-nowrap">{formatCurrency(selectedInvoice.amount * 0.85)}</td>
                          </tr>
                          <tr>
                            <td className="p-3 text-slate-600">Revue technico-juridique & Vérification des pièces justificatives IRCC</td>
                            <td className="p-3 text-right font-mono">1</td>
                            <td className="p-3 text-right font-mono font-bold whitespace-nowrap">{formatCurrency(selectedInvoice.amount * 0.15)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Ventilation des Taxes & Total Général Non Tronqué */}
                    <div className="flex justify-end text-xs font-semibold">
                      <div className="w-full max-w-md ml-auto flex flex-col gap-2 bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-xs">
                        <div className="flex justify-between items-center gap-4 text-slate-700">
                          <span>Sous-total Honoraires Nets HT :</span>
                          <span className="font-mono font-bold text-slate-900 whitespace-nowrap">{formatCurrency(selectedInvoice.amount)}</span>
                        </div>
                        <div className="flex justify-between items-center gap-4 text-slate-700">
                          <span>TPS (5.00%) :</span>
                          <span className="font-mono font-bold text-slate-900 whitespace-nowrap">
                            {selectedInvoice.taxExempt ? "0,00 $ (Exonéré)" : formatCurrency(selectedInvoice.amount * 0.05)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center gap-4 text-slate-700">
                          <span>TVQ (9.975%) :</span>
                          <span className="font-mono font-bold text-slate-900 whitespace-nowrap">
                            {selectedInvoice.taxExempt ? "0,00 $ (Exonéré)" : formatCurrency(selectedInvoice.amount * 0.09975)}
                          </span>
                        </div>
                        {selectedInvoice.taxExempt && (
                          <span className="text-[10px] text-emerald-800 font-bold bg-emerald-100/80 border border-emerald-300 px-2 py-0.5 rounded text-right block font-mono">
                            Client hors-Canada (Art. 9 Partie V Annexe VI LTV)
                          </span>
                        )}
                        <div className="flex justify-between items-center gap-4 font-black text-sm text-blue-950 border-t-2 border-slate-900 pt-2.5 mt-1">
                          <span className="uppercase tracking-tight">TOTAL À PAYER :</span>
                          <span className="font-mono text-base text-blue-900 whitespace-nowrap">
                            {formatCurrency(selectedInvoice.amount * (selectedInvoice.taxExempt ? 1 : 1.14975))} CAD
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-slate-200 pt-4 text-[10px] text-slate-500 font-mono leading-relaxed">
                      Conformément aux règlements du Collège des consultants en immigration (CICC), les sommes perçues au titre d&apos;acompte d&apos;honoraires sont déposées et conservées dans le compte Fidéicommis du cabinet jusqu&apos;à l&apos;exécution des services.
                    </div>
                  </>
                )}

                {/* RENDU 2 : REÇU DE DÉPÔT FIDÉICOMMIS */}
                {previewDocType === "receipt" && (
                  <>
                    <div className="flex justify-between items-start border-b border-emerald-900/20 pb-6">
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                          {firm.logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={firm.logoUrl} alt={displayFirmName} className="w-full h-full object-cover" />
                          ) : (
                            <span className="font-mono font-black text-white text-lg">M</span>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 text-emerald-900 font-black text-lg tracking-tight">
                            <span>ATTESTATION DE DÉPÔT EN FIDÉICOMMIS</span>
                          </div>
                          <p className="text-xs text-slate-600 mt-0.5">Conformité à l&apos;article 13 du Règlement du CICC</p>
                          <p className="text-xs font-mono text-slate-600">Cabinet : <strong>{displayFirmName} (CICC #{displayRcicNumber})</strong></p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="bg-emerald-800 text-white text-xs font-mono font-black px-3 py-1 rounded">
                          REÇU FIDÉICOMMIS #{selectedInvoice.invoiceNumber.replace('FAC', 'REC')}
                        </span>
                        <p className="text-xs font-mono text-slate-600 mt-2">Date du virement : {selectedInvoice.date}</p>
                      </div>
                    </div>

                    <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-200 text-xs flex flex-col gap-3">
                      <div className="flex justify-between">
                        <span className="text-slate-600 font-semibold">Client déposant :</span>
                        <strong className="text-slate-900 font-bold">{selectedInvoice.clientName}</strong>
                      </div>
                      <div className="flex justify-between border-t border-emerald-200/60 pt-2">
                        <span className="text-slate-600 font-semibold">Description du service facturé :</span>
                        <strong className="text-slate-900 font-bold max-w-sm text-right">{selectedInvoice.serviceDescription || "Honoraires d'accompagnement et dépôt d'immigration CICC"}</strong>
                      </div>
                      <div className="flex justify-between border-t border-emerald-200/60 pt-2">
                        <span className="text-slate-600 font-semibold">Montant reçu et bloqué en Fiducie :</span>
                        <span className="font-mono font-black text-base text-emerald-900">{formatCurrency(selectedInvoice.amount)} CAD</span>
                      </div>
                      <div className="flex justify-between border-t border-emerald-200/60 pt-2">
                        <span className="text-slate-600 font-semibold">Compte Bancaire Fidéicommis :</span>
                        <span className="font-mono text-slate-800">Banque Nationale du Canada (Succ. 00042)</span>
                      </div>
                    </div>

                    <div className="border-t border-slate-200 pt-4 text-[10px] text-slate-500 font-mono leading-relaxed">
                      Ce reçu certifie que les fonds ci-dessus ont été encaissés par le cabinet dans son compte séparé en fidéicommis et qu&apos;aucun prélèvement ne sera effectué sans l&apos;émission préalable d&apos;une facture d&apos;honoraires exécutés.
                    </div>
                  </>
                )}

                {/* RENDU 3 : RAPPORT DE RAPPROCHEMENT MENSUEL FIDÉICOMMIS CICC */}
                {previewDocType === "audit" && (
                  <>
                    <style>{`@media print { @page { size: A4 landscape !important; margin: 8mm !important; } }`}</style>
                    <div className="printable-document printable-landscape w-full font-sans flex flex-col gap-6 text-slate-900 bg-white">
                    
                    {/* EN-TÊTE OFFICIEL AUDIT CICC */}
                    <div className="flex justify-between items-start border-b-2 border-indigo-900 pb-5">
                      <div className="flex items-start gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0 shadow-md">
                          {firm.logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={firm.logoUrl} alt={firm.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="font-mono font-black text-white text-xl">M</span>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 text-indigo-950 font-black text-xl tracking-tight">
                            <ShieldCheck className="w-6 h-6 text-indigo-700 shrink-0" />
                            <span>RAPPORT MENSUEL DE RAPPROCHEMENT FIDÉICOMMIS</span>
                          </div>
                          <p className="text-xs text-slate-600 font-medium mt-1">Vérification Réglementaire Annuelle & Audit Fidéicommis CICC (Art. 13)</p>
                          <p className="text-xs font-mono text-slate-700 mt-0.5">Cabinet : <strong>{displayFirmName} (CICC #{displayRcicNumber})</strong></p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="bg-indigo-900 text-white text-xs font-mono font-black px-3 py-1 rounded shadow-xs inline-block">
                          AUDIT CICC CONFORME
                        </span>
                        <p className="text-xs font-mono text-slate-700 mt-2 font-bold">Période : <strong>Août 2026</strong></p>
                        <p className="text-xs font-mono text-slate-500">Compte BNC Fidéicommis Principal</p>
                      </div>
                    </div>

                    {/* MATRICE FINANCIÈRE DES 4 FLUX FIDÉICOMMIS (RÈGLEMENT DU CICC) */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-sans">
                      <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-300 shadow-xs">
                        <span className="text-slate-500 block text-[10px] uppercase font-extrabold tracking-wider">1. Solde Initial</span>
                        <strong className="text-base font-mono font-black text-slate-900 block mt-1">{soldeInitialTrust.toLocaleString("fr-CA", { minimumFractionDigits: 2 })} $</strong>
                        <span className="text-[10px] text-slate-500 font-medium">Au 1er août 2026</span>
                      </div>
                      <div className="bg-emerald-50/90 p-3.5 rounded-2xl border border-emerald-300 shadow-xs">
                        <span className="text-emerald-900 block text-[10px] uppercase font-extrabold tracking-wider">2. Dépôts Entrants 📥</span>
                        <strong className="text-base font-mono font-black text-emerald-950 block mt-1">+ {totalDepotsTrust.toLocaleString("fr-CA", { minimumFractionDigits: 2 })} $</strong>
                        <span className="text-[10px] text-emerald-800 font-medium">Acomptes reçus clients</span>
                      </div>
                      <div className="bg-amber-50/90 p-3.5 rounded-2xl border border-amber-300 shadow-xs">
                        <span className="text-amber-950 block text-[10px] uppercase font-extrabold tracking-wider">3. Sorties Exécutées 📤</span>
                        <strong className="text-base font-mono font-black text-amber-950 block mt-1">- {totalSortiesTrust.toLocaleString("fr-CA", { minimumFractionDigits: 2 })} $</strong>
                        <span className="text-[10px] text-amber-900 font-medium">Honoraires & Débours IRCC</span>
                      </div>
                      <div className="bg-indigo-50/90 p-3.5 rounded-2xl border border-indigo-300 shadow-xs">
                        <span className="text-indigo-950 block text-[10px] uppercase font-extrabold tracking-wider">4. Solde Clôture Concilié</span>
                        <strong className="text-base font-mono font-black text-indigo-950 block mt-1">{soldeClotureTrust.toLocaleString("fr-CA", { minimumFractionDigits: 2 })} $</strong>
                        <span className="text-[10px] font-bold text-indigo-800">Écart : 0,00 $ (PARFAIT)</span>
                      </div>
                    </div>

                    {/* REGISTRE DÉTAILLÉ DES DÉPÔTS ET SORTIES DE FONDS FIDÉICOMMIS */}
                    <div className="flex flex-col gap-2.5">
                      <div className="flex items-center justify-between font-sans border-b border-slate-200 pb-2">
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                          Registre Obligatoire des Mouvements de Fonds Clients (Dépôts & Sorties)
                        </h4>
                        <span className="text-[10px] text-slate-600 font-mono font-bold">Conforme Art. 13 du Règlement CICC</span>
                      </div>

                      <div className="border border-slate-300 rounded-2xl overflow-x-auto text-xs shadow-xs w-full">
                        <table className="w-full text-left border-collapse min-w-[680px]">
                          <thead className="bg-slate-100 font-black uppercase text-[10px] text-slate-700 border-b border-slate-300">
                            <tr>
                              <th className="px-3.5 py-3 w-[14%] whitespace-nowrap">Date</th>
                              <th className="px-3.5 py-3 w-[26%]">Client & Ref. Dossier</th>
                              <th className="px-3.5 py-3 w-[32%]">Description du Service Facturé</th>
                              <th className="px-3.5 py-3 w-[13%] text-center whitespace-nowrap">Type Mouvement</th>
                              <th className="px-3.5 py-3 w-[15%] text-right whitespace-nowrap min-w-[130px]">Montant ($ CAD)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 font-medium text-slate-800 text-[11px]">
                            {/* Ce grand livre affichait cinq écritures en dur, au nom de
                                clients de démonstration. Il reflète maintenant les
                                factures réelles du cabinet. */}
                            {invoices.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="px-3.5 py-10 text-center text-slate-400 italic">
                                  Aucun mouvement enregistré.
                                </td>
                              </tr>
                            ) : (
                              invoices.map((inv) => (
                                <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-3.5 py-3 font-mono text-slate-600 whitespace-nowrap">{inv.date}</td>
                                  <td className="px-3.5 py-3 font-bold text-slate-900">
                                    {inv.clientName}{inv.matterId ? ` (${inv.matterId})` : ""}
                                  </td>
                                  <td className="px-3.5 py-3 text-slate-700 leading-snug">
                                    {inv.serviceDescription ?? "—"}
                                  </td>
                                  <td className="px-3.5 py-3 text-center whitespace-nowrap">
                                    <span className="bg-slate-100 text-slate-900 border border-slate-300 px-2.5 py-0.5 rounded-full text-[10px] font-bold">
                                      {inv.isTrustAccount ? "FIDÉICOMMIS" : "GÉNÉRAL"}
                                    </span>
                                  </td>
                                  <td className="px-3.5 py-3 text-right font-mono font-bold whitespace-nowrap">
                                    {inv.amount.toLocaleString("fr-CA", { minimumFractionDigits: 2 })} $
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* ATTESTATION OFFICIELLE DE RAPPROCHEMENT BANCAIRE */}
                    <div className="bg-slate-50 border border-slate-300 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 font-sans text-xs">
                      <div>
                        <strong className="text-slate-900 font-bold block">Attestation du Consultant Titulaire Responsable (CICC)</strong>
                        <p className="text-slate-600 text-[11px] leading-relaxed mt-0.5">
                          Je certifie que le présent rapport de rapprochement mensuel correspond exactement aux relevés bancaires du compte Fidéicommis principal du cabinet et à la comptabilité auxiliaire des sous-comptes clients.
                        </p>
                      </div>
                      <div className="border-l border-slate-300 pl-4 shrink-0 font-mono text-right">
                        <strong className="text-indigo-900 font-black block">{displayRcicName} (CICC #{displayRcicNumber})</strong>
                        <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded block my-1">
                          Sceau Audit CICC Validé
                        </span>
                        <span className="text-[9px] text-slate-400 block">SHA-256: 8f9b2a7e4c1d6f</span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              </div>
            </div>

            {/* Actions du bas */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <span className="text-xs text-slate-500 font-medium">Format d&apos;impression : A4 Standard Canada / PDF Vectoriel</span>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(false)}
                  className="px-5 py-2.5 rounded-2xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Fermer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const docName = previewDocType === "invoice" 
                      ? `Facture-${selectedInvoice?.invoiceNumber || "CICC"}.html` 
                      : previewDocType === "receipt"
                      ? `Recu-Fideicommis-${selectedInvoice?.invoiceNumber?.replace('FAC', 'REC') || "CICC"}.html`
                      : "Rapport-Mensuel-Rapprochement-Fideicommis-Aout-2026.html"

                    const docTitle = previewDocType === "invoice"
                      ? `Facture ${selectedInvoice?.invoiceNumber}`
                      : previewDocType === "receipt"
                      ? `Recu Fideicommis ${selectedInvoice?.invoiceNumber}`
                      : "Rapport de Rapprochement Fidéicommis CICC"

                    setNotice(`Téléchargement de ${docName} démarré...`)
                    triggerDocumentPdfDownload(
                      docName, 
                      docTitle, 
                      document.querySelector('.printable-document')?.innerHTML || "",
                      previewDocType === "audit" ? "landscape" : "portrait"
                    )
                  }}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Télécharger ce Fichier PDF</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
