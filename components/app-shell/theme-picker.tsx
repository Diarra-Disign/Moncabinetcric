"use client"

import * as React from "react"
import { Palette, Check } from "lucide-react"

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
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-muted hover:bg-muted/70 text-foreground border border-border text-xs font-black transition-all cursor-pointer shadow-2xs"
        title="Personnaliser les couleurs du Cabinet"
      >
        <Palette className="w-3.5 h-3.5 text-primary" />
        <span className="hidden sm:inline">Thème</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-11 bg-card rounded-3xl border border-border shadow-2xl p-4 z-[150] animate-fadeIn w-64 ring-1 ring-border space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <span className="text-xs font-black uppercase text-foreground flex items-center gap-1.5"> Nuancier Exécutif
            </span>
            <span className="text-[10px] font-bold text-muted-foreground font-mono">5 modes</span>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => applyTheme("sapphire")}
              className={`w-full p-2.5 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                activeTheme === "sapphire" ? "bg-primary/10 border-primary ring-2 ring-primary/20" : "bg-muted/40 border-border hover:bg-muted"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-4 rounded-full bg-blue-600 border border-blue-400 shrink-0" />
                <span className="text-xs font-black text-foreground">Bleu Saphir CICC</span>
              </div>
              {activeTheme === "sapphire" && <Check className="w-4 h-4 text-primary" />}
            </button>

            <button
              onClick={() => applyTheme("emerald")}
              className={`w-full p-2.5 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                activeTheme === "emerald" ? "bg-primary/10 border-primary ring-2 ring-primary/20" : "bg-muted/40 border-border hover:bg-muted"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-4 rounded-full bg-emerald-600 border border-emerald-400 shrink-0" />
                <span className="text-xs font-black text-foreground">Émeraude Fiducie</span>
              </div>
              {activeTheme === "emerald" && <Check className="w-4 h-4 text-primary" />}
            </button>

            <button
              onClick={() => applyTheme("amber")}
              className={`w-full p-2.5 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                activeTheme === "amber" ? "bg-primary/10 border-primary ring-2 ring-primary/20" : "bg-muted/40 border-border hover:bg-muted"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-4 rounded-full bg-amber-600 border border-amber-400 shrink-0" />
                <span className="text-xs font-black text-foreground">Ambre Prestige</span>
              </div>
              {activeTheme === "amber" && <Check className="w-4 h-4 text-primary" />}
            </button>

            <button
              onClick={() => applyTheme("purple")}
              className={`w-full p-2.5 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                activeTheme === "purple" ? "bg-primary/10 border-primary ring-2 ring-primary/20" : "bg-muted/40 border-border hover:bg-muted"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-4 rounded-full bg-purple-600 border border-purple-400 shrink-0" />
                <span className="text-xs font-black text-foreground">Violet Exécutif</span>
              </div>
              {activeTheme === "purple" && <Check className="w-4 h-4 text-primary" />}
            </button>

            <button
              onClick={() => applyTheme("midnight")}
              className={`w-full p-2.5 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                activeTheme === "midnight" ? "bg-primary/10 border-primary ring-2 ring-primary/20" : "bg-muted/40 border-border hover:bg-muted"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-4 rounded-full bg-blue-500 border border-blue-400 shrink-0" />
                <span className="text-xs font-black text-foreground">Mode Nuit Calme 🌙</span>
              </div>
              {activeTheme === "midnight" && <Check className="w-4 h-4 text-primary" />}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
