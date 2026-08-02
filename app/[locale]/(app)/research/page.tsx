import { getTranslations } from "next-intl/server"
import { getLegislationProvisions, getResearchWorkspaces, getMatters } from "@/lib/data"
import { ResearchClient } from "./research-client"

export default async function ResearchPage() {
  await getTranslations("Research")
  const initialProvisions = await getLegislationProvisions()
  const initialWorkspaces = await getResearchWorkspaces()
  const initialMatters = await getMatters()

  return (
    <ResearchClient
      initialProvisions={initialProvisions}
      initialWorkspaces={initialWorkspaces}
      initialMatters={initialMatters}
    />
  )
}
