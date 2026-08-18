import { getTranslations, setRequestLocale } from "next-intl/server"
import { getDeadlines, getCiccComplianceScore, getMatters, getDocuments } from "@/lib/data/queries"
import { listerDossiersRecents } from "@/lib/data/dossiers-recents"
import { construireRecherche } from "@/lib/data/recherche"
import { DashboardClient } from "./dashboard-client"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  
  // La première page des dossiers récents est rendue par le SERVEUR : l'écran
  // les affiche au premier rendu, sans appel supplémentaire. L'index de
  // recherche vient de construireRecherche(), la même source que la barre du
  // haut — le tableau de bord en tenait une seconde, déclarée vide, qui
  // répondait « aucun résultat » quoi qu'on tape.
  const [tDashboard, deadlines, complianceScore, matters, documents, dossiersRecents, indexRecherche] =
    await Promise.all([
      getTranslations("Dashboard"),
      getDeadlines(),
      getCiccComplianceScore(),
      getMatters(),
      getDocuments(),
      listerDossiersRecents({ limite: 8 }),
      construireRecherche(),
    ])

  // La répartition des programmes annonçait « 25 dossiers (55%) » avec des
  // barres figées à 55/27/18 — les mêmes pour tout cabinet, y compris celui
  // qui n'a aucun dossier. Elle est désormais COMPTÉE, et se tait quand il n'y
  // a rien à compter.
  const parProgramme = new Map<string, number>()
  for (const m of matters) {
    const nom = (m.program ?? "").trim() || "Programme non précisé"
    parProgramme.set(nom, (parProgramme.get(nom) ?? 0) + 1)
  }
  const repartition = [...parProgramme.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([programme, nombre]) => ({
      programme,
      nombre,
      // Sur le total du cabinet, et non sur les cinq retenus : un pourcentage
      // qui somme à 100 % en cachant la queue de la liste ment sur la part.
      pourcentage: matters.length ? Math.round((nombre / matters.length) * 100) : 0,
    }))

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
      dossiersRecents={dossiersRecents}
      repartition={repartition}
      indexRecherche={indexRecherche}
    />
  )
}
