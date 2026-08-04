"use client"

import * as React from "react"
import { UserPlus, Briefcase, Check, AlertTriangle } from "lucide-react"
import {
  creerProspectDepuisRdv,
  creerClientDepuisRdv,
  type ResultatPromotion,
} from "@/lib/data/promote-actions"
import { cn } from "@/lib/utils"

const CHAMP =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"

export interface PromoteFromEventProps {
  /** Ce que porte le rendez-vous, utilisé comme préremplissage. */
  clientName: string
  program?: string
  notes?: string
  /** Vrai si une fiche existe déjà pour ce nom : on n'en propose pas une seconde. */
  dejaClient: boolean
  dejaProspect: boolean
}

/**
 * Depuis un rendez-vous, créer la fiche correspondante.
 *
 * C'est la moitié utile de l'intégration d'agenda : voir le rendez-vous
 * fait gagner un coup d'œil, transformer ses informations en fiche fait
 * gagner dix minutes et une erreur de recopie.
 *
 * Le formulaire est prérempli mais modifiable : ce qu'une personne saisit
 * en réservant n'est pas toujours ce qui doit figurer au dossier.
 */
export function PromoteFromEvent({
  clientName,
  program,
  notes,
  dejaClient,
  dejaProspect,
}: PromoteFromEventProps) {
  const [mode, setMode] = React.useState<"prospect" | "client" | null>(null)
  const [resultat, setResultat] = React.useState<ResultatPromotion | null>(null)
  const [enCours, demarrer] = React.useTransition()

  if (dejaClient && dejaProspect) {
    return (
      <p className="rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        Une fiche client et une fiche prospect existent déjà pour cette personne.
      </p>
    )
  }

  if (!mode) {
    return (
      <div className="flex flex-wrap gap-2">
        {!dejaProspect && (
          <button
            type="button"
            onClick={() => { setMode("prospect"); setResultat(null) }}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-3.5 py-2 text-xs font-bold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <UserPlus aria-hidden className="h-3.5 w-3.5" />
            Créer un prospect
          </button>
        )}
        {!dejaClient && (
          <button
            type="button"
            onClick={() => { setMode("client"); setResultat(null) }}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <Briefcase aria-hidden className="h-3.5 w-3.5" />
            Créer un client
          </button>
        )}
      </div>
    )
  }

  const action = mode === "prospect" ? creerProspectDepuisRdv : creerClientDepuisRdv

  return (
    <form
      action={(fd) => demarrer(async () => {
        const r = await action(fd)
        setResultat(r)
        if (r.ok) setMode(null)
      })}
      className="rounded-2xl border border-border bg-muted/30 p-4"
    >
      <h4 className="mb-3 text-xs font-black text-foreground">
        {mode === "prospect" ? "Nouveau prospect" : "Nouveau client"}
      </h4>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold text-foreground">
          Nom complet
          <input name="nom" required defaultValue={clientName} className={cn(CHAMP, "mt-1 h-10 font-normal")} />
        </label>
        <label className="text-xs font-bold text-foreground">
          Courriel
          <input
            name="courriel"
            type="email"
            required
            placeholder="personne@exemple.ca"
            className={cn(CHAMP, "mt-1 h-10 font-normal")}
          />
        </label>
        <label className="text-xs font-bold text-foreground">
          Téléphone
          <input name="telephone" className={cn(CHAMP, "mt-1 h-10 font-normal")} />
        </label>
        <label className="text-xs font-bold text-foreground">
          {mode === "prospect" ? "Type de visa envisagé" : "Programme"}
          <input
            name={mode === "prospect" ? "visa" : "programme"}
            defaultValue={program ?? ""}
            className={cn(CHAMP, "mt-1 h-10 font-normal")}
          />
        </label>
        <label className="text-xs font-bold text-foreground sm:col-span-2">
          {mode === "prospect" ? "Notes" : "Motif d'admission"}
          <textarea
            name={mode === "prospect" ? "notes" : "motif"}
            rows={2}
            defaultValue={notes ?? ""}
            className={cn(CHAMP, "mt-1 font-normal")}
          />
        </label>
      </div>

      {mode === "client" && (
        <p className="mt-3 rounded-lg bg-warning/10 px-3 py-2 text-[11px] font-medium text-foreground">
          Créer un client correspond à l&apos;ouverture d&apos;un mandat. Si l&apos;entente
          n&apos;est pas signée, créez plutôt un prospect.
        </p>
      )}

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

      <div className="mt-4 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => { setMode(null); setResultat(null) }}
          className="min-h-10 rounded-xl px-3 py-2 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={enCours}
          className="min-h-10 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {enCours ? "Création…" : mode === "prospect" ? "Créer le prospect" : "Créer le client"}
        </button>
      </div>
    </form>
  )
}
