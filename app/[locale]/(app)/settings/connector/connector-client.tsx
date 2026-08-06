"use client"

import * as React from "react"
import {
  Bot,
  KeyRound,
  ShieldAlert,
  ShieldCheck,
  Copy,
  Check,
  AlertTriangle,
  Ban,
  Plus,
  ScrollText,
} from "lucide-react"
import { PageHeader } from "@/components/app-shell/page-header"
import type { ReglagesConnecteur, CleApiVue, EntreeJournal } from "@/lib/data/connector-reads"
import {
  basculerConnecteur,
  creerCleApi,
  revoquerCleApi,
  type ResultatConnecteur,
} from "@/lib/data/connector-actions"
import { cn } from "@/lib/utils"

const CHAMP =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"

interface ConnectorClientProps {
  estProprietaire: boolean
  reglages: ReglagesConnecteur
  cles: CleApiVue[]
  journal: EntreeJournal[]
}

function Retour({ resultat }: { resultat: ResultatConnecteur | null }) {
  if (!resultat) return null
  return (
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
  )
}

const COULEUR_STATUT: Record<string, string> = {
  success: "bg-success/10 text-success",
  unauthorized: "bg-error/10 text-error",
  reserved_human_action: "bg-warning/10 text-warning",
  action_not_allowed: "bg-warning/10 text-warning",
}

export function ConnectorClient({ estProprietaire, reglages, cles, journal }: ConnectorClientProps) {
  const [resultat, setResultat] = React.useState<ResultatConnecteur | null>(null)
  const [nouvelleCle, setNouvelleCle] = React.useState<string | null>(null)
  const [copie, setCopie] = React.useState(false)
  const [formulaireOuvert, setFormulaireOuvert] = React.useState(false)
  const [enCours, demarrer] = React.useTransition()

  const actives = cles.filter((c) => !c.revoquee)

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Connecteur d'intelligence artificielle"
        subtitle="Ouvrir l'accès d'un assistant aux ententes du cabinet, sous conditions."
      />

      {/* Ce que le connecteur ne peut pas faire est dit avant ce qu'il peut :
          c'est l'information qui engage la responsabilité déontologique. */}
      <section className="flex items-start gap-3 rounded-2xl border border-border bg-muted/40 p-4">
        <ShieldCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="text-xs leading-relaxed text-muted-foreground">
          <h2 className="text-xs font-black text-foreground">Ce que l&apos;assistant ne peut pas faire</h2>
          <p className="mt-1">
            Les actes réservés — <strong>finaliser, envoyer, signer, annuler</strong> une entente —
            sont refusés par la base de données, et non par cette page. Le refus tient donc même si
            l&apos;application était contournée.
          </p>
          <p className="mt-1.5">
            Une clé ne donne accès qu&apos;aux données du cabinet qui l&apos;a créée. Le cabinet est
            déduit de la clé : aucun appel ne peut en désigner un autre.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                reglages.enabled ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
              )}
            >
              <Bot aria-hidden className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-sm font-black text-foreground">
                {reglages.enabled ? "Connecteur ouvert" : "Connecteur fermé"}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {reglages.enabled
                  ? `Ouvert depuis le ${reglages.enabledAt || "—"}. Les clés actives fonctionnent.`
                  : "Aucune clé ne fonctionne tant que le connecteur est fermé."}
              </p>
            </div>
          </div>

          {estProprietaire && (
            <form
              action={(fd) =>
                demarrer(async () => {
                  fd.set("activer", reglages.enabled ? "0" : "1")
                  setResultat(await basculerConnecteur(fd))
                })
              }
            >
              <button
                type="submit"
                disabled={enCours}
                className={cn(
                  "inline-flex min-h-10 items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                  reglages.enabled
                    ? "border border-border text-foreground hover:bg-muted"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
              >
                {reglages.enabled ? (
                  <>
                    <Ban aria-hidden className="h-4 w-4" /> Fermer le connecteur
                  </>
                ) : (
                  <>
                    <ShieldAlert aria-hidden className="h-4 w-4" /> Ouvrir le connecteur
                  </>
                )}
              </button>
            </form>
          )}
        </div>
        <Retour resultat={resultat} />
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-base font-black tracking-tight text-foreground">
            <KeyRound aria-hidden className="h-4 w-4 text-muted-foreground" />
            Clés d&apos;API
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-black tabular-nums text-muted-foreground">
              {actives.length}
            </span>
          </h2>
          {estProprietaire && !formulaireOuvert && (
            <button
              type="button"
              onClick={() => setFormulaireOuvert(true)}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <Plus aria-hidden className="h-4 w-4" /> Nouvelle clé
            </button>
          )}
        </div>

        {/* La clé n'est montrée qu'ici, et une seule fois : la base n'en
            conserve que l'empreinte, elle est donc irrécupérable ensuite. */}
        {nouvelleCle && (
          <div className="mb-4 rounded-2xl border border-warning/40 bg-warning/10 p-4">
            <p className="text-xs font-black text-foreground">
              Copiez cette clé maintenant — elle ne sera plus jamais affichée.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-background px-3 py-2 font-mono text-xs text-foreground">
                {nouvelleCle}
              </code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(nouvelleCle)
                  setCopie(true)
                  setTimeout(() => setCopie(false), 2000)
                }}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-bold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {copie ? <Check aria-hidden className="h-3.5 w-3.5" /> : <Copy aria-hidden className="h-3.5 w-3.5" />}
                {copie ? "Copiée" : "Copier"}
              </button>
            </div>
          </div>
        )}

        {formulaireOuvert && estProprietaire && (
          <form
            action={(fd) =>
              demarrer(async () => {
                const r = await creerCleApi(fd)
                setResultat(r)
                if (r.ok && r.cle) {
                  setNouvelleCle(r.cle)
                  setFormulaireOuvert(false)
                }
              })
            }
            className="mb-4 rounded-2xl border border-border bg-card p-5"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold text-foreground">
                Usage de la clé
                <input
                  name="label"
                  required
                  placeholder="ex : ChatGPT — poste du CRIC responsable"
                  className={cn(CHAMP, "mt-1 h-10 font-normal")}
                />
              </label>
              <label className="text-xs font-bold text-foreground">
                Expire après (jours, facultatif)
                <input name="jours" type="number" min={1} className={cn(CHAMP, "mt-1 h-10 font-normal")} />
              </label>
            </div>
            <div className="mt-4 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setFormulaireOuvert(false)}
                className="min-h-10 rounded-xl px-3 py-2 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={enCours}
                className="inline-flex min-h-10 items-center rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {enCours ? "Création…" : "Créer la clé"}
              </button>
            </div>
          </form>
        )}

        {cles.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
            Aucune clé. Sans clé, le connecteur ne répond à personne.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  <th className="px-4 py-3 font-bold">Usage</th>
                  <th className="px-4 py-3 font-bold">Préfixe</th>
                  <th className="px-4 py-3 font-bold">Créée</th>
                  <th className="px-4 py-3 font-bold">Dernier appel</th>
                  <th className="px-4 py-3 font-bold">État</th>
                  <th className="px-4 py-3 font-bold" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {cles.map((c) => (
                  <tr key={c.id} className={cn(c.revoquee && "opacity-50")}>
                    <td className="px-4 py-3 font-bold text-foreground">{c.label}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{c.prefixe}…</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{c.creeLe}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {c.dernierUsage || "jamais"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                          c.revoquee ? "bg-error/10 text-error" : "bg-success/10 text-success"
                        )}
                      >
                        {c.revoquee ? "révoquée" : c.expireLe ? `expire ${c.expireLe}` : "active"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {estProprietaire && !c.revoquee && (
                        <form
                          action={(fd) =>
                            demarrer(async () => {
                              fd.set("id", c.id)
                              setResultat(await revoquerCleApi(fd))
                            })
                          }
                        >
                          <button
                            type="submit"
                            disabled={enCours}
                            className="min-h-10 rounded-lg px-2 py-1 text-xs font-bold text-error transition-colors hover:bg-error/10 disabled:opacity-50"
                          >
                            Révoquer
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-black tracking-tight text-foreground">
          <ScrollText aria-hidden className="h-4 w-4 text-muted-foreground" />
          Journal des appels
        </h2>
        {/* Les refus y figurent autant que les succès : une clé révoquée qui
            continue d'essayer ne se voit que là. */}
        {journal.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
            Aucun appel enregistré.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="border-b border-border bg-muted/40">
                <tr className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  <th className="px-4 py-3 font-bold">Quand</th>
                  <th className="px-4 py-3 font-bold">Clé</th>
                  <th className="px-4 py-3 font-bold">Action</th>
                  <th className="px-4 py-3 font-bold">Issue</th>
                  <th className="px-4 py-3 font-bold">Détail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {journal.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap text-muted-foreground">
                      {l.occurredAt}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{l.prefixe}…</td>
                    <td className="px-4 py-3 font-mono text-xs text-foreground">{l.action}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                          COULEUR_STATUT[l.statut] ?? "bg-muted text-muted-foreground"
                        )}
                      >
                        {l.statut}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{l.resume}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
