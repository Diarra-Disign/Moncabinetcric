"use client"

import * as React from "react"
import { Palette, Check, Sparkles } from "lucide-react"

export type ThemePalette = "sapphire" | "emerald" | "amber" | "purple" | "midnight"

export function ThemePicker() {
  const [isOpen, setIsOpen] = React.useState(false)
  const [activeTheme, setActiveTheme] = React.useState<ThemePalette>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("cabinet_theme") as ThemePalette
      if (saved) {
        document.documentElement.setAttribute("data-cabinet-theme", saved)
        return saved
      }
    }
    return "sapphire"
  })
  const pickerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const applyTheme = (theme: ThemePalette) => {
    setActiveTheme(theme)
    setIsOpen(false)
    localStorage.setItem("cabinet_theme", theme)
    document.documentElement.setAttribute("data-cabinet-theme", theme)
    // Dispatch custom event to notify all listening components
    window.dispatchEvent(new CustomEvent("cabinetThemeChanged", { detail: theme }))
  }

  return (
    <div className="relative inline-block" ref={pickerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200 text-xs font-black transition-all cursor-pointer shadow-2xs"
        title="Personnaliser les couleurs du Cabinet"
      >
        <Palette className="w-3.5 h-3.5 text-primary" />
        <span className="hidden sm:inline">Thème</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-11 bg-white rounded-3xl border border-slate-200 shadow-2xl p-4 z-[150] animate-fadeIn w-64 ring-1 ring-slate-900/10 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-xs font-black uppercase text-slate-800 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Nuancier Exécutif
            </span>
            <span className="text-[10px] font-bold text-slate-400 font-mono">4 Modes</span>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => applyTheme("sapphire")}
              className={`w-full p-2.5 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                activeTheme === "sapphire" ? "bg-blue-50 border-blue-400 ring-2 ring-blue-500/20" : "bg-slate-50 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-4 rounded-full bg-blue-600 border border-blue-400 shrink-0" />
                <span className="text-xs font-black text-slate-900">Bleu Saphir CICC</span>
              </div>
              {activeTheme === "sapphire" && <Check className="w-4 h-4 text-blue-600" />}
            </button>

            <button
              onClick={() => applyTheme("emerald")}
              className={`w-full p-2.5 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                activeTheme === "emerald" ? "bg-emerald-50 border-emerald-400 ring-2 ring-emerald-500/20" : "bg-slate-50 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-4 rounded-full bg-emerald-600 border border-emerald-400 shrink-0" />
                <span className="text-xs font-black text-slate-900">Émeraude Fiducie</span>
              </div>
              {activeTheme === "emerald" && <Check className="w-4 h-4 text-emerald-600" />}
            </button>

            <button
              onClick={() => applyTheme("amber")}
              className={`w-full p-2.5 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                activeTheme === "amber" ? "bg-amber-50 border-amber-400 ring-2 ring-amber-500/20" : "bg-slate-50 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-4 rounded-full bg-amber-600 border border-amber-400 shrink-0" />
                <span className="text-xs font-black text-slate-900">Ambre Prestige</span>
              </div>
              {activeTheme === "amber" && <Check className="w-4 h-4 text-amber-600" />}
            </button>

            <button
              onClick={() => applyTheme("purple")}
              className={`w-full p-2.5 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                activeTheme === "purple" ? "bg-purple-50 border-purple-400 ring-2 ring-purple-500/20" : "bg-slate-50 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-4 rounded-full bg-purple-600 border border-purple-400 shrink-0" />
                <span className="text-xs font-black text-slate-900">Violet Exécutif</span>
              </div>
              {activeTheme === "purple" && <Check className="w-4 h-4 text-purple-600" />}
            </button>

            <button
              onClick={() => applyTheme("midnight")}
              className={`w-full p-2.5 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                activeTheme === "midnight" ? "bg-slate-900 border-slate-700 text-white ring-2 ring-blue-500/20" : "bg-slate-900/90 text-white border-slate-800 hover:bg-slate-900"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-4 rounded-full bg-blue-500 border border-blue-400 shrink-0" />
                <span className="text-xs font-black text-white">Mode Nuit Calme 🌙</span>
              </div>
              {activeTheme === "midnight" && <Check className="w-4 h-4 text-blue-400" />}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
