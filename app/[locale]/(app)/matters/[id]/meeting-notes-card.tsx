"use client"

import * as React from "react"
import { MessageSquareText, Plus, User, Calendar, CheckCircle2, Clock, Trash2, Send, Video, Globe } from "lucide-react"
import { SignaturePad } from "@/components/ui/signature-pad"

export interface MeetingNote {
  id: string
  date: string
  author: string
  type: "consultation" | "phone" | "email" | "review"
  content: string
}

const INITIAL_NOTES: Record<string, MeetingNote[]> = {
  "#DOS-35695": [
    {
      id: "note-1",
      date: "28 Juillet 2026",
      author: "Adama Diarra (RCIC)",
      type: "consultation",
      content: "Consultation initiale effectuée via Zoom. Révision du diplôme et du résultat TEF Canada (B2/C1)."
    }
  ],
  "#DOS-35697": [
    {
      id: "note-101",
      date: "25 Juillet 2026",
      author: "Adama Diarra (RCIC)",
      type: "consultation",
      content: "Examen des diplômes biomédicaux. Évaluation EDE WES à joindre au profil Entrée Express."
    }
  ]
}

interface MeetingNotesCardProps {
  matterId: string
  clientName?: string
}

export function MeetingNotesCard({ matterId, clientName = "Client" }: MeetingNotesCardProps) {
  const normalizedId = matterId.startsWith("#") ? matterId : `#${matterId}`
  const [notes, setNotes] = React.useState<MeetingNote[]>(INITIAL_NOTES[normalizedId] || [
    {
      id: "note-default",
      date: "Aujourd'hui",
      author: "Adama Diarra (RCIC)",
      type: "consultation",
      content: `Compte-rendu d'ouverture de dossier pour ${clientName}. Vérification réglementaire initiale effectuée.`
    }
  ])

  const [newNoteContent, setNewNoteContent] = React.useState("")
  const [newNoteType, setNewNoteType] = React.useState<MeetingNote["type"]>("consultation")
  const [authorName, setAuthorName] = React.useState("Adama Diarra (RCIC)")
  const [successNotice, setSuccessNotice] = React.useState<string | null>(null)

  const handleSendCalendlyInvite = () => {
    const inviteNote: MeetingNote = {
      id: `invite-${Date.now()}`,
      date: new Date().toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" }),
      author: authorName,
      type: "consultation",
      content: `Lien de réservation Calendly & visioconférence Google Meet transmis sur le Portail Client de ${clientName}.`
    }
    setNotes(prev => [inviteNote, ...prev])
    setSuccessNotice(`Lien de rendez-vous virtuel (Calendly/Meet) envoyé à ${clientName} et synchronisé sur son Portail !`)
    setTimeout(() => setSuccessNotice(null), 5000)
  }

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newNoteContent.trim()) return

    const created: MeetingNote = {
      id: `note-${Date.now()}`,
      date: new Date().toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" }),
      author: authorName,
      type: newNoteType,
      content: newNoteContent.trim()
    }

    setNotes(prev => [created, ...prev])
    setNewNoteContent("")
    setSuccessNotice("Note de rencontre enregistrée dans le journal CICC !")
    setTimeout(() => setSuccessNotice(null), 4000)
  }

  const handleDeleteNote = (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id))
  }

  const getTypeLabel = (type: MeetingNote["type"]) => {
    switch (type) {
      case "consultation": return "Consultation Officielle"
      case "phone": return "Appel Téléphonique"
      case "email": return "Échange Courriel"
      case "review": return "Revue de Dossier CICC"
    }
  }

  return (
    <div className="flex flex-col gap-6">
      
      {/* 1. CARTE DES NOTES DE RENCONTRE */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.02)] p-6 flex flex-col gap-6">
        
        {/* HEADER DE LA CARTE */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <MessageSquareText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base text-slate-900">Notes de Rencontre & Consultations CICC</h3>
              <p className="text-xs text-slate-500 font-medium">Historique des comptes-rendus et consignes de suivi client</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSendCalendlyInvite}
              className="inline-flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-3 py-1.5 rounded-full transition-all shadow-sm cursor-pointer"
            >
              <Video className="w-3.5 h-3.5" />
              <span>Inviter en visio / Calendly</span>
            </button>
            <span className="bg-blue-100 text-blue-800 border border-blue-200 text-xs font-mono font-bold px-3 py-1 rounded-full">
              {notes.length} notes
            </span>
          </div>
        </div>

        {/* ALERT DE SUCCÈS */}
        {successNotice && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold p-3 rounded-2xl flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successNotice}</span>
          </div>
        )}

        {/* FORMULAIRE DE SAISIE D'UNE NOUVELLE NOTE */}
        <form onSubmit={handleAddNote} className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-blue-600" />
              <span>Ajouter un Compte-Rendu / Note de Rencontre</span>
            </label>

            <div className="flex items-center gap-2">
              <select
                value={newNoteType}
                onChange={(e) => setNewNoteType(e.target.value as "consultation" | "phone" | "email" | "review")}
                className="text-xs font-bold bg-white border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none cursor-pointer text-slate-800"
              >
                <option value="consultation">Consultation En Cabinet</option>
                <option value="phone">Appel Téléphonique</option>
                <option value="email">Échange Courriel</option>
                <option value="review">Revue Technico-Juridique</option>
              </select>
            </div>
          </div>

          <textarea
            rows={3}
            required
            placeholder="Saisissez les détails de la rencontre, les exigences formulées et les prochaines étapes convenues avec le client..."
            value={newNoteContent}
            onChange={(e) => setNewNoteContent(e.target.value)}
            className="w-full p-3 text-xs font-medium bg-white rounded-xl border border-slate-200 focus:border-blue-600 focus:outline-none transition-all text-slate-900 placeholder:text-slate-400"
          />

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>Rédigé par : <strong>{authorName}</strong></span>
            </div>

            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Enregistrer la note</span>
            </button>
          </div>
        </form>

        {/* LISTE DES NOTES HISTORIQUES */}
        <div className="flex flex-col gap-3">
          {notes.map((note) => (
            <div key={note.id} className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col gap-2 relative group">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">
                    {getTypeLabel(note.type)}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {note.date}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-600">{note.author}</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteNote(note.id)}
                    title="Supprimer la note"
                    className="text-slate-300 hover:text-rose-600 p-1 rounded-md transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-700 font-medium leading-relaxed bg-slate-50/60 p-3 rounded-xl border border-slate-100">
                {note.content}
              </p>
            </div>
          ))}
        </div>

      </div>

      {/* 2. SIGNATURE ÉLECTRONIQUE HTML5 NATIVE DU MANDAT CICC */}
      <SignaturePad title="Signature du Mandat de Représentation CICC" clientName={clientName} />

    </div>
  )
}
