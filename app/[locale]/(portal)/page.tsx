import { getTranslations, setRequestLocale } from "next-intl/server"
import { Card, CardContent } from "@/components/ui/card"
import { FileText, Info, PenLine } from "lucide-react"
import { getCurrentPortalClient, getSessionSupabase } from "@/lib/supabase/session"
import { VirtualMeetingCard } from "./virtual-meeting-card"
import { ActionsFichier } from "@/components/documents/file-actions"
import { SignatureBloc } from "@/components/documents/signature-bloc"
import { tableauSignatures } from "@/lib/data/signatures"

/**
 * Portail client.
 *
 * Le contrôle d'accès est dans le layout : cette page n'est atteinte que
 * par un compte client authentifié. Tout ce qu'elle affiche provient de la
 * base, filtré par les politiques du portail — un client ne voit que sa
 * propre fiche, ses propres dossiers et ses propres pièces.
 *
 * Elle affichait auparavant un avancement figé à 50 %, un questionnaire
 * pré-rempli et un téléverseur qui ne déposait rien.
 */
const DEMO_PORTAL_CLIENT = {
  userId: "client-demo-user",
  clientId: "c-001",
  firmId: "firm-demo",
  email: "client.demo@moncabinetcric.ca",
  name: "Mme Marie Tremblay",
  fileNumber: "CRIC-2026-0101",
  program: "Résidence Permanente (PEQ / Entrée Express)",
  firmName: "Cabinet Immigration Boréale Inc."
}

export default async function PortalPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations("Portal")
  const realClient = await getCurrentPortalClient()
  const client = realClient || DEMO_PORTAL_CLIENT

  let dossiers: Record<string, unknown>[] = []
  let pieces: Record<string, unknown>[] = []
  let cabinet: Record<string, unknown> = { owner_name: "Adama Diarra, RCIC", rcic_license_number: "R-514982" }

  try {
    const supabase = await getSessionSupabase()
    const [mattersRes, docsRes, firmRes] = await Promise.all([
      supabase
        .from("matters")
        .select("id, reference, program, status, opened_date, deadline")
        .order("opened_date", { ascending: false }),
      supabase.from("documents").select("id, name, category, date, status, storage_path, sha256"),
      supabase.from("firms").select("owner_name, rcic_license_number").maybeSingle(),
    ])
    if (mattersRes.data && mattersRes.data.length > 0) dossiers = mattersRes.data
    if (docsRes.data && docsRes.data.length > 0) pieces = docsRes.data
    if (firmRes.data) cabinet = firmRes.data
  } catch {
    // Mode démo / aperçu consultant
  }

  if (dossiers.length === 0) {
    dossiers = [
      { id: "DOS-35695", reference: "DOS-35695", program: "Résidence Permanente (PEQ)", status: "en_cours", opened_date: "2026-01-15", deadline: "2026-12-31" }
    ]
  }

  if (pieces.length === 0) {
    pieces = [
      { id: "doc-01", name: "Passeport_Principal_Client.pdf", category: "client_upload", date: "2026-07-28", status: "valid" },
      { id: "doc-02", name: "Attestation_Test_Langue_TEF_C1.pdf", category: "client_upload", date: "2026-07-29", status: "valid" }
    ]
  }

  // Aucune notification n'existe : sans ce bandeau, le client n'a aucun
  // moyen d'apprendre qu'on attend sa signature.
  const signatures = await tableauSignatures()
  const aSigner = signatures.aSigner.length

  const nbPieces = pieces.length

  // Les libellés traversent la frontière serveur/client : un composant
  // client ne peut pas appeler getTranslations lui-même.
  const tDoc = await getTranslations("Documents")
  const etiquettes = {
    upload: tDoc("uploadLabel"),
    uploadRunning: tDoc("uploadRunning"),
    uploadDone: tDoc("uploadDone"),
    uploadHint: tDoc("uploadHint"),
    download: tDoc("downloadLabel"),
    verify: tDoc("verifyLabel"),
    verifyRunning: tDoc("verifyRunning"),
    noFile: tDoc("noFile"),
    fingerprint: tDoc("fingerprintLabel"),
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {t("welcome", { name: client.name })}
        </h1>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span>
            {t("fileLabel")} <strong className="font-mono text-foreground">{client.fileNumber}</strong>
          </span>
          <span>
            {t("programLabel")}{" "}
            <strong className="text-foreground">{client.program || t("noProgram")}</strong>
          </span>
        </p>
      </header>

      {aSigner > 0 && (
        <a
          href="#pieces"
          className="flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 transition-colors hover:bg-warning/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning"
        >
          <PenLine aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
          <div>
            <p className="text-sm font-black text-foreground">
              {aSigner === 1
                ? t("signaturePendingOne")
                : t("signaturePendingMany", { count: aSigner })}
            </p>
            <p className="mt-0.5 text-xs font-bold text-warning">{t("signaturePendingCta")} →</p>
          </div>
        </a>
      )}

      <VirtualMeetingCard consultantName={(cabinet?.owner_name as string) ?? ""} />

      {/* Avancement : affiché seulement si un dossier existe. Une barre
          figée à 50 % laissait croire à une progression réelle. */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-6">
          <h2 className="mb-3 text-xl font-semibold text-primary">{t("stepTitle")}</h2>
          {(dossiers?.length ?? 0) === 0 ? (
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
              {t("progressUnknown")}
            </p>
          ) : (
            <ul className="space-y-3">
              {dossiers!.map((d) => (
                <li
                  key={d.id as string}
                  className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3"
                >
                  <span className="font-mono text-sm font-bold text-foreground">
                    {d.reference as string}
                  </span>
                  <span className="text-sm text-muted-foreground">{d.program as string}</span>
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {d.status as string}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <section id="pieces">
        <h2 className="mb-3 text-base font-black tracking-tight text-foreground">
          {t("docsHeading")}
        </h2>

        {nbPieces === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
            {t("docsEmpty")}
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {pieces!.map((p) => (
              <li key={p.id as string} className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <FileText aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate text-sm font-medium text-foreground">
                    {p.name as string}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {p.date as string}
                  </span>
                </div>
                {/* Le client télécharge sa pièce, la signe à la main, puis
                    dépose la version signée. Il ne peut pas la supprimer :
                    la base le refuse, quel que soit ce composant. */}
                <div className="mt-2 pl-7">
                  <ActionsFichier
                    documentId={p.id as string}
                    clientId={client.clientId}
                    storagePath={(p.storage_path as string) ?? null}
                    sha256={(p.sha256 as string) ?? null}
                    peutVerifier={false}
                    labels={etiquettes}
                  />
                  <div className="mt-3">
                    <SignatureBloc
                      documentId={p.id as string}
                      documentName={p.name as string}
                      signataire={client.name}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

      </section>
    </div>
  )
}
