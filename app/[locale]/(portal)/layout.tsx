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
export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const realClient = await getCurrentPortalClient()
  const membre = await getCurrentMember()
  const isPreview = !realClient

  // En aperçu, l'en-tête porte le VRAI cabinet du membre connecté. Il
  // affichait « Cabinet Immigration Boréale Inc. » et les initiales « MT »
  // d'une cliente inventée — un consultant venu vérifier l'allure de son
  // portail y voyait la marque de quelqu'un d'autre.
  const nomCabinet = realClient?.firmName ?? membre?.firmName ?? ""
  const nomAffiche = realClient?.name ?? membre?.fullName ?? ""

  const t = await getTranslations("Auth")

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      {isPreview && (
        <div className="bg-amber-950 text-amber-100 text-xs py-3 px-4 sm:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-800 shadow-md sticky top-0 z-50">
          <div className="flex items-center gap-3">
            <span className="bg-amber-600 text-white px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider shrink-0 shadow-xs">
              👁 MODE APERÇU — Lecture seule
            </span>
            <span className="font-medium text-amber-200 text-xs">
              Vous visualisez le portail en tant que consultant. <strong>Les actions réservées au client sont désactivées.</strong>
            </span>
          </div>
          {membre && (
            <Link
              href="/clients"
              className="bg-white text-amber-950 hover:bg-amber-50 font-bold px-3.5 py-1.5 rounded-xl text-xs transition-colors shadow-xs shrink-0 self-start sm:self-auto"
            >
              ← Quitter l&apos;aperçu
            </Link>
          )}
        </div>
      )}
      <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 text-xl font-bold tracking-tight text-primary">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            {nomCabinet.trim().charAt(0).toUpperCase() || "P"}
          </div>
          <span className="truncate">{nomCabinet}</span>
        </div>

        <div className="flex items-center gap-3">
          <LocaleSwitcher />
          <Bell aria-hidden className="h-5 w-5 text-muted-foreground" />

          <div
            title={`${t("signedInAs")} ${realClient?.email ?? membre?.email ?? ""}`}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground"
          >
            {initiales(nomAffiche)}
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
