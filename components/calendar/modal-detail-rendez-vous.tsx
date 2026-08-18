"use client"

import * as React from "react"
import {
  X,
  Calendar,
  Clock,
  Video,
  Phone,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Edit3,
  Globe,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { CalendarEvent, ClientRecord, Matter, Lead } from "@/lib/data/types"
import { updateCalendarEvent, deleteCalendarEvent, rescheduleCalendarEvent } from "@/lib/data/actions"
import { PromoteFromEvent } from "@/components/calendar/promote-from-event"
import { useRouter } from "next/navigation"

export interface ModalDetailRendezVousProps {
  ouvert: boolean
  onFermer: () => void
  event: CalendarEvent | null
  clients?: ClientRecord[]
  matters?: Matter[]
  leads?: Lead[]
  onEvenementModifie: (evenement: CalendarEvent) => void
  onEvenementSupprime: (id: string) => void
}

function getDayOfWeekName(dateIso: string): string {
  if (!dateIso) return "Date"
  const d = new Date(dateIso + "T12:00:00")
  if (isNaN(d.getTime())) return dateIso
  const dayNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]
  return dayNames[d.getDay()] || "Date"
}

export function ModalDetailRendezVous({
  ouvert,
  onFermer,
  event,
  clients = [],
  matters = [],
  leads = [],
  onEvenementModifie,
  onEvenementSupprime,
}: ModalDetailRendezVousProps) {
  if (!ouvert || !event) return null

  return (
    <ModalDetailContent
      key={event.id}
      event={event}
      onFermer={onFermer}
      clients={clients}
      matters={matters}
      leads={leads}
      onEvenementModifie={onEvenementModifie}
      onEvenementSupprime={onEvenementSupprime}
    />
  )
}

function ModalDetailContent({
  event,
  onFermer,
  clients = [],
  matters = [],
  leads = [],
  onEvenementModifie,
  onEvenementSupprime,
}: Omit<ModalDetailRendezVousProps, "ouvert"> & { event: CalendarEvent }) {
  const router = useRouter()
  const [mode, setMode] = React.useState<"view" | "edit" | "move">("view")
  const [enCours, setEnCours] = React.useState(false)
  const [message, setMessage] = React.useState<{ type: "succes" | "erreur"; texte: string } | null>(null)
  const [showConfirmSuppression, setShowConfirmSuppression] = React.useState(false)

  // Édition state
  const [editTitle, setEditTitle] = React.useState(event.title)
  const [editPlatform, setEditPlatform] = React.useState(event.platform || "google_meet")
  const [editLink, setEditLink] = React.useState(event.link || "")
  const [editStatus, setEditStatus] = React.useState(event.status || "confirmed")
  const [editNotes, setEditNotes] = React.useState(event.notes || "")

  // Déplacement state
  const [moveDate, setMoveDate] = React.useState(event.date)
  const [moveHour, setMoveHour] = React.useState(event.hour ?? 10)

  // Trouver client ou dossier associé
  const clientAssocie = clients.find((c) => c.name === event.clientName || c.id === event.clientId)
  const prospectAssocie = leads.find((l) => l.name === event.clientName || l.id === event.leadId)
  const matterAssocie = matters.find(
    (m) => (clientAssocie?.id && m.clientId === clientAssocie.id) || m.id === event.matterId
  )

  const handleChangerStatutRapide = async (nouveauStatut: string) => {
    setEnCours(true)
    setMessage(null)
    try {
      const maj = await updateCalendarEvent(event.id, { status: nouveauStatut })
      onEvenementModifie(maj)
      setMessage({ type: "succes", texte: `Statut mis à jour : ${nouveauStatut}` })
    } catch (e) {
      setMessage({ type: "erreur", texte: e instanceof Error ? e.message : "Erreur mise à jour" })
    } finally {
      setEnCours(false)
    }
  }

  const handleEnregistrerModif = async (e: React.FormEvent) => {
    e.preventDefault()
    setEnCours(true)
    setMessage(null)
    try {
      const maj = await updateCalendarEvent(event.id, {
        title: editTitle,
        platform: editPlatform,
        link: editLink.trim() || undefined,
        status: editStatus,
        notes: editNotes.trim() || undefined,
      })
      onEvenementModifie(maj)
      setMode("view")
      setMessage({ type: "succes", texte: "Rendez-vous modifié avec succès." })
    } catch (e) {
      setMessage({ type: "erreur", texte: e instanceof Error ? e.message : "Erreur modification" })
    } finally {
      setEnCours(false)
    }
  }

  const handleConfirmerDeplacement = async (e: React.FormEvent) => {
    e.preventDefault()
    setEnCours(true)
    setMessage(null)
    try {
      const selectedD = new Date(moveDate + "T12:00:00")
      const monthNames = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]
      const dayName = `${selectedD.getDate()} ${monthNames[selectedD.getMonth()]} ${selectedD.getFullYear()}`

      const endH = moveHour + 1
      const formattedTime = `${moveHour < 10 ? "0" + moveHour : moveHour} h 00 – ${endH < 10 ? "0" + endH : endH} h 00 (HE)`

      const maj = await rescheduleCalendarEvent(event.id, moveDate, moveHour, formattedTime, dayName)
      onEvenementModifie(maj)
      setMode("view")
      setMessage({ type: "succes", texte: `Rendez-vous déplacé au ${dayName} à ${moveHour} h 00.` })
    } catch (e) {
      setMessage({ type: "erreur", texte: e instanceof Error ? e.message : "Erreur déplacement" })
    } finally {
      setEnCours(false)
    }
  }

  const handleSupprimer = async () => {
    setEnCours(true)
    setMessage(null)
    try {
      await deleteCalendarEvent(event.id)
      onEvenementSupprime(event.id)
      onFermer()
    } catch (e) {
      setMessage({ type: "erreur", texte: e instanceof Error ? e.message : "Erreur suppression" })
      setShowConfirmSuppression(false)
    } finally {
      setEnCours(false)
    }
  }

  const handleCreerCompteRendu = () => {
    if (matterAssocie) {
      router.push(`/fr/matters/${matterAssocie.id}?tab=rencontres`)
      onFermer()
    } else if (clientAssocie) {
      router.push(`/fr/clients`)
      onFermer()
    } else {
      setMode("view")
      setMessage({
        type: "succes",
        texte: "Pour créer un compte rendu officiel CICC, créez d'abord la fiche client ou le dossier associé ci-dessous.",
      })
    }
  }

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl max-h-[92vh] flex flex-col bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête de la fiche */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40">
          <div className="flex items-center gap-3">
            <div className={`h-11 w-11 rounded-xl ${event.avatarBg || "bg-primary"} text-white flex items-center justify-center font-bold text-sm shrink-0`}>
              {event.clientInitials || "RDV"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={`text-[10px] font-semibold ${
                    event.status === "confirmed" || event.status === "ready"
                      ? "border-emerald-500/40 text-emerald-700 bg-emerald-500/10"
                      : event.status === "completed"
                      ? "border-primary/40 text-primary bg-primary/10"
                      : event.status === "cancelled"
                      ? "border-rose-500/40 text-rose-700 bg-rose-500/10"
                      : "border-amber-500/40 text-amber-700 bg-amber-500/10"
                  }`}
                >
                  {event.status === "confirmed" || event.status === "ready"
                    ? "Confirmé"
                    : event.status === "completed"
                    ? "Terminé"
                    : event.status === "cancelled"
                    ? "Annulé"
                    : "En attente"}
                </Badge>
                {event.matterId && (
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {event.matterId}
                  </span>
                )}
              </div>
              <h2 className="text-base font-bold text-foreground mt-0.5">
                {event.clientName}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onFermer}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Corps défilable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {message && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
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

          {/* VUE 1 : VISUALISATION COMPLÈTE */}
          {mode === "view" && (
            <div className="space-y-5">
              {/* Carte principale */}
              <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Objet de la rencontre
                    </span>
                    <h3 className="text-sm font-bold text-foreground mt-0.5">{event.title}</h3>
                  </div>
                  {event.link && (
                    <a
                      href={event.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shrink-0"
                    >
                      <Video className="h-3.5 w-3.5" />
                      <span>Rejoindre la visio</span>
                    </a>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-2 border-t border-border/60">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    <span>
                      <strong className="text-foreground">{getDayOfWeekName(event.date)}</strong> · {event.date}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    <span>{event.time || `${event.hour || 10} h 00`}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                    <span>Consultant : <strong className="text-foreground">{event.consultantName || "Adama Diarra, RCIC"}</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Globe className="h-3.5 w-3.5 text-primary" />
                    <span className="capitalize">{event.platform || "En personne"}</span>
                  </div>
                </div>
              </div>

              {/* Passerelle directe : Créer le compte rendu de rencontre */}
              <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-primary-strong">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Compte rendu officiel CICC</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Générer la fiche autonome dans le module « Rencontres & notes » du dossier client.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={handleCreerCompteRendu}
                  className="gap-1 text-xs bg-primary text-primary-foreground font-semibold shrink-0"
                >
                  <span>Créer le compte rendu</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Notes internes si présentes */}
              {event.notes && (
                <div className="p-3.5 rounded-xl border border-border bg-card space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Notes internes
                  </span>
                  <p className="text-xs text-foreground whitespace-pre-wrap">{event.notes}</p>
                </div>
              )}

              {/* Passerelle de conversion Prospect/Client si contact isolé */}
              <div className="p-3.5 rounded-xl border border-border bg-muted/10 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Liaison CRM & Dossier
                </span>
                <PromoteFromEvent
                  clientName={event.clientName}
                  program={event.program}
                  notes={event.notes}
                  dejaClient={Boolean(clientAssocie)}
                  dejaProspect={Boolean(prospectAssocie)}
                />
              </div>

              {/* Changement rapide de statut */}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <span className="text-xs font-semibold text-muted-foreground">Modifier le statut :</span>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleChangerStatutRapide("confirmed")}
                    disabled={enCours || event.status === "confirmed"}
                    className="h-7 text-[11px]"
                  >
                    Confirmé
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleChangerStatutRapide("completed")}
                    disabled={enCours || event.status === "completed"}
                    className="h-7 text-[11px]"
                  >
                    Terminé
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleChangerStatutRapide("no_show")}
                    disabled={enCours || event.status === "no_show"}
                    className="h-7 text-[11px] text-amber-700"
                  >
                    Non présenté
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* VUE 2 : DÉPLACEMENT DE LA RENCONTRE */}
          {mode === "move" && (
            <form onSubmit={handleConfirmerDeplacement} className="space-y-4">
              <div className="p-3 rounded-xl border border-primary/30 bg-primary/5 text-xs text-primary-strong font-medium">
                Déplacer le rendez-vous de <strong>{event.clientName}</strong>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Nouvelle date *</label>
                  <input
                    type="date"
                    required
                    value={moveDate}
                    onChange={(e) => setMoveDate(e.target.value)}
                    className="w-full h-9 px-2.5 text-xs rounded-lg border border-border bg-background"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Nouvelle heure *</label>
                  <select
                    value={moveHour}
                    onChange={(e) => setMoveHour(Number(e.target.value))}
                    className="w-full h-9 px-2.5 text-xs rounded-lg border border-border bg-background"
                  >
                    {Array.from({ length: 16 }, (_, i) => {
                      const h = 8 + i
                      return (
                        <option key={h} value={h}>
                          {String(h).padStart(2, "0")} h 00 (HE / Montréal)
                        </option>
                      )
                    })}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setMode("view")} disabled={enCours} className="text-xs">
                  Annuler
                </Button>
                <Button type="submit" size="sm" disabled={enCours} className="text-xs bg-primary text-primary-foreground font-semibold">
                  Confirmer le déplacement
                </Button>
              </div>
            </form>
          )}

          {/* VUE 3 : ÉDITION DES DÉTAILS */}
          {mode === "edit" && (
            <form onSubmit={handleEnregistrerModif} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Objet de la rencontre *</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full h-9 px-3 text-xs rounded-lg border border-border bg-background font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Modalité</label>
                  <select
                    value={editPlatform}
                    onChange={(e) => setEditPlatform(e.target.value)}
                    className="w-full h-9 px-2.5 text-xs rounded-lg border border-border bg-background"
                  >
                    <option value="in_person">En cabinet / Bureau</option>
                    <option value="google_meet">Google Meet</option>
                    <option value="zoom">Zoom</option>
                    <option value="teams">MS Teams</option>
                    <option value="phone">Téléphone</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="other">Autre modalité</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Statut</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full h-9 px-2.5 text-xs rounded-lg border border-border bg-background"
                  >
                    <option value="confirmed">Confirmé</option>
                    <option value="pending">En attente</option>
                    <option value="completed">Terminé</option>
                    <option value="cancelled">Annulé</option>
                    <option value="no_show">Non présenté</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Lien de réunion</label>
                <input
                  type="url"
                  value={editLink}
                  onChange={(e) => setEditLink(e.target.value)}
                  className="w-full h-9 px-3 text-xs font-mono rounded-lg border border-border bg-background"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Notes internes</label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-lg border border-border bg-background"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={() => setMode("view")} disabled={enCours} className="text-xs">
                  Annuler
                </Button>
                <Button type="submit" size="sm" disabled={enCours} className="text-xs bg-primary text-primary-foreground font-semibold">
                  Enregistrer les modifications
                </Button>
              </div>
            </form>
          )}
        </div>

        {/* Pied de page avec actions rapides */}
        {mode === "view" && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/40">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowConfirmSuppression(true)}
              className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 gap-1"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Supprimer</span>
            </Button>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMode("move")}
                className="text-xs gap-1.5"
              >
                <Calendar className="h-3.5 w-3.5" />
                <span>Déplacer</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMode("edit")}
                className="text-xs gap-1.5"
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>Modifier</span>
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation de suppression */}
      {showConfirmSuppression && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm p-6 rounded-2xl bg-card border border-border shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Annuler le rendez-vous</h3>
                <p className="text-xs text-muted-foreground">Confirmation avant suppression</p>
              </div>
            </div>
            <p className="text-xs text-foreground leading-relaxed">
              Êtes-vous certain de vouloir supprimer le rendez-vous de <strong>{event.clientName}</strong> ({event.date} à {event.time}) ?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setShowConfirmSuppression(false)} disabled={enCours} className="text-xs">
                Conserver
              </Button>
              <Button size="sm" onClick={handleSupprimer} disabled={enCours} className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold">
                Confirmer la suppression
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
