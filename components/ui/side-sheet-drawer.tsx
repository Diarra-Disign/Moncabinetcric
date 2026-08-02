"use client"

import * as React from "react"
import { X, Sparkles, FolderOpen, User, DollarSign, Calendar, FileText, CheckCircle2, ShieldCheck } from "lucide-react"

export interface SideSheetDrawerProps {
  isOpen: boolean
  onClose: () => void
  title: string
  subtitle?: string
  badgeText?: string
  badgeVariant?: "emerald" | "blue" | "amber" | "indigo"
  children: React.ReactNode
}

export function SideSheetDrawer({
  isOpen,
  onClose,
  title,
  subtitle,
  badgeText,
  badgeVariant = "indigo",
  children
}: SideSheetDrawerProps) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const getBadgeStyle = () => {
    switch (badgeVariant) {
      case "emerald":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-400/30"
      case "blue":
        return "bg-blue-500/20 text-blue-300 border-blue-400/30"
      case "amber":
        return "bg-amber-500/20 text-amber-300 border-amber-400/30"
      default:
        return "bg-indigo-500/20 text-indigo-300 border-indigo-400/30"
    }
  }

  return (
    <div className="fixed inset-0 z-[200] overflow-hidden">
      {/* Backdrop sombre flouté */}
      <div 
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-md transition-opacity animate-fadeIn" 
        onClick={onClose}
      />

      {/* Panneau Coulissant Lateral (Right Side Sheet) */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-xl bg-white shadow-2xl border-l border-slate-200 flex flex-col transform transition-transform duration-300 ease-in-out animate-slideLeft">
          
          {/* Header du Tiroir */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 border-b border-slate-800 flex items-center justify-between shrink-0 relative overflow-hidden">
            <div className="flex items-center gap-3 relative z-10">
              <div className="h-10 w-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 flex items-center justify-center font-black shrink-0">
                <FolderOpen className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-white">{title}</h3>
                  {badgeText && (
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border font-mono ${getBadgeStyle()}`}>
                      {badgeText}
                    </span>
                  )}
                </div>
                {subtitle && <p className="text-xs text-slate-300 mt-0.5">{subtitle}</p>}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold flex items-center justify-center transition-colors cursor-pointer shrink-0 relative z-10"
              title="Fermer (Échap)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Contenu Déroulant */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
            {children}
          </div>

          {/* Footer du Tiroir */}
          <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between shrink-0 text-xs">
            <span className="text-slate-400 font-mono text-[10px] flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> MonCabinetCRIC — Aperçu Rapide Sans Perte de Contexte
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors cursor-pointer"
            >
              Fermer
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
