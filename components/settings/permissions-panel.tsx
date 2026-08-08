"use client"

import * as React from "react"
import { KeyRound, Check, AlertTriangle, Lock } from "lucide-react"
import { ajusterPermission, type ResultatPermission } from "@/lib/data/permission-actions"
import { cn } from "@/lib/utils"

export interface PermissionVue {
  key: string
  labelFr: string
  descriptionFr: string
  category: string
  ownerOnly: boolean
}

export interface MembrePermissions {
  profilId: string
  nom: string
  role: string
  statut: string
  estMoi: boolean
  /** Défaut du rôle, avant tout ajustement. */
  defauts: Record<string, boolean>
  /** Ajustements posés sur ce membre. Absent = suit le rôle. */
  ajustements: Record<string, boolean>
}

/**
 * Permissions par membre.
 *
 * Trois états par case, et non deux : « suit le rôle », « accordée »,
 * « retirée ». La distinction compte — un membre laissé sur le défaut suivra
 * une modification future de son rôle, là où une valeur écrite la fige. Deux
 * états auraient obligé à choisir entre les deux sans le dire.
 */
export function PermissionsPanel({
  permissions,
  membres,
  peutGerer,
}: {
  permissions: PermissionVue[]
  membres: MembrePermissions[]
  peutGerer: boolean
}) {
  const [resultat, setResultat] = React.useState<ResultatPermission | null>(null)
  const [enCours, demarrer] = React.useTransition()

  const executer = (fd: FormData) => demarrer(async () => setResultat(await ajusterPermission(fd)))

  const delegables = permissions.filter((p) => !p.ownerOnly)
  const reservees = permissions.filter((p) => p.ownerOnly)
  const actifs = membres.filter((m) => m.statut === "active")

  if (!peutGerer) return null

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2 text-base font-black tracking-tight text-foreground">
        <KeyRound aria-hidden className="h-4 w-4 text-muted-foreground" />
        Permissions
      </h2>
      <p className="mt-1 max-w-prose text-xs leading-relaxed text-muted-foreground">
        Chaque rôle porte des permissions par défaut. Vous pouvez les ajuster membre par membre —
        confier la facturation à une adjointe, ou retirer la suppression à quelqu&apos;un sans le
        rétrograder. <strong>Suit le rôle</strong> laisse la permission évoluer avec le rôle ;
        accorder ou retirer la fige pour cette personne.
      </p>

      {resultat && (
        <p
          role="status"
          className={cn(
            "mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-xs font-bold",
            resultat.ok ? "bg-success/10 text-success" : "bg-error/10 text-error"
          )}
        >
          {resultat.ok ? (
            <Check aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" />
          ) : (
            <AlertTriangle aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" />
          )}
          {resultat.message}
        </p>
      )}

      {actifs.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground">
          Aucun membre actif à qui accorder des permissions.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="px-3 py-3 font-bold">Permission</th>
                {actifs.map((m) => (
                  <th key={m.profilId} className="px-3 py-3 text-center font-bold">
                    {m.nom}
                    <span className="mt-0.5 block font-sans text-[9px] normal-case tracking-normal">
                      {m.role}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {delegables.map((p) => (
                <tr key={p.key}>
                  <td className="px-3 py-3">
                    <div className="text-xs font-bold text-foreground">{p.labelFr}</div>
                    {p.descriptionFr && (
                      <p className="mt-0.5 max-w-xs text-[11px] leading-relaxed text-muted-foreground">
                        {p.descriptionFr}
                      </p>
                    )}
                  </td>
                  {actifs.map((m) => {
                    const ajuste = p.key in m.ajustements
                    const effectif = ajuste ? m.ajustements[p.key] : (m.defauts[p.key] ?? false)
                    // Le propriétaire porte tout, sans condition : lui offrir
                    // un choix laisserait croire qu'on peut le lui retirer.
                    const fige = m.role === "owner" || m.estMoi
                    return (
                      <td key={m.profilId} className="px-3 py-3 text-center">
                        {fige ? (
                          <span
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-xs font-black text-muted-foreground"
                            title={
                              m.role === "owner"
                                ? "Le propriétaire porte toutes les permissions."
                                : "Vous ne pouvez pas ajuster vos propres permissions."
                            }
                          >
                            ✓
                          </span>
                        ) : (
                          <form action={executer} className="inline-flex">
                            <input type="hidden" name="profilId" value={m.profilId} />
                            <input type="hidden" name="permission" value={p.key} />
                            <select
                              name="valeur"
                              defaultValue={ajuste ? (effectif ? "1" : "0") : "defaut"}
                              disabled={enCours}
                              onChange={(e) => e.currentTarget.form?.requestSubmit()}
                              className={cn(
                                "min-h-8 rounded-lg border px-1.5 py-1 text-[11px] font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50",
                                effectif
                                  ? "border-success/40 bg-success/10 text-success"
                                  : "border-border text-muted-foreground"
                              )}
                            >
                              <option value="defaut">
                                {(m.defauts[p.key] ?? false) ? "rôle : oui" : "rôle : non"}
                              </option>
                              <option value="1">accordée</option>
                              <option value="0">retirée</option>
                            </select>
                          </form>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Ce qui ne se délègue pas est montré, avec sa raison. L'omettre
          laisserait chercher une case qui n'existe pas. */}
      <div className="mt-4 rounded-xl border border-border bg-muted/40 p-4">
        <h3 className="flex items-center gap-2 text-xs font-black text-foreground">
          <Lock aria-hidden className="h-3.5 w-3.5 text-muted-foreground" />
          Réservé au propriétaire, non délégable
        </h3>
        <ul className="mt-2 grid gap-1 text-[11px] text-muted-foreground sm:grid-cols-2">
          {reservees.map((p) => (
            <li key={p.key}>
              <strong className="text-foreground">{p.labelFr}</strong>
              {p.descriptionFr && ` — ${p.descriptionFr}`}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
