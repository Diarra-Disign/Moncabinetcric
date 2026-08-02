import type { Metadata } from "next"
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

export default function SignInPage() {
  return <SignInForm />
}
