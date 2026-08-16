"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import { ShieldCheck, Mail, KeyRound, AlertTriangle, CheckCircle2 } from "lucide-react"
import { getBrowserSupabase } from "@/lib/supabase/browser"
import { leverChangementObligatoire } from "@/lib/data/portal-access"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  LONGUEUR_MINIMALE,
  exigencesManquantes,
  type Exigence,
} from "@/lib/securite/regle-mot-de-passe"

type Method = "password" | "magic"

/** Clé de traduction d'une exigence, pour l'énumérer en toutes lettres. */
const LIBELLE: Record<Exigence, string> = {
  longueur: "ruleLongueur",
  minuscule: "ruleMinuscule",
  majuscule: "ruleMajuscule",
  chiffre: "ruleChiffre",
  symbole: "ruleSymbole",
}

const FIELD =
  "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"

export function SignInForm() {
  const t = useTranslations("Auth")
  const locale = useLocale()
  const searchParams = useSearchParams()

  /** « 12 caractères, une majuscule et un symbole », dans la langue de la page. */
  const enumereExigences = (manque: Exigence[]) =>
    new Intl.ListFormat(locale === "en" ? "en-CA" : "fr-CA", {
      style: "long",
      type: "conjunction",
    }).format(
      manque.map((m) =>
        m === "longueur" ? t(LIBELLE[m], { n: LONGUEUR_MINIMALE }) : t(LIBELLE[m])
      )
    )

  const [method, setMethod] = React.useState<Method>("password")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [magicSent, setMagicSent] = React.useState(false)

  // Mandatory password change state for 1st login via temporary password
  // Le défi du second facteur : posé quand la connexion par mot de passe a
  // réussi mais que le compte exige un niveau aal2.
  const [mfaFacteurId, setMfaFacteurId] = React.useState<string | null>(null)
  const [mfaDefiId, setMfaDefiId] = React.useState<string | null>(null)
  const [mfaCode, setMfaCode] = React.useState("")

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
        // Un seul message pour toutes les causes de refus, à dessein :
        // distinguer « mot de passe faux » de « compte inconnu » renseignerait
        // qui cherche à savoir quelles adresses existent.
        //
        // Une lecture du jeton « verrou:N » a figuré ici, le temps d'un
        // crochet `hook_password_verification_attempt` que Supabase refuse de
        // brancher sur ce forfait (HTTP 402). Retirée avec lui : un code qui
        // guette un message que plus rien n'émet se lit comme une protection
        // active alors qu'il n'en est aucune.
        setError(t("invalidCredentials"))
        return
      }

      if (data.user?.app_metadata?.must_change_password) {
        setRequirePasswordChange(true)
        return
      }

      // LE SECOND FACTEUR, S'IL EST ENRÔLÉ.
      //
      // `signInWithPassword` réussit même quand un facteur existe : la session
      // obtenue est simplement de niveau aal1. C'est `nextLevel` qui dit si le
      // compte en exige un second. Sans ce passage, un facteur enrôlé serait
      // décoratif — la personne se croirait protégée et ne le serait pas.
      //
      // La session aal1 n'est PAS refermée en cas d'abandon : le garde des
      // écrans privés refuse aal1 dès qu'un facteur est enrôlé, donc une
      // session laissée en plan n'ouvre rien.
      const { data: niveau } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (niveau?.nextLevel === "aal2" && niveau.currentLevel !== "aal2") {
        const { data: liste } = await supabase.auth.mfa.listFactors()
        const facteur = liste?.totp?.[0]
        if (facteur) {
          const { data: defi } = await supabase.auth.mfa.challenge({ factorId: facteur.id })
          setMfaFacteurId(facteur.id)
          setMfaDefiId(defi?.id ?? null)
          return
        }
      }

      await goNext()
    } catch {
      setError(t("genericError"))
    } finally {
      setPending(false)
    }
  }

  /**
   * Le garde des écrans privés nous a renvoyés ici : la session existe, mais
   * elle est restée au niveau aal1. Il faut reprendre le défi là où il a été
   * abandonné — sans redemander le mot de passe, qui a déjà été accepté.
   *
   * Sans ce rattrapage, l'écran afficherait un formulaire de connexion à
   * quelqu'un de déjà connecté, et `proxy.ts` le renverrait aussitôt au
   * tableau de bord, d'où le garde le renverrait ici. Une boucle sans issue.
   */
  React.useEffect(() => {
    if (searchParams.get("probleme") !== "facteur") return
    let annule = false
    void (async () => {
      const supabase = getBrowserSupabase()
      const { data: niveau } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (annule || niveau?.nextLevel !== "aal2" || niveau.currentLevel === "aal2") return
      const { data: liste } = await supabase.auth.mfa.listFactors()
      const facteur = liste?.totp?.[0]
      if (!facteur || annule) return
      const { data: defi } = await supabase.auth.mfa.challenge({ factorId: facteur.id })
      if (annule) return
      setMfaFacteurId(facteur.id)
      setMfaDefiId(defi?.id ?? null)
    })()
    return () => { annule = true }
  }, [searchParams])

  /** Vérifie le code à six chiffres et élève la session au niveau aal2. */
  const handleMfa = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!mfaFacteurId || !mfaDefiId) return
    setError(null)
    setPending(true)
    try {
      const supabase = getBrowserSupabase()
      const { error: eVerif } = await supabase.auth.mfa.verify({
        factorId: mfaFacteurId,
        challengeId: mfaDefiId,
        code: mfaCode.trim(),
      })
      if (eVerif) {
        // UN NOUVEAU DÉFI À CHAQUE ÉCHEC : un défi est à usage unique, et
        // réutiliser celui qui vient d'échouer ferait échouer aussi le code
        // suivant, même juste. La personne conclurait que son application est
        // déréglée alors que c'est l'écran qui l'est.
        const { data: defi } = await supabase.auth.mfa.challenge({ factorId: mfaFacteurId })
        setMfaDefiId(defi?.id ?? null)
        setMfaCode("")
        setError("Ce code n'est pas valide. Vérifiez l'heure de votre téléphone, puis réessayez.")
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

    // LA RÈGLE VIENT D'UN SEUL ENDROIT, ET CE N'EST PLUS ICI.
    //
    // Ce contrôle annonçait 8, puis 12. À chaque fois, la console Supabase
    // disait autre chose et l'utilisateur découvrait l'écart en anglais sur
    // une interface française. La console exige désormais douze caractères ET
    // quatre familles — une longueur seule ne suffit plus à décider.
    //
    // `regle-mot-de-passe` porte cette règle pour les trois écrans qui la
    // vérifient. Ce contrôle-ci ne protège toujours rien — il est dans le
    // navigateur, donc contournable — et sa seule raison d'être reste de dire
    // la vérité AVANT l'envoi.
    const manque = exigencesManquantes(newPassword)
    if (manque.length > 0) {
      setError(t("passwordMissing", { liste: enumereExigences(manque) }))
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
                    minLength={LONGUEUR_MINIMALE}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    aria-describedby="nouveau-mdp-aide"
                    className={FIELD}
                  />
                  {/* La règle s'affiche sous le champ et suit la frappe, au
                      lieu de tenir dans un texte de substitution qui disparaît
                      dès la première lettre saisie. */}
                  <p
                    id="nouveau-mdp-aide"
                    aria-live="polite"
                    className={cn(
                      "mt-1 text-[11px]",
                      newPassword.length > 0 && exigencesManquantes(newPassword).length === 0
                        ? "text-success"
                        : "text-muted-foreground"
                    )}
                  >
                    {newPassword.length === 0
                      ? t("passwordHint")
                      : exigencesManquantes(newPassword).length > 0
                        ? t("passwordMissing", {
                            liste: enumereExigences(exigencesManquantes(newPassword)),
                          })
                        : t("passwordReady")}
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1 text-foreground">Confirmer le Nouveau Mot de Passe</label>
                  <input
                    type="password"
                    required
                    // Ce champ exigeait 8 alors que le premier en exige 12 :
                    // un reste de l'ancienne règle, resté en place quand elle
                    // a changé. C'est exactement le genre d'écart que
                    // `regle-mot-de-passe` existe pour supprimer.
                    minLength={LONGUEUR_MINIMALE}
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

        {/* LE DÉFI PASSE AVANT TOUT LE RESTE. Une fois le mot de passe accepté,
            il n'y a plus rien d'autre à montrer : ni les onglets, ni le lien
            magique. Laisser le formulaire de connexion visible inviterait à
            recommencer, ce qui créerait un second défi et perdrait le premier. */}
        {mfaFacteurId ? (
          <form onSubmit={handleMfa} className="flex flex-col gap-4">
            <div>
              <label htmlFor="mfa" className="mb-1.5 block text-xs font-bold text-foreground">
                Code de vérification
              </label>
              <p className="mb-2 text-xs text-muted-foreground">
                Saisissez le code à six chiffres affiché par votre application d&apos;authentification.
              </p>
              <input
                id="mfa"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                required
                placeholder="000000"
                className={cn(FIELD, "font-mono tracking-[0.4em]")}
              />
            </div>
            <Button type="submit" disabled={pending || mfaCode.length !== 6} className="w-full">
              {pending ? t("signingIn") : "Vérifier"}
            </Button>
          </form>
        ) : !requirePasswordChange && (magicSent ? (
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
