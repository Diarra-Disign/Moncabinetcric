import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { PenLine, Clock, Check, Send, AlertTriangle, Info, FolderOpen } from "lucide-react"
import { Link } from "@/i18n/routing"
import { PageHeader } from "@/components/app-shell/page-header"
import { tableauSignatures, type LigneTableau } from "@/lib/data/signatures"
import { SignatureBloc } from "@/components/documents/signature-bloc"
import { getCurrentMember } from "@/lib/supabase/session"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Signatures")
  return { title: t("title"), description: t("subtitle") }
}

function Section({
  titre,
  icone: Icone,
  lignes,
  vide,
  signataire,
  avecAction,
  labels,
}: {
  titre: string
  icone: typeof PenLine
  lignes: LigneTableau[]
  vide: string
  signataire: string
  avecAction: boolean
  labels: { requestedOn: string; expiresOn: string; divergence: string }
}) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-base font-black tracking-tight text-foreground">
        <Icone aria-hidden className="h-4 w-4 text-muted-foreground" />
        {titre}
        <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
          {lignes.length}
        </span>
      </h2>

      {lignes.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-5 py-8 text-center text-xs text-muted-foreground">
          {vide}
        </p>
      ) : (
        <ul className="space-y-3">
          {lignes.map((l) => (
            <li key={l.documentId} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-bold text-foreground">{l.documentName}</span>
                <span className="text-xs text-muted-foreground">
                  {l.clientName ?? "—"}
                  {l.matterId && <span className="ml-2 font-mono">{l.matterId}</span>}
                </span>
              </div>

              <p className="mt-1 flex flex-wrap gap-x-4 font-mono text-[10px] text-muted-foreground">
                {l.requestedAt && (
                  <span>
                    {labels.requestedOn} {new Date(l.requestedAt).toLocaleDateString("fr-CA")}
                  </span>
                )}
                {l.expiresAt && (
                  <span>
                    {labels.expiresOn} {new Date(l.expiresAt).toLocaleDateString("fr-CA")}
                  </span>
                )}
              </p>

              {l.divergence && (
                <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-error/30 bg-error/10 px-2.5 py-1.5 text-[11px] font-bold text-error">
                  <AlertTriangle aria-hidden className="mt-px h-3 w-3 shrink-0" />
                  {labels.divergence}
                </p>
              )}

              {avecAction && (
                <div className="mt-3">
                  <SignatureBloc
                    documentId={l.documentId}
                    documentName={l.documentName}
                    signataire={signataire}
                  />
                </div>
              )}

              {!avecAction && l.signatures.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {l.signatures.map((s, i) => (
                    <li key={i} className="flex flex-wrap items-baseline gap-x-2 text-xs">
                      <Check aria-hidden className="h-3 w-3 shrink-0 text-success" />
                      <span className="font-bold text-foreground">{s.signerName}</span>
                      <span className="text-muted-foreground">
                        {s.signerKind === "member" ? s.signerRole ?? "cabinet" : "client"}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {new Date(s.signedAt).toLocaleString("fr-CA")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * Vue d'ensemble des signatures.
 *
 * Cette page existe parce que la signature n'était accessible que depuis le
 * panneau latéral d'une fiche de document — un panneau masqué sur écran
 * étroit. La fonction existait sans être trouvable.
 */
export default async function SignaturesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations("Signatures")
  const [tableau, membre] = await Promise.all([tableauSignatures(), getCurrentMember()])

  const total =
    tableau.aSigner.length +
    tableau.enAttenteDAutrui.length +
    tableau.signes.length +
    tableau.pretsAEnvoyer.length

  const labels = {
    requestedOn: t("requestedOn"),
    expiresOn: t("expiresOn"),
    divergence: t("divergenceWarning"),
  }
  const signataire = membre?.fullName ?? ""

  return (
    <div className="flex w-full flex-col gap-8 pb-16">
      <PageHeader title={t("title")} subtitle={t("subtitle")} badgeText={t("badge")} badgeVariant="indigo" />

      <p className="flex items-start gap-2 rounded-2xl border border-border bg-muted/40 p-4 text-xs leading-relaxed text-muted-foreground">
        <Info aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
        {t("explain")}
      </p>

      {total === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-6 py-14 text-center">
          <FolderOpen aria-hidden className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
          <p className="mx-auto max-w-md text-sm text-muted-foreground">{t("emptyAll")}</p>
          <Link
            href="/documents"
            className="mt-4 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-foreground transition-colors hover:bg-muted"
          >
            {t("openFile")}
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          <Section
            titre={t("toSign")}
            icone={PenLine}
            lignes={tableau.aSigner}
            vide={t("emptySection")}
            signataire={signataire}
            avecAction
            labels={labels}
          />
          <Section
            titre={t("waiting")}
            icone={Clock}
            lignes={tableau.enAttenteDAutrui}
            vide={t("emptySection")}
            signataire={signataire}
            avecAction={false}
            labels={labels}
          />
          <Section
            titre={t("ready")}
            icone={Send}
            lignes={tableau.pretsAEnvoyer}
            vide={t("emptySection")}
            signataire={signataire}
            avecAction
            labels={labels}
          />
          <Section
            titre={t("signed")}
            icone={Check}
            lignes={tableau.signes}
            vide={t("emptySection")}
            signataire={signataire}
            avecAction={false}
            labels={labels}
          />
        </div>
      )}
    </div>
  )
}
