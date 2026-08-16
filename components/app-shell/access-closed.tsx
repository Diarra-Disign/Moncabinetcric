import { AlertTriangle, LogOut, Lock } from "lucide-react"
import type { FirmIdentity } from "@/lib/data/firm"
import type { RaisonAccesFerme } from "@/lib/billing/plans"
import { DemandeAide } from "./demande-aide"

export interface AccessClosedProps {
  firm: FirmIdentity
  /**
   * Pourquoi l'accès est fermé, calculé côté serveur par `raisonAccesFerme()`.
   *
   * Cet écran n'en jugeait pas : il départageait sur `plan === 'trial'` et
   * servait, pour tout le reste, le texte des SUSPENSIONS. Un consultant dont
   * l'abonnement venait de prendre fin lisait donc qu'on lui avait fermé la
   * porte, et qu'il fallait écrire à l'exploitant — alors que le formulaire de
   * réabonnement était juste en dessous.
   */
  raison: RaisonAccesFerme
  /** Titre et corps déjà choisis pour cette raison, dans la langue de la page. */
  title: string
  body: string
  signOutLabel: string
  planLabel: string
  statusLabel: string
  /** Langue de la page : la réponse doit repartir dans celle-ci. */
  langue: string
  /** Libellés du formulaire de demande d'aide. */
  helpLabels: Record<string, string>
  /**
   * Moyen de rouvrir l'accès soi-même — l'écran d'abonnement, pour le
   * propriétaire. Sans lui, un cabinet dont l'essai vient d'échoir n'a
   * strictement aucun chemin vers le paiement : toutes les pages sont
   * derrière ce mur, y compris celle qui permettrait de payer. Il faudrait
   * écrire un courriel et attendre, pour un geste de trente secondes.
   */
  children?: React.ReactNode
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
  raison,
  title,
  body,
  signOutLabel,
  planLabel,
  statusLabel,
  langue,
  helpLabels,
  children,
}: AccessClosedProps) {
  // Une suspension est une DÉCISION ; les trois autres raisons sont des états
  // de compte, qui se règlent sans écrire à personne. La couleur suit cette
  // frontière plutôt que la gravité : le rouge sur un abonnement échu ferait
  // craindre une perte de données, alors que rien n'est perdu.
  const decision = raison === "suspendu"

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-5 py-16">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-8 shadow-sm">
        <div
          className={
            decision
              ? "mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-error/15 text-error"
              : "mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-warning/15 text-warning"
          }
        >
          {decision ? (
            <Lock aria-hidden className="h-5 w-5" />
          ) : (
            <AlertTriangle aria-hidden className="h-5 w-5" />
          )}
        </div>

        <h1 className="text-xl font-black tracking-tight text-foreground">{title}</h1>

        {firm.name && (
          <p className="mt-1 text-sm font-bold text-muted-foreground">{firm.name}</p>
        )}

        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{body}</p>

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

        {/* Le lien `mailto:` qui occupait cette place ne faisait rien chez qui
            lit son courrier dans un onglet, et visait une adresse dont le
            domaine n'avait aucun serveur de courrier entrant. Voir
            `demande-aide.tsx`. */}
        <div className="mt-7 border-t border-border pt-6">
          <DemandeAide langue={langue} labels={helpLabels} />
        </div>

        <form action="/api/auth/sign-out" method="post" className="mt-5">
          <button
            type="submit"
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-4 py-2 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <LogOut aria-hidden className="h-3.5 w-3.5" />
            {signOutLabel}
          </button>
        </form>
      </div>

      {children && <div className="w-full max-w-3xl">{children}</div>}
    </main>
  )
}
