"use client"

import { Link, usePathname } from "@/i18n/routing"
import { useTranslations } from "next-intl"
import { cn } from "@/lib/utils"
import { MAIN_NAV, OTHER_NAV } from "./nav-items"

export function Sidebar() {
  const t = useTranslations("Navigation")
  const pathname = usePathname()

  const renderNavList = (items: typeof MAIN_NAV) => (
    <ul role="list" className="-mx-2 space-y-1">
      {items.map((item) => {
        const isActive = pathname.startsWith(item.href)
        const Icon = item.icon
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              className={cn(
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-foreground hover:bg-muted hover:text-foreground",
                "group flex gap-x-3 rounded-xl p-2 text-sm font-semibold leading-6 transition-colors"
              )}
            >
              <Icon
                className={cn(
                  isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
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
  )

  return (
    <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
      <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-border bg-card px-6 pb-4 shadow-sm">
        <div className="flex h-16 shrink-0 items-center">
          {/* Logo Placeholder */}
          <div className="flex items-center gap-2 text-primary font-bold text-2xl tracking-tight">
            <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
              M
            </div>
            moncabinetcric
          </div>
        </div>
        <nav className="flex flex-1 flex-col">
          <ul role="list" className="flex flex-1 flex-col gap-y-7">
            <li>
              <div className="text-xs font-semibold leading-6 text-muted-foreground uppercase tracking-wider mb-2">
                {t("main")}
              </div>
              {renderNavList(MAIN_NAV)}
            </li>
            <li>
              <div className="text-xs font-semibold leading-6 text-muted-foreground uppercase tracking-wider mb-2">
                {t("other")}
              </div>
              {renderNavList(OTHER_NAV)}
            </li>
          </ul>
        </nav>
      </div>
    </div>
  )
}
