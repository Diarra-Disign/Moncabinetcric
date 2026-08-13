import type { Metadata } from "next"
import { getTranslations, setRequestLocale } from "next-intl/server"
import { PenLine, Clock, Check, Send, XCircle, Archive, Boxes, Info, FolderOpen } from "lucide-react"
import { Link } from "@/i18n/routing"
import { PageHeader } from "@/components/app-shell/page-header"
import { tableauSignatures, type LigneTableau } from "@/lib/data/signatures"
import { ListeSignatures } from "@/components/signature/liste-signatures"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Signatures")
  return { title: t("title"), description: t("subtitle") }
}

/**
 * Vue d'ensemble des signatures.
 *
 * ─── SIX SECTIONS, TOUTES CALCULÉES ────────────────────────────────────────
 *
 * Chacune se déduit du statut réel de la demande et de ses destinataires.
 * Aucune ne repose sur la simple existence d'un document : la version
 * précédente rangeait dans « prêts à envoyer » tout fichier du cabinet, parce
 * que sa requête cherchait un statut qui n'existait plus et ne trouvait donc
 * jamais de demande. On y voyait des dizaines de documents qui n'attendaient
 * rien, et « à signer par vous » ne pouvait pas se remplir.
 *
 * ─── CET ÉCRAN SUIT, IL N'OUVRE PAS ────────────────────────────────────────
 *
 * Envoyer suppose de désigner des signataires : cela se fait depuis l'entente
 * de service ou l'onglet Signature du dossier, où client et consultant sont
 * déjà connus.
 */

function Section({
  titre,
  icone: Icone,
  lignes,
  vide,
  etiquettes,
}: {
  titre: string
  icone: typeof PenLine
  lignes: LigneTableau[]
  vide: string
  etiquettes: { divergence: string; requestedOn: string; expiresOn: string }
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
        <ListeSignatures lignes={lignes} etiquettes={etiquettes} />
      )}
    </section>
  )
}

export default async function SignaturesPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations("Signatures")
  const tableau = await tableauSignatures()

  const total =
    tableau.pretsAEnvoyer.length +
    tableau.aSigner.length +
    tableau.enAttenteDAutrui.length +
    tableau.signes.length +
    tableau.refuses.length +
    tableau.closes.length +
    tableau.archivees.length

  const etiquettes = {
    requestedOn: t("requestedOn"),
    expiresOn: t("expiresOn"),
    divergence: t("divergenceWarning"),
  }

  // L'ordre suit l'urgence : ce qui attend un geste de l'utilisateur d'abord,
  // ce qui est clos en dernier.
  const sections = [
    { titre: t("toSign"), icone: PenLine, lignes: tableau.aSigner },
    { titre: t("waitingOther"), icone: Clock, lignes: tableau.enAttenteDAutrui },
    { titre: t("ready"), icone: Send, lignes: tableau.pretsAEnvoyer },
    { titre: t("signed"), icone: Check, lignes: tableau.signes },
    { titre: t("declined"), icone: XCircle, lignes: tableau.refuses },
    { titre: t("closed"), icone: Archive, lignes: tableau.closes },
    // LES ARCHIVES EN DERNIER : c'est ce qu'on consulte le moins souvent, et
    // les placer plus haut repousserait vers le bas ce qui attend un geste.
    { titre: t("archived"), icone: Boxes, lignes: tableau.archivees },
  ]

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
            href="/agreements"
            className="mt-4 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-foreground transition-colors hover:bg-muted"
          >
            {t("openAgreements")}
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {sections.map((s) => (
            <Section
              key={s.titre}
              titre={s.titre}
              icone={s.icone}
              lignes={s.lignes}
              vide={t("emptySection")}
              etiquettes={etiquettes}
            />
          ))}
        </div>
      )}
    </div>
  )
}
