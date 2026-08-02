import { getTranslations } from "next-intl/server"
import { searchLegislation, getResearchWorkspaces, getMatters, LEGISLATION_PAGE_SIZE } from "@/lib/data"
import { ResearchClient } from "./research-client"

export default async function ResearchPage() {
  await getTranslations("Research")

  // Seule la première tranche est rendue côté serveur. Le corpus complet
  // (618 dispositions, environ 1,4 Mo) ne doit jamais être sérialisé vers
  // le navigateur : la recherche est exécutée par une action serveur.
  const initial = await searchLegislation("", "all", LEGISLATION_PAGE_SIZE)
  const initialWorkspaces = await getResearchWorkspaces()
  const initialMatters = await getMatters()

  return (
    <ResearchClient
      initialProvisions={initial.items}
      initialTotal={initial.total}
      initialWorkspaces={initialWorkspaces}
      initialMatters={initialMatters}
    />
  )
}
