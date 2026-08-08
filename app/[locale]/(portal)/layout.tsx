import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Bell, LogOut } from "lucide-react"
import { Link } from "@/i18n/routing"
import { LocaleSwitcher } from "@/components/app-shell/locale-switcher"
import { getCurrentPortalClient, getCurrentMember } from "@/lib/supabase/session"

/** Initiales du client, pour la pastille d'en-tête. */
function initiales(nom: string): string {
  const parts = nom.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/**
 * Enveloppe du portail client.
 *
 * Ce portail était accessible sans aucune authentification : n'importe
 * quel visiteur atteignait /fr et voyait un dossier d'immigration, son
 * état d'avancement et un téléverseur de pièces. La base était pourtant
 * prête — table client_users, fonction current_client_id() et politiques
 * limitant chaque client à sa seule fiche — mais l'application ne s'en
 * servait pas.
 */
const DEMO_PORTAL_CLIENT = {
  userId: "client-demo-user",
  clientId: "c-001",
  firmId: "firm-demo",
  email: "client.demo@moncabinetcric.ca",
  name: "Mme Marie Tremblay",
  fileNumber: "CRIC-2026-0101",
  program: "Résidence Permanente (PEQ / Entrée Express)",
  firmName: "Cabinet Immigration Boréale Inc."
}

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const realClient = await getCurrentPortalClient()
  const membre = await getCurrentMember()
  const isPreview = !realClient
  const client = realClient || DEMO_PORTAL_CLIENT

  const t = await getTranslations("Auth")

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      {isPreview && (
        <div className="bg-indigo-950 text-white text-xs py-2 px-4 sm:px-8 flex items-center justify-between border-b border-indigo-800 shadow-sm z-40">
          <div className="flex items-center gap-2">
            <span className="bg-indigo-700 text-white px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider">Mode Aperçu</span>
            <span className="font-medium text-slate-200">Vous visualisez l&apos;interface du Portail Client telle qu&apos;elle apparaît pour vos candidats à l&apos;immigration.</span>
          </div>
          {membre && (
            <Link href="/dashboard" className="bg-white text-indigo-950 hover:bg-slate-100 font-bold px-3 py-1 rounded-xl text-[11px] transition-colors shadow-xs">
              ← Retour au Tableau de bord
            </Link>
          )}
        </div>
      )}
      <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 text-xl font-bold tracking-tight text-primary">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            {client.firmName.trim().charAt(0).toUpperCase() || "P"}
          </div>
          <span className="truncate">{client.firmName}</span>
        </div>

        <div className="flex items-center gap-3">
          <LocaleSwitcher />
          <Bell aria-hidden className="h-5 w-5 text-muted-foreground" />

          <div
            title={`${t("signedInAs")} ${client.email}`}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground"
          >
            {initiales(client.name)}
          </div>

          <form action="/api/auth/sign-out" method="post">
            <button
              type="submit"
              aria-label={t("signOut")}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-error/10 hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error"
            >
              <LogOut aria-hidden className="h-4 w-4" />
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1 py-10">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  )
}
