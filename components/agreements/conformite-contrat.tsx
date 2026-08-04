"use client"

import * as React from "react"
import { Check, CircleAlert, ExternalLink, ScrollText } from "lucide-react"
import {
  EXIGENCES_CONTRATS,
  SOURCE_CODE_CICC,
  type ElementContrat,
  type TypeContratCicc,
} from "@/lib/legal/cicc-contrats"

interface ConformiteContratProps {
  type: TypeContratCicc
  /** Éléments couverts par les données déjà saisies. La liste est calculée. */
  couvertsParLesDonnees: ReadonlySet<string>
  /** Éléments de rédaction que le titulaire atteste avoir inclus. */
  attestes: ReadonlySet<string>
  onBasculer: (ref: string) => void
}

/**
 * Ce que le Code exige d'un contrat, et ce qui manque encore.
 *
 * Deux natures d'éléments, traitées différemment parce qu'elles ne se
 * vérifient pas de la même façon :
 *
 * - ceux qui découlent de données saisies (identité, honoraires, délais) sont
 *   cochés automatiquement dès que la donnée existe ;
 * - ceux qui relèvent de clauses rédigées ne peuvent pas être vérifiés par
 *   cette application — lire une clause ne dit pas si elle couvre
 *   l'obligation. Ils sont donc attestés par le titulaire, à la main.
 *
 * Le panneau ne prononce jamais le mot « conforme ». Il dit ce qui manque, ou
 * qu'il ne constate aucun manque, ce qui n'est pas la même chose : le Code
 * comporte d'autres obligations que le contenu du contrat, et la suffisance
 * d'une clause relève du jugement du titulaire.
 */
export function ConformiteContrat({
  type,
  couvertsParLesDonnees,
  attestes,
  onBasculer,
}: ConformiteContratProps) {
  const exigences = EXIGENCES_CONTRATS[type]

  const estCouvert = React.useCallback(
    (e: ElementContrat) =>
      e.origine === "redaction" ? attestes.has(e.ref) : couvertsParLesDonnees.has(e.ref),
    [attestes, couvertsParLesDonnees]
  )

  const manquants = exigences.elements.filter((e) => !estCouvert(e))
  const parDonnees = exigences.elements.filter((e) => e.origine !== "redaction")
  const parRedaction = exigences.elements.filter((e) => e.origine === "redaction")

  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-800">
          <ScrollText className="h-4 w-4 text-slate-500" />
          Contenu exigé — article {exigences.article} du Code de déontologie
        </h4>
        <span
          className={`rounded-full px-3 py-1 text-[10px] font-bold ${
            manquants.length === 0
              ? "bg-emerald-100 text-emerald-900"
              : "bg-amber-100 text-amber-900"
          }`}
        >
          {manquants.length === 0
            ? "aucun manque constaté"
            : `${manquants.length} élément${manquants.length > 1 ? "s" : ""} à couvrir`}
        </span>
      </header>

      <p className="border-b border-slate-100 px-4 py-2.5 text-[11px] leading-relaxed text-slate-600">
        {exigences.declencheurFr}
      </p>

      <div className="space-y-4 px-4 py-4">
        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-500">
            Renseigné à partir des données saisies
          </p>
          <ul className="space-y-1">
            {parDonnees.map((e) => {
              const ok = couvertsParLesDonnees.has(e.ref)
              return (
                <li key={e.ref} className="flex items-start gap-2 text-[11px]">
                  {ok ? (
                    <Check className="mt-px h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  ) : (
                    <CircleAlert className="mt-px h-3.5 w-3.5 shrink-0 text-amber-600" />
                  )}
                  <span className={ok ? "text-slate-700" : "font-semibold text-amber-900"}>
                    <span className="font-mono text-[10px] text-slate-400">{e.ref}</span>{" "}
                    {e.labelFr}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>

        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-500">
            À couvrir par une clause — à confirmer par vous
          </p>
          <ul className="space-y-1">
            {parRedaction.map((e) => {
              const ok = attestes.has(e.ref)
              return (
                <li key={e.ref}>
                  <label className="flex cursor-pointer items-start gap-2 rounded-lg px-1.5 py-1 text-[11px] hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={ok}
                      onChange={() => onBasculer(e.ref)}
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className={ok ? "text-slate-700" : "text-slate-600"}>
                      <span className="font-mono text-[10px] text-slate-400">{e.ref}</span>{" "}
                      {e.labelFr}
                      <span className="mt-0.5 block text-[10px] italic leading-snug text-slate-400">
                        « {e.texte} »
                      </span>
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        </div>

        {exigences.obligationsAnnexes.length > 0 && (
          <div className="rounded-xl bg-slate-50 px-3 py-2.5">
            <p className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-slate-500">
              Obligations qui accompagnent ce contrat
            </p>
            <ul className="space-y-1 text-[10px] leading-relaxed text-slate-600">
              {exigences.obligationsAnnexes.map((o) => (
                <li key={o.ref}>
                  <span className="font-mono text-slate-400">{o.ref}</span> {o.texte}
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="border-t border-slate-100 pt-3 text-[10px] leading-relaxed text-slate-500">
          Cette liste reproduit le contenu énuméré à l’article {exigences.article} du{" "}
          {SOURCE_CODE_CICC.titre} ({SOURCE_CODE_CICC.reference}), version consultée le{" "}
          {SOURCE_CODE_CICC.consulteLe}. Elle indique ce qui manque parmi ces éléments ; elle
          n’établit pas que le contrat est conforme, le Code comportant d’autres obligations et
          la suffisance d’une clause relevant de votre appréciation.{" "}
          <a
            href={SOURCE_CODE_CICC.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-blue-700 underline"
          >
            Texte officiel <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </p>
      </div>
    </section>
  )
}
