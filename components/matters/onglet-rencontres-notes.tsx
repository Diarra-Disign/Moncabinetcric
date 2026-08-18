"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
import {
  Calendar,
  Clock,
  Plus,
  Search,
  Filter,
  FileText,
  Video,
  Phone,
  Users,
  CheckCircle2,
  Lock,
  Share2,
  MoreVertical,
  Edit,
  Download,
  Eye,
  MessageSquareText,
  CalendarCheck,
  AlertCircle,
  Archive,
  RefreshCw,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import type { MeetingNote, MeetingNoteType } from "@/lib/data/types"
import { listerNotesRencontre } from "@/lib/data/meeting-notes-actions"
import { EditeurRencontreNote } from "./editeur-rencontre-note"
import { ModalDetailRencontre } from "./modal-detail-rencontre"

interface OngletRencontresNotesProps {
  matterId: string
  clientId?: string | null
  clientName: string
  documentsDossier?: { id: string; name: string; category: string }[]
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  consultation: FileText,
  in_person: Users,
  videoconference: Video,
  google_meet: Video,
  zoom: Video,
  phone: Phone,
  whatsapp: Phone,
  email_exchange: FileText,
  other: FileText,
}

export function OngletRencontresNotes({
  matterId,
  clientId,
  clientName,
  documentsDossier = [],
}: OngletRencontresNotesProps) {
  const [notes, setNotes] = useState<MeetingNote[]>([])
  const [chargement, setChargement] = useState(true)
  const [recherche, setRecherche] = useState("")
  const [filtreType, setFiltreType] = useState<string>("tous")
  const [filtreStatut, setFiltreStatut] = useState<string>("tous")

  // Modales
  const [editeurOuvert, setEditeurOuvert] = useState(false)
  const [noteAEditer, setNoteAEditer] = useState<MeetingNote | null>(null)
  const [detailOuvert, setDetailOuvert] = useState(false)
  const [noteSelectionnee, setNoteSelectionnee] = useState<MeetingNote | null>(null)

  const chargerNotes = useCallback(async () => {
    setChargement(true)
    try {
      const data = await listerNotesRencontre(matterId)
      setNotes(data)
    } catch (e) {
      console.error("Erreur chargement notes rencontres:", e)
    } finally {
      setChargement(false)
    }
  }, [matterId])

  useEffect(() => {
    let actif = true
    listerNotesRencontre(matterId)
      .then((data) => {
        if (actif) {
          setNotes(data)
          setChargement(false)
        }
      })
      .catch((e) => {
        console.error("Erreur chargement notes:", e)
        if (actif) setChargement(false)
      })

    return () => {
      actif = false
    }
  }, [matterId])

  // Filtrage & Recherche
  const notesFiltrees = useMemo(() => {
    return notes.filter((n) => {
      // Filtre texte
      if (recherche.trim()) {
        const q = recherche.toLowerCase()
        const matchSujet = n.subject.toLowerCase().includes(q)
        const matchContenu = n.content.toLowerCase().includes(q)
        const matchRef = n.reference.toLowerCase().includes(q)
        const matchAuteur = (n.createdByName || "").toLowerCase().includes(q)
        if (!matchSujet && !matchContenu && !matchRef && !matchAuteur) return false
      }

      // Filtre type
      if (filtreType !== "tous" && n.meetingType !== filtreType) return false

      // Filtre statut
      if (filtreStatut === "brouillons" && n.status !== "draft") return false
      if (filtreStatut === "finalisees" && n.status !== "finalized") return false
      if (filtreStatut === "partagees" && n.visibility !== "shared_client") return false

      return true
    })
  }, [notes, recherche, filtreType, filtreStatut])

  // Statistiques
  const stats = useMemo(() => {
    const total = notes.length
    const consultations = notes.filter((n) => n.meetingType === "consultation").length
    const brouillons = notes.filter((n) => n.status === "draft").length
    const finalisees = notes.filter((n) => n.status === "finalized").length
    const minutesTotales = notes.reduce((acc, n) => acc + (n.durationMinutes || 0), 0)
    const heures = Math.floor(minutesTotales / 60)
    const minutes = minutesTotales % 60
    const tempsCumule = heures > 0 ? `${heures} h ${minutes > 0 ? `${minutes} min` : ""}` : `${minutes} min`

    return { total, consultations, brouillons, finalisees, tempsCumule }
  }, [notes])

  const handleOuvrirNouveau = () => {
    setNoteAEditer(null)
    setEditeurOuvert(true)
  }

  const handleOuvrirModifier = (note: MeetingNote) => {
    setDetailOuvert(false)
    setNoteAEditer(note)
    setEditeurOuvert(true)
  }

  const handleOuvrirDetail = (note: MeetingNote) => {
    setNoteSelectionnee(note)
    setDetailOuvert(true)
  }

  return (
    <div className="space-y-6">
      {/* 1. Bandeau de présentation & KPIs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border border-border bg-card shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-foreground">Rencontres & Notes de dossier</h2>
            <Badge variant="outline" className="bg-primary/10 text-primary-strong border-primary/20 text-xs font-mono">
              {stats.total} {stats.total > 1 ? "fiches" : "fiche"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            Registre chronologique officiel des consultations, entretiens téléphoniques, visioconférences et notes d&apos;instructions. Chaque rencontre génère une note autonome et inaltérable.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={chargerNotes}
            variant="outline"
            size="sm"
            className="h-9 px-2.5 text-muted-foreground hover:text-foreground"
            title="Rafraîchir les notes"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${chargement ? "animate-spin" : ""}`} />
          </Button>
          <Button
            onClick={handleOuvrirNouveau}
            size="sm"
            className="h-9 gap-1.5 bg-primary text-primary-foreground font-semibold shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>+ Nouvelle rencontre</span>
          </Button>
        </div>
      </div>

      {/* 2. Cartes KPIs / Synthèse */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl border border-border bg-card">
          <span className="text-[11px] text-muted-foreground block font-medium">Total des séances</span>
          <span className="text-xl font-bold text-foreground mt-0.5 block">{stats.total}</span>
          <span className="text-[10px] text-muted-foreground">{stats.tempsCumule} d&apos;entretien</span>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-card">
          <span className="text-[11px] text-muted-foreground block font-medium">Consultations officielles</span>
          <span className="text-xl font-bold text-primary mt-0.5 block">{stats.consultations}</span>
          <span className="text-[10px] text-muted-foreground">Art. 23 Code CICC</span>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-card">
          <span className="text-[11px] text-muted-foreground block font-medium">Comptes rendus finalisés</span>
          <span className="text-xl font-bold text-success-strong mt-0.5 block">{stats.finalisees}</span>
          <span className="text-[10px] text-success">Verrouillés & officiels</span>
        </div>

        <div className="p-3.5 rounded-xl border border-border bg-card">
          <span className="text-[11px] text-muted-foreground block font-medium">Brouillons en cours</span>
          <span className="text-xl font-bold text-warning-strong mt-0.5 block">{stats.brouillons}</span>
          <span className="text-[10px] text-warning">À finaliser</span>
        </div>
      </div>

      {/* 3. Barre de recherche et filtres */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher par objet, notes, consultant ou référence (REN-...)..."
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            className="w-full h-9 pl-9 pr-3 text-xs rounded-xl border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>

        {/* Filtres rapides */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFiltreType("tous")}
            className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
              filtreType === "tous"
                ? "bg-primary text-primary-foreground border-primary font-medium"
                : "bg-card border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            Tous
          </button>
          <button
            type="button"
            onClick={() => setFiltreType("consultation")}
            className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
              filtreType === "consultation"
                ? "bg-primary text-primary-foreground border-primary font-medium"
                : "bg-card border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            Consultations
          </button>
          <button
            type="button"
            onClick={() => setFiltreType("in_person")}
            className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
              filtreType === "in_person"
                ? "bg-primary text-primary-foreground border-primary font-medium"
                : "bg-card border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            En personne
          </button>
          <button
            type="button"
            onClick={() => setFiltreType("videoconference")}
            className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
              filtreType === "videoconference"
                ? "bg-primary text-primary-foreground border-primary font-medium"
                : "bg-card border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            Visioconférence
          </button>
          <button
            type="button"
            onClick={() => setFiltreType("phone")}
            className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
              filtreType === "phone"
                ? "bg-primary text-primary-foreground border-primary font-medium"
                : "bg-card border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            Téléphone
          </button>

          <span className="h-4 w-px bg-border mx-1" />

          <button
            type="button"
            onClick={() => setFiltreStatut(filtreStatut === "brouillons" ? "tous" : "brouillons")}
            className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
              filtreStatut === "brouillons"
                ? "bg-warning/15 text-warning-strong border-warning/40 font-medium"
                : "bg-card border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            Brouillons
          </button>
          <button
            type="button"
            onClick={() => setFiltreStatut(filtreStatut === "partagees" ? "tous" : "partagees")}
            className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
              filtreStatut === "partagees"
                ? "bg-primary/10 text-primary-strong border-primary/30 font-medium"
                : "bg-card border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            Portail client
          </button>
        </div>
      </div>

      {/* 4. Liste chronologique des rencontres */}
      {chargement ? (
        <div className="p-12 text-center text-xs text-muted-foreground">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto text-primary mb-2" />
          Chargement du registre des rencontres...
        </div>
      ) : notesFiltrees.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-card">
          <MessageSquareText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-foreground">
            {notes.length === 0 ? "Aucune rencontre consignée pour ce dossier" : "Aucun résultat pour cette recherche"}
          </h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            {notes.length === 0
              ? "Documentez dès maintenant les échanges, rendez-vous ou consultations avec le client pour assurer la conformité CICC."
              : "Essayez de modifier vos filtres ou termes de recherche."}
          </p>
          {notes.length === 0 && (
            <Button onClick={handleOuvrirNouveau} size="sm" className="mt-4 text-xs gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Consigner la première rencontre
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {notesFiltrees.map((note) => {
            const Icone = TYPE_ICONS[note.meetingType] || FileText
            const pdfUrl = `/api/matters/${matterId}/meetings/${note.id}/pdf`

            return (
              <div
                key={note.id}
                onClick={() => handleOuvrirDetail(note)}
                className="group relative p-5 rounded-2xl border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all cursor-pointer overflow-hidden"
              >
                {/* Accent latéral */}
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1 ${
                    note.status === "finalized"
                      ? "bg-success"
                      : note.status === "draft"
                      ? "bg-warning"
                      : "bg-muted"
                  }`}
                />

                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    {/* Icône de modalité */}
                    <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary-strong flex items-center justify-center shrink-0 mt-0.5">
                      <Icone className="h-5 w-5" />
                    </div>

                    <div className="space-y-1">
                      {/* Métadonnées supérieures */}
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Badge variant="outline" className="font-mono text-[11px] font-bold text-foreground border-border bg-muted/30">
                          {note.reference}
                        </Badge>
                        <span className="text-muted-foreground flex items-center gap-1 font-medium">
                          <Calendar className="h-3 w-3 text-primary" /> {note.meetingDate} {note.meetingTime ? `à ${note.meetingTime}` : ""}
                        </span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {note.durationMinutes} min
                        </span>
                        <span className="text-muted-foreground">·</span>
                        <span className="font-medium text-foreground capitalize">
                          {note.reasonOther || note.reason.replace("_", " ")}
                        </span>
                      </div>

                      {/* Titre / Objet de la rencontre */}
                      <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                        {note.subject}
                      </h3>

                      {/* Aperçu du compte rendu */}
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed pt-0.5">
                        {note.content}
                      </p>

                      {/* Badges de bas de carte */}
                      <div className="flex flex-wrap items-center gap-2 pt-2 text-[11px]">
                        {note.status === "finalized" ? (
                          <Badge variant="outline" className="bg-success/15 text-success-strong border-success/30 text-[10px] py-0 font-semibold">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Finalisée
                          </Badge>
                        ) : note.status === "draft" ? (
                          <Badge variant="outline" className="bg-warning/15 text-warning-strong border-warning/30 text-[10px] py-0 font-semibold">
                            Brouillon
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] py-0">
                            Archivée
                          </Badge>
                        )}

                        {note.visibility === "shared_client" ? (
                          <Badge variant="outline" className="bg-primary/10 text-primary-strong border-primary/25 text-[10px] py-0 flex items-center gap-1">
                            <Share2 className="h-3 w-3" /> Portail client
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground text-[10px] py-0 flex items-center gap-1">
                            <Lock className="h-3 w-3" /> Interne cabinet
                          </Badge>
                        )}

                        {note.documents && note.documents.length > 0 && (
                          <span className="text-muted-foreground text-[11px]">
                            📎 {note.documents.length} {note.documents.length > 1 ? "documents" : "document"}
                          </span>
                        )}

                        {note.nextMeetingDate && (
                          <span className="text-primary font-medium text-[11px] flex items-center gap-1">
                            <CalendarCheck className="h-3 w-3" /> Prochain suivi : {note.nextMeetingDate}
                          </span>
                        )}

                        <span className="text-muted-foreground ml-auto text-[10px]">
                          Par {note.createdByName || "Consultant"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions directes rapides */}
                  <div className="flex items-center gap-1 self-end sm:self-center shrink-0" onClick={(e) => e.stopPropagation()}>
                    <a
                      href={pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      title="Télécharger compte-rendu PDF"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                    <button
                      onClick={() => handleOuvrirModifier(note)}
                      className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      title="Modifier"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleOuvrirDetail(note)}
                      className="p-2 rounded-lg text-primary hover:bg-primary/10 transition-colors"
                      title="Voir détail"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modale d'Édition / Création */}
      <EditeurRencontreNote
        ouvert={editeurOuvert}
        onFermer={() => setEditeurOuvert(false)}
        matterId={matterId}
        clientId={clientId}
        clientName={clientName}
        noteAEditer={noteAEditer}
        documentsDossier={documentsDossier}
        onEnregistre={chargerNotes}
      />

      {/* Modale de Détail & Impression */}
      <ModalDetailRencontre
        ouvert={detailOuvert}
        onFermer={() => setDetailOuvert(false)}
        note={noteSelectionnee}
        matterId={matterId}
        clientName={clientName}
        onModifier={handleOuvrirModifier}
        onRafraichir={chargerNotes}
      />
    </div>
  )
}
