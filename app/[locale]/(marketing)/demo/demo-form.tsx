"use client"

import * as React from "react"
import { useTranslations, useLocale } from "next-intl"
import { AlertTriangle, CheckCircle2, CalendarClock } from "lucide-react"
import { Link } from "@/i18n/routing"
import { Button } from "@/components/ui/button"
import { enregistrerDemandeDemo } from "@/lib/data/demo-request"

const FIELD =
  "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"

export function DemoForm() {
  const t = useTranslations("Demo")
  // La langue voyage avec la demande : la réponse et le lien d'accès
  // doivent repartir dans celle où le formulaire a été rempli.
  const langue = useLocale()

  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [sent, setSent] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setPending(true)
    setError(null)
    const data = Object.fromEntries(new FormData(e.currentTarget))
    try {
      const r = await enregistrerDemandeDemo({ ...data, langue })
      if (!r.ok) {
        setError(r.erreur ?? t("genericError"))
        return
      }
      setSent(true)
    } catch {
      setError(t("genericError"))
    } finally {
      setPending(false)
    }
  }

  if (sent) {
    return (
      <p
        role="status"
        className="flex items-start gap-2.5 rounded-2xl border border-success/30 bg-success/10 px-4 py-4 text-sm font-medium leading-relaxed text-foreground"
      >
        <CheckCircle2 aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-success" />
        {t("sent")}
      </p>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-error/30 bg-error/10 px-3 py-2.5 text-xs font-bold text-error"
        >
          <AlertTriangle aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}

      <div>
        <label htmlFor="nom" className="mb-1.5 block text-xs font-bold text-foreground">
          {t("nameLabel")}
        </label>
        <input id="nom" name="nom" type="text" required maxLength={120} autoComplete="name" className={FIELD} />
      </div>

      <div>
        <label htmlFor="courriel" className="mb-1.5 block text-xs font-bold text-foreground">
          {t("emailLabel")}
        </label>
        <input
          id="courriel"
          name="courriel"
          type="email"
          required
          maxLength={180}
          autoComplete="email"
          className={FIELD}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="cabinet" className="mb-1.5 block text-xs font-bold text-foreground">
            {t("firmLabel")}
          </label>
          <input
            id="cabinet"
            name="cabinet"
            type="text"
            maxLength={160}
            autoComplete="organization"
            className={FIELD}
          />
        </div>
        <div>
          <label htmlFor="telephone" className="mb-1.5 block text-xs font-bold text-foreground">
            {t("phoneLabel")}
          </label>
          <input
            id="telephone"
            name="telephone"
            type="tel"
            maxLength={40}
            autoComplete="tel"
            className={FIELD}
          />
        </div>
      </div>

      <div>
        <label htmlFor="message" className="mb-1.5 block text-xs font-bold text-foreground">
          {t("messageLabel")}
        </label>
        <textarea
          id="message"
          name="message"
          rows={4}
          maxLength={2000}
          placeholder={t("messagePlaceholder")}
          className={FIELD}
        />
      </div>

      {/* Champ leurre. Retiré du parcours clavier et des lecteurs d'écran :
          il ne doit exister que pour les robots qui remplissent tout. */}
      <div aria-hidden className="hidden">
        <label htmlFor="site">Site</label>
        <input id="site" name="site" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <Button type="submit" disabled={pending} className="mt-1 w-full gap-2">
        <CalendarClock aria-hidden className="h-4 w-4" />
        {pending ? t("sending") : t("submit")}
      </Button>

      <p className="mt-2 border-t border-border pt-4 text-[11px] leading-relaxed text-muted-foreground">
        {t.rich("privacyNote", {
          lien: (chunks) => (
            <Link href="/confidentialite" className="font-semibold text-primary hover:underline">
              {chunks}
            </Link>
          ),
        })}
      </p>
    </form>
  )
}
