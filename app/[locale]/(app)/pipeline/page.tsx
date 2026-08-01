import { getTranslations } from "next-intl/server"
import { PipelineClient } from "./pipeline-client"
import { getLeads } from "@/lib/data"

export default async function PipelinePage() {
  const tPipeline = await getTranslations("Pipeline")
  const initialLeads = await getLeads()

  const translations = {
    title: tPipeline("title"),
    subtitle: tPipeline("subtitle"),
    stats: {
      totalValue: tPipeline("stats.totalValue"),
      activeLeads: tPipeline("stats.activeLeads"),
      conversionRate: tPipeline("stats.conversionRate"),
      b2bShare: tPipeline("stats.b2bShare"),
    },
    filters: {
      all: tPipeline("filters.all"),
      b2b: tPipeline("filters.b2b"),
      b2c: tPipeline("filters.b2c"),
      searchPlaceholder: tPipeline("filters.searchPlaceholder"),
    },
    columns: {
      newLead: tPipeline("columns.newLead"),
      consultation: tPipeline("columns.consultation"),
      proposal: tPipeline("columns.proposal"),
      negotiation: tPipeline("columns.negotiation"),
      signed: tPipeline("columns.signed"),
    },
    actions: {
      newProspect: tPipeline("actions.newProspect"),
      convertToMatter: tPipeline("actions.convertToMatter"),
      viewDetails: tPipeline("actions.viewDetails"),
      sendReminder: tPipeline("actions.sendReminder"),
      moveRight: tPipeline("actions.moveRight"),
      moveLeft: tPipeline("actions.moveLeft"),
    },
    badges: {
      b2b: tPipeline("badges.b2b"),
      b2c: tPipeline("badges.b2c"),
      scoreHigh: tPipeline("badges.scoreHigh"),
      scoreMed: tPipeline("badges.scoreMed"),
      scoreLow: tPipeline("badges.scoreLow"),
    },
  }

  return <PipelineClient t={translations} initialLeads={initialLeads} />
}
