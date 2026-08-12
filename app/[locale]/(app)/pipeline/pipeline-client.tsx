"use client"

import * as React from "react"
import { 
  Building2, 
  User, 
  Search, 
  Plus, 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle2, 
  Clock, 
  Mail, 
  Phone, 
  Calendar, 
  ArrowRight, 
  ShieldCheck, 
  Filter,
  MoreHorizontal,
  Briefcase,
  AlertCircle,
  FolderOpen,
  DollarSign,
  TrendingUp,
  UserPlus,
  Globe,
  Star,
  Layers,
  ChevronDown,
  Trash2,
  GripVertical,
  RefreshCw,
  Edit3,
  HelpCircle,
  FileText,
  Check,
  Info,
  MessageSquare,
  X
} from "lucide-react"
import { useTranslations } from "next-intl"
import { Link, useRouter } from "@/i18n/routing"
import { Lead } from "@/lib/data/types"
import { PageHeader } from "@/components/app-shell/page-header"
import { matchesPerson } from "@/lib/utils/search"
import { createLead, updateLead, moveLeadStage, convertLeadToClient } from "@/lib/data/actions"
import { SelecteurCivilite } from "@/components/ui/civilite"
import { nomAvecCivilite, type Civilite } from "@/lib/data/identite"
import { PROGRAM_GROUPS } from "@/lib/data/services-immigration"

export type { Lead }

export { PROGRAM_GROUPS } from "@/lib/data/services-immigration"

interface PipelineClientProps {
  t: {
    title: string
    subtitle: string
    stats: Record<string, string>
    filters: Record<string, string>
    columns: Record<string, string>
    actions: Record<string, string>
    badges: Record<string, string>
  }
  initialLeads: Lead[]
}

const STAGE_ORDER: Lead["stage"][] = ["newLead", "consultation", "proposal", "negotiation", "signed"]

function getStageHeaderConfig(stage: Lead["stage"]) {
  switch (stage) {
    case "newLead":
      return {
        title: "Nouveau Prospect",
        borderLeft: "border-l-4 border-l-blue-600",
        bgGradient: "bg-gradient-to-r from-primary/10 via-primary/10 to-transparent",
        badgeBg: "bg-primary text-primary-foreground font-mono shadow-2xs",
        dotBg: "bg-primary animate-pulse",
        textAccent: "text-primary-strong"
      }
    case "consultation":
      return {
        title: "Consultation Planifiée",
        borderLeft: "border-l-4 border-l-purple-600",
        bgGradient: "bg-gradient-to-r from-accent/10 via-primary/10 to-transparent",
        badgeBg: "bg-accent text-accent-foreground font-mono shadow-2xs",
        dotBg: "bg-accent",
        textAccent: "text-accent-strong"
      }
    case "proposal":
      return {
        title: "Proposition Transmise",
        borderLeft: "border-l-4 border-l-amber-500",
        bgGradient: "bg-gradient-to-r from-warning/10 via-warning/10 to-transparent",
        badgeBg: "bg-warning text-foreground font-mono shadow-2xs",
        dotBg: "bg-warning",
        textAccent: "text-warning-strong"
      }
    case "negotiation":
      return {
        title: "Négociation & Révision",
        borderLeft: "border-l-4 border-l-orange-500",
        bgGradient: "bg-gradient-to-r from-warning/10 via-error/10 to-transparent",
        badgeBg: "bg-warning text-background font-mono shadow-2xs",
        dotBg: "bg-warning",
        textAccent: "text-warning-strong"
      }
    case "signed":
      return {
        title: "Mandat Signé CICC",
        borderLeft: "border-l-4 border-l-emerald-600",
        bgGradient: "bg-gradient-to-r from-success/10 via-success/10 to-transparent",
        badgeBg: "bg-success text-background font-mono shadow-2xs",
        dotBg: "bg-success",
        textAccent: "text-success-strong"
      }
    default:
      return {
        title: stage,
        borderLeft: "border-l-4 border-l-slate-400",
        bgGradient: "bg-muted",
        badgeBg: "bg-foreground text-background font-mono shadow-2xs",
        dotBg: "bg-muted-foreground",
        textAccent: "text-foreground"
      }
  }
}

export function PipelineClient({ t, initialLeads }: PipelineClientProps) {
  // Les prospects viennent de la base, et d'elle seule.
  //
  // Cette liste était auparavant amorcée depuis localStorage quand une copie
  // s'y trouvait. Deux défauts en découlaient. D'abord une erreur
  // d'hydratation : le serveur rendait les chiffres de la base, le navigateur
  // ceux de sa copie, et React constatait la divergence. Ensuite, et c'est le
  // plus grave, la copie masquait le fait que les changements d'étape
  // n'étaient jamais écrits en base — le pipeline paraissait fonctionner
  // parce que le navigateur rejouait ses propres modifications au
  // rechargement, mais aucun collègue, aucun autre poste ne les voyait.
  const [leads, setLeads] = React.useState<Lead[]>(initialLeads)
  const [filterType, setFilterType] = React.useState<"all" | "b2b" | "b2c" | "high" | "signed">("all")
  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectedLead, setSelectedLead] = React.useState<Lead | null>(null)
  const [showNewModal, setShowNewModal] = React.useState(false)
  const [conversionSuccess, setConversionSuccess] = React.useState<string | null>(null)
  const [pipelineError, setPipelineError] = React.useState<string | null>(null)
  // DRAG AND DROP STATE
  const [draggedLeadId, setDraggedLeadId] = React.useState<string | null>(null)
  const [dragOverStage, setDragOverStage] = React.useState<string | null>(null)

  const router = useRouter()
  // Le reste du fichier reçoit ses libellés par la prop `t`, une forme figée
  // qui ne sait pas interpoler. Ce sous-titre porte deux nombres : il passe
  // donc par le hook, conforme à la convention du projet.
  const tPipeline = useTranslations("Pipeline")

  const notifySuccess = (message: string) => {
    setPipelineError(null)
    setConversionSuccess(message)
    setTimeout(() => setConversionSuccess(null), 4000)
  }

  const notifyError = (message: string) => {
    setConversionSuccess(null)
    setPipelineError(message)
    setTimeout(() => setPipelineError(null), 6000)
  }

  /**
   * Change l'étape d'un prospect, en base puis à l'écran.
   *
   * L'affichage est mis à jour immédiatement pour que le glisser-déposer
   * reste fluide, mais il est remis dans son état antérieur si l'écriture
   * échoue : mieux vaut voir la carte revenir à sa place que croire une
   * étape franchie qui ne l'est pas.
   */
  const applyStageChange = async (leadId: string, targetStage: Lead["stage"]) => {
    const previous = leads
    const target = leads.find(l => l.id === leadId)
    if (!target || target.stage === targetStage) return

    setLeads(leads.map(l => (l.id === leadId ? { ...l, stage: targetStage } : l)))

    try {
      await moveLeadStage(leadId, targetStage)
      notifySuccess(
        `Prospect « ${target.company || target.name} » déplacé vers « ${t.columns[targetStage]} ».`
      )
    } catch (err) {
      setLeads(previous)
      notifyError(
        `Le déplacement de « ${target.company || target.name} » n'a pas pu être enregistré : ${
          err instanceof Error ? err.message : "erreur inconnue"
        }`
      )
    }
  }

  // Recharge les prospects depuis la base. Il n'y a plus de copie locale à
  // effacer : le bouton sert à récupérer les modifications faites ailleurs.
  const handleResetPipeline = () => {
    router.refresh()
    notifySuccess("Pipeline resynchronisé avec la base.")
  }

  // Form State pour un nouveau prospect (Renseignements, Consultation ou Mandat)
  const [newLeadType, setNewLeadType] = React.useState<"b2b" | "b2c">("b2c")
  const [newLeadCivility, setNewLeadCivility] = React.useState<Civilite | "">("")
  const [newLeadFirstName, setNewLeadFirstName] = React.useState("")
  const [newLeadLastName, setNewLeadLastName] = React.useState("")
  const [newLeadCompany, setNewLeadCompany] = React.useState("")
  const [newLeadEmail, setNewLeadEmail] = React.useState("")
  const [newLeadPhone, setNewLeadPhone] = React.useState("")
  const [newLeadIntent, setNewLeadIntent] = React.useState<"info" | "consultation" | "mandate">("mandate")
  const [newLeadVisa, setNewLeadVisa] = React.useState("Résidence Permanente (Entrée Express)")
  const [newLeadValue, setNewLeadValue] = React.useState("4500")
  const [newLeadPositions, setNewLeadPositions] = React.useState("1")
  const [newLeadFeasibility, setNewLeadFeasibility] = React.useState<"high" | "med" | "low">("high")
  const [newLeadSource, setNewLeadSource] = React.useState("Site Web moncabinetcric")
  const [newLeadNotes, setNewLeadNotes] = React.useState("")

  // Également état pour l'édition dans le modal de détails
  const [isEditingSelectedLead, setIsEditingSelectedLead] = React.useState(false)
  const [editLeadName, setEditLeadName] = React.useState("")
  const [editLeadCompany, setEditLeadCompany] = React.useState("")
  const [editLeadEmail, setEditLeadEmail] = React.useState("")
  const [editLeadPhone, setEditLeadPhone] = React.useState("")
  const [editLeadVisa, setEditLeadVisa] = React.useState("")
  const [editLeadValue, setEditLeadValue] = React.useState("")
  const [editLeadScoreLabel, setEditLeadScoreLabel] = React.useState<"high" | "med" | "low">("high")
  const [editLeadNotes, setEditLeadNotes] = React.useState("")

  const handleStartEditLead = () => {
    if (!selectedLead) return
    setEditLeadName(selectedLead.name)
    setEditLeadCompany(selectedLead.company || "")
    setEditLeadEmail(selectedLead.email)
    setEditLeadPhone(selectedLead.phone)
    setEditLeadVisa(selectedLead.visaType)
    setEditLeadValue(String(selectedLead.estimatedValue))
    setEditLeadScoreLabel(selectedLead.scoreLabel)
    setEditLeadNotes(selectedLead.notes || "")
    setIsEditingSelectedLead(true)
  }

  const handleSaveEditLead = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLead) return

    const scoreMap = { high: 90, med: 72, low: 55 }
    const numValue = Number(editLeadValue) || 0

    const updates: Partial<Lead> = {
      name: editLeadName,
      company: selectedLead.type === "b2b" ? editLeadCompany : undefined,
      email: editLeadEmail,
      phone: editLeadPhone,
      visaType: editLeadVisa,
      estimatedValue: numValue,
      scoreLabel: editLeadScoreLabel,
      score: scoreMap[editLeadScoreLabel],
      notes: editLeadNotes,
    }

    const previous = leads
    setLeads(leads.map(l => l.id === selectedLead.id ? { ...l, ...updates } : l))

    try {
      await updateLead(selectedLead.id, updates)
    } catch (err) {
      // L'échec était auparavant relégué à la console : l'écran affichait
      // une fiche modifiée que la base n'avait jamais reçue.
      setLeads(previous)
      notifyError(
        `Les modifications de « ${selectedLead.company || selectedLead.name} » n'ont pas été enregistrées : ${
          err instanceof Error ? err.message : "erreur inconnue"
        }`
      )
    }

    setSelectedLead(prev => prev ? { ...prev, ...updates } : null)
    setIsEditingSelectedLead(false)
    setConversionSuccess(`Fiche prospect "${editLeadName}" mise à jour avec succès !`)
    setTimeout(() => setConversionSuccess(null), 4000)
  }

  const handleIntentChange = (intent: "info" | "consultation" | "mandate") => {
    setNewLeadIntent(intent)
    if (intent === "info") {
      setNewLeadVisa("Renseignements Généraux Cabinet")
      setNewLeadValue("0")
    } else if (intent === "consultation") {
      setNewLeadVisa("Consultation Initiale d'Évaluation")
      setNewLeadValue("150")
    } else {
      setNewLeadVisa("Résidence Permanente (Entrée Express)")
      setNewLeadValue("4500")
    }
  }

  const handleVisaChange = (visaValue: string) => {
    setNewLeadVisa(visaValue)
    for (const group of PROGRAM_GROUPS) {
      const found = group.options.find(opt => opt.value === visaValue)
      if (found) {
        setNewLeadValue(String(found.defaultPrice))
        break
      }
    }
  }

  // Calculated metrics
  const filteredLeads = leads.filter(lead => {
    let matchesType = true
    if (filterType === "b2b") matchesType = lead.type === "b2b"
    else if (filterType === "b2c") matchesType = lead.type === "b2c"
    else if (filterType === "high") matchesType = lead.scoreLabel === "high"
    else if (filterType === "signed") matchesType = lead.stage === "signed"

    const matchesSearch = matchesPerson(searchQuery, [
      lead.name, lead.firstName, lead.lastName, lead.company,
      lead.email, lead.phone, lead.visaType, lead.notes, lead.source,
    ])
    return matchesType && matchesSearch
  })

  const totalValue = leads.reduce((acc, lead) => acc + lead.estimatedValue, 0)
  const activeLeadsCount = leads.length
  const b2bCount = leads.filter(l => l.type === "b2b").length
  const b2bShare = Math.round((b2bCount / (activeLeadsCount || 1)) * 100)

  // Taux de conversion : part des prospects parvenus au mandat signé.
  //
  // Ce chiffre était figé à 68 %, seule des quatre cartes à ne rien mesurer.
  // Il s'agit d'une photographie du pipeline actuel, non d'un taux sur une
  // période : le sous-titre énonce donc la base du calcul, pour qu'un
  // pourcentage flatteur sur trois prospects ne se lise pas comme une
  // performance commerciale.
  const signedCount = leads.filter(l => l.stage === "signed").length
  const conversionRate =
    activeLeadsCount === 0 ? 0 : Math.round((signedCount / activeLeadsCount) * 100)

  // GESTION DU DRAG & DROP HTML5 NATIF
  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData("text/plain", leadId)
    setDraggedLeadId(leadId)
  }

  const handleDragOver = (e: React.DragEvent, stageKey: string) => {
    e.preventDefault()
    setDragOverStage(stageKey)
  }

  const handleDragLeave = () => {
    setDragOverStage(null)
  }

  const handleDrop = (e: React.DragEvent, targetStage: Lead["stage"]) => {
    e.preventDefault()
    // dataTransfer n'est lisible que de façon synchrone : on relève la
    // valeur avant toute écriture asynchrone.
    const leadId = e.dataTransfer.getData("text/plain") || draggedLeadId
    setDraggedLeadId(null)
    setDragOverStage(null)
    if (!leadId) return

    void applyStageChange(leadId, targetStage)
  }

  // Stage move handler via flèches
  const moveLead = (id: string, direction: "left" | "right", e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    const current = leads.find(l => l.id === id)
    if (!current) return

    const currentIndex = STAGE_ORDER.indexOf(current.stage)
    const nextIndex = direction === "right"
      ? Math.min(STAGE_ORDER.length - 1, currentIndex + 1)
      : Math.max(0, currentIndex - 1)

    void applyStageChange(id, STAGE_ORDER[nextIndex])
  }

  // Delete lead handler
  const handleDeleteLead = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    const targetLead = leads.find(l => l.id === id)
    setLeads(prev => prev.filter(l => l.id !== id))
    if (selectedLead?.id === id) {
      setSelectedLead(null)
      setIsEditingSelectedLead(false)
    }
    setConversionSuccess(`Prospect "${targetLead?.company || targetLead?.name}" supprimé avec succès !`)
    setTimeout(() => setConversionSuccess(null), 5000)
  }

  // Conversion du prospect en client.
  //
  // Cette action annonçait auparavant « Mandat CICC ouvert avec succès »
  // sans rien créer : aucun client, aucune référence, aucune écriture. Elle
  // crée désormais réellement le client et marque le prospect converti.
  const [isConverting, setIsConverting] = React.useState(false)

  const handleConvertToMatter = async (lead: Lead) => {
    if (isConverting) return
    setIsConverting(true)
    try {
      const {
        client, alreadyConverted,
        questionnairesTransferes, membresFamilleTransferes, ententesTransferees,
      } = await convertLeadToClient(lead.id)

      // Ce qui a SUIVI le prospect est nommé. Ces transferts avaient lieu en
      // silence : le consultant ne savait pas que le questionnaire rempli, la
      // famille saisie et l'entente signée étaient désormais au dossier du
      // client — et pouvait les redemander.
      const suivis = [
        questionnairesTransferes > 0 &&
          `${questionnairesTransferes} questionnaire${questionnairesTransferes > 1 ? "s" : ""}`,
        membresFamilleTransferes > 0 &&
          `${membresFamilleTransferes} membre${membresFamilleTransferes > 1 ? "s" : ""} de la famille`,
        ententesTransferees > 0 &&
          `${ententesTransferees} entente${ententesTransferees > 1 ? "s" : ""} de service`,
      ].filter(Boolean).join(", ")

      setConversionSuccess(
        alreadyConverted
          ? `« ${lead.company || lead.name} » était déjà converti — dossier ${client.fileNumber}.`
          : `Client « ${client.name} » créé sous le dossier ${client.fileNumber}. Le prospect est conservé et marqué converti.` +
            (suivis ? ` Ont suivi : ${suivis}.` : "")
      )
      // Le prospect reste dans le pipeline, à l'étape signée : on perdrait
      // sinon l'historique du cycle de vente.
      setLeads(leads.map(l => (l.id === lead.id ? { ...l, stage: "signed" as const } : l)))
      setSelectedLead(null)
      setIsEditingSelectedLead(false)
      router.refresh()
    } catch (err) {
      setConversionSuccess(
        `Conversion impossible : ${err instanceof Error ? err.message : "erreur inattendue"}`
      )
    } finally {
      setIsConverting(false)
      setTimeout(() => setConversionSuccess(null), 8000)
    }
  }

  // Create new lead handler
  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault()
    const fullName = `${newLeadFirstName.trim()} ${newLeadLastName.trim()}`.trim()
    if (!fullName && !newLeadCompany.trim()) return

    const scoreMap = { high: 90, med: 72, low: 55 }
    const formattedVisa = newLeadType === "b2b" && Number(newLeadPositions) > 1
      ? `${newLeadVisa} (${newLeadPositions} postes)`
      : newLeadVisa

    const numValue = Number(newLeadValue) || 0

    const created: Lead = {
      id: `lead-${Date.now()}`,
      name: fullName || newLeadCompany,
      civility: newLeadCivility || null,
      firstName: newLeadFirstName,
      lastName: newLeadLastName,
      company: newLeadType === "b2b" ? newLeadCompany : undefined,
      type: newLeadType,
      visaType: formattedVisa,
      estimatedValue: numValue,
      score: scoreMap[newLeadFeasibility],
      scoreLabel: newLeadFeasibility,
      stage: "newLead",
      // Champ date en base : une phrase d'affichage y faisait échouer
      // l'enregistrement entier.
      lastContact: new Date().toISOString().slice(0, 10),
      email: newLeadEmail || "prospect@consulting.ca",
      phone: newLeadPhone || "",
      notes: newLeadNotes || "Fiche prospect créée depuis le pipeline CRM.",
      lmiaPositions: newLeadType === "b2b" ? Number(newLeadPositions) : undefined,
      source: newLeadSource,
      contactIntent: newLeadIntent,
    }

    const previous = leads
    setLeads([created, ...leads])

    try {
      await createLead(created)
    } catch (err) {
      // Sans ce retour en arrière, la carte restait affichée alors
      // qu'aucun prospect n'existait en base.
      setLeads(previous)
      notifyError(
        `Le prospect « ${created.company || created.name} » n'a pas pu être créé : ${
          err instanceof Error ? err.message : "erreur inconnue"
        }`
      )
    }

    setShowNewModal(false)
    // Réinitialisation des champs
    setNewLeadFirstName("")
    setNewLeadLastName("")
    setNewLeadCompany("")
    setNewLeadEmail("")
    setNewLeadPhone("")
    setNewLeadNotes("")
    setNewLeadValue("4500")

    setConversionSuccess(`Nouveau prospect "${created.company || created.name}" ajouté avec succès !`)
    setTimeout(() => setConversionSuccess(null), 4000)
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(val)
  }

  return (
    <div className="flex flex-col gap-8 pb-16">
      
      {/* 1. SUCCESS ALERT BANNER */}
      {pipelineError && (
        <div
          role="alert"
          className="bg-error/15 border border-error/40 text-error-strong rounded-3xl p-4 flex items-center gap-3 shadow-md animate-fadeIn"
        >
          <AlertCircle className="w-5 h-5 text-error-strong shrink-0" />
          <span className="font-bold text-xs sm:text-sm">{pipelineError}</span>
        </div>
      )}

      {conversionSuccess && (
        <div className="bg-success/15 border border-success/40 text-success-strong rounded-3xl p-4 flex items-center justify-between shadow-md animate-fadeIn">
          <div className="flex items-center gap-3 font-bold text-xs sm:text-sm">
            <CheckCircle2 className="w-5 h-5 text-success-strong shrink-0" />
            <span>{conversionSuccess}</span>
          </div>
          <Link 
            href="/matters" 
            className="inline-flex items-center gap-1.5 text-xs font-black bg-success text-background px-4 py-2 rounded-2xl hover:bg-success/90 transition-colors shadow-xs"
          >
            <span>Voir dans Mes Dossiers</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      <PageHeader
        title={t.title}
        subtitle={t.subtitle}
        action={
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleResetPipeline}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-muted hover:bg-muted text-foreground border border-border px-3.5 py-2.5 text-xs font-bold transition-all cursor-pointer shadow-2xs"
              title="Réinitialiser le pipeline aux opportunités initiales"
            >
              <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">Réinitialiser</span>
            </button>

            <button 
              type="button"
              onClick={() => setShowNewModal(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>{t.actions.newProspect}</span>
            </button>
          </div>
        }
      />

      {/* 3. EXECUTIVE KPI CARDS AVEC SURBRILLANCE ACTIVE & FILTRAGE PAR CLIC */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* KPI 1: VALEUR PIPELINE */}
        <div 
          role="button"
          tabIndex={0}
          onClick={() => setFilterType("all")}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setFilterType("all") }}
          className={`rounded-3xl p-6 border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
            filterType === "all"
              ? "bg-primary/15 border-primary/40 shadow-lg scale-[1.02] ring-2 ring-primary"
              : "bg-card border-border hover:border-primary/40 shadow-[0_4px_20px_rgba(0,0,0,0.02)]"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-foreground">{t.stats.totalValue}</span>
            <div className="h-9 w-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold shadow-md">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            {/* En neutre et non en accent : sélectionnée, cette carte se teinte
                de l'accent, et l'accent sur l'accent tombait à 4,36:1. Le
                chiffre tire déjà sa force de sa taille et de sa graisse. */}
            <div className="text-3xl font-black text-foreground tracking-tight">{formatCurrency(totalValue)}</div>
            <span className="text-xs font-bold text-foreground/70 mt-1">Estimation totale des honoraires</span>
          </div>
        </div>

        {/* KPI 2: PROSPECTS QUALIFIÉS */}
        <div 
          onClick={() => setFilterType("all")}
          className="bg-gradient-to-br from-primary/10 via-card to-primary/10 rounded-3xl p-6 border border-primary/40 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:border-primary/40 cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-foreground">{t.stats.activeLeads}</span>
            <div className="h-9 w-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold shadow-md">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-foreground tracking-tight">{activeLeadsCount}</div>
            <span className="text-xs font-bold text-foreground/70 mt-1">Prospects en cours de qualification</span>
          </div>
        </div>

        {/* KPI 3: TAUX DE CONVERSION (CLIC -> FILTRE SCORE ÉLEVÉ) */}
        <div
          onClick={() => setFilterType(filterType === "signed" ? "all" : "signed")}
          className={`rounded-3xl p-6 border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
            filterType === "signed"
              ? "bg-success/15 border-success/40 shadow-lg scale-[1.02] ring-2 ring-success"
              : "bg-card border-border hover:border-success/40 shadow-[0_4px_20px_rgba(0,0,0,0.02)]"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-foreground">{t.stats.conversionRate}</span>
            <div className="h-9 w-9 rounded-xl bg-success text-background flex items-center justify-center font-bold shadow-md">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-success-strong tracking-tight">{conversionRate}%</div>
            <span className="text-xs font-bold text-foreground/70 mt-1">
              {tPipeline("stats.conversionBasis", { signed: signedCount, total: activeLeadsCount })}
            </span>
          </div>
        </div>

        {/* KPI 4: CONTRATS B2B (CLIC -> FILTRE B2B) */}
        <div 
          onClick={() => setFilterType(filterType === "b2b" ? "all" : "b2b")}
          className={`rounded-3xl p-6 border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
            filterType === "b2b"
              ? "bg-accent/10 border-accent shadow-lg scale-[1.02] ring-2 ring-accent/30"
              : "bg-card border-border hover:border-accent/40 shadow-[0_4px_20px_rgba(0,0,0,0.02)]"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-foreground">{t.stats.b2bShare}</span>
            <div className="h-9 w-9 rounded-xl bg-accent text-accent-foreground flex items-center justify-center font-bold shadow-md">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-accent-strong tracking-tight">{b2bShare}%</div>
            <span className="text-xs font-bold text-foreground/70 mt-1">Filtrer les Contrats B2B</span>
          </div>
        </div>

      </div>

      {/* 4. FILTER AND SEARCH BAR */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-card p-4 rounded-3xl border border-border shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-1 bg-muted p-1 rounded-2xl w-full sm:w-auto overflow-x-auto">
          <button
            type="button"
            onClick={() => setFilterType("all")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${filterType === "all" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t.filters.all} ({leads.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType("b2b")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${filterType === "b2b" ? "bg-accent text-accent-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>{t.filters.b2b} ({b2bCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterType("b2c")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${filterType === "b2c" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
          >
            <User className="w-3.5 h-3.5" />
            <span>{t.filters.b2c} ({leads.length - b2bCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterType("high")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${filterType === "high" ? "bg-success text-background shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
          >
            <span>Score Élevé (&gt;85%)</span>
          </button>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder={t.filters.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-xs font-medium rounded-2xl bg-muted border border-border focus:bg-card focus:border-primary/40 focus:outline-none transition-all"
          />
        </div>
      </div>

      {/* 5. 5-COLUMN KANBAN BOARD AVEC DRAG & DROP NATIF HTML5 & BADGES PRATICABILITÉ CICC */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-start overflow-x-auto pb-4">
        {STAGE_ORDER.map((stageKey) => {
          const columnLeads = filteredLeads.filter(l => l.stage === stageKey)
          const columnTotal = columnLeads.reduce((acc, l) => acc + l.estimatedValue, 0)
          const isDragOver = dragOverStage === stageKey
          const cfg = getStageHeaderConfig(stageKey)
          
          return (
            <div 
              key={stageKey} 
              onDragOver={(e) => handleDragOver(e, stageKey)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, stageKey)}
              className={`p-3.5 rounded-3xl border transition-all flex flex-col gap-3 min-w-[260px] shadow-2xs ${cfg.borderLeft} ${
                isDragOver ? "bg-primary/15 border-primary/40 ring-2 ring-primary scale-[1.01]" : "bg-muted/50 border-border"
              }`}
            >
              {/* EN-TÊTE DE COLONNE HAUTEMENT MIS EN VALEUR STYLE LINEAR/NOTION */}
              <div className={`p-3 rounded-2xl border border-border shadow-2xs ${cfg.bgGradient} flex items-center justify-between`}>
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${cfg.dotBg}`} />
                  <div>
                    <h3 className="font-black text-xs text-foreground tracking-tight">
                      {cfg.title}
                    </h3>
                    <span className={`text-[10px] font-mono font-extrabold ${cfg.textAccent} block mt-0.5`}>
                      {formatCurrency(columnTotal)}
                    </span>
                  </div>
                </div>

                <span className={`w-6 h-6 rounded-xl flex items-center justify-center text-xs font-black ${cfg.badgeBg}`}>
                  {columnLeads.length}
                </span>
              </div>

              {/* Lead Cards List */}
              <div className="flex flex-col gap-3 min-h-[120px]">
                {columnLeads.map((lead) => (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, lead.id)}
                    onClick={() => setSelectedLead(lead)}
                    className="bg-card p-4 rounded-2xl border border-border shadow-2xs hover:shadow-md hover:border-primary/40 hover:-translate-y-0.5 transition-all duration-200 cursor-grab active:cursor-grabbing flex flex-col gap-3 group relative overflow-hidden"
                  >
                    {/* Header Carte avec Grip Icon */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-1.5">
                        <GripVertical className="w-3.5 h-3.5 text-muted-foreground group-hover:text-muted-foreground shrink-0 mt-0.5" />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${lead.type === "b2b" ? "bg-accent" : "bg-primary"}`} />
                            <span className="font-black text-xs text-foreground group-hover:text-primary-strong transition-colors">
                              {lead.company || nomAvecCivilite(lead)}
                            </span>
                          </div>
                          {lead.company && (
                            <span className="text-[11px] font-semibold text-muted-foreground block mt-0.5">
                              Contact : {nomAvecCivilite(lead)}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteLead(lead.id, e)}
                        title="Supprimer le prospect"
                        className="text-muted-foreground hover:text-error-strong p-1 rounded-md transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="text-[11px] font-bold text-foreground bg-muted p-2 rounded-xl border border-border">
                      {lead.visaType}
                    </div>

                    {/* BADGE DE PRATICABILITÉ CICC ET BOUTONS DE CONTACT DIRECT (AXE 2) */}
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                        lead.score >= 85 ? "bg-success/15 text-success-strong border-success/40" :
                        lead.score >= 70 ? "bg-warning/15 text-warning-strong border-warning/40" :
                        "bg-muted text-muted-foreground border-border"
                      }`}>
                        <span>Praticabilité : {lead.score}%</span>
                      </span>

                      {/* Raccourcis Courriel & Appel */}
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <a
                          href={`mailto:${lead.email}`}
                          title={`Envoyer un courriel à ${lead.email}`}
                          className="p-1 text-muted-foreground hover:text-accent-strong hover:bg-accent/10 rounded-lg transition-colors"
                        >
                          <Mail className="w-3.5 h-3.5" />
                        </a>
                        <a
                          href={`tel:${lead.phone}`}
                          title={`Appeler au ${lead.phone}`}
                          className="p-1 text-muted-foreground hover:text-primary-strong hover:bg-primary/10 rounded-lg transition-colors"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>

                    {/* Footer Montant & Flèches */}
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <span className="font-mono font-black text-foreground text-xs">
                        {formatCurrency(lead.estimatedValue)}
                      </span>

                      <div className="flex items-center gap-1">
                        {STAGE_ORDER.indexOf(lead.stage) > 0 && (
                          <button
                            type="button"
                            onClick={(e) => moveLead(lead.id, "left", e)}
                            title="Reculer d'étape"
                            className="p-1 rounded-lg bg-muted hover:bg-muted text-muted-foreground transition-colors cursor-pointer"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {STAGE_ORDER.indexOf(lead.stage) < STAGE_ORDER.length - 1 && (
                          <button
                            type="button"
                            onClick={(e) => moveLead(lead.id, "right", e)}
                            title="Avancer d'étape"
                            className="p-1 rounded-lg bg-primary/15 hover:bg-primary/10 text-primary-strong transition-colors cursor-pointer"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                  </div>
                ))}
              </div>

            </div>
          )
        })}
      </div>

      {/* MODAL 1 : DÉTAILS PROSPECT & ÉDITION & CONVERSION MANDAT CICC */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 backdrop-blur-md p-4 animate-fadeIn overflow-y-auto">
          <div className="bg-card w-full max-w-2xl rounded-3xl border border-border shadow-2xl p-6 sm:p-8 flex flex-col gap-6 relative overflow-hidden my-8 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="bg-accent/15 text-accent-strong border border-accent/40 font-mono text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                    Praticabilité CICC : {selectedLead.score}% ({selectedLead.scoreLabel.toUpperCase()})
                  </span>
                  <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                    selectedLead.type === "b2b" ? "bg-accent/10 text-accent-strong border-accent/30" : "bg-primary/15 text-primary-strong border-primary/40"
                  }`}>
                    {selectedLead.type === "b2b" ? "Employeur (B2B)" : "Particulier (B2C)"}
                  </span>
                </div>
                <h3 className="text-xl font-black text-foreground">{selectedLead.company || selectedLead.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedLead(null)
                  setIsEditingSelectedLead(false)
                }}
                className="w-8 h-8 rounded-full bg-muted hover:bg-muted text-muted-foreground font-bold flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* SI MODE ÉDITION ACTIF */}
            {isEditingSelectedLead ? (
              <form onSubmit={handleSaveEditLead} className="flex flex-col gap-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-extrabold text-muted-foreground uppercase tracking-wider">Nom complet / Contact</label>
                    <input
                      type="text"
                      required
                      value={editLeadName}
                      onChange={(e) => setEditLeadName(e.target.value)}
                      className="w-full px-3.5 py-2 font-medium rounded-xl border border-border bg-card focus:outline-none focus:border-primary/40"
                    />
                  </div>

                  {selectedLead.type === "b2b" && (
                    <div className="flex flex-col gap-1.5">
                      <label className="font-extrabold text-muted-foreground uppercase tracking-wider">Raison Sociale de l&apos;Entreprise</label>
                      <input
                        type="text"
                        required
                        value={editLeadCompany}
                        onChange={(e) => setEditLeadCompany(e.target.value)}
                        className="w-full px-3.5 py-2 font-medium rounded-xl border border-border bg-card focus:outline-none focus:border-primary/40"
                      />
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5">
                    <label className="font-extrabold text-muted-foreground uppercase tracking-wider">Courriel</label>
                    <input
                      type="email"
                      required
                      value={editLeadEmail}
                      onChange={(e) => setEditLeadEmail(e.target.value)}
                      className="w-full px-3.5 py-2 font-medium rounded-xl border border-border bg-card focus:outline-none focus:border-primary/40"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-extrabold text-muted-foreground uppercase tracking-wider">Téléphone</label>
                    <input
                      type="tel"
                      required
                      value={editLeadPhone}
                      onChange={(e) => setEditLeadPhone(e.target.value)}
                      className="w-full px-3.5 py-2 font-medium rounded-xl border border-border bg-card focus:outline-none focus:border-primary/40"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <label className="font-extrabold text-muted-foreground uppercase tracking-wider">Programme ou Service Souhaité</label>
                    <select
                      value={editLeadVisa}
                      onChange={(e) => setEditLeadVisa(e.target.value)}
                      className="w-full px-3.5 py-2 font-medium rounded-xl border border-border bg-card focus:outline-none focus:border-primary/40"
                    >
                      {PROGRAM_GROUPS.map((group) => (
                        <optgroup key={group.label} label={group.label}>
                          {group.options.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-extrabold text-muted-foreground uppercase tracking-wider">Valeur Estimée ($ CAD)</label>
                    <input
                      type="number"
                      min="0"
                      step="50"
                      required
                      value={editLeadValue}
                      onChange={(e) => setEditLeadValue(e.target.value)}
                      className="w-full px-3.5 py-2 font-mono font-bold rounded-xl border border-primary/40 bg-primary/15 focus:outline-none focus:border-primary/40"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-extrabold text-muted-foreground uppercase tracking-wider">Praticabilité CICC</label>
                    <select
                      value={editLeadScoreLabel}
                      onChange={(e) => setEditLeadScoreLabel(e.target.value as "high" | "med" | "low")}
                      className="w-full px-3.5 py-2 font-medium rounded-xl border border-border bg-card focus:outline-none focus:border-primary/40"
                    >
                      <option value="high">Haute (90%) - Dossier Solide</option>
                      <option value="med">Moyenne (72%) - Analyse Requise</option>
                      <option value="low">Faible (55%) - Risque d&apos;Admissibilité</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <label className="font-extrabold text-muted-foreground uppercase tracking-wider">Notes & Remarques</label>
                    <textarea
                      rows={3}
                      value={editLeadNotes}
                      onChange={(e) => setEditLeadNotes(e.target.value)}
                      className="w-full px-3.5 py-2 font-medium rounded-xl border border-border bg-card focus:outline-none focus:border-primary/40"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setIsEditingSelectedLead(false)}
                    className="px-4 py-2 rounded-xl border border-border font-bold text-muted-foreground hover:bg-muted cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
                  >
                    <Check className="w-4 h-4" />
                    <span>Enregistrer les Modifications</span>
                  </button>
                </div>
              </form>
            ) : (
              /* MODE AFFICHAGE NORMAL */
              <>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="bg-muted p-3.5 rounded-2xl border border-border">
                    <span className="text-muted-foreground font-semibold block">Courriel du prospect</span>
                    <strong className="text-foreground font-mono">{selectedLead.email}</strong>
                  </div>

                  <div className="bg-muted p-3.5 rounded-2xl border border-border">
                    <span className="text-muted-foreground font-semibold block">Téléphone</span>
                    <strong className="text-foreground font-mono">{selectedLead.phone}</strong>
                  </div>

                  <div className="bg-muted p-3.5 rounded-2xl border border-border">
                    <span className="text-muted-foreground font-semibold block">Programme / Service Souhaité</span>
                    <strong className="text-foreground">{selectedLead.visaType}</strong>
                  </div>

                  <div className="bg-muted p-3.5 rounded-2xl border border-primary/40 bg-primary/15">
                    <span className="text-muted-foreground font-semibold block">Valeur estimée des honoraires</span>
                    <strong className="text-primary-strong font-mono text-base">{formatCurrency(selectedLead.estimatedValue)} CAD</strong>
                  </div>
                </div>

                <div className="bg-muted p-4 rounded-2xl border border-border text-xs">
                  <span className="text-muted-foreground font-semibold block mb-1">Notes de consultation & praticabilité :</span>
                  <p className="text-foreground leading-relaxed font-medium">{selectedLead.notes}</p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => handleDeleteLead(selectedLead.id, e)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border border-error/40 text-xs font-bold text-error-strong hover:bg-error/10 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Supprimer</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleStartEditLead}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border border-border text-xs font-bold text-foreground hover:bg-muted transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-primary-strong" />
                      <span>Éditer la Fiche</span>
                    </button>
                  </div>

                  {/* La conversion n'est proposée qu'à l'étape « entente
                      signée » : c'est le moment où naissent le mandat, le
                      fidéicommis et l'obligation de tenue de dossier. */}
                  <button
                    type="button"
                    onClick={() => handleConvertToMatter(selectedLead)}
                    disabled={isConverting}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-success hover:bg-success/90 text-background text-xs font-bold shadow-md transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isConverting ? "Conversion…" : "Convertir en client"}</span>
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}

      {/* MODAL 2 : CREATION STRUCTURÉE DE PROSPECT (MOTIF, SERVICE & HONORAIRES ÉDITABLES) */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 backdrop-blur-sm p-4 animate-fadeIn overflow-y-auto">
          <form
            onSubmit={handleCreateLead}
            className="bg-card w-full max-w-2xl rounded-2xl border border-border shadow-2xl p-6 sm:p-8 flex flex-col gap-6 relative overflow-hidden my-8 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <span className="inline-block bg-primary/15 text-primary border border-primary/30 font-mono text-[11px] font-bold px-2.5 py-0.5 rounded-full mb-1">
                  Nouveau Prospect CRM
                </span>
                <h3 className="text-xl font-extrabold text-foreground">Ajouter un Prospect (Avant-Mandat)</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="w-8 h-8 rounded-full bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground font-bold flex items-center justify-center transition-all cursor-pointer"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* SECTION 1 : TYPE DE PROSPECT ET MOTIF DE CONTACT */}
            <div className="flex flex-col gap-3.5 bg-muted/40 p-4 rounded-xl border border-border">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold text-foreground/80 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-primary" />
                  <span>1. Motif de contact & Intention du client</span>
                </label>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Option 1: Renseignements */}
                <button
                  type="button"
                  onClick={() => handleIntentChange("info")}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 relative ${
                    newLeadIntent === "info"
                      ? "bg-primary/10 border-2 border-primary shadow-xs"
                      : "bg-card text-foreground border-border hover:border-primary/40 hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Info className={`w-4 h-4 shrink-0 ${newLeadIntent === "info" ? "text-primary" : "text-muted-foreground"}`} />
                      <span className={newLeadIntent === "info" ? "text-primary font-extrabold" : "text-foreground font-bold"}>
                        Renseignements
                      </span>
                    </div>
                    {newLeadIntent === "info" && (
                      <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px]">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground font-normal leading-tight">
                    S&apos;informe sur le cabinet et nos services (0 $)
                  </span>
                </button>

                {/* Option 2: Consultation Initiale */}
                <button
                  type="button"
                  onClick={() => handleIntentChange("consultation")}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 relative ${
                    newLeadIntent === "consultation"
                      ? "bg-amber-500/10 border-2 border-amber-500 shadow-xs"
                      : "bg-card text-foreground border-border hover:border-amber-500/40 hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <MessageSquare className={`w-4 h-4 shrink-0 ${newLeadIntent === "consultation" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`} />
                      <span className={newLeadIntent === "consultation" ? "text-amber-700 dark:text-amber-400 font-extrabold" : "text-foreground font-bold"}>
                        Consultation Initiale
                      </span>
                    </div>
                    {newLeadIntent === "consultation" && (
                      <span className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px]">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground font-normal leading-tight">
                    Évaluation d&apos;orientation du dossier (tarif cabinet)
                  </span>
                </button>

                {/* Option 3: Mandat Complet */}
                <button
                  type="button"
                  onClick={() => handleIntentChange("mandate")}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 relative ${
                    newLeadIntent === "mandate"
                      ? "bg-emerald-500/10 border-2 border-emerald-500 shadow-xs"
                      : "bg-card text-foreground border-border hover:border-emerald-500/40 hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Briefcase className={`w-4 h-4 shrink-0 ${newLeadIntent === "mandate" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`} />
                      <span className={newLeadIntent === "mandate" ? "text-emerald-700 dark:text-emerald-400 font-extrabold" : "text-foreground font-bold"}>
                        Mandat Complet
                      </span>
                    </div>
                    {newLeadIntent === "mandate" && (
                      <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px]">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground font-normal leading-tight">
                    Procédure IRCC & mandat de représentation
                  </span>
                </button>
              </div>

              <div className="flex items-center gap-4 pt-2 border-t border-border/60">
                <span className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">Catégorie :</span>
                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer text-foreground">
                  <input
                    type="radio"
                    name="leadType"
                    checked={newLeadType === "b2c"}
                    onChange={() => setNewLeadType("b2c")}
                    className="accent-primary focus:ring-0 cursor-pointer"
                  />
                  <span>Candidat / Particulier (B2C)</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer text-foreground">
                  <input
                    type="radio"
                    name="leadType"
                    checked={newLeadType === "b2b"}
                    onChange={() => setNewLeadType("b2b")}
                    className="accent-amber-500 focus:ring-0 cursor-pointer"
                  />
                  <span>Employeur / Entreprise (B2B)</span>
                </label>
              </div>
            </div>

            {/* SECTION 2 : COORDONNÉES IDENTITÉ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* La civilité vient AVANT le prénom : c'est l'ordre dans lequel
                  on s'adresse à quelqu'un, et l'ordre dans lequel elle sera
                  imprimée sur l'entente de service. Facultative — on ne la
                  connaît pas toujours au premier appel, et l'imposer ferait
                  inventer une réponse qui finirait sur un document. */}
              <div className="flex flex-col gap-1.5 sm:col-span-2 sm:max-w-[14rem]">
                <label htmlFor="civilite-prospect" className="text-xs font-extrabold text-foreground/80 uppercase tracking-wider flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Civilité</span>
                </label>
                <SelecteurCivilite id="civilite-prospect" valeur={newLeadCivility} onChange={setNewLeadCivility} />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-foreground/80 uppercase tracking-wider flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Prénom *</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: Sami"
                  value={newLeadFirstName}
                  onChange={(e) => setNewLeadFirstName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-medium rounded-xl bg-muted/50 border border-border focus:bg-card focus:border-primary focus:outline-none transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-foreground/80 uppercase tracking-wider flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Nom de Famille *</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex : Nom de famille"
                  value={newLeadLastName}
                  onChange={(e) => setNewLeadLastName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-medium rounded-xl bg-muted/50 border border-border focus:bg-card focus:border-primary focus:outline-none transition-all"
                />
              </div>

              {newLeadType === "b2b" && (
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label className="text-xs font-extrabold text-foreground/80 uppercase tracking-wider flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Raison Sociale de l&apos;Entreprise *</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ex : Nom de l'entreprise"
                    value={newLeadCompany}
                    onChange={(e) => setNewLeadCompany(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs font-medium rounded-xl bg-muted/50 border border-border focus:bg-card focus:border-primary focus:outline-none transition-all"
                  />
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-foreground/80 uppercase tracking-wider flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Courriel *</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="courriel@exemple.com"
                  value={newLeadEmail}
                  onChange={(e) => setNewLeadEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-medium rounded-xl bg-muted/50 border border-border focus:bg-card focus:border-primary focus:outline-none transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-foreground/80 uppercase tracking-wider flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Téléphone *</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="+1 (514) 000-0000"
                  value={newLeadPhone}
                  onChange={(e) => setNewLeadPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-medium rounded-xl bg-muted/50 border border-border focus:bg-card focus:border-primary focus:outline-none transition-all"
                />
              </div>

              {/* SECTION 3 : PROGRAMME ET HONORAIRES ESTIMÉS ÉDITABLE */}
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-xs font-extrabold text-foreground/80 uppercase tracking-wider flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Programme IRCC ou Service Souhaité</span>
                </label>
                <select
                  value={newLeadVisa}
                  onChange={(e) => handleVisaChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl bg-muted/50 border border-border focus:bg-card focus:border-primary focus:outline-none transition-all cursor-pointer"
                >
                  {PROGRAM_GROUPS.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* CHAMP MONTANT ESTIMÉ 100% MODIFIABLE */}
              <div className="flex flex-col gap-2.5 sm:col-span-2 bg-primary/10 p-4 rounded-xl border border-primary/30">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <label className="text-xs font-extrabold text-primary uppercase tracking-wider flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-primary" />
                    <span>Valeur Estimée des Honoraires ($ CAD)</span>
                  </label>
                  <span className="text-[11px] text-muted-foreground font-semibold">Montant éditable selon votre barème</span>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    step="50"
                    required
                    value={newLeadValue}
                    onChange={(e) => setNewLeadValue(e.target.value)}
                    placeholder="Saisissez le montant en CAD"
                    className="flex-1 px-4 py-2.5 text-sm font-mono font-black rounded-xl bg-card border border-primary/40 focus:border-primary focus:outline-none transition-all text-foreground shadow-xs"
                  />
                  <span className="font-mono font-black text-xs text-primary px-2.5 py-1.5 bg-card border border-border rounded-lg">CAD $</span>
                </div>

                {/* BOUTONS PRÉRÉGLAGES RAPIDES */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[10px] font-bold text-muted-foreground">Suggestions rapides :</span>
                  {["0", "150", "1800", "2500", "3800", "4500", "5000", "6500"].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setNewLeadValue(val)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
                        newLeadValue === val
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "bg-card text-foreground border border-border hover:bg-primary/10"
                      }`}
                    >
                      {val === "0" ? "0 $ (Info)" : val === "150" ? "150 $ (Consultation)" : `${val} $`}
                    </button>
                  ))}
                </div>
              </div>

              {/* SECTION 4 : PRATICABILITÉ & NOTES */}
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-xs font-extrabold text-foreground/80 uppercase tracking-wider flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Praticabilité Initiale CICC</span>
                </label>
                <select
                  value={newLeadFeasibility}
                  onChange={(e) => setNewLeadFeasibility(e.target.value as "high" | "med" | "low")}
                  className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl bg-muted/50 border border-border focus:bg-card focus:border-primary focus:outline-none transition-all cursor-pointer"
                >
                  <option value="high">Haute (90%) - Profil Très Favorable</option>
                  <option value="med">Moyenne (72%) - Analyse Requise</option>
                  <option value="low">Faible (55%) - Risque / Refus Antérieur</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-xs font-extrabold text-foreground/80 uppercase tracking-wider flex items-center gap-1">
                  <Edit3 className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Notes & Remarques Initiales</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Précisions sur la situation du prospect, questions posées ou objectifs..."
                  value={newLeadNotes}
                  onChange={(e) => setNewLeadNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-medium rounded-xl bg-muted/50 border border-border focus:bg-card focus:border-primary focus:outline-none transition-all"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="px-5 py-2.5 rounded-xl border border-border text-xs font-bold text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button 
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold shadow-md transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Créer la Fiche Prospect</span>
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  )
}

