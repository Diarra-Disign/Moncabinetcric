"use client"

import * as React from "react"
import { Plus, Trash2, ArrowUp, ArrowDown, AlertTriangle, Check, Split, Landmark } from "lucide-react"
import {
  MODES_PAIEMENT, etatEcheancier, recalculer, repartirEnParts,
  type EtapePaiement,
} from "@/lib/ententes/echeancier"
import { cn } from "@/lib/utils"

/**
 * L'éditeur du contenu personnalisé d'un contrat.
 *
 * IL NE TOUCHE PAS AU DESIGN DU DOCUMENT. Le §30 est explicite : la mise en
 * page du PDF est approuvée. Ce composant remplit des champs ; ce que le PDF
 * en fait n'a pas changé de style — il emprunte la typographie des articles et
 * les bandeaux du tableau des honoraires qui existaient déjà.
 */

const CHAMP =
  "w-full px-3 py-2 text-xs font-medium rounded-lg bg-muted/50 border border-border " +
  "focus:bg-card focus:border-primary focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-primary transition-all text-foreground"
const ETIQUETTE = "text-[11px] font-bold text-muted-foreground"
const TITRE = "text-[10px] font-black uppercase tracking-wider text-muted-foreground"

export interface ContenuContrat {
  servicesDescription: string
  servicesItems: { position: number; libelle: string }[]
  echeancier: EtapePaiement[]
  modesPaiement: string[]
  conditionsPaiement: string
  fraisNonInclus: string
}

export const CONTENU_VIDE: ContenuContrat = {
  servicesDescription: "",
  servicesItems: [],
  echeancier: [],
  modesPaiement: [],
  conditionsPaiement: "",
  fraisNonInclus: "",
}

const argent = (v: number) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(v)

export function EditeurContenu({
  contenu,
  onChange,
  honoraires,
  proBono,
  isConsultation = false,
}: {
  contenu: ContenuContrat
  onChange: (c: ContenuContrat) => void
  honoraires: number
  proBono: boolean
  isConsultation?: boolean
}) {
  const maj = (partiel: Partial<ContenuContrat>) => onChange({ ...contenu, ...partiel })

  // ── Services décomposés ──────────────────────────────────────────────────
  const majService = (i: number, libelle: string) => {
    const copie = [...contenu.servicesItems]
    copie[i] = { ...copie[i], libelle }
    maj({ servicesItems: copie })
  }
  const deplacerService = (i: number, sens: -1 | 1) => {
    const j = i + sens
    if (j < 0 || j >= contenu.servicesItems.length) return
    const copie = [...contenu.servicesItems]
    ;[copie[i], copie[j]] = [copie[j], copie[i]]
    maj({ servicesItems: copie.map((x, k) => ({ ...x, position: k + 1 })) })
  }

  // ── Échéancier ───────────────────────────────────────────────────────────
  const etapes = contenu.echeancier
  const etat = etatEcheancier(etapes, honoraires)

  const majEtape = (i: number, champ: keyof EtapePaiement, valeur: string | number) => {
    const copie = [...etapes]
    copie[i] = {
      ...copie[i],
      [champ]: champ === "fideicommis" ? valeur === 1 : valeur,
    }
    maj({ echeancier: recalculer(copie, honoraires) })
  }
  const deplacerEtape = (i: number, sens: -1 | 1) => {
    const j = i + sens
    if (j < 0 || j >= etapes.length) return
    const copie = [...etapes]
    ;[copie[i], copie[j]] = [copie[j], copie[i]]
    maj({ echeancier: copie.map((x, k) => ({ ...x, position: k + 1 })) })
  }
  const ajouterEtape = () =>
    maj({
      echeancier: [
        ...etapes,
        {
          position: etapes.length + 1,
          description: "",
          declenchement: "",
          base: "montant" as const,
          montant: Math.max(0, etat.reste),
          statut: "a_venir" as const,
        },
      ],
    })

  const repartir = (parts: number) => {
    const montants = repartirEnParts(honoraires, parts)
    maj({
      echeancier: montants.map((montant, i) => ({
        position: i + 1,
        description: etapes[i]?.description ?? "",
        declenchement: etapes[i]?.declenchement ?? "",
        mode: etapes[i]?.mode ?? "",
        base: "montant" as const,
        montant,
        statut: (etapes[i]?.statut ?? "a_venir") as EtapePaiement["statut"],
      })),
    })
  }

  return (
    <div className="space-y-5">
      {/* ── Description des services / Précisions ──────────────────────── */}
      <section className="space-y-2">
        <h4 className={TITRE}>
          {isConsultation ? "Précisions ou résumé de la consultation" : "Description des services"}
        </h4>
        <textarea
          rows={isConsultation ? 3 : 4}
          className={CHAMP}
          placeholder={
            isConsultation
              ? "Précisions sur les sujets abordés lors de la consultation (ex: évaluation du profil Entrée express, examen de l'admissibilité au permis de travail…)"
              : "Services professionnels relatifs à la préparation et à la présentation d'une demande de permis de travail, incluant l'analyse de l'admissibilité…"
          }
          value={contenu.servicesDescription}
          onChange={(e) => maj({ servicesDescription: e.target.value })}
        />
        <p className="text-[11px] text-muted-foreground">
          Ce texte s&apos;imprime tel quel dans le contrat. Les sauts de ligne sont conservés.
        </p>
      </section>

      {/* ── Services décomposés (Mandats uniquement) ───────────────────── */}
      {!isConsultation && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className={TITRE}>Services inclus</h4>
            <button
              type="button"
              onClick={() =>
                maj({
                  servicesItems: [
                    ...contenu.servicesItems,
                    { position: contenu.servicesItems.length + 1, libelle: "" },
                  ],
                })
              }
              className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-bold text-foreground hover:bg-muted cursor-pointer"
            >
              <Plus className="h-3 w-3" /> Ajouter un service
            </button>
          </div>
          {contenu.servicesItems.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              Facultatif. À remplir lorsque le mandat comprend plusieurs prestations distinctes.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {contenu.servicesItems.map((s, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-xs font-black text-primary-strong">{i + 1}</span>
                  <input
                    type="text"
                    className={CHAMP}
                    placeholder="Vérification des pièces justificatives"
                    value={s.libelle}
                    onChange={(e) => majService(i, e.target.value)}
                  />
                  <button
                    type="button"
                    aria-label="Monter"
                    disabled={i === 0}
                    onClick={() => deplacerService(i, -1)}
                    className="p-1 rounded hover:bg-muted text-muted-foreground disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Descendre"
                    disabled={i === contenu.servicesItems.length - 1}
                    onClick={() => deplacerService(i, 1)}
                    className="p-1 rounded hover:bg-muted text-muted-foreground disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Supprimer"
                    onClick={() =>
                      maj({
                        servicesItems: contenu.servicesItems
                          .filter((_, k) => k !== i)
                          .map((x, k) => ({ ...x, position: k + 1 })),
                      })
                    }
                    className="p-1 rounded hover:bg-error/10 text-muted-foreground hover:text-error-strong cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ── Échéancier (Mandats uniquement) ────────────────────────────── */}
      {!isConsultation && !proBono && (
        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className={TITRE}>Échéancier des paiements</h4>
            <div className="flex items-center gap-1.5">
              {[2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => repartir(n)}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-bold text-foreground hover:bg-muted cursor-pointer"
                >
                  <Split className="h-3 w-3" /> {n} parts
                </button>
              ))}
              <button
                type="button"
                onClick={ajouterEtape}
                className="inline-flex items-center gap-1 rounded-lg bg-primary px-2 py-1 text-[11px] font-bold text-primary-foreground hover:bg-primary/90 cursor-pointer"
              >
                <Plus className="h-3 w-3" /> Ajouter une étape
              </button>
            </div>
          </div>

          {etapes.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              Facultatif. Sans échéancier, le contrat annonce les honoraires en un seul montant.
            </p>
          ) : (
            <>
              <ul className="space-y-2">
                {etapes.map((e, i) => (
                  <li key={i} className="rounded-xl border border-border bg-muted/20 p-2.5 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 shrink-0 text-xs font-black text-primary-strong">{i + 1}</span>
                      <input
                        type="text"
                        className={CHAMP}
                        placeholder="Paiement initial"
                        value={e.description}
                        onChange={(ev) => majEtape(i, "description", ev.target.value)}
                      />
                      <button
                        type="button"
                        aria-label="Monter"
                        onClick={() => deplacerEtape(i, -1)}
                        className="p-1 rounded hover:bg-muted text-muted-foreground cursor-pointer"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        aria-label="Descendre"
                        onClick={() => deplacerEtape(i, 1)}
                        className="p-1 rounded hover:bg-muted text-muted-foreground cursor-pointer"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        aria-label="Retirer"
                        onClick={() =>
                          maj({
                            echeancier: etapes
                              .filter((_, k) => k !== i)
                              .map((x, k) => ({ ...x, position: k + 1 })),
                          })
                        }
                        className="p-1 rounded hover:bg-error/10 text-muted-foreground hover:text-error-strong cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-4">
                      <div className="flex flex-col gap-1">
                        <label className={ETIQUETTE}>Déclenchement</label>
                        <input
                          type="text"
                          className={CHAMP}
                          placeholder="À la signature"
                          value={e.declenchement ?? ""}
                          onChange={(ev) => majEtape(i, "declenchement", ev.target.value)}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className={ETIQUETTE}>Mode</label>
                        <select
                          className={CHAMP}
                          value={e.mode ?? ""}
                          onChange={(ev) => majEtape(i, "mode", ev.target.value)}
                        >
                          <option value="">Non précisé</option>
                          {MODES_PAIEMENT.map((mo) => (
                            <option key={mo.valeur} value={mo.valeur}>
                              {mo.fr}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className={ETIQUETTE}>Base</label>
                        <select
                          className={CHAMP}
                          value={e.base}
                          onChange={(ev) => majEtape(i, "base", ev.target.value)}
                        >
                          <option value="montant">Montant fixe</option>
                          <option value="pourcentage">% des honoraires</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className={ETIQUETTE}>
                          {e.base === "pourcentage" ? "Pourcentage" : "Montant"}
                        </label>
                        {e.base === "pourcentage" ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              className={CHAMP}
                              value={String(e.pourcentage ?? "")}
                              onChange={(ev) =>
                                majEtape(i, "pourcentage", Number(ev.target.value) || 0)
                              }
                            />
                            <span className="shrink-0 text-[11px] font-bold text-foreground">
                              = {argent(e.montant)}
                            </span>
                          </div>
                        ) : (
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            className={CHAMP}
                            value={String(e.montant ?? "")}
                            onChange={(ev) =>
                              majEtape(i, "montant", Number(ev.target.value) || 0)
                            }
                          />
                        )}
                      </div>
                    </div>

                    <label
                      className={cn(
                        "flex items-start gap-2 rounded-lg border px-2.5 py-2 cursor-pointer transition-colors",
                        e.fideicommis
                          ? "border-primary/40 bg-primary/5"
                          : "border-border hover:bg-muted/40"
                      )}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 accent-[var(--color-primary)]"
                        checked={e.fideicommis === true}
                        onChange={(ev) => majEtape(i, "fideicommis", ev.target.checked ? 1 : 0)}
                      />
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 text-[11px] font-bold text-foreground">
                          <Landmark className="h-3 w-3 text-primary-strong" />
                          Ce versement entre en fidéicommis (art. 13)
                        </span>
                        <span className="block text-[11px] text-muted-foreground">
                          À cocher lorsque la somme est reçue AVANT que le service ne soit rendu.
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>

              <div
                role="status"
                className={cn(
                  "flex items-start gap-2 rounded-xl border p-2.5 text-[11px] font-bold",
                  etat.equilibre
                    ? "border-success/40 bg-success/10 text-success-strong"
                    : "border-warning/40 bg-warning/10 text-warning-strong"
                )}
              >
                {etat.equilibre ? (
                  <Check className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                )}
                <span>
                  {etat.message}{" "}
                  <span className="font-semibold">
                    Réparti : {argent(etat.reparti)} sur {argent(honoraires)}.
                  </span>
                </span>
              </div>
            </>
          )}
        </section>
      )}

      {/* ── Modes acceptés (§11) ──────────────────────────────────────── */}
      {!proBono && (
        <section className="space-y-2">
          <h4 className={TITRE}>Modes de paiement acceptés</h4>
          <div className="flex flex-wrap gap-1.5">
            {MODES_PAIEMENT.map((mo) => {
              const actif = contenu.modesPaiement.includes(mo.valeur)
              return (
                <button
                  key={mo.valeur}
                  type="button"
                  aria-pressed={actif}
                  onClick={() =>
                    maj({
                      modesPaiement: actif
                        ? contenu.modesPaiement.filter((v) => v !== mo.valeur)
                        : [...contenu.modesPaiement, mo.valeur],
                    })
                  }
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-colors cursor-pointer",
                    actif
                      ? "border-primary bg-primary/10 text-primary-strong"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  {mo.fr}
                </button>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Conditions et frais (§13, §14) ────────────────────────────── */}
      <section className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className={TITRE}>
            {isConsultation ? "Modalités particulières de paiement" : "Conditions particulières de paiement"}
          </label>
          <textarea
            rows={3}
            className={CHAMP}
            placeholder={
              isConsultation
                ? "Honoraires payables en totalité préalablement à la tenue de la consultation…"
                : "Le paiement prévu à chaque étape doit être effectué avant le début des travaux correspondants."
            }
            value={contenu.conditionsPaiement}
            onChange={(e) => maj({ conditionsPaiement: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <label className={TITRE}>Frais non inclus dans les honoraires</label>
          <textarea
            rows={3}
            className={CHAMP}
            placeholder={
              isConsultation
                ? "Frais de demandes officielles ultérieures, débours administratifs ou démarches de représentation…"
                : "Frais gouvernementaux, biométrie, examens médicaux, traduction certifiée…"
            }
            value={contenu.fraisNonInclus}
            onChange={(e) => maj({ fraisNonInclus: e.target.value })}
          />
        </div>
      </section>
    </div>
  )
}
