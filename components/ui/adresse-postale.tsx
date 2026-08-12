"use client"

import * as React from "react"
import { PROVINCES } from "@/lib/data/adresse"
import { cn } from "@/lib/utils"

/**
 * La saisie d'une adresse postale, unique pour toute l'application.
 *
 * Même raison que le sélecteur de civilité, et elle n'est pas l'économie de
 * lignes : deux formulaires d'adresse écrits séparément finissent par proposer
 * un champ « Province » libre d'un côté et une liste de l'autre, puis à
 * enregistrer « QC » et « Québec » pour la même province. C'est ce texte-là qui
 * s'imprime sur l'entente de service.
 *
 * FACULTATIVE À LA SAISIE, EXIGÉE À LA GÉNÉRATION. On ne demande pas son
 * adresse à quelqu'un qu'on vient d'avoir au téléphone. Mais la place existe
 * dès le prospect, parce que c'est le moment où on l'apprend — et la refuser
 * là obligerait à la retaper au moment du contrat, ce que le §30 interdit.
 *
 * Le pays vaut Canada par défaut : c'est la réponse dans la grande majorité
 * des cas, et elle reste modifiable.
 */

export interface ValeursAdresse {
  address: string
  addressLine2: string
  city: string
  province: string
  postalCode: string
  country: string
}

export const ADRESSE_VIDE: ValeursAdresse = {
  address: "", addressLine2: "", city: "", province: "", postalCode: "", country: "Canada",
}

const CHAMP =
  "w-full px-3.5 py-2.5 text-xs font-medium rounded-xl bg-muted/50 border border-border " +
  "focus:bg-card focus:border-primary focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-primary transition-all text-foreground"

const ETIQUETTE = "text-[11px] font-bold text-muted-foreground"

export function ChampsAdresse({
  valeurs,
  onChange,
  prefixe = "adr",
  className,
}: {
  valeurs: ValeursAdresse
  onChange: (v: ValeursAdresse) => void
  /** Préfixe des identifiants : deux adresses sur un même écran ne doivent pas
   *  partager leurs `id`, sinon cliquer une étiquette met le focus ailleurs. */
  prefixe?: string
  className?: string
}) {
  const maj = (champ: keyof ValeursAdresse, v: string) => onChange({ ...valeurs, [champ]: v })

  return (
    <div className={cn("grid gap-3 sm:grid-cols-2", className)}>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <label htmlFor={`${prefixe}-rue`} className={ETIQUETTE}>Numéro et rue</label>
        <input
          id={`${prefixe}-rue`}
          type="text"
          value={valeurs.address}
          onChange={(e) => maj("address", e.target.value)}
          placeholder="456, rue Exemple"
          className={CHAMP}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${prefixe}-complement`} className={ETIQUETTE}>
          Appartement, bureau, unité
        </label>
        <input
          id={`${prefixe}-complement`}
          type="text"
          value={valeurs.addressLine2}
          onChange={(e) => maj("addressLine2", e.target.value)}
          placeholder="Appartement 4"
          className={CHAMP}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${prefixe}-ville`} className={ETIQUETTE}>Ville</label>
        <input
          id={`${prefixe}-ville`}
          type="text"
          value={valeurs.city}
          onChange={(e) => maj("city", e.target.value)}
          placeholder="Montréal"
          className={CHAMP}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${prefixe}-province`} className={ETIQUETTE}>Province ou territoire</label>
        {/* Une LISTE et non un champ libre. Hors Canada, on saisit la région
            dans « Ville » : offrir un champ libre ici ferait cohabiter des
            provinces canadiennes et des états étrangers dans la même colonne. */}
        <select
          id={`${prefixe}-province`}
          value={valeurs.province}
          onChange={(e) => maj("province", e.target.value)}
          className={CHAMP}
        >
          <option value="">Non précisée</option>
          {PROVINCES.map((p) => (
            <option key={p.valeur} value={p.valeur}>{p.fr}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${prefixe}-code`} className={ETIQUETTE}>Code postal</label>
        <input
          id={`${prefixe}-code`}
          type="text"
          value={valeurs.postalCode}
          onChange={(e) => maj("postalCode", e.target.value)}
          placeholder="H2X 1B2"
          className={cn(CHAMP, "font-mono uppercase")}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${prefixe}-pays`} className={ETIQUETTE}>Pays</label>
        <input
          id={`${prefixe}-pays`}
          type="text"
          value={valeurs.country}
          onChange={(e) => maj("country", e.target.value)}
          className={CHAMP}
        />
      </div>
    </div>
  )
}
