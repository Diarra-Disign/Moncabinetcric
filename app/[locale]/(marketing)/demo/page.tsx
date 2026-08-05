import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { ShieldCheck, ChevronLeft } from "lucide-react"
import { Link } from "@/i18n/routing"
import { DemoForm } from "./demo-form"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Demo")
  return { title: t("title"), description: t("subtitle") }
}

/**
 * Demande de démonstration.
 *
 * Les boutons « Réserver une démo », « Demander une démonstration » et
 * « Parler à la direction » de la page d'accueil descendaient vers la
 * section des tarifs ou ne faisaient rien du tout. Ils aboutissent ici.
 *
 * La page dit aussi ce que la plateforme ne fait pas : il n'existe pas
 * d'inscription libre, un accès s'ouvre cabinet par cabinet. Le visiteur
 * l'apprend avant de remplir, et non après avoir cherché un bouton
 * d'inscription qui n'existe pas.
 */
export default async function DemoPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations("Demo")

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col justify-center px-5 py-12 sm:py-16">
      {/* La mise en page marketing n'a pas d'en-tête : sans ce lien, la
          page serait un cul-de-sac pour qui change d'avis. */}
      <Link
        href="/landing"
        className="mb-5 inline-flex w-fit items-center gap-1 rounded-lg py-2 pr-2 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <ChevronLeft aria-hidden className="h-3.5 w-3.5" />
        {t("back")}
      </Link>

      <div className="rounded-3xl border border-border bg-card p-7 shadow-sm sm:p-9">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck aria-hidden className="h-5 w-5" />
          </span>
          <h1 className="text-xl font-black tracking-tight text-foreground sm:text-2xl">
            {t("title")}
          </h1>
        </div>

        <p className="mb-4 text-sm leading-relaxed text-muted-foreground">{t("subtitle")}</p>

        <p className="mb-7 rounded-2xl border border-border bg-muted px-4 py-3 text-xs leading-relaxed text-foreground">
          {t("accessNote")}
        </p>

        <DemoForm />
      </div>
    </div>
  )
}
