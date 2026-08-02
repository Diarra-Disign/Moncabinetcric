import * as React from "react"

export interface PageHeaderProps {
  title: string
  subtitle: string
  action?: React.ReactNode
  actions?: React.ReactNode
  badge?: React.ReactNode
  badgeText?: string
  badgeVariant?: "emerald" | "amber" | "indigo" | "rose" | "sky"
}

export function PageHeader({ title, subtitle, action, actions, badge, badgeText, badgeVariant }: PageHeaderProps) {
  const renderedAction = action || actions
  const renderedBadge = badge || (badgeText ? (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border font-mono ${
      badgeVariant === "emerald" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
      badgeVariant === "amber" ? "bg-amber-50 text-amber-700 border-amber-200" :
      badgeVariant === "rose" ? "bg-rose-50 text-rose-700 border-rose-200" :
      badgeVariant === "sky" ? "bg-sky-50 text-sky-700 border-sky-200" :
      "bg-indigo-50 text-indigo-700 border-indigo-200"
    }`}>
      {badgeText}
    </span>
  ) : null)

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 border-b border-border/60 pb-6">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
            {title}
          </h1>
          {renderedBadge}
        </div>
        <p className="text-sm font-medium text-muted-foreground max-w-3xl">
          {subtitle}
        </p>
      </div>
      {renderedAction && <div className="flex items-center gap-3 shrink-0">{renderedAction}</div>}
    </div>
  )
}
