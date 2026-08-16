"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import { CheckCircle2, Eye, EyeOff } from "lucide-react"
import { Link } from "@/i18n/routing"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { acceptInvitation, type AcceptResult } from "./accept-invitation"
import {
  LONGUEUR_MINIMALE,
  exigencesManquantes,
  type Exigence,
} from "@/lib/securite/regle-mot-de-passe"

const FIELD =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"

/** Clé de traduction d'une exigence, pour l'énumérer en toutes lettres. */
const LIBELLE: Record<Exigence, string> = {
  longueur: "ruleLongueur",
  minuscule: "ruleMinuscule",
  majuscule: "ruleMajuscule",
  chiffre: "ruleChiffre",
  symbole: "ruleSymbole",
}

export function AcceptForm({ token, email }: { token: string; email: string }) {
  const t = useTranslations("Invite")
  const [fullName, setFullName] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [visible, setVisible] = React.useState(false)
  // « regles » et « nameRequired » n'existent pas côté serveur : ce sont
  // les deux refus que le formulaire prononce lui-même, avant tout appel.
  const [error, setError] = React.useState<
    AcceptResult["error"] | "regles" | "nameRequired" | null
  >(null)
  const [done, setDone] = React.useState(false)
  const [pending, startTransition] = React.useTransition()

  const champNom = React.useRef<HTMLInputElement>(null)
  const champMotDePasse = React.useRef<HTMLInputElement>(null)

  // Recalculé à chaque frappe : c'est ce qui permet à la ligne d'aide de
  // suivre la saisie au lieu d'attendre un clic pour dire ce qui cloche.
  const manquants = exigencesManquantes(password)

  /**
   * « 12 caractères, une majuscule et un symbole » plutôt qu'une liste sèche.
   *
   * Les libellés sont traduits un à un, puis assemblés par Intl.ListFormat :
   * le français relie par « et », l'anglais par « and », et la ponctuation
   * suit la langue sans qu'on ait à l'écrire deux fois.
   */
  const locale = useLocale()
  const enumere = (manque: Exigence[]) =>
    new Intl.ListFormat(locale === "en" ? "en-CA" : "fr-CA", {
      style: "long",
      type: "conjunction",
    }).format(
      manque.map((m) =>
        m === "longueur"
          ? t(LIBELLE[m], { n: LONGUEUR_MINIMALE })
          : t(LIBELLE[m])
      )
    )

  /**
   * Le bouton reste cliquable même quand la saisie est incomplète.
   *
   * Il était auparavant grisé tant que le mot de passe n'atteignait pas
   * douze caractères. Rien n'indiquait pourquoi : la seule mention de la
   * longueur était une ligne d'aide sous le champ, que personne ne relit
   * en cherchant pourquoi un bouton ne répond pas. Un invité s'y est
   * arrêté, croyant la page cassée — au dernier écran du parcours, celui
   * qui ouvre son accès.
   *
   * Cliquer dit maintenant ce qui manque, et il ne s'agit plus seulement de
   * la longueur : le serveur exige aussi quatre familles de caractères.
   * Le contrôle vient de `regle-mot-de-passe`, partagé avec l'action de
   * serveur, pour que l'écran et le serveur ne puissent pas diverger.
   */
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!fullName.trim()) {
      setError("nameRequired")
      champNom.current?.focus()
      return
    }
    if (manquants.length > 0) {
      setError("regles")
      champMotDePasse.current?.focus()
      return
    }

    startTransition(async () => {
      const result = await acceptInvitation(token, fullName, password)
      if (result.ok) setDone(true)
      else setError(result.error ?? "failed")
    })
  }

  if (done) {
    return (
      <div className="mt-6">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-success/15 text-success">
          <CheckCircle2 aria-hidden className="h-5 w-5" />
        </div>
        <h2 className="text-base font-black text-foreground">{t("successTitle")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("successBody")}</p>
        <Link
          href="/connexion"
          className="mt-5 inline-flex min-h-10 items-center rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {t("goToSignIn")}
        </Link>
      </div>
    )
  }

  const messageKey =
    error === "nameRequired"
      ? "errorNameRequired"
      : error === "weak"
        ? "errorWeak"
        : error === "exists"
          ? "errorExists"
          : "errorFailed"

  // noValidate : sans cela le navigateur bloque l'envoi avant notre
  // contrôle, avec un libellé générique et dans SA langue — pas dans celle
  // de la page. Les deux règles sont donc énoncées par le formulaire.
  return (
    <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-4">
      <div>
        <label htmlFor="invite-email" className="mb-1.5 block text-xs font-bold text-foreground">
          {t("emailLabel")}
        </label>
        {/* Champ verrouillé : l'adresse vient de l'invitation. La laisser
            modifiable permettrait de créer un compte sous une autre identité
            avec un jeton légitime. Le serveur ignore de toute façon toute
            valeur envoyée ici. */}
        <input
          id="invite-email"
          type="email"
          value={email}
          readOnly
          aria-describedby="invite-email-hint"
          className={cn(FIELD, "h-11 cursor-not-allowed bg-muted text-muted-foreground")}
        />
        <p id="invite-email-hint" className="mt-1 text-[11px] text-muted-foreground">
          {t("emailLocked")}
        </p>
      </div>

      <div>
        <label htmlFor="invite-name" className="mb-1.5 block text-xs font-bold text-foreground">
          {t("nameLabel")}
        </label>
        <input
          id="invite-name"
          ref={champNom}
          type="text"
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder={t("namePlaceholder")}
          className={cn(FIELD, "h-11")}
        />
      </div>

      <div>
        <label htmlFor="invite-password" className="mb-1.5 block text-xs font-bold text-foreground">
          {t("passwordLabel")}
        </label>
        {/* Un seul champ, avec la possibilité de relire ce qu'on tape.
            La double saisie date d'avant que cela soit possible : elle
            fait retaper à l'aveugle, et une faute recopiée deux fois à
            l'identique passe le contrôle sans être vue. Ici la personne
            vérifie, ce qui est le but qu'on poursuivait. */}
        <div className="relative">
          <input
            id="invite-password"
            ref={champMotDePasse}
            type={visible ? "text" : "password"}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby="invite-password-hint"
            className={cn(FIELD, "h-11 pr-11")}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-pressed={visible}
            aria-label={visible ? t("passwordHide") : t("passwordShow")}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {visible ? <EyeOff aria-hidden className="h-4 w-4" /> : <Eye aria-hidden className="h-4 w-4" />}
          </button>
        </div>
        {/* La liste se met à jour à la frappe : la personne voit ce qu'il
            reste à faire au lieu de le déduire d'un refus après coup.
            Elle énumère ce qui MANQUE, pas ce qui est acquis — c'est plus
            court à lire, et ça devient une confirmation dès que tout y est. */}
        <p
          id="invite-password-hint"
          aria-live="polite"
          className={cn(
            "mt-1 text-[11px]",
            password.length > 0 && manquants.length === 0
              ? "text-success"
              : "text-muted-foreground"
          )}
        >
          {password.length === 0
            ? t("passwordHint")
            : manquants.length > 0
              ? t("passwordMissing", { liste: enumere(manquants) })
              : t("passwordReady")}
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-xs font-bold text-error">
          {error === "regles"
            ? t("passwordMissing", { liste: enumere(manquants) })
            : t(messageKey)}
        </p>
      )}

      <Button type="submit" disabled={pending} className="mt-1">
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  )
}
