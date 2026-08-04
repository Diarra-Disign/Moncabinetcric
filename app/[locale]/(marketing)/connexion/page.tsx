import type { Metadata } from "next"
import { Suspense } from "react"
import { getTranslations } from "next-intl/server"
import { SignInForm } from "./sign-in-form"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth")
  return {
    title: t("title"),
    description: t("subtitle"),
    // Une page de connexion n'a rien à faire dans un index de recherche.
    robots: { index: false, follow: false },
  }
}

/**
 * Le formulaire lit `?suivant=` avec useSearchParams, qui ne peut pas être
 * résolu au prérendu : sans cette limite Suspense, la compilation de
 * production échouait sur cette page — celle par laquelle tout le monde
 * entre. Le repli reste neutre, sans champ ni bouton, pour qu'aucune
 * saisie ne parte avant que le formulaire réel soit monté.
 */
export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="text-sm text-muted-foreground">Chargement…</p>
        </div>
      }
    >
      <SignInForm />
    </Suspense>
  )
}
