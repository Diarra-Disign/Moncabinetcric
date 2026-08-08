"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import { ShieldCheck, Mail, KeyRound, AlertTriangle, CheckCircle2 } from "lucide-react"
import { getBrowserSupabase } from "@/lib/supabase/browser"
import { leverChangementObligatoire } from "@/lib/data/portal-access"
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

  // Mandatory password change state for 1st login via temporary password
  const [requirePasswordChange, setRequirePasswordChange] = React.useState(false)
  const [newPassword, setNewPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [passwordChangedNotice, setPasswordChangedNotice] = React.useState(false)

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

  /**
   * Destination après connexion.
   *
   * Un administrateur de plateforme n'est membre d'aucun cabinet. Envoyé
   * au tableau de bord — ce que faisait le repli — il déclenchait le
   * chargement de dossiers auxquels il n'a pas droit : la mise en page le
   * redirigeait bien vers la console, mais la page s'exécutait en
   * parallèle et levait avant d'y parvenir. Une erreur à chaque connexion
   * de l'exploitant, pour un détour dont on connaissait l'issue.
   *
   * La lecture s'appuie sur la RLS : un compte ordinaire ne voit aucune
   * ligne dans platform_admins, la requête lui coûte un aller-retour et
   * ne lui apprend rien.
   */
  const goNext = async () => {
    let destination = nextPath ?? "/fr/dashboard"
    if (!nextPath) {
      try {
        const { data } = await getBrowserSupabase()
          .from("platform_admins")
          .select("user_id")
          .maybeSingle()
        if (data) destination = "/fr/admin"
      } catch {
        // Sans réponse, le tableau de bord reste le repli : la mise en page
        // redirigera, au prix du détour qu'on cherchait à éviter.
      }
    }
    // Rechargement complet et non router.push : le middleware doit relire
    // les cookies de session fraîchement posés.
    window.location.assign(destination)
  }

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPending(true)
    setError(null)
    try {
      // L'authentification a lieu D'ABORD, sans exception.
      //
      // Le code précédent devinait le caractère temporaire du mot de passe à
      // sa forme — il suffisait qu'il contienne « Temp » — et présentait
      // l'écran de changement SANS avoir authentifié qui que ce soit. Deux
      // conséquences : n'importe qui tapant « Temp » y accédait, et un usager
      // dont le vrai mot de passe contenait ces quatre lettres ne pouvait
      // plus se connecter du tout.
      //
      // L'obligation de changer est désormais un fait, pas une devinette :
      // elle est portée par app_metadata.must_change_password, posée par le
      // serveur au moment où le cabinet ouvre l'accès, et hors de portée du
      // compte lui-même.
      const supabase = getBrowserSupabase()
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (authError) {
        setError(t("invalidCredentials"))
        return
      }

      if (data.user?.app_metadata?.must_change_password) {
        setRequirePasswordChange(true)
        return
      }

      await goNext()
    } catch {
      setError(t("genericError"))
    } finally {
      setPending(false)
    }
  }

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (newPassword.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.")
      return
    }
    if (newPassword !== confirmPassword) {
      setError("Les deux mots de passe ne correspondent pas.")
      return
    }

    setPending(true)
    try {
      // La session existe : on vient de s'authentifier avec le mot de passe
      // temporaire. updateUser() a donc de quoi travailler — ce qui n'était
      // pas le cas auparavant, où l'on arrivait ici sans jamais s'être
      // connecté et où l'échec était rattrapé par un « catch » qui redirigeait
      // quand même, en annonçant un succès.
      const supabase = getBrowserSupabase()
      const { error: erreurMaj } = await supabase.auth.updateUser({ password: newPassword })
      if (erreurMaj) {
        setError(erreurMaj.message)
        return
      }

      // Le drapeau ne se lève qu'une fois le nouveau mot de passe accepté.
      // Il vit dans app_metadata : seule la clé de service peut l'effacer,
      // donc seule une action de serveur.
      const r = await leverChangementObligatoire()
      if (!r.ok) {
        setError(r.message)
        return
      }

      setPasswordChangedNotice(true)
      setTimeout(() => {
        window.location.assign(nextPath ?? "/fr/portal")
      }, 1500)
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

        {requirePasswordChange ? (
          <div className="space-y-4">
            <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-3.5 text-xs text-amber-800 flex items-start gap-2.5">
              <KeyRound className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">1ère Connexion — Mot de passe temporaire</strong>
                <span>Veuillez définir votre mot de passe personnel définitif pour accéder à votre espace candidat.</span>
              </div>
            </div>

            {error && (
              <p role="alert" className="flex items-start gap-2 rounded-xl border border-error/30 bg-error/10 px-3 py-2.5 text-xs font-bold text-error">
                <AlertTriangle aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" />
                {error}
              </p>
            )}

            {passwordChangedNotice ? (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>Mot de passe enregistré avec succès ! Redirection vers votre Portail Client en cours...</span>
              </div>
            ) : (
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold mb-1 text-foreground">Identifiant Courriel</label>
                  <input type="text" readOnly value={email} className={`${FIELD} bg-muted opacity-75 font-mono cursor-not-allowed`} />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1 text-foreground">Votre Nouveau Mot de Passe Personnels</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 8 caractères"
                    className={FIELD}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1 text-foreground">Confirmer le Nouveau Mot de Passe</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Répétez votre mot de passe"
                    className={FIELD}
                  />
                </div>

                <Button type="submit" disabled={pending || !newPassword || !confirmPassword} className="w-full font-bold">
                  {pending ? "Enregistrement en cours..." : "Enregistrer et Accéder à mon Portail"}
                </Button>
              </form>
            )}
          </div>
        ) : error && (
          <p
            role="alert"
            className="mb-4 flex items-start gap-2 rounded-xl border border-error/30 bg-error/10 px-3 py-2.5 text-xs font-bold text-error"
          >
            <AlertTriangle aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
        )}

        {!requirePasswordChange && (magicSent ? (
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
        ))}

        <p className="mt-6 border-t border-border pt-4 text-[11px] leading-relaxed text-muted-foreground">
          {t("securityNote")}
        </p>
      </div>
    </div>
  )
}
