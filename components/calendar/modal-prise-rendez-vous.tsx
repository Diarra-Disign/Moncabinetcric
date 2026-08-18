"use client"

import * as React from "react"
import {
  X,
  Calendar,
  Clock,
  Video,
  Phone,
  Users,
  AlertTriangle,
  CheckCircle2,
  CalendarPlus,
  Building2,
  Search,
  UserCheck,
  UserPlus,
  Globe,
  FileText,
  ShieldCheck,
  Check,
  MessageSquare,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { CalendarEvent, ClientRecord, Matter, Lead } from "@/lib/data/types"
import { createEvent } from "@/lib/data/actions"

export interface ModalPriseRendezVousProps {
  ouvert: boolean
  onFermer: () => void
  clients?: ClientRecord[]
  matters?: Matter[]
  leads?: Lead[]
  existingEvents?: CalendarEvent[]
  initialDate?: string
  initialHour?: number
  onRendezVousCree: (evenement: CalendarEvent) => void
}

const TYPES_RENDEZ_VOUS = [
  { val: "consultation_initiale", label: "Consultation Initiale d'évaluation", categorie: "consultation" },
  { val: "consultation_pro_bono", label: "Consultation Initiale Pro Bono", categorie: "consultation" },
  { val: "suivi_dossier", label: "Rendez-vous de suivi de dossier", categorie: "followup" },
  { val: "verification_pieces", label: "Revue des pièces justificatives IRCC", categorie: "followup" },
  { val: "signature_mandat", label: "Signature du Mandat CICC (IMM 5476)", categorie: "signing" },
  { val: "preparation_entrevue", label: "Préparation d'entrevue IRCC", categorie: "consultation" },
  { val: "autre", label: "Autre motif personnalisé", categorie: "other" },
]

const DUREES = [
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "45 min", value: 45 },
  { label: "1 h", value: 60 },
  { label: "1 h 30", value: 90 },
  { label: "2 h", value: 120 },
  { label: "3 h", value: 180 },
]

const MODALITES = [
  { val: "in_person", label: "En cabinet / Bureau", icone: Building2 },
  { val: "google_meet", label: "Google Meet", icone: Video },
  { val: "zoom", label: "Zoom", icone: Video },
  { val: "teams", label: "MS Teams", icone: Video },
  { val: "phone", label: "Téléphone", icone: Phone },
  { val: "whatsapp", label: "WhatsApp", icone: MessageSquare },
  { val: "other", label: "Autre modalité", icone: Globe },
]

const CONSULTANTS = [
  { id: "c-1", nom: "Adama Diarra, RCIC", permis: "R-514982" },
]

function toLocalISO(d: Date): string {
  const mois = String(d.getMonth() + 1).padStart(2, "0")
  const jour = String(d.getDate()).padStart(2, "0")
  return `${d.getFullYear()}-${mois}-${jour}`
}

function calculerPlageHoraire(heureDebut: string, dureeMin: number): { heureFin: string; libelle: string; heureNum: number } {
  const [hStr, mStr] = (heureDebut || "10:00").split(":")
  const startH = parseInt(hStr, 10) || 10
  const startM = parseInt(mStr, 10) || 0

  const totalStartMin = startH * 60 + startM
  const totalEndMin = totalStartMin + dureeMin

  const endH = Math.floor(totalEndMin / 60) % 24
  const endM = totalEndMin % 60

  const fH = (h: number) => (h < 10 ? `0${h}` : `${h}`)
  const fM = (m: number) => (m < 10 ? `0${m}` : `${m}`)

  let dureeLabel = ""
  if (dureeMin < 60) {
    dureeLabel = `${dureeMin} min`
  } else {
    const h = Math.floor(dureeMin / 60)
    const m = dureeMin % 60
    dureeLabel = m > 0 ? `${h}h ${m}m` : `${h}h`
  }

  const libelle = `${fH(startH)} h ${fM(startM)} – ${fH(endH)} h ${fM(endM)} (${dureeLabel})`
  const heureFin = `${fH(endH)}:${fM(endM)}`

  return { heureFin, libelle, heureNum: startH }
}

export function ModalPriseRendezVous({
  ouvert,
  onFermer,
  clients = [],
  matters = [],
  leads = [],
  existingEvents = [],
  initialDate,
  initialHour = 10,
  onRendezVousCree,
}: ModalPriseRendezVousProps) {
  if (!ouvert) return null

  return (
    <ModalPriseRendezVousContent
      key={`${initialDate || "today"}-${initialHour}`}
      onFermer={onFermer}
      clients={clients}
      matters={matters}
      leads={leads}
      existingEvents={existingEvents}
      initialDate={initialDate}
      initialHour={initialHour}
      onRendezVousCree={onRendezVousCree}
    />
  )
}

function ModalPriseRendezVousContent({
  onFermer,
  clients = [],
  matters = [],
  leads = [],
  existingEvents = [],
  initialDate,
  initialHour = 10,
  onRendezVousCree,
}: Omit<ModalPriseRendezVousProps, "ouvert">) {
  // Cible : Client / Prospect / Nouveau
  const [typeCible, setTypeCible] = React.useState<"client" | "prospect" | "nouveau">("client")
  const [rechercheContact, setRechercheContact] = React.useState("")

  // Données contact sélectionné
  const [selectedClientId, setSelectedClientId] = React.useState("")
  const [selectedLeadId, setSelectedLeadId] = React.useState("")
  const [selectedMatterId, setSelectedMatterId] = React.useState("")
  const [contactName, setContactName] = React.useState("")
  const [contactEmail, setContactEmail] = React.useState("")
  const [contactPhone, setContactPhone] = React.useState("")
  const [contactProgram, setContactProgram] = React.useState("")

  // Détails rendez-vous
  const [typeRdv, setTypeRdv] = React.useState(TYPES_RENDEZ_VOUS[0].val)
  const [typeRdvAutre, setTypeRdvAutre] = React.useState("")
  const [date, setDate] = React.useState(initialDate || toLocalISO(new Date()))
  const [startTime, setStartTime] = React.useState(
    `${String(initialHour).padStart(2, "0")}:00`
  )
  const [durationMinutes, setDurationMinutes] = React.useState(60)
  const [consultantId, setConsultantId] = React.useState(CONSULTANTS[0].id)
  const [modalite, setModalite] = React.useState("google_meet")
  const [meetingLink, setMeetingLink] = React.useState("")
  const [notesInternes, setNotesInternes] = React.useState("")
  const [statut, setStatut] = React.useState<"confirmed" | "pending">("confirmed")

  // Étape de confirmation
  const [showConfirmation, setShowConfirmation] = React.useState(false)
  const [enCours, setEnCours] = React.useState(false)
  const [erreur, setErreur] = React.useState<string | null>(null)

  // Détection des conflits d'horaires
  const conflitDetecte = React.useMemo(() => {
    if (!date || !startTime) return null

    const [curH, curM] = startTime.split(":").map(Number)
    const curStartMin = (curH || 0) * 60 + (curM || 0)
    const curEndMin = curStartMin + durationMinutes

    const evtsDuJour = existingEvents.filter((e) => e.date === date && e.status !== "cancelled")

    for (const evt of evtsDuJour) {
      const evtHour = evt.hour ?? 9
      const evtDur = evt.durationMinutes ?? 60
      const evtStartMin = evtHour * 60
      const evtEndMin = evtStartMin + evtDur

      // Chevauchement si (StartA < EndB) et (EndA > StartB)
      if (curStartMin < evtEndMin && curEndMin > evtStartMin) {
        return evt
      }
    }
    return null
  }, [existingEvents, date, startTime, durationMinutes])

  // Sélection d'un client
  const handleSelectClient = (c: ClientRecord) => {
    setSelectedClientId(c.id)
    setSelectedLeadId("")
    setContactName(c.name)
    setContactEmail(c.email || "")
    setContactPhone(c.phone || "")
    const m = matters.find((mat) => mat.clientId === c.id)
    setSelectedMatterId(m?.id || "")
    setContactProgram(m?.program || c.program || "Dossier Immigration CICC")
    setRechercheContact(c.name)
  }

  // Sélection d'un prospect
  const handleSelectLead = (l: Lead) => {
    setSelectedLeadId(l.id)
    setSelectedClientId("")
    setSelectedMatterId("")
    setContactName(l.name)
    setContactEmail(l.email || "")
    setContactPhone(l.phone || "")
    setContactProgram(l.visaType || "Consultation d'évaluation")
    setRechercheContact(l.name)
  }

  // Contacts filtrés
  const clientsFiltres = clients.filter(
    (c) =>
      !rechercheContact ||
      c.name.toLowerCase().includes(rechercheContact.toLowerCase()) ||
      (c.email && c.email.toLowerCase().includes(rechercheContact.toLowerCase()))
  )

  const leadsFiltres = leads.filter(
    (l) =>
      !rechercheContact ||
      l.name.toLowerCase().includes(rechercheContact.toLowerCase()) ||
      (l.email && l.email.toLowerCase().includes(rechercheContact.toLowerCase()))
  )

  const plage = calculerPlageHoraire(startTime, durationMinutes)

  const handleValiderFormulaire = (e: React.FormEvent) => {
    e.preventDefault()
    setErreur(null)

    if (!contactName.trim()) {
      setErreur("Veuillez sélectionner ou renseigner le nom de la personne.")
      return
    }

    if (!date) {
      setErreur("Veuillez choisir une date valide.")
      return
    }

    // Afficher l'étape de confirmation formelle
    setShowConfirmation(true)
  }

  const handleEnregistrerFinal = async () => {
    setEnCours(true)
    setErreur(null)

    try {
      const parts = contactName.trim().split(" ")
      const initials = parts.length >= 2 ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase() : "RDV"

      const selectedD = new Date(date + "T12:00:00")
      const monthNames = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]
      const dayName = `${selectedD.getDate()} ${monthNames[selectedD.getMonth()]} ${selectedD.getFullYear()}`

      const motifObjet = typeRdv === "autre" && typeRdvAutre.trim()
        ? typeRdvAutre.trim()
        : TYPES_RENDEZ_VOUS.find((t) => t.val === typeRdv)?.label || "Consultation"

      const consultantChoisi = CONSULTANTS.find((c) => c.id === consultantId)

      const payload = {
        title: motifObjet,
        clientName: contactName.trim(),
        clientInitials: initials,
        avatarBg: typeCible === "prospect" ? "bg-amber-600" : "bg-primary",
        matterId: selectedMatterId || (selectedClientId ? `#DOS-${selectedClientId.slice(0, 5)}` : ""),
        clientId: selectedClientId || undefined,
        leadId: selectedLeadId || undefined,
        program: contactProgram || "Immigration Canada",
        type: TYPES_RENDEZ_VOUS.find((t) => t.val === typeRdv)?.categorie || "consultation",
        platform: modalite,
        link: meetingLink.trim() || undefined,
        date,
        dayName,
        time: plage.libelle,
        hour: plage.heureNum,
        durationMinutes,
        status: statut,
        notes: notesInternes.trim() || undefined,
        consultantName: consultantChoisi?.nom || "Adama Diarra, RCIC",
        consultantId: consultantChoisi?.id,
      }

      const evtCree = await createEvent(payload)
      onRendezVousCree(evtCree)
      onFermer()
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Erreur lors de l'enregistrement.")
      setShowConfirmation(false)
    } finally {
      setEnCours(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl max-h-[92vh] flex flex-col bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête officiel de la modale */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <CalendarPlus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                Planifier un nouveau rendez-vous
              </h2>
              <p className="text-xs text-muted-foreground">
                Inscrit à l&apos;agenda du cabinet et synchronisé avec le dossier client.
              </p>
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
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {erreur && (
            <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{erreur}</span>
            </div>
          )}

          {/* Détecteur de conflit d'horaire */}
          {conflitDetecte && (
            <div className="p-3.5 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs space-y-1">
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>⚠️ Chevauchement d&apos;horaires détecté</span>
              </div>
              <p className="pl-6 text-[11px] text-amber-800 dark:text-amber-300">
                Vous avez déjà <strong>{conflitDetecte.title}</strong> avec <strong>{conflitDetecte.clientName}</strong> sur ce créneau ({conflitDetecte.time}).
              </p>
            </div>
          )}

          <form id="form-rdv" onSubmit={handleValiderFormulaire} className="space-y-5">
            {/* 1. Sélection de la cible : Client / Prospect / Nouveau */}
            <div>
              <label className="text-xs font-semibold text-foreground block mb-2">
                Type de contact & Destinataire *
              </label>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => {
                    setTypeCible("client")
                    setContactName("")
                    setRechercheContact("")
                  }}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    typeCible === "client"
                      ? "border-primary bg-primary/10 text-primary-strong shadow-xs"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  <span>Client existant</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTypeCible("prospect")
                    setContactName("")
                    setRechercheContact("")
                  }}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    typeCible === "prospect"
                      ? "border-primary bg-primary/10 text-primary-strong shadow-xs"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>Prospect</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTypeCible("nouveau")
                    setSelectedClientId("")
                    setSelectedLeadId("")
                    setSelectedMatterId("")
                    setContactName("")
                    setRechercheContact("")
                  }}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    typeCible === "nouveau"
                      ? "border-primary bg-primary/10 text-primary-strong shadow-xs"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Users className="h-3.5 w-3.5" />
                  <span>Saisie directe</span>
                </button>
              </div>

              {/* Barre de recherche et auto-complétion */}
              {typeCible === "client" && (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Rechercher un client par nom ou courriel..."
                      value={rechercheContact}
                      onChange={(e) => setRechercheContact(e.target.value)}
                      className="w-full h-9 pl-9 pr-3 text-xs rounded-xl border border-border bg-background"
                    />
                  </div>
                  {clientsFiltres.length > 0 && !selectedClientId && rechercheContact && (
                    <div className="max-h-36 overflow-y-auto border border-border rounded-xl bg-card p-1 divide-y divide-border text-xs">
                      {clientsFiltres.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleSelectClient(c)}
                          className="w-full text-left p-2 rounded-lg hover:bg-muted flex items-center justify-between transition-colors"
                        >
                          <div>
                            <span className="font-semibold text-foreground">{c.name}</span>
                            <span className="text-muted-foreground text-[11px] block">{c.email || "Sans courriel"} · {c.program || "Dossier CICC"}</span>
                          </div>
                          <Badge variant="outline" className="text-[10px]">Sélectionner</Badge>
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedClientId && (
                    <div className="p-2.5 rounded-xl border border-primary/30 bg-primary/5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-foreground">Client sélectionné : {contactName}</span>
                        <span className="text-muted-foreground text-[11px] block">{contactEmail} · {contactProgram}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedClientId("")
                          setContactName("")
                          setRechercheContact("")
                        }}
                        className="h-6 text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        Changer
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {typeCible === "prospect" && (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Rechercher un prospect..."
                      value={rechercheContact}
                      onChange={(e) => setRechercheContact(e.target.value)}
                      className="w-full h-9 pl-9 pr-3 text-xs rounded-xl border border-border bg-background"
                    />
                  </div>
                  {leadsFiltres.length > 0 && !selectedLeadId && rechercheContact && (
                    <div className="max-h-36 overflow-y-auto border border-border rounded-xl bg-card p-1 divide-y divide-border text-xs">
                      {leadsFiltres.map((l) => (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => handleSelectLead(l)}
                          className="w-full text-left p-2 rounded-lg hover:bg-muted flex items-center justify-between transition-colors"
                        >
                          <div>
                            <span className="font-semibold text-foreground">{l.name}</span>
                            <span className="text-muted-foreground text-[11px] block">{l.email} · {l.visaType || "Évaluation"}</span>
                          </div>
                          <Badge variant="outline" className="text-[10px]">Sélectionner</Badge>
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedLeadId && (
                    <div className="p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-foreground">Prospect sélectionné : {contactName}</span>
                        <span className="text-muted-foreground text-[11px] block">{contactEmail} · {contactProgram}</span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedLeadId("")
                          setContactName("")
                          setRechercheContact("")
                        }}
                        className="h-6 text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        Changer
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {typeCible === "nouveau" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl border border-border bg-muted/20">
                  <div>
                    <label className="text-[11px] font-semibold text-foreground block mb-1">Nom complet *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Jean Dupont"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      className="w-full h-8 px-2.5 text-xs rounded-lg border border-border bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-foreground block mb-1">Courriel</label>
                    <input
                      type="email"
                      placeholder="jean.dupont@exemple.ca"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      className="w-full h-8 px-2.5 text-xs rounded-lg border border-border bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-foreground block mb-1">Téléphone</label>
                    <input
                      type="tel"
                      placeholder="+1 (514) 000-0000"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      className="w-full h-8 px-2.5 text-xs rounded-lg border border-border bg-background"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-foreground block mb-1">Programme envisagé</label>
                    <input
                      type="text"
                      placeholder="Ex: Permis de travail"
                      value={contactProgram}
                      onChange={(e) => setContactProgram(e.target.value)}
                      className="w-full h-8 px-2.5 text-xs rounded-lg border border-border bg-background"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 2. Motif et type de rendez-vous */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-1.5">
                  <FileText className="h-3.5 w-3.5 text-primary" />
                  Type de rendez-vous *
                </label>
                <select
                  value={typeRdv}
                  onChange={(e) => setTypeRdv(e.target.value)}
                  className="w-full h-9 px-3 text-xs rounded-xl border border-border bg-background"
                >
                  {TYPES_RENDEZ_VOUS.map((t) => (
                    <option key={t.val} value={t.val}>
                      {t.label}
                    </option>
                  ))}
                </select>
                {typeRdv === "autre" && (
                  <input
                    type="text"
                    required
                    placeholder="Précisez l'objet du rendez-vous..."
                    value={typeRdvAutre}
                    onChange={(e) => setTypeRdvAutre(e.target.value)}
                    className="w-full h-8 mt-2 px-2.5 text-xs rounded-lg border border-border bg-background"
                  />
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                  Consultant assigné *
                </label>
                <select
                  value={consultantId}
                  onChange={(e) => setConsultantId(e.target.value)}
                  className="w-full h-9 px-3 text-xs rounded-xl border border-border bg-background font-medium"
                >
                  {CONSULTANTS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nom} ({c.permis})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 3. Date, Heure et Durée */}
            <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1 mb-1">
                    <Calendar className="h-3.5 w-3.5 text-primary" /> Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full h-9 px-2.5 text-xs rounded-lg border border-border bg-background"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1 mb-1">
                    <Clock className="h-3.5 w-3.5 text-primary" /> Heure de début *
                  </label>
                  <select
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full h-9 px-2.5 text-xs rounded-lg border border-border bg-background font-mono"
                  >
                    {Array.from({ length: (24 - 8) * 2 }, (_, i) => {
                      const h = 8 + Math.floor(i / 2)
                      const m = i % 2 === 0 ? "00" : "30"
                      const val = `${String(h).padStart(2, "0")}:${m}`
                      const moment = h < 12 ? "Matin" : h < 14 ? "Midi" : h < 18 ? "Après-midi" : "Soirée"
                      return (
                        <option key={val} value={val}>
                          {String(h).padStart(2, "0")} h {m} ({moment})
                        </option>
                      )
                    })}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Plage horaire calculée
                  </label>
                  <div className="h-9 px-2.5 text-[11px] font-mono font-bold flex items-center rounded-lg border border-primary/30 bg-primary/5 text-primary-strong">
                    {plage.libelle}
                  </div>
                </div>
              </div>

              {/* Boutons de durée rapide */}
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1.5">
                  Durée de la séance
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {DUREES.map((dur) => (
                    <button
                      key={dur.value}
                      type="button"
                      onClick={() => setDurationMinutes(dur.value)}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                        durationMinutes === dur.value
                          ? "bg-primary text-primary-foreground border-primary font-bold shadow-xs"
                          : "bg-background border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {dur.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 4. Modalité et lien de réunion */}
            <div>
              <label className="text-xs font-semibold text-foreground block mb-2">
                Modalité / Lieu de la rencontre *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                {MODALITES.map((m) => {
                  const Icone = m.icone
                  const isSel = modalite === m.val
                  return (
                    <button
                      key={m.val}
                      type="button"
                      onClick={() => setModalite(m.val)}
                      className={`p-2 rounded-xl border text-xs font-medium flex items-center gap-2 transition-all ${
                        isSel
                          ? "border-primary bg-primary/10 text-primary-strong shadow-xs font-semibold"
                          : "border-border bg-card text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icone className="h-4 w-4 shrink-0" />
                      <span className="truncate">{m.label}</span>
                    </button>
                  )
                })}
              </div>

              {modalite !== "in_person" && modalite !== "phone" && (
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                    <Globe className="h-3 w-3" /> Lien de visioconférence (Google Meet, Zoom, Teams)
                  </label>
                  <input
                    type="url"
                    placeholder="https://meet.google.com/xyz-uvwx-rst ou lien Zoom..."
                    value={meetingLink}
                    onChange={(e) => setMeetingLink(e.target.value)}
                    className="w-full h-8 px-2.5 text-xs font-mono rounded-lg border border-border bg-background"
                  />
                </div>
              )}
            </div>

            {/* 5. Notes internes & Statut */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Notes internes (non visibles du client)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Préparer l'historique des voyages et TEF..."
                  value={notesInternes}
                  onChange={(e) => setNotesInternes(e.target.value)}
                  className="w-full h-8 px-2.5 text-xs rounded-lg border border-border bg-background"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Statut initial
                </label>
                <select
                  value={statut}
                  onChange={(e) => setStatut(e.target.value as "confirmed" | "pending")}
                  className="w-full h-8 px-2.5 text-xs rounded-lg border border-border bg-background"
                >
                  <option value="confirmed">Confirmé ✓</option>
                  <option value="pending">En attente ⏳</option>
                </select>
              </div>
            </div>
          </form>
        </div>

        {/* Pied de page actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/40">
          <Button variant="ghost" size="sm" onClick={onFermer} disabled={enCours} className="text-xs">
            Annuler
          </Button>
          <Button
            type="submit"
            form="form-rdv"
            size="sm"
            disabled={enCours}
            className="gap-1.5 text-xs bg-primary text-primary-foreground font-semibold"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Valider le rendez-vous</span>
          </Button>
        </div>
      </div>

      {/* Modale de confirmation formelle avant validation */}
      {showConfirmation && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md p-6 rounded-2xl bg-card border border-border shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <CalendarCheckIcon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Confirmer le rendez-vous</h3>
                <p className="text-xs text-muted-foreground">Vérification des détails avant enregistrement</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-border bg-muted/30 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Destinataire :</span>
                <span className="font-bold text-foreground">{contactName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Motif :</span>
                <span className="font-medium text-foreground">
                  {typeRdv === "autre" ? typeRdvAutre : TYPES_RENDEZ_VOUS.find((t) => t.val === typeRdv)?.label}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date & Heure :</span>
                <span className="font-mono font-bold text-primary">{date} · {plage.libelle}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Modalité :</span>
                <span className="font-medium text-foreground capitalize">
                  {MODALITES.find((m) => m.val === modalite)?.label}
                </span>
              </div>
            </div>

            {conflitDetecte && (
              <p className="text-[11px] text-amber-800 dark:text-amber-300 font-medium">
                ⚠️ Vous confirmez ce créneau malgré le chevauchement avec {conflitDetecte.clientName}.
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowConfirmation(false)}
                disabled={enCours}
                className="text-xs"
              >
                Modifier
              </Button>
              <Button
                size="sm"
                onClick={handleEnregistrerFinal}
                disabled={enCours}
                className="bg-primary text-primary-foreground text-xs font-semibold gap-1.5"
              >
                <Check className="h-4 w-4" />
                <span>{enCours ? "Enregistrement…" : "Confirmer et enregistrer"}</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CalendarCheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
      <path d="m9 16 2 2 4-4" />
    </svg>
  )
}
