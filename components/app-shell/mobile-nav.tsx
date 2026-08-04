"use client"

import * as React from "react"
import { Menu, X } from "lucide-react"
import { useTranslations } from "next-intl"
import { Link, usePathname } from "@/lib/i18n/routing"
import { cn } from "@/lib/utils"
import { MAIN_NAV, OTHER_NAV } from "./nav-items"

export function MobileNav() {
  const t = useTranslations("Navigation")
  const pathname = usePathname()
  const [isOpen, setIsOpen] = React.useState(false)

  // Ferme le tiroir à chaque changement de page
  const prevPathname = React.useRef(pathname)
  React.useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname
      setIsOpen(false)
    }
  }, [pathname])

  // Ferme avec la touche Échap
  React.useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [isOpen])

  const renderGroup = (items: typeof MAIN_NAV, heading: string) => (
    <li>
      <div className="text-xs font-semibold leading-6 text-muted-foreground uppercase tracking-wider mb-2">
        {heading}
      </div>
      <ul role="list" className="-mx-2 space-y-1">
        {items.map((item) => {
          const isActive = pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-muted",
                  "group flex gap-x-3 rounded-xl p-2 text-sm font-semibold leading-6 transition-colors"
                )}
              >
                <Icon
                  className={cn(
                    isActive ? "text-primary" : "text-muted-foreground",
                    "h-5 w-5 shrink-0"
                  )}
                  aria-hidden="true"
                />
                {t(item.labelKey)}
              </Link>
            </li>
          )
        })}
      </ul>
    </li>
  )

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={t("openMenu")}
        aria-expanded={isOpen}
        className="lg:hidden -ml-1 inline-flex h-10 w-10 items-center justify-center rounded-xl text-foreground hover:bg-muted transition-colors"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-[200]">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("menu")}
            className="relative flex h-full w-72 max-w-[85vw] flex-col gap-y-5 overflow-y-auto border-r border-border bg-card px-6 pb-4 shadow-xl"
          >
            <div className="flex h-16 shrink-0 items-center justify-between">
              <div className="flex items-center gap-2 text-primary font-bold text-xl tracking-tight">
                <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
                  M
                </div>
                moncabinetcric
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label={t("closeMenu")}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <nav className="flex flex-1 flex-col">
              <ul role="list" className="flex flex-1 flex-col gap-y-7">
                {renderGroup(MAIN_NAV, t("main"))}
                {renderGroup(OTHER_NAV, t("other"))}
              </ul>
            </nav>
          </div>
        </div>
      )}
    </>
  )
}
