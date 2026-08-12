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
/**
 * ─── LA COPIE DANS LE NAVIGATEUR EST SUPPRIMÉE ─────────────────────────────
 *
 * Ce fournisseur relisait `localStorage.cric_firm_settings` et le réappliquait
 * PAR-DESSUS l'identité venue du serveur, à chaque montage et à chaque
 * événement « cric-firm-updated ».
 *
 * Elle ne couvrait que SEPT champs : nom, permis, consultant, rue, téléphone,
 * courriel, logo. Conséquence exacte du défaut signalé — quand l'écriture en
 * base échouait (ce qu'elle faisait en silence pour tout membre non
 * propriétaire), ces sept-là « persistaient » depuis le navigateur, tandis que
 * la VILLE, la PROVINCE, le CODE POSTAL et le NUMÉRO DE BUREAU, absents de la
 * copie, disparaissaient au rechargement.
 *
 * Une moitié de la fiche tenait, l'autre s'effaçait. Et la moitié qui tenait
 * ne venait pas de la base : elle venait du poste de travail. Sur un autre
 * ordinateur, tout avait disparu.
 *
 * Il n'y a plus qu'une source de vérité : la table `firms`, lue par le layout
 * applicatif à chaque rendu serveur (§16).
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
