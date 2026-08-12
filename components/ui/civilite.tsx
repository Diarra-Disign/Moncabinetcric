"use client"

import * as React from "react"
import { CIVILITES, type Civilite } from "@/lib/data/identite"
import { cn } from "@/lib/utils"

/**
 * Le sélecteur de civilité, unique pour toute l'application.
 *
 * Le brief demandait « un composant standard de civilité, réutilisable ». La
 * raison n'est pas l'économie de lignes : c'est qu'une seconde liste écrite
 * ailleurs finirait par proposer « M. » là où la première propose « Monsieur »,
 * et la base recevrait deux vocabulaires pour la même question.
 *
 * Facultatif par défaut, et c'est délibéré. On ne connaît pas toujours la
 * civilité d'un prospect au premier appel — imposer le champ ferait inventer
 * une réponse, ce qui est pire que l'absence : « Monsieur » posé au hasard
 * finit imprimé sur une entente de service.
 */
export function SelecteurCivilite({
  valeur,
  onChange,
  id = "civilite",
  requis = false,
  className,
}: {
  valeur: Civilite | "" | null | undefined
  onChange: (v: Civilite | "") => void
  id?: string
  requis?: boolean
  className?: string
}) {
  return (
    <select
      id={id}
      required={requis}
      aria-label="Civilité"
      value={valeur ?? ""}
      onChange={(e) => onChange(e.target.value as Civilite | "")}
      className={cn(
        "w-full px-3.5 py-2.5 text-xs font-medium rounded-xl bg-muted/50 border border-border",
        "focus:bg-card focus:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-all",
        className
      )}
    >
      <option value="">{requis ? "Choisir…" : "Non précisée"}</option>
      {CIVILITES.map((c) => (
        <option key={c.valeur} value={c.valeur}>{c.fr}</option>
      ))}
    </select>
  )
}
