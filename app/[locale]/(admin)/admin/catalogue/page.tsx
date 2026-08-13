import type { Metadata } from "next"
import { getCatalogue } from "@/lib/billing/catalogue"
import {
  getFonctionnalites,
  getMatriceForfaits,
  getExceptions,
  getJournalExploitant,
} from "@/lib/data/catalogue-reads"
import { getCabinetsPourChoix } from "@/lib/data/admin"
import { CatalogueClient } from "./catalogue-client"

export const metadata: Metadata = {
  title: "Catalogue — forfaits et fonctionnalités",
  robots: { index: false, follow: false },
}

/**
 * Console du catalogue.
 *
 * Elle remplace ce qui n'existait que dans un onglet de navigateur : le hub
 * financier proposait « Gérer / Modifier / Ajouter les Forfaits » et des codes
 * promo, entièrement en état React. Rien n'était enregistré, et un prix modifié
 * revenait à sa valeur d'origine au premier rafraîchissement.
 *
 * Tout ce qui s'affiche ici vient de `plan_limits`, `features`,
 * `plan_features`, `firm_feature_overrides` et `platform_audit`, et tout ce qui
 * s'y modifie y retourne.
 */
export default async function CataloguePage() {
  const [plans, fonctionnalites, matrice, exceptions, cabinets, journal] = await Promise.all([
    getCatalogue(),
    getFonctionnalites(),
    getMatriceForfaits(),
    getExceptions(),
    // Le sélecteur n'a besoin que du nom et du forfait : `getAdminFirms()`
    // chargeait ici les membres, les abonnements et l'état d'accès de chaque
    // cabinet pour remplir un menu déroulant.
    getCabinetsPourChoix(),
    getJournalExploitant(),
  ])

  return (
    <CatalogueClient
      plans={plans}
      fonctionnalites={fonctionnalites}
      matrice={matrice}
      exceptions={exceptions}
      cabinets={cabinets}
      journal={journal}
    />
  )
}
