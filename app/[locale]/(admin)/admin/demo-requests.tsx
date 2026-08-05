"use client"

import * as React from "react"
import { Inbox, Mail, Phone, Building2, X, Check, AlertTriangle } from "lucide-react"
import { ecarterDemande, type ResultatAction } from "@/lib/data/admin-actions"
import type { DemoRequestRow } from "@/lib/data/admin"
import { CreerCabinet, LienARecopier } from "./firm-actions"
import { cn } from "@/lib/utils"

/**
 * Demandes de démonstration en attente.
 *
 * L'écran a une seule vocation : transformer une demande en accès ouvert,
 * sans ressaisir ce que la personne a déjà écrit. Le bouton ouvre le
 * formulaire de création pré-rempli de ses coordonnées ; il ne reste que
 * le numéro de permis à vérifier, qui est précisément ce qu'on ne doit pas
 * recopier sans regarder.
 */
export function DemoRequests({
  requests,
  labels,
  firmLabels,
}: {
  requests: DemoRequestRow[]
  labels: Record<string, string>
  firmLabels: Record<string, string>
}) {
  const [ouverte, setOuverte] = React.useState<string | null>(null)
  const [resultat, setResultat] = React.useState<ResultatAction | null>(null)
  // Conservé ici et non dans la carte : une fois l'accès ouvert, la
  // demande quitte la liste et la carte est démontée. Le lien, lui, doit
  // rester à l'écran — c'est le seul endroit où il aura existé en clair.
  const [ouverture, setOuverture] = React.useState<ResultatAction | null>(null)
  const [enCours, demarrer] = React.useTransition()

  const banniere = ouverture && (
    <div className="mb-3 rounded-2xl border border-border bg-card p-4">
      <p className="flex items-start gap-2 text-xs font-bold text-success">
        <Check aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" />
        {ouverture.message}
      </p>
      {ouverture.lien && <LienARecopier lien={ouverture.lien} labels={firmLabels} />}
      <button
        type="button"
        onClick={() => setOuverture(null)}
        className="mt-3 text-[11px] font-bold text-muted-foreground underline transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {labels.done}
      </button>
    </div>
  )

  if (requests.length === 0) {
    return (
      <>
        {banniere}
        <p className="flex items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-6 text-xs text-muted-foreground">
          <Inbox aria-hidden className="h-4 w-4 shrink-0" />
          {labels.empty}
        </p>
      </>
    )
  }

  return (
    <>
    {banniere}
    <ul className="flex flex-col gap-3">
      {requests.map((d) => (
        <li key={d.id} className="rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-black text-foreground">{d.name}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {d.company && (
                  <span className="flex items-center gap-1">
                    <Building2 aria-hidden className="h-3.5 w-3.5" />
                    {d.company}
                  </span>
                )}
                <a
                  href={`mailto:${d.email}`}
                  className="flex items-center gap-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Mail aria-hidden className="h-3.5 w-3.5" />
                  {d.email}
                </a>
                {d.phone && (
                  <span className="flex items-center gap-1">
                    <Phone aria-hidden className="h-3.5 w-3.5" />
                    {d.phone}
                  </span>
                )}
                <span className="font-mono uppercase">{d.locale}</span>
                <time dateTime={d.createdAt}>{d.createdAt.slice(0, 10)}</time>
              </div>
              {d.message && (
                <p className="mt-2 whitespace-pre-line rounded-xl bg-muted px-3 py-2 text-xs leading-relaxed text-foreground">
                  {d.message}
                </p>
              )}
            </div>

            {ouverte !== d.id && (
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setOuverte(d.id); setResultat(null) }}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  {labels.openAccess}
                </button>
                <button
                  type="button"
                  disabled={enCours}
                  onClick={() => demarrer(async () => {
                    const fd = new FormData()
                    fd.set("demandeId", d.id)
                    setResultat(await ecarterDemande(fd))
                  })}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <X aria-hidden className="h-3.5 w-3.5" />
                  {labels.dismiss}
                </button>
              </div>
            )}
          </div>

          {resultat && ouverte !== d.id && (
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

          {ouverte === d.id && (
            <div className="mt-4">
              <CreerCabinet
                labels={firmLabels}
                onDone={() => setOuverte(null)}
                onResultat={(r) => {
                  if (r.ok) setOuverture(r)
                  else setResultat(r)
                }}
                prefill={{
                  demandeId: d.id,
                  // La raison sociale déclarée, à défaut le nom de la
                  // personne : l'exploitant corrige avant d'envoyer.
                  nom: d.company || d.name,
                  proprietaire: d.name,
                  courriel: d.email,
                  langue: d.locale,
                }}
              />
            </div>
          )}
        </li>
      ))}
    </ul>
    </>
  )
}
