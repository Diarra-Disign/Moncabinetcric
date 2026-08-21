"use client"

import * as React from "react"
import { CalendarDays, Clock, Video, Check, Loader2, AlertTriangle, Globe } from "lucide-react"
import { reserverDepuisLaPagePublique } from "@/lib/data/reservation-actions"

interface CreneauVue { iso: string; local: string }

const FUSEAU_CABINET = "America/Toronto"

/**
 * L'écran que voit le client d'un cabinet.
 *
 * ─── DEUX FUSEAUX, TOUJOURS ────────────────────────────────────────────────
 *
 * Un cabinet d'immigration reçoit des gens qui sont encore à Dakar, à Manille
 * ou à Bogota. « 14 h 30 » sans fuseau leur fait manquer le rendez-vous.
 * L'écran affiche donc l'heure du CABINET, et — seulement si le visiteur est
 * ailleurs — la sienne juste à côté. Afficher les deux à un visiteur déjà à
 * Gatineau serait du bruit.
 *
 * ─── LE CHOIX SE FAIT EN DEUX TEMPS ────────────────────────────────────────
 *
 * Une journée, puis une heure. Trente créneaux affichés d'un coup se lisent mal
 * sur un téléphone, et c'est sur un téléphone qu'on prend rendez-vous.
 */
export function ReservationClient({
  slug, nomCabinet, logoUrl, dureeMinutes, aUneSalle, creneaux,
}: {
  slug: string
  nomCabinet: string
  logoUrl: string
  dureeMinutes: number
  aUneSalle: boolean
  creneaux: CreneauVue[]
}) {
  const [jourChoisi, setJourChoisi] = React.useState<string | null>(null)
  const [creneauChoisi, setCreneauChoisi] = React.useState<CreneauVue | null>(null)
  const [envoi, setEnvoi] = React.useState(false)
  const [erreur, setErreur] = React.useState<string | null>(null)
  const [confirme, setConfirme] = React.useState<string | null>(null)

  // ── LE FUSEAU DU VISITEUR ─────────────────────────────────────────────
  //
  // Il n'existe pas au rendu serveur : le lire dans un `useEffect` puis appeler
  // `setState` paraît naturel et provoque des rendus en cascade — React le
  // signale comme une erreur.
  //
  // `useSyncExternalStore` est fait pour cela : un instantané côté serveur
  // (null), un autre côté navigateur, et aucune discordance d'hydratation. Le
  // premier argument ne s'abonne à rien, car un fuseau ne change pas pendant
  // qu'on prend rendez-vous.
  //
  // Les deux instantanés rendent une CHAÎNE ou null, jamais un objet : une
  // nouvelle référence à chaque lecture ferait boucler React indéfiniment.
  const fuseauVisiteur = React.useSyncExternalStore(
    () => () => {},
    () => {
      try {
        const f = Intl.DateTimeFormat().resolvedOptions().timeZone
        return f && f !== FUSEAU_CABINET ? f : null
      } catch {
        return null // un navigateur sans Intl complet : on s'en tient au cabinet
      }
    },
    () => null
  )

  const journees = React.useMemo(() => {
    const groupes = new Map<string, CreneauVue[]>()
    for (const c of creneaux) {
      const jour = c.local.slice(0, 10)
      groupes.set(jour, [...(groupes.get(jour) ?? []), c])
    }
    return [...groupes.entries()].map(([jour, liste]) => ({ jour, liste }))
  }, [creneaux])

  const libelleJour = (jour: string) => {
    const [a, m, j] = jour.split("-").map(Number)
    // Midi UTC : aucun fuseau n'est alors la veille ou le lendemain, donc le
    // jour de la semaine affiché est bien celui du créneau.
    return new Intl.DateTimeFormat("fr-CA", {
      weekday: "long", day: "numeric", month: "long", timeZone: "UTC",
    }).format(new Date(Date.UTC(a, m - 1, j, 12)))
  }

  const heureVisiteur = (iso: string) =>
    fuseauVisiteur
      ? new Intl.DateTimeFormat("fr-CA", { hour: "2-digit", minute: "2-digit", timeZone: fuseauVisiteur, hour12: false })
          .format(new Date(iso))
      : null

  const soumettre = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!creneauChoisi) return
    setEnvoi(true)
    setErreur(null)

    const donnees = new FormData(e.currentTarget)
    donnees.set("slug", slug)
    donnees.set("debut", creneauChoisi.iso)

    const r = await reserverDepuisLaPagePublique(donnees)
    setEnvoi(false)
    if (r.confirme) setConfirme(r.message)
    else setErreur(r.message)
  }

  if (confirme) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-5 px-5 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success-strong">
          <Check aria-hidden className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-black text-foreground">C&apos;est confirmé</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">{confirme}</p>
        {creneauChoisi && (
          <div className="w-full rounded-3xl border border-border bg-card p-6 text-left">
            <p className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Votre rendez-vous</p>
            <p className="mt-2 text-base font-black text-foreground">{libelleJour(creneauChoisi.local.slice(0, 10))}</p>
            <p className="mt-1 text-sm font-bold text-foreground">
              {creneauChoisi.local.slice(11)} (heure de l&apos;Est) · {dureeMinutes} minutes
            </p>
            {heureVisiteur(creneauChoisi.iso) && (
              <p className="mt-1 text-xs text-muted-foreground">
                Soit {heureVisiteur(creneauChoisi.iso)} chez vous.
              </p>
            )}
            {aUneSalle && (
              <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                <Video aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Le lien de la visioconférence figure dans le courriel que vous venez de recevoir.
              </p>
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground">{nomCabinet}</p>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-5 py-10">
      <header className="flex items-center gap-4">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- logo distant, hors du domaine
          <img src={logoUrl} alt="" className="h-12 w-12 rounded-2xl object-contain" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary-strong">
            <CalendarDays aria-hidden className="h-6 w-6" />
          </div>
        )}
        <div>
          <h1 className="text-xl font-black tracking-tight text-foreground">Prendre rendez-vous</h1>
          <p className="text-sm text-muted-foreground">{nomCabinet}</p>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 font-bold text-foreground">
          <Clock aria-hidden className="h-3.5 w-3.5" /> {dureeMinutes} minutes
        </span>
        {aUneSalle && (
          <span className="inline-flex items-center gap-1.5">
            <Video aria-hidden className="h-3.5 w-3.5" /> Par visioconférence
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <Globe aria-hidden className="h-3.5 w-3.5" /> Heures de l&apos;Est
          {fuseauVisiteur ? ` · votre heure locale indiquée` : ""}
        </span>
      </div>

      {journees.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-border px-6 py-14 text-center text-sm text-muted-foreground">
          Aucun créneau n&apos;est disponible pour le moment. Réessayez dans quelques jours.
        </p>
      ) : !jourChoisi ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Choisissez une journée</h2>
          {journees.map(({ jour, liste }) => (
            <button
              key={jour}
              type="button"
              onClick={() => setJourChoisi(jour)}
              className="flex min-h-14 items-center justify-between rounded-2xl border border-border bg-card px-5 py-3 text-left transition-colors hover:border-primary hover:bg-muted/40"
            >
              <span className="text-sm font-bold capitalize text-foreground">{libelleJour(jour)}</span>
              <span className="text-xs font-bold text-muted-foreground">
                {liste.length} {liste.length > 1 ? "créneaux" : "créneau"}
              </span>
            </button>
          ))}
        </section>
      ) : !creneauChoisi ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black capitalize text-foreground">{libelleJour(jourChoisi)}</h2>
            <button type="button" onClick={() => setJourChoisi(null)}
              className="text-xs font-bold text-primary-strong underline underline-offset-2">
              Changer de journée
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(journees.find((j) => j.jour === jourChoisi)?.liste ?? []).map((c) => (
              <button
                key={c.iso}
                type="button"
                onClick={() => setCreneauChoisi(c)}
                className="flex min-h-14 flex-col items-center justify-center rounded-2xl border border-border bg-card py-2 transition-colors hover:border-primary hover:bg-muted/40"
              >
                <span className="text-sm font-black tabular-nums text-foreground">{c.local.slice(11)}</span>
                {heureVisiteur(c.iso) && (
                  <span className="text-[10px] tabular-nums text-muted-foreground">chez vous {heureVisiteur(c.iso)}</span>
                )}
              </button>
            ))}
          </div>
        </section>
      ) : (
        <form onSubmit={soumettre} className="flex flex-col gap-4">
          <div className="flex items-center justify-between rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3">
            <div>
              <p className="text-sm font-black capitalize text-foreground">{libelleJour(jourChoisi)}</p>
              <p className="text-xs font-bold text-muted-foreground">
                {creneauChoisi.local.slice(11)} (heure de l&apos;Est)
                {heureVisiteur(creneauChoisi.iso) ? ` · ${heureVisiteur(creneauChoisi.iso)} chez vous` : ""}
              </p>
            </div>
            <button type="button" onClick={() => setCreneauChoisi(null)}
              className="text-xs font-bold text-primary-strong underline underline-offset-2">
              Changer
            </button>
          </div>

          {/* Le champ-piège. Invisible à l'œil et retiré du parcours au clavier
              et des lecteurs d'écran : seul un robot le remplira. */}
          <div aria-hidden className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
            <label htmlFor="site">Ne remplissez pas ce champ</label>
            <input id="site" name="site" type="text" tabIndex={-1} autoComplete="off" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="nom" className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              Votre nom complet
            </label>
            <input id="nom" name="nom" required autoComplete="name"
              className="min-h-11 rounded-2xl border border-border bg-card px-4 text-sm font-medium focus:border-primary focus:outline-none" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="courriel" className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              Votre courriel
            </label>
            <input id="courriel" name="courriel" type="email" required autoComplete="email"
              className="min-h-11 rounded-2xl border border-border bg-card px-4 text-sm font-medium focus:border-primary focus:outline-none" />
            <p className="text-[11px] text-muted-foreground">C&apos;est là que sera envoyée votre confirmation.</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="telephone" className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              Téléphone <span className="font-medium normal-case">(facultatif)</span>
            </label>
            <input id="telephone" name="telephone" type="tel" autoComplete="tel"
              className="min-h-11 rounded-2xl border border-border bg-card px-4 text-sm font-medium focus:border-primary focus:outline-none" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="motif" className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              Objet de la consultation <span className="font-medium normal-case">(facultatif)</span>
            </label>
            <input id="motif" name="motif" maxLength={120} placeholder="Résidence permanente, permis de travail…"
              className="min-h-11 rounded-2xl border border-border bg-card px-4 text-sm font-medium placeholder:text-foreground/45 focus:border-primary focus:outline-none" />
          </div>

          {erreur && (
            <p aria-live="polite" className="flex items-start gap-2 rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-xs font-bold text-danger-strong">
              <AlertTriangle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {erreur}
            </p>
          )}

          <button type="submit" disabled={envoi}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">
            {envoi ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <Check aria-hidden className="h-4 w-4" />}
            {envoi ? "Confirmation en cours…" : "Confirmer le rendez-vous"}
          </button>

          <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
            Vos coordonnées ne servent qu&apos;à ce rendez-vous. {nomCabinet} vous écrira à l&apos;adresse indiquée.
          </p>
        </form>
      )}
    </main>
  )
}
