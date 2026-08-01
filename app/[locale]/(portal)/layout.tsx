import { LocaleSwitcher } from "@/components/app-shell/locale-switcher"
import { Bell } from "lucide-react"

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="h-full bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 text-primary font-bold text-xl tracking-tight">
          <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
            P
          </div>
          Portail Client
        </div>
        <div className="flex items-center gap-4">
          <LocaleSwitcher />
          <Bell className="h-5 w-5 text-muted-foreground" />
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground">
            CL
          </div>
        </div>
      </header>
      <main className="flex-1 py-10">
        <div className="px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}
