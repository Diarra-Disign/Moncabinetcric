"use client"

import * as React from "react"
import { UserPlus, Check, AlertTriangle, Copy, Clock, PauseCircle, PlayCircle, Ban } from "lucide-react"
import {
  inviterMembre,
  changerRole,
  changerStatutMembre,
  revoquerInvitation,
  type ResultatMembre,
} from "@/lib/data/member-actions"
import { cn } from "@/lib/utils"

export interface MembreVue {
  id: string
  email: string
  fullName: string
  ciccRole: string
  estMoi: boolean
  /** active | suspended | revoked — voir profiles.status. */
  statut: string
}

/**
 * Un membre non actif n'est pas effacé, il est mis de côté.
 *
 * Le bouton « Retirer » supprimait sa ligne de `profiles` — donc le
 * rattachement qui rend intelligibles les journaux d'audit. Trois gestes le
 * remplacent, dont deux sont réversibles.
 */
const ETAT_MEMBRE: Record<string, { libelle: string; classe: string }> = {
  active: { libelle: "actif", classe: "bg-success/10 text-success" },
  suspended: { libelle: "suspendu", classe: "bg-warning/10 text-warning" },
  revoked: { libelle: "révoqué", classe: "bg-error/10 text-error" },
}

export interface InvitationVue {
  id: string
  email: string
  ciccRole: string
  expiresAt: string
  expiree: boolean
}

const ROLES = ["owner", "rcic", "risia", "staff", "bookkeeper", "readonly"] as const

const CHAMP =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"

function Retour({ r }: { r: ResultatMembre | null }) {
  const [copie, setCopie] = React.useState(false)
  if (!r) return null

  const lienComplet =
    r.lien && typeof window !== "undefined" ? `${window.location.origin}${r.lien}` : r.lien

  return (
    <div
      role="status"
      className={cn(
        "mt-3 rounded-lg px-3 py-2 text-xs font-bold",
        r.ok ? "bg-success/10 text-success" : "bg-error/10 text-error"
      )}
    >
      <p className="flex items-start gap-2">
        {r.ok ? (
          <Check aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" />
        ) : (
          <AlertTriangle aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" />
        )}
        {r.message}
      </p>

      {/* Le lien n'est affiché qu'ici, une seule fois : la base ne conserve
          que son empreinte, il est donc irrécupérable ensuite. */}
      {lienComplet && (
        <div className="mt-2 flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded bg-background/60 px-2 py-1 font-mono text-[10px] text-foreground">
            {lienComplet}
          </code>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(lienComplet)
                setCopie(true)
                setTimeout(() => setCopie(false), 2500)
              } catch {
                setCopie(false)
              }
            }}
            className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-bold text-foreground transition-colors hover:bg-muted"
          >
            <Copy aria-hidden className="h-3 w-3" />
            {copie ? "Copié" : "Copier"}
          </button>
        </div>
      )}
    </div>
  )
}

export function TeamPanel({
  membres,
  invitations,
  peutGerer,
}: {
  membres: MembreVue[]
  invitations: InvitationVue[]
  peutGerer: boolean
}) {
  const [resultat, setResultat] = React.useState<ResultatMembre | null>(null)
  const [enCours, demarrer] = React.useTransition()
  const [formOuvert, setFormOuvert] = React.useState(false)

  const executer = (action: (fd: FormData) => Promise<ResultatMembre>) => (fd: FormData) =>
    demarrer(async () => {
      const r = await action(fd)
      setResultat(r)
      if (r.ok && !r.lien) setFormOuvert(false)
    })

  return (
    <section className="rounded-3xl border border-border bg-card p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-black tracking-tight text-foreground">
            Membres du cabinet
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            L&apos;accès se donne : personne ne peut s&apos;inscrire seul.
          </p>
        </div>

        {peutGerer && !formOuvert && (
          <button
            type="button"
            onClick={() => { setFormOuvert(true); setResultat(null) }}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <UserPlus aria-hidden className="h-4 w-4" />
            Inviter un membre
          </button>
        )}
      </div>

      {peutGerer && formOuvert && (
        <form action={executer(inviterMembre)} className="mb-6 rounded-2xl border border-border bg-muted/30 p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-bold text-foreground sm:col-span-2">
              Adresse courriel
              <input
                name="courriel"
                type="email"
                required
                placeholder="collaborateur@cabinet.ca"
                className={cn(CHAMP, "mt-1 h-10 font-normal")}
              />
            </label>
            <label className="text-xs font-bold text-foreground">
              Rôle
              <select name="role" defaultValue="staff" className={cn(CHAMP, "mt-1 h-10 font-normal")}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => { setFormOuvert(false); setResultat(null) }}
              className="min-h-10 rounded-xl px-3 py-2 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={enCours}
              className="min-h-10 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {enCours ? "Création…" : "Créer l'invitation"}
            </button>
          </div>
        </form>
      )}

      <ul className="divide-y divide-border">
        {membres.map((m) => (
          <li
            key={m.id}
            className={cn(
              "flex flex-wrap items-center justify-between gap-3 py-3",
              // Un membre écarté reste visible, mais en retrait : il ne
              // participe plus au cabinet, et l'écran doit le montrer sans
              // qu'on ait à lire le badge.
              m.statut !== "active" && "opacity-60"
            )}
          >
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 truncate text-sm font-bold text-foreground">
                {m.fullName || m.email}
                {m.statut !== "active" && (
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                      ETAT_MEMBRE[m.statut]?.classe ?? "bg-muted text-muted-foreground"
                    )}
                  >
                    {ETAT_MEMBRE[m.statut]?.libelle ?? m.statut}
                  </span>
                )}
                {m.estMoi && (
                  <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    vous
                  </span>
                )}
              </p>
              <p className="truncate font-mono text-xs text-muted-foreground">{m.email}</p>
            </div>

            {peutGerer ? (
              <div className="flex items-center gap-2">
                <form action={executer(changerRole)} className="flex items-center gap-1.5">
                  <input type="hidden" name="profilId" value={m.id} />
                  <select
                    name="role"
                    defaultValue={m.ciccRole}
                    className="min-h-8 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={enCours}
                    className="min-h-8 rounded-lg border border-border px-2 py-1 text-[11px] font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                  >
                    Appliquer
                  </button>
                </form>

                {!m.estMoi && (
                  <div className="flex items-center gap-1.5">
                    {m.statut === "active" ? (
                      <form action={executer(changerStatutMembre)}>
                        <input type="hidden" name="profilId" value={m.id} />
                        <input type="hidden" name="statut" value="suspended" />
                        <button
                          type="submit"
                          disabled={enCours}
                          aria-label={`Suspendre l'accès de ${m.email}`}
                          title="Ferme l'accès et libère la place. Réversible, rien n'est perdu."
                          className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-warning/40 px-2 py-1 text-[11px] font-bold text-warning transition-colors hover:bg-warning/10 disabled:opacity-50"
                        >
                          <PauseCircle aria-hidden className="h-3 w-3" />
                          Suspendre
                        </button>
                      </form>
                    ) : (
                      <form action={executer(changerStatutMembre)}>
                        <input type="hidden" name="profilId" value={m.id} />
                        <input type="hidden" name="statut" value="active" />
                        <button
                          type="submit"
                          disabled={enCours}
                          aria-label={`Réactiver l'accès de ${m.email}`}
                          title="Rouvre l'accès immédiatement."
                          className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-success/40 px-2 py-1 text-[11px] font-bold text-success transition-colors hover:bg-success/10 disabled:opacity-50"
                        >
                          <PlayCircle aria-hidden className="h-3 w-3" />
                          Réactiver
                        </button>
                      </form>
                    )}

                    {m.statut !== "revoked" && (
                      <form action={executer(changerStatutMembre)}>
                        <input type="hidden" name="profilId" value={m.id} />
                        <input type="hidden" name="statut" value="revoked" />
                        <button
                          type="submit"
                          disabled={enCours}
                          aria-label={`Révoquer définitivement l'accès de ${m.email}`}
                          title="Ferme l'accès définitivement. L'historique du membre reste rattaché au cabinet."
                          className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-error/30 px-2 py-1 text-[11px] font-bold text-error transition-colors hover:bg-error/10 disabled:opacity-50"
                        >
                          <Ban aria-hidden className="h-3 w-3" />
                          Révoquer
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <span className="rounded bg-muted px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                {m.ciccRole}
              </span>
            )}
          </li>
        ))}
      </ul>

      {invitations.length > 0 && (
        <div className="mt-6 border-t border-border pt-5">
          <h3 className="mb-3 text-xs font-black uppercase tracking-widest text-muted-foreground">
            Invitations en attente
          </h3>
          <ul className="space-y-2">
            {invitations.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Clock aria-hidden className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate font-mono text-xs text-foreground">{i.email}</span>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                    {i.ciccRole}
                  </span>
                  <span className={cn("text-[11px] font-bold", i.expiree ? "text-error" : "text-muted-foreground")}>
                    {i.expiree ? "expirée" : `jusqu'au ${i.expiresAt}`}
                  </span>
                </div>
                {peutGerer && (
                  <form action={executer(revoquerInvitation)}>
                    <input type="hidden" name="invitationId" value={i.id} />
                    <button
                      type="submit"
                      disabled={enCours}
                      className="min-h-8 rounded-lg border border-border px-2 py-1 text-[11px] font-bold text-muted-foreground transition-colors hover:bg-error/10 hover:text-error disabled:opacity-50"
                    >
                      Révoquer
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Retour r={resultat} />

      {!peutGerer && (
        <p className="mt-4 text-xs text-muted-foreground">
          Seul le propriétaire du cabinet peut inviter, promouvoir ou retirer un membre.
        </p>
      )}
    </section>
  )
}
