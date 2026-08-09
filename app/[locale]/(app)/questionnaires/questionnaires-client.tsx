"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Send, Eye, Copy, Files, Star, Trash2, X, Search, Clock, CheckCircle2,
  AlertCircle, Link2, BellRing, CalendarClock, ShieldOff, Plus, Users,
} from "lucide-react"
import type { ClientQuestionnaire, QuestionnaireTemplateRecord } from "@/lib/data/types"
import type { Destinataire } from "@/lib/data/questionnaires"
import {
  envoyerQuestionnaire, envoyerRappel, prolongerDateLimite, revoquerLien,
  dupliquerModele, definirParDefaut, supprimerModele, enregistrerModele,
  cloreQuestionnaire,
} from "@/lib/data/questionnaire-actions"
import { cn } from "@/lib/utils"

type Onglet = "bibliotheque" | "envoyes"

interface Resultat { ok: boolean; message: string; lien?: string }

const CHAMP =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"

/**
 * Libellé et couleur d'un statut.
 *
 * On lit statusAffiche et non status : c'est le seul des deux qui sait qu'une
 * date limite est passée. Afficher « envoyé » sur un questionnaire expiré
 * depuis trois semaines inviterait à attendre une réponse qui ne peut plus
 * arriver.
 */
const STATUTS: Record<string, { texte: string; classe: string }> = {
  draft: { texte: "Brouillon", classe: "bg-muted text-muted-foreground" },
  sent: { texte: "Envoyé", classe: "bg-primary/10 text-primary" },
  opened: { texte: "Ouvert", classe: "bg-sky-100 text-sky-800" },
  in_progress: { texte: "En cours", classe: "bg-amber-100 text-amber-800" },
  submitted: { texte: "Soumis", classe: "bg-indigo-100 text-indigo-800" },
  to_correct: { texte: "Correction demandée", classe: "bg-error/10 text-error" },
  corrected: { texte: "Corrigé", classe: "bg-emerald-100 text-emerald-800" },
  completed: { texte: "Complété", classe: "bg-success/15 text-success" },
  expired: { texte: "Expiré", classe: "bg-slate-200 text-slate-700" },
  cancelled: { texte: "Annulé", classe: "bg-slate-200 text-slate-600" },
}

const dateCourte = (v?: string) =>
  v ? new Date(v).toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" }) : "—"

function compterQuestions(sections: { fields: unknown[] }[]): number {
  return sections.reduce((n, s) => n + s.fields.length, 0)
}

export function QuestionnairesClient({
  locale, modeles, envois, destinataires,
}: {
  locale: string
  modeles: QuestionnaireTemplateRecord[]
  envois: ClientQuestionnaire[]
  destinataires: Destinataire[]
}) {
  const routeur = useRouter()
  const [onglet, setOnglet] = React.useState<Onglet>("bibliotheque")
  const [resultat, setResultat] = React.useState<Resultat | null>(null)
  const [enCours, demarrer] = React.useTransition()

  const [envoiPour, setEnvoiPour] = React.useState<QuestionnaireTemplateRecord | null>(null)
  const [apercuDe, setApercuDe] = React.useState<QuestionnaireTemplateRecord | null>(null)
  const [creation, setCreation] = React.useState(false)
  const [filtre, setFiltre] = React.useState<string>("tous")

  const agir = (action: () => Promise<Resultat>) =>
    demarrer(async () => {
      const r = await action()
      setResultat(r)
      if (r.ok) routeur.refresh()
    })

  const envoisFiltres = filtre === "tous"
    ? envois
    : envois.filter((e) => e.statusAffiche === filtre)

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground">Questionnaires</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Créez, envoyez et suivez les questionnaires de votre cabinet — à un client comme à un prospect.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreation(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-colors cursor-pointer"
        >
          <Plus className="h-4 w-4" /> Créer un questionnaire
        </button>
      </div>

      {resultat && (
        <div
          role="status"
          className={cn(
            "rounded-xl border p-3 text-xs font-medium flex items-start justify-between gap-3",
            resultat.ok ? "border-success/30 bg-success/10 text-success" : "border-error/30 bg-error/10 text-error"
          )}
        >
          <span className="flex items-start gap-2">
            {resultat.ok ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" /> : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />}
            <span>
              {resultat.message}
              {/* Le lien est montré même quand le courriel est bien parti :
                  le brief demande de pouvoir l'envoyer par WhatsApp ou SMS
                  (§20), et le consultant ne doit pas avoir à provoquer un
                  échec d'envoi pour l'obtenir. */}
              {resultat.lien && (
                <span className="mt-2 flex flex-wrap items-center gap-2">
                  <code className="rounded bg-background/60 px-2 py-1 text-[11px] break-all">{resultat.lien}</code>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(resultat.lien ?? "")}
                    className="inline-flex items-center gap-1 rounded-lg border border-current px-2 py-1 text-[11px] font-bold cursor-pointer"
                  >
                    <Copy className="h-3 w-3" /> Copier le lien
                  </button>
                </span>
              )}
            </span>
          </span>
          <button type="button" onClick={() => setResultat(null)} className="cursor-pointer shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {([["bibliotheque", `Bibliothèque (${modeles.length})`], ["envoyes", `Envoyés (${envois.length})`]] as const).map(
          ([cle, libelle]) => (
            <button
              key={cle}
              type="button"
              onClick={() => setOnglet(cle)}
              className={cn(
                "px-4 py-2.5 text-xs font-bold border-b-2 -mb-px whitespace-nowrap transition-colors cursor-pointer",
                onglet === cle
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {libelle}
            </button>
          )
        )}
      </div>

      {onglet === "bibliotheque" && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {modeles.map((m) => (
            <article key={m.id} className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-sm font-black text-foreground leading-snug">{m.titleFr}</h2>
                {m.isDefaultPreconsultation && (
                  <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-black">
                    <Star className="h-3 w-3" /> Par défaut
                  </span>
                )}
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{m.descriptionFr}</p>

              <dl className="text-[11px] text-muted-foreground grid grid-cols-2 gap-x-3 gap-y-1 mt-auto pt-2 border-t border-border">
                <div><dt className="inline font-bold text-foreground">{compterQuestions(m.sections)}</dt> questions</div>
                <div><dt className="inline font-bold text-foreground">{m.sections.length}</dt> sections</div>
                <div className="col-span-2">Utilisé <span className="font-bold text-foreground">{m.usageCount}</span> fois</div>
                <div className="col-span-2">Modifié le {dateCourte(m.updatedAt)}</div>
                <div className="col-span-2 text-[10px] uppercase tracking-wider font-bold">
                  {m.firmId ? "Modèle de votre cabinet" : "Modèle fourni"}
                </div>
              </dl>

              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setEnvoiPour(m)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-bold text-[11px] hover:bg-primary/90 transition-colors cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5" /> Envoyer
                </button>
                <button
                  type="button"
                  onClick={() => setApercuDe(m)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border font-bold text-[11px] hover:bg-muted transition-colors cursor-pointer text-foreground"
                >
                  <Eye className="h-3.5 w-3.5" /> Aperçu
                </button>
                <button
                  type="button"
                  disabled={enCours}
                  onClick={() => agir(() => {
                    const fd = new FormData()
                    fd.set("id", m.id)
                    fd.set("locale", locale)
                    return dupliquerModele(fd)
                  })}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border font-bold text-[11px] hover:bg-muted transition-colors cursor-pointer text-foreground"
                >
                  <Files className="h-3.5 w-3.5" /> Dupliquer
                </button>

                {/* Modifier, retirer et « par défaut » ne s'offrent que sur un
                    modèle du cabinet : un modèle fourni est partagé par tous
                    les cabinets, la base refuserait de toute façon. Montrer un
                    bouton voué au refus n'aurait appris la règle qu'après le
                    clic. */}
                {m.firmId && (
                  <>
                    <button
                      type="button"
                      disabled={enCours || m.isDefaultPreconsultation}
                      onClick={() => agir(() => {
                        const fd = new FormData()
                        fd.set("id", m.id)
                        fd.set("locale", locale)
                        return definirParDefaut(fd)
                      })}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border font-bold text-[11px] hover:bg-muted transition-colors cursor-pointer text-foreground disabled:opacity-40"
                    >
                      <Star className="h-3.5 w-3.5" /> Par défaut
                    </button>
                    <button
                      type="button"
                      disabled={enCours}
                      onClick={() => agir(() => {
                        const fd = new FormData()
                        fd.set("id", m.id)
                        fd.set("locale", locale)
                        return supprimerModele(fd)
                      })}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border font-bold text-[11px] hover:bg-error/10 hover:text-error transition-colors cursor-pointer text-muted-foreground"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Retirer
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {onglet === "envoyes" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {["tous", "sent", "opened", "in_progress", "submitted", "to_correct", "completed", "expired"].map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFiltre(f)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer",
                  filtre === f ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                {f === "tous" ? "Tous" : STATUTS[f]?.texte ?? f}
              </button>
            ))}
          </div>

          {envoisFiltres.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
              Aucun questionnaire {filtre === "tous" ? "envoyé pour le moment" : "dans cet état"}.
            </p>
          ) : (
            <div className="space-y-3">
              {envoisFiltres.map((e) => {
                const st = STATUTS[e.statusAffiche] ?? STATUTS.draft
                return (
                  <article key={e.id} className="rounded-2xl border border-border bg-card p-4 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-sm font-black text-foreground">{e.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="inline-flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {e.destinataireNom || "Destinataire inconnu"}
                          </span>
                          <span className="text-[10px] uppercase font-bold tracking-wider">
                            {e.leadId ? "Prospect" : "Client"}
                          </span>
                          {e.destinataireCourriel && <span>· {e.destinataireCourriel}</span>}
                        </p>
                      </div>
                      <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black", st.classe)}>
                        {st.texte}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                      <span>Envoyé le {dateCourte(e.sentAt)}</span>
                      <span>Échéance : {dateCourte(e.dueDate)}</span>
                      <span>Progression : <span className="font-bold text-foreground">{e.progress} %</span></span>
                      {e.reminderCount > 0 && <span>{e.reminderCount} rappel(s)</span>}
                      {!e.lienActif && <span className="text-error font-bold">Lien désactivé</span>}
                    </div>

                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary transition-all" style={{ width: `${e.progress}%` }} />
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <button
                        type="button"
                        disabled={enCours || !e.destinataireCourriel}
                        onClick={() => agir(() => {
                          const fd = new FormData()
                          fd.set("id", e.id)
                          fd.set("locale", locale)
                          return envoyerRappel(fd)
                        })}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border font-bold text-[11px] hover:bg-muted transition-colors cursor-pointer text-foreground disabled:opacity-40"
                      >
                        <BellRing className="h-3.5 w-3.5" /> Rappel
                      </button>

                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border font-bold text-[11px] text-foreground cursor-pointer hover:bg-muted transition-colors">
                        <CalendarClock className="h-3.5 w-3.5" /> Date limite
                        <input
                          type="date"
                          className="sr-only"
                          onChange={(ev) => {
                            const v = ev.target.value
                            if (!v) return
                            agir(() => {
                              const fd = new FormData()
                              fd.set("id", e.id)
                              fd.set("dueDate", v)
                              fd.set("locale", locale)
                              return prolongerDateLimite(fd)
                            })
                          }}
                        />
                      </label>

                      <button
                        type="button"
                        disabled={enCours || !e.lienActif}
                        onClick={() => agir(() => {
                          const fd = new FormData()
                          fd.set("id", e.id)
                          fd.set("locale", locale)
                          return revoquerLien(fd)
                        })}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border font-bold text-[11px] hover:bg-error/10 hover:text-error transition-colors cursor-pointer text-muted-foreground disabled:opacity-40"
                      >
                        <ShieldOff className="h-3.5 w-3.5" /> Désactiver le lien
                      </button>

                      {e.statusAffiche !== "completed" && (
                        <button
                          type="button"
                          disabled={enCours}
                          onClick={() => agir(() => {
                            const fd = new FormData()
                            fd.set("id", e.id)
                            fd.set("locale", locale)
                            return cloreQuestionnaire(fd)
                          })}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border font-bold text-[11px] hover:bg-muted transition-colors cursor-pointer text-foreground"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Clore
                        </button>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      )}

      {envoiPour && (
        <ModaleEnvoi
          modele={envoiPour}
          destinataires={destinataires}
          locale={locale}
          enCours={enCours}
          onFermer={() => setEnvoiPour(null)}
          onEnvoyer={(fd) => {
            agir(async () => {
              const r = await envoyerQuestionnaire(fd)
              if (r.ok) setEnvoiPour(null)
              return r
            })
          }}
        />
      )}

      {apercuDe && <ModaleApercu modele={apercuDe} onFermer={() => setApercuDe(null)} />}

      {creation && (
        <ModaleCreation
          locale={locale}
          enCours={enCours}
          onFermer={() => setCreation(false)}
          onEnregistrer={(fd) => {
            agir(async () => {
              const r = await enregistrerModele(fd)
              if (r.ok) setCreation(false)
              return r
            })
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Envoyer
// ---------------------------------------------------------------------------

function ModaleEnvoi({
  modele, destinataires, locale, enCours, onFermer, onEnvoyer,
}: {
  modele: QuestionnaireTemplateRecord
  destinataires: Destinataire[]
  locale: string
  enCours: boolean
  onFermer: () => void
  onEnvoyer: (fd: FormData) => void
}) {
  const [type, setType] = React.useState<"client" | "lead">("lead")
  const [recherche, setRecherche] = React.useState("")
  const [choisi, setChoisi] = React.useState<Destinataire | null>(null)
  const [message, setMessage] = React.useState(modele.messageFr)
  const [echeance, setEcheance] = React.useState("")

  const liste = destinataires
    .filter((d) => d.type === type)
    .filter((d) => {
      const q = recherche.trim().toLowerCase()
      if (!q) return true
      return `${d.nom} ${d.courriel} ${d.telephone} ${d.dossier ?? ""}`.toLowerCase().includes(q)
    })
    .slice(0, 40)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card w-full max-w-2xl rounded-2xl border border-border shadow-2xl flex flex-col max-h-[90vh]">
        <header className="p-5 border-b border-border flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-foreground">Envoyer : {modele.titleFr}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">À qui souhaitez-vous envoyer ce questionnaire ?</p>
          </div>
          <button type="button" onClick={onFermer} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div className="flex gap-2">
            {([["lead", "Prospect"], ["client", "Client"]] as const).map(([v, libelle]) => (
              <button
                key={v}
                type="button"
                onClick={() => { setType(v); setChoisi(null) }}
                className={cn(
                  "px-4 py-2 rounded-xl border text-xs font-bold transition-colors cursor-pointer",
                  type === v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                {libelle}
              </button>
            ))}
          </div>

          <label className="block">
            <span className="text-[11px] font-bold text-muted-foreground">
              {type === "lead" ? "Rechercher un prospect…" : "Rechercher un client…"}
            </span>
            <span className="relative block mt-1">
              <Search aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                className={cn(CHAMP, "pl-9")}
                placeholder="Nom, courriel, téléphone…"
              />
            </span>
          </label>

          <div className="max-h-52 overflow-y-auto rounded-xl border border-border divide-y divide-border">
            {liste.length === 0 ? (
              <p className="p-4 text-xs text-muted-foreground text-center">
                Aucun {type === "lead" ? "prospect" : "client"} ne correspond.
              </p>
            ) : (
              liste.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setChoisi(d)}
                  className={cn(
                    "w-full text-left p-3 hover:bg-muted transition-colors cursor-pointer flex items-center justify-between gap-3",
                    choisi?.id === d.id && "bg-primary/10"
                  )}
                >
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-foreground truncate">{d.nom || "Sans nom"}</span>
                    <span className="block text-[11px] text-muted-foreground truncate">
                      {d.courriel || "Aucun courriel"}{d.telephone ? ` · ${d.telephone}` : ""}{d.dossier ? ` · ${d.dossier}` : ""}
                    </span>
                  </span>
                  {choisi?.id === d.id && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                </button>
              ))
            )}
          </div>

          <label className="block">
            <span className="text-[11px] font-bold text-muted-foreground">Date limite (facultative)</span>
            <input type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} className={cn(CHAMP, "mt-1")} />
          </label>

          <label className="block">
            <span className="text-[11px] font-bold text-muted-foreground">
              Message — [Prénom] sera remplacé par le prénom du destinataire
            </span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              className={cn(CHAMP, "mt-1 resize-y")}
            />
          </label>

          {choisi && !choisi.courriel && (
            <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-[11px] text-amber-900">
              Ce destinataire n&apos;a pas d&apos;adresse courriel. Le questionnaire sera créé et vous
              obtiendrez un lien à lui transmettre vous-même.
            </p>
          )}
        </div>

        <footer className="p-5 border-t border-border flex items-center justify-end gap-2">
          <button type="button" onClick={onFermer} className="px-4 py-2 rounded-xl border border-border font-bold text-xs hover:bg-muted cursor-pointer text-foreground">
            Annuler
          </button>
          <button
            type="button"
            disabled={!choisi || enCours}
            onClick={() => {
              if (!choisi) return
              const fd = new FormData()
              fd.set("templateId", modele.id)
              fd.set("destinataireType", choisi.type)
              fd.set("destinataireId", choisi.id)
              fd.set("message", message)
              fd.set("dueDate", echeance)
              fd.set("locale", locale)
              onEnvoyer(fd)
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 disabled:opacity-40 cursor-pointer"
          >
            <Send className="h-4 w-4" /> {enCours ? "Envoi…" : "Envoyer"}
          </button>
        </footer>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Aperçu
// ---------------------------------------------------------------------------

function ModaleApercu({ modele, onFermer }: { modele: QuestionnaireTemplateRecord; onFermer: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card w-full max-w-3xl rounded-2xl border border-border shadow-2xl flex flex-col max-h-[90vh]">
        <header className="p-5 border-b border-border flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-foreground">{modele.titleFr}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {compterQuestions(modele.sections)} questions · {modele.sections.length} sections
            </p>
          </div>
          <button type="button" onClick={onFermer} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {modele.sections.map((s) => (
            <section key={s.id}>
              <h3 className="text-xs font-black uppercase tracking-wider text-primary border-b border-border pb-1 mb-2">
                {s.titleFr}
              </h3>
              <ul className="space-y-1">
                {s.fields.map((f) => (
                  <li key={f.key} className="text-xs text-foreground flex items-start gap-2">
                    <span className="text-muted-foreground shrink-0">•</span>
                    <span>
                      {f.labelFr}
                      {f.required && <span className="text-error"> *</span>}
                      <span className="text-muted-foreground text-[10px] ml-1.5 uppercase">{f.type}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Créer
// ---------------------------------------------------------------------------

function ModaleCreation({
  locale, enCours, onFermer, onEnregistrer,
}: {
  locale: string
  enCours: boolean
  onFermer: () => void
  onEnregistrer: (fd: FormData) => void
}) {
  const [titre, setTitre] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [message, setMessage] = React.useState(
    "Bonjour [Prénom],\n\nNous vous invitons à remplir le questionnaire suivant.\n\nMerci de fournir des informations aussi précises que possible."
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card w-full max-w-xl rounded-2xl border border-border shadow-2xl flex flex-col max-h-[90vh]">
        <header className="p-5 border-b border-border flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-foreground">Créer un questionnaire</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Il rejoint votre bibliothèque. Pour partir d&apos;un questionnaire existant, dupliquez-le plutôt.
            </p>
          </div>
          <button type="button" onClick={onFermer} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <label className="block">
            <span className="text-[11px] font-bold text-muted-foreground">Titre</span>
            <input value={titre} onChange={(e) => setTitre(e.target.value)} className={cn(CHAMP, "mt-1")} placeholder="Questionnaire — Préconsultation étudiants" />
          </label>
          <label className="block">
            <span className="text-[11px] font-bold text-muted-foreground">Description</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={cn(CHAMP, "mt-1 resize-y")} />
          </label>
          <label className="block">
            <span className="text-[11px] font-bold text-muted-foreground">Message d&apos;accompagnement par défaut</span>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} className={cn(CHAMP, "mt-1 resize-y")} />
          </label>
          <p className="rounded-xl border border-border bg-muted/40 p-3 text-[11px] text-muted-foreground">
            Ce questionnaire naîtra <strong>sans questions</strong>. Pour en obtenir un déjà rempli de
            sections, dupliquez un modèle existant : c&apos;est plus rapide que de tout ressaisir, et
            les libellés officiels restent alors ceux qui ont déjà servi.
          </p>
        </div>

        <footer className="p-5 border-t border-border flex items-center justify-end gap-2">
          <button type="button" onClick={onFermer} className="px-4 py-2 rounded-xl border border-border font-bold text-xs hover:bg-muted cursor-pointer text-foreground">
            Annuler
          </button>
          <button
            type="button"
            disabled={!titre.trim() || enCours}
            onClick={() => {
              const fd = new FormData()
              fd.set("titreFr", titre)
              fd.set("descriptionFr", description)
              fd.set("messageFr", message)
              fd.set("locale", locale)
              onEnregistrer(fd)
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 disabled:opacity-40 cursor-pointer"
          >
            <Link2 className="h-4 w-4" /> Créer
          </button>
        </footer>
      </div>
    </div>
  )
}
