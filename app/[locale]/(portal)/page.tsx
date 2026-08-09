import { getTranslations, setRequestLocale } from "next-intl/server"
import { Card, CardContent } from "@/components/ui/card"
import { FileText, Info, PenLine, Check } from "lucide-react"
import { getCurrentMember, getCurrentPortalClient, getSessionSupabase } from "@/lib/supabase/session"
import { VirtualMeetingCard } from "./virtual-meeting-card"
import { ActionsFichier } from "@/components/documents/file-actions"
import { SignatureBloc } from "@/components/documents/signature-bloc"
import { tableauSignatures } from "@/lib/data/signatures"
import { cn } from "@/lib/utils"
import { getClientQuestionnairesByClientId } from "@/lib/data/queries"
import type { ClientQuestionnaire } from "@/lib/data/types"

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
export default async function PortalPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations("Portal")

  // Deux publics atteignent cet écran : le client, et le membre du cabinet
  // venu voir à quoi ressemble le portail de ses clients. Le second est en
  // aperçu — et un aperçu n'invente rien. Il montrait « Mme Marie Tremblay »,
  // dossier « CRIC-2026-0101 », du « Cabinet Immigration Boréale Inc. » :
  // une cliente, un dossier et un cabinet qui n'existent pas.
  const realClient = await getCurrentPortalClient()
  const membre = realClient ? null : await getCurrentMember()
  const apercu = !realClient
  const firmId = realClient?.firmId ?? membre?.firmId ?? ""

  let dossiers: Record<string, unknown>[] = []
  let pieces: Record<string, unknown>[] = []
  let cabinet: Record<string, unknown> = {}

  if (firmId) {
    const supabase = await getSessionSupabase()
    const [mattersRes, docsRes, firmRes] = await Promise.all([
      supabase
        .from("matters")
        .select("id, reference, program, status, opened_date, deadline")
        .order("opened_date", { ascending: false }),
      supabase.from("documents").select("id, name, category, date, status, storage_path, sha256"),
      // Le filtre sur l'identifiant est indispensable, et son absence était la
      // cause première de ce qui s'affichait. Sans lui, la requête renvoie
      // DEUX lignes — le cabinet du lecteur et celui de l'exploitant, que
      // firms_public_operator ouvre à tous pour les pages légales.
      // maybeSingle() refuse alors de choisir, la lecture échoue, et
      // l'identité retombait sur un repli inventé : « Adama Diarra, RCIC »
      // portant un permis « R-514982 » qui n'a jamais été délivré. Chaque
      // vrai client du portail voyait donc un faux numéro de permis — la
      // mention même qui engage la responsabilité déontologique.
      supabase
        .from("firms")
        .select("name, owner_name, rcic_license_number")
        .eq("id", firmId)
        .maybeSingle(),
    ])
    dossiers = mattersRes.data ?? []
    pieces = docsRes.data ?? []
    cabinet = firmRes.data ?? {}
  }

  let questionnaires: ClientQuestionnaire[] = []
  if (apercu) {
    questionnaires = [
      {
        id: "q-demo-1",
        firmId: firmId || "firm-1",
        clientId: "client-1",
        matterId: "matter-1",
        title: "Questionnaire — Demande de permis d'études",
        formType: "study_permit",
        status: "in_progress",
        progress: 45,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        answers: {},
        corrections: [],
        history: [],
      }
    ]
  } else if (firmId && realClient) {
    questionnaires = await getClientQuestionnairesByClientId(realClient.clientId)
  }

  // Aucun repli fabriqué : quand il n'y a rien, les états vides le disent.
  // Un passeport et une attestation de test de langue inventés laissaient
  // croire à un client que ses pièces étaient déjà au dossier.

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
        {/* En aperçu, l'écran dit ce qu'il est plutôt que de saluer une
            cliente imaginaire. Le membre du cabinet sait alors que ces
            champs se rempliront du nom de son client, et non que le portail
            en aurait déjà un. */}
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {apercu ? t("previewTitle") : t("welcome", { name: realClient!.name })}
        </h1>
        {apercu ? (
          <p className="mt-2 max-w-prose text-sm text-muted-foreground">{t("previewBody")}</p>
        ) : (
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>
              {t("fileLabel")}{" "}
              <strong className="font-mono text-foreground">{realClient!.fileNumber}</strong>
            </span>
            <span>
              {t("programLabel")}{" "}
              <strong className="text-foreground">{realClient!.program || t("noProgram")}</strong>
            </span>
          </p>
        )}
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

      {/* ============================================================
          SECTION : MES QUESTIONNAIRES (FORMULAIRES DYNAMIQUES)
          ============================================================ */}
      <section id="questionnaires" className="space-y-3">
        <h2 className="text-base font-black tracking-tight text-foreground flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Mes questionnaires
        </h2>
        {questionnaires.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground bg-card">
            Aucun questionnaire ne vous est attribué pour le moment.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {questionnaires.map((q) => (
              <Card key={q.id} className="border border-border bg-card overflow-hidden hover:shadow-sm transition-shadow">
                <CardContent className="p-5 flex flex-col justify-between h-full gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn(
                        "rounded px-2 py-0.5 text-[9px] font-black uppercase tracking-wider",
                        q.status === "validated" || q.status === "locked"
                          ? "bg-success/15 text-success"
                          : q.status === "submitted" || q.status === "corrected"
                            ? "bg-primary/15 text-primary"
                            : q.status === "to_correct"
                              ? "bg-error/15 text-error"
                              : "bg-muted text-muted-foreground"
                      )}>
                        {q.status === "draft" && "Brouillon"}
                        {q.status === "in_progress" && "En cours"}
                        {q.status === "submitted" && "Soumis"}
                        {q.status === "to_correct" && "À corriger"}
                        {q.status === "corrected" && "Corrigé"}
                        {q.status === "validated" && "Validé"}
                        {q.status === "locked" && "Verrouillé"}
                      </span>

                      <span className="text-xs font-bold text-muted-foreground">{q.progress}%</span>
                    </div>

                    <h3 className="text-sm font-black text-foreground">{q.title}</h3>
                    
                    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                      <div className="bg-primary h-full" style={{ width: `${q.progress}%` }} />
                    </div>

                    {q.status === "to_correct" && q.corrections.length > 0 && (
                      <div className="mt-2 p-2.5 bg-error/15 text-error text-[11px] rounded-lg border border-error/20 flex flex-col gap-1">
                        <span className="font-bold">Corrections demandées :</span>
                        <p>{q.corrections[0].comment}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-border/60 pt-3 mt-1">
                    <span className="text-[10px] text-muted-foreground">
                      Mise à jour : {new Date(q.updatedAt).toLocaleDateString("fr-CA")}
                    </span>

                    {q.status === "locked" || q.status === "validated" ? (
                      <span className="text-xs text-muted-foreground font-bold flex items-center gap-1">
                        <Check className="h-4 w-4 text-success" /> Validé
                      </span>
                    ) : (
                      <a
                        href={`/${locale}/portal/questionnaires/${q.id}`}
                        className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white font-bold text-xs transition-colors flex items-center gap-1"
                      >
                        {q.status === "draft" || q.progress === 0 ? "Remplir" : "Continuer"} →
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

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
                    clientId={realClient?.clientId ?? ""}
                    storagePath={(p.storage_path as string) ?? null}
                    sha256={(p.sha256 as string) ?? null}
                    peutVerifier={false}
                    labels={etiquettes}
                  />
                  <div className="mt-3">
                    <SignatureBloc
                      documentId={p.id as string}
                      documentName={p.name as string}
                      signataire={realClient?.name ?? ""}
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
