import React from "react"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { notFound } from "next/navigation"
import { Link } from "@/i18n/routing"
import { 
  getMatterById, 
  getProgramByName, 
  getAuditLogsForMatter,
  getClientQuestionnairesByMatterId
} from "@/lib/data"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  ArrowLeft, 
  User, 
  Calendar, 
  ShieldCheck, 
  Clock, 
  Award,
} from "lucide-react"
import { DossierOnglets } from "./dossier-onglets"
import { getDossierComplet } from "@/lib/data/matter-file"

export default async function MatterDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params
  setRequestLocale(locale)

  const t = await getTranslations("MatterDetail")
  const tMatters = await getTranslations("Matters")
  const isFr = locale === "fr"

  const matter = await getMatterById(id)
  if (!matter) {
    notFound()
  }

  const program = await getProgramByName(matter.program)
  const dossier = await getDossierComplet(id, locale).catch(() => null)

  // Les clients du cabinet, pour rattacher un dossier qui n'en a pas. Lus
  // sous RLS : la liste ne peut contenir que des clients du même cabinet.
  const { getSessionSupabase, getCurrentMember } = await import("@/lib/supabase/session")
  const [member, clientsRes] = await Promise.all([
    getCurrentMember(),
    (await getSessionSupabase()).from("clients").select("id, name, file_number").order("name")
  ])
  const clientsBruts = clientsRes.data
  // profileId et non userId : c'est le profil qui désigne l'auteur d'une
  // action dans tout le reste de l'application (received_by, verified_by,
  // recorded_by). Le journal des questionnaires doit parler la même langue,
  // sans quoi deux identifiants coexisteraient pour la même personne.
  const consultant = member ? { id: member.profileId, name: member.fullName || member.email } : { id: "user-1", name: "Consultant" }

  const clientsDuCabinet = (clientsBruts ?? []).map((c) => ({
    id: String(c.id),
    nom: String(c.name ?? ""),
    dossier: String(c.file_number ?? ""),
  }))
  // Le pourcentage vient des pièces RÉELLEMENT vérifiées.
  const completionPct = dossier?.progression.pourcentage ?? 0
  const auditLogs = getAuditLogsForMatter(matter.id)
  const clientQuestionnaires = dossier ? await getClientQuestionnairesByMatterId(dossier.matterId) : []

  // La bibliothèque du cabinet, pour envoyer un questionnaire sans quitter le
  // dossier (§8). Les modèles système y figurent aussi : un cabinet qui n'a
  // rien créé doit tout de même avoir quelque chose à envoyer.
  const { listerModeles } = await import("@/lib/data/questionnaires")
  const modeles = (await listerModeles()).map((m) => ({ id: m.id, titleFr: m.titleFr }))

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "valid":
        return <Badge variant="success" className="bg-emerald-100 text-emerald-800 border-emerald-200">{tMatters("status.valid")}</Badge>
      case "alert":
        return <Badge variant="destructive" className="bg-rose-100 text-rose-800 border-rose-200">{tMatters("status.alert")}</Badge>
      case "review":
        return <Badge variant="warning" className="bg-amber-100 text-amber-800 border-amber-200">{tMatters("status.review")}</Badge>
      case "pending":
        return <Badge variant="secondary">{tMatters("status.pending")}</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top bar with back navigation */}
      <div className="flex items-center justify-between">
        <Link 
          href="/matters" 
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {isFr ? "Retour aux dossiers" : "Back to matters"}
        </Link>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="font-mono text-xs px-3 py-1 border-primary/20 text-primary bg-primary/5">
            {matter.id}
          </Badge>
          {matter.isPriority && (
            <Badge variant="destructive" className="animate-pulse">
              ★ {isFr ? "Prioritaire" : "Priority"}
            </Badge>
          )}
        </div>
      </div>

      {/* ================================================================
          BANDEAU CLIENT — Le nom du client est la première chose que l'on
          voit en ouvrant un dossier. C'est la réponse à « à qui
          appartient ce dossier ? » et elle ne doit jamais être ambiguë.
          ================================================================ */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        {/* Barre d'accent supérieure */}
        <div className="h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/40" />

        <div className="p-5 sm:p-6">
          {/* Ligne principale : nom + statut */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black text-lg shrink-0">
                <User className="h-5.5 w-5.5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground leading-tight">
                  {matter.clientName}
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                  <Award className="h-3.5 w-3.5 text-primary shrink-0" />
                  {isFr ? program?.nameFr || matter.program : program?.nameEn || matter.program}
                </p>
              </div>
            </div>
            {getStatusBadge(matter.status)}
          </div>

          {/* Ligne secondaire : métadonnées clés */}
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground border-t border-border pt-4">
            <span className="inline-flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              {t("rcicResponsible")}: <strong className="text-foreground">{matter.rcic}</strong>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-amber-500" />
              {t("deadline")}: <strong className="font-mono text-foreground">{matter.deadline}</strong>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-primary" />
              {isFr ? "Ouvert le" : "Opened"}: <strong className="font-mono text-foreground">{matter.openedDate}</strong>
            </span>
            <span className="inline-flex items-center gap-1.5 font-bold text-primary">
              {completionPct}% {t("checklistComplete")}
            </span>
          </div>

          {/* Barre de progression */}
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div 
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${completionPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* ================================================================
          DOSSIER ONGLETS — Le centre de contrôle unique du dossier :
          documents, formulaires, facturation, paiements, échéances,
          portail client, et argumentaire IRCC (lettre IA).
          ================================================================ */}
      {dossier && (
        <DossierOnglets
          dossier={dossier}
          matterId={dossier.matterId}
          clientId={dossier.clientId}
          statutDossier={matter.status}
          clientsDuCabinet={clientsDuCabinet}
          clientQuestionnaires={clientQuestionnaires}
          modeles={modeles}
          consultant={consultant}
          clientName={matter.clientName}
          programName={matter.program}
        />
      )}

      {/* Journal d'Audit CICC — Conservé car c'est la seule section non
          dupliquée dans DossierOnglets et utile pour la conformité. */}
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
            <ShieldCheck className="h-5 w-5 text-amber-600" />
            {t("auditLog")}
          </CardTitle>
          <CardDescription className="text-xs">
            {t("auditDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {auditLogs.map((log) => (
              <div key={log.id} className="relative pl-6 pb-4 border-l border-amber-500/30 last:pb-0">
                <div className="absolute -left-1.5 top-0.5 h-3 w-3 rounded-full bg-amber-500" />
                <div className="text-xs font-mono text-muted-foreground">{log.timestamp}</div>
                <p className="text-xs font-medium text-foreground mt-0.5">
                  {isFr ? log.actionFr : log.actionEn}
                </p>
                <span className="text-[10px] text-muted-foreground block mt-1">
                  {log.author}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
