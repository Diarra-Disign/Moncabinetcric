import { getTranslations, setRequestLocale } from "next-intl/server"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { UploadCloud, FileText, CheckCircle2, AlertCircle } from "lucide-react"
import { SmartIntakeWizard } from "./smart-intake-wizard"
import { VirtualMeetingCard } from "./virtual-meeting-card"
import { ClientDocumentUploader } from "./client-document-uploader"

export default async function PortalPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations("Portal")

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{t("title")}</h1>
        <p className="text-lg text-muted-foreground mt-2">{t("subtitle")}</p>
      </div>

      {/* RENCONTRE VIRTUELLE & CALENDLY */}
      <VirtualMeetingCard />

      {/* SMART INTAKE WIZARD - QUESTIONNAIRE UNIVERSEL IRCC */}
      <SmartIntakeWizard />

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-center gap-6 p-6">
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-primary mb-2">{t("stepTitle")}</h2>
            <p className="text-sm text-foreground/80 mb-4">
              {t("stepDesc")}
            </p>
            <div className="w-full bg-border rounded-full h-2 mb-1">
              <div className="bg-primary h-2 rounded-full" style={{ width: '50%' }}></div>
            </div>
            <div className="text-xs text-muted-foreground flex justify-between">
              <span>{t("eval")}</span>
              <span>{t("collect")}</span>
              <span>{t("submit")}</span>
              <span>{t("decision")}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* GESTIONNAIRE INTERACTIF DE TÉLÉVERSEMENT DE DOCUMENTS */}
      <ClientDocumentUploader />
    </div>
  )
}
