"use client"

import * as React from "react"
import { usePathname, Link } from "@/lib/i18n/routing"
import { useTranslations } from "next-intl"
import { LayoutDashboard, Users, FolderOpen, Calendar, Settings } from "lucide-react"
import { cn } from "@/lib/utils"

export function BottomNav() {
  const t = useTranslations("Navigation")
  const pathname = usePathname()

  const items = [
    { labelKey: "dashboard", href: "/dashboard", icon: LayoutDashboard },
    { labelKey: "clients", href: "/clients", icon: Users },
    { labelKey: "matters", href: "/matters", icon: FolderOpen },
    { labelKey: "calendar", href: "/calendar", icon: Calendar },
    { labelKey: "settings", href: "/settings", icon: Settings },
  ]

  return (
    <nav
      aria-label="Mobile Navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border shadow-lg px-2 py-1.5 transition-all duration-200"
    >
      <div className="flex items-center justify-around max-w-md mx-auto">
        {items.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))
          const Icon = item.icon
          const label = t(item.labelKey)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center min-w-[56px] py-1 px-2 rounded-xl transition-all duration-200 cursor-pointer active:scale-95",
                isActive
                  ? "text-primary-strong font-bold bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5 shrink-0 transition-transform duration-200",
                  isActive ? "scale-110 text-primary-strong" : "text-muted-foreground"
                )}
              />
              <span className="text-[10px] mt-0.5 font-medium truncate max-w-[64px] leading-tight">
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
