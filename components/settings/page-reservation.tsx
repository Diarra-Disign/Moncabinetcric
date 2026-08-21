"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CalendarDays, Plus, Trash2, Copy, Check, Loader2, ExternalLink } from "lucide-react"
import {
  ajouterPlage, retirerPlage, enregistrerPagePublique, type Plage,
} from "@/lib/data/disponibilites-actions"

const JOURS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]

/**
 * La page publique de réservation, gérée par le cabinet.
 *
 * ─── L'ADRESSE EST MONTRÉE, ET COPIABLE ────────────────────────────────────
 *
 * Ce que le cabinet vient chercher ici, c'est le lien à coller dans sa
 * signature de courriel et sur son site. L'afficher en entier avec un bouton de
 * copie évite de le reconstituer de tête — et de se tromper d'un tiret.
 *
 * ─── LE PRÉAVIS EST LE RÉGLAGE QU'ON OUBLIE ────────────────────────────────
 *
 * Sans lui, un visiteur réserve le consultant pour dans dix minutes. Il est
 * donc présenté au même rang que la durée, non caché dans un repli.
 */
export function PageReservation({
  plages, slug, active, duree, preavis, horizon, slugPropose,
}: {
  plages: Plage[]
  slug: string
  active: boolean
  duree: number
  preavis: number
  horizon: number
  slugPropose: string
}) {
  const router = useRouter()
  const [occupe, setOccupe] = React.useState(false)
  const [avis, setAvis] = React.useState<{ ok: boolean; texte: string } | null>(null)
  const [copie, setCopie] = React.useState(false)
  const [slugSaisi, setSlugSaisi] = React.useState(slug || slugPropose)

  const adresse = slugSaisi ? `https://moncabinetcric.com/fr/rdv/${slugSaisi}` : ""

  const annoncer = (ok: boolean, texte: string) => {
    setAvis({ ok, texte })
    setTimeout(() => setAvis(null), 8000)
  }

  const agir = async (action: () => Promise<{ ok: boolean; message: string }>) => {
    setOccupe(true)
    const r = await action()
    setOccupe(false)
    annoncer(r.ok, r.message)
    if (r.ok) router.refresh()
  }

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(adresse)
      setCopie(true)
      setTimeout(() => setCopie(false), 2500)
    } catch {
      annoncer(false, `Copie impossible. Adresse : ${adresse}`)
    }
  }

  return (
    <section className="rounded-3xl border border-border bg-card p-6 shadow-xs sm:p-8">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-black text-foreground">
            <CalendarDays aria-hidden className="h-5 w-5 text-primary-strong" />
            Votre page de réservation
          </h3>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            Vos clients choisissent eux-mêmes un créneau parmi vos disponibilités. Le rendez-vous
            entre dans votre calendrier et le lien de votre salle leur est envoyé — sans Calendly
            ni abonnement.
          </p>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 font-mono text-xs font-bold ${
          active ? "border-success/40 bg-success/15 text-success-strong" : "border-border bg-muted text-muted-foreground"
        }`}>
          {active ? "Page ouverte" : "Page fermée"}
        </span>
      </div>

      <form action={(fd) => agir(() => enregistrerPagePublique(fd))} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="slug" className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
            Adresse de votre page
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">moncabinetcric.com/fr/rdv/</span>
            <input
              id="slug" name="slug" value={slugSaisi}
              onChange={(e) => setSlugSaisi(e.target.value.toLowerCase())}
              placeholder="votre-cabinet"
              className="min-h-10 min-w-48 flex-1 rounded-2xl border border-border bg-muted/40 px-4 font-mono text-xs font-bold focus:border-primary focus:bg-card focus:outline-none"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Lettres minuscules, chiffres et tirets. C&apos;est l&apos;adresse que vous partagerez.
          </p>
        </div>

        {slug && active && (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={copier}
              className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-border bg-card px-4 text-xs font-bold text-foreground transition-colors hover:bg-muted">
              {copie ? <Check aria-hidden className="h-3.5 w-3.5 text-success-strong" /> : <Copy aria-hidden className="h-3.5 w-3.5 text-muted-foreground" />}
              {copie ? "Adresse copiée" : "Copier l'adresse"}
            </button>
            <a href={`/fr/rdv/${slug}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-border bg-card px-4 text-xs font-bold text-foreground transition-colors hover:bg-muted">
              <ExternalLink aria-hidden className="h-3.5 w-3.5 text-muted-foreground" />
              Voir ce que voient vos clients
            </a>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { id: "duree", nom: "duree", libelle: "Durée d'un rendez-vous", valeur: duree, unite: "minutes", min: 10, max: 240 },
            { id: "preavis", nom: "preavis", libelle: "Préavis minimal", valeur: preavis, unite: "heures", min: 0, max: 720 },
            { id: "horizon", nom: "horizon", libelle: "Réservable jusqu'à", valeur: horizon, unite: "jours", min: 1, max: 180 },
          ].map((c) => (
            <div key={c.id} className="flex flex-col gap-1.5">
              <label htmlFor={c.id} className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                {c.libelle}
              </label>
              <div className="flex items-center gap-2">
                <input id={c.id} name={c.nom} type="number" defaultValue={c.valeur} min={c.min} max={c.max}
                  className="min-h-10 w-24 rounded-2xl border border-border bg-muted/40 px-4 text-xs font-bold tabular-nums focus:border-primary focus:bg-card focus:outline-none" />
                <span className="text-xs text-muted-foreground">{c.unite}</span>
              </div>
            </div>
          ))}
        </div>

        <label className="flex items-start gap-3 rounded-2xl border border-border bg-muted/30 px-4 py-3">
          <input type="checkbox" name="active" defaultChecked={active} className="mt-0.5 h-4 w-4 accent-[var(--primary)]" />
          <span className="text-xs leading-relaxed text-foreground">
            <span className="font-bold">Ouvrir ma page au public.</span>{" "}
            <span className="text-muted-foreground">
              Décochez pour la fermer sans rien perdre : vos plages et votre adresse sont conservées.
            </span>
          </span>
        </label>

        <button type="submit" disabled={occupe}
          className="inline-flex min-h-11 w-fit items-center gap-2 rounded-2xl bg-primary px-6 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">
          {occupe ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <Check aria-hidden className="h-4 w-4" />}
          Enregistrer les réglages
        </button>
      </form>

      {/* ── LES PLAGES ────────────────────────────────────────────────────── */}
      <div className="mt-7 border-t border-border pt-5">
        <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
          Vos disponibilités hebdomadaires
        </h4>
        <p className="mt-1 text-[11px] text-muted-foreground">
          « Lundi 9 h – 12 h » puis « Lundi 13 h 30 – 17 h » : deux plages pour une journée coupée
          par le dîner.
        </p>

        {plages.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
            Aucune plage déclarée — votre page n&apos;offrira aucun créneau.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {plages.map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded-2xl border border-border bg-muted/20 px-4 py-2.5">
                <span className="text-xs font-bold text-foreground">
                  {JOURS[p.weekday]} · <span className="tabular-nums">{p.start} – {p.end}</span>
                </span>
                <button type="button" disabled={occupe} onClick={() => agir(() => retirerPlage(p.id))}
                  aria-label={`Retirer ${JOURS[p.weekday]} ${p.start} à ${p.end}`}
                  className="rounded-xl p-2 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger-strong disabled:opacity-40">
                  <Trash2 aria-hidden className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <form action={(fd) => agir(() => ajouterPlage(fd))} className="mt-4 flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="weekday" className="text-[11px] font-bold text-muted-foreground">Jour</label>
            <select id="weekday" name="weekday" defaultValue="1"
              className="min-h-10 rounded-2xl border border-border bg-muted/40 px-3 text-xs font-bold focus:border-primary focus:bg-card focus:outline-none">
              {JOURS.map((j, i) => <option key={j} value={i}>{j}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="start" className="text-[11px] font-bold text-muted-foreground">De</label>
            <input id="start" name="start" type="time" defaultValue="09:00" required
              className="min-h-10 rounded-2xl border border-border bg-muted/40 px-3 text-xs font-bold tabular-nums focus:border-primary focus:bg-card focus:outline-none" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="end" className="text-[11px] font-bold text-muted-foreground">À</label>
            <input id="end" name="end" type="time" defaultValue="17:00" required
              className="min-h-10 rounded-2xl border border-border bg-muted/40 px-3 text-xs font-bold tabular-nums focus:border-primary focus:bg-card focus:outline-none" />
          </div>
          <button type="submit" disabled={occupe}
            className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-border bg-card px-4 text-xs font-bold text-foreground transition-colors hover:bg-muted disabled:opacity-50">
            <Plus aria-hidden className="h-3.5 w-3.5" />
            Ajouter
          </button>
        </form>
      </div>

      {avis && (
        <p aria-live="polite" className={`mt-4 text-xs font-bold ${avis.ok ? "text-success-strong" : "text-danger-strong"}`}>
          {avis.texte}
        </p>
      )}
    </section>
  )
}
