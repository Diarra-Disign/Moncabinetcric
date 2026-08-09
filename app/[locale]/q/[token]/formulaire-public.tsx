"use client"

import * as React from "react"
import { CheckCircle2, AlertCircle, Save, Send, Plus, Trash2, Info } from "lucide-react"
import type { FormFieldShape } from "@/lib/data/types"
import type { QuestionnairePublic } from "@/lib/data/questionnaire-public"
import { enregistrerParJeton, soumettreParJeton } from "@/lib/data/questionnaire-public"
import { cn } from "@/lib/utils"

const CHAMP =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"

/**
 * Le formulaire tel que le remplit un destinataire sans compte.
 *
 * Deux points méritent d'être signalés.
 *
 * Le pré-remplissage (§25) n'écrase jamais une réponse : il ne sert que de
 * valeur de départ, et le champ dit « déjà connu » tant que la valeur n'a pas
 * bougé. Sans cette distinction, on ne saurait plus si le destinataire a
 * confirmé son adresse ou s'il ne l'a simplement jamais regardée — ce qui
 * compte quand on signe une déclaration.
 *
 * L'enregistrement est différé d'une seconde et demie après la dernière
 * frappe. Enregistrer à chaque caractère produirait une requête par lettre.
 */
export function FormulairePublic({
  jeton, questionnaire, locale,
}: {
  jeton: string
  questionnaire: QuestionnairePublic
  locale: string
}) {
  const fr = locale !== "en"
  const clos = questionnaire.status === "completed" || questionnaire.status === "cancelled"
  const expire = questionnaire.status === "expired"

  const [reponses, setReponses] = React.useState<Record<string, unknown>>(() => ({
    ...questionnaire.prefill,
    ...questionnaire.answers,
  }))
  const [section, setSection] = React.useState(0)
  const [enregistrement, setEnregistrement] = React.useState(false)
  const [dernier, setDernier] = React.useState<string | null>(null)
  const [erreur, setErreur] = React.useState<string | null>(null)
  const [soumis, setSoumis] = React.useState(Boolean(questionnaire.submittedAt))

  const minuterie = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  React.useEffect(() => () => { if (minuterie.current) clearTimeout(minuterie.current) }, [])

  const progression = React.useCallback((valeurs: Record<string, unknown>) => {
    let remplis = 0
    let total = 0
    for (const s of questionnaire.sections) {
      for (const f of s.fields) {
        total++
        const v = valeurs[f.key]
        if (f.type === "repeater") {
          if (((v as unknown[]) ?? []).length > 0) remplis++
        } else if (v !== undefined && v !== null && v !== "") remplis++
      }
    }
    return Math.min(100, Math.round((remplis / Math.max(1, total)) * 100))
  }, [questionnaire.sections])

  const changer = (cle: string, valeur: unknown) => {
    if (clos || expire) return
    const suivantes = { ...reponses, [cle]: valeur }
    setReponses(suivantes)

    if (minuterie.current) clearTimeout(minuterie.current)
    setEnregistrement(true)
    minuterie.current = setTimeout(async () => {
      const r = await enregistrerParJeton(jeton, suivantes, progression(suivantes))
      setEnregistrement(false)
      if (r.ok) { setDernier(new Date().toLocaleTimeString(fr ? "fr-CA" : "en-CA")); setErreur(null) }
      else setErreur(r.message)
    }, 1500)
  }

  const pct = progression(reponses)
  const sectionCourante = questionnaire.sections[section]

  if (soumis) {
    return (
      <div className="rounded-2xl border border-success/30 bg-success/10 p-8 text-center space-y-3">
        <CheckCircle2 className="h-10 w-10 text-success-strong mx-auto" />
        <h2 className="text-lg font-black text-foreground">
          {fr ? "Questionnaire transmis" : "Questionnaire submitted"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {fr
            ? `${questionnaire.firmName} a bien reçu vos réponses. Vous serez contacté si une précision est nécessaire.`
            : `${questionnaire.firmName} has received your answers. You will be contacted if anything needs clarifying.`}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {questionnaire.message && (
        <div className="rounded-2xl border border-border bg-card p-4 text-sm text-foreground whitespace-pre-wrap">
          {questionnaire.message}
        </div>
      )}

      {expire && (
        <p className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs text-warning-strong flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          {fr
            ? "La date limite est dépassée. Vos réponses sont conservées, mais vous ne pouvez plus les modifier. Contactez le cabinet pour qu'il prolonge le délai."
            : "The deadline has passed. Your answers are kept, but you can no longer edit them. Contact the firm to extend it."}
        </p>
      )}

      {questionnaire.corrections.filter((c) => c.status === "pending").length > 0 && (
        <div className="rounded-xl border border-error/30 bg-error/10 p-4 space-y-2">
          <p className="text-xs font-black text-error-strong uppercase tracking-wider">
            {fr ? "Corrections demandées" : "Corrections requested"}
          </p>
          <ul className="space-y-1">
            {questionnaire.corrections.filter((c) => c.status === "pending").map((c, i) => (
              <li key={i} className="text-xs text-error-strong">• {c.comment}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{fr ? "Progression" : "Progress"} : <strong className="text-foreground">{pct} %</strong></span>
          <span>
            {enregistrement
              ? (fr ? "Enregistrement…" : "Saving…")
              : dernier
                ? (fr ? `Enregistré à ${dernier}` : `Saved at ${dernier}`)
                : ""}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {erreur && (
        <p className="rounded-xl border border-error/30 bg-error/10 p-3 text-xs text-error-strong flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /> {erreur}
        </p>
      )}

      <nav className="flex flex-wrap gap-1.5">
        {questionnaire.sections.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSection(i)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer",
              i === section ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            {fr ? s.titleFr : s.titleEn}
          </button>
        ))}
      </nav>

      {sectionCourante && (
        <section className="space-y-3">
          <h2 className="text-sm font-black text-foreground">
            {fr ? sectionCourante.titleFr : sectionCourante.titleEn}
          </h2>
          {sectionCourante.fields.map((f) => (
            <Champ
              key={f.key}
              champ={f}
              valeur={reponses[f.key]}
              prerempli={questionnaire.prefill[f.key]}
              desactive={clos || expire}
              fr={fr}
              onChange={changer}
            />
          ))}
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div className="flex gap-2">
          <button
            type="button"
            disabled={section === 0}
            onClick={() => setSection((s) => Math.max(0, s - 1))}
            className="px-4 py-2 rounded-xl border border-border font-bold text-xs hover:bg-muted disabled:opacity-40 cursor-pointer text-foreground"
          >
            {fr ? "Précédent" : "Previous"}
          </button>
          <button
            type="button"
            disabled={section >= questionnaire.sections.length - 1}
            onClick={() => setSection((s) => Math.min(questionnaire.sections.length - 1, s + 1))}
            className="px-4 py-2 rounded-xl border border-border font-bold text-xs hover:bg-muted disabled:opacity-40 cursor-pointer text-foreground"
          >
            {fr ? "Suivant" : "Next"}
          </button>
        </div>

        <button
          type="button"
          disabled={clos || expire}
          onClick={async () => {
            if (minuterie.current) clearTimeout(minuterie.current)
            await enregistrerParJeton(jeton, reponses, pct)
            const r = await soumettreParJeton(jeton)
            if (r.ok) setSoumis(true)
            else setErreur(r.message)
          }}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 disabled:opacity-40 cursor-pointer"
        >
          <Send className="h-4 w-4" /> {fr ? "Transmettre au cabinet" : "Submit to the firm"}
        </button>
      </div>

      <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
        <Save className="h-3 w-3" />
        {fr
          ? "Vos réponses sont enregistrées au fur et à mesure : vous pouvez fermer cette page et y revenir."
          : "Your answers are saved as you go: you can close this page and come back."}
      </p>
    </div>
  )
}

function Champ({
  champ, valeur, prerempli, desactive, fr, onChange,
}: {
  champ: FormFieldShape
  valeur: unknown
  prerempli: unknown
  desactive: boolean
  fr: boolean
  onChange: (cle: string, v: unknown) => void
}) {
  const libelle = fr ? champ.labelFr : champ.labelEn
  // « Déjà connu » ne s'affiche que tant que la valeur n'a pas bougé : dès que
  // le destinataire corrige, la mention disparaît, et le cabinet lit une
  // information confirmée plutôt qu'une information supposée.
  const intact = prerempli != null && String(prerempli) === String(valeur ?? "")

  return (
    <div className="space-y-1.5 rounded-xl border border-border bg-card p-4">
      <label className="block text-xs font-bold text-foreground">
        {libelle} {champ.required && <span className="text-error-strong">*</span>}
        {intact && (
          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
            <Info className="h-3 w-3" /> {fr ? "Déjà connu — corrigez si besoin" : "Already on file — edit if needed"}
          </span>
        )}
      </label>

      {champ.type === "repeater" ? (
        <Repeteur champ={champ} valeur={valeur} desactive={desactive} fr={fr} onChange={onChange} />
      ) : champ.type === "select" ? (
        <select
          value={String(valeur ?? "")}
          disabled={desactive}
          onChange={(e) => onChange(champ.key, e.target.value)}
          className={CHAMP}
        >
          <option value="">{fr ? "Choisir…" : "Select…"}</option>
          {champ.options?.map((o) => (
            <option key={o.value} value={o.value}>{fr ? o.labelFr : o.labelEn}</option>
          ))}
        </select>
      ) : champ.type === "radio" ? (
        <div className="flex flex-wrap gap-2">
          {champ.options?.map((o) => (
            <button
              key={o.value}
              type="button"
              disabled={desactive}
              onClick={() => onChange(champ.key, o.value)}
              className={cn(
                "px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer",
                valeur === o.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"
              )}
            >
              {fr ? o.labelFr : o.labelEn}
            </button>
          ))}
        </div>
      ) : champ.type === "file" ? (
        // Le téléversement depuis un lien public n'est pas ouvert : accepter
        // un fichier de quelqu'un qui n'a pas de compte demande un contrôle
        // d'accès au stockage que rien n'assure ici. Mieux vaut le dire que
        // de faire croire à un dépôt qui n'aurait lieu nulle part.
        <p className="text-[11px] text-muted-foreground rounded-lg border border-dashed border-border p-3">
          {fr
            ? "Votre consultant vous demandera ce document séparément."
            : "Your consultant will request this document separately."}
        </p>
      ) : (
        <input
          type={champ.type === "date" ? "date" : champ.type === "number" ? "number" : "text"}
          value={String(valeur ?? "")}
          disabled={desactive}
          onChange={(e) => onChange(champ.key, e.target.value)}
          className={CHAMP}
        />
      )}
    </div>
  )
}

function Repeteur({
  champ, valeur, desactive, fr, onChange,
}: {
  champ: FormFieldShape
  valeur: unknown
  desactive: boolean
  fr: boolean
  onChange: (cle: string, v: unknown) => void
}) {
  const liste = (valeur as Record<string, unknown>[]) ?? []
  return (
    <div className="space-y-2">
      {liste.map((item, i) => (
        <div key={i} className="rounded-xl border border-border bg-muted/20 p-3 relative space-y-2">
          <button
            type="button"
            disabled={desactive}
            onClick={() => {
              const suite = [...liste]
              suite.splice(i, 1)
              onChange(champ.key, suite)
            }}
            className="absolute top-2 right-2 text-error-strong hover:text-error/80 cursor-pointer"
            aria-label={fr ? "Retirer" : "Remove"}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <div className="grid gap-2 sm:grid-cols-2">
            {champ.fields?.map((sous) => (
              <label key={sous.key} className="block text-[11px] font-bold text-muted-foreground">
                {fr ? sous.labelFr : sous.labelEn}
                <input
                  type={sous.type === "date" ? "date" : sous.type === "number" ? "number" : "text"}
                  value={String(item[sous.key] ?? "")}
                  disabled={desactive}
                  onChange={(e) => {
                    const suite = [...liste]
                    suite[i] = { ...suite[i], [sous.key]: e.target.value }
                    onChange(champ.key, suite)
                  }}
                  className={cn(CHAMP, "mt-1")}
                />
              </label>
            ))}
          </div>
        </div>
      ))}
      <button
        type="button"
        disabled={desactive}
        onClick={() => onChange(champ.key, [...liste, {}])}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border font-bold text-xs hover:bg-muted cursor-pointer text-foreground"
      >
        <Plus className="h-3.5 w-3.5" /> {fr ? "Ajouter" : "Add"}
      </button>
    </div>
  )
}
