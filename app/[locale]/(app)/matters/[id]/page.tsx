import React from "react"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { notFound } from "next/navigation"
import { Link } from "@/i18n/routing"
import { 
  getMatterById, 
  getProgramByName, 
  generateChecklistForProgram, 
  calculateCompletionPercentage, 
  getDocumentsByMatterId, 
  getInvoicesByMatterId, 
  getAuditLogsForMatter 
} from "@/lib/data"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  ArrowLeft, 
  FolderOpen, 
  User, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  DollarSign, 
  ShieldCheck, 
  Clock, 
  Award,
  FileCheck2,
  ExternalLink
} from "lucide-react"
import { DirectActionsTabs } from "./direct-actions-tabs"
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
  const checklist = generateChecklistForProgram(matter.program)
  const dossier = await getDossierComplet(id, locale).catch(() => null)

  // Les clients du cabinet, pour rattacher un dossier qui n'en a pas. Lus
  // sous RLS : la liste ne peut contenir que des clients du même cabinet.
  const { getSessionSupabase } = await import("@/lib/supabase/session")
  const { data: clientsBruts } = await (await getSessionSupabase())
    .from("clients").select("id, name, file_number").order("name")
  const clientsDuCabinet = (clientsBruts ?? []).map((c) => ({
    id: String(c.id),
    nom: String(c.name ?? ""),
    dossier: String(c.file_number ?? ""),
  }))
  // Le pourcentage vient des pièces RÉELLEMENT vérifiées.
  //
  // calculateCompletionPercentage() compte les defaultStatus du modèle de
  // programme, qui valent « valid » pour la plupart : un dossier vide
  // s'affichait « 71 % complété » à côté d'un encadré rouge annonçant sept
  // pièces manquantes. Deux nombres contradictoires sur le même écran sont
  // pires qu'un seul faux — on croit celui qui rassure.
  const completionPct = dossier?.progression.pourcentage ?? 0
  const docs = await getDocumentsByMatterId(matter.id)
  const invoices = await getInvoicesByMatterId(matter.id)
  const auditLogs = getAuditLogsForMatter(matter.id)

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
    <div className="space-y-8 pb-12">
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

      {/* Main Header Card */}
      <Card className="border-l-4 border-l-primary shadow-md overflow-hidden bg-gradient-to-r from-card to-primary/5">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                  {t("headerTitle")}
                </span>
                {getStatusBadge(matter.status)}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
                {matter.clientName}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground pt-1">
                <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                  <Award className="h-4 w-4 text-primary" />
                  {isFr ? program?.nameFr || matter.program : program?.nameEn || matter.program}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <User className="h-4 w-4 text-muted-foreground" />
                  {t("rcicResponsible")}: <strong className="text-foreground">{matter.rcic}</strong>
                </span>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 border-t md:border-t-0 pt-4 md:pt-0">
              <div className="text-left sm:text-right">
                <span className="text-xs text-muted-foreground block">{t("deadline")}</span>
                <span className="text-base font-bold font-mono text-foreground flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-amber-500" />
                  {matter.deadline}
                </span>
              </div>
              <Link href="/matters">
                <Button className="w-full sm:w-auto font-semibold shadow-sm">
                  {isFr ? "Gérer le dossier" : "Manage Matter"}
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid of Sections */}
      <div className="grid gap-8 lg:grid-cols-3">
        
        {/* Left Column (2/3 width on large screens): Timeline, Checklist, Meeting Notes, Documents */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Section 1: IRCC / MIFI Timeline & Program Specs */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Clock className="h-5 w-5 text-primary" />
                    {t("timelineTitle")}
                  </CardTitle>
                  <CardDescription>
                    {isFr ? "Délais moyens d'instruction IRCC/MIFI pour ce programme" : "Average IRCC/MIFI processing delays for this program"}
                  </CardDescription>
                </div>
                <Badge variant="outline" className="font-mono text-xs">
                  {program ? `~${program.delayDays} ${isFr ? "jours" : "days"}` : "Standard"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span>{isFr ? "Avancement réglementaire du dossier" : "Regulatory case progress"}</span>
                  <span className="text-primary font-bold">{completionPct}% {t("checklistComplete")}</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2.5 overflow-hidden">
                  <div 
                    className="bg-primary h-2.5 rounded-full transition-all duration-500"
                    style={{ width: `${completionPct}%` }}
                  />
                </div>
                <div className="grid grid-cols-4 gap-2 pt-2 text-center text-xs text-muted-foreground">
                  <div className="p-2 rounded bg-muted/40 border">
                    <strong className="block text-foreground">{isFr ? "1. Ouverture" : "1. Intake"}</strong>
                    {matter.openedDate}
                  </div>
                  <div className="p-2 rounded bg-primary/10 border border-primary/20 text-primary font-medium">
                    <strong className="block">{isFr ? "2. Constitution" : "2. Prep"}</strong>
                    {isFr ? "En cours" : "In Progress"}
                  </div>
                  <div className="p-2 rounded bg-muted/40 border">
                    <strong className="block text-foreground">{isFr ? "3. Dépôt IRCC" : "3. Submission"}</strong>
                    {isFr ? "À venir" : "Pending"}
                  </div>
                  <div className="p-2 rounded bg-muted/40 border">
                    <strong className="block text-foreground">{isFr ? "4. Décision" : "4. Decision"}</strong>
                    {matter.deadline}
                  </div>
                </div>
                {program?.forms && program.forms.length > 0 && (
                  <div className="pt-3 border-t flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">
                      {isFr ? "Formulaires officiels IRCC/MIFI requis :" : "Required official IRCC/MIFI forms:"}
                    </span>
                    {program.forms.map((f, i) => (
                      <Badge key={i} variant="secondary" className="font-mono text-xs">
                        {f}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Le dossier comme centre de contrôle : pièces, formulaires,
              facturation, paiements, échéances, portail. */}
          {dossier && (
            <DossierOnglets
              dossier={dossier}
              matterId={dossier.matterId}
              clientId={dossier.clientId}
              statutDossier={matter.status}
              clientsDuCabinet={clientsDuCabinet}
            />
          )}

          {/* RUBRIQUE ACTIONS DIRECTES (ONGLETS D'ACTION EXÉCUTIFS) */}
          <DirectActionsTabs 
            matterId={matter.id} 
            clientName={matter.clientName} 
            programName={matter.program} 
          />

          {/* La liste de contrôle statique a été RETIRÉE, et c'est le seul
              retrait de cette tranche.
              
              Elle affichait les defaultStatus du modèle de programme — « valide »
              pour la plupart — sur des pièces qu'aucun dossier n'avait reçues.
              Un dossier vide s'ouvrait donc en annonçant un passeport valide.
              L'onglet Documents la remplace : mêmes pièces, statuts réels,
              et les actions pour les faire avancer. */}

          {/* Section 3: Linked Documents */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <FileText className="h-5 w-5 text-blue-600" />
                    {t("linkedDocuments")}
                  </CardTitle>
                  <CardDescription>
                    {isFr ? "Pièces numérisées et validées associées à ce dossier" : "Digital documents and proofs linked to this matter"}
                  </CardDescription>
                </div>
                <Link 
                  href="/documents" 
                  className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                >
                  {isFr ? "Voir tout le stockage" : "View all storage"}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {docs.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
                  {isFr ? "Aucun document associé. Les pièces du client apparaîtront ici." : "No linked documents found. Client uploads will appear here."}
                </div>
              ) : (
                <div className="space-y-3">
                  {docs.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{doc.name || `${doc.type} (${doc.id})`}</p>
                          <p className="text-xs text-muted-foreground">
                            {isFr ? "Par" : "By"}: {doc.uploadedBy} • {doc.date}
                          </p>
                        </div>
                      </div>
                      <Badge variant={doc.status === "valid" ? "success" : "destructive"}>
                        {doc.status === "valid" ? t("valid") : t("expired")}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

        </div>

        {/* Right Column (1/3 width): Billing & CCIC Audit Log */}
        <div className="space-y-8">
          
          {/* Section 4: Linked Billing & Trust Account */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <DollarSign className="h-5 w-5 text-emerald-600" />
                {t("linkedBilling")}
              </CardTitle>
              <CardDescription>
                {isFr ? "Facturation émise et comptes fiduciaires client" : "Invoices issued and client trust accounts"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {invoices.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
                  {isFr ? "Aucune facture associée." : "No invoices linked."}
                </div>
              ) : (
                <div className="space-y-3">
                  {invoices.map(inv => (
                    <div key={inv.id} className="p-3 border rounded-lg bg-card space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sm font-bold text-foreground">{inv.invoiceNumber}</span>
                        <Badge variant="outline" className="text-xs">
                          {inv.status === "trust_reconciled" ? (
                            <span className="text-emerald-600 font-semibold">{isFr ? "Fidéicommis CCIC" : "CCIC Trust"}</span>
                          ) : inv.status === "paid" ? (
                            <span className="text-blue-600">{isFr ? "Payée" : "Paid"}</span>
                          ) : (
                            <span className="text-amber-600">{isFr ? "En attente" : "Pending"}</span>
                          )}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{inv.date}</span>
                        <span className="font-bold text-foreground">${inv.amount.toLocaleString()} CAD</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section 5: Immutable CCIC Audit Log */}
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

      </div>
    </div>
  )
}
