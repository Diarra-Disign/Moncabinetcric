"use client"

import * as React from "react"
import { Printer, Sheet, CalendarRange } from "lucide-react"
import { useTranslations, useLocale } from "next-intl"
import { useRouter, usePathname } from "@/i18n/routing"
import type { RegistreMensuel } from "@/lib/data/trust"

/**
 * Le registre du compte client pour un mois.
 *
 * ─── LE MOIS VIT DANS L'ADRESSE, PAS DANS UN ÉTAT REACT ────────────────────
 *
 * `?mois=2026-05` plutôt qu'un `useState`. Trois raisons, et la troisième est
 * la vraie :
 *
 *   · la lecture reste au serveur, donc sous la RLS, sans route d'API de plus ;
 *   · l'adresse se met en signet et se transmet — « regarde le registre de
 *     mai » devient un lien ;
 *   · L'IMPRESSION IMPRIME CE QU'ON VOIT. Avec un état React, imprimer une
 *     page rechargée depuis l'adresse rendrait un autre mois que celui affiché
 *     à l'écran. Sur une pièce destinée à un dossier comptable, c'est
 *     inacceptable.
 *
 * ─── LES MONTANTS SONT ALIGNÉS SUR LEURS CHIFFRES ──────────────────────────
 *
 * `tabular-nums` fixe la largeur des chiffres : sans elle, une colonne de
 * montants ondule et la comparaison visuelle d'un solde à l'autre — le geste
 * même qu'on fait en relisant un registre — devient pénible.
 */
export function RegistreMensuelSection({
  registre,
  mois,
}: {
  registre: RegistreMensuel
  mois: string
}) {
  const t = useTranslations("Trust")
  const locale = useLocale()
  const router = useRouter()
  const chemin = usePathname()

  const argent = React.useMemo(
    () => new Intl.NumberFormat(locale === "en" ? "en-CA" : "fr-CA", {
      style: "currency", currency: "CAD",
    }),
    [locale]
  )

  // Vingt-quatre mois en arrière : au-delà, on cherche par l'adresse. Une
  // liste déroulante de cent entrées ne se parcourt pas.
  const moisDisponibles = React.useMemo(() => {
    const liste: { valeur: string; libelle: string }[] = []
    const maintenant = new Date()
    const nom = new Intl.DateTimeFormat(locale === "en" ? "en-CA" : "fr-CA", {
      month: "long", year: "numeric", timeZone: "UTC",
    })
    for (let i = 0; i < 24; i++) {
      const d = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth() - i, 1))
      const valeur = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
      liste.push({ valeur, libelle: nom.format(d) })
    }
    // Le mois demandé peut être plus ancien que la liste — par l'adresse. On
    // l'ajoute plutôt que d'afficher un sélecteur qui contredit le tableau.
    if (!liste.some((m) => m.valeur === mois)) {
      const [a, m] = mois.split("-").map(Number)
      liste.push({ valeur: mois, libelle: nom.format(new Date(Date.UTC(a, m - 1, 1))) })
    }
    return liste
  }, [locale, mois])

  const changerMois = (valeur: string) => {
    router.push(`${chemin}?mois=${valeur}`)
  }

  const { totaux, lignes } = registre

  return (
    <section className="rounded-3xl border border-border bg-card p-6 shadow-xs print:border-0 print:shadow-none">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-black text-foreground">
            <CalendarRange aria-hidden className="h-4 w-4 text-primary-strong" />
            {t("monthlyHeading")}
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
            {t("monthlyIntro")}
          </p>
        </div>

        <div className="flex items-center gap-2 print:hidden">
          <label htmlFor="mois-registre" className="sr-only">{t("month")}</label>
          <select
            id="mois-registre"
            value={mois}
            onChange={(e) => changerMois(e.target.value)}
            className="min-h-9 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {moisDisponibles.map((m) => (
              <option key={m.valeur} value={m.valeur}>{m.libelle}</option>
            ))}
          </select>

          {/* La pièce imprimable est le PDF, non la page. Le §19 exige un
              en-tête portant le nom, l'adresse, le téléphone et le courriel du
              cabinet : la fenêtre d'impression du navigateur imprimerait la
              barre latérale et l'en-tête de l'application à la place. */}
          <a
            href={`/api/fideicommis/registre/pdf?mois=${mois}&lang=${locale}`}
            target="_blank"
            rel="noopener"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Printer aria-hidden className="h-3.5 w-3.5" />
            {t("print")}
          </a>

          <a
            href={`/api/fideicommis/registre?mois=${mois}`}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Sheet aria-hidden className="h-3.5 w-3.5" />
            {t("exportCsv")}
          </a>
        </div>
      </div>

      {lignes.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-xs text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-xs">
            <thead>
              <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="px-3 py-2 font-bold">{t("colClient")}</th>
                <th className="px-3 py-2 font-bold">{t("colLast")}</th>
                <th className="px-3 py-2 text-right font-bold">{t("colOpening")}</th>
                <th className="px-3 py-2 text-right font-bold">{t("colDeposits")}</th>
                <th className="px-3 py-2 text-right font-bold">{t("colWithdrawals")}</th>
                <th className="px-3 py-2 text-right font-bold">{t("colClosing")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lignes.map((l) => (
                <tr key={l.clientId}>
                  <td className="px-3 py-2.5 font-bold text-foreground">{l.clientNom}</td>
                  <td className="px-3 py-2.5 font-mono text-muted-foreground">
                    {l.dernierMouvement ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                    {argent.format(l.ouverture)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-success-strong">
                    {l.depots ? argent.format(l.depots) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-warning-strong">
                    {l.retraits ? argent.format(l.retraits) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right font-black tabular-nums text-foreground">
                    {argent.format(l.cloture)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border font-black text-foreground">
                <td className="px-3 py-3" colSpan={2}>{t("totals")}</td>
                <td className="px-3 py-3 text-right tabular-nums">{argent.format(totaux.ouverture)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{argent.format(totaux.depots)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{argent.format(totaux.retraits)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{argent.format(totaux.cloture)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* §33 : le total détenu, énoncé une seconde fois et en toutes lettres.
          Il figure déjà au bas de la colonne, mais c'est LE chiffre que l'on
          vient chercher — il mérite d'être lisible sans suivre une colonne. */}
      <div className="mt-5 flex flex-wrap items-baseline justify-between gap-2 rounded-2xl bg-muted/50 px-4 py-3">
        <span className="text-xs font-bold text-muted-foreground">{t("held")}</span>
        <span className="text-lg font-black tabular-nums text-foreground">
          {argent.format(totaux.cloture)}
        </span>
      </div>

      {/* §37 : aucune affirmation de conformité. L'outil tient le registre ;
          les obligations restent celles du consultant. */}
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        {t("responsibility")}
      </p>
    </section>
  )
}
