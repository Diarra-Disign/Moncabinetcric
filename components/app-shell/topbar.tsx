"use client"

import * as React from "react"
import { Search, Bell, ChevronRight, X, SlidersHorizontal } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { LocaleSwitcher } from "./locale-switcher"
import { ThemePicker } from "./theme-picker"
import { MemberMenu } from "./member-menu"
import { MobileNav } from "./mobile-nav"
import { useTranslations } from "next-intl"
import { useRouter } from "@/i18n/routing"

export interface SearchItem {
  id: string
  title: string
  subtitle: string
  type: "matter" | "client" | "document"
  href: string
}

export interface TopbarMember {
  fullName: string
  email: string
  ciccRole: string
  initials: string
}

interface TopbarProps {
  searchDb?: SearchItem[]
  /** Membre connecté, résolu côté serveur depuis la session. */
  member?: TopbarMember | null
}

export function Topbar({ searchDb = [], member = null }: TopbarProps = {}) {
  const t = useTranslations("Navigation")
  const router = useRouter()
  const [query, setQuery] = React.useState("")
  const [isOpen, setIsOpen] = React.useState(false)
  const topbarRef = React.useRef<HTMLDivElement>(null)

  const filteredResults = query.trim() === "" ? [] : searchDb.filter(item =>
    item.title.toLowerCase().includes(query.toLowerCase()) ||
    item.subtitle.toLowerCase().includes(query.toLowerCase())
  )

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (topbarRef.current && !topbarRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleOpenCustomizeModal = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("cric_open_widgets_modal"))
    }
  }

  return (
    <header className="sticky top-0 z-[100] flex h-16 shrink-0 items-center gap-x-4 border-b border-border bg-background/95 backdrop-blur-md px-4 shadow-xs sm:gap-x-6 sm:px-6 lg:px-8">
      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6 items-center" ref={topbarRef}>
        <MobileNav />
        
        {/* BARRE DE RECHERCHE GLOBALE AVEC DROPDOWN NON ROGNÉ */}
        <div className="relative flex flex-1 min-w-0 max-w-md items-center">
          <label htmlFor="search-field" className="sr-only">
            {t('search')}
          </label>
          <Search
            className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="search-field"
            className="block h-10 w-full rounded-2xl border border-border bg-muted/30 pl-9 pr-8 text-xs font-bold text-foreground placeholder:text-muted-foreground focus:bg-background focus:ring-1 focus:ring-primary shadow-2xs"
            placeholder={t('searchPlaceholder')}
            type="search"
            value={query}
            onFocus={() => setIsOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value)
              setIsOpen(true)
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-3 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          {/* DROPDOWN D'APERÇU RECHERCHE GLOBALE */}
          {isOpen && query.trim() !== "" && (
            <div className="absolute left-0 right-0 top-12 bg-white rounded-2xl border border-slate-300 shadow-2xl p-2 z-[120] animate-fadeIn max-h-80 overflow-y-auto ring-1 ring-slate-900/10">
              <div className="px-3 py-1.5 text-[10px] font-black uppercase text-slate-400 border-b border-slate-100 flex items-center justify-between">
                <span>Recherche globale ({filteredResults.length})</span>
                <span className="text-blue-600 font-mono">MonCabinetCRIC</span>
              </div>

              {filteredResults.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 font-medium">
                  Aucun résultat trouvé pour &quot;{query}&quot;
                </div>
              ) : (
                <div className="flex flex-col gap-1 mt-1">
                  {filteredResults.map(item => (
                    <div
                      key={item.id}
                      onClick={() => {
                        setIsOpen(false)
                        router.push(item.href as Parameters<typeof router.push>[0])
                      }}
                      className="p-2.5 rounded-xl hover:bg-blue-50/90 transition-colors cursor-pointer flex items-center justify-between group border border-transparent hover:border-blue-200"
                    >
                      <div>
                        <div className="text-xs font-black text-slate-900 group-hover:text-blue-600 transition-colors flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                          <span>{item.title}</span>
                        </div>
                        <div className="text-[10px] font-semibold text-slate-500 pl-3">{item.subtitle}</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-x-3 lg:gap-x-3.5 ml-auto">
          {/* BOUTON VUES & WIDGETS DANS LA BARRE SUPÉRIEURE À CÔTÉ DU THÈME */}
          <button
            type="button"
            onClick={handleOpenCustomizeModal}
            className="inline-flex items-center gap-1.5 rounded-xl bg-muted/60 hover:bg-muted border border-border/80 px-3 py-1.5 text-xs font-bold text-foreground transition-all cursor-pointer shadow-2xs"
            title="Personnaliser les vues & widgets du tableau de bord"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
            <span className="hidden sm:inline">Vues & Widgets</span>
          </button>

          <ThemePicker />
          <LocaleSwitcher />
          <Button variant="ghost" size="icon" aria-label={t('notifications')} className="rounded-xl">
            <Bell className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </Button>

          <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-border" aria-hidden="true" />

          {member && (
            <MemberMenu
              fullName={member.fullName}
              email={member.email}
              ciccRole={member.ciccRole}
              initials={member.initials}
            />
          )}
        </div>
      </div>
    </header>
  )
}
