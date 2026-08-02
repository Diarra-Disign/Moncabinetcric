import { AlertTriangle, LogOut, Mail } from "lucide-react"
import type { FirmIdentity } from "@/lib/data/firm"

export interface AccessClosedProps {
  firm: FirmIdentity
  title: string
  suspendedBody: string
  expiredBody: string
  contactLabel: string
  signOutLabel: string
  planLabel: string
  statusLabel: string
}

/**
 * Écran affiché lorsqu'un cabinet n'a plus accès à ses données.
 *
 * Sans lui, un cabinet suspendu voyait l'application entière se vider :
 * toutes les requêtes échouent silencieusement, les listes s'affichent
 * vides, et rien n'explique pourquoi. Un utilisateur en conclut que ses
 * données ont été perdues — inquiétude légitime pour des dossiers
 * d'immigration.
 *
 * La lecture de l'identité du cabinet reste autorisée précisément pour
 * pouvoir afficher cette page.
 */
export function AccessClosed({
  firm,
  title,
  suspendedBody,
  expiredBody,
  contactLabel,
  signOutLabel,
  planLabel,
  statusLabel,
}: AccessClosedProps) {
  const expired = firm.status === "active" && firm.plan === "trial"

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-5 py-16">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-warning/15 text-warning">
          <AlertTriangle aria-hidden className="h-5 w-5" />
        </div>

        <h1 className="text-xl font-black tracking-tight text-foreground">{title}</h1>

        {firm.name && (
          <p className="mt-1 text-sm font-bold text-muted-foreground">{firm.name}</p>
        )}

        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          {expired ? expiredBody : suspendedBody}
        </p>

        <dl className="mt-6 grid grid-cols-2 gap-3 border-t border-border pt-5 text-xs">
          <div>
            <dt className="font-mono uppercase tracking-widest text-muted-foreground">
              {planLabel}
            </dt>
            <dd className="mt-0.5 font-bold text-foreground">{firm.plan || "—"}</dd>
          </div>
          <div>
            <dt className="font-mono uppercase tracking-widest text-muted-foreground">
              {statusLabel}
            </dt>
            <dd className="mt-0.5 font-bold text-foreground">
              {firm.status || "—"}
              {firm.trialEndsAt && <span className="ml-1 font-mono">({firm.trialEndsAt})</span>}
            </dd>
          </div>
        </dl>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <a
            href="mailto:infos@dgvimmigration.com"
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <Mail aria-hidden className="h-3.5 w-3.5" />
            {contactLabel}
          </a>

          <form action="/api/auth/sign-out" method="post">
            <button
              type="submit"
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-4 py-2 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <LogOut aria-hidden className="h-3.5 w-3.5" />
              {signOutLabel}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
