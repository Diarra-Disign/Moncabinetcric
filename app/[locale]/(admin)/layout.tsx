import { redirect } from "next/navigation"
import { getTranslations } from "next-intl/server"
import { ShieldCheck, ArrowLeft } from "lucide-react"
import { Link } from "@/i18n/routing"
import { getCurrentPlatformAdmin, getCurrentMember } from "@/lib/supabase/session"

/**
 * Enveloppe de la console d'exploitation.
 *
 * Délibérément dépourvue de la barre latérale applicative : celle-ci est
 * construite autour d'un cabinet, notion qui n'existe pas ici. Un
 * administrateur qui verrait « Clients » et « Dossiers » dans son menu
 * finirait par cliquer, et se heurterait à des pages vides sans comprendre
 * pourquoi.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Seconde barrière après proxy.ts. Le middleware dépend de son matcher ;
  // ce contrôle-ci ne dépend de rien.
  //
  // Deux refus distincts : un visiteur non connecté va se connecter, un
  // membre de cabinet est renvoyé chez lui. Envoyer ce dernier vers la page
  // de connexion l'aurait fait rebondir vers son tableau de bord, ce qui
  // ressemble à un bogue plutôt qu'à un refus.
  const [admin, member] = await Promise.all([getCurrentPlatformAdmin(), getCurrentMember()])
  if (!admin) redirect(member ? "/fr/dashboard" : "/fr/connexion")

  const t = await getTranslations("Admin")

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground text-background">
              <ShieldCheck aria-hidden className="h-4.5 w-4.5" />
            </span>
            <div>
              <p className="text-sm font-black tracking-tight text-foreground">{t("title")}</p>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {t("badge")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden font-mono text-xs text-muted-foreground sm:inline">
              {admin.email}
            </span>
            <Link
              href="/"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ArrowLeft aria-hidden className="h-3.5 w-3.5" />
              {t("backToApp")}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">{children}</main>
    </div>
  )
}
