"use client"

import * as React from "react"
import {
  Calendar as CalendarIcon,
  Clock,
  Video,
  User,
  Plus,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Filter,
  FileText,
  ShieldCheck,
  Globe,
  Building2,
  Search,
  CalendarDays,
  CalendarCheck,
  CalendarPlus,
  GripVertical,
  List,
  LayoutGrid,
  Phone,
  MessageSquare,
  Sparkles,
  SlidersHorizontal,
  ArrowRight,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/app-shell/page-header"
import type { CalendarEvent, ClientRecord, Matter, Lead } from "@/lib/data/types"
import { rescheduleCalendarEvent } from "@/lib/data/actions"
import { ModalPriseRendezVous } from "@/components/calendar/modal-prise-rendez-vous"
import { ModalDetailRendezVous } from "@/components/calendar/modal-detail-rendez-vous"

export interface CalendarClientProps {
  initialEvents?: CalendarEvent[]
  clients?: ClientRecord[]
  matters?: Matter[]
  leads?: Lead[]
}

function toLocalISO(d: Date): string {
  const mois = String(d.getMonth() + 1).padStart(2, "0")
  const jour = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${mois}-${jour}`
}

function getDayOfWeekName(dateIso: string): string {
  if (!dateIso) return "Date"
  const d = new Date(dateIso + "T12:00:00")
  if (isNaN(d.getTime())) return dateIso
  const dayNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]
  return dayNames[d.getDay()] || "Date"
}

function buildHourRows(from: number, to: number) {
  return Array.from({ length: to - from + 1 }, (_, i) => {
    const hour = from + i
    return { hour, label: `${String(hour).padStart(2, "0")} h 00` }
  })
}

const BUSINESS_HOURS = buildHourRows(8, 18)
const FULL_DAY_HOURS = buildHourRows(8, 23)

export function CalendarClient({
  initialEvents = [],
  clients = [],
  matters = [],
  leads = [],
}: CalendarClientProps) {
  const [events, setEvents] = React.useState<CalendarEvent[]>(initialEvents)
  const [currentDate, setCurrentDate] = React.useState<Date>(() => new Date())
  const [viewMode, setViewMode] = React.useState<"workweek" | "week" | "month" | "day" | "agenda">("workweek")
  const [fullDay, setFullDay] = React.useState(false)
  const hourRows = fullDay ? FULL_DAY_HOURS : BUSINESS_HOURS

  // Filtres & Recherche
  const [searchQuery, setSearchQuery] = React.useState("")
  const [filtreType, setFiltreType] = React.useState<string>("tous")
  const [filtreStatut, setFiltreStatut] = React.useState<string>("tous")
  const [showFiltres, setShowFiltres] = React.useState(false)

  // Modales
  const [priseRdvOuverte, setPriseRdvOuverte] = React.useState(false)
  const [rdvInitialDate, setRdvInitialDate] = React.useState<string | undefined>(undefined)
  const [rdvInitialHour, setRdvInitialHour] = React.useState<number | undefined>(undefined)
  const [detailOuvert, setDetailOuvert] = React.useState(false)
  const [selectedEvent, setSelectedEvent] = React.useState<CalendarEvent | null>(null)

  // Drag and Drop
  const [draggedEventId, setDraggedEventId] = React.useState<string | null>(null)
  const [dragOverTarget, setDragOverTarget] = React.useState<string | null>(null)

  // Toast
  const [toastNotice, setToastNotice] = React.useState<string | null>(null)

  // Heure courante en direct
  const [nowTime, setNowTime] = React.useState<Date>(() => new Date())
  React.useEffect(() => {
    const interval = setInterval(() => setNowTime(new Date()), 30000)
    return () => clearInterval(interval)
  }, [])

  // Navigation temporelle
  const handlePrevPeriod = () => {
    const next = new Date(currentDate)
    if (viewMode === "day") {
      next.setDate(next.getDate() - 1)
    } else if (viewMode === "workweek" || viewMode === "week") {
      next.setDate(next.getDate() - 7)
    } else if (viewMode === "month" || viewMode === "agenda") {
      next.setMonth(next.getMonth() - 1)
    }
    setCurrentDate(next)
  }

  const handleNextPeriod = () => {
    const next = new Date(currentDate)
    if (viewMode === "day") {
      next.setDate(next.getDate() + 1)
    } else if (viewMode === "workweek" || viewMode === "week") {
      next.setDate(next.getDate() + 7)
    } else if (viewMode === "month" || viewMode === "agenda") {
      next.setMonth(next.getMonth() + 1)
    }
    setCurrentDate(next)
  }

  const handleToday = () => {
    setCurrentDate(new Date())
  }

  // Libellé de période
  const periodTitle = React.useMemo(() => {
    const year = currentDate.getFullYear()
    const monthNames = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]
    const dayNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]

    if (viewMode === "day") {
      const dayName = dayNames[currentDate.getDay()]
      return `${dayName} ${currentDate.getDate()} ${monthNames[currentDate.getMonth()]} ${year}`
    }

    if (viewMode === "workweek" || viewMode === "week") {
      const dayOfWeek = currentDate.getDay()
      const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
      const start = new Date(currentDate)
      start.setDate(currentDate.getDate() + diffToMon)

      const count = viewMode === "workweek" ? 4 : 6
      const end = new Date(start)
      end.setDate(start.getDate() + count)

      return `${start.getDate()} ${monthNames[start.getMonth()].slice(0, 4)}. – ${end.getDate()} ${monthNames[end.getMonth()]} ${year}`
    }

    return `${monthNames[currentDate.getMonth()]} ${year}`
  }, [currentDate, viewMode])

  // Jours affichés dans la vue courante
  const activeDays = React.useMemo(() => {
    if (viewMode === "day") {
      const iso = toLocalISO(currentDate)
      return [
        {
          label: getDayOfWeekName(iso).slice(0, 3),
          dayNum: currentDate.getDate(),
          iso,
          isToday: iso === toLocalISO(new Date()),
        },
      ]
    }

    const dayOfWeek = currentDate.getDay()
    const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const startOfWeek = new Date(currentDate)
    startOfWeek.setDate(currentDate.getDate() + diffToMon)

    const count = viewMode === "workweek" ? 5 : 7
    const dayLabels = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]
    const result = []

    for (let i = 0; i < count; i++) {
      const d = new Date(startOfWeek)
      d.setDate(startOfWeek.getDate() + i)
      const iso = toLocalISO(d)
      result.push({
        label: dayLabels[i],
        dayNum: d.getDate(),
        iso,
        isToday: iso === toLocalISO(new Date()),
      })
    }
    return result
  }, [currentDate, viewMode])

  // Matrice du mois pour la vue Month
  const monthDays = React.useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)

    const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1
    const totalDays = lastDay.getDate()

    const days = []
    // Jours du mois précédent
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = new Date(year, month, -i)
      days.push({ iso: toLocalISO(d), dayNum: d.getDate(), currentMonth: false })
    }
    // Jours du mois actuel
    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(year, month, i)
      days.push({ iso: toLocalISO(d), dayNum: i, currentMonth: true })
    }
    // Jours du mois suivant
    const remaining = (7 - (days.length % 7)) % 7
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i)
      days.push({ iso: toLocalISO(d), dayNum: i, currentMonth: false })
    }

    return days
  }, [currentDate])

  // Événements filtrés
  const filteredEvents = React.useMemo(() => {
    return events.filter((evt) => {
      // Filtre texte
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchText =
          evt.clientName.toLowerCase().includes(q) ||
          evt.title.toLowerCase().includes(q) ||
          (evt.matterId && evt.matterId.toLowerCase().includes(q)) ||
          (evt.notes && evt.notes.toLowerCase().includes(q))
        if (!matchText) return false
      }

      // Filtre type
      if (filtreType !== "tous") {
        if (filtreType === "consultation" && evt.type !== "consultation" && evt.type !== "visio") return false
        if (filtreType === "followup" && evt.type !== "followup") return false
        if (filtreType === "deadline" && evt.type !== "deadline") return false
        if (filtreType === "signing" && evt.type !== "signing") return false
      }

      // Filtre statut
      if (filtreStatut !== "tous") {
        if (filtreStatut === "confirmed" && evt.status !== "confirmed" && evt.status !== "ready") return false
        if (filtreStatut === "pending" && evt.status !== "pending" && evt.status !== "pending_doc") return false
        if (filtreStatut === "completed" && evt.status !== "completed") return false
        if (filtreStatut === "cancelled" && evt.status !== "cancelled") return false
      }

      return true
    })
  }, [events, searchQuery, filtreType, filtreStatut])

  // Regroupement pour vue agenda
  const groupedEventsByDay = React.useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    // Trier par date puis par heure
    const sorted = [...filteredEvents].sort((a, b) => {
      const cmpDate = a.date.localeCompare(b.date)
      if (cmpDate !== 0) return cmpDate
      return (a.hour ?? 0) - (b.hour ?? 0)
    })

    sorted.forEach((e) => {
      if (!map.has(e.date)) map.set(e.date, [])
      map.get(e.date)!.push(e)
    })

    return Array.from(map.entries()).map(([dateIso, evts]) => ({
      dateIso,
      dayOfWeek: getDayOfWeekName(dateIso),
      events: evts,
    }))
  }, [filteredEvents])

  // Clic sur un créneau de la grille
  const handleSlotClick = (dateIso: string, hourNum: number) => {
    setRdvInitialDate(dateIso)
    setRdvInitialHour(hourNum)
    setPriseRdvOuverte(true)
  }

  // Clic sur un événement
  const handleEventClick = (evt: CalendarEvent) => {
    setSelectedEvent(evt)
    setDetailOuvert(true)
  }

  // Drop pour drag & drop
  const handleDropOnSlot = async (targetDateIso: string, targetHour: number) => {
    if (!draggedEventId) return

    const targetEvt = events.find((e) => e.id === draggedEventId)
    if (!targetEvt) return

    const selectedD = new Date(targetDateIso + "T12:00:00")
    const monthNames = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]
    const newDayName = `${selectedD.getDate()} ${monthNames[selectedD.getMonth()]} ${selectedD.getFullYear()}`

    const endH = targetHour + 1
    const hourFormatted = `${targetHour < 10 ? "0" + targetHour : targetHour} h 00 – ${endH < 10 ? "0" + endH : endH} h 00 (HE)`

    // Mise à jour optimiste
    setEvents((prev) =>
      prev.map((e) =>
        e.id === draggedEventId
          ? { ...e, date: targetDateIso, dayName: newDayName, hour: targetHour, time: hourFormatted }
          : e
      )
    )

    setToastNotice(`✨ Rendez-vous de ${targetEvt.clientName} déplacé au ${newDayName} à ${targetHour} h 00 !`)
    setDraggedEventId(null)
    setDragOverTarget(null)
    setTimeout(() => setToastNotice(null), 5000)

    try {
      await rescheduleCalendarEvent(draggedEventId, targetDateIso, targetHour, hourFormatted, newDayName)
    } catch (e) {
      console.error("Erreur synchronisation déplacement:", e)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. En-tête harmonisé avec PageHeader */}
      <PageHeader
        title="Calendrier & Rendez-vous"
        subtitle="Gérez vos consultations, suivis de dossiers, entrevues et échéances réglementaires."
        actions={
          <Button
            size="sm"
            onClick={() => {
              setRdvInitialDate(toLocalISO(new Date()))
              setRdvInitialHour(10)
              setPriseRdvOuverte(true)
            }}
            className="gap-2 bg-primary text-primary-foreground font-semibold shadow-xs"
          >
            <CalendarPlus className="h-4 w-4" />
            <span>+ Prise de rendez-vous</span>
          </Button>
        }
      />

      {/* 2. Barre d'outils professionnelle */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3 rounded-2xl border border-border bg-card shadow-xs">
        {/* Navigation temporelle */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleToday} className="text-xs h-8 font-semibold">
            Aujourd&apos;hui
          </Button>
          <div className="flex items-center rounded-lg border border-border bg-muted/40">
            <button
              onClick={handlePrevPeriod}
              aria-label="Période précédente"
              className="p-1.5 hover:bg-muted text-foreground transition-colors rounded-l-lg"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={handleNextPeriod}
              aria-label="Période suivante"
              className="p-1.5 hover:bg-muted text-foreground transition-colors rounded-r-lg"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <span className="text-sm font-bold text-foreground px-2 capitalize">
            {periodTitle}
          </span>
        </div>

        {/* Barre de recherche & Filtres */}
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher client, dossier, motif..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-xs rounded-xl border border-border bg-background"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFiltres(!showFiltres)}
            className={`h-8 text-xs gap-1.5 ${showFiltres || filtreType !== "tous" || filtreStatut !== "tous" ? "border-primary text-primary bg-primary/5" : ""}`}
          >
            <Filter className="h-3.5 w-3.5" />
            <span>Filtres</span>
          </Button>
        </div>

        {/* Sélecteur de vues & Options */}
        <div className="flex items-center gap-2">
          {/* Sélecteur de vues */}
          <div className="flex items-center p-0.5 rounded-xl border border-border bg-muted/40 text-xs">
            <button
              onClick={() => setViewMode("day")}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${viewMode === "day" ? "bg-background text-foreground shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"}`}
            >
              Jour
            </button>
            <button
              onClick={() => setViewMode("workweek")}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${viewMode === "workweek" ? "bg-background text-foreground shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"}`}
            >
              Semaine
            </button>
            <button
              onClick={() => setViewMode("month")}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${viewMode === "month" ? "bg-background text-foreground shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"}`}
            >
              Mois
            </button>
            <button
              onClick={() => setViewMode("agenda")}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1 ${viewMode === "agenda" ? "bg-background text-foreground shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"}`}
            >
              <List className="h-3 w-3" />
              <span>Agenda</span>
            </button>
          </div>

          {/* Toggle amplitude horaire (seulement en vue grille) */}
          {(viewMode === "workweek" || viewMode === "week" || viewMode === "day") && (
            <button
              onClick={() => setFullDay(!fullDay)}
              title={fullDay ? "Afficher heures ouvrées (8h-18h)" : "Afficher journée complète (8h-23h)"}
              className={`h-8 px-2 rounded-xl border text-[11px] font-medium transition-colors ${fullDay ? "bg-primary/10 border-primary text-primary-strong" : "bg-card border-border text-muted-foreground hover:text-foreground"}`}
            >
              {fullDay ? "8h–23h" : "8h–18h"}
            </button>
          )}
        </div>
      </div>

      {/* Panneau de filtres dépliable */}
      {showFiltres && (
        <div className="p-4 rounded-2xl border border-border bg-card shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs animate-in slide-in-from-top-2 duration-200">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Type de rencontre</label>
            <select
              value={filtreType}
              onChange={(e) => setFiltreType(e.target.value)}
              className="w-full h-8 px-2 text-xs rounded-lg border border-border bg-background"
            >
              <option value="tous">Tous les types</option>
              <option value="consultation">Consultations officielles</option>
              <option value="followup">Suivis de dossier</option>
              <option value="signing">Signatures de mandat</option>
              <option value="deadline">Échéances</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Statut</label>
            <select
              value={filtreStatut}
              onChange={(e) => setFiltreStatut(e.target.value)}
              className="w-full h-8 px-2 text-xs rounded-lg border border-border bg-background"
            >
              <option value="tous">Tous les statuts</option>
              <option value="confirmed">Confirmés</option>
              <option value="pending">En attente</option>
              <option value="completed">Terminés</option>
              <option value="cancelled">Annulés</option>
            </select>
          </div>

          <div className="flex items-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFiltreType("tous")
                setFiltreStatut("tous")
                setSearchQuery("")
              }}
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
            >
              Réinitialiser les filtres
            </Button>
          </div>
        </div>
      )}

      {/* 3. Notification Toast */}
      {toastNotice && (
        <div className="fixed bottom-6 right-6 z-[200] max-w-md p-4 rounded-2xl border border-primary/30 bg-card text-foreground shadow-2xl text-xs font-semibold flex items-center justify-between gap-3 animate-in slide-in-from-bottom-3">
          <span>{toastNotice}</span>
          <button onClick={() => setToastNotice(null)} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* 4. VUES DU CALENDRIER */}

      {/* VUE 1 : GRILLE HORAIRE (JOUR / SEMAINE) */}
      {(viewMode === "workweek" || viewMode === "week" || viewMode === "day") && (
        <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
          {/* En-tête des colonnes (jours) */}
          <div className="grid grid-cols-[60px_repeat(auto-fit,minmax(0,1fr))] border-b border-border bg-muted/40 divide-x divide-border">
            <div className="p-2.5 text-center text-[11px] font-bold text-muted-foreground uppercase">
              HE
            </div>
            {activeDays.map((day) => (
              <div
                key={day.iso}
                className={`p-2.5 text-center transition-colors ${day.isToday ? "bg-primary/10 text-primary" : "text-foreground"}`}
              >
                <span className="text-[11px] font-bold uppercase tracking-wider block text-muted-foreground">
                  {day.label}
                </span>
                <span className={`inline-flex items-center justify-center h-7 w-7 rounded-full text-xs font-black mt-0.5 ${day.isToday ? "bg-primary text-primary-foreground" : "text-foreground"}`}>
                  {day.dayNum}
                </span>
              </div>
            ))}
          </div>

          {/* Grille des heures */}
          <div className="divide-y divide-border/60 max-h-[70vh] overflow-y-auto">
            {hourRows.map((hr) => (
              <div
                key={hr.hour}
                className="grid grid-cols-[60px_repeat(auto-fit,minmax(0,1fr))] divide-x divide-border/60 min-h-[58px]"
              >
                {/* Libellé heure */}
                <div className="p-2 text-right text-[10px] font-mono text-muted-foreground select-none pr-3">
                  {hr.label}
                </div>

                {/* Cellules par jour */}
                {activeDays.map((day) => {
                  const evtsDuCreneau = filteredEvents.filter(
                    (e) => e.date === day.iso && (e.hour === hr.hour || (!e.hour && hr.hour === 9))
                  )
                  const isDragTarget = dragOverTarget === `${day.iso}-${hr.hour}`

                  return (
                    <div
                      key={day.iso}
                      onDragOver={(e) => {
                        e.preventDefault()
                        setDragOverTarget(`${day.iso}-${hr.hour}`)
                      }}
                      onDragLeave={() => setDragOverTarget(null)}
                      onDrop={(e) => {
                        e.preventDefault()
                        handleDropOnSlot(day.iso, hr.hour)
                      }}
                      onClick={() => handleSlotClick(day.iso, hr.hour)}
                      className={`relative p-1 transition-colors cursor-pointer group ${isDragTarget ? "bg-primary/20 ring-2 ring-primary ring-inset" : "hover:bg-muted/30"}`}
                    >
                      {/* Bouton rapide d'ajout au survol */}
                      {evtsDuCreneau.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium">
                            <Plus className="h-3 w-3" /> Réserver
                          </span>
                        </div>
                      )}

                      {/* Événements dans le créneau */}
                      <div className="space-y-1">
                        {evtsDuCreneau.map((evt) => {
                          const isConfirmed = evt.status === "confirmed" || evt.status === "ready"
                          const isCompleted = evt.status === "completed"
                          const isCancelled = evt.status === "cancelled"

                          return (
                            <div
                              key={evt.id}
                              draggable
                              onDragStart={() => setDraggedEventId(evt.id)}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEventClick(evt)
                              }}
                              className={`p-2 rounded-xl border text-xs shadow-2xs transition-all hover:scale-[1.01] hover:shadow-xs cursor-pointer ${
                                isCancelled
                                  ? "bg-muted/60 border-border text-muted-foreground line-through opacity-60"
                                  : isCompleted
                                  ? "bg-slate-100 dark:bg-slate-800/60 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                                  : isConfirmed
                                  ? "bg-primary/10 border-primary/30 text-primary-strong font-medium"
                                  : "bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <div className="flex items-center gap-1.5 truncate">
                                  <div className={`h-4 w-4 rounded-full ${evt.avatarBg || "bg-primary"} text-white text-[9px] font-bold flex items-center justify-center shrink-0`}>
                                    {evt.clientInitials || "C"}
                                  </div>
                                  <span className="font-bold truncate">{evt.clientName}</span>
                                </div>
                                {evt.platform === "google_meet" || evt.platform === "zoom" || evt.platform === "teams" ? (
                                  <Video className="h-3 w-3 text-primary shrink-0" />
                                ) : evt.platform === "phone" ? (
                                  <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                                ) : null}
                              </div>

                              <p className="text-[11px] truncate mt-0.5 text-muted-foreground">{evt.title}</p>

                              <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1 font-mono">
                                <span>{evt.time?.split("–")[0] || `${evt.hour || 10}h`}</span>
                                {evt.matterId && <span className="text-primary font-semibold">{evt.matterId}</span>}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VUE 2 : MATRICE MENSUELLE */}
      {viewMode === "month" && (
        <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
          {/* En-tête des jours de la semaine */}
          <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-center py-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
            <span>Lun</span>
            <span>Mar</span>
            <span>Mer</span>
            <span>Jeu</span>
            <span>Ven</span>
            <span>Sam</span>
            <span>Dim</span>
          </div>

          {/* Grille du mois */}
          <div className="grid grid-cols-7 divide-x divide-y divide-border/60">
            {monthDays.map((d) => {
              const evtsDuJour = filteredEvents.filter((e) => e.date === d.iso)
              const isToday = d.iso === toLocalISO(new Date())

              return (
                <div
                  key={d.iso}
                  onClick={() => handleSlotClick(d.iso, 10)}
                  className={`min-h-[105px] p-2 transition-colors cursor-pointer group flex flex-col justify-between ${!d.currentMonth ? "bg-muted/15 opacity-40" : "hover:bg-muted/30"}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`h-6 w-6 rounded-full text-xs font-bold flex items-center justify-center ${isToday ? "bg-primary text-primary-foreground font-black" : "text-foreground"}`}>
                      {d.dayNum}
                    </span>
                    {evtsDuJour.length > 0 && (
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {evtsDuJour.length} rdv
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 mt-1 flex-1 overflow-hidden">
                    {evtsDuJour.slice(0, 2).map((evt) => (
                      <div
                        key={evt.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEventClick(evt)
                        }}
                        className="p-1 rounded-lg border border-border bg-card text-[10px] truncate hover:border-primary transition-colors flex items-center gap-1 font-medium"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                        <span className="truncate">{evt.clientName}</span>
                      </div>
                    ))}
                    {evtsDuJour.length > 2 && (
                      <span className="text-[10px] text-muted-foreground font-medium pl-1">
                        +{evtsDuJour.length - 2} autres...
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* VUE 3 : AGENDA / LISTE CHRONOLOGIQUE (MOBILE & DESKTOP) */}
      {viewMode === "agenda" && (
        <div className="space-y-4">
          {groupedEventsByDay.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-card space-y-3">
              <CalendarIcon className="h-10 w-10 text-muted-foreground mx-auto" />
              <h3 className="text-base font-bold text-foreground">Aucun rendez-vous trouvé</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Aucun rendez-vous ne correspond à votre recherche ou à vos filtres sur cette période.
              </p>
              <Button
                size="sm"
                onClick={() => {
                  setRdvInitialDate(toLocalISO(new Date()))
                  setPriseRdvOuverte(true)
                }}
                className="gap-2 bg-primary text-primary-foreground text-xs font-semibold mt-2"
              >
                <CalendarPlus className="h-4 w-4" />
                <span>Planifier un rendez-vous</span>
              </Button>
            </div>
          ) : (
            groupedEventsByDay.map((group) => (
              <div key={group.dateIso} className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
                {/* Bandeau du jour */}
                <div className="px-5 py-3 border-b border-border bg-muted/40 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                      {group.dayOfWeek} · {group.dateIso}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {group.events.length} rendez-vous
                  </Badge>
                </div>

                {/* Liste des rendez-vous du jour */}
                <div className="divide-y divide-border/60">
                  {group.events.map((evt) => (
                    <div
                      key={evt.id}
                      onClick={() => handleEventClick(evt)}
                      className="p-4 hover:bg-muted/30 transition-colors cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`h-10 w-10 rounded-xl ${evt.avatarBg || "bg-primary"} text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5`}>
                          {evt.clientInitials || "RDV"}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-foreground">{evt.clientName}</span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                evt.status === "confirmed" || evt.status === "ready"
                                  ? "text-emerald-700 border-emerald-500/30 bg-emerald-500/10"
                                  : evt.status === "completed"
                                  ? "text-primary border-primary/30 bg-primary/10"
                                  : evt.status === "cancelled"
                                  ? "text-rose-700 border-rose-500/30 bg-rose-500/10"
                                  : "text-amber-700 border-amber-500/30 bg-amber-500/10"
                              }`}
                            >
                              {evt.status === "confirmed" || evt.status === "ready"
                                ? "Confirmé"
                                : evt.status === "completed"
                                ? "Terminé"
                                : evt.status === "cancelled"
                                ? "Annulé"
                                : "En attente"}
                            </Badge>
                            {evt.matterId && (
                              <span className="text-xs font-mono text-muted-foreground">{evt.matterId}</span>
                            )}
                          </div>
                          <p className="text-xs text-foreground font-medium">{evt.title}</p>
                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1 font-mono">
                              <Clock className="h-3 w-3 text-primary" />
                              {evt.time || `${evt.hour || 10} h 00`}
                            </span>
                            <span>·</span>
                            <span className="capitalize">{evt.platform || "En personne"}</span>
                            {evt.program && (
                              <>
                                <span>·</span>
                                <span>{evt.program}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        {evt.link && (
                          <a
                            href={evt.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-2xs"
                          >
                            <Video className="h-3.5 w-3.5" />
                            <span>Visio</span>
                          </a>
                        )}
                        <Button variant="outline" size="sm" className="text-xs h-8">
                          Détails
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 5. Modale de Prise de Rendez-vous */}
      <ModalPriseRendezVous
        ouvert={priseRdvOuverte}
        onFermer={() => setPriseRdvOuverte(false)}
        clients={clients}
        matters={matters}
        leads={leads}
        existingEvents={events}
        initialDate={rdvInitialDate}
        initialHour={rdvInitialHour}
        onRendezVousCree={(nouvelEvt) => {
          setEvents((prev) => [nouvelEvt, ...prev])
          setToastNotice(`✨ Rendez-vous enregistré pour ${nouvelEvt.clientName} !`)
          setTimeout(() => setToastNotice(null), 5000)
        }}
      />

      {/* 6. Modale de Consultation / Action de Rendez-vous */}
      <ModalDetailRendezVous
        ouvert={detailOuvert}
        onFermer={() => {
          setDetailOuvert(false)
          setSelectedEvent(null)
        }}
        event={selectedEvent}
        clients={clients}
        matters={matters}
        leads={leads}
        onEvenementModifie={(evtModifie) => {
          setEvents((prev) => prev.map((e) => (e.id === evtModifie.id ? evtModifie : e)))
          setSelectedEvent(evtModifie)
        }}
        onEvenementSupprime={(idSupprime) => {
          setEvents((prev) => prev.filter((e) => e.id !== idSupprime))
          setDetailOuvert(false)
          setSelectedEvent(null)
          setToastNotice("Rendez-vous annulé et supprimé de l'agenda.")
          setTimeout(() => setToastNotice(null), 5000)
        }}
      />
    </div>
  )
}
