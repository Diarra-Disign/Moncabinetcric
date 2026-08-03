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
  Sparkles, 
  ChevronLeft, 
  ChevronRight, 
  Filter, 
  FileText, 
  ShieldCheck, 
  Send, 
  DollarSign, 
  Globe,
  X,
  Building2,
  Check,
  Search,
  CalendarDays,
  ArrowRight,
  MoveRight,
  RefreshCw,
  SlidersHorizontal,
  CalendarCheck,
  GripVertical,
  LayoutGrid,
  List,
  Layers,
  ArrowUpRight,
  UserCheck,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useTranslations } from "next-intl"
import { CalendarEvent, ClientRecord, Matter, Lead } from "@/lib/data/types"
import { PageHeader } from "@/components/app-shell/page-header"

export type { CalendarEvent }

function getDayOfWeekName(dateIso: string): string {
  const d = new Date(dateIso + "T12:00:00")
  const dayNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]
  return dayNames[d.getDay()]
}

function getFormattedDateWithWeekday(dateIso: string): string {
  const d = new Date(dateIso + "T12:00:00")
  const dayNames = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]
  const monthNames = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]
  return `${dayNames[d.getDay()]} ${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`
}

function getEventPastelStyle(type?: string, index: number = 0) {
  if (type === "deadline") {
    return {
      card: "bg-amber-50/90 text-amber-900 border-amber-200/90 hover:border-amber-400 hover:shadow-md",
      dot: "bg-amber-500",
      badge: "bg-amber-100 text-amber-900 border-amber-300"
    }
  }
  const styles = [
    { card: "bg-sky-50/90 text-sky-900 border-sky-200/90 hover:border-sky-400 hover:shadow-md", dot: "bg-sky-500", badge: "bg-sky-100 text-sky-900 border-sky-300" },
    { card: "bg-purple-50/90 text-purple-900 border-purple-200/90 hover:border-purple-400 hover:shadow-md", dot: "bg-purple-500", badge: "bg-purple-100 text-purple-900 border-purple-300" },
    { card: "bg-emerald-50/90 text-emerald-900 border-emerald-200/90 hover:border-emerald-400 hover:shadow-md", dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-900 border-emerald-300" },
    { card: "bg-orange-50/90 text-orange-900 border-orange-200/90 hover:border-orange-400 hover:shadow-md", dot: "bg-orange-500", badge: "bg-orange-100 text-orange-900 border-orange-300" },
  ]
  return styles[index % styles.length]
}

/**
 * Lignes horaires de la grille.
 *
 * La journée s'arrêtait à 17 h : impossible d'inscrire une rencontre en
 * soirée, ce qui exclut les clients à l'étranger — un rendez-vous à 20 h
 * à Montréal correspond au matin en Afrique de l'Ouest ou en Asie.
 *
 * La grille descend désormais jusqu'à minuit. Comme seize lignes
 * affichées en permanence rendraient la page très haute, deux amplitudes
 * cohabitent : les heures ouvrées par défaut, la journée entière à la
 * demande.
 */
function buildHourRows(from: number, to: number) {
  return Array.from({ length: to - from + 1 }, (_, i) => {
    const hour = from + i
    return { hour, label: `${String(hour).padStart(2, "0")} h 00` }
  })
}

/** Amplitude réduite : ce qu'un cabinet consulte au quotidien. */
const BUSINESS_HOURS = buildHourRows(8, 17)

/** Amplitude complète, jusqu'à la dernière heure avant minuit. */
const FULL_DAY_HOURS = buildHourRows(8, 23)

interface CalendarClientProps {
  initialEvents?: CalendarEvent[]
  /** Clients réels du cabinet, pour la liste du formulaire d'invitation. */
  clients?: ClientRecord[]
  /** Dossiers réels, pour rattacher le rendez-vous au bon mandat. */
  matters?: Matter[]
  /** Prospects : on les rencontre avant de les convertir en clients. */
  leads?: Lead[]
}

/**
 * Date locale au format AAAA-MM-JJ.
 *
 * toISOString() convertit en UTC : à Gatineau, un dimanche à 20 h devient
 * déjà lundi. La colonne « aujourd'hui » se décalait donc en soirée, et la
 * date par défaut d'un rendez-vous sautait au lendemain. Dans une
 * application qui suit des échéances d'immigration, un jour d'écart n'est
 * pas anodin.
 */
function toLocalISO(d: Date): string {
  const mois = String(d.getMonth() + 1).padStart(2, "0")
  const jour = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${mois}-${jour}`
}

function formatMeetingTimeRange(startTime: string, durationMinutes: number): string {
  const [hStr, mStr] = (startTime || "14:00").split(":")
  const startH = parseInt(hStr, 10) || 14
  const startM = parseInt(mStr, 10) || 0

  const totalStartMin = startH * 60 + startM
  const totalEndMin = totalStartMin + durationMinutes

  const endH = Math.floor(totalEndMin / 60) % 24
  const endM = totalEndMin % 60

  const formatH = (h: number) => h < 10 ? `0${h}` : `${h}`
  const formatM = (m: number) => m < 10 ? `0${m}` : `${m}`

  let durationLabel = ""
  if (durationMinutes < 60) {
    durationLabel = `${durationMinutes} min`
  } else {
    const hours = Math.floor(durationMinutes / 60)
    const mins = durationMinutes % 60
    durationLabel = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }

  return `${formatH(startH)} h ${formatM(startM)} – ${formatH(endH)} h ${formatM(endM)} (${durationLabel})`
}

export function CalendarClient({ initialEvents, clients = [], matters = [], leads = [] }: CalendarClientProps = {}) {
  const t = useTranslations("Calendar")
  const [currentDate, setCurrentDate] = React.useState<Date>(() => new Date())
  // viewMode options: "workweek" (Lun-Ven), "week" (Lun-Dim), "month" (31J), "day" (Jour)
  const [viewMode, setViewMode] = React.useState<"workweek" | "week" | "month" | "day">("workweek")
  // displayStyle: "grid" (Grille Horodatée) | "list" (Vue Liste Synthétique)
  const [displayStyle, setDisplayStyle] = React.useState<"grid" | "list">("grid")

  // OUTLOOK STYLE ZOOM CONTROL STATE (50% à 200%, 100% par défaut)
  const [zoomLevel, setZoomLevel] = React.useState<number>(100)
  const slotRowHeightPx = Math.round((zoomLevel / 100) * 76)

  const [activeFilter, setActiveFilter] = React.useState<"all" | "visio" | "deadline">("all")
  const [events, setEvents] = React.useState<CalendarEvent[]>(initialEvents || [])
  const [selectedEvent, setSelectedEvent] = React.useState<CalendarEvent | null>(null)
  const [isSlideOverOpen, setIsSlideOverOpen] = React.useState(false)
  const [isInviteModalOpen, setIsInviteModalOpen] = React.useState(false)

  // DRAG AND DROP STATE
  // Amplitude horaire : réduite par défaut, étendue à la demande.
  const [fullDay, setFullDay] = React.useState(false)
  const HOURLY_ROW_TIMES = fullDay ? FULL_DAY_HOURS : BUSINESS_HOURS

  const [draggedEventId, setDraggedEventId] = React.useState<string | null>(null)
  const [dragOverTarget, setDragOverTarget] = React.useState<string | null>(null)

  // MOVE / RESCHEDULE MODAL STATE
  const [movingEvent, setMovingEvent] = React.useState<CalendarEvent | null>(null)
  const [targetMoveDate, setTargetMoveDate] = React.useState(toLocalISO(new Date()))
  const [targetMoveHour, setTargetMoveHour] = React.useState(14)

  // INVITATION FORM STATE
  const [inviteForm, setInviteForm] = React.useState({
    clientName: "",
    matterId: "",
    reason: "Consultation Initiale d'évaluation",
    date: toLocalISO(new Date()),
    startTime: "14:00",
    durationMinutes: 60,
    time: "14 h 00 – 15 h 00 (60 min)",
    platform: "calendly" as "calendly" | "google_meet" | "zoom",
    calendlyLink: "",
    customNotes: ""
  })

  // REAL-TIME CURRENT TIME TRACKER HOOK
  const [nowTime, setNowTime] = React.useState<Date | null>(() => new Date())

  React.useEffect(() => {
    const interval = setInterval(() => {
      setNowTime(new Date())
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const currentHour = nowTime ? nowTime.getHours() : 14
  const timeLabel = nowTime 
    ? nowTime.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })
    : "14:20"

  const [briefNotes, setBriefNotes] = React.useState("")
  const [toastNotice, setToastNotice] = React.useState<string | null>(null)
  const [searchQuery, setSearchQuery] = React.useState("")

  // REAL DRAG AND DROP HANDLER
  const handleDropOnSlot = (targetDateIso: string, targetHour: number) => {
    if (!draggedEventId) return

    const selectedD = new Date(targetDateIso + "T12:00:00")
    const monthNames = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]
    const newDayName = `${selectedD.getDate()} ${monthNames[selectedD.getMonth()]} ${selectedD.getFullYear()}`

    const endH = targetHour + 1
    const hourFormatted = `${targetHour < 10 ? "0" + targetHour : targetHour} h 00 – ${endH < 10 ? "0" + endH : endH} h 00 (HE)`

    const targetEvt = events.find(e => e.id === draggedEventId)

    setEvents(prev => prev.map(evt => {
      if (evt.id !== draggedEventId) return evt
      return {
        ...evt,
        date: targetDateIso,
        dayName: newDayName,
        hour: targetHour,
        time: hourFormatted
      }
    }))

    setToastNotice(`✨ Consultation de ${targetEvt?.clientName || "Client"} reprogrammée au ${newDayName} à ${targetHour} h 00 !`)
    setDraggedEventId(null)
    setDragOverTarget(null)
    setTimeout(() => setToastNotice(null), 5000)
  }

  // DATE ENGINE HELPERS
  const handlePrevPeriod = () => {
    const next = new Date(currentDate)
    if (viewMode === "day") {
      next.setDate(next.getDate() - 1)
    } else if (viewMode === "workweek" || viewMode === "week") {
      next.setDate(next.getDate() - 7)
    } else if (viewMode === "month") {
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
    } else if (viewMode === "month") {
      next.setMonth(next.getMonth() + 1)
    }
    setCurrentDate(next)
  }

  const handleToday = () => {
    // « Aujourd'hui » doit ramener au jour courant : il ramenait au
    // 31 juillet 2026, date figée à l'écriture du composant.
    setCurrentDate(new Date())
  }

  const handleSlotClick = (dateIso: string, hourNum: number) => {
    const endH = hourNum + 1
    const formattedTime = `${hourNum < 10 ? "0" + hourNum : hourNum} h 00 – ${endH < 10 ? "0" + endH : endH} h 00 (HE)`
    setInviteForm(prev => ({
      ...prev,
      date: dateIso,
      time: formattedTime
    }))
    setIsInviteModalOpen(true)
  }

  const handleOpenMoveModal = (evt: CalendarEvent) => {
    setMovingEvent(evt)
    setTargetMoveDate(evt.date)
    setTargetMoveHour(evt.hour)
  }

  const handleConfirmMove = (e: React.FormEvent) => {
    e.preventDefault()
    if (!movingEvent) return

    const selectedD = new Date(targetMoveDate + "T12:00:00")
    const monthNames = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]
    const newDayName = `${selectedD.getDate()} ${monthNames[selectedD.getMonth()]} ${selectedD.getFullYear()}`
    
    const endH = targetMoveHour + 1
    const hourFormatted = `${targetMoveHour < 10 ? "0" + targetMoveHour : targetMoveHour} h 00 – ${endH < 10 ? "0" + endH : endH} h 00 (HE)`

    setEvents(prev => prev.map(evt => {
      if (evt.id !== movingEvent.id) return evt
      return {
        ...evt,
        date: targetMoveDate,
        dayName: newDayName,
        hour: targetMoveHour,
        time: hourFormatted
      }
    }))

    setToastNotice(`Consultation de ${movingEvent.clientName} déplacée au ${newDayName} à ${targetMoveHour} h 00 !`)
    setMovingEvent(null)
    setTimeout(() => setToastNotice(null), 5000)
  }

  // FORMATTED PERIOD TITLE (CANADIAN OFFICIAL STYLE)
  const periodTitle = React.useMemo(() => {
    const year = currentDate.getFullYear()
    const monthNames = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]
    const dayNames = ["Vendredi", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]

    if (viewMode === "day") {
      const dayName = dayNames[currentDate.getDay()]
      const dayNum = currentDate.getDate()
      const monthName = monthNames[currentDate.getMonth()]
      return `Planning du ${dayName.toLowerCase()} ${dayNum} ${monthName} ${year}`
    }

    if (viewMode === "workweek") {
      const dayOfWeek = currentDate.getDay()
      const diffToMon = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek)
      const startOfWeek = new Date(currentDate)
      startOfWeek.setDate(currentDate.getDate() + diffToMon)

      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 4)

      const startDay = startOfWeek.getDate()
      const startMonth = monthNames[startOfWeek.getMonth()]
      const endDay = endOfWeek.getDate()
      const endMonth = monthNames[endOfWeek.getMonth()]

      return `Jours ouvrés (Lun ${startDay} ${startMonth} à Ven ${endDay} ${endMonth} ${year})`
    }

    if (viewMode === "week") {
      const dayOfWeek = currentDate.getDay()
      const diffToMon = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek)
      const startOfWeek = new Date(currentDate)
      startOfWeek.setDate(currentDate.getDate() + diffToMon)

      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6)

      const startDay = startOfWeek.getDate()
      const startMonth = monthNames[startOfWeek.getMonth()]
      const endDay = endOfWeek.getDate()
      const endMonth = monthNames[endOfWeek.getMonth()]

      return `Semaine complète (Lun ${startDay} ${startMonth} au Dim ${endDay} ${endMonth} ${year})`
    }

    const monthName = monthNames[currentDate.getMonth()]
    return `Mois complet de ${monthName} ${year}`
  }, [currentDate, viewMode])

  const currentDateISO = React.useMemo(() => {
    return toLocalISO(currentDate)
  }, [currentDate])

  const activeDaysList = React.useMemo(() => {
    const dayOfWeek = currentDate.getDay()
    const diffToMon = (dayOfWeek === 0 ? -6 : 1 - dayOfWeek)
    const startOfWeek = new Date(currentDate)
    startOfWeek.setDate(currentDate.getDate() + diffToMon)

    const count = viewMode === "workweek" ? 5 : 7
    const dayLabels = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]
    const result = []

    for (let i = 0; i < count; i++) {
      const d = new Date(startOfWeek)
      d.setDate(startOfWeek.getDate() + i)
      const iso = toLocalISO(d)
      const isToday = iso === toLocalISO(new Date())
      const isSelected = iso === toLocalISO(currentDate)
      result.push({
        label: dayLabels[i],
        dayNum: d.getDate(),
        monthNum: d.getMonth() + 1,
        iso,
        isToday,
        isSelected
      })
    }
    return result
  }, [currentDate, viewMode])

  const filteredEvents = React.useMemo(() => {
    return events.filter(evt => {
      const matchType = activeFilter === "all" || evt.type === activeFilter
      const matchSearch = evt.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          evt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          evt.matterId.toLowerCase().includes(searchQuery.toLowerCase())
      return matchType && matchSearch
    })
  }, [events, activeFilter, searchQuery])

  const groupedEventsByDay = React.useMemo(() => {
    const groups: { dateIso: string; dayOfWeek: string; fullDateTitle: string; events: CalendarEvent[] }[] = []
    filteredEvents.forEach(evt => {
      let existing = groups.find(g => g.dateIso === evt.date)
      if (!existing) {
        const d = new Date(evt.date + "T12:00:00")
        const monthNames = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]
        const dayOfWeek = getDayOfWeekName(evt.date)
        const fullDateTitle = `${dayOfWeek} ${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`
        existing = { dateIso: evt.date, dayOfWeek, fullDateTitle, events: [] }
        groups.push(existing)
      }
      existing.events.push(evt)
    })
    return groups
  }, [filteredEvents])

  const handleOpenBrief = (evt: CalendarEvent) => {
    setSelectedEvent(evt)
    setBriefNotes(evt.notes || "")
    setIsSlideOverOpen(true)
  }

  const handleCreateInviteSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const parts = inviteForm.clientName.trim().split(" ")
    const initials = parts.length >= 2 ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase() : "CL"

    const selectedD = new Date(inviteForm.date + "T12:00:00")
    const monthNames = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]
    const formattedDayName = `${selectedD.getDate()} ${monthNames[selectedD.getMonth()]} ${selectedD.getFullYear()}`

    const calculatedTimeRange = formatMeetingTimeRange(inviteForm.startTime, inviteForm.durationMinutes)
    const calculatedHour = parseInt((inviteForm.startTime || "14:00").split(":")[0], 10) || 14

    const newEvent: CalendarEvent = {
      id: `evt-${Date.now()}`,
      title: `${inviteForm.reason}`,
      clientName: inviteForm.clientName,
      clientInitials: initials,
      avatarBg: "bg-blue-600",
      matterId: inviteForm.matterId,
      program: "Dossier Immigration CICC",
      type: "visio",
      platform: inviteForm.platform,
      link: inviteForm.calendlyLink,
      date: inviteForm.date,
      dayName: formattedDayName,
      time: calculatedTimeRange,
      hour: calculatedHour,
      status: "ready",
      trustBalance: "$2,500 CAD",
      notes: inviteForm.customNotes
    }

    setEvents([newEvent, ...events])
    
    if (inviteForm.date) {
      setCurrentDate(new Date(inviteForm.date + "T12:00:00"))
    }

    setIsInviteModalOpen(false)
    setToastNotice(`Invitation Calendly (${inviteForm.reason}) envoyée à ${inviteForm.clientName} et publiée sur son Portail !`)
    setTimeout(() => setToastNotice(null), 5000)
  }

  const handleSendBriefToPortal = () => {
    if (!selectedEvent) return
    setToastNotice(`Plan de rencontre transmis sur le Portail Client de ${selectedEvent.clientName} !`)
    setTimeout(() => setToastNotice(null), 4500)
  }

  return (
    <div className="flex flex-col gap-8 pb-20 selection:bg-blue-600 selection:text-white">
      
      {/* TOAST NOTIFICATION GLOBAL */}
      {toastNotice && (
        <div className="fixed top-20 right-6 z-[300] bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-700 font-bold text-xs sm:text-sm flex items-center gap-3 animate-slideInRight">
          <div className="h-9 w-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-black shrink-0">
            ✓
          </div>
          <span>{toastNotice}</span>
        </div>
      )}

      <PageHeader
        title={t("title") || "Agenda & Rencontres CICC"}
        subtitle={t("subtitle") || "Planifiez vos rendez-vous clients, visioconférences et échéances IRCC avec synchronisation externe."}
        action={
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsInviteModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t("newAppointment") || "+ Nouveau RDV / Consultation"}</span>
            </button>
          </div>
        }
      />

      {/* UNTITLED UI STYLE CALENDAR MAIN CARD */}
      <div className="bg-card rounded-3xl border border-border/80 shadow-xs p-6 sm:p-8 space-y-6">
        
        {/* HEADER CONTROLS BAR (UNTITLED UI V6.0 LAYOUT) */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-border/60">
          
          {/* LEFT: DATE BADGE & PERIOD TITLE */}
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-center justify-center bg-card border border-border px-3.5 py-2 rounded-2xl shadow-2xs min-w-[64px]">
              <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">
                {currentDate.toLocaleDateString("fr-CA", { month: "short" }).toUpperCase()}
              </span>
              <span className="text-2xl font-black text-foreground leading-none mt-0.5">
                {currentDate.getDate()}
              </span>
            </div>

            <div>
              <h2 className="text-xl font-black text-foreground tracking-tight">
                {periodTitle}
              </h2>
              <p className="text-xs font-medium text-muted-foreground mt-0.5">
                Glissez-déposez les cartes de rendez-vous pour ajuster votre planning
              </p>
            </div>
          </div>

          {/* RIGHT: NAVIGATION & VIEW MODE BAR */}
          <div className="flex flex-wrap items-center gap-3 self-start lg:self-center">
            
            {/* Search Box */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-7 py-1.5 text-xs font-semibold rounded-xl bg-muted border border-transparent focus:bg-card focus:border-border focus:outline-none transition-all w-36 sm:w-44"
              />
              <span className="absolute right-2 top-2 text-[10px] font-mono text-muted-foreground border border-border/60 px-1 rounded">⌘K</span>
            </div>

            {/* Filter Tabs */}
            <div className="inline-flex items-center bg-muted p-1 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => setActiveFilter("all")}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeFilter === "all" ? "bg-card text-foreground shadow-2xs font-black" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Tous
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter("visio")}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeFilter === "visio" ? "bg-card text-foreground shadow-2xs font-black" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Visios
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter("deadline")}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeFilter === "deadline" ? "bg-card text-foreground shadow-2xs font-black" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Échéances
              </button>
            </div>

            {/* Navigation < Aujourd'hui > */}
            <div className="inline-flex items-center rounded-xl border border-border bg-card shadow-2xs p-0.5">
              <button
                type="button"
                onClick={handlePrevPeriod}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                title="Période précédente"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleToday}
                className="px-2.5 py-1 text-xs font-bold text-foreground hover:bg-muted transition-colors rounded-lg cursor-pointer"
              >
                Aujourd&apos;hui
              </button>
              <button
                type="button"
                onClick={handleNextPeriod}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                title="Période suivante"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* View Mode Bar (Jours ouvrés | Semaine | Mois | Jour) */}
            <div className="inline-flex items-center bg-muted p-1 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => setViewMode("workweek")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  viewMode === "workweek" ? "bg-card text-foreground shadow-2xs font-black" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Jours ouvrés
              </button>
              <button
                type="button"
                onClick={() => setViewMode("week")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  viewMode === "week" ? "bg-card text-foreground shadow-2xs font-black" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Semaine
              </button>
              <button
                type="button"
                onClick={() => setViewMode("month")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  viewMode === "month" ? "bg-card text-foreground shadow-2xs font-black" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Mois
              </button>
              <button
                type="button"
                onClick={() => setViewMode("day")}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  viewMode === "day" ? "bg-card text-foreground shadow-2xs font-black" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Jour
              </button>
            </div>

            {/* BARRE DE ZOOM OUTLOOK EN-TÊTE (- / + Slider) */}
            <div className="inline-flex items-center bg-muted p-1 rounded-xl gap-2 border border-border/60">
              <button
                type="button"
                onClick={() => setZoomLevel(prev => Math.max(50, prev - 15))}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-card transition-colors cursor-pointer"
                title="Rétrécir / Densité compacte (-)"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>

              <input
                type="range"
                min="50"
                max="200"
                step="10"
                value={zoomLevel}
                onChange={(e) => setZoomLevel(Number(e.target.value))}
                className="w-16 h-1.5 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
                title={`Niveau de Zoom: ${zoomLevel}%`}
              />

              <button
                type="button"
                onClick={() => setZoomLevel(prev => Math.min(200, prev + 15))}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-card transition-colors cursor-pointer"
                title="Agrandir / Vue détaillée (+)"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>

              <span className="font-mono text-[10px] font-black text-foreground bg-card border border-border/60 px-1.5 py-0.5 rounded-md min-w-[34px] text-center">
                {zoomLevel}%
              </span>
            </div>

            {/* Primary Action Button */}
            {/* Amplitude horaire : la grille couvre la journée entière,
                mais seize lignes en permanence rendraient la page très
                haute. On bascule donc à la demande. */}
            <div className="inline-flex items-center gap-1 rounded-xl bg-muted p-1" role="group" aria-label="Amplitude horaire">
              <button
                type="button"
                onClick={() => setFullDay(false)}
                aria-pressed={!fullDay}
                className={`min-h-8 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  !fullDay ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                8 h – 18 h
              </button>
              <button
                type="button"
                onClick={() => setFullDay(true)}
                aria-pressed={fullDay}
                className={`min-h-8 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  fullDay ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                8 h – 00 h
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsInviteModalOpen(true)}
              className="inline-flex items-center gap-1.5 bg-foreground text-background hover:bg-foreground/90 px-3.5 py-1.5 text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Nouveau RDV</span>
            </button>
          </div>

        </div>

        {/* DAYS HEADER & HOURLY GRID */}
        {(viewMode === "workweek" || viewMode === "week") && (
          <div className="space-y-3 animate-fadeIn overflow-x-auto">
            
            {/* DAYS COLUMN HEADERS */}
            {/* Collant : avec seize lignes horaires, on perdait de vue le
                jour auquel appartenait la case survolée. */}
            <div className={`sticky top-0 z-30 grid gap-2 border-b border-border/80 bg-card/95 pb-3 pt-1 text-center backdrop-blur ${viewMode === "workweek" ? "grid-cols-[70px_repeat(5,1fr)]" : "grid-cols-[70px_repeat(7,1fr)]"}`}>
              <div className="flex items-center justify-center font-mono text-[11px] font-bold text-muted-foreground bg-muted/60 rounded-xl p-2">
                HE (EST)
              </div>

              {activeDaysList.map((d) => (
                <button
                  key={d.iso}
                  onClick={() => setCurrentDate(new Date(d.iso + "T12:00:00"))}
                  className={`p-2 rounded-2xl transition-all cursor-pointer flex flex-col items-center gap-1 ${
                    d.isSelected
                      ? "bg-primary/10 border border-primary/30 text-primary font-black"
                      : "hover:bg-muted text-foreground"
                  }`}
                >
                  <span className="text-[11px] font-bold text-muted-foreground uppercase">{d.label}</span>
                  <span
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${
                      d.isToday
                        ? "bg-foreground text-background shadow-xs"
                        : "text-foreground"
                    }`}
                  >
                    {d.dayNum}
                  </span>
                </button>
              ))}
            </div>

            {/* HOURLY GRID ROWS WITH DRAG & DROP & CURRENT TIME INDICATOR */}
            <div className="space-y-2 min-w-[760px] relative">
              {HOURLY_ROW_TIMES.map((hRow) => (
                <React.Fragment key={hRow.hour}>
                  {/* Render real-time current time indicator line */}
                  {hRow.hour === currentHour && (
                    <div className="relative my-1.5 z-20 transition-all duration-500">
                      <div className="absolute inset-0 flex items-center" aria-hidden="true">
                        <div className="w-full border-t-2 border-dashed border-red-500/90 shadow-xs" />
                      </div>
                      <div className="relative flex justify-start pl-16">
                        <span className="bg-red-600 text-white font-mono font-bold text-[10px] px-2.5 py-0.5 rounded-full flex items-center gap-1.5 shadow-md shadow-red-600/30">
                          <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                          <span>{timeLabel}</span>
                        </span>
                      </div>
                    </div>
                  )}

                  <div 
                    style={{ minHeight: `${slotRowHeightPx}px` }}
                    className={`grid gap-2 items-stretch border-b border-border/40 pb-2 transition-all duration-200 ${
                      viewMode === "workweek" ? "grid-cols-[70px_repeat(5,1fr)]" : "grid-cols-[70px_repeat(7,1fr)]"
                    }`}
                  >
                    {/* TIME LABEL */}
                    <div
                      className={`flex shrink-0 items-center justify-center rounded-xl border py-2 font-mono text-xs font-bold ${
                        hRow.hour === currentHour
                          ? "border-error/40 bg-error/10 text-error"
                          : hRow.hour >= 18
                            ? "border-border/40 bg-muted/20 text-muted-foreground/70"
                            : "border-border/40 bg-muted/40 text-muted-foreground"
                      }`}
                    >
                      <span>{hRow.label}</span>
                    </div>

                    {/* DAY SLOTS */}
                    {activeDaysList.map((d, colIdx) => {
                      const matchingEvts = filteredEvents.filter(e => e.date === d.iso && e.hour === hRow.hour)
                      const targetKey = `${d.iso}-${hRow.hour}`
                      const isHovered = dragOverTarget === targetKey

                      return (
                        <div 
                          key={d.iso} 
                          onDragOver={(e) => {
                            e.preventDefault()
                            e.dataTransfer.dropEffect = "move"
                            setDragOverTarget(targetKey)
                          }}
                          onDragLeave={() => {
                            if (dragOverTarget === targetKey) setDragOverTarget(null)
                          }}
                          onDrop={(e) => {
                            e.preventDefault()
                            handleDropOnSlot(d.iso, hRow.hour)
                          }}
                          className={`rounded-2xl border transition-all p-2 flex flex-col justify-center relative group min-h-[68px] ${
                            isHovered 
                              ? "bg-primary/10 border-primary border-2 scale-[1.01] shadow-md"
                              : matchingEvts.length > 0 
                              ? "bg-card border-border/60" 
                              : "bg-card border-dashed border-border/50 hover:border-primary/40 hover:bg-muted/30"
                          }`}
                        >
                          {matchingEvts.length === 0 ? (
                            <button
                              type="button"
                              onClick={() => handleSlotClick(d.iso, hRow.hour)}
                              className="h-full w-full opacity-40 group-hover:opacity-100 flex items-center justify-center transition-all cursor-pointer py-1.5"
                              title={`Créer un RDV à ${hRow.label}`}
                            >
                              <span className="text-[10px] font-bold text-muted-foreground bg-muted group-hover:bg-primary group-hover:text-primary-foreground px-2 py-0.5 rounded-lg transition-all flex items-center gap-1">
                                <Plus className="w-3 h-3" />
                                <span>+ RDV</span>
                              </span>
                            </button>
                          ) : (
                            matchingEvts.map((evt, evtIdx) => {
                              const style = getEventPastelStyle(evt.type, colIdx + evtIdx)
                              return (
                                <div
                                  key={evt.id}
                                  draggable={true}
                                  onDragStart={(e) => {
                                    e.dataTransfer.setData("text/plain", evt.id)
                                    setDraggedEventId(evt.id)
                                  }}
                                  onDragEnd={() => {
                                    setDraggedEventId(null)
                                    setDragOverTarget(null)
                                  }}
                                  onClick={() => setSelectedEvent(evt)}
                                  className={`p-2.5 rounded-xl border text-left cursor-grab active:cursor-grabbing transition-all duration-200 shadow-2xs space-y-1.5 ${style.card}`}
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="text-[10px] font-mono font-bold opacity-80 flex items-center gap-1">
                                      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                                      {evt.time.split("–")[0]}
                                    </span>
                                    <span className="text-[10px] font-bold opacity-70">{evt.clientInitials}</span>
                                  </div>

                                  <div>
                                    <p className="text-xs font-black leading-tight line-clamp-1">{evt.title}</p>
                                    <p className="text-[11px] font-medium opacity-80 truncate mt-0.5">{evt.clientName}</p>
                                  </div>

                                  <div className="pt-1 flex items-center justify-between gap-1 text-[10px]">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleOpenMoveModal(evt)
                                      }}
                                      className="inline-flex items-center gap-0.5 font-bold hover:underline opacity-80 hover:opacity-100 cursor-pointer"
                                    >
                                      <MoveRight className="w-3 h-3" />
                                      <span>Déplacer</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleOpenBrief(evt)
                                      }}
                                      className="font-bold opacity-80 hover:opacity-100 cursor-pointer"
                                      title="Synthèse CICC"
                                    >
                                      <Sparkles className="w-3 h-3 text-amber-500" />
                                    </button>
                                  </div>
                                </div>
                              )
                            })
                          )}
                        </div>
                      )
                    })}
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

          {/* VUE MOIS COMPLET (GRILLE 31 JOURS) */}
          {viewMode === "month" && (
            <div className="space-y-4 animate-fadeIn">
              <div className="grid grid-cols-7 gap-2 text-center text-xs font-black uppercase text-slate-400 border-b border-slate-100 pb-2">
                <span>Lun</span>
                <span>Mar</span>
                <span>Mer</span>
                <span>Jeu</span>
                <span>Ven</span>
                <span>Sam</span>
                <span>Dim</span>
              </div>

              <div className="grid grid-cols-7 gap-2">
                {/* Le mois était figé à juillet 2026 et « aujourd'hui » au 31 :
                    la vue mensuelle affichait toujours le même mois, quel que
                    soit le mois consulté. */}
                {Array.from(
                  { length: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate() },
                  (_, i) => i + 1
                ).map((dayNum) => {
                  const iso = toLocalISO(new Date(currentDate.getFullYear(), currentDate.getMonth(), dayNum))
                  const dayEvts = filteredEvents.filter(e => e.date === iso)
                  const isSelected = currentDateISO === iso
                  const isToday = iso === toLocalISO(new Date())

                  return (
                    <button
                      key={dayNum}
                      onClick={() => {
                        setCurrentDate(new Date(iso + "T12:00:00"))
                        setViewMode("day")
                      }}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer text-left min-h-[95px] flex flex-col justify-between ${
                        isSelected
                          ? "bg-blue-600 text-white border-blue-600 shadow-md"
                          : isToday
                          ? "bg-blue-50 border-blue-300 text-blue-900 font-black"
                          : "bg-slate-50/70 border-slate-200/80 hover:bg-slate-100 text-slate-900"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-sm font-black">{dayNum}</span>
                        {dayEvts.length > 0 && (
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${isSelected ? "bg-white text-blue-600" : "bg-blue-600 text-white"}`}>
                            {dayEvts.length} RDV
                          </span>
                        )}
                      </div>

                      <div className="space-y-1 w-full">
                        {dayEvts.slice(0, 2).map((evt) => (
                          <div 
                            key={evt.id} 
                            className={`text-[10px] font-bold truncate rounded px-1.5 py-0.5 ${
                              isSelected ? "bg-blue-700 text-white" : "bg-white border border-slate-200 text-slate-800"
                            }`}
                          >
                            • {evt.clientName}
                          </div>
                        ))}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* VUE JOUR */}
          {viewMode === "day" && (
            <div className="space-y-4 animate-fadeIn">
              {filteredEvents.length === 0 ? (
                <div className="p-12 text-center text-slate-400 space-y-3">
                  <CalendarDays className="w-12 h-12 mx-auto text-slate-300" />
                  <p className="text-base font-bold text-slate-600">Aucun rendez-vous prévu pour cette journée.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredEvents.map((evt) => (
                    <div
                      key={evt.id}
                      className="p-6 rounded-2xl border border-slate-200/80 bg-white hover:border-blue-400 hover:shadow-md transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-6 group"
                    >
                      <div className="flex items-start gap-4 sm:gap-5">
                        <div className={`w-14 h-14 rounded-2xl ${evt.avatarBg} text-white flex items-center justify-center text-base font-black shadow-md shrink-0 mt-0.5`}>
                          {evt.clientInitials}
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="bg-slate-900 text-white font-mono text-xs font-bold px-2.5 py-1 rounded-xl uppercase flex items-center gap-1">
                              <CalendarIcon className="w-3.5 h-3.5 text-slate-300" />
                              <span>{getDayOfWeekName(evt.date)}</span>
                            </span>
                            <span className="font-mono text-xs sm:text-sm font-bold text-slate-900 bg-slate-100 px-3 py-1 rounded-xl border border-slate-200 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-slate-500" />
                              <span>{getFormattedDateWithWeekday(evt.date)} · {evt.time}</span>
                            </span>
                            <span className="font-mono text-xs sm:text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-xl border border-blue-200">
                              {evt.matterId}
                            </span>
                            {evt.platform === "calendly" && (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 px-3 py-1 rounded-full font-mono">
                                <Globe className="w-3.5 h-3.5 text-purple-600" /> Calendly Direct
                              </span>
                            )}
                            {evt.status === "ready" ? (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                                <Check className="w-3.5 h-3.5" /> Dossier 100% Prêt
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
                                <AlertCircle className="w-3.5 h-3.5" /> Pièce en attente
                              </span>
                            )}
                          </div>

                          <h3 className="text-lg sm:text-xl font-black text-slate-900 group-hover:text-blue-600 transition-colors">
                            {evt.title}
                          </h3>

                          <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-600 font-medium">
                            <span>Client : <strong className="text-slate-900 font-bold">{evt.clientName}</strong></span>
                            <span>·</span>
                            <span>{evt.program}</span>
                            {evt.trustBalance && (
                              <>
                                <span>·</span>
                                <span className="text-emerald-600 font-bold font-mono">Fidéicommis : {evt.trustBalance}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0 border-t md:border-t-0 pt-4 md:pt-0 border-slate-100">
                        <button
                          type="button"
                          onClick={() => handleOpenMoveModal(evt)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-3 text-xs sm:text-sm font-bold transition-all cursor-pointer"
                        >
                          <MoveRight className="w-4 h-4 text-blue-600" />
                          <span>Changer créneau</span>
                        </button>

                        {evt.link && (
                          <a
                            href={evt.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 text-xs sm:text-sm font-bold shadow-sm transition-all"
                          >
                            <Video className="w-4 h-4" />
                            <span>Visio</span>
                            <ExternalLink className="w-3.5 h-3.5 opacity-75" />
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={() => handleOpenBrief(evt)}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-800 border border-slate-200 px-5 py-3 text-xs sm:text-sm font-bold transition-all cursor-pointer"
                        >
                          <Sparkles className="w-4 h-4 text-amber-500" />
                          <span>Brief AI</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
      </div>

      {/* MODE 2: VUE LISTE SYNTHÉTIQUE DES RENCONTRES */}
      {displayStyle === "list" && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.02)] p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-xl font-black text-slate-900">Vue Liste Synthétique des Mandats & Consultations</h2>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">Présentation chronologique synthétique par dossier d&apos;immigration.</p>
            </div>
            <span className="bg-blue-50 text-blue-700 border border-blue-200 text-xs sm:text-sm font-mono font-bold px-3.5 py-1.5 rounded-full">
              {filteredEvents.length} Dossier(s) actif(s)
            </span>
          </div>

          <div className="space-y-8">
            {groupedEventsByDay.map((group) => (
              <div key={group.dateIso} className="space-y-3.5">
                
                {/* BANDEAU DE JOUR SOBRE & ÉLÉGANT */}
                <div className="flex items-center justify-between bg-slate-100/90 text-slate-900 px-5 py-3 rounded-2xl border border-slate-200/80">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold shrink-0">
                      <CalendarIcon className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-black text-slate-900 uppercase flex items-center gap-2">
                        <span>{group.dayOfWeek}</span>
                        <span className="text-slate-500 font-semibold capitalize">({group.fullDateTitle})</span>
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">
                        {group.events.length} rendez-vous programmé(s)
                      </p>
                    </div>
                  </div>

                  <span className="text-xs font-mono font-bold bg-white text-slate-700 border border-slate-200 px-3 py-1 rounded-xl uppercase">
                    {group.dayOfWeek}
                  </span>
                </div>

                {/* RDV DU JOUR */}
                <div className="space-y-3">
                  {group.events.map((evt) => (
                    <div
                      key={evt.id}
                      className="p-6 rounded-2xl border border-slate-200/80 bg-white hover:border-slate-400 hover:shadow-sm transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-6 group"
                    >
                      <div className="flex items-start gap-4 sm:gap-5">
                        <div className={`w-14 h-14 rounded-2xl ${evt.avatarBg} text-white flex items-center justify-center text-base font-black shadow-sm shrink-0 mt-0.5`}>
                          {evt.clientInitials}
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="bg-slate-900 text-white font-mono text-xs font-bold px-2.5 py-1 rounded-xl uppercase flex items-center gap-1">
                              <CalendarIcon className="w-3.5 h-3.5 text-slate-300" />
                              <span>{getDayOfWeekName(evt.date)}</span>
                            </span>
                            <span className="font-mono text-xs sm:text-sm font-bold text-slate-900 bg-slate-100 px-3 py-1 rounded-xl border border-slate-200 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-slate-500" />
                              <span>{evt.time}</span>
                            </span>
                            <span className="font-mono text-xs sm:text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-xl border border-blue-200">
                              {evt.matterId}
                            </span>
                            {evt.platform === "calendly" && (
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 px-3 py-1 rounded-full font-mono">
                                <Globe className="w-3.5 h-3.5 text-purple-600" /> Calendly Direct
                              </span>
                            )}
                          </div>

                          <h3 className="text-lg sm:text-xl font-black text-slate-900 group-hover:text-blue-600 transition-colors">
                            {evt.title}
                          </h3>

                          <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-600 font-medium">
                            <span>Client : <strong className="text-slate-900 font-bold">{evt.clientName}</strong></span>
                            <span>·</span>
                            <span>{evt.program}</span>
                            {evt.trustBalance && (
                              <>
                                <span>·</span>
                                <span className="text-emerald-600 font-bold font-mono">Fidéicommis : {evt.trustBalance}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0 border-t md:border-t-0 pt-4 md:pt-0 border-slate-100">
                        {evt.link && (
                          <a
                            href={evt.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 text-xs sm:text-sm font-bold shadow-sm transition-all"
                          >
                            <Video className="w-4 h-4" />
                            <span>Lancer la Visio</span>
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={() => handleOpenBrief(evt)}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-800 border border-slate-200 px-5 py-3 text-xs sm:text-sm font-bold transition-all cursor-pointer"
                        >
                          <Sparkles className="w-4 h-4 text-amber-500" />
                          <span>Brief AI</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL DE DÉPLACEMENT SPÉCIFIQUE (NOUVELLE DATE & HEURE PRÉCISE) */}
      {movingEvent && (
        <div className="fixed inset-0 z-[260] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-scaleUp">
            
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold">
                  <CalendarCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Déplacer la rencontre</h3>
                  <p className="text-xs text-slate-500 font-medium">{movingEvent.clientName}</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setMovingEvent(null)}
                className="p-2 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmMove} className="p-6 space-y-4">
              <div className="bg-blue-50 p-3.5 rounded-2xl border border-blue-200 text-xs font-bold text-blue-900">
                📌 Motif : {movingEvent.title}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Nouvelle Date</label>
                <input
                  type="date"
                  required
                  value={targetMoveDate}
                  onChange={(e) => setTargetMoveDate(e.target.value)}
                  className="w-full h-12 px-4 text-xs sm:text-sm font-bold rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Nouvelle Heure d&apos;entrevue</label>
                <select
                  value={targetMoveHour}
                  onChange={(e) => setTargetMoveHour(Number(e.target.value))}
                  className="w-full h-12 px-4 text-xs sm:text-sm font-bold rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none"
                >
                  {HOURLY_ROW_TIMES.map((h) => (
                    <option key={h.hour} value={h.hour}>
                      {h.label} (Heure de l&apos;Est / Montréal)
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setMovingEvent(null)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 text-xs sm:text-sm font-bold shadow-md cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Confirmer le déplacement</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* MODAL D'INVITATION RENCONTRE & CALENDLY */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-[250] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-xs animate-fadeIn sm:items-center">
          {/* La fiche dépassait de l'écran en haut comme en bas : elle est
              désormais bornée en hauteur, et c'est son corps qui défile —
              l'en-tête et les boutons restent atteignables. */}
          <div className="my-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl animate-scaleUp">

            <div className="shrink-0 p-6 sm:p-7 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="h-11 w-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold">
                  <CalendarDays className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">Inviter un Client (Calendly & Visio)</h3>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium">Planifiez une consultation et synchronisez le créneau sur le Portail Client.</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsInviteModalOpen(false)}
                className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-900 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateInviteSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6 sm:p-7">
              <div className="flex flex-col gap-2">
                <label className="text-xs sm:text-sm font-extrabold text-slate-700 uppercase tracking-wider">Candidat / Client Destinataire</label>
                <select
                  value={inviteForm.clientName}
                  onChange={e => {
                    // Le dossier suit le client : sans ce rattachement, le
                    // rendez-vous n'appartiendrait à aucun mandat.
                    // Un prospect n'a pas encore de dossier : le champ reste
                    // vide, sans quoi le rendez-vous serait rattaché à tort.
                    const choisi = clients.find(c => c.name === e.target.value)
                    const dossier = choisi ? matters.find(m => m.clientId === choisi.id) : undefined
                    setInviteForm({
                      ...inviteForm,
                      clientName: e.target.value,
                      matterId: dossier?.id ?? "",
                    })
                  }}
                  className="w-full h-12 px-4 text-xs sm:text-sm font-bold rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
                >
                  <option value="">
                    {clients.length === 0 && leads.length === 0
                      ? "Aucun client ni prospect — créez-en un d'abord"
                      : "Choisir un destinataire…"}
                  </option>

                  {clients.length > 0 && (
                    <optgroup label="Clients">
                      {clients.map(c => {
                        const dossier = matters.find(m => m.clientId === c.id)
                        return (
                          <option key={c.id} value={c.name}>
                            {c.name}
                            {dossier ? ` — ${dossier.program}` : c.program ? ` — ${c.program}` : ""}
                          </option>
                        )
                      })}
                    </optgroup>
                  )}

                  {/* Les prospects déjà convertis ne sont pas répétés ici :
                      ils figurent au groupe « Clients ». */}
                  {leads.filter(l => !clients.some(c => c.email === l.email)).length > 0 && (
                    <optgroup label="Prospects">
                      {leads
                        .filter(l => !clients.some(c => c.email === l.email))
                        .map(l => (
                          <option key={l.id} value={l.name}>
                            {l.company || l.name}
                            {l.visaType ? ` — ${l.visaType}` : ""}
                          </option>
                        ))}
                    </optgroup>
                  )}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs sm:text-sm font-extrabold text-slate-700 uppercase tracking-wider">Raison de la rencontre (Motif d&apos;entrevue)</label>
                <select
                  value={inviteForm.reason}
                  onChange={e => setInviteForm({ ...inviteForm, reason: e.target.value })}
                  className="w-full h-12 px-4 text-xs sm:text-sm font-bold rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
                >
                  <option value="Consultation Initiale d'évaluation">Consultation Initiale d&apos;évaluation</option>
                  <option value="Revue des antécédents 10 ans (IMM 5669)">Revue des antécédents 10 ans (IMM 5669)</option>
                  <option value="Signature du Mandat CICC & Entente (IMM 5476)">Signature du Mandat CICC & Entente (IMM 5476)</option>
                  <option value="Vérification des pièces justificatives IRCC">Vérification des pièces justificatives IRCC</option>
                  <option value="Suivi de demande EIMT / Permis de Travail">Suivi de demande EIMT / Permis de Travail</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xs sm:text-sm font-extrabold text-slate-700 uppercase tracking-wider">Date de la rencontre</label>
                  <input
                    type="date"
                    required
                    value={inviteForm.date}
                    onChange={e => setInviteForm({ ...inviteForm, date: e.target.value })}
                    className="w-full h-12 px-4 text-xs sm:text-sm font-bold rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs sm:text-sm font-extrabold text-slate-700 uppercase tracking-wider">Heure de Début (HE / Montréal)</label>
                  <select
                    value={inviteForm.startTime}
                    onChange={e => setInviteForm({ ...inviteForm, startTime: e.target.value })}
                    className="w-full h-12 px-4 text-xs sm:text-sm font-bold rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none transition-all font-mono"
                  >
                    {/* Créneaux générés de 8 h à 23 h 30 : la liste
                        s'arrêtait à 17 h, sans rendez-vous possible en
                        soirée. */}
                    {Array.from({ length: (24 - 8) * 2 }, (_, i) => {
                      const h = 8 + Math.floor(i / 2)
                      const m = i % 2 === 0 ? "00" : "30"
                      const valeur = `${String(h).padStart(2, "0")}:${m}`
                      const moment = h < 12 ? "Matin" : h < 13 ? "Midi" : h < 18 ? "Après-midi" : "Soirée"
                      return (
                        <option key={valeur} value={valeur}>
                          {String(h).padStart(2, "0")} h {m} ({moment} / HE)
                        </option>
                      )
                    })}
                  </select>
                </div>
              </div>

              {/* SÉLECTEUR DE DURÉE DE RENCONTRE (15min à 3h+) */}
              <div className="flex flex-col gap-2 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-indigo-600" />
                    <span>Durée de la rencontre (Flexibilité 15 min ➔ 3h)</span>
                  </label>
                  <span className="text-xs font-mono font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                    {formatMeetingTimeRange(inviteForm.startTime, inviteForm.durationMinutes)}
                  </span>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 pt-1">
                  {[
                    { label: "15 min", value: 15 },
                    { label: "30 min", value: 30 },
                    { label: "45 min", value: 45 },
                    { label: "1 h", value: 60 },
                    { label: "1 h 30", value: 90 },
                    { label: "2 h", value: 120 },
                    { label: "3 h", value: 180 }
                  ].map((dur) => (
                    <button
                      key={dur.value}
                      type="button"
                      onClick={() => setInviteForm({ ...inviteForm, durationMinutes: dur.value })}
                      className={`py-2 px-1 rounded-xl text-xs font-bold text-center transition-all cursor-pointer ${
                        inviteForm.durationMinutes === dur.value
                          ? "bg-indigo-900 text-white font-black shadow-md ring-2 ring-indigo-500/20"
                          : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
                      }`}
                    >
                      {dur.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs sm:text-sm font-extrabold text-slate-700 uppercase tracking-wider">Plateforme de Visioconférence Directe</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setInviteForm({ ...inviteForm, platform: "google_meet", calendlyLink: "" })}
                    className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                      inviteForm.platform === "google_meet"
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200"
                    }`}
                  >
                    Google Meet
                  </button>

                  <button
                    type="button"
                    onClick={() => setInviteForm({ ...inviteForm, platform: "zoom", calendlyLink: "" })}
                    className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                      inviteForm.platform === "zoom"
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200"
                    }`}
                  >
                    Zoom Direct
                  </button>

                  <button
                    type="button"
                    onClick={() => setInviteForm({ ...inviteForm, platform: "google_meet", calendlyLink: "https://teams.microsoft.com/l/meetup-join/direct-cicc" })}
                    className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                      inviteForm.calendlyLink.includes("teams")
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200"
                    }`}
                  >
                    MS Teams
                  </button>

                  <button
                    type="button"
                    onClick={() => setInviteForm({ ...inviteForm, platform: "calendly", calendlyLink: "" })}
                    className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                      inviteForm.platform === "calendly"
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200"
                    }`}
                  >
                    Calendly
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2 bg-purple-50 p-4 sm:p-5 rounded-2xl border border-purple-200">
                <div className="flex items-center justify-between">
                  <label className="text-xs sm:text-sm font-extrabold text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-purple-600" />
                    <span>Lien direct de la réunion ou Calendly</span>
                  </label>
                  <span className="text-xs font-bold text-purple-700 bg-white px-2.5 py-0.5 rounded-md border border-purple-200">
                    Lien sécurisé ✓
                  </span>
                </div>
                <input
                  type="url"
                  value={inviteForm.calendlyLink}
                  onChange={e => setInviteForm({ ...inviteForm, calendlyLink: e.target.value })}
                  className="w-full h-10 px-3.5 text-xs sm:text-sm font-mono font-bold bg-white border border-purple-300 rounded-xl text-purple-900 focus:outline-none"
                />
                <p className="text-xs text-purple-700">Le lien sera transmis au candidat par notification et affiché sur son Portail Client sans nécessiter Calendly.</p>
              </div>

              </div>

              <div className="shrink-0 flex items-center justify-end gap-3 border-t border-slate-100 bg-white px-6 py-4 sm:px-7">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="px-5 py-3 text-xs sm:text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white px-7 py-3.5 text-xs sm:text-sm font-black shadow-md transition-all cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>Envoyer l&apos;invitation Calendly</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SLIDE-OVER DRAWER : PLAN DE RENCONTRE & BRIEFING AI */}
      {isSlideOverOpen && selectedEvent && (
        <div className="fixed inset-0 z-[200] flex justify-end bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col justify-between border-l border-slate-200 animate-slideInRight overflow-y-auto">
            
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div>
                <span className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 border border-amber-300 font-mono text-xs font-bold px-3 py-1 rounded-full uppercase">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Smart Brief AI CICC
                </span>
                <h2 className="text-xl font-black text-slate-900 mt-2">
                  Plan d&apos;entrevue pour {selectedEvent.clientName}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 font-medium">Dossier {selectedEvent.matterId} · {selectedEvent.program}</p>
              </div>

              <button
                type="button"
                onClick={() => setIsSlideOverOpen(false)}
                className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 flex-1">
              <div className="bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-200/80 flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-bold text-slate-700">Compte Fidéicommis CICC</p>
                  <p className="text-lg font-black text-emerald-600 font-mono">{selectedEvent.trustBalance || "$0 CAD"}</p>
                </div>
                <Badge variant="success" className="text-xs font-bold">
                  Frais provisionnés ✓
                </Badge>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs sm:text-sm font-extrabold text-slate-500 uppercase tracking-wider">
                  Ordre du jour réglementaire recommandé
                </h4>

                <div className="space-y-2.5">
                  <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/60 flex items-center gap-3.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <p className="text-xs sm:text-sm font-bold text-emerald-950">1. Vérification d&apos;identité & Passeport</p>
                      <p className="text-xs text-emerald-800">Conforme · Valide au-delà de 6 mois après traitement</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/60 flex items-center gap-3.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <p className="text-xs sm:text-sm font-bold text-emerald-950">2. Contrôle d&apos;antécédents 10 ans (IMM 5669)</p>
                      <p className="text-xs text-emerald-800">100% de la période couverte sans aucun trou de date</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/60 flex items-center gap-3.5">
                    <Clock className="w-5 h-5 text-blue-600 shrink-0" />
                    <div>
                      <p className="text-xs sm:text-sm font-bold text-blue-950">3. Confirmation signature mandat IMM 5476</p>
                      <p className="text-xs text-blue-800">À faire signer numériquement pendant la visio</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs sm:text-sm font-extrabold text-slate-700 uppercase tracking-wider">
                  Notes de séance & consignes CICC
                </label>
                <textarea
                  rows={4}
                  value={briefNotes}
                  onChange={(e) => setBriefNotes(e.target.value)}
                  placeholder="Notez ici les instructions partagées durant l'entrevue..."
                  className="w-full p-4 text-xs sm:text-sm font-medium rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setIsSlideOverOpen(false)}
                className="px-5 py-3 text-xs sm:text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              >
                Fermer
              </button>

              <button
                type="button"
                onClick={handleSendBriefToPortal}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 text-xs sm:text-sm font-bold shadow-md transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Transmettre au Portail Client</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* La barre de zoom flottante a été retirée : elle recouvrait la
          grille en bas d'écran et dupliquait le réglage déjà présent
          dans la barre d'outils. */}

    </div>
  )
}
