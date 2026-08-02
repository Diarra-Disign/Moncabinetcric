"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { CheckCircle2 } from "lucide-react"
import { Link } from "@/i18n/routing"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { acceptInvitation, type AcceptResult } from "./accept-invitation"

const FIELD =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"

const MIN_PASSWORD = 12

export function AcceptForm({ token, email }: { token: string; email: string }) {
  const t = useTranslations("Invite")
  const [fullName, setFullName] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [error, setError] = React.useState<AcceptResult["error"] | null>(null)
  const [done, setDone] = React.useState(false)
  const [pending, startTransition] = React.useTransition()

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
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
    error === "weak" ? "errorWeak" : error === "exists" ? "errorExists" : "errorFailed"

  return (
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
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
          type="text"
          required
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
        <input
          id="invite-password"
          type="password"
          required
          minLength={MIN_PASSWORD}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-describedby="invite-password-hint"
          className={cn(FIELD, "h-11")}
        />
        <p id="invite-password-hint" className="mt-1 text-[11px] text-muted-foreground">
          {t("passwordHint")}
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-xs font-bold text-error">
          {t(messageKey)}
        </p>
      )}

      <Button type="submit" disabled={pending || password.length < MIN_PASSWORD} className="mt-1">
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  )
}
