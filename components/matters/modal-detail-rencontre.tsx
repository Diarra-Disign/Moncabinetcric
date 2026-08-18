"use client"

import React, { useState } from "react"
import {
  X,
  Calendar,
  Clock,
  User,
  FileText,
  Printer,
  Download,
  Share2,
  Lock,
  Edit,
  CheckCircle2,
  Archive,
  Paperclip,
  History,
  AlertTriangle,
  CalendarPlus,
  ArrowRight,
  ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { MeetingNote } from "@/lib/data/types"
import {
  finaliserNoteRencontre,
  archiverNoteRencontre,
  partagerNoteAvecClient,
  creerEcheanceDepuisNote,
} from "@/lib/data/meeting-notes-actions"

interface ModalDetailRencontreProps {
  ouvert: boolean
  onFermer: () => void
  note: MeetingNote | null
  matterId: string
  clientName: string
  onModifier: (note: MeetingNote) => void
  onRafraichir: () => void
}

export function ModalDetailRencontre({
  ouvert,
  onFermer,
  note,
  matterId,
  clientName,
  onModifier,
  onRafraichir,
}: ModalDetailRencontreProps) {
  const [enCours, setEnCours] = useState(false)
  const [message, setMessage] = useState<{ type: "succes" | "erreur"; texte: string } | null>(null)

  // Confirmation partage
  const [showConfirmPartage, setShowConfirmPartage] = useState(false)

  // Formulaire rapide d'échéance
  const [showFormEcheance, setShowFormEcheance] = useState(false)
  const [titreEcheance, setTitreEcheance] = useState("")
  const [dateEcheance, setDateEcheance] = useState("")
  const [prioriteEcheance, setPrioriteEcheance] = useState("normal")

  if (!ouvert || !note) return null

  const handleFinaliser = async () => {
    setEnCours(true)
    setMessage(null)
    const res = await finaliserNoteRencontre(note.id)
    setEnCours(false)
    if (res.ok) {
      setMessage({ type: "succes", texte: res.message })
      onRafraichir()
    } else {
      setMessage({ type: "erreur", texte: res.message })
    }
  }

  const handlePartager = async () => {
    setEnCours(true)
    setMessage(null)
    setShowConfirmPartage(false)
    const res = await partagerNoteAvecClient(note.id)
    setEnCours(false)
    if (res.ok) {
      setMessage({ type: "succes", texte: res.message })
      onRafraichir()
    } else {
      setMessage({ type: "erreur", texte: res.message })
    }
  }

  const handleArchiver = async () => {
    if (!confirm("Voulez-vous archiver ce compte rendu de rencontre ?")) return
    setEnCours(true)
    setMessage(null)
    const res = await archiverNoteRencontre(note.id)
    setEnCours(false)
    if (res.ok) {
      setMessage({ type: "succes", texte: res.message })
      onRafraichir()
      onFermer()
    } else {
      setMessage({ type: "erreur", texte: res.message })
    }
  }

  const handleCreerEcheance = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!titreEcheance || !dateEcheance) return
    setEnCours(true)
    setMessage(null)
    const res = await creerEcheanceDepuisNote(note.id, {
      title: titreEcheance,
      dueOn: dateEcheance,
      priority: prioriteEcheance,
    })
    setEnCours(false)
    if (res.ok) {
      setMessage({ type: "succes", texte: res.message })
      setShowFormEcheance(false)
      setTitreEcheance("")
      setDateEcheance("")
      onRafraichir()
    } else {
      setMessage({ type: "erreur", texte: res.message })
    }
  }

  const pdfUrl = `/api/matters/${matterId}/meetings/${note.id}/pdf`

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary-strong flex items-center justify-center font-bold text-sm">
              {note.reference.slice(-4)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-foreground">{note.reference}</span>
                {note.status === "finalized" ? (
                  <Badge variant="success" className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Finalisée
                  </Badge>
                ) : note.status === "draft" ? (
                  <Badge variant="secondary" className="text-[10px]">
                    Brouillon
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">
                    Archivée
                  </Badge>
                )}

                {note.visibility === "shared_client" ? (
                  <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200 text-[10px] flex items-center gap-1">
                    <Share2 className="h-3 w-3" /> Visible sur portail client
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground text-[10px] flex items-center gap-1">
                    <Lock className="h-3 w-3" /> Interne cabinet
                  </Badge>
                )}
              </div>
              <h2 className="text-base font-bold text-foreground mt-0.5">{note.subject}</h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-background hover:bg-muted text-foreground transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              <span>PDF</span>
            </a>
            <button
              onClick={() => window.open(pdfUrl, "_blank")}
              className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground transition-colors"
              title="Imprimer"
            >
              <Printer className="h-4 w-4" />
            </button>
            <button
              onClick={onFermer}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Corps défilable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {message && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 ${
                message.type === "succes"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                  : "border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-300"
              }`}
            >
              {message.type === "succes" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0" />
              )}
              <span>{message.texte}</span>
            </div>
          )}

          {/* Bandeau de synthèse */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl border border-border bg-muted/20 text-xs">
            <div>
              <span className="text-muted-foreground block text-[11px]">Date & Heure</span>
              <span className="font-semibold text-foreground flex items-center gap-1 mt-0.5">
                <Calendar className="h-3.5 w-3.5 text-primary" /> {note.meetingDate} {note.meetingTime ? `à ${note.meetingTime}` : ""}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Modalité</span>
              <span className="font-medium text-foreground capitalize mt-0.5 block">
                {note.meetingTypeOther || note.meetingType.replace("_", " ")} ({note.durationMinutes} min)
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Motif</span>
              <span className="font-medium text-foreground capitalize mt-0.5 block">
                {note.reasonOther || note.reason.replace("_", " ")}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Auteur</span>
              <span className="font-medium text-foreground mt-0.5 block flex items-center gap-1">
                <User className="h-3.5 w-3.5 text-muted-foreground" /> {note.createdByName || "Consultant"}
              </span>
            </div>
          </div>

          {/* Contenu principal du compte rendu */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-primary" /> Compte rendu officiel
            </h3>
            <div className="p-4 rounded-xl border border-border bg-card whitespace-pre-wrap font-sans text-xs leading-relaxed text-foreground">
              {note.content}
            </div>
          </div>

          {/* Sections structurées si renseignées */}
          {note.sections && Object.values(note.sections).some((v) => Boolean(v)) && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Rubriques d&apos;analyse et d&apos;action
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {note.sections.discussedInfo && (
                  <div className="p-3 rounded-xl border border-border bg-muted/20">
                    <span className="font-semibold text-primary block mb-1">Informations discutées</span>
                    <p className="text-foreground whitespace-pre-wrap">{note.sections.discussedInfo}</p>
                  </div>
                )}
                {note.sections.observations && (
                  <div className="p-3 rounded-xl border border-border bg-muted/20">
                    <span className="font-semibold text-primary block mb-1">Analyse & observations</span>
                    <p className="text-foreground whitespace-pre-wrap">{note.sections.observations}</p>
                  </div>
                )}
                {note.sections.decisions && (
                  <div className="p-3 rounded-xl border border-border bg-muted/20">
                    <span className="font-semibold text-primary block mb-1">Décisions prises</span>
                    <p className="text-foreground whitespace-pre-wrap">{note.sections.decisions}</p>
                  </div>
                )}
                {note.sections.requestedDocs && (
                  <div className="p-3 rounded-xl border border-border bg-muted/20">
                    <span className="font-semibold text-primary block mb-1">Documents demandés</span>
                    <p className="text-foreground whitespace-pre-wrap">{note.sections.requestedDocs}</p>
                  </div>
                )}
                {note.sections.actionItems && (
                  <div className="p-3 rounded-xl border border-border bg-muted/20 md:col-span-2">
                    <span className="font-semibold text-primary block mb-1">Actions à effectuer & Responsabilités</span>
                    <p className="text-foreground whitespace-pre-wrap">{note.sections.actionItems}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Prochain rendez-vous prévu */}
          {(note.nextMeetingDate || note.sections?.nextFollowupDate) && (
            <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" /> Prochain suivi / Rendez-vous convenu
                </span>
                <p className="text-xs text-foreground mt-1 font-medium">
                  {note.nextMeetingDate ? `${note.nextMeetingDate} ${note.nextMeetingTime ? `à ${note.nextMeetingTime}` : ""}` : `Date cible : ${note.sections?.nextFollowupDate}`}
                  {note.nextMeetingReason ? ` — ${note.nextMeetingReason}` : ""}
                </p>
                {note.nextMeetingNotes && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">{note.nextMeetingNotes}</p>
                )}
              </div>
            </div>
          )}

          {/* Documents associés */}
          {note.documents && note.documents.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5 text-primary" /> Documents examinés lors de la séance ({note.documents.length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {note.documents.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card text-xs font-medium text-foreground"
                  >
                    <Paperclip className="h-3 w-3 text-muted-foreground" />
                    <span>{d.name}</span>
                    <span className="text-[10px] text-muted-foreground">({d.category})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Création d'échéance directe liée */}
          <div className="pt-2 border-t border-border">
            {!showFormEcheance ? (
              <button
                type="button"
                onClick={() => {
                  setTitreEcheance(`Action issue de ${note.reference} : `)
                  setDateEcheance(note.nextMeetingDate || new Date().toISOString().slice(0, 10))
                  setShowFormEcheance(true)
                }}
                className="inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:underline"
              >
                <CalendarPlus className="h-3.5 w-3.5" /> + Créer une échéance liée à ce compte rendu
              </button>
            ) : (
              <form onSubmit={handleCreerEcheance} className="p-3.5 rounded-xl border border-primary/20 bg-muted/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <CalendarPlus className="h-3.5 w-3.5 text-primary" /> Nouvelle échéance rattachée au dossier
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowFormEcheance(false)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Annuler
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      placeholder="Titre de l'échéance..."
                      value={titreEcheance}
                      onChange={(e) => setTitreEcheance(e.target.value)}
                      required
                      className="w-full h-8 px-2.5 text-xs rounded-lg border border-border bg-background"
                    />
                  </div>
                  <div>
                    <input
                      type="date"
                      value={dateEcheance}
                      onChange={(e) => setDateEcheance(e.target.value)}
                      required
                      className="w-full h-8 px-2.5 text-xs rounded-lg border border-border bg-background"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" size="sm" disabled={enCours} className="text-xs h-7">
                    Créer l&apos;échéance
                  </Button>
                </div>
              </form>
            )}
          </div>

          {/* Historique des révisions / modifications */}
          {note.history && note.history.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <History className="h-3.5 w-3.5 text-primary" /> Historique inaltérable des révisions ({note.history.length})
              </h3>
              <div className="space-y-2">
                {note.history.map((h, i) => (
                  <div key={i} className="p-2.5 rounded-lg border border-border bg-muted/10 text-xs">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="font-semibold text-foreground">{h.modifiedByName}</span>
                      <span className="font-mono text-[10px]">{new Date(h.modifiedAt).toLocaleString("fr-CA")}</span>
                    </div>
                    {h.changeSummary && (
                      <p className="text-[11px] text-muted-foreground mt-1 italic">« {h.changeSummary} »</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/40">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onModifier(note)}
              className="text-xs gap-1.5"
            >
              <Edit className="h-3.5 w-3.5" /> Modifier
            </Button>

            {note.status === "draft" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleFinaliser}
                disabled={enCours}
                className="text-xs gap-1.5 text-emerald-700 dark:text-emerald-400 border-emerald-300"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Finaliser
              </Button>
            )}

            {note.status !== "archived" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleArchiver}
                disabled={enCours}
                className="text-xs gap-1 text-muted-foreground hover:text-rose-600"
              >
                <Archive className="h-3.5 w-3.5" /> Archiver
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {note.visibility === "internal" ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowConfirmPartage(true)}
                disabled={enCours}
                className="text-xs gap-1.5 text-sky-700 dark:text-sky-400 border-sky-300"
              >
                <Share2 className="h-3.5 w-3.5" /> Partager avec le client
              </Button>
            ) : (
              <Badge variant="outline" className="text-xs text-sky-700 bg-sky-50 border-sky-200">
                Partagé au client
              </Badge>
            )}
            <Button size="sm" onClick={onFermer} className="text-xs">
              Fermer
            </Button>
          </div>
        </div>
      </div>

      {/* Modale de confirmation pour le partage client */}
      {showConfirmPartage && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md p-6 rounded-2xl bg-card border border-border shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                <Share2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Partager avec le client</h3>
                <p className="text-xs text-muted-foreground">Rendre ce compte rendu visible sur le portail</p>
              </div>
            </div>
            <p className="text-xs text-foreground leading-relaxed">
              Le compte rendu <strong>{note.reference}</strong> sera rendu accessible à <strong>{clientName}</strong> dans son portail client sécurisé. S&apos;il était en brouillon, il sera automatiquement finalisé et horodaté.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setShowConfirmPartage(false)} disabled={enCours}>
                Annuler
              </Button>
              <Button size="sm" onClick={handlePartager} disabled={enCours} className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold">
                Confirmer le partage
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
