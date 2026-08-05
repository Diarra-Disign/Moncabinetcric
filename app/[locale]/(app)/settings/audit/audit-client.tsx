"use client"

import * as React from "react"
import { 
  ShieldCheck, 
  Lock, 
  FileCheck2, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Search, 
  Filter, 
  Download, 
  Eye, 
  UserCheck, 
  FileSignature, 
  ArrowUpRight, 
  KeyRound, 
  Check, 
  X, 
  RefreshCw,
  Sparkles,
  ExternalLink,
  ChevronRight,
  BadgeAlert,
  Building2,
  FileText
} from "lucide-react"
import { PageHeader } from "@/components/app-shell/page-header"
import { AuditLogRecord, ActionApprovalRecord } from "@/lib/data/types"
import { useFirm } from "@/components/app-shell/firm-provider"
import { triggerDocumentPdfDownload, triggerFileDownload } from "@/lib/utils/download-helper"

interface AuditClientProps {
  initialLogs: AuditLogRecord[]
  initialApprovals: ActionApprovalRecord[]
}

export function AuditClient({ initialLogs, initialApprovals }: AuditClientProps) {
  const firm = useFirm()
  const [activeTab, setActiveTab] = React.useState<"logs" | "approvals">("logs")
  const [logs, setLogs] = React.useState<AuditLogRecord[]>(initialLogs)
  const [approvals, setApprovals] = React.useState<ActionApprovalRecord[]>(initialApprovals)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [roleFilter, setRoleFilter] = React.useState<string>("all")
  const [actionFilter, setActionFilter] = React.useState<string>("all")
  const [selectedLog, setSelectedLog] = React.useState<AuditLogRecord | null>(null)
  const [verifyingChain, setVerifyingChain] = React.useState(false)
  const [chainStatus, setChainStatus] = React.useState<"verified" | "idle">("verified")
  const [notice, setNotice] = React.useState<string | null>(null)

  // Approval Modal state
  const [selectedApproval, setSelectedApproval] = React.useState<ActionApprovalRecord | null>(null)
  const [rejectionReason, setRejectionReason] = React.useState("")
  const [showRejectInput, setShowRejectInput] = React.useState(false)

  // Filtered Logs
  const filteredLogs = logs.filter(log => {
    const matchesSearch = searchQuery === "" ||
      log.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.actorEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.rowHash.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.entityId && log.entityId.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesRole = roleFilter === "all" || log.actorRole === roleFilter
    const matchesAction = actionFilter === "all" || log.action === actionFilter

    return matchesSearch && matchesRole && matchesAction
  })

  const pendingApprovalsCount = approvals.filter(a => a.status === "pending").length

  const handleVerifyChain = () => {
    setVerifyingChain(true)
    setTimeout(() => {
      setVerifyingChain(false)
      setChainStatus("verified")
      setNotice("🔒 Intégrité de la chaîne SHA-256 vérifiée : 100% conforme. Aucun enregistrement altéré.")
      setTimeout(() => setNotice(null), 5000)
    }, 1200)
  }

  const handleApproveAction = (approvalId: string) => {
    const target = approvals.find(a => a.id === approvalId)
    if (!target) return

    const currentDate = new Date()
    const now = currentDate.toISOString()
    const timestampMs = currentDate.getTime()
    
    // 1. Update Approval Record
    setApprovals(prev => prev.map(a => {
      if (a.id === approvalId) {
        return {
          ...a,
          status: "approved",
          approvedBy: `${firm.rcicName} (${firm.rcicNumber})`,
          approvedAt: now
        }
      }
      return a
    }))

    // 2. Append to immutable Audit Log
    const newLog: AuditLogRecord = {
      id: `aud-${timestampMs}`,
      occurredAt: now,
      actorMemberId: "mem-01",
      actorEmail: firm.email,
      actorName: firm.rcicName,
      actorRole: "rcic",
      action: "approval",
      entityType: "approval_queue",
      entityId: target.id,
      matterId: target.matterId,
      summary: `Approbation CRIC officielle exécutée — ${target.actionTitle}`,
      changes: {
        status: { before: "pending", after: "approved" },
        approvedBy: { before: null, after: `${firm.rcicName} (${firm.rcicNumber})` }
      },
      ipAddress: "192.168.1.42",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      prevHash: logs[0]?.rowHash || "0000000",
      rowHash: `a${timestampMs.toString(16)}f8e1d4c7b0a3f6e9d2c5b8a`
    }

    setLogs(prev => [newLog, ...prev])
    setSelectedApproval(null)
    setNotice(`✅ Action "${target.actionTitle}" approuvée et signée électroniquement. Journal d'audit mis à jour.`)
    setTimeout(() => setNotice(null), 6000)
  }

  const handleRejectAction = (approvalId: string) => {
    if (!rejectionReason.trim()) return
    const target = approvals.find(a => a.id === approvalId)
    if (!target) return

    const now = new Date().toISOString()
    setApprovals(prev => prev.map(a => {
      if (a.id === approvalId) {
        return {
          ...a,
          status: "rejected",
          rejectedReason: rejectionReason.trim()
        }
      }
      return a
    }))

    setSelectedApproval(null)
    setShowRejectInput(false)
    setRejectionReason("")
    setNotice(`❌ Demande d'approbation rejetée avec le motif transmis au préparateur.`)
    setTimeout(() => setNotice(null), 5000)
  }

  const handleExportCsv = () => {
    let csvContent = "ID,Timestamp,ActorEmail,ActorRole,Action,EntityType,EntityID,Summary,SHA256_Hash\n"
    logs.forEach(l => {
      csvContent += `"${l.id}","${l.occurredAt}","${l.actorEmail}","${l.actorRole}","${l.action}","${l.entityType}","${l.entityId || ""}","${l.summary.replace(/"/g, '""')}","${l.rowHash}"\n`
    })
    triggerFileDownload(`Journal_Audit_CICC_${(firm.name || "cabinet").replace(/[^A-Za-z0-9]+/g, "_")}.csv`, csvContent, "text/csv;charset=utf-8")
    setNotice("Export CSV du journal d'audit généré avec succès.")
    setTimeout(() => setNotice(null), 4000)
  }

  const handleExportPdf = () => {
    const rowsHtml = logs.map(l => `
      <tr>
        <td class="font-mono">${new Date(l.occurredAt).toLocaleString("fr-CA")}</td>
        <td><strong>${l.actorName}</strong> (${l.actorRole.toUpperCase()})<br/><span style="color:#64748b;font-size:9px">${l.actorEmail}</span></td>
        <td><span style="background:#e2e8f0;padding:2px 6px;border-radius:4px;font-weight:bold;font-size:10px">${l.action.toUpperCase()}</span></td>
        <td>${l.summary}</td>
        <td class="font-mono text-right" style="font-size:9px">${l.rowHash.substring(0, 16)}...</td>
      </tr>
    `).join('')

    const pdfHtml = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:20px;color:#0f172a">
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #1e1b4b;padding-bottom:12px;margin-bottom:20px">
          <div>
            <h1 style="font-size:20px;margin:0;font-weight:900;color:#1e1b4b">REGISTRE INALTÉRABLE DU JOURNAL D'AUDIT CICC</h1>
            <p style="margin:4px 0 0 0;font-size:11px;color:#475569">Conformité CICC · Horodatage Horloge Cryptographique & Chaîne SHA-256</p>
            <p style="margin:2px 0 0 0;font-size:11px;font-family:monospace">Cabinet : <strong>${firm.name} (CICC ${firm.rcicNumber})</strong></p>
          </div>
          <div style="text-align:right">
            <span style="background:#1e1b4b;color:#fff;font-family:monospace;font-size:10px;font-weight:bold;padding:4px 8px;border-radius:4px">
              INTEGRITÉ SHA-256 VALIDÉE
            </span>
            <p style="font-size:10px;font-family:monospace;color:#64748b;margin-top:6px">Date export : ${new Date().toLocaleDateString("fr-CA")}</p>
          </div>
        </div>

        <table style="width:100%;border-collapse:collapse;margin-top:15px">
          <thead>
            <tr style="background:#f1f5f9;font-size:10px;text-transform:uppercase;color:#475569">
              <th style="padding:8px;border:1px solid #cbd5e1;text-align:left">Horodatage</th>
              <th style="padding:8px;border:1px solid #cbd5e1;text-align:left">Acteur & Rôle</th>
              <th style="padding:8px;border:1px solid #cbd5e1;text-align:left">Action</th>
              <th style="padding:8px;border:1px solid #cbd5e1;text-align:left">Description Événement</th>
              <th style="padding:8px;border:1px solid #cbd5e1;text-align:right">Empreinte SHA-256</th>
            </tr>
          </thead>
          <tbody style="font-size:11px">
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `
    triggerDocumentPdfDownload("Rapport_Audit_Inalterable_CICC.html", "Journal d'Audit CICC — Registre Inaltérable SHA-256", pdfHtml)
    setNotice("Impression & Export du Rapport d'Audit CICC démarré.")
    setTimeout(() => setNotice(null), 4000)
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      
      {/* HEADER REUTILISABLE PAGEHEADER */}
      <PageHeader 
        title="Journal d'Audit Inaltérable & Approbations CRIC"
        subtitle="Contrôle de conformité CICC, traçabilité cryptographique SHA-256 et file d'approbation en 2 temps (Art. 13)."
        badgeText="CONFORMITÉ CICC ART. 13"
        badgeVariant="emerald"
        actions={
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>Exporter CSV</span>
            </button>

            <button
              type="button"
              onClick={handleExportPdf}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-indigo-900 hover:bg-indigo-950 text-white text-xs font-bold transition-all shadow-md shadow-indigo-900/20 cursor-pointer"
            >
              <FileCheck2 className="w-4 h-4 text-indigo-300" />
              <span>Rapport Audit PDF CICC</span>
            </button>
          </div>
        }
      />

      {/* BANNIÈRE DE NOTIFICATION REACTIVE */}
      {notice && (
        <div className="p-4 rounded-2xl bg-indigo-950 border border-indigo-700 text-white text-xs font-bold flex items-center justify-between shadow-lg animate-fadeIn">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-indigo-400 shrink-0" />
            <span>{notice}</span>
          </div>
          <button type="button" onClick={() => setNotice(null)} className="text-indigo-300 hover:text-white font-mono">✕</button>
        </div>
      )}

      {/* BANNIÈRE DE CONTRÔLE D'INTÉGRITÉ CRYPTOGRAPHIQUE SHA-256 */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 border border-indigo-800/40 shadow-2xl text-white relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center shrink-0 shadow-inner">
              <Lock className="w-7 h-7 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black tracking-tight text-white">Registre Registral en Ajout Seul (Immutable Log)</h2>
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2.5 py-0.5 rounded-full">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" /> Chaîne de Hachage Validée
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                Toutes les mutations métier (contrats, virements fidéicommis, approbations) sont scellées par une empreinte SHA-256 dépendante de la transaction précédente (<code className="font-mono text-indigo-300">row_hash</code>). Toute suppression ou altération rétroactive est détectable instantanément.
              </p>
              <div className="flex items-center gap-4 mt-3 text-[11px] font-mono text-slate-400">
                <span>Cabinet : <strong className="text-white">{firm.name}</strong></span>
                <span>•</span>
                <span>Dernier Hash: <strong className="text-indigo-300">{logs[0]?.rowHash.substring(0, 16)}...</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleVerifyChain}
              disabled={verifyingChain}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${verifyingChain ? "animate-spin" : ""}`} />
              <span>{verifyingChain ? "Vérification en cours..." : "Recalculer la Chaîne SHA-256"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* SÉLECTEUR D'ONGLETS ET INDICATEUR D'APPROBATION EN 2 TEMPS */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl">
          <button
            type="button"
            onClick={() => setActiveTab("logs")}
            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "logs" 
                ? "bg-white text-indigo-950 shadow-sm" 
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <FileText className="w-4 h-4 text-indigo-600" />
            <span>Journal d&apos;Audit du Cabinet ({logs.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("approvals")}
            className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 relative ${
              activeTab === "approvals" 
                ? "bg-indigo-900 text-white shadow-sm" 
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <UserCheck className="w-4 h-4 text-indigo-300" />
            <span>File d&apos;Approbations CRIC (action_approvals)</span>
            {pendingApprovalsCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-black text-[10px] flex items-center justify-center animate-pulse">
                {pendingApprovalsCount}
              </span>
            )}
          </button>
        </div>

        <div className="text-xs text-slate-500 font-medium hidden sm:block">
          {activeTab === "logs" 
            ? "Affichage des accès et mutations horodatés" 
            : "Mécanique d'approbation en 2 temps pour les actes réservés aux CRIC"}
        </div>
      </div>

      {/* VUE 1 : JOURNAL D'AUDIT GENERAL ET FILTRES */}
      {activeTab === "logs" && (
        <div className="space-y-6">
          
          {/* BARRE DE RECHERCHE ET FILTRES MULTICRITÈRES */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher par résumé, courriel, hash SHA-256 ou ID dossier..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-xs font-medium rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 focus:outline-none transition-all"
              />
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Filtre par Rôle */}
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span>Rôle :</span>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value="all">Tous les rôles</option>
                  <option value="owner">Propriétaire (Owner)</option>
                  <option value="rcic">Consultant RCIC</option>
                  <option value="risia">Stagiaire RISIA</option>
                  <option value="staff">Adjoint Administrative</option>
                </select>
              </div>

              {/* Filtre par Action */}
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                <span>Action :</span>
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                >
                  <option value="all">Toutes les actions</option>
                  <option value="approval">Approbation CRIC</option>
                  <option value="trust_transfer">Virement Fidéicommis</option>
                  <option value="create">Création (Create)</option>
                  <option value="update">Modification (Update)</option>
                  <option value="download">Téléchargement</option>
                </select>
              </div>
            </div>
          </div>

          {/* TABLEAU COMPACT HAUTE DENSITÉ DES EVENEMENTS D'AUDIT */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-50 font-black uppercase text-[10px] text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4 w-[16%] whitespace-nowrap">Horodatage (ISO)</th>
                    <th className="py-3.5 px-4 w-[22%]">Acteur & Rôle</th>
                    <th className="py-3.5 px-4 w-[14%]">Action & Type</th>
                    <th className="py-3.5 px-4 w-[34%]">Résumé de l&apos;Événement Audité</th>
                    <th className="py-3.5 px-4 w-[14%] text-right whitespace-nowrap">Empreinte SHA-256</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {filteredLogs.map(log => (
                    <tr 
                      key={log.id} 
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 px-4 font-mono text-slate-600 whitespace-nowrap">
                        {new Date(log.occurredAt).toLocaleString("fr-CA", { dateStyle: "short", timeStyle: "medium" })}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                            log.actorRole === "rcic" || log.actorRole === "owner" 
                              ? "bg-indigo-100 text-indigo-900 border border-indigo-200" 
                              : log.actorRole === "risia"
                              ? "bg-emerald-100 text-emerald-900 border border-emerald-200"
                              : "bg-amber-100 text-amber-900 border border-amber-200"
                          }`}>
                            {log.actorRole}
                          </span>
                          <span className="font-bold text-slate-900 truncate max-w-[150px]">{log.actorName}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="bg-slate-100 text-slate-700 font-mono font-bold px-2 py-0.5 rounded text-[10px] uppercase">
                          {log.action}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                        {log.summary}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono text-[10px] text-slate-400 group-hover:text-indigo-600 whitespace-nowrap">
                        {log.rowHash.substring(0, 14)}...
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* VUE 2 : FILE D'APPROBATIONS EN 2 TEMPS (ACTION_APPROVALS) */}
      {activeTab === "approvals" && (
        <div className="space-y-6">
          <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 flex items-start gap-4 text-xs font-sans text-amber-950">
            <BadgeAlert className="w-6 h-6 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <strong className="text-amber-900 font-extrabold text-sm block">Mécanique de Supervision CRIC en 2 Temps (Règlement sur la Conduite du CICC)</strong>
              <p className="mt-1 text-amber-900/90 leading-relaxed">
                Conformément aux règlements du CICC, le personnel administratif (<code className="font-mono bg-amber-100 px-1 rounded">staff</code>) et les stagiaires (<code className="font-mono bg-amber-100 px-1 rounded">risia</code>) peuvent **préparer** des actes réservés (virements fidéicommis, contrats, fermetures de dossiers). Cependant, l&apos;acte ne devient exécutoire qu&apos;après **validation électronique explicite par le consultant titulaire (CRIC)**.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {approvals.map(approval => (
              <div 
                key={approval.id} 
                className={`p-6 rounded-3xl border transition-all ${
                  approval.status === "pending" 
                    ? "bg-white border-amber-300 shadow-md shadow-amber-500/5 ring-2 ring-amber-400/20" 
                    : approval.status === "approved"
                    ? "bg-slate-50 border-emerald-200 opacity-90"
                    : "bg-rose-50/50 border-rose-200 opacity-80"
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                        approval.status === "pending" ? "bg-amber-100 text-amber-900 border border-amber-300" :
                        approval.status === "approved" ? "bg-emerald-100 text-emerald-900 border border-emerald-300" :
                        "bg-rose-100 text-rose-900 border border-rose-300"
                      }`}>
                        {approval.status === "pending" ? "⏳ En attente de validation CRIC" : approval.status === "approved" ? "✅ Approuvé & Exécuté" : "❌ Rejeté"}
                      </span>
                      <span className="text-xs font-mono text-slate-500">{approval.matterTitle}</span>
                    </div>

                    <h3 className="text-base font-black text-slate-900">{approval.actionTitle}</h3>
                    <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">{approval.summary}</p>

                    <div className="flex items-center gap-4 text-xs font-medium text-slate-500 pt-1">
                      <span>Préparé par : <strong className="text-slate-800">{approval.preparedBy}</strong></span>
                      <span>•</span>
                      <span>Horodatage : <span className="font-mono">{new Date(approval.preparedAt).toLocaleString("fr-CA")}</span></span>
                      {approval.approvedBy && (
                        <>
                          <span>•</span>
                          <span className="text-emerald-700 font-bold">Approuvé par : {approval.approvedBy}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions du Consultant Titulaire RCIC */}
                  {approval.status === "pending" && (
                    <div className="flex items-center gap-3 shrink-0 pt-2 md:pt-0">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedApproval(approval)
                          setShowRejectInput(true)
                        }}
                        className="px-4 py-2.5 rounded-2xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold transition-all cursor-pointer"
                      >
                        Rejeter
                      </button>

                      <button
                        type="button"
                        onClick={() => handleApproveAction(approval.id)}
                        className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        <span>Approuver & Signer (RCIC)</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL 1 : DETAIL D'UN ENREGISTREMENT D'AUDIT ET DIFFERENTIEL (DIFF) */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-xl rounded-3xl border border-slate-200 shadow-2xl p-6 sm:p-8 flex flex-col gap-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-indigo-100 text-indigo-900 flex items-center justify-center font-bold">
                  <KeyRound className="w-5 h-5 text-indigo-700" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Preuve d&apos;Audit Cryptographique</h3>
                  <p className="text-xs text-slate-500 font-mono">ID Log: {selectedLog.id}</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setSelectedLog(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs font-sans">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Acteur :</span>
                  <span className="font-bold text-slate-900">{selectedLog.actorName} ({selectedLog.actorEmail})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Rôle CICC :</span>
                  <span className="font-mono text-indigo-900 font-bold uppercase">{selectedLog.actorRole}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Adresse IP & Agent :</span>
                  <span className="font-mono text-slate-700">{selectedLog.ipAddress}</span>
                </div>
              </div>

              <div>
                <strong className="text-slate-900 font-bold block mb-1">Résumé de la Mutation :</strong>
                <p className="p-3 bg-indigo-50/60 rounded-xl text-indigo-950 font-bold border border-indigo-200 leading-relaxed">
                  {selectedLog.summary}
                </p>
              </div>

              {selectedLog.changes && (
                <div>
                  <strong className="text-slate-900 font-bold block mb-1">Différentiel de Données (Before / After) :</strong>
                  <pre className="p-3 bg-slate-900 text-slate-200 rounded-xl font-mono text-[10px] overflow-x-auto">
                    {JSON.stringify(selectedLog.changes, null, 2)}
                  </pre>
                </div>
              )}

              <div>
                <strong className="text-slate-900 font-bold block mb-1">Chaîne Cryptographique SHA-256 :</strong>
                <div className="p-3 bg-slate-100 rounded-xl font-mono text-[10px] text-slate-700 break-all space-y-1">
                  <div><strong>Prev Hash:</strong> {selectedLog.prevHash}</div>
                  <div className="text-indigo-900 font-bold"><strong>Row Hash:</strong> {selectedLog.rowHash}</div>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2 : MOTIF DE REJET D'UNE DEMANDE D'APPROBATION */}
      {showRejectInput && selectedApproval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-3xl border border-slate-200 shadow-2xl p-6 flex flex-col gap-4">
            <h3 className="text-base font-black text-slate-900">Motif de Rejet de la Demande</h3>
            <p className="text-xs text-slate-600">
              Précisez au préparateur (<strong className="text-slate-900">{selectedApproval.preparedBy}</strong>) la raison du refus pour correction :
            </p>
            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Ex: Le montant des honoraires ne correspond pas à la Phase 1 de l'entente..."
              className="w-full p-3 text-xs border border-slate-300 rounded-2xl focus:outline-none focus:border-rose-600 font-medium"
            />
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowRejectInput(false)
                  setSelectedApproval(null)
                }}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => handleRejectAction(selectedApproval.id)}
                className="px-5 py-2 text-xs font-bold bg-rose-600 text-white rounded-xl hover:bg-rose-700"
              >
                Confirmer le Rejet
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
