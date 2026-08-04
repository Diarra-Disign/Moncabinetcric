"use client"

import * as React from "react"
import { 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  ShieldAlert, 
  BookOpen, 
  Plus, 
  Search, 
  Filter, 
  ExternalLink, 
  Scale, 
  Calendar as CalendarIcon, 
  Sparkles, 
  Check, 
  X, 
  AlertCircle, 
  FileText, 
  ChevronRight,
  Info,
  Building2,
  Award
} from "lucide-react"
import { PageHeader } from "@/components/app-shell/page-header"
import { useFirm } from "@/components/app-shell/firm-provider"
import { DeadlineRecord, DeadlineRule, CiccComplianceScore } from "@/lib/data/types"
import { triggerFileDownload } from "@/lib/utils/download-helper"

interface DeadlinesClientProps {
  initialDeadlines: DeadlineRecord[]
  initialRules: DeadlineRule[]
  initialComplianceScore: CiccComplianceScore
}

export function DeadlinesClient({ initialDeadlines, initialRules, initialComplianceScore }: DeadlinesClientProps) {
  // Le titulaire responsable était inscrit en dur, avec le titre « Me »
  // qui est celui d'un avocat. Il vient du profil du cabinet.
  const firm = useFirm()
  const [deadlines, setDeadlines] = React.useState<DeadlineRecord[]>(initialDeadlines)
  const [rules, setRules] = React.useState<DeadlineRule[]>(initialRules)
  const [complianceScore, setComplianceScore] = React.useState<CiccComplianceScore>(initialComplianceScore)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [severityFilter, setSeverityFilter] = React.useState<string>("all")
  const [statusFilter, setStatusFilter] = React.useState<string>("open")

  // Modals state
  const [showRulesDrawer, setShowRulesDrawer] = React.useState(false)
  const [showComplianceModal, setShowComplianceModal] = React.useState(false)
  const [showDismissModal, setShowDismissModal] = React.useState(false)
  const [showNewDeadlineModal, setShowNewDeadlineModal] = React.useState(false)
  const [selectedDeadline, setSelectedDeadline] = React.useState<DeadlineRecord | null>(null)
  const [dismissReason, setDismissReason] = React.useState("")
  const [notice, setNotice] = React.useState<string | null>(null)

  // New Deadline Form State
  const [newTitle, setNewTitle] = React.useState("")
  const [newClientName, setNewClientName] = React.useState("")
  const [newProgram, setNewProgram] = React.useState("Entrée Express")
  const [newDueOn, setNewDueOn] = React.useState("2026-09-15")
  const [newSeverity, setNewSeverity] = React.useState<"critical" | "high" | "normal">("high")
  const [newAssignedTo, setNewAssignedTo] = React.useState(firm.rcicName)
  const [newAuthority, setNewAuthority] = React.useState("LIPR art. 87")

  // Filtered Deadlines
  const filteredDeadlines = deadlines.filter(d => {
    const matchesSearch = searchQuery === "" ||
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.authority.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesSeverity = severityFilter === "all" || d.severity === severityFilter
    const matchesStatus = statusFilter === "all" || d.status === statusFilter

    return matchesSearch && matchesSeverity && matchesStatus
  })

  const criticalCount = deadlines.filter(d => d.status === "open" && d.daysRemaining <= 14).length
  const highCount = deadlines.filter(d => d.status === "open" && d.daysRemaining > 14 && d.daysRemaining <= 30).length

  const handleCompleteDeadline = (id: string) => {
    const target = deadlines.find(d => d.id === id)
    if (!target) return

    setDeadlines(prev => prev.map(d => {
      if (d.id === id) {
        return {
          ...d,
          status: "done",
          completedAt: new Date().toISOString(),
          completedBy: firm.rcicName
        }
      }
      return d
    }))

    setNotice(`✅ Échéance "${target.title}" marquée comme accomplie avec succès. Journal mis à jour.`)
    setTimeout(() => setNotice(null), 5000)
  }

  const handleDismissDeadline = () => {
    if (!selectedDeadline || !dismissReason.trim()) return

    setDeadlines(prev => prev.map(d => {
      if (d.id === selectedDeadline.id) {
        return {
          ...d,
          status: "dismissed",
          dismissedReason: dismissReason.trim()
        }
      }
      return d
    }))

    setShowDismissModal(false)
    setSelectedDeadline(null)
    setDismissReason("")
    setNotice(`⚠️ Échéance ignorée avec motif consigné au registre CICC.`)
    setTimeout(() => setNotice(null), 5000)
  }

  const handleCreateDeadline = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim() || !newClientName.trim()) return

    const now = new Date()
    const dueDate = new Date(newDueOn)
    const diffTime = dueDate.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    const newRecord: DeadlineRecord = {
      id: `dead-${Date.now()}`,
      clientName: newClientName,
      program: newProgram,
      title: newTitle,
      dueOn: newDueOn,
      daysRemaining: diffDays > 0 ? diffDays : 0,
      severity: newSeverity,
      status: "open",
      assignedTo: newAssignedTo,
      authority: newAuthority,
      isManual: true
    }

    setDeadlines(prev => [newRecord, ...prev])
    setShowNewDeadlineModal(false)
    setNewTitle("")
    setNewClientName("")
    setNotice(`✅ Nouvelle échéance réglementaire créée pour ${newClientName}.`)
    setTimeout(() => setNotice(null), 5000)
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      
      {/* PAGE HEADER */}
      <PageHeader
        title="Moteur d'Échéances & Alertes Réglementaires CICC"
        subtitle="Calculs automatiques basés sur les règles LIPR/RIPR, avertissements préventifs et score de conformité."
        badgeText="AVERTISSEUR RÉGLEMENTAIRE V2"
        badgeVariant="amber"
        actions={
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowRulesDrawer(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-slate-500" />
              <span>Bibliothèque des Règles ({rules.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setShowNewDeadlineModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-indigo-900 hover:bg-indigo-950 text-white text-xs font-bold transition-all shadow-md shadow-indigo-900/20 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-indigo-300" />
              <span>Nouvelle Échéance Manuelle</span>
            </button>
          </div>
        }
      />

      {/* NOTICE BANNER */}
      {notice && (
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-white text-xs font-bold flex items-center justify-between shadow-lg animate-fadeIn">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
            <span>{notice}</span>
          </div>
          <button type="button" onClick={() => setNotice(null)} className="text-slate-400 hover:text-white font-mono">✕</button>
        </div>
      )}

      {/* CARD 1 : TOP CRITICAL ALERT BANNER & COMPLIANCE SCORE BREAKDOWN */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* BANNIÈRE D'ALERTE CRITIQUE ET ÉCHÉANCE PROCHE */}
        <div className="lg:col-span-2 bg-gradient-to-br from-amber-500/10 via-rose-500/5 to-slate-900 rounded-3xl p-6 sm:p-8 border border-amber-500/30 shadow-xl relative overflow-hidden flex flex-col justify-between gap-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0 shadow-inner">
                <AlertTriangle className="w-7 h-7 text-amber-500 animate-bounce" />
              </div>
              <div>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-400/30 px-2.5 py-0.5 rounded-full inline-block mb-1.5">
                  SURVEILLANCE DES DÉLAIS EN TEMPS RÉEL
                </span>
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  {criticalCount > 0 
                    ? `${criticalCount} Échéance(s) Critique(s) à traiter sous 14 Jours`
                    : "Toutes les Échéances Réglementaires sont sous Contrôle"}
                </h2>
                <p className="text-xs text-slate-600 mt-1 max-w-xl leading-relaxed">
                  Le moteur calcule en permanence l&apos;impact des lettres d&apos;instructions IRCC, expirations de permis et fenêtres de rétablissement pour éviter toute perte de statut.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-200/60 text-xs">
            <div className="bg-white/80 backdrop-blur-xs p-3 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Critiques (&le; 14 Jours)</span>
              <strong className="text-lg font-black text-rose-600">{criticalCount}</strong>
            </div>

            <div className="bg-white/80 backdrop-blur-xs p-3 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Préventifs (&le; 30 Jours)</span>
              <strong className="text-lg font-black text-amber-600">{highCount}</strong>
            </div>

            <div className="bg-white/80 backdrop-blur-xs p-3 rounded-2xl border border-slate-200 shadow-xs col-span-2 sm:col-span-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Règles en Base</span>
              <strong className="text-lg font-black text-indigo-900">{rules.length} Vérifiées</strong>
            </div>
          </div>
        </div>

        {/* CARD 2 : KPI SCORE DE CONFORMITE CICC (100 PTS) */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-100 text-emerald-900 border border-emerald-300 px-2.5 py-0.5 rounded-full">
                AUDIT CICC ART. 13
              </span>
              <Award className="w-5 h-5 text-emerald-600" />
            </div>

            <h3 className="text-base font-black text-slate-900 mt-2">Score de Conformité Cabinet</h3>
            <p className="text-xs text-slate-500">Calculé sur 7 items réglementaires obligatoires.</p>

            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-black text-emerald-600">{complianceScore.totalScore ?? "—"}</span>
              <span className="text-sm font-bold text-slate-400">/ 100 Points</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowComplianceModal(true)}
            className="w-full py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <span>Voir la Ventilation des 7 Items</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

      </div>

      {/* BARRE DE RECHERCHE ET FILTRES DES ECHEANCES */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher par client, titre de l'échéance ou référence légale (ex: RIPR art. 12.1)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs font-medium rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 focus:outline-none transition-all"
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Gravité :</span>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="all">Toutes les gravités</option>
              <option value="critical">Critiques (&le; 14 jours)</option>
              <option value="high">Haute (&le; 30 jours)</option>
              <option value="normal">Normale (&gt; 30 jours)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
            <span>Statut :</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="open">À Traiter (Ouvertes)</option>
              <option value="done">Accomplies</option>
              <option value="dismissed">Ignorées avec motif</option>
              <option value="all">Toutes</option>
            </select>
          </div>
        </div>
      </div>

      {/* TABLEAU DES ECHEANCES REGLEMENTAIRES CALCULÉES */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 font-black uppercase text-[10px] text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4 w-[12%] whitespace-nowrap">Urgence / Compte</th>
                <th className="py-3.5 px-4 w-[20%]">Client & Dossier</th>
                <th className="py-3.5 px-4 w-[32%]">Intitulé de l&apos;Échéance Réglementaire</th>
                <th className="py-3.5 px-4 w-[18%]">Autorité & Règle Source</th>
                <th className="py-3.5 px-4 w-[18%] text-right whitespace-nowrap">Actions de Contrôle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {filteredDeadlines.map(deadline => {
                const isOverdue = deadline.daysRemaining <= 7
                const isWarning = deadline.daysRemaining > 7 && deadline.daysRemaining <= 14

                return (
                  <tr 
                    key={deadline.id} 
                    className={`transition-colors ${
                      deadline.status === "done" 
                        ? "bg-slate-50/60 opacity-75" 
                        : deadline.status === "dismissed"
                        ? "bg-rose-50/30 opacity-70"
                        : isOverdue
                        ? "bg-rose-50/50 hover:bg-rose-50"
                        : "hover:bg-slate-50/80"
                    }`}
                  >
                    {/* Badge Compte à rebours */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {deadline.status === "open" ? (
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-black ${
                          isOverdue 
                            ? "bg-rose-600 text-white shadow-sm shadow-rose-600/30 animate-pulse" 
                            : isWarning
                            ? "bg-amber-500 text-slate-950 font-bold"
                            : "bg-indigo-100 text-indigo-900 border border-indigo-200"
                        }`}>
                          <Clock className="w-3.5 h-3.5" />
                          <span>J-{deadline.daysRemaining} ({deadline.dueOn})</span>
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase ${
                          deadline.status === "done" ? "bg-emerald-100 text-emerald-900" : "bg-slate-200 text-slate-700"
                        }`}>
                          {deadline.status === "done" ? "✓ Accomplie" : "Ignorée"}
                        </span>
                      )}
                    </td>

                    {/* Client & Programme */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{deadline.clientName}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{deadline.program}</div>
                    </td>

                    {/* Titre Échéance */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 leading-snug">{deadline.title}</div>
                      {deadline.dismissedReason && (
                        <div className="mt-1 text-[11px] text-rose-700 font-sans italic bg-rose-100/60 p-1.5 rounded-lg border border-rose-200">
                          Motif de rejet : &quot;{deadline.dismissedReason}&quot;
                        </div>
                      )}
                    </td>

                    {/* Autorité Léglale */}
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded">
                        <Scale className="w-3 h-3 text-indigo-600" />
                        <span>{deadline.authority}</span>
                      </span>
                      <div className="text-[10px] text-slate-500 mt-0.5">Assigné : {deadline.assignedTo}</div>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      {deadline.status === "open" ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDeadline(deadline)
                              setShowDismissModal(true)
                            }}
                            className="px-2.5 py-1 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-[11px] font-bold transition-all cursor-pointer"
                          >
                            Ignorer
                          </button>

                          <button
                            type="button"
                            onClick={() => handleCompleteDeadline(deadline.id)}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-xs transition-all cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Accomplie</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-mono italic">Archivée</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* DRAWER / MODAL 1 : BIBLIOTHÈQUE DES RÈGLES RÉGLEMENTAIRES EN BASE */}
      {showRulesDrawer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-3xl rounded-3xl border border-slate-200 shadow-2xl p-6 sm:p-8 flex flex-col gap-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-indigo-100 text-indigo-900 flex items-center justify-center font-bold">
                  <BookOpen className="w-5 h-5 text-indigo-700" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Bibliothèque des Règles Réglementaires ({rules.length})</h3>
                  <p className="text-xs text-slate-500">Stockées en base, versionnées et vérifiées auprès des autorités LIPR/RIPR/CICC.</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowRulesDrawer(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {rules.map(rule => (
                <div key={rule.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-indigo-900 text-[11px] bg-indigo-100 px-2 py-0.5 rounded">
                      {rule.code}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">Vérifié le : {rule.verifiedOn}</span>
                  </div>

                  <h4 className="font-black text-slate-900 text-sm">{rule.labelFr}</h4>

                  <div className="flex flex-wrap items-center gap-3 text-slate-600">
                    <span>Autorité : <strong className="text-slate-800">{rule.authority}</strong></span>
                    <span>•</span>
                    <span>Délai prescrit : <strong className="text-slate-800">{rule.offsetDays} jours ({rule.offsetDirection})</strong></span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-[11px]">
                    <span className="text-slate-500">Rappels programmés: <code className="font-mono">{rule.reminderOffsets.join(", ")} jours avant</code></span>
                    <a href={rule.sourceUrl} target="_blank" rel="noreferrer" className="text-indigo-600 font-bold hover:underline flex items-center gap-1">
                      <span>Source Officielle</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowRulesDrawer(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
              >
                Fermer la Bibliothèque
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2 : VENTILATION DU SCORE DE CONFORMITE CICC (100 PTS) */}
      {showComplianceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-xl rounded-3xl border border-slate-200 shadow-2xl p-6 sm:p-8 flex flex-col gap-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-emerald-100 text-emerald-900 flex items-center justify-center font-bold">
                  <Award className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Audit de Conformité CICC (7 Items)</h3>
                  <p className="text-xs text-slate-500 font-mono">Score total : {complianceScore.totalScore ?? "non évalué"} / 100 points</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowComplianceModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              {complianceScore.items.map(item => (
                <div key={item.id} className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/60 flex items-start gap-3 text-xs">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold shrink-0 mt-0.5 ${
                    item.isSatisfied ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                  }`}>
                    {item.isSatisfied ? "✓" : "!"}
                  </div>
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center justify-between">
                      <strong className="text-slate-900 font-bold">{item.labelFr}</strong>
                      <span className="font-mono text-emerald-800 font-bold">+{item.weight} pts</span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">{item.detailFr}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowComplianceModal(false)}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3 : MOTIF D'IGNORANCE D'UNE ECHEANCE */}
      {showDismissModal && selectedDeadline && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-3xl border border-slate-200 shadow-2xl p-6 flex flex-col gap-4">
            <h3 className="text-base font-black text-slate-900">Motif Réglementaire d&apos;Ignorance</h3>
            <p className="text-xs text-slate-600">
              Conformément à la politique d&apos;audit, ignorer l&apos;échéance <strong className="text-slate-900">&quot;{selectedDeadline.title}&quot;</strong> exige un motif écrit consigné au registre :
            </p>
            <textarea
              rows={3}
              value={dismissReason}
              onChange={(e) => setDismissReason(e.target.value)}
              placeholder="Ex: Le client a confirmé avoir obtenu sa résidence permanente par un autre volet..."
              className="w-full p-3 text-xs border border-slate-300 rounded-2xl focus:outline-none focus:border-rose-600 font-medium"
            />
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowDismissModal(false)
                  setSelectedDeadline(null)
                }}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleDismissDeadline}
                className="px-5 py-2 text-xs font-bold bg-rose-600 text-white rounded-xl hover:bg-rose-700"
              >
                Ignorer l&apos;Échéance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4 : CREATION MANUELLE D'UNE ECHEANCE */}
      {showNewDeadlineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-lg rounded-3xl border border-slate-200 shadow-2xl p-6 sm:p-8 flex flex-col gap-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900">Nouvelle Échéance Réglementaire Manuelle</h3>
              <button type="button" onClick={() => setShowNewDeadlineModal(false)} className="w-8 h-8 rounded-full bg-slate-100 font-bold flex items-center justify-center">✕</button>
            </div>

            <form onSubmit={handleCreateDeadline} className="space-y-4 text-xs font-medium">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Intitulé de l&apos;Échéance</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Dépôt mémoire SAI pour dossier..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl focus:border-indigo-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Nom du Client / Dossier</label>
                  <input
                    type="text"
                    required
                    placeholder="ex : Nom du client"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:border-indigo-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Programme</label>
                  <input
                    type="text"
                    value={newProgram}
                    onChange={(e) => setNewProgram(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:border-indigo-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Date Échéance (YYYY-MM-DD)</label>
                  <input
                    type="date"
                    required
                    value={newDueOn}
                    onChange={(e) => setNewDueOn(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:border-indigo-600 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Gravité</label>
                  <select
                    value={newSeverity}
                    onChange={(e) => setNewSeverity(e.target.value as "critical" | "high" | "normal")}
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:border-indigo-600 focus:outline-none"
                  >
                    <option value="critical">Critique</option>
                    <option value="high">Haute</option>
                    <option value="normal">Normale</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Référence Légale / Autorité Source</label>
                <input
                  type="text"
                  value={newAuthority}
                  onChange={(e) => setNewAuthority(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl focus:border-indigo-600 focus:outline-none font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewDeadlineModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-900 text-white font-bold hover:bg-indigo-950 shadow-md"
                >
                  Enregistrer l&apos;Échéance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
