"use client"

import { Link, usePathname } from "@/lib/i18n/routing"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"
import { MAIN_NAV, OTHER_NAV } from "./nav-items"
import { useSidebar } from "./sidebar-context"
import { PanelLeftClose, PanelLeftOpen, ChevronLeft, ChevronRight } from "lucide-react"

export function Sidebar() {
  const t = useTranslations("Navigation")
  const pathname = usePathname()
  const { isCollapsed, toggleSidebar } = useSidebar()

  const renderNavList = (items: typeof MAIN_NAV) => (
    <ul role="list" className={cn("space-y-1", isCollapsed ? "-mx-1" : "-mx-2")}>
      {items.map((item) => {
        const isActive = pathname.startsWith(item.href)
        const Icon = item.icon
        const label = t(item.labelKey)

        return (
          <li key={item.href}>
            <Link
              href={item.href}
              title={isCollapsed ? label : undefined}
              className={cn(
                isActive
                  ? "bg-primary/10 text-primary font-bold"
                  : "text-foreground hover:bg-muted hover:text-foreground",
                "group flex items-center rounded-xl p-2.5 text-sm leading-6 transition-all duration-200",
                isCollapsed ? "justify-center" : "gap-x-3"
              )}
            >
              <Icon
                className={cn(
                  isActive ? "text-primary scale-105" : "text-muted-foreground group-hover:text-foreground",
                  "h-5 w-5 shrink-0 transition-transform"
                )}
                aria-hidden="true"
              />
              {!isCollapsed && (
                <span className="truncate">{label}</span>
              )}
            </Link>
          </li>
        )
      })}
    </ul>
  )

  return (
    <div
      className={cn(
        "hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:flex-col transition-all duration-300 ease-in-out relative",
        isCollapsed ? "lg:w-20" : "lg:w-72"
      )}
    >
      {/* Bouton de Rétraction Flottant sur la bordure droite */}
      <button
        type="button"
        onClick={toggleSidebar}
        title={isCollapsed ? "Agrandir le menu latéral (Afficher les titres)" : "Réduire le menu latéral (Icônes uniquement)"}
        className="absolute top-[18px] -right-4 z-[100] h-8 w-8 rounded-full border-2 border-primary/25 bg-card shadow-lg flex items-center justify-center text-primary hover:bg-primary hover:text-primary-foreground hover:scale-110 hover:shadow-xl transition-all duration-200 cursor-pointer"
      >
        {isCollapsed ? (
          <ChevronRight className="h-4.5 w-4.5" />
        ) : (
          <ChevronLeft className="h-4.5 w-4.5" />
        )}
      </button>

      <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-border bg-card px-4 pb-4 shadow-sm">
        {/* En-tête de la Sidebar avec Logo uniquement */}
        <div className="flex h-16 shrink-0 items-center justify-center border-b border-border/50">
          <div className="flex items-center gap-2.5 text-primary font-extrabold text-xl tracking-tight overflow-hidden">
            <div className="h-9 w-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-black text-lg shadow-sm shrink-0">
              M
            </div>
            {!isCollapsed && (
              <span className="truncate">moncabinetcric</span>
            )}
          </div>
        </div>

        {/* Navigation Principale */}
        <nav className="flex flex-1 flex-col">
          <ul role="list" className="flex flex-1 flex-col gap-y-6">
            <li>
              {!isCollapsed && (
                <div className="text-[10px] font-bold leading-6 text-muted-foreground uppercase tracking-widest mb-2 px-1">
                  {t("main")}
                </div>
              )}
              {renderNavList(MAIN_NAV)}
            </li>
            <li>
              {!isCollapsed && (
                <div className="text-[10px] font-bold leading-6 text-muted-foreground uppercase tracking-widest mb-2 px-1">
                  {t("other")}
                </div>
              )}
              {renderNavList(OTHER_NAV)}
            </li>
          </ul>
        </nav>

        {/* Bouton de bascule en bas de la sidebar (quand réduite) */}
        {isCollapsed && (
          <div className="pt-2 border-t border-border/50 flex justify-center">
            <button
              type="button"
              onClick={toggleSidebar}
              title="Agrandir le menu latéral"
              className="w-full py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center transition-colors cursor-pointer"
            >
              <PanelLeftOpen className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
