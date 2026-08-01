import { getTranslations, setRequestLocale } from "next-intl/server"
import { getDeadlines, getCiccComplianceScore } from "@/lib/data/queries"
import { DashboardClient } from "./dashboard-client"

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  
  const [tDashboard, deadlines, complianceScore] = await Promise.all([
    getTranslations("Dashboard"),
    getDeadlines(),
    getCiccComplianceScore()
  ])

  const t = {
    title: tDashboard("title"),
    activeMattersSub: tDashboard("activeMattersSub"),
    expiredDocsSub: tDashboard("expiredDocsSub"),
    validatedDocsSub: tDashboard("validatedDocsSub"),
    recentDocsTitle: tDashboard("recentDocsTitle"),
    recentDocsDesc: tDashboard("recentDocsDesc"),
    storageTitle: tDashboard("storageTitle"),
  }

  return (
    <DashboardClient 
      t={t} 
      deadlines={deadlines}
      complianceScore={complianceScore}
    />
  )
}
