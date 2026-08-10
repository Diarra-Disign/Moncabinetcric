"use client"

/* eslint-disable react-hooks/refs */

import * as React from "react"
import type { ClientQuestionnaire, QuestionnaireCorrection } from "@/lib/data/types"
import type { FormSectionShape, FormFieldShape } from "@/lib/data/types"
import { saveQuestionnaireProgress, submitQuestionnaire } from "@/lib/data/actions"
import { cn } from "@/lib/utils"
import { CheckCircle2, AlertCircle, Save, Send, Plus, Trash2, ArrowRight, ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"

export function QuestionnaireClient({
  questionnaire: initialQ,
  locale,
  isApercu,
}: {
  questionnaire: ClientQuestionnaire
  locale: string
  isApercu: boolean
}) {
  // Les questions viennent de l'envoi lui-même : c'est l'instantané pris au
  // moment où il est parti. Relire le modèle ici ferait bouger les champs
  // sous les réponses le jour où le cabinet le remanie.
  const sections = initialQ.sections
  const router = useRouter()
  const [answers, setAnswers] = React.useState<Record<string, unknown>>(initialQ.answers)
  const [activeSectionIdx, setActiveSectionIdx] = React.useState(0)
  const [progress, setProgress] = React.useState(initialQ.progress)
  const [status, setStatus] = React.useState(initialQ.status)
  const [saving, setSaving] = React.useState(false)
  const [lastSaved, setLastSaved] = React.useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = React.useState(false)

  // Calcule la progression automatiquement
  const computeProgress = (currentAnswers: Record<string, unknown>) => {
    let filled = 0
    let total = 0
    for (const section of sections) {
      for (const field of section.fields) {
        total++
        const val = currentAnswers[field.key]
        if (field.type === "repeater") {
          const list = (val as unknown[]) || []
          if (list.length > 0) filled++
        } else if (val !== undefined && val !== null && val !== "") {
          filled++
        }
      }
    }
    return Math.min(100, Math.round((filled / Math.max(1, total)) * 100))
  };

  // Sauvegarde automatique avec délai
  const timerRef = React.useRef<NodeJS.Timeout | null>(null)

  const triggerAutoSave = (updatedAnswers: Record<string, unknown>) => {
    const nextProg = computeProgress(updatedAnswers)
    setProgress(nextProg)

    if (timerRef.current) clearTimeout(timerRef.current)

    setSaving(true)
    timerRef.current = setTimeout(async () => {
      if (isApercu) {
        setSaving(false)
        setLastSaved(new Date().toLocaleTimeString())
        return
      }
      try {
        await saveQuestionnaireProgress(initialQ.id, updatedAnswers, nextProg)
        setLastSaved(new Date().toLocaleTimeString())
      } catch (err) {
        console.error("Auto-save error:", err)
      } finally {
        setSaving(false)
      }
    }, 1500)
  }

  React.useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const handleFieldChange = (key: string, value: unknown) => {
    if (status === "cancelled" || status === "completed") return
    const nextAnswers = { ...answers, [key]: value }
    setAnswers(nextAnswers)
    triggerAutoSave(nextAnswers)
  }

  const activeSection = sections[activeSectionIdx]

  // Rendu de chaque type de champ
  const renderField = (field: FormFieldShape, correction?: QuestionnaireCorrection) => {
    const val = answers[field.key]
    const label = locale === "en" ? field.labelEn : field.labelFr
    const placeholder = locale === "en" ? "Enter value..." : "Saisir la réponse..."

    return (
      <div key={field.key} className="space-y-2 p-4 rounded-xl border border-border bg-card">
        <label className="block text-xs font-bold text-foreground">
          {label} {field.required && <span className="text-error">*</span>}
        </label>

        {correction && (
          <div className="flex items-start gap-2 bg-error/10 text-error p-3 rounded-lg border border-error/25 text-xs mb-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold">Correction demandée :</span>
              <p className="mt-0.5">{correction.comment}</p>
            </div>
          </div>
        )}

        {field.type === "repeater" && (() => {
          const list = (val as Record<string, unknown>[]) || []
          return (
            <div className="space-y-3">
              {list.map((item, itemIdx) => (
                <div key={itemIdx} className="p-4 border border-border rounded-xl bg-muted/20 relative space-y-3">
                  <button
                    type="button"
                    onClick={() => {
                      const newList = [...list]
                      newList.splice(itemIdx, 1)
                      handleFieldChange(field.key, newList)
                    }}
                    className="absolute top-3 right-3 text-error hover:text-error/80 text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {field.fields?.map((sub) => {
                      const subLabel = locale === "en" ? sub.labelEn : sub.labelFr
                      return (
                        <label key={sub.key} className="block text-[10px] font-bold text-muted-foreground">
                          {subLabel} {sub.required && <span className="text-error">*</span>}
                          <input
                            type={sub.type === "date" ? "date" : sub.type === "number" ? "number" : "text"}
                            value={String(item[sub.key] || "")}
                            onChange={(e) => {
                              const newList = [...list]
                              newList[itemIdx] = { ...newList[itemIdx], [sub.key]: e.target.value }
                              handleFieldChange(field.key, newList)
                            }}
                            className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground mt-1 focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() => {
                  const newList = [...list, {}]
                  handleFieldChange(field.key, newList)
                }}
                className="px-3 py-2 rounded-xl border border-border hover:bg-muted font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer text-foreground"
              >
                <Plus className="h-3.5 w-3.5" /> {locale === "en" ? "Add item" : "Ajouter un élément"}
              </button>
            </div>
          )
        })()}

        {field.type === "select" && (
          <select
            value={String(val || "")}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            disabled={status === "cancelled" || status === "completed"}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">{locale === "en" ? "Select..." : "Choisir..."}</option>
            {field.options?.map((o) => (
              <option key={o.value} value={o.value}>
                {locale === "en" ? o.labelEn : o.labelFr}
              </option>
            ))}
          </select>
        )}

        {field.type === "radio" && (
          <div className="flex gap-4 mt-1">
            {field.options?.map((o) => (
              <label key={o.value} className="flex items-center gap-2 text-xs text-foreground font-bold cursor-pointer">
                <input
                  type="radio"
                  name={field.key}
                  value={o.value}
                  checked={val === o.value}
                  disabled={status === "cancelled" || status === "completed"}
                  onChange={() => handleFieldChange(field.key, o.value)}
                  className="accent-primary"
                />
                {locale === "en" ? o.labelEn : o.labelFr}
              </label>
            ))}
          </div>
        )}

        {field.type === "text" && (
          <input
            type="text"
            value={String(val || "")}
            placeholder={placeholder}
            disabled={status === "cancelled" || status === "completed"}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        )}

        {field.type === "number" && (
          <input
            type="number"
            value={String(val || "")}
            placeholder="0"
            disabled={status === "cancelled" || status === "completed"}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        )}

        {field.type === "date" && (
          <input
            type="date"
            value={String(val || "")}
            disabled={status === "cancelled" || status === "completed"}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        )}

        {field.type === "file" && (
          <div className="flex flex-col gap-2">
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              disabled={status === "cancelled" || status === "completed"}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  // Simule le téléversement de fichier pour les mocks
                  handleFieldChange(field.key, file.name)
                }
              }}
              className="text-xs text-muted-foreground file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-primary/10 file:text-primary-strong hover:file:bg-primary/20 file:cursor-pointer"
            />
            {/* La réponse est typée `unknown` : ramener la condition à un
                booléen, faute de quoi c'est `unknown` que React reçoit. */}
            {Boolean(val) && (
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-success" /> {String(val)}
              </span>
            )}
          </div>
        )}
      </div>
    )
  }

  const handleFinalSubmit = async () => {
    if (isApercu) {
      setSubmitSuccess(true)
      setStatus("submitted")
      return
    }

    try {
      setSaving(true)
      await submitQuestionnaire(initialQ.id)
      setSubmitSuccess(true)
      setStatus("submitted")
    } catch (err) {
      console.error("Submission error:", err)
    } finally {
      setSaving(false)
    }
  }

  if (submitSuccess) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-6 bg-card border border-border rounded-2xl p-6 shadow-md">
        <CheckCircle2 className="h-16 w-16 text-success mx-auto" />
        <div className="space-y-2">
          <h2 className="text-xl font-black text-foreground">
            {locale === "en" ? "Questionnaire submitted!" : "Questionnaire soumis avec succès !"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {locale === "en"
              ? "Your consultant has been notified and will review your answers soon."
              : "Votre consultant a été notifié et va pouvoir passer à la révision de vos réponses."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            router.push(`/${locale}`)
            router.refresh()
          }}
          className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/95 text-white font-bold text-xs transition-colors cursor-pointer"
        >
          {locale === "en" ? "Return to Portal" : "Retourner au portail"}
        </button>
      </div>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-4 items-start">
      {/* Sidebar: Navigation des sections et progression */}
      <div className="lg:col-span-1 bg-card border border-border rounded-2xl p-5 space-y-6">
        <div className="space-y-2">
          <span className="text-[10px] uppercase font-black tracking-wider text-muted-foreground">Progression</span>
          <div className="flex items-center justify-between text-xs font-bold text-foreground">
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div className="bg-primary h-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="space-y-1">
          <span className="text-[10px] uppercase font-black tracking-wider text-muted-foreground block mb-2">Sections</span>
          {sections.map((sec, idx) => {
            const hasCorrection = initialQ.corrections.some((c) => c.sectionId === sec.id && c.status === "pending")
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => setActiveSectionIdx(idx)}
                className={cn(
                  "w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer",
                  idx === activeSectionIdx
                    ? "bg-primary text-white shadow-sm"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <span>{locale === "en" ? sec.titleEn : sec.titleFr}</span>
                {hasCorrection && (
                  <AlertCircle className={cn("h-4 w-4 shrink-0", idx === activeSectionIdx ? "text-white" : "text-error")} />
                )}
              </button>
            )
          })}
        </div>

        <div className="pt-4 border-t border-border flex flex-col gap-1 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Save className="h-3.5 w-3.5" />
            {saving ? (
              <span>{locale === "en" ? "Saving..." : "Sauvegarde automatique..."}</span>
            ) : lastSaved ? (
              <span>{locale === "en" ? `Last saved at ${lastSaved}` : `Enregistré à ${lastSaved}`}</span>
            ) : (
              <span>{locale === "en" ? "Changes saved automatically" : "Changements enregistrés automatiquement"}</span>
            )}
          </div>
        </div>
      </div>

      {/* Main Form Area */}
      <div className="lg:col-span-3 space-y-6">
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h2 className="text-base font-black text-foreground">
            {locale === "en" ? activeSection.titleEn : activeSection.titleFr}
          </h2>

          <div className="space-y-4">
            {activeSection.fields.map((field) => {
              const corr = initialQ.corrections.find((c) => c.sectionId === activeSection.id && c.fieldKey === field.key && c.status === "pending")
              return renderField(field, corr)
            })}
          </div>

          {/* Boutons de navigation */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <button
              type="button"
              disabled={activeSectionIdx === 0}
              onClick={() => setActiveSectionIdx((prev) => prev - 1)}
              className="px-4 py-2 rounded-xl border border-border hover:bg-muted font-bold text-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-foreground flex items-center gap-1.5"
            >
              <ArrowLeft className="h-4 w-4" /> {locale === "en" ? "Previous" : "Précédent"}
            </button>

            {activeSectionIdx < sections.length - 1 ? (
              <button
                type="button"
                onClick={() => setActiveSectionIdx((prev) => prev + 1)}
                className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/95 text-white font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                {locale === "en" ? "Next" : "Suivant"} <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={status === "cancelled" || status === "completed"}
                onClick={handleFinalSubmit}
                className="px-4 py-2 rounded-xl bg-success hover:bg-success/90 text-white font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Send className="h-4 w-4" /> {locale === "en" ? "Submit Questionnaire" : "Soumettre le questionnaire"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
