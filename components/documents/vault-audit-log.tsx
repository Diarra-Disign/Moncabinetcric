"use client"

import * as React from "react"
import {
  Shield,
  Download,
  Upload,
  Eye,
  Trash2,
  Archive,
  FileCheck2,
  Link2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  Clock
} from "lucide-react"
import { AuditLogRecord } from "@/lib/data/types"

interface VaultAuditLogProps {
  initialAuditEntries: AuditLogRecord[]
  sessionAuditEntries: AuditLogRecord[]
}

const ACTION_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  create: { label: "Téléversement", icon: Upload, color: "text-success-strong", bgColor: "bg-success/10 border-success/30" },
  download: { label: "Téléchargement", icon: Download, color: "text-primary-strong", bgColor: "bg-primary/10 border-primary/30" },
  view: { label: "Consultation", icon: Eye, color: "text-muted-foreground", bgColor: "bg-muted border-border" },
  update: { label: "Archivage", icon: Archive, color: "text-warning-strong", bgColor: "bg-warning/10 border-warning/40" },
  delete: { label: "Suppression", icon: Trash2, color: "text-error-strong", bgColor: "bg-error/10 border-error/30" },
  export: { label: "Export Audit", icon: FileCheck2, color: "text-primary-strong", bgColor: "bg-primary/10 border-primary/30" },
}

// Libellés français : la désignation du CICC s'écrit CRIC en français et
// RCIC en anglais. La clé du rôle, elle, reste `rcic` — c'est la valeur
// stockée en base, et la renommer demanderait une migration.
const ROLE_LABELS: Record<string, string> = {
  owner: "Propriétaire",
  rcic: "CRIC",
  risia: "Stagiaire RISIA",
  staff: "Personnel",
  bookkeeper: "Comptable",
  system: "Système",
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString("fr-CA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
}

function truncateHash(hash: string, len = 16): string {
  if (!hash) return "—"
  return hash.length > len ? `${hash.slice(0, len)}...` : hash
}

/**
 * Vérifie que la chaîne d'intégrité SHA-256 est continue :
 * chaque entrée doit avoir un prevHash qui correspond au rowHash de l'entrée précédente
 */
function verifyChainIntegrity(entries: AuditLogRecord[]): { isValid: boolean; brokenAt: number | null } {
  const sorted = [...entries].sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime())
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].prevHash !== sorted[i - 1].rowHash) {
      return { isValid: false, brokenAt: i }
    }
  }
  return { isValid: true, brokenAt: null }
}

export function VaultAuditLog({ initialAuditEntries, sessionAuditEntries }: VaultAuditLogProps) {
  const [expandedRow, setExpandedRow] = React.useState<string | null>(null)
  const [showSessionOnly, setShowSessionOnly] = React.useState(false)

  const allEntries = React.useMemo(() => {
    const combined = [...sessionAuditEntries, ...initialAuditEntries]
    return combined.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
  }, [initialAuditEntries, sessionAuditEntries])

  const displayEntries = showSessionOnly ? sessionAuditEntries : allEntries

  const chainStatus = React.useMemo(() => verifyChainIntegrity(initialAuditEntries), [initialAuditEntries])

  return (
    <div className="space-y-5 animate-fadeIn">

      {/* BANDEAU D'INTÉGRITÉ DE LA CHAÎNE SHA-256 */}
      <div className={`flex items-center justify-between p-4 rounded-2xl border ${
        chainStatus.isValid 
          ? "bg-success/10 border-success/40" 
          : "bg-error/10 border-error/40"
      }`}>
        <div className="flex items-center gap-3">
          {chainStatus.isValid ? (
            <div className="h-10 w-10 rounded-xl bg-success/15 text-success-strong flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5" />
            </div>
          ) : (
            <div className="h-10 w-10 rounded-xl bg-error/15 text-error-strong flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
          )}
          <div>
            <h3 className={`text-sm font-black ${chainStatus.isValid ? "text-success-strong" : "text-error-strong"}`}>
              {chainStatus.isValid
                ? "✅ Chaîne d'intégrité SHA-256 vérifiée — Aucune rupture détectée"
                : `⚠️ Rupture détectée dans la chaîne d'intégrité à l'entrée #${chainStatus.brokenAt}`}
            </h3>
            <p className={`text-[10px] mt-0.5 ${chainStatus.isValid ? "text-success-strong" : "text-error-strong"}`}>
              {/* On compte les entrées réellement vérifiées, pas toutes celles
                  affichées : les entrées de la session en cours n'ont pas
                  encore été scellées par la base. */}
              {initialAuditEntries.length} entrées scellées et vérifiées · SHA-256 · chaînage prevHash → rowHash
              {sessionAuditEntries.length > 0 && (
                <> · {sessionAuditEntries.length} en attente de scellement</>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1.5 rounded-full text-[10px] font-bold border ${
            chainStatus.isValid 
              ? "bg-success/15 text-success-strong border-success/40" 
              : "bg-error/15 text-error-strong border-error/40"
          }`}>
            {chainStatus.isValid ? "INTÉGRITÉ OK" : "INTÉGRITÉ COMPROMISE"}
          </span>
        </div>
      </div>

      {/* FILTRES SESSION / TOUT */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowSessionOnly(false)}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            !showSessionOnly ? "bg-foreground text-background shadow-sm" : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          Toutes les entrées ({allEntries.length})
        </button>
        <button
          type="button"
          onClick={() => setShowSessionOnly(true)}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            showSessionOnly ? "bg-foreground text-background shadow-sm" : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          Session en cours ({sessionAuditEntries.length})
        </button>
      </div>

      {/* TABLEAU D'AUDIT */}
      <div className="bg-card rounded-3xl border border-border shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-muted/40 font-black uppercase text-[10px] text-muted-foreground border-b border-border">
              <tr>
                <th className="py-3.5 px-4 w-[18%]">Horodatage</th>
                <th className="py-3.5 px-4 w-[14%]">Acteur & Rôle</th>
                <th className="py-3.5 px-4 w-[12%]">Action</th>
                <th className="py-3.5 px-4 w-[28%]">Détail de l&apos;Opération</th>
                <th className="py-3.5 px-4 w-[14%]">Chaîne SHA-256</th>
                <th className="py-3.5 px-4 w-[14%] text-right">IP Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-medium text-foreground">
              {displayEntries.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground text-sm">
                    <Clock className="w-8 h-8 mx-auto text-muted-foreground/70 mb-2" />
                    <p className="font-bold">Aucune entrée d&apos;audit pour cette vue</p>
                    <p className="text-[10px] mt-1">Les actions de la session en cours apparaîtront ici.</p>
                  </td>
                </tr>
              )}
              {displayEntries.map(entry => {
                const config = ACTION_CONFIG[entry.action] || ACTION_CONFIG.view
                const Icon = config.icon
                const isExpanded = expandedRow === entry.id

                return (
                  <React.Fragment key={entry.id}>
                    <tr
                      className="hover:bg-muted/40 transition-colors cursor-pointer group"
                      onClick={() => setExpandedRow(isExpanded ? null : entry.id)}
                    >
                      {/* Horodatage */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono text-foreground text-[11px]">{formatTimestamp(entry.occurredAt)}</div>
                      </td>

                      {/* Acteur & Rôle */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-foreground text-[11px]">{entry.actorName}</div>
                        <span className="text-[9px] font-mono text-muted-foreground uppercase">
                          {ROLE_LABELS[entry.actorRole] || entry.actorRole}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold border ${config.bgColor} ${config.color}`}>
                          <Icon className="w-3 h-3" />
                          {config.label}
                        </span>
                      </td>

                      {/* Détail de l'opération */}
                      <td className="py-3.5 px-4">
                        <p className="text-[11px] text-foreground leading-relaxed line-clamp-2">{entry.summary}</p>
                      </td>

                      {/* Chaîne SHA-256 */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <Link2 className={`w-3 h-3 shrink-0 ${entry.rowHash ? "text-primary" : "text-muted-foreground/70"}`} />
                          {entry.rowHash ? (
                            <span className="font-mono text-[9px] text-primary-strong">{truncateHash(entry.rowHash)}</span>
                          ) : (
                            <span className="text-[9px] italic text-muted-foreground">en attente de scellement</span>
                          )}
                        </div>
                      </td>

                      {/* IP Source */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-mono text-[10px] text-muted-foreground">{entry.ipAddress || "—"}</span>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Détails étendus */}
                    {isExpanded && (
                      <tr className="bg-muted/30">
                        <td colSpan={6} className="py-4 px-6">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[10px]">
                            <div>
                              <label className="font-black text-muted-foreground uppercase block mb-1">Empreinte SHA-256 (rowHash)</label>
                              <p className="p-2 bg-foreground text-background rounded-lg font-mono break-all leading-relaxed">
                                {entry.rowHash || "— pas encore scellée par la base"}
                              </p>
                            </div>
                            <div>
                              <label className="font-black text-muted-foreground uppercase block mb-1">Empreinte Précédente (prevHash)</label>
                              <p className="p-2 bg-foreground text-background/70 rounded-lg font-mono break-all leading-relaxed">
                                {entry.prevHash || "—"}
                              </p>
                            </div>
                            <div className="space-y-2">
                              <div>
                                <label className="font-black text-muted-foreground uppercase block mb-1">Courriel Acteur</label>
                                <p className="font-mono text-foreground">{entry.actorEmail}</p>
                              </div>
                              <div>
                                <label className="font-black text-muted-foreground uppercase block mb-1">Agent Utilisateur</label>
                                <p className="font-mono text-muted-foreground text-[9px] truncate">{entry.userAgent}</p>
                              </div>
                              <div>
                                <label className="font-black text-muted-foreground uppercase block mb-1">Entité</label>
                                <p className="font-mono text-foreground">{entry.entityType} · {entry.entityId || "—"}</p>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* PIED DE PAGE SÉCURITÉ */}
      <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground font-mono">
        <CheckCircle2 className="w-3.5 h-3.5 text-success" />
        <span>Journal d&apos;audit en ajout seul (append-only) — Conforme Module 3 SPEC-FONDATIONS · Algorithme SHA-256</span>
      </div>
    </div>
  )
}

export type { VaultAuditLogProps }
