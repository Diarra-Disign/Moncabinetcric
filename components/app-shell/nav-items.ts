import { LayoutDashboard, Users, FolderOpen, Calendar, FileText, Settings, Building2, Files, FileSignature, AlertTriangle } from "lucide-react"
import type { LucideIcon } from "lucide-react"

export interface NavItem {
  labelKey: string
  href: string
  icon: LucideIcon
}

export const MAIN_NAV: NavItem[] = [
  { labelKey: "dashboard", href: "/dashboard", icon: LayoutDashboard },
  { labelKey: "deadlines", href: "/deadlines", icon: AlertTriangle },
  { labelKey: "calendar", href: "/calendar", icon: Calendar },
  { labelKey: "clients", href: "/clients", icon: Users },
  { labelKey: "matters", href: "/matters", icon: FolderOpen },
  { labelKey: "agreements", href: "/agreements", icon: FileSignature },
  { labelKey: "documents", href: "/documents", icon: Files },
  { labelKey: "pipeline", href: "/pipeline", icon: Building2 },
]

export const OTHER_NAV: NavItem[] = [
  { labelKey: "billing", href: "/billing", icon: FileText },
  { labelKey: "settings", href: "/settings", icon: Settings },
]
