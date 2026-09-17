"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import { CalendarDays, CheckCircle2, Clock, FileText } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Les trois vues de la maquette produit, et les primitives qu'elles partagent.
 *
 * Separe de `product-preview.tsx` pour garder chaque fichier dans la fourchette
 * de 200 a 400 lignes fixee par le CLAUDE.md. Le cadre de l'application — barre
 * de titre, rail, onglets — est la-bas ; ici, uniquement ce qui remplit le
 * panneau.
 */

/** Tons de statut du produit : teinte de fond, bordure assortie, texte contraste. */
export const TONS = {
  neutre: "border-border bg-muted text-muted-foreground",
  primaire: "border-primary/25 bg-primary/10 text-primary-strong",
  succes: "border-success/30 bg-success/15 text-success-strong",
  vigilance: "border-warning/40 bg-warning/15 text-warning-strong",
} as const
export type Ton = keyof typeof TONS

/**
 * Chiffres d'illustration. Ils restent dans le code et non dans les fichiers de
 * traduction : ce sont des entiers sous le millier, ecrits a l'identique en
 * francais et en anglais. Tout ce qui est du TEXTE passe par `next-intl`.
 */
const CHIFFRES = [48, 6, 14, 3] as const
const DOSSIERS = [
  { ref: "IMM-2026-0842", jours: 42, ton: "primaire" as Ton },
  { ref: "IMM-2026-0719", jours: 18, ton: "succes" as Ton },
  { ref: "IMM-2026-0655", jours: 5, ton: "vigilance" as Ton },
] as const
const SOLDE_FIDEICOMMIS = 48512.5
const MOUVEMENTS = [
  { ref: "IMM-2026-0842", montant: 3500 },
  { ref: "IMM-2026-0719", montant: -1250 },
  { ref: "IMM-2026-0655", montant: -155 },
] as const
const AVANCEMENT = 75

function Tuile({ libelle, valeur }: { libelle: string; valeur: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{libelle}</p>
      {/* `tabular-nums` : sans lui, les chiffres de largeurs differentes font
          osciller la ligne de base d'une tuile a l'autre. */}
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-foreground">{valeur}</p>
    </div>
  )
}

function Pastille({ ton, children }: { ton: Ton; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
        TONS[ton],
      )}
    >
      {children}
    </span>
  )
}

function Panneau({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <p className="border-b border-border/60 px-4 py-2.5 text-xs font-semibold text-foreground">{titre}</p>
      <div className="divide-y divide-border/60">{children}</div>
    </div>
  )
}

export function VueDossiers() {
  const t = useTranslations("Landing.preview")

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tuile libelle={t("matters.kpiMatters")} valeur={CHIFFRES[0]} />
        <Tuile libelle={t("matters.kpiDeadlines")} valeur={CHIFFRES[1]} />
        <Tuile libelle={t("matters.kpiTasks")} valeur={CHIFFRES[2]} />
        <Tuile libelle={t("matters.kpiMeetings")} valeur={CHIFFRES[3]} />
      </div>

      <Panneau titre={t("matters.listTitle")}>
        {DOSSIERS.map((dossier, index) => (
          // Une grille de 12 colonnes, et non une rangee flex : c'est ce qui
          // fait que les references, les types, les echeances et les statuts
          // s'alignent d'une ligne a l'autre. En flex, chaque ligne se calait
          // sur la longueur de son propre contenu.
          <div
            key={dossier.ref}
            className="flex flex-col gap-1.5 px-4 py-3 sm:grid sm:grid-cols-12 sm:items-center sm:gap-3"
          >
            <span className="font-mono text-xs font-medium text-muted-foreground sm:col-span-3">
              {dossier.ref}
            </span>
            <span className="text-xs font-medium text-foreground sm:col-span-4">
              {t(`matters.type${index + 1}` as "matters.type1")}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground sm:col-span-2">
              <Clock className="size-3.5 shrink-0 text-muted-foreground" />
              {t("deadlineIn", { jours: dossier.jours })}
            </span>
            <span className="sm:col-span-3 sm:justify-self-end">
              <Pastille ton={dossier.ton}>
                {t(`matters.status${index + 1}` as "matters.status1")}
              </Pastille>
            </span>
          </div>
        ))}
      </Panneau>
    </>
  )
}

export function VueFideicommis() {
  const t = useTranslations("Landing.preview")
  const locale = useLocale()

  // `formatMontant` (lib/billing/plans) laisse tomber les cents quand le
  // montant est rond — c'est voulu pour afficher « 49 $ » sur une carte de
  // tarif, et faux pour un grand livre, ou « 0 $ » ne se lit pas comme un
  // ecart nul. D'ou deux formateurs locaux a deux decimales imposees.
  const { solde, mouvement } = React.useMemo(() => {
    const base = {
      style: "currency" as const,
      currency: "CAD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
    const etiquette = locale === "en" ? "en-CA" : "fr-CA"
    return {
      solde: new Intl.NumberFormat(etiquette, base),
      mouvement: new Intl.NumberFormat(etiquette, { ...base, signDisplay: "exceptZero" }),
    }
  }, [locale])

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <Rapprochement
          libelle={t("trust.bankLabel")}
          montant={solde.format(SOLDE_FIDEICOMMIS)}
          note={t("trust.bankHint")}
        />
        <Rapprochement
          libelle={t("trust.ledgerLabel")}
          montant={solde.format(SOLDE_FIDEICOMMIS)}
          note={t("trust.ledgerHint")}
        />
        <Rapprochement
          libelle={t("trust.gapLabel")}
          montant={solde.format(0)}
          note={t("trust.gapHint")}
          equilibre
        />
      </div>

      <Panneau titre={t("trust.movementsTitle")}>
        {MOUVEMENTS.map((m, index) => (
          <div key={m.ref} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-foreground">
                {t(`trust.move${index + 1}` as "trust.move1")}
              </p>
              <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                {t("trust.subAccount")} · {m.ref}
              </p>
            </div>
            <span
              className={cn(
                "shrink-0 font-mono text-xs font-medium tabular-nums",
                m.montant > 0 ? "text-success-strong" : "text-foreground",
              )}
            >
              {mouvement.format(m.montant)}
            </span>
          </div>
        ))}
      </Panneau>
    </>
  )
}

function Rapprochement({
  libelle,
  montant,
  note,
  equilibre = false,
}: {
  libelle: string
  montant: string
  note: string
  equilibre?: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        equilibre ? "border-success/30 bg-success/10" : "border-border bg-card",
      )}
    >
      <p className="flex items-center justify-between gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {libelle}
        {equilibre ? <CheckCircle2 className="size-3.5 shrink-0 text-success-strong" /> : null}
      </p>
      <p
        className={cn(
          "mt-2 font-mono text-lg font-semibold tabular-nums tracking-tight",
          equilibre ? "text-success-strong" : "text-foreground",
        )}
      >
        {montant}
      </p>
      <p className={cn("mt-1 text-xs", equilibre ? "text-success-strong" : "text-muted-foreground")}>
        {note}
      </p>
    </div>
  )
}

export function VuePortail() {
  const t = useTranslations("Landing.preview")
  const pieces = [
    { ton: "succes" as Ton, icone: CheckCircle2 },
    { ton: "succes" as Ton, icone: CheckCircle2 },
    { ton: "primaire" as Ton, icone: Clock },
  ]

  return (
    <>
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-foreground">
            {t("portal.progressLabel", { pourcentage: AVANCEMENT })}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="size-3.5 text-muted-foreground" />
            {t("portal.progressStep")}
          </p>
        </div>
        {/* `w-3/4` et non `w-[75%]` : la fraction est sur l'echelle Tailwind,
            la valeur arbitraire est proscrite par le CLAUDE.md. */}
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full w-3/4 rounded-full bg-primary" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {pieces.map((piece, index) => {
          const Icone = piece.icone
          return (
            <div
              key={index}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
            >
              <div className="flex items-start gap-2.5">
                <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-foreground">
                    {t(`portal.doc${index + 1}` as "portal.doc1")}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t(`portal.doc${index + 1}Kind` as "portal.doc1Kind")}
                  </p>
                </div>
              </div>
              <Pastille ton={piece.ton}>
                <Icone className="size-3" />
                {t(`portal.doc${index + 1}Status` as "portal.doc1Status")}
              </Pastille>
            </div>
          )
        })}
      </div>
    </>
  )
}
