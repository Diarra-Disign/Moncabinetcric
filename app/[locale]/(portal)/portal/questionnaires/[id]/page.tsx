import { getTranslations, setRequestLocale } from "next-intl/server"
import { getClientQuestionnaireById } from "@/lib/data/queries"
import { getTemplateBySlug } from "@/lib/data/questionnaire-templates"
import { getCurrentPortalClient } from "@/lib/supabase/session"
import type { ClientQuestionnaire } from "@/lib/data/types"
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

  // L'aperçu du consultant emprunte le catalogue de départ : c'est le seul
  // endroit où le code a encore le droit de connaître un modèle par son nom,
  // parce qu'aucun envoi réel ne lui correspond.
  let q: ClientQuestionnaire | null | undefined = null
  if (isApercu && id.startsWith("q-demo-")) {
    const modele = getTemplateBySlug("study_permit")
    q = {
      id,
      firmId: "firm-1",
      clientId: "client-1",
      title: `${modele?.titleFr ?? "Questionnaire"} (Aperçu)`,
      sections: (modele?.sections ?? []) as ClientQuestionnaire["sections"],
      message: "",
      status: "in_progress",
      statusAffiche: "in_progress",
      progress: 45,
      reminderCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      answers: {},
      prefill: {},
      corrections: [],
      history: [],
      lienActif: false,
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

  // Les questions viennent du questionnaire lui-même, pas d'un modèle relu
  // maintenant : c'est ce qui garantit qu'un remaniement du modèle ne déplace
  // pas les champs sous les réponses déjà saisies.
  if (q.sections.length === 0) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <h1 className="text-xl font-black text-foreground">Questionnaire vide</h1>
        <p className="text-sm text-muted-foreground">Ce questionnaire ne comporte aucune question. Contactez votre cabinet.</p>
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
        locale={locale}
        isApercu={isApercu}
      />
    </div>
  )
}
