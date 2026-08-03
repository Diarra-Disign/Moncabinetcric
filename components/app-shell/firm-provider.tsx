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
  const [currentFirm, setCurrentFirm] = React.useState<FirmIdentity>(firm)
  const [prevPropFirm, setPrevPropFirm] = React.useState<FirmIdentity>(firm)

  if (firm !== prevPropFirm) {
    setPrevPropFirm(firm)
    setCurrentFirm(firm)
  }

  React.useEffect(() => {
    const applySavedSettings = () => {
      const saved = localStorage.getItem("cric_firm_settings")
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          setCurrentFirm(prev => ({
            ...prev,
            name: parsed.companyName || prev.name,
            rcicNumber: parsed.rcicNumber || prev.rcicNumber,
            rcicName: parsed.rcicName || prev.rcicName,
            address: parsed.address || prev.address,
            phone: parsed.phone || prev.phone,
            email: parsed.email || prev.email,
            logoUrl: parsed.logoUrl !== undefined ? parsed.logoUrl : prev.logoUrl,
          }))
        } catch {
          // Ignore parse errors
        }
      }
    }

    applySavedSettings()

    const handleFirmUpdate = () => applySavedSettings()
    window.addEventListener("cric-firm-updated", handleFirmUpdate)
    return () => window.removeEventListener("cric-firm-updated", handleFirmUpdate)
  }, [])

  return <FirmContext.Provider value={currentFirm}>{children}</FirmContext.Provider>
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
