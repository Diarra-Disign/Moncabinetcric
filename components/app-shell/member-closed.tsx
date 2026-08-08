import { UserX, LogOut } from "lucide-react"

export interface MemberClosedProps {
  firmName: string
  fullName: string
  /** active | suspended | revoked — voir profiles.status. */
  statut: string
  title: string
  suspendedBody: string
  revokedBody: string
  signOutLabel: string
}

/**
 * Écran affiché à un membre dont l'accès a été fermé par son cabinet.
 *
 * Pendant du composant AccessClosed, qui traite le cas du cabinet entier. La
 * distinction compte : un adjoint suspendu dans un cabinet parfaitement à jour
 * de ses paiements lisait auparavant « accès suspendu », suivi d'un plan et
 * d'un statut qui allaient très bien. Il ne pouvait rien en conclure.
 *
 * Ce que cet écran ne dit PAS, délibérément : le motif consigné par le
 * propriétaire. C'est une note de gestion interne, pas une notification —
 * la décision se transmet de vive voix, elle ne s'apprend pas d'un écran.
 *
 * Aucun bouton de contact non plus : l'interlocuteur est le cabinet, que le
 * membre connaît déjà. Un lien vers l'exploitant de la plateforme l'enverrait
 * frapper à la mauvaise porte.
 */
export function MemberClosed({
  firmName,
  fullName,
  statut,
  title,
  suspendedBody,
  revokedBody,
  signOutLabel,
}: MemberClosedProps) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-5 py-16">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-warning/15 text-warning">
          <UserX aria-hidden className="h-5 w-5" />
        </div>

        <h1 className="text-xl font-black tracking-tight text-foreground">{title}</h1>

        {fullName && <p className="mt-1 text-sm font-bold text-muted-foreground">{fullName}</p>}
        {firmName && <p className="text-sm text-muted-foreground">{firmName}</p>}

        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          {statut === "revoked" ? revokedBody : suspendedBody}
        </p>

        <div className="mt-7">
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
