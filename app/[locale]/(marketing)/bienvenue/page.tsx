import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { AlertTriangle } from "lucide-react"
import { createClient } from "@supabase/supabase-js"
import { Link } from "@/i18n/routing"
import { AcceptForm } from "./accept-form"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Invite")
  return { title: t("title"), description: t("subtitle"), robots: { index: false, follow: false } }
}

interface Preview {
  email: string
  firm_name: string
  cicc_role: string
}

/**
 * Aperçu de l'invitation, obtenu avec la clé anonyme.
 *
 * La fonction invitation_preview ne rend que le nom du cabinet, l'adresse
 * invitée et le rôle, et seulement contre un jeton valide. La table
 * elle-même reste fermée : sans cela, n'importe qui pourrait énumérer les
 * adresses invitées.
 */
async function loadPreview(token: string): Promise<Preview | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key || !token) return null

  const supabase = createClient(url, key, { auth: { persistSession: false } })
  const { data } = await supabase.rpc("invitation_preview", { raw_token: token })
  const row = Array.isArray(data) ? data[0] : null
  return row ?? null
}

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ jeton?: string }>
}) {
  const { jeton } = await searchParams
  const t = await getTranslations("Invite")
  const preview = await loadPreview(jeton ?? "")

  if (!preview) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-5 py-16">
        <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-sm">
          <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-warning/15 text-warning">
            <AlertTriangle aria-hidden className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-black tracking-tight text-foreground">{t("invalidTitle")}</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t("invalidBody")}</p>
          <Link
            href="/connexion"
            className="mt-6 inline-flex min-h-10 items-center rounded-xl border border-border px-4 py-2 text-xs font-bold text-foreground transition-colors hover:bg-muted"
          >
            {t("goToSignIn")}
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-16">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-xl font-black tracking-tight text-foreground">{t("title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("invitedTo")}{" "}
          <strong className="font-bold text-foreground">{preview.firm_name}</strong>{" "}
          {t("asRole")}{" "}
          <strong className="font-bold text-foreground">{preview.cicc_role}</strong>.
        </p>

        <AcceptForm token={jeton ?? ""} email={preview.email} />
      </div>
    </main>
  )
}
