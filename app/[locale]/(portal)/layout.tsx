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
        <div className="bg-slate-900 text-slate-200 text-xs py-2.5 px-4 sm:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 shadow-xs sticky top-0 z-50">
          <div className="flex items-center gap-3">
            <span className="bg-slate-800 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider shrink-0 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              Aperçu Consultant
            </span>
            <span className="text-slate-300 text-xs">
              Simulation du portail en <strong>lecture seule</strong> — Aucune modification réelle côté client.
            </span>
          </div>
          {membre && (
            <Link
              href="/clients"
              className="bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 font-semibold px-3.5 py-1.5 rounded-lg text-xs transition-colors shadow-xs shrink-0 self-start sm:self-auto inline-flex items-center gap-1.5"
            >
              ← Retour au cabinet
            </Link>
          )}
        </div>
      )}
      <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-4 sm:px-6 lg:px-8 shadow-2xs">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground font-black text-sm shadow-xs">
            {nomCabinet.trim().charAt(0).toUpperCase() || "M"}
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold tracking-tight text-foreground truncate">
              {nomCabinet || "Cabinet Immigration"}
            </h1>
            <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
              <span>Portail Client Sécurisé</span>
              <span className="inline-block h-1 w-1 rounded-full bg-muted-foreground/40" />
              <span className="text-primary font-semibold">Conforme CICC</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <LocaleSwitcher />
          <div
            title={`${t("signedInAs")} ${realClient?.email ?? membre?.email ?? ""}`}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-bold text-foreground border border-border"
          >
            {initiales(nomAffiche)}
          </div>

          <form action="/api/auth/sign-out" method="post">
            <button
              type="submit"
              aria-label={t("signOut")}
              title={t("signOut")}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-error/10 hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error cursor-pointer"
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
