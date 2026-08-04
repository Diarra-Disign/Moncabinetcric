import { getTranslations, setRequestLocale } from "next-intl/server"
import { getDeadlines, getCiccComplianceScore, getMatters, getDocuments } from "@/lib/data/queries"
import { DashboardClient } from "./dashboard-client"

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  
  const [tDashboard, deadlines, complianceScore, matters, documents] = await Promise.all([
    getTranslations("Dashboard"),
    getDeadlines(),
    getCiccComplianceScore(),
    getMatters(),
    getDocuments()
  ])

  // Les indicateurs affichaient 45 dossiers et 421 pièces en dur, quel que
  // soit le contenu réel du cabinet. Ils sont désormais comptés.
  const counts = {
    activeMatters: matters.filter((m) => m.status !== "pending").length,
    verifiedDocuments: documents.filter((d) => d.status === "valid").length,
    totalDocuments: documents.length,
  }

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
      counts={counts}
    />
  )
}
