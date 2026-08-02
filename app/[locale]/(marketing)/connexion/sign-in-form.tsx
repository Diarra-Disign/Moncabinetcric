"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import { ShieldCheck, Mail, KeyRound, AlertTriangle, CheckCircle2 } from "lucide-react"
import { getBrowserSupabase } from "@/lib/supabase/browser"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Method = "password" | "magic"

const FIELD =
  "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"

export function SignInForm() {
  const t = useTranslations("Auth")
  const searchParams = useSearchParams()

  const [method, setMethod] = React.useState<Method>("password")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [magicSent, setMagicSent] = React.useState(false)

  /**
   * Destination après connexion, transmise par proxy.ts.
   *
   * Validée avant usage : n'accepter qu'un chemin interne. Reprendre
   * telle quelle une valeur d'URL permettrait de rediriger la victime
   * vers un site externe après une connexion réussie.
   */
  const nextPath = React.useMemo(() => {
    const raw = searchParams.get("suivant")
    if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null
    return raw
  }, [searchParams])

  const goNext = () => {
    // Rechargement complet et non router.push : le middleware doit relire
    // les cookies de session fraîchement posés.
    window.location.assign(nextPath ?? "/fr/dashboard")
  }

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPending(true)
    setError(null)
    try {
      const supabase = getBrowserSupabase()
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (authError) {
        // Message uniforme : distinguer « compte inexistant » de « mot de
        // passe erroné » révélerait quelles adresses sont enregistrées.
        setError(t("invalidCredentials"))
        return
      }
      goNext()
    } catch {
      setError(t("genericError"))
    } finally {
      setPending(false)
    }
  }

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setPending(true)
    setError(null)
    try {
      const supabase = getBrowserSupabase()
      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          // Aucune création de compte : l'accès se donne, il ne se demande pas.
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/api/auth/callback?suivant=${encodeURIComponent(nextPath ?? "/fr/dashboard")}`,
        },
      })
      if (authError) {
        setError(t("genericError"))
        return
      }
      // Message identique qu'un compte existe ou non, pour ne pas permettre
      // d'énumérer les adresses enregistrées.
      setMagicSent(true)
    } catch {
      setError(t("genericError"))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-md flex-col justify-center px-5 py-12">
      <div className="rounded-3xl border border-border bg-card p-7 shadow-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-black tracking-tight text-foreground">{t("title")}</h1>
          </div>
        </div>

        <p className="mb-6 text-xs leading-relaxed text-muted-foreground">{t("subtitle")}</p>

        <div role="tablist" aria-label={t("title")} className="mb-5 flex gap-1 rounded-xl bg-muted p-1">
          {(
            [
              { id: "password" as const, label: t("passwordTab"), icon: KeyRound },
              { id: "magic" as const, label: t("magicLinkTab"), icon: Mail },
            ]
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={method === id}
              onClick={() => {
                setMethod(id)
                setError(null)
                setMagicSent(false)
              }}
              className={cn(
                "flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                method === id
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon aria-hidden className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {error && (
          <p
            role="alert"
            className="mb-4 flex items-start gap-2 rounded-xl border border-error/30 bg-error/10 px-3 py-2.5 text-xs font-bold text-error"
          >
            <AlertTriangle aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
        )}

        {magicSent ? (
          <p
            role="status"
            className="flex items-start gap-2 rounded-xl border border-success/30 bg-success/10 px-3 py-3 text-xs font-medium leading-relaxed text-foreground"
          >
            <CheckCircle2 aria-hidden className="mt-px h-4 w-4 shrink-0 text-success" />
            {t("magicLinkSent")}
          </p>
        ) : (
          <form onSubmit={method === "password" ? handlePassword : handleMagicLink} className="flex flex-col gap-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-xs font-bold text-foreground">
                {t("emailLabel")}
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("emailPlaceholder")}
                className={FIELD}
              />
            </div>

            {method === "password" && (
              <div>
                <label htmlFor="password" className="mb-1.5 block text-xs font-bold text-foreground">
                  {t("passwordLabel")}
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={FIELD}
                />
                <p className="mt-1.5 text-[11px] text-muted-foreground">{t("forgotHint")}</p>
              </div>
            )}

            <Button type="submit" disabled={pending || !email.trim()} className="mt-1 w-full">
              {pending
                ? method === "password"
                  ? t("signingIn")
                  : t("sendingMagicLink")
                : method === "password"
                  ? t("signIn")
                  : t("sendMagicLink")}
            </Button>
          </form>
        )}

        <p className="mt-6 border-t border-border pt-4 text-[11px] leading-relaxed text-muted-foreground">
          {t("securityNote")}
        </p>
      </div>
    </div>
  )
}
