"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import { Eye, Send, Search, Plus, X, FolderOpen, ArrowUpRight } from "lucide-react"
import { useRouter } from "@/i18n/routing"
import type { FactureCabinet } from "@/lib/data/types"
import { envoyerFactureAuClient } from "@/lib/data/invoice-actions"
import { ConfirmationEnvoi } from "@/components/ui/confirmation-envoi"
import { PageHeader } from "@/components/app-shell/page-header"
import { libelleStatut, tonStatut } from "@/lib/invoices/statuts"
import { cn } from "@/lib/utils"

/**
 * La vue d'ensemble de la facturation du cabinet.
 *
 * CET ÉCRAN NE CRÉE PLUS DE FACTURE, et c'est le changement principal.
 *
 * Il en créait — mais en mémoire seulement. Le formulaire annonçait « Facture
 * émise avec succès », posait un numéro déduit de la longueur du tableau,
 * calculait la TPS et la TVQ dans le navigateur à des taux écrits en dur, et
 * n'écrivait rien en base. « Envoyer » annonçait un courriel qui ne partait
 * pas. « Supprimer » annonçait une annulation qu'un simple rechargement
 * démentait. Trois messages plus dangereux qu'une panne : une panne se voit.
 *
 * La création vit désormais là où le client et le dossier sont déjà connus —
 * dans le dossier. Deux formulaires, c'eût été deux calculs de taxes, et le
 * second aurait dérivé du premier. Ce que cet écran sait faire et que le
 * dossier ne saura jamais, c'est répondre à « qui me doit de l'argent, tous
 * dossiers confondus ? ».
 */

interface DossierChoisissable {
  reference: string
  clientNom: string
  programme: string
}

interface BillingClientProps {
  factures: FactureCabinet[]
  dossiers: DossierChoisissable[]
}

type Filtre = "all" | "draft" | "issued" | "partial" | "paid" | "overdue" | "cancelled"

export function BillingClient({ factures, dossiers }: BillingClientProps) {
  const t = useTranslations("Billing")
  const locale = useLocale()
  const routeur = useRouter()

  const [recherche, setRecherche] = React.useState("")
  const [filtre, setFiltre] = React.useState<Filtre>("all")
  const [choixDossier, setChoixDossier] = React.useState(false)
  const [aConfirmer, setAConfirmer] = React.useState<FactureCabinet | null>(null)
  const [resultat, setResultat] = React.useState<{ ok: boolean; message: string } | null>(null)

  const argent = React.useCallback(
    (v: number) =>
      new Intl.NumberFormat(locale === "en" ? "en-CA" : "fr-CA", {
        style: "currency", currency: "CAD",
      }).format(v),
    [locale]
  )

  // ---------------------------------------------------------------------
  // Les indicateurs, sur le statut RÉEL
  // ---------------------------------------------------------------------
  // « En attente » filtrait sur le statut « pending », que la base ne produit
  // pas : il affichait 0 $ quel que soit l'encours. Les quatre nombres
  // ci-dessous se lisent sur le statut calculé et sur le solde renvoyé par la
  // vue — jamais sur une arithmétique refaite ici.
  const vivantes = factures.filter((f) => f.statut !== "cancelled" && f.statut !== "draft")
  const totaux = {
    facture: vivantes.reduce((s, f) => s + f.montant, 0),
    encaisse: vivantes.reduce((s, f) => s + f.regle, 0),
    reste: vivantes.filter((f) => f.statut !== "paid").reduce((s, f) => s + f.solde, 0),
    retard: vivantes.filter((f) => f.statut === "overdue").reduce((s, f) => s + f.solde, 0),
  }

  const filtrees = factures.filter((f) => {
    const q = recherche.trim().toLowerCase()
    const correspond =
      q === "" ||
      f.numero.toLowerCase().includes(q) ||
      f.clientNom.toLowerCase().includes(q) ||
      (f.dossierReference ?? "").toLowerCase().includes(q) ||
      (f.description ?? "").toLowerCase().includes(q)
    return correspond && (filtre === "all" || f.statut === filtre)
  })

  const dossiersFiltres = dossiers.filter((d) => {
    const q = recherche.trim().toLowerCase()
    return q === "" || d.reference.toLowerCase().includes(q) || d.clientNom.toLowerCase().includes(q)
  })

  const FILTRES: Filtre[] = ["all", "draft", "issued", "partial", "overdue", "paid", "cancelled"]

  return (
    <div className="flex flex-col gap-6 pb-16">
      {resultat && (
        <div
          role="status"
          className={cn(
            "rounded-2xl border p-4 text-xs font-bold",
            resultat.ok
              ? "border-success/30 bg-success/10 text-success-strong"
              : "border-error/30 bg-error/10 text-error-strong"
          )}
        >
          {resultat.message}
        </div>
      )}

      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <button
            type="button"
            onClick={() => { setRecherche(""); setChoixDossier(true) }}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 cursor-pointer"
          >
            <Plus className="h-4 w-4" /> {t("newInvoice")}
          </button>
        }
      />

      {/* ---- Les quatre nombres ---- */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {([
          ["billed", totaux.facture, "text-foreground"],
          ["collected", totaux.encaisse, "text-success-strong"],
          ["outstanding", totaux.reste, "text-warning-strong"],
          ["overdue", totaux.retard, "text-error-strong"],
        ] as const).map(([cle, valeur, ton]) => (
          <div key={cle} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              {t(`overview.${cle}`)}
            </p>
            <p className={cn("mt-1 text-xl font-black tabular-nums", ton)}>{argent(valeur)}</p>
          </div>
        ))}
      </div>

      {/* ---- Recherche et filtres ---- */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex-1 min-w-64">
          <Search aria-hidden className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {FILTRES.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFiltre(f)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[11px] font-bold cursor-pointer transition-colors",
                filtre === f
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground hover:bg-muted"
              )}
            >
              {t(`filters.${f}`)}
            </button>
          ))}
        </div>
      </div>

      {/* ---- La liste ---- */}
      {filtrees.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-10 text-center text-xs text-muted-foreground">
          {factures.length === 0 ? t("emptyAll") : t("empty")}
        </p>
      ) : (
        <div className="space-y-2">
          {filtrees.map((f) => (
            <article key={f.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="flex flex-wrap items-center gap-2 text-sm font-black text-foreground">
                    {f.numero}
                    <span className={cn("rounded px-2 py-0.5 text-[10px] font-bold uppercase", tonStatut(f.statut))}>
                      {libelleStatut(f.statut, locale)}
                    </span>
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">{f.clientNom}</p>
                  {f.description && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{f.description}</p>
                  )}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {t("table.date")} {f.date}
                    {f.echeance && ` · ${t("table.due")} ${f.echeance}`}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-base font-black text-foreground tabular-nums">{argent(f.montant)}</p>
                  {/* Le solde n'est montré que s'il DIFFÈRE du montant : le
                      répéter sur une facture intacte noierait le cas — celui
                      d'un acompte reçu — sous le cas ordinaire. */}
                  {f.regle > 0 && (
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                      {t("table.balance")} {argent(f.solde)}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <a
                  href={`/api/invoices/${f.id}/pdf?lang=${locale}`}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[11px] font-bold text-foreground hover:bg-muted cursor-pointer"
                >
                  <Eye className="h-3.5 w-3.5" /> {t("actions.viewPdf")}
                </a>

                {f.statut !== "cancelled" && (
                  <button
                    type="button"
                    onClick={() => setAConfirmer(f)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[11px] font-bold text-foreground hover:bg-muted cursor-pointer"
                  >
                    <Send className="h-3.5 w-3.5" /> {t("actions.send")}
                  </button>
                )}

                {f.dossierReference && (
                  <button
                    type="button"
                    onClick={() => routeur.push(`/matters/${encodeURIComponent(f.dossierReference!)}`)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[11px] font-bold text-muted-foreground hover:bg-muted cursor-pointer"
                  >
                    <FolderOpen className="h-3.5 w-3.5" /> {f.dossierReference}
                    <ArrowUpRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* ---- Choisir le dossier où la facture doit naître ---- */}
      {choixDossier && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[200] flex items-center justify-center bg-foreground/50 p-4">
          <div className="flex max-h-[88vh] w-full max-w-lg flex-col rounded-2xl border border-border bg-card shadow-2xl">
            <header className="flex items-start justify-between gap-3 border-b border-border p-5">
              <div>
                <h2 className="text-base font-black text-foreground">{t("chooseMatterTitle")}</h2>
                <p className="mt-1 max-w-prose text-xs text-muted-foreground">{t("chooseMatterWhy")}</p>
              </div>
              <button
                type="button"
                onClick={() => { setChoixDossier(false); setRecherche("") }}
                aria-label="Fermer"
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="space-y-3 overflow-y-auto p-5">
              <input
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder={t("chooseMatterSearch")}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
              {dossiersFiltres.length === 0 ? (
                <p className="py-6 text-center text-xs italic text-muted-foreground">{t("noMatter")}</p>
              ) : (
                <div className="space-y-1.5">
                  {dossiersFiltres.slice(0, 40).map((d) => (
                    <button
                      key={d.reference}
                      type="button"
                      onClick={() => routeur.push(`/matters/${encodeURIComponent(d.reference)}`)}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-border px-3 py-2 text-left hover:border-primary hover:bg-primary/5 cursor-pointer"
                    >
                      <span className="min-w-0">
                        <span className="block text-xs font-bold text-foreground">{d.clientNom}</span>
                        <span className="block text-[11px] text-muted-foreground">
                          {d.reference}{d.programme ? ` · ${d.programme}` : ""}
                        </span>
                      </span>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Le bouton « Envoyer » POSE l'envoi, cette fenêtre l'exécute — la même
          règle et le même composant que partout ailleurs. */}
      {aConfirmer && (
        <ConfirmationEnvoi
          action={t("confirm.action")}
          objet={aConfirmer.numero}
          objetDetail={`${argent(aConfirmer.montant)}${aConfirmer.echeance ? ` · ${t("table.due")} ${aConfirmer.echeance}` : ""}`}
          destinataires={[{ nom: aConfirmer.clientNom, courriel: aConfirmer.clientCourriel ?? undefined }]}
          irreversible={aConfirmer.statut === "draft" ? t("confirm.draftWarning") : undefined}
          onAnnuler={() => setAConfirmer(null)}
          onConfirmer={async () => {
            const fd = new FormData()
            fd.set("id", aConfirmer.id)
            // Envoyer une facture, c'est l'émettre : laisser partir un document
            // marqué « brouillon » puis lui donner un autre numéro serait le
            // meilleur moyen de la faire payer deux fois — ou pas du tout.
            if (aConfirmer.statut === "draft") fd.set("emettre", "1")
            fd.set("locale", locale)
            const r = await envoyerFactureAuClient(fd)
            setAConfirmer(null)
            setResultat(r)
            if (r.ok) routeur.refresh()
          }}
        />
      )}
    </div>
  )
}
