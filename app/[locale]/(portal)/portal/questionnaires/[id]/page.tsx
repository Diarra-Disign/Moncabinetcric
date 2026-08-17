import { getTranslations, setRequestLocale } from "next-intl/server"
import { getClientQuestionnaireById } from "@/lib/data/queries"
import { getTemplateBySlug } from "@/lib/data/questionnaire-templates"
import { getCurrentPortalClient, getSessionSupabase } from "@/lib/supabase/session"
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
  } else if (portalClient) {
    // Les clients du portail n'ont pas de session de membre de cabinet (pas de profil
    // dans `profiles`). On interroge donc directement le client Supabase de session :
    // les politiques RLS `client_questionnaires_portal` vérifient `is_portal_client()`
    // et `client_id = current_client_id()`.
    const supabase = await getSessionSupabase()
    const { data: row, error } = await supabase
      .from("client_questionnaires")
      .select("*, matters(reference), clients(legacy_id, name, email), leads(legacy_id, name, email)")
      .eq("id", id)
      .maybeSingle()

    if (row && !error) {
      q = {
        id: String(row.id),
        firmId: String(row.firm_id),
        clientId: String(row.client_id ?? ""),
        matterId: row.matter_id ? String(row.matter_id) : undefined,
        title: String(row.title ?? ""),
        sections: (row.sections ?? []) as ClientQuestionnaire["sections"],
        message: String(row.message ?? ""),
        status: String(row.status ?? "draft") as ClientQuestionnaire["status"],
        statusAffiche: String(row.status ?? "draft") as ClientQuestionnaire["statusAffiche"],
        progress: Number(row.progress ?? 0),
        reminderCount: Number(row.reminder_count ?? 0),
        createdAt: String(row.created_at ?? ""),
        updatedAt: String(row.updated_at ?? ""),
        lastSavedAt: row.last_saved_at ? String(row.last_saved_at) : undefined,
        submittedAt: row.submitted_at ? String(row.submitted_at) : undefined,
        answers: (row.answers ?? {}) as Record<string, unknown>,
        prefill: (row.prefill ?? {}) as Record<string, unknown>,
        corrections: (row.corrections ?? []) as ClientQuestionnaire["corrections"],
        history: (row.history ?? []) as ClientQuestionnaire["history"],
        lienActif: false,
      }
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
