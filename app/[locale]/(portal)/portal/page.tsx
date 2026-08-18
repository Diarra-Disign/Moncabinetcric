import { getTranslations, setRequestLocale } from "next-intl/server"
import { Card, CardContent } from "@/components/ui/card"
import { FileText, Info, PenLine, Check, Eye, Users, ArrowRight } from "lucide-react"
import { getCurrentMember, getCurrentPortalClient, getSessionSupabase } from "@/lib/supabase/session"
import { VirtualMeetingCard } from "../virtual-meeting-card"
import { ActionsFichier } from "@/components/documents/file-actions"
import { SignatureBloc } from "@/components/documents/signature-bloc"
import { tableauSignatures } from "@/lib/data/signatures"
import { cn } from "@/lib/utils"
import type { ClientQuestionnaire } from "@/lib/data/types"
import { ValidationsEnAttente, type DemandeValidationVue } from "@/components/portal/validations-en-attente"
import { journaliserAccesApercuPortail } from "@/lib/data/portal-audit"
import { SelecteurClientApercu, type ClientApercuItem } from "@/components/portal/selecteur-client-apercu"
import { ClientInvoicesView, type PortalInvoice } from "@/components/portal/client-invoices-view"

/**
 * Portail client & Mode Aperçu en Lecture Seule pour le Consultant.
 *
 * 1. Le vrai client se connecte et n'accède qu'à ses propres dossiers/pièces.
 * 2. Le consultant authentifié choisit expressément quel client il souhaite
 *    prévisualiser parmi ses clients ayant un portail ouvert.
 */
export default async function PortalPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ previewClientId?: string }>
}) {
  const { locale } = await params
  const { previewClientId } = await searchParams
  setRequestLocale(locale)

  const t = await getTranslations("Portal")

  const realClient = await getCurrentPortalClient()
  const membre = realClient ? null : await getCurrentMember()
  const apercu = !realClient
  const firmId = realClient?.firmId ?? membre?.firmId ?? ""

  // Liste de tous les clients du cabinet ayant un accès portail
  let clientsDisponibles: ClientApercuItem[] = []

  let clientVisualise: {
    id: string
    name: string
    email: string
    fileNumber: string
    program: string
  } | null = realClient
    ? {
        id: realClient.clientId,
        name: realClient.name,
        email: realClient.email,
        fileNumber: realClient.fileNumber,
        program: realClient.program,
      }
    : null

  let dossiers: Record<string, unknown>[] = []
  let pieces: Record<string, unknown>[] = []
  let factures: PortalInvoice[] = []
  let cabinet: Record<string, unknown> = {}
  let questionnaires: ClientQuestionnaire[] = []
  let demandesValidation: DemandeValidationVue[] = []

  if (firmId) {
    const supabase = await getSessionSupabase()

    // 1. Infos du cabinet
    const { data: firmRes } = await supabase
      .from("firms")
      .select("name, owner_name, rcic_license_number")
      .eq("id", firmId)
      .maybeSingle()
    cabinet = firmRes ?? {}

    // 2. Si le consultant est en mode aperçu, lister les clients du cabinet
    if (apercu && membre) {
      const { getClients } = await import("@/lib/data")
      const tousClients = await getClients()

      clientsDisponibles = (tousClients ?? []).map((c) => ({
        id: String(c.id),
        name: String(c.name || "Client"),
        email: String(c.email || ""),
        fileNumber: String(c.fileNumber || "—"),
        program: String(c.program || ""),
      }))

      // Résolution du client choisi explicitement par le consultant
      if (previewClientId) {
        const trouve = clientsDisponibles.find(
          (c) => c.id === previewClientId || c.fileNumber === previewClientId
        )
        if (trouve) {
          clientVisualise = trouve
          await journaliserAccesApercuPortail(clientVisualise.id, clientVisualise.name)
        }
      }
    }

    // 3. Chargement des données uniquement si un client est sélectionné (ou vrai client connecté)
    if (clientVisualise) {
      // Résolution de tous les identifiants possibles du client (UUID + legacy_id)
      let allClientIds = [clientVisualise.id]
      try {
        const { data: dbClient } = await supabase
          .from("clients")
          .select("id, legacy_id")
          .or(`id.eq.${clientVisualise.id},legacy_id.eq.${clientVisualise.id}`)
          .maybeSingle()
        if (dbClient) {
          if (dbClient.id) allClientIds.push(String(dbClient.id))
          if (dbClient.legacy_id) allClientIds.push(String(dbClient.legacy_id))
        }
      } catch {
        // En cas de format UUID invalide sur le .or()
      }
      allClientIds = Array.from(new Set(allClientIds.filter(Boolean)))

      // 3.1 Dossiers du client
      const { data: mData } = await supabase
        .from("matters")
        .select("id, reference, program, status, opened_date, deadline")
        .in("client_id", allClientIds)
        .order("opened_date", { ascending: false })

      if (mData && mData.length > 0) {
        dossiers = mData
      } else {
        const { getMattersByClientId } = await import("@/lib/data")
        for (const cid of allClientIds) {
          const mbList = await getMattersByClientId(cid)
          if (mbList && mbList.length > 0) {
            dossiers = mbList.map((m) => ({
              id: m.id,
              reference: m.id,
              program: m.program,
              status: m.status,
              opened_date: m.openedDate,
              deadline: m.deadline,
            }))
            break
          }
        }
      }

      const matterIds = dossiers.map((d) => String(d.id)).filter(Boolean)

      // 3.2 Pièces du client (liées au client OU à l'un de ses dossiers)
      let docsQuery = supabase
        .from("documents")
        .select("id, name, category, date, status, storage_path, sha256, client_id, matter_id")
        .order("created_at", { ascending: false })

      if (matterIds.length > 0) {
        docsQuery = docsQuery.or(
          `client_id.in.(${allClientIds.join(",")}),matter_id.in.(${matterIds.join(",")})`
        )
      } else {
        docsQuery = docsQuery.in("client_id", allClientIds)
      }

      const { data: dData } = await docsQuery
      if (dData && dData.length > 0) {
        pieces = dData
      } else {
        const { getDocuments } = await import("@/lib/data")
        const allDocs = await getDocuments()
        pieces = (allDocs ?? [])
          .filter(
            (doc) =>
              allClientIds.includes(doc.clientId ?? "") ||
              matterIds.includes(doc.matterId ?? "")
          )
          .map((doc) => ({
            id: doc.id,
            name: doc.name,
            category: doc.category,
            date: doc.date,
            status: "valid",
            storage_path: null,
            sha256: null,
          }))
      }

      // 3.3 Questionnaires du client (liés au client OU à l'un de ses dossiers)
      let qQuery = supabase
        .from("client_questionnaires")
        .select("id, firm_id, client_id, matter_id, title, sections, message, status, progress, reminder_count, answers, prefill, corrections, history, created_at, updated_at")
        .eq("firm_id", firmId)

      if (matterIds.length > 0) {
        qQuery = qQuery.or(
          `client_id.in.(${allClientIds.join(",")}),matter_id.in.(${matterIds.join(",")})`
        )
      } else {
        qQuery = qQuery.in("client_id", allClientIds)
      }

      const { data: qData } = await qQuery
      if (qData && qData.length > 0) {
        questionnaires = qData.map((q) => ({
          id: String(q.id),
          firmId: String(q.firm_id),
          clientId: String(q.client_id),
          title: String(q.title ?? ""),
          sections: (q.sections ?? []) as ClientQuestionnaire["sections"],
          message: String(q.message ?? ""),
          status: String(q.status ?? "draft") as ClientQuestionnaire["status"],
          statusAffiche: String(q.status ?? "draft") as ClientQuestionnaire["statusAffiche"],
          progress: Number(q.progress ?? 0),
          reminderCount: Number(q.reminder_count ?? 0),
          createdAt: String(q.created_at ?? ""),
          updatedAt: String(q.updated_at ?? ""),
          answers: (q.answers ?? {}) as Record<string, unknown>,
          prefill: (q.prefill ?? {}) as Record<string, unknown>,
          corrections: (q.corrections ?? []) as ClientQuestionnaire["corrections"],
          history: (q.history ?? []) as ClientQuestionnaire["history"],
          lienActif: false,
        }))
      } else {
        // Fallback questionnaire de découverte/modèle pour visualiser l'expérience
        const { getTemplateBySlug } = await import("@/lib/data/questionnaire-templates")
        const modele = getTemplateBySlug("study_permit")
        if (modele) {
          questionnaires = [
            {
              id: `q-demo-${clientVisualise.id}`,
              firmId: firmId || "firm-1",
              clientId: clientVisualise.id,
              title: `${modele.titleFr} — Recueil initial`,
              sections: modele.sections as ClientQuestionnaire["sections"],
              message: "Merci de compléter ces informations pour votre dossier.",
              status: "in_progress",
              statusAffiche: "in_progress",
              progress: 25,
              reminderCount: 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              answers: {},
              prefill: {},
              corrections: [],
              history: [],
              lienActif: false,
            },
          ]
        }
      }

      // 3.4 Validations de documents du client
      let revQuery = supabase
        .from("document_reviews")
        .select("id, document_id, kind, message, requested_at, status, documents(name)")
        .eq("status", "pending")
        .order("requested_at", { ascending: false })

      if (matterIds.length > 0) {
        revQuery = revQuery.or(
          `client_id.in.(${allClientIds.join(",")}),matter_id.in.(${matterIds.join(",")})`
        )
      } else {
        revQuery = revQuery.in("client_id", allClientIds)
      }

      const { data: revData } = await revQuery

      if (revData && revData.length > 0) {
        demandesValidation = revData.map((r) => {
          const doc = r.documents as unknown as { name?: string } | null
          return {
            id: String(r.id),
            documentId: String(r.document_id),
            documentNom: String(doc?.name ?? "Document"),
            kind: String(r.kind ?? "validation"),
            message: (r.message as string) ?? null,
            requestedAt: String(r.requested_at),
            status: String(r.status),
          }
        })
      }

      // 3.5 Factures & Reçus du client
      let invQuery = supabase
        .from("invoices")
        .select("id, number, date, due_date, subtotal, tax, total, paid_amount, status, created_at, matters(reference)")
        .order("created_at", { ascending: false })

      if (matterIds.length > 0) {
        invQuery = invQuery.or(
          `client_id.in.(${allClientIds.join(",")}),matter_id.in.(${matterIds.join(",")})`
        )
      } else {
        invQuery = invQuery.in("client_id", allClientIds)
      }

      const { data: invData } = await invQuery
      if (invData && invData.length > 0) {
        factures = invData.map((inv) => {
          const mat = inv.matters as unknown as { reference?: string } | null
          return {
            id: String(inv.id),
            number: String(inv.number ?? "FAC-000"),
            date: String(inv.date ?? ""),
            dueDate: (inv.due_date as string) || undefined,
            subtotal: Number(inv.subtotal ?? 0),
            tax: Number(inv.tax ?? 0),
            total: Number(inv.total ?? 0),
            paidAmount: Number(inv.paid_amount ?? 0),
            status: (inv.status as PortalInvoice["status"]) || "pending",
            matterReference: mat?.reference || undefined,
          }
        })
      } else {
        const { getInvoices } = await import("@/lib/data")
        const allInvs = await getInvoices()
        factures = (allInvs ?? [])
          .filter((inv) => allClientIds.includes(inv.clientId ?? "") || inv.clientName === clientVisualise?.name)
          .map((inv) => ({
            id: inv.id,
            number: inv.invoiceNumber || inv.id,
            date: inv.date,
            dueDate: undefined,
            subtotal: inv.amount,
            tax: 0,
            total: inv.amount,
            paidAmount: inv.status === "paid" ? inv.amount : 0,
            status: inv.status === "paid" ? "paid" : inv.status === "partial" ? "partial" : inv.status === "overdue" ? "overdue" : "pending",
            matterReference: inv.matterId,
          }))
      }
    }
  }

  const signatures = await tableauSignatures()
  const aSigner = signatures.aSigner.length
  const nbPieces = pieces.length

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
      {/* Barre de contrôle / sélection du portail client en mode aperçu */}
      {apercu && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5" /> Sélection du portail client à visualiser
            </span>
            <p className="text-xs text-muted-foreground font-medium">
              Choisissez le candidat dont vous voulez prévisualiser l&apos;interface et les documents en lecture seule :
            </p>
          </div>
          <SelecteurClientApercu
            clients={clientsDisponibles}
            selectedClientId={clientVisualise?.id}
            locale={locale}
          />
        </div>
      )}

      {/* CAS 1 : Le consultant n'a pas encore choisi de client -> Écran de sélection dédié */}
      {apercu && !clientVisualise ? (
        <div className="py-8 space-y-6">
          <div className="text-center max-w-lg mx-auto space-y-2">
            <div className="h-12 w-12 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-xs">
              <Users className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-black text-foreground">
              Aperçu du Portail Client
            </h1>
            <p className="text-sm text-muted-foreground">
              Sélectionnez ci-dessous le candidat dont vous souhaitez inspecter le portail en mode lecture seule :
            </p>
          </div>

          {clientsDisponibles.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground italic py-10 bg-card rounded-2xl border border-border">
              Aucun client enregistré pour l&apos;instant dans votre cabinet.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto">
              {clientsDisponibles.map((c) => (
                <a
                  key={c.id}
                  href={`/${locale}/portal?previewClientId=${c.id}`}
                  className="rounded-2xl border border-border bg-card p-5 hover:border-primary/50 hover:shadow-md transition-all flex flex-col justify-between gap-4 group cursor-pointer"
                >
                  <div className="space-y-1.5">
                    <span className="font-mono text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded">
                      {c.fileNumber}
                    </span>
                    <h3 className="text-base font-black text-foreground group-hover:text-primary transition-colors">
                      {c.name}
                    </h3>
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      {c.email || "—"}
                    </p>
                    {c.program && (
                      <p className="text-xs text-foreground font-medium pt-1">
                        Programme : <strong>{c.program}</strong>
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-border/60 flex items-center justify-between text-xs font-bold text-primary">
                    <span>👁 Visualiser le portail</span>
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* CAS 2 : Le portail du client sélectionné */
        <>
          <header>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {clientVisualise
                ? t("welcome", { name: clientVisualise.name })
                : "Mon Portail Client"}
            </h1>
            {clientVisualise && (
              <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span>
                  {t("fileLabel")}{" "}
                  <strong className="font-mono text-foreground">{clientVisualise.fileNumber}</strong>
                </span>
                <span>
                  {t("programLabel")}{" "}
                  <strong className="text-foreground">{clientVisualise.program || t("noProgram")}</strong>
                </span>
                {apercu && (
                  <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-300">
                    <Eye className="h-3 w-3" /> Consultation en lecture seule
                  </span>
                )}
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

          {/* Avancement : affiché si un dossier existe */}
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
                  {dossiers.map((d) => (
                    <li
                      key={d.id as string}
                      className="flex items-center justify-between rounded-xl bg-card p-4 shadow-2xs"
                    >
                      <div>
                        <p className="font-mono text-xs font-bold text-muted-foreground">
                          {d.reference as string}
                        </p>
                        <p className="font-semibold text-foreground">
                          {(d.program as string) || t("noProgram")}
                        </p>
                      </div>
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                        {d.status as string}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* ============================================================
              SECTION : VALIDATIONS DE DOCUMENTS EN ATTENTE
              ============================================================ */}
          <ValidationsEnAttente demandes={demandesValidation} isReadOnlyPreview={apercu} />

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
                            q.status === "completed" || q.status === "cancelled"
                              ? "bg-success/15 text-success"
                              : q.status === "submitted" || q.status === "corrected"
                                ? "bg-primary/15 text-primary-strong"
                                : q.status === "to_correct"
                                  ? "bg-error/15 text-error"
                                  : "bg-muted text-muted-foreground"
                          )}>
                            {q.status === "draft" && "Brouillon"}
                            {q.status === "in_progress" && "En cours"}
                            {q.status === "submitted" && "Soumis"}
                            {q.status === "to_correct" && "À corriger"}
                            {q.status === "corrected" && "Corrigé"}
                            {q.status === "completed" && "Clos"}
                            {q.status === "cancelled" && "Annulé"}
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

                        {q.status === "cancelled" || q.status === "completed" ? (
                          <span className="text-xs text-muted-foreground font-bold flex items-center gap-1">
                            <Check className="h-4 w-4 text-success" /> Validé
                          </span>
                        ) : apercu ? (
                          <span className="px-3 py-1.5 rounded-lg bg-muted text-muted-foreground font-bold text-xs cursor-not-allowed">
                            Remplir — réservé au client
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

          {/* ============================================================
              SECTION : MES FACTURES ET REÇUS CICC
              ============================================================ */}
          <section id="factures" className="space-y-3">
            <ClientInvoicesView
              invoices={factures}
              clientName={clientVisualise?.name ?? ""}
              firmName={(cabinet?.name as string) ?? undefined}
            />
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
                {pieces.map((p) => (
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
                    <div className="mt-2 pl-7">
                      <ActionsFichier
                        documentId={p.id as string}
                        clientId={clientVisualise?.id ?? ""}
                        storagePath={(p.storage_path as string) ?? null}
                        sha256={(p.sha256 as string) ?? null}
                        labels={etiquettes}
                        peutVerifier={!apercu}
                        isReadOnlyPreview={apercu}
                      />
                      <div className="mt-2">
                        <SignatureBloc documentId={p.id as string} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
