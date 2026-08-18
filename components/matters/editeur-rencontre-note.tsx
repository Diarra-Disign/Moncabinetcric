"use client"

import React, { useState, useEffect } from "react"
import {
  X,
  Calendar,
  Clock,
  Video,
  Phone,
  Users,
  FileText,
  Save,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Paperclip,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { MeetingNote, MeetingNoteInput, MeetingNoteType, MeetingNoteReason } from "@/lib/data/types"
import { creerNoteRencontre, modifierNoteRencontre } from "@/lib/data/meeting-notes-actions"

interface EditeurRencontreNoteProps {
  ouvert: boolean
  onFermer: () => void
  matterId: string
  clientId?: string | null
  clientName: string
  noteAEditer?: MeetingNote | null
  documentsDossier?: { id: string; name: string; category: string }[]
  onEnregistre: () => void
}

const TYPES_RENCONTRE: { val: MeetingNoteType; label: string; icone: React.ElementType }[] = [
  { val: "consultation", label: "Consultation officielle", icone: FileText },
  { val: "in_person", label: "En personne / Cabinet", icone: Users },
  { val: "videoconference", label: "Visioconférence", icone: Video },
  { val: "google_meet", label: "Google Meet", icone: Video },
  { val: "zoom", label: "Zoom", icone: Video },
  { val: "phone", label: "Appel téléphonique", icone: Phone },
  { val: "whatsapp", label: "WhatsApp", icone: Phone },
  { val: "email_exchange", label: "Échange écrit / Courriel", icone: FileText },
  { val: "other", label: "Autre modalité", icone: FileText },
]

const MOTIFS: { val: MeetingNoteReason; label: string }[] = [
  { val: "consultation_initiale", label: "Consultation initiale" },
  { val: "suivi_dossier", label: "Suivi de dossier" },
  { val: "verification_documents", label: "Vérification des documents" },
  { val: "preparation_demande", label: "Préparation d'une demande" },
  { val: "signature_document", label: "Signature de documents" },
  { val: "explication_procedure", label: "Explication de la procédure" },
  { val: "mise_a_jour", label: "Mise à jour du dossier" },
  { val: "demande_info", label: "Demande d'information" },
  { val: "autre", label: "Autre motif" },
]

const DUREES_RAPIDES = [15, 30, 45, 60, 90, 120]

const SECTIONS_PREDEFINIES = [
  { cle: "discussedInfo", titre: "Informations discutées", placeholder: "Points clés abordés lors de la séance..." },
  { cle: "observations", titre: "Analyse & observations", placeholder: "Observations du consultant, éléments d'admissibilité, risques..." },
  { cle: "decisions", titre: "Décisions prises", placeholder: "Orientations choisies, programme retenu, stratégie..." },
  { cle: "requestedDocs", titre: "Documents demandés", placeholder: "Pièces à fournir par le client ou à obtenir d'un tiers..." },
  { cle: "actionItems", titre: "Actions à effectuer", placeholder: "Tâches à réaliser par le cabinet ou le client avec responsabilités..." },
  { cle: "nextSteps", titre: "Prochaines étapes", placeholder: "Jalons à court et moyen terme..." },
]

export function EditeurRencontreNote({
  ouvert,
  onFermer,
  matterId,
  clientId,
  clientName,
  noteAEditer,
  documentsDossier = [],
  onEnregistre,
}: EditeurRencontreNoteProps) {
  if (!ouvert) return null

  return (
    <EditeurRencontreModal
      key={noteAEditer?.id ?? "nouveau"}
      onFermer={onFermer}
      matterId={matterId}
      clientId={clientId}
      clientName={clientName}
      noteAEditer={noteAEditer}
      documentsDossier={documentsDossier}
      onEnregistre={onEnregistre}
    />
  )
}

function EditeurRencontreModal({
  onFermer,
  matterId,
  clientId,
  clientName,
  noteAEditer,
  documentsDossier = [],
  onEnregistre,
}: Omit<EditeurRencontreNoteProps, "ouvert">) {
  const isEditing = Boolean(noteAEditer)
  const storageKey = `brouillon_rencontre_${matterId}`

  // Initial State function
  const [meetingDate, setMeetingDate] = useState(() => {
    if (noteAEditer) return noteAEditer.meetingDate
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        try {
          return JSON.parse(saved).meetingDate || new Date().toISOString().slice(0, 10)
        } catch { /* empty */ }
      }
    }
    return new Date().toISOString().slice(0, 10)
  })

  const [meetingTime, setMeetingTime] = useState(() => {
    if (noteAEditer) return noteAEditer.meetingTime || "10:00"
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        try {
          return JSON.parse(saved).meetingTime || "10:00"
        } catch { /* empty */ }
      }
    }
    return "10:00"
  })

  const [durationMinutes, setDurationMinutes] = useState(() => {
    if (noteAEditer) return noteAEditer.durationMinutes || 60
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        try {
          return JSON.parse(saved).durationMinutes || 60
        } catch { /* empty */ }
      }
    }
    return 60
  })

  const [meetingType, setMeetingType] = useState<MeetingNoteType>(() => {
    if (noteAEditer) return noteAEditer.meetingType
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        try {
          return JSON.parse(saved).meetingType || "consultation"
        } catch { /* empty */ }
      }
    }
    return "consultation"
  })

  const [meetingTypeOther, setMeetingTypeOther] = useState(() => noteAEditer?.meetingTypeOther || "")
  const [reason, setReason] = useState<MeetingNoteReason>(() => noteAEditer?.reason || "suivi_dossier")
  const [reasonOther, setReasonOther] = useState(() => noteAEditer?.reasonOther || "")
  const [subject, setSubject] = useState(() => {
    if (noteAEditer) return noteAEditer.subject
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        try {
          return JSON.parse(saved).subject || ""
        } catch { /* empty */ }
      }
    }
    return ""
  })

  const [content, setContent] = useState(() => {
    if (noteAEditer) return noteAEditer.content
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        try {
          return JSON.parse(saved).content || ""
        } catch { /* empty */ }
      }
    }
    return ""
  })

  const [sections, setSections] = useState<Record<string, string>>(() => {
    if (noteAEditer) {
      return {
        discussedInfo: noteAEditer.sections?.discussedInfo || "",
        observations: noteAEditer.sections?.observations || "",
        decisions: noteAEditer.sections?.decisions || "",
        requestedDocs: noteAEditer.sections?.requestedDocs || "",
        actionItems: noteAEditer.sections?.actionItems || "",
        nextSteps: noteAEditer.sections?.nextSteps || "",
        nextFollowupDate: noteAEditer.sections?.nextFollowupDate || "",
      }
    }
    return {
      discussedInfo: "",
      observations: "",
      decisions: "",
      requestedDocs: "",
      actionItems: "",
      nextSteps: "",
      nextFollowupDate: "",
    }
  })

  const [hasProchainRdv, setHasProchainRdv] = useState(() => Boolean(noteAEditer?.nextMeetingDate))
  const [nextMeetingDate, setNextMeetingDate] = useState(() => noteAEditer?.nextMeetingDate || "")
  const [nextMeetingTime, setNextMeetingTime] = useState(() => noteAEditer?.nextMeetingTime || "10:00")
  const [nextMeetingReason, setNextMeetingReason] = useState(() => noteAEditer?.nextMeetingReason || "")
  const [nextMeetingNotes, setNextMeetingNotes] = useState(() => noteAEditer?.nextMeetingNotes || "")

  const [selectedDocIds, setSelectedDocIds] = useState<string[]>(() => noteAEditer?.documents?.map((d) => d.id) || [])
  const [enCours, setEnCours] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [changeSummary, setChangeSummary] = useState("")
  const [showSectionsAvancees, setShowSectionsAvancees] = useState(false)

  // Autosave brouillon local pour nouvelle note
  useEffect(() => {
    if (!isEditing && typeof window !== "undefined") {
      const dataToSave = {
        meetingDate,
        meetingTime,
        durationMinutes,
        meetingType,
        meetingTypeOther,
        reason,
        reasonOther,
        subject,
        content,
        sections,
      }
      localStorage.setItem(storageKey, JSON.stringify(dataToSave))
    }
  }, [
    isEditing,
    meetingDate,
    meetingTime,
    durationMinutes,
    meetingType,
    meetingTypeOther,
    reason,
    reasonOther,
    subject,
    content,
    sections,
    storageKey,
  ])

  const handleToggleDoc = (docId: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    )
  }

  const handleSauvegarder = async (status: "draft" | "finalized") => {
    setErreur(null)
    if (!subject.trim()) {
      setErreur("Veuillez préciser l'objet / sujet de la rencontre.")
      return
    }
    if (!content.trim()) {
      setErreur("Le compte rendu / notes de la séance ne peut pas être vide.")
      return
    }

    setEnCours(true)
    try {
      const input: MeetingNoteInput = {
        matterId,
        clientId,
        meetingDate,
        meetingTime: meetingTime || null,
        durationMinutes,
        meetingType,
        meetingTypeOther: meetingType === "other" ? meetingTypeOther : null,
        reason,
        reasonOther: reason === "autre" ? reasonOther : null,
        subject: subject.trim(),
        content: content.trim(),
        sections: {
          discussedInfo: sections.discussedInfo?.trim() || undefined,
          observations: sections.observations?.trim() || undefined,
          decisions: sections.decisions?.trim() || undefined,
          requestedDocs: sections.requestedDocs?.trim() || undefined,
          actionItems: sections.actionItems?.trim() || undefined,
          nextSteps: sections.nextSteps?.trim() || undefined,
          nextFollowupDate: sections.nextFollowupDate?.trim() || undefined,
        },
        nextMeetingDate: hasProchainRdv ? nextMeetingDate || null : null,
        nextMeetingTime: hasProchainRdv ? nextMeetingTime || null : null,
        nextMeetingReason: hasProchainRdv ? nextMeetingReason || null : null,
        nextMeetingNotes: hasProchainRdv ? nextMeetingNotes || null : null,
        status,
        documentIds: selectedDocIds,
      }

      let res
      if (isEditing && noteAEditer) {
        res = await modifierNoteRencontre(noteAEditer.id, input, changeSummary)
      } else {
        res = await creerNoteRencontre(input)
        if (res.ok && typeof window !== "undefined") {
          localStorage.removeItem(storageKey)
        }
      }

      if (!res.ok) {
        setErreur(res.message)
      } else {
        onEnregistre()
        onFermer()
      }
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Erreur inattendue lors de l'enregistrement.")
    } finally {
      setEnCours(false)
    }
  }

  const insererGabarit = () => {
    const gabarit = `1. OBJET ET CONTEXTE :\nDiscussion détaillée avec le client concernant l'avancement du dossier.\n\n2. POINTS DISCUTÉS :\n- Revue des exigences et pièces reçues.\n- Réponses aux questions du client.\n\n3. ANALYSE DU CONSULTANT :\nLe dossier progresse conformément aux attentes réglementaires.\n\n4. DÉCISIONS & ACTIONS RETENUES :\n- Le client fournira les pièces complémentaires convenues.\n- Le cabinet procédera à la vérification finale avant soumission.`
    setContent((prev: string) => (prev.trim() ? `${prev}\n\n${gabarit}` : gabarit))
  }

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs text-primary border-primary/30">
                {isEditing ? noteAEditer?.reference : "NOUVELLE RENCONTRE"}
              </Badge>
              <span className="text-xs text-muted-foreground">Client : <strong className="text-foreground">{clientName}</strong></span>
            </div>
            <h2 className="text-lg font-bold text-foreground mt-1">
              {isEditing ? `Modifier la rencontre — ${noteAEditer?.reference}` : "Consigner une nouvelle rencontre client"}
            </h2>
          </div>
          <button
            onClick={onFermer}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Corps défilable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {erreur && (
            <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{erreur}</span>
            </div>
          )}

          {/* Section 1 : Métadonnées de la Rencontre */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-xl border border-border bg-muted/20">
            <div>
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-1.5">
                <Calendar className="h-3.5 w-3.5 text-primary" /> Date de rencontre *
              </label>
              <input
                type="date"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className="w-full h-9 px-3 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-1.5">
                <Clock className="h-3.5 w-3.5 text-primary" /> Heure
              </label>
              <input
                type="time"
                value={meetingTime}
                onChange={(e) => setMeetingTime(e.target.value)}
                className="w-full h-9 px-3 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-1.5">
                Durée (minutes)
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="5"
                  step="5"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="w-20 h-9 px-3 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                />
                <div className="flex flex-wrap gap-1">
                  {DUREES_RAPIDES.slice(0, 3).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDurationMinutes(d)}
                      className={`text-[10px] px-1.5 py-1 rounded border transition-colors ${
                        durationMinutes === d
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {d}m
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-1.5">
                Motif principal *
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as MeetingNoteReason)}
                className="w-full h-9 px-3 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {MOTIFS.map((m) => (
                  <option key={m.val} value={m.val}>
                    {m.label}
                  </option>
                ))}
              </select>
              {reason === "autre" && (
                <input
                  type="text"
                  placeholder="Précisez le motif..."
                  value={reasonOther}
                  onChange={(e) => setReasonOther(e.target.value)}
                  className="w-full h-8 mt-1 px-2.5 text-xs rounded-md border border-border bg-background"
                />
              )}
            </div>
          </div>

          {/* Section 2 : Modalité / Type de rencontre */}
          <div>
            <label className="text-xs font-semibold text-foreground block mb-2">
              Modalité / Type de rencontre *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
              {TYPES_RENCONTRE.map((t) => {
                const Icone = t.icone
                const isSelected = meetingType === t.val
                return (
                  <button
                    key={t.val}
                    type="button"
                    onClick={() => setMeetingType(t.val)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-left text-xs font-medium transition-all ${
                      isSelected
                        ? "border-primary bg-primary/10 text-primary-strong shadow-xs font-semibold"
                        : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    }`}
                  >
                    <Icone className={`h-4 w-4 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="truncate">{t.label}</span>
                  </button>
                )
              })}
            </div>
            {meetingType === "other" && (
              <input
                type="text"
                placeholder="Précisez la modalité..."
                value={meetingTypeOther}
                onChange={(e) => setMeetingTypeOther(e.target.value)}
                className="w-full h-9 mt-2 px-3 text-xs rounded-lg border border-border bg-background"
              />
            )}
          </div>

          {/* Section 3 : Sujet & Compte rendu principal */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-foreground flex items-center justify-between mb-1.5">
                <span>Objet / Sujet de la rencontre *</span>
                <span className="text-[10px] text-muted-foreground">Ex: Évaluation d&apos;admissibilité Permis de travail ou Revue des documents</span>
              </label>
              <input
                type="text"
                placeholder="Ex: Entretien de suivi sur les exigences de statut et documents financiers"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full h-10 px-3.5 text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-medium"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Compte rendu / Notes détaillées de la séance *
                </label>
                <button
                  type="button"
                  onClick={insererGabarit}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                >
                  <Sparkles className="h-3 w-3" /> Insérer structure recommandée
                </button>
              </div>
              <textarea
                rows={6}
                placeholder="Consignez ici l'ensemble des échanges, observations juridiques, informations vérifiées et conseils prodigués..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full p-3.5 text-xs rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-sans leading-relaxed"
              />
            </div>
          </div>

          {/* Section 4 : Sections Structurées Détaillées */}
          <div className="border border-border rounded-xl overflow-hidden bg-card">
            <button
              type="button"
              onClick={() => setShowSectionsAvancees(!showSectionsAvancees)}
              className="w-full flex items-center justify-between p-3.5 text-xs font-semibold text-foreground bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-primary" />
                <span>Rubriques d&apos;analyse structurées (Décisions, Documents demandés, Actions)</span>
              </div>
              {showSectionsAvancees ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>

            {showSectionsAvancees && (
              <div className="p-4 space-y-4 border-t border-border bg-background">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {SECTIONS_PREDEFINIES.map((sec) => (
                    <div key={sec.cle}>
                      <label className="text-xs font-medium text-foreground block mb-1">
                        {sec.titre}
                      </label>
                      <textarea
                        rows={2}
                        placeholder={sec.placeholder}
                        value={sections[sec.cle] || ""}
                        onChange={(e) => setSections({ ...sections, [sec.cle]: e.target.value })}
                        className="w-full p-2.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section 5 : Prochain Rendez-vous / Suivi convenu */}
          <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasProchainRdv}
                  onChange={(e) => setHasProchainRdv(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                />
                <span>Planifier un prochain rendez-vous / suivi convenu</span>
              </label>
            </div>

            {hasProchainRdv && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Date prévue</label>
                  <input
                    type="date"
                    value={nextMeetingDate}
                    onChange={(e) => setNextMeetingDate(e.target.value)}
                    className="w-full h-8 px-2.5 text-xs rounded-lg border border-border bg-background"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Heure</label>
                  <input
                    type="time"
                    value={nextMeetingTime}
                    onChange={(e) => setNextMeetingTime(e.target.value)}
                    className="w-full h-8 px-2.5 text-xs rounded-lg border border-border bg-background"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Objectif du prochain suivi</label>
                  <input
                    type="text"
                    placeholder="Ex: Réception des traductions"
                    value={nextMeetingReason}
                    onChange={(e) => setNextMeetingReason(e.target.value)}
                    className="w-full h-8 px-2.5 text-xs rounded-lg border border-border bg-background"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section 6 : Associer des documents du dossier */}
          {documentsDossier.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-2">
                <Paperclip className="h-3.5 w-3.5 text-primary" />
                Associer des documents examinés lors de la rencontre
              </label>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 rounded-xl border border-border bg-card">
                {documentsDossier.map((doc) => {
                  const isChecked = selectedDocIds.includes(doc.id)
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => handleToggleDoc(doc.id)}
                      className={`text-xs px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 transition-colors ${
                        isChecked
                          ? "bg-primary/10 border-primary text-primary font-medium"
                          : "bg-muted/40 border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Paperclip className="h-3 w-3" />
                      <span className="truncate max-w-[200px]">{doc.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Section 7 : Motif de modification */}
          {isEditing && noteAEditer?.status === "finalized" && (
            <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10">
              <label className="text-xs font-semibold text-amber-900 dark:text-amber-300 block mb-1">
                Motif de modification (Compte-rendu déjà finalisé) *
              </label>
              <input
                type="text"
                placeholder="Ex: Ajout d'une précision suite au courriel complémentaire du client..."
                value={changeSummary}
                onChange={(e) => setChangeSummary(e.target.value)}
                className="w-full h-8 px-2.5 text-xs rounded-lg border border-amber-500/40 bg-background"
              />
              <p className="text-[11px] text-amber-800 dark:text-amber-400 mt-1">
                Une révision sera automatiquement enregistrée dans l&apos;historique inaltérable de la note.
              </p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/40">
          <Button variant="ghost" size="sm" onClick={onFermer} disabled={enCours}>
            Annuler
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleSauvegarder("draft")}
              disabled={enCours}
              className="gap-1.5 text-xs"
            >
              <Save className="h-3.5 w-3.5" />
              Enregistrer comme brouillon
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => handleSauvegarder("finalized")}
              disabled={enCours}
              className="gap-1.5 text-xs bg-primary text-primary-foreground font-semibold"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Finaliser le compte rendu
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
