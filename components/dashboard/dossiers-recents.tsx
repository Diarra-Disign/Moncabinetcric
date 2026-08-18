"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Link } from "@/i18n/routing"
import { Search, ArrowUpRight, FolderOpen, CalendarClock, X } from "lucide-react"
import { chercherDossiersRecents } from "@/lib/data/dossiers-recents-actions"
import {
  CHAMPS_DATE, TRIS, PERIODES,
  type ChampDate, type Tri, type Periode,
  type PageDossiersRecents,
} from "@/lib/data/dossiers-recents-criteres"
import { cn } from "@/lib/utils"

/**
 * Les dossiers récents — la section que le brief place au niveau 2.
 *
 * Ce qu'elle remplace : une boucle sur un tableau vide écrit en dur, qui n'a
 * jamais rien affiché pour aucun cabinet.
 *
 * TROIS PARTIS PRIS.
 *
 * 1. La première page vient du SERVEUR. L'écran affiche ses dossiers au
 *    premier rendu, sans appel supplémentaire. Ce composant ne parle au
 *    serveur que lorsqu'on touche un filtre.
 *
 * 2. Les filtres se CUMULENT (§7). Recherche, période, type de date et tri
 *    partent ensemble dans la même requête, parce que « Diarra » + « 30
 *    derniers jours » est une question unique, pas deux.
 *
 * 3. La recherche est TEMPORISÉE. Sans cela, « Diarra » enverrait six
 *    requêtes — une par lettre — et les réponses reviendraient dans le
 *    désordre : la liste afficherait le résultat de « Diarr » après celui de
 *    « Diarra ».
 */

const STATUTS: Record<string, { texte: string; classe: string; pastille: string }> = {
  valid: { texte: "Conforme", classe: "bg-success/15 text-success-strong", pastille: "bg-success" },
  alert: { texte: "Alerte", classe: "bg-error/10 text-error-strong", pastille: "bg-error" },
  review: { texte: "À revoir", classe: "bg-warning/15 text-warning-strong", pastille: "bg-warning" },
  pending: { texte: "En attente", classe: "bg-muted text-foreground/75", pastille: "bg-muted-foreground/50" },
}

const dateCourte = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" }) : "—"

/** Le jour même, sans passer par un fuseau : une date d'échéance est une date
 *  civile, et la comparer en UTC déplace la limite d'un jour le soir. */
const aujourdhui = () => new Date().toISOString().slice(0, 10)

export function DossiersRecents({ initial }: { initial: PageDossiersRecents }) {
  const routeur = useRouter()
  const [page, setPage] = React.useState(initial)
  const [enCours, setEnCours] = React.useState(false)

  const [recherche, setRecherche] = React.useState("")
  const [champDate, setChampDate] = React.useState<ChampDate>("updated_at")
  const [periode, setPeriode] = React.useState<Periode>("tout")
  const [du, setDu] = React.useState("")
  const [au, setAu] = React.useState("")
  const [tri, setTri] = React.useState<Tri>("date_desc")
  const [personnalisee, setPersonnalisee] = React.useState(false)

  /** Le premier rendu ne redemande rien : il a déjà sa page. */
  const premierRendu = React.useRef(true)
  /** Numéro de requête : seule la dernière partie a le droit d'écrire. */
  const derniere = React.useRef(0)

  React.useEffect(() => {
    if (premierRendu.current) {
      premierRendu.current = false
      return
    }
    const numero = ++derniere.current
    const minuteur = setTimeout(async () => {
      setEnCours(true)
      try {
        const resultat = await chercherDossiersRecents({
          champDate, periode, recherche, tri,
          du: personnalisee ? du : "",
          au: personnalisee ? au : "",
        })
        // Une réponse arrivée après une plus récente est jetée : sans cette
        // garde, la liste finit sur le résultat de la frappe précédente.
        if (numero === derniere.current) setPage(resultat)
      } finally {
        if (numero === derniere.current) setEnCours(false)
      }
    }, 250)
    return () => clearTimeout(minuteur)
  }, [recherche, champDate, periode, tri, du, au, personnalisee])

  const filtre = cn(
    "rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-foreground",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
  )

  const actif = personnalisee || periode !== "tout" || recherche.trim() !== ""

  return (
    <div className="bg-card rounded-3xl border border-border shadow-[0_4px_20px_rgba(0,0,0,0.02)] overflow-hidden">
      <div className="p-6 border-b border-border space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-foreground">Dossiers récents</h2>
            <p className="text-xs font-semibold text-muted-foreground mt-0.5">
              {/* « sur » et non « affichés » : ce qui compte est de savoir
                  qu'il en existe d'autres, pas combien tiennent à l'écran. */}
              {page.total === 0
                ? "Aucun dossier ne correspond"
                : `${page.dossiers.length} affiché${page.dossiers.length > 1 ? "s" : ""} sur ${page.total}`}
            </p>
          </div>
          <Link
            href="/matters"
            className="text-xs font-extrabold text-primary-strong hover:underline flex items-center gap-1 min-h-9"
          >
            Voir tous les dossiers <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[12rem]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Nom du client, référence, programme…"
              aria-label="Rechercher un dossier"
              className={cn(filtre, "w-full pl-9 placeholder:text-foreground/55")}
            />
          </div>

          <label className="sr-only" htmlFor="champ-date">Type de date</label>
          <select id="champ-date" value={champDate} aria-label="Type de date"
            onChange={(e) => setChampDate(e.target.value as ChampDate)} className={filtre}>
            {CHAMPS_DATE.map((c) => <option key={c.valeur} value={c.valeur}>{c.libelle}</option>)}
          </select>

          <label className="sr-only" htmlFor="tri">Trier</label>
          <select id="tri" value={tri} aria-label="Trier les dossiers"
            onChange={(e) => setTri(e.target.value as Tri)} className={filtre}>
            {TRIS.map((c) => <option key={c.valeur} value={c.valeur}>{c.libelle}</option>)}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {PERIODES.map((p) => (
            <button
              key={p.valeur}
              type="button"
              onClick={() => { setPersonnalisee(false); setPeriode(p.valeur) }}
              aria-pressed={!personnalisee && periode === p.valeur}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer min-h-9",
                !personnalisee && periode === p.valeur
                  ? "border-primary bg-primary/10 text-primary-strong"
                  : "border-border text-foreground/75 hover:bg-muted"
              )}
            >
              {p.libelle}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPersonnalisee((v) => !v)}
            aria-pressed={personnalisee}
            className={cn(
              "px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer min-h-9",
              personnalisee
                ? "border-primary bg-primary/10 text-primary-strong"
                : "border-border text-foreground/75 hover:bg-muted"
            )}
          >
            Période personnalisée
          </button>

          {actif && (
            <button
              type="button"
              onClick={() => {
                setRecherche(""); setPeriode("tout"); setPersonnalisee(false)
                setDu(""); setAu(""); setTri("date_desc"); setChampDate("updated_at")
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-muted-foreground hover:bg-muted cursor-pointer min-h-9"
            >
              <X className="h-3 w-3" /> Réinitialiser
            </button>
          )}
        </div>

        {personnalisee && (
          <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-muted/30 p-3">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Du</span>
              <input type="date" value={du} max={au || aujourdhui()}
                onChange={(e) => setDu(e.target.value)} className={filtre} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Au</span>
              {/* min={du} : la borne de fin ne peut pas précéder celle de début.
                  Le navigateur le refuse alors à la saisie, plutôt qu'un message
                  après coup sur une recherche qui ne rendrait rien. */}
              <input type="date" value={au} min={du}
                onChange={(e) => setAu(e.target.value)} className={filtre} />
            </label>
            <p className="text-[11px] text-muted-foreground pb-2">
              Porte sur : <strong className="text-foreground">
                {CHAMPS_DATE.find((c) => c.valeur === champDate)?.libelle.toLowerCase()}
              </strong>
            </p>
          </div>
        )}
      </div>

      <div className={cn("divide-y divide-border transition-opacity", enCours && "opacity-50")}
        aria-busy={enCours}>
        {page.dossiers.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <FolderOpen className="mx-auto h-8 w-8 text-muted-foreground/70" />
            <p className="mt-3 text-sm font-bold text-foreground">
              {actif ? "Aucun dossier ne correspond à cette recherche" : "Aucun dossier récent"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {actif
                ? "Élargissez la période ou effacez la recherche."
                : "Les dossiers sur lesquels vous travaillerez apparaîtront ici."}
            </p>
            <Link
              href="/matters"
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border font-bold text-xs text-foreground hover:bg-muted min-h-9"
            >
              Voir tous les dossiers <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : (
          page.dossiers.map((d) => {
            const st = STATUTS[d.status] ?? STATUTS.pending
            const enRetard = d.deadline && d.deadline < aujourdhui()
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => routeur.push(`/fr/matters/${d.reference.replace("#", "")}` as never)}
                className="w-full text-left p-5 flex flex-wrap items-center justify-between gap-3 hover:bg-muted/60 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary-strong flex items-center justify-center shrink-0">
                    <FolderOpen className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-black text-foreground group-hover:text-primary-strong transition-colors truncate">
                      {d.clientName}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                      <span className="font-mono font-bold text-foreground/80">{d.reference}</span>
                      <span aria-hidden>•</span>
                      <span className="truncate">{d.program}</span>
                      <span aria-hidden>•</span>
                      <span>modifié le {dateCourte(d.updatedAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {d.deadline && (
                    <span className={cn(
                      "inline-flex items-center gap-1.5 text-[11px] font-bold",
                      enRetard ? "text-error-strong" : "text-muted-foreground"
                    )}>
                      <CalendarClock className="h-3.5 w-3.5" />
                      {enRetard ? "échue le " : "échéance "}{dateCourte(d.deadline)}
                    </span>
                  )}
                  {/* La pastille double la teinte par une forme : elle reste
                      distinguable en niveaux de gris et pour qui ne perçoit
                      pas les rouges et les verts. */}
                  <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black", st.classe)}>
                    <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", st.pastille)} />
                    {st.texte}
                  </span>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
