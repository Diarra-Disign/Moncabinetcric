import { getTranslations } from "next-intl/server"
import { MattersClient } from "./matters-client"
import { getMatters } from "@/lib/data"

export default async function MattersPage() {
  const tMatters = await getTranslations("Matters")
  const initialMatters = await getMatters()

  const translations = {
    title: tMatters("title"),
    subtitle: tMatters("subtitle"),
    newMatter: tMatters("newMatter"),
    categories: {
      pr: tMatters("categories.pr"),
      prSub: tMatters("categories.prSub"),
      work: tMatters("categories.work"),
      workSub: tMatters("categories.workSub"),
      study: tMatters("categories.study"),
      studySub: tMatters("categories.studySub"),
      appeal: tMatters("categories.appeal"),
      appealSub: tMatters("categories.appealSub"),
    },
    filters: {
      all: tMatters("filters.all"),
      valid: tMatters("filters.valid"),
      alert: tMatters("filters.alert"),
      review: tMatters("filters.review"),
      searchPlaceholder: tMatters("filters.searchPlaceholder"),
    },
    table: {
      id: tMatters("table.id"),
      client: tMatters("table.client"),
      program: tMatters("table.program"),
      openedDate: tMatters("table.openedDate"),
      deadline: tMatters("table.deadline"),
      rcic: tMatters("table.rcic"),
      status: tMatters("table.status"),
      actions: tMatters("table.actions"),
    },
    statusLabels: {
      valid: tMatters("statusLabels.valid"),
      alert: tMatters("statusLabels.alert"),
      review: tMatters("statusLabels.review"),
      pending: tMatters("statusLabels.pending"),
    },
    widgets: {
      complianceTitle: tMatters("widgets.complianceTitle"),
      validDocs: tMatters("widgets.validDocs"),
      pendingReview: tMatters("widgets.pendingReview"),
      alertBanner: tMatters("widgets.alertBanner"),
      distributionTitle: tMatters("widgets.distributionTitle"),
      totalActive: tMatters("widgets.totalActive"),
      totalActiveLabel: tMatters("widgets.totalActiveLabel"),
      prShare: tMatters("widgets.prShare"),
      workShare: tMatters("widgets.workShare"),
      studyShare: tMatters("widgets.studyShare"),
      appealShare: tMatters("widgets.appealShare"),
    },
  }

  return <MattersClient t={translations} initialMatters={initialMatters} />
}

