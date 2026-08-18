import type { Metadata } from "next"
import Link from "next/link"
import { Users, Search, ArrowLeft } from "lucide-react"
import { getAdminUtilisateurs } from "@/lib/data/admin"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Utilisateurs — Console d'exploitation",
  robots: { index: false, follow: false },
}

/**
 * Les personnes de la plateforme, tous cabinets confondus.
 *
 * ─── POURQUOI CET ÉCRAN EXISTE ─────────────────────────────────────────────
 *
 * La console voyait les cabinets et, à l'intérieur de chaque ligne, leurs
 * membres. Répondre à « qui est cette personne qui nous écrit » supposait donc
 * de savoir d'abord à quel cabinet elle appartient — c'est-à-dire précisément
 * ce qu'on ignore quand un courriel arrive d'une adresse qu'on ne reconnaît
 * pas.
 *
 * ─── CE QU'IL NE FAIT PAS ──────────────────────────────────────────────────
 *
 * Il ne modifie rien. Suspendre un membre, changer son rôle ou ses permissions
 * relève de SON CABINET, depuis Réglages → Équipe : ces gestes engagent la
 * répartition des responsabilités professionnelles à l'intérieur d'un cabinet
 * réglementé, et un exploitant de plateforme n'a pas à en décider. Ce qu'il
 * peut faire — fermer l'accès d'un cabinet entier — se fait à la ligne du
 * cabinet, où la décision est visible pour ce qu'elle est.
 */

const ROLES: Record<string, string> = {
  owner: "Propriétaire",
  rcic: "CRIC",
  risia: "ÉDIC",
  staff: "Personnel",
  bookkeeper: "Comptabilité",
  readonly: "Lecture seule",
}

export default async function UtilisateursPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const params = await searchParams
  const recherche = (params.q ?? "").trim()
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1)

  const resultat = await getAdminUtilisateurs({ recherche, page })
  const pages = Math.max(1, Math.ceil(resultat.total / resultat.parPage))

  const lien = (p: number) =>
    `/fr/admin/utilisateurs?${new URLSearchParams({
      ...(recherche ? { q: recherche } : {}),
      page: String(p),
    })}`

  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/fr/admin"
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" /> Console d&apos;exploitation
        </Link>
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
          <Users aria-hidden className="h-6 w-6 text-muted-foreground" />
          Utilisateurs
          <span className="rounded-full bg-muted px-2.5 py-0.5 font-mono text-sm font-bold text-muted-foreground">
            {resultat.total}
          </span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Toutes les personnes rattachées à un cabinet. Les rôles et les accès individuels se
          gèrent depuis le cabinet lui-même, jamais d&apos;ici.
        </p>
      </header>

      <form method="get" className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            name="q"
            defaultValue={recherche}
            placeholder="Nom ou courriel…"
            aria-label="Rechercher une personne"
            className="min-h-9 w-full rounded-lg border border-border bg-background py-1.5 pl-9 pr-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>
        <button
          type="submit"
          className="min-h-9 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-foreground hover:bg-muted"
        >
          Rechercher
        </button>
        {recherche && (
          <Link
            href="/fr/admin/utilisateurs"
            className="min-h-9 rounded-lg px-3 py-1.5 text-xs font-bold text-muted-foreground hover:bg-muted"
          >
            Effacer
          </Link>
        )}
      </form>

      {resultat.lignes.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
          {recherche
            ? `Aucune personne ne correspond à « ${recherche} ».`
            : "Aucun utilisateur."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[46rem] text-left text-xs">
            <thead className="border-b border-border bg-muted/40">
              <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-4 py-3 font-black">Personne</th>
                <th scope="col" className="px-4 py-3 font-black">Cabinet</th>
                <th scope="col" className="px-4 py-3 font-black">Rôle</th>
                <th scope="col" className="px-4 py-3 font-black">État</th>
                <th scope="col" className="px-4 py-3 font-black">Depuis</th>
              </tr>
            </thead>
            <tbody>
              {resultat.lignes.map((u) => (
                <tr key={u.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-bold text-foreground">{u.fullName || "—"}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">{u.email}</p>
                  </td>
                  <td className="px-4 py-3 text-foreground">{u.firmName || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {ROLES[u.ciccRole] ?? u.ciccRole}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "rounded-full border px-2 py-0.5 text-[11px] font-bold",
                      u.statut === "active"
                        ? "border-success/40 bg-success/15 text-success-strong"
                        : "border-border bg-muted text-muted-foreground"
                    )}>
                      {u.statut === "active" ? "Actif"
                        : u.statut === "suspended" ? "Suspendu"
                        : u.statut === "revoked" ? "Révoqué"
                        : u.statut}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground tabular-nums">
                    {u.creeLe || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Pages d'utilisateurs" className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground tabular-nums">
            Page {page} sur {pages}
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <a href={lien(page - 1)} className="min-h-9 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-foreground hover:bg-muted">
                Précédente
              </a>
            )}
            {page < pages && (
              <a href={lien(page + 1)} className="min-h-9 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-foreground hover:bg-muted">
                Suivante
              </a>
            )}
          </div>
        </nav>
      )}
    </div>
  )
}
