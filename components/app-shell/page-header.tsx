import * as React from "react"

export interface PageHeaderProps {
  title: string
  subtitle: string
  action?: React.ReactNode
  badge?: React.ReactNode
}

export function PageHeader({ title, subtitle, action, badge }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 border-b border-border/60 pb-6">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
            {title}
          </h1>
          {badge}
        </div>
        <p className="text-sm font-medium text-muted-foreground max-w-3xl">
          {subtitle}
        </p>
      </div>
      {action && <div className="flex items-center gap-3 shrink-0">{action}</div>}
    </div>
  )
}
