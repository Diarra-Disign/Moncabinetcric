import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { Bell, LogOut } from "lucide-react"
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
export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const client = await getCurrentPortalClient()

  if (!client) {
    // Un membre du cabinet qui atterrit ici n'est pas un intrus : il s'est
    // trompé d'espace. On le renvoie vers le sien plutôt que vers un écran
    // de connexion alors qu'il est déjà identifié.
    const membre = await getCurrentMember()
    if (membre) redirect("/fr/dashboard")
    redirect("/fr/connexion?suivant=/fr")
  }

  const t = await getTranslations("Auth")

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
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
