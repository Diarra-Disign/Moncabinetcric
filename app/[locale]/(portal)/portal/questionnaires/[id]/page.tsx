import { getTranslations, setRequestLocale } from "next-intl/server"
import { getClientQuestionnaireById } from "@/lib/data/queries"
import { getTemplateByType } from "@/lib/data/questionnaire-templates"
import { getCurrentPortalClient } from "@/lib/supabase/session"
import { QuestionnaireClient } from "./questionnaire-client"
import { ArrowLeft } from "lucide-react"

export default async function QuestionnaireDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params
  setRequestLocale(locale)

  const t = await getTranslations("Portal")

  // Récupérer le client connecté pour validation
  const portalClient = await getCurrentPortalClient()
  const isApercu = !portalClient

  let q = null
  if (isApercu && id.startsWith("q-demo-")) {
    // Mode démo / aperçu pour le consultant
    q = {
      id,
      firmId: "firm-1",
      clientId: "client-1",
      matterId: "matter-1",
      title: "Questionnaire — Demande de permis d'études (Aperçu)",
      formType: "study_permit" as const,
      status: "in_progress" as const,
      progress: 45,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      answers: {},
      corrections: [],
      history: [],
    }
  } else {
    q = await getClientQuestionnaireById(id)
  }

  if (!q) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <h1 className="text-xl font-black text-foreground">Questionnaire introuvable</h1>
        <p className="text-sm text-muted-foreground">Ce questionnaire n&apos;existe pas ou vous n&apos;avez pas les autorisations pour le lire.</p>
        <a href={`/${locale}`} className="inline-flex items-center gap-1.5 text-xs text-primary font-bold hover:underline">
          <ArrowLeft className="h-4 w-4" /> Retour au portail
        </a>
      </div>
    )
  }

  const template = getTemplateByType(q.formType)

  if (!template) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <h1 className="text-xl font-black text-foreground">Modèle introuvable</h1>
        <p className="text-sm text-muted-foreground">La structure de ce formulaire n&apos;est pas supportée.</p>
        <a href={`/${locale}`} className="inline-flex items-center gap-1.5 text-xs text-primary font-bold hover:underline">
          <ArrowLeft className="h-4 w-4" /> Retour au portail
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <a
          href={`/${locale}`}
          className="p-2 rounded-xl border border-border hover:bg-muted text-muted-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </a>
        <div>
          <span className="text-[10px] uppercase font-black tracking-wider text-muted-foreground">Portail Client</span>
          <h1 className="text-xl font-black text-foreground">{q.title}</h1>
        </div>
      </div>

      <QuestionnaireClient
        questionnaire={q}
        template={template}
        locale={locale}
        isApercu={isApercu}
      />
    </div>
  )
}
