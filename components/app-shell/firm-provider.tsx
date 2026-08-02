"use client"

import * as React from "react"
import { EMPTY_FIRM, type FirmIdentity } from "@/lib/data/firm"

const FirmContext = React.createContext<FirmIdentity>(EMPTY_FIRM)

/**
 * Diffuse l'identité du cabinet à tous les écrans.
 *
 * Elle est lue une seule fois côté serveur, dans le layout applicatif, puis
 * transmise ici. Les composants clients n'ont donc ni à la coder en dur, ni
 * à la recharger.
 */
export function FirmProvider({
  firm,
  children,
}: {
  firm: FirmIdentity
  children: React.ReactNode
}) {
  return <FirmContext.Provider value={firm}>{children}</FirmContext.Provider>
}

export function useFirm(): FirmIdentity {
  return React.useContext(FirmContext)
}

/**
 * Identité du cabinet formatée pour les en-têtes de documents officiels.
 *
 * Renvoie des chaînes vides plutôt que des substituts : mieux vaut une
 * ligne absente sur une entente qu'un numéro de permis inventé.
 */
export function useFirmLetterhead() {
  const firm = useFirm()
  return {
    ...firm,
    /** « Cabinet X — CICC n° R-123456 », ou juste le nom si le permis manque. */
    titleLine: [firm.name, firm.rcicNumber && `CICC n° ${firm.rcicNumber}`]
      .filter(Boolean)
      .join(" — "),
    isComplete: Boolean(firm.name && firm.rcicNumber && firm.rcicName),
  }
}
