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
  Sparkles, 
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
  MessageSquare
} from "lucide-react"
import { useTranslations } from "next-intl"
import { Link, useRouter } from "@/i18n/routing"
import { Lead } from "@/lib/data/types"
import { PageHeader } from "@/components/app-shell/page-header"
import { matchesPerson } from "@/lib/utils/search"
import { createLead, updateLead, moveLeadStage, convertLeadToClient } from "@/lib/data/actions"

export type { Lead }

export const PROGRAM_GROUPS = [
  {
    label: "Information & Renseignements",
    options: [
      { value: "Renseignements Généraux Cabinet", label: "Renseignements Généraux sur le Cabinet", defaultPrice: 0 },
      { value: "Consultation Initiale d'Évaluation", label: "Consultation Initiale d'Évaluation (Payante)", defaultPrice: 150 },
      { value: "Analyse de Refus & Conseils IRCC", label: "Analyse d'un Refus IRCC & Recommandations", defaultPrice: 500 },
    ]
  },
  {
    label: "Résidence Permanente (IRCC / MIFI)",
    options: [
      { value: "Résidence Permanente (Entrée Express)", label: "Entrée Express (FSW / CEC / FST)", defaultPrice: 4500 },
      { value: "PEQ - Expérience Québécoise", label: "PEQ - Programme de l'Expérience Québécoise", defaultPrice: 4200 },
      { value: "PRTQ - Travailleurs Qualifiés Québec", label: "PRTQ - Travailleurs Qualifiés Québec (MIFI)", defaultPrice: 4200 },
      { value: "Parrainage d'Époux / Conjoint / Famille", label: "Parrainage Familial (Conjoint / Enfants)", defaultPrice: 3800 },
      { value: "Programme Régional / PNP", label: "Programme des Candidats des Provinces (PCP/PNP)", defaultPrice: 4800 },
    ]
  },
  {
    label: "Résidence Temporaire (Visas & Permis)",
    options: [
      { value: "Permis d'Études & CAQ", label: "Permis d'Études & CAQ Québec", defaultPrice: 2500 },
      { value: "EIMT / Permis de Travail (LMIA)", label: "EIMT & Permis de Travail (LMIA)", defaultPrice: 4500 },
      { value: "Visa de Visiteur / AVE / Super Visa", label: "Visa de Visiteur / AVE / Super Visa Parents", defaultPrice: 1800 },
      { value: "Prolongation de Statut / Rétablissement", label: "Prolongation de Statut ou Rétablissement", defaultPrice: 1500 },
    ]
  },
  {
    label: "Services aux Employeurs (B2B)",
    options: [
      { value: "EIMT - Recrutement International", label: "EIMT Volet Haute-Basse Rémunération", defaultPrice: 6500 },
      { value: "Conformité Employeur IRCC", label: "Audit de Conformité Employeur & Inspection IRCC", defaultPrice: 3500 },
    ]
  }
]


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
        bgGradient: "bg-gradient-to-r from-blue-500/10 via-sky-500/5 to-transparent",
        badgeBg: "bg-blue-600 text-white font-mono shadow-2xs",
        dotBg: "bg-blue-500 animate-pulse",
        textAccent: "text-blue-700"
      }
    case "consultation":
      return {
        title: "Consultation Planifiée",
        borderLeft: "border-l-4 border-l-purple-600",
        bgGradient: "bg-gradient-to-r from-purple-500/10 via-indigo-500/5 to-transparent",
        badgeBg: "bg-purple-600 text-white font-mono shadow-2xs",
        dotBg: "bg-purple-500",
        textAccent: "text-purple-700"
      }
    case "proposal":
      return {
        title: "Proposition Transmise",
        borderLeft: "border-l-4 border-l-amber-500",
        bgGradient: "bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-transparent",
        badgeBg: "bg-amber-500 text-slate-950 font-mono shadow-2xs",
        dotBg: "bg-amber-500",
        textAccent: "text-amber-700"
      }
    case "negotiation":
      return {
        title: "Négociation & Révision",
        borderLeft: "border-l-4 border-l-orange-500",
        bgGradient: "bg-gradient-to-r from-orange-500/10 via-rose-500/5 to-transparent",
        badgeBg: "bg-orange-600 text-white font-mono shadow-2xs",
        dotBg: "bg-orange-500",
        textAccent: "text-orange-700"
      }
    case "signed":
      return {
        title: "Mandat Signé CICC",
        borderLeft: "border-l-4 border-l-emerald-600",
        bgGradient: "bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent",
        badgeBg: "bg-emerald-600 text-white font-mono shadow-2xs",
        dotBg: "bg-emerald-500",
        textAccent: "text-emerald-700"
      }
    default:
      return {
        title: stage,
        borderLeft: "border-l-4 border-l-slate-400",
        bgGradient: "bg-slate-100",
        badgeBg: "bg-slate-700 text-white font-mono shadow-2xs",
        dotBg: "bg-slate-400",
        textAccent: "text-slate-700"
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
      const { client, alreadyConverted } = await convertLeadToClient(lead.id)
      setConversionSuccess(
        alreadyConverted
          ? `« ${lead.company || lead.name} » était déjà converti — dossier ${client.fileNumber}.`
          : `Client « ${client.name} » créé sous le dossier ${client.fileNumber}. Le prospect est conservé et marqué converti.`
      )
      // Le prospect reste dans le pipeline, à l'étape signée : on perdrait
      // sinon l'historique du cycle de vente.
      setLeads(leads.map(l => (l.id === lead.id ? { ...l, stage: "signed" as const } : l)))
      setSelectedLead(null)
      setIsEditingSelectedLead(false)
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
          className="bg-rose-50 border border-rose-200 text-rose-900 rounded-3xl p-4 flex items-center gap-3 shadow-md animate-fadeIn"
        >
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span className="font-bold text-xs sm:text-sm">{pipelineError}</span>
        </div>
      )}

      {conversionSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-3xl p-4 flex items-center justify-between shadow-md animate-fadeIn">
          <div className="flex items-center gap-3 font-bold text-xs sm:text-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{conversionSuccess}</span>
          </div>
          <Link 
            href="/matters" 
            className="inline-flex items-center gap-1.5 text-xs font-black bg-emerald-600 text-white px-4 py-2 rounded-2xl hover:bg-emerald-700 transition-colors shadow-xs"
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
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 px-3.5 py-2.5 text-xs font-bold transition-all cursor-pointer shadow-2xs"
              title="Réinitialiser le pipeline aux opportunités initiales"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
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
              ? "bg-blue-50/90 border-blue-500 shadow-lg scale-[1.02] ring-2 ring-blue-400/30"
              : "bg-white border-slate-200/80 hover:border-blue-300 shadow-[0_4px_20px_rgba(0,0,0,0.02)]"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-900">{t.stats.totalValue}</span>
            <div className="h-9 w-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-600/20">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-blue-600 tracking-tight">{formatCurrency(totalValue)}</div>
            <span className="text-xs font-bold text-slate-600 mt-1">Estimation totale des honoraires</span>
          </div>
        </div>

        {/* KPI 2: PROSPECTS QUALIFIÉS */}
        <div 
          onClick={() => setFilterType("all")}
          className="bg-gradient-to-br from-indigo-50/90 via-white to-indigo-50/30 rounded-3xl p-6 border border-indigo-200 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:border-indigo-400 cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-900">{t.stats.activeLeads}</span>
            <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-indigo-600/20">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-slate-900 tracking-tight">{activeLeadsCount}</div>
            <span className="text-xs font-bold text-slate-600 mt-1">Prospects en cours de qualification</span>
          </div>
        </div>

        {/* KPI 3: TAUX DE CONVERSION (CLIC -> FILTRE SCORE ÉLEVÉ) */}
        <div
          onClick={() => setFilterType(filterType === "signed" ? "all" : "signed")}
          className={`rounded-3xl p-6 border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
            filterType === "signed"
              ? "bg-emerald-50/90 border-emerald-500 shadow-lg scale-[1.02] ring-2 ring-emerald-400/30"
              : "bg-white border-slate-200/80 hover:border-emerald-300 shadow-[0_4px_20px_rgba(0,0,0,0.02)]"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-900">{t.stats.conversionRate}</span>
            <div className="h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-md shadow-emerald-600/20">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-emerald-600 tracking-tight">{conversionRate}%</div>
            <span className="text-xs font-bold text-slate-600 mt-1">
              {tPipeline("stats.conversionBasis", { signed: signedCount, total: activeLeadsCount })}
            </span>
          </div>
        </div>

        {/* KPI 4: CONTRATS B2B (CLIC -> FILTRE B2B) */}
        <div 
          onClick={() => setFilterType(filterType === "b2b" ? "all" : "b2b")}
          className={`rounded-3xl p-6 border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
            filterType === "b2b"
              ? "bg-purple-50/90 border-purple-500 shadow-lg scale-[1.02] ring-2 ring-purple-400/30"
              : "bg-white border-slate-200/80 hover:border-purple-300 shadow-[0_4px_20px_rgba(0,0,0,0.02)]"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-900">{t.stats.b2bShare}</span>
            <div className="h-9 w-9 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold shadow-md shadow-purple-600/20">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-purple-600 tracking-tight">{b2bShare}%</div>
            <span className="text-xs font-bold text-slate-600 mt-1">Filtrer les Contrats B2B</span>
          </div>
        </div>

      </div>

      {/* 4. FILTER AND SEARCH BAR */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl w-full sm:w-auto overflow-x-auto">
          <button
            type="button"
            onClick={() => setFilterType("all")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${filterType === "all" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
          >
            {t.filters.all} ({leads.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType("b2b")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${filterType === "b2b" ? "bg-purple-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>{t.filters.b2b} ({b2bCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterType("b2c")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${filterType === "b2c" ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
          >
            <User className="w-3.5 h-3.5" />
            <span>{t.filters.b2c} ({leads.length - b2bCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterType("high")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${filterType === "high" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Score Élevé (&gt;85%)</span>
          </button>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={t.filters.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-xs font-medium rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
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
                isDragOver ? "bg-blue-50/90 border-blue-500 ring-2 ring-blue-400/40 scale-[1.01]" : "bg-slate-50/70 border-slate-200/80"
              }`}
            >
              {/* EN-TÊTE DE COLONNE HAUTEMENT MIS EN VALEUR STYLE LINEAR/NOTION */}
              <div className={`p-3 rounded-2xl border border-slate-200/60 shadow-2xs ${cfg.bgGradient} flex items-center justify-between`}>
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${cfg.dotBg}`} />
                  <div>
                    <h3 className="font-black text-xs text-slate-900 tracking-tight">
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
                    className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-blue-400 hover:-translate-y-0.5 transition-all duration-200 cursor-grab active:cursor-grabbing flex flex-col gap-3 group relative overflow-hidden"
                  >
                    {/* Header Carte avec Grip Icon */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-1.5">
                        <GripVertical className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 shrink-0 mt-0.5" />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${lead.type === "b2b" ? "bg-purple-600" : "bg-blue-600"}`} />
                            <span className="font-black text-xs text-slate-900 group-hover:text-blue-600 transition-colors">
                              {lead.company || lead.name}
                            </span>
                          </div>
                          {lead.company && (
                            <span className="text-[11px] font-semibold text-slate-600 block mt-0.5">
                              Contact : {lead.name}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteLead(lead.id, e)}
                        title="Supprimer le prospect"
                        className="text-slate-300 hover:text-rose-600 p-1 rounded-md transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="text-[11px] font-bold text-slate-700 bg-slate-50 p-2 rounded-xl border border-slate-100">
                      {lead.visaType}
                    </div>

                    {/* BADGE DE PRATICABILITÉ CICC ET BOUTONS DE CONTACT DIRECT (AXE 2) */}
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                        lead.score >= 85 ? "bg-emerald-50 text-emerald-800 border-emerald-200" :
                        lead.score >= 70 ? "bg-amber-50 text-amber-800 border-amber-200" :
                        "bg-slate-100 text-slate-600 border-slate-200"
                      }`}>
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>Praticabilité : {lead.score}%</span>
                      </span>

                      {/* Raccourcis Courriel & Appel */}
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <a
                          href={`mailto:${lead.email}`}
                          title={`Envoyer un courriel à ${lead.email}`}
                          className="p-1 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                        >
                          <Mail className="w-3.5 h-3.5" />
                        </a>
                        <a
                          href={`tel:${lead.phone}`}
                          title={`Appeler au ${lead.phone}`}
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>

                    {/* Footer Montant & Flèches */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <span className="font-mono font-black text-slate-900 text-xs">
                        {formatCurrency(lead.estimatedValue)}
                      </span>

                      <div className="flex items-center gap-1">
                        {STAGE_ORDER.indexOf(lead.stage) > 0 && (
                          <button
                            type="button"
                            onClick={(e) => moveLead(lead.id, "left", e)}
                            title="Reculer d'étape"
                            className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {STAGE_ORDER.indexOf(lead.stage) < STAGE_ORDER.length - 1 && (
                          <button
                            type="button"
                            onClick={(e) => moveLead(lead.id, "right", e)}
                            title="Avancer d'étape"
                            className="p-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4 animate-fadeIn overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-3xl border border-slate-200 shadow-2xl p-6 sm:p-8 flex flex-col gap-6 relative overflow-hidden my-8 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="bg-purple-100 text-purple-900 border border-purple-300 font-mono text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                    Praticabilité CICC : {selectedLead.score}% ({selectedLead.scoreLabel.toUpperCase()})
                  </span>
                  <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                    selectedLead.type === "b2b" ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-blue-50 text-blue-700 border-blue-200"
                  }`}>
                    {selectedLead.type === "b2b" ? "Employeur (B2B)" : "Particulier (B2C)"}
                  </span>
                </div>
                <h3 className="text-xl font-black text-slate-900">{selectedLead.company || selectedLead.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedLead(null)
                  setIsEditingSelectedLead(false)
                }}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* SI MODE ÉDITION ACTIF */}
            {isEditingSelectedLead ? (
              <form onSubmit={handleSaveEditLead} className="flex flex-col gap-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-extrabold text-slate-500 uppercase tracking-wider">Nom complet / Contact</label>
                    <input
                      type="text"
                      required
                      value={editLeadName}
                      onChange={(e) => setEditLeadName(e.target.value)}
                      className="w-full px-3.5 py-2 font-medium rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-blue-600"
                    />
                  </div>

                  {selectedLead.type === "b2b" && (
                    <div className="flex flex-col gap-1.5">
                      <label className="font-extrabold text-slate-500 uppercase tracking-wider">Raison Sociale de l&apos;Entreprise</label>
                      <input
                        type="text"
                        required
                        value={editLeadCompany}
                        onChange={(e) => setEditLeadCompany(e.target.value)}
                        className="w-full px-3.5 py-2 font-medium rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5">
                    <label className="font-extrabold text-slate-500 uppercase tracking-wider">Courriel</label>
                    <input
                      type="email"
                      required
                      value={editLeadEmail}
                      onChange={(e) => setEditLeadEmail(e.target.value)}
                      className="w-full px-3.5 py-2 font-medium rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-blue-600"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-extrabold text-slate-500 uppercase tracking-wider">Téléphone</label>
                    <input
                      type="tel"
                      required
                      value={editLeadPhone}
                      onChange={(e) => setEditLeadPhone(e.target.value)}
                      className="w-full px-3.5 py-2 font-medium rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-blue-600"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <label className="font-extrabold text-slate-500 uppercase tracking-wider">Programme ou Service Souhaité</label>
                    <select
                      value={editLeadVisa}
                      onChange={(e) => setEditLeadVisa(e.target.value)}
                      className="w-full px-3.5 py-2 font-medium rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-blue-600"
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
                    <label className="font-extrabold text-slate-500 uppercase tracking-wider">Valeur Estimée ($ CAD)</label>
                    <input
                      type="number"
                      min="0"
                      step="50"
                      required
                      value={editLeadValue}
                      onChange={(e) => setEditLeadValue(e.target.value)}
                      className="w-full px-3.5 py-2 font-mono font-bold rounded-xl border border-blue-400 bg-blue-50/20 focus:outline-none focus:border-blue-600"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="font-extrabold text-slate-500 uppercase tracking-wider">Praticabilité CICC</label>
                    <select
                      value={editLeadScoreLabel}
                      onChange={(e) => setEditLeadScoreLabel(e.target.value as "high" | "med" | "low")}
                      className="w-full px-3.5 py-2 font-medium rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-blue-600"
                    >
                      <option value="high">Haute (90%) - Dossier Solide</option>
                      <option value="med">Moyenne (72%) - Analyse Requise</option>
                      <option value="low">Faible (55%) - Risque d&apos;Admissibilité</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <label className="font-extrabold text-slate-500 uppercase tracking-wider">Notes & Remarques</label>
                    <textarea
                      rows={3}
                      value={editLeadNotes}
                      onChange={(e) => setEditLeadNotes(e.target.value)}
                      className="w-full px-3.5 py-2 font-medium rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsEditingSelectedLead(false)}
                    className="px-4 py-2 rounded-xl border border-slate-300 font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
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
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                    <span className="text-slate-400 font-semibold block">Courriel du prospect</span>
                    <strong className="text-slate-900 font-mono">{selectedLead.email}</strong>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                    <span className="text-slate-400 font-semibold block">Téléphone</span>
                    <strong className="text-slate-900 font-mono">{selectedLead.phone}</strong>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                    <span className="text-slate-400 font-semibold block">Programme / Service Souhaité</span>
                    <strong className="text-slate-900">{selectedLead.visaType}</strong>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-blue-200 bg-blue-50/30">
                    <span className="text-slate-400 font-semibold block">Valeur estimée des honoraires</span>
                    <strong className="text-blue-600 font-mono text-base">{formatCurrency(selectedLead.estimatedValue)} CAD</strong>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs">
                  <span className="text-slate-400 font-semibold block mb-1">Notes de consultation & praticabilité :</span>
                  <p className="text-slate-700 leading-relaxed font-medium">{selectedLead.notes}</p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => handleDeleteLead(selectedLead.id, e)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border border-rose-200 text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Supprimer</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleStartEditLead}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                      <span>Éditer la Fiche</span>
                    </button>
                  </div>

                  {/* La conversion n'est proposée qu'à l'étape « entente
                      signée » : c'est le moment où naissent le mandat, le
                      fidéicommis et l'obligation de tenue de dossier. */}
                  <button
                    type="button"
                    onClick={() => handleConvertToMatter(selectedLead)}
                    disabled={isConverting || selectedLead.stage !== "signed"}
                    title={
                      selectedLead.stage !== "signed"
                        ? "Disponible une fois l'entente de services signée"
                        : undefined
                    }
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4 animate-fadeIn overflow-y-auto">
          <form
            onSubmit={handleCreateLead}
            className="bg-white w-full max-w-2xl rounded-3xl border border-slate-200 shadow-2xl p-6 sm:p-8 flex flex-col gap-6 relative overflow-hidden my-8 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="inline-block bg-blue-100 text-blue-900 border border-blue-300 font-mono text-[11px] font-bold px-2.5 py-0.5 rounded-full mb-1">
                  Nouveau Prospect CRM
                </span>
                <h3 className="text-xl font-black text-slate-900">Ajouter un Prospect (Avant-Mandat)</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* SECTION 1 : TYPE DE PROSPECT ET MOTIF DE CONTACT */}
            <div className="flex flex-col gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <label className="text-xs font-extrabold text-slate-600 uppercase tracking-wider">
                1. Motif de contact & Intention du client
              </label>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleIntentChange("info")}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                    newLeadIntent === "info"
                      ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                      : "bg-white text-slate-700 border-slate-200 hover:border-blue-300"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <Info className="w-4 h-4 shrink-0" />
                    <span>Renseignements</span>
                  </div>
                  <span className={`text-[10px] ${newLeadIntent === "info" ? "text-blue-100" : "text-slate-500"}`}>
                    S&apos;informe sur le cabinet et nos services (0 $)
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleIntentChange("consultation")}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                    newLeadIntent === "consultation"
                      ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                      : "bg-white text-slate-700 border-slate-200 hover:border-purple-300"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <MessageSquare className="w-4 h-4 shrink-0" />
                    <span>Consultation Initiale</span>
                  </div>
                  <span className={`text-[10px] ${newLeadIntent === "consultation" ? "text-purple-100" : "text-slate-500"}`}>
                    Évaluation d&apos;orientation du dossier (150 $)
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleIntentChange("mandate")}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                    newLeadIntent === "mandate"
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                      : "bg-white text-slate-700 border-slate-200 hover:border-emerald-300"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <Briefcase className="w-4 h-4 shrink-0" />
                    <span>Mandat Complet</span>
                  </div>
                  <span className={`text-[10px] ${newLeadIntent === "mandate" ? "text-emerald-100" : "text-slate-500"}`}>
                    Procédure IRCC & mandat de représentation
                  </span>
                </button>
              </div>

              <div className="flex items-center gap-4 pt-2 border-t border-slate-200/60">
                <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Catégorie :</span>
                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                  <input
                    type="radio"
                    name="leadType"
                    checked={newLeadType === "b2c"}
                    onChange={() => setNewLeadType("b2c")}
                    className="text-blue-600 focus:ring-0"
                  />
                  <span>Candidat / Particulier (B2C)</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                  <input
                    type="radio"
                    name="leadType"
                    checked={newLeadType === "b2b"}
                    onChange={() => setNewLeadType("b2b")}
                    className="text-purple-600 focus:ring-0"
                  />
                  <span>Employeur / Entreprise (B2B)</span>
                </label>
              </div>
            </div>

            {/* SECTION 2 : COORDONNÉES IDENTITÉ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Prénom *</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Sami"
                  value={newLeadFirstName}
                  onChange={(e) => setNewLeadFirstName(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs font-medium rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Nom de Famille *</label>
                <input
                  type="text"
                  required
                  placeholder="ex : Nom de famille"
                  value={newLeadLastName}
                  onChange={(e) => setNewLeadLastName(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs font-medium rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
                />
              </div>

              {newLeadType === "b2b" && (
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Raison Sociale de l&apos;Entreprise *</label>
                  <input
                    type="text"
                    required
                    placeholder="ex : Nom de l'entreprise"
                    value={newLeadCompany}
                    onChange={(e) => setNewLeadCompany(e.target.value)}
                    className="w-full px-4 py-2.5 text-xs font-medium rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
                  />
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Courriel *</label>
                <input
                  type="email"
                  required
                  placeholder="courriel@exemple.com"
                  value={newLeadEmail}
                  onChange={(e) => setNewLeadEmail(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs font-medium rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Téléphone *</label>
                <input
                  type="tel"
                  required
                  placeholder="+1 (514) 000-0000"
                  value={newLeadPhone}
                  onChange={(e) => setNewLeadPhone(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs font-medium rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
                />
              </div>

              {/* SECTION 3 : PROGRAMME ET HONORAIRES ESTIMÉS ÉDITABLE */}
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Programme IRCC ou Service Souhaité</label>
                <select
                  value={newLeadVisa}
                  onChange={(e) => handleVisaChange(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs font-bold rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
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
              <div className="flex flex-col gap-2 sm:col-span-2 bg-blue-50/50 p-4 rounded-2xl border border-blue-200">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-blue-950 uppercase tracking-wider flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-blue-600" />
                    <span>Valeur Estimée des Honoraires ($ CAD) — Saisissable & Éditable</span>
                  </label>
                  <span className="text-[11px] text-blue-700 font-semibold">Modifiez le montant librement</span>
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
                    className="flex-1 px-4 py-2.5 text-sm font-mono font-black rounded-2xl bg-white border border-blue-300 focus:border-blue-600 focus:outline-none transition-all text-blue-900 shadow-xs"
                  />
                  <span className="font-mono font-black text-xs text-blue-900">CAD $</span>
                </div>

                {/* BOUTONS PRÉRÉGLAGES RAPIDES */}
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <span className="text-[10px] font-bold text-slate-500">Montants suggérés :</span>
                  {["0", "150", "1800", "2500", "3800", "4500", "5000", "6500"].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setNewLeadValue(val)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
                        newLeadValue === val
                          ? "bg-blue-600 text-white shadow-xs"
                          : "bg-white text-slate-700 border border-slate-200 hover:bg-blue-100"
                      }`}
                    >
                      {val === "0" ? "0 $ (Info)" : val === "150" ? "150 $ (Consultation)" : `${val} $`}
                    </button>
                  ))}
                </div>
              </div>

              {/* SECTION 4 : PRATICABILITÉ & NOTES */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Praticabilité Initiale CICC</label>
                <select
                  value={newLeadFeasibility}
                  onChange={(e) => setNewLeadFeasibility(e.target.value as "high" | "med" | "low")}
                  className="w-full px-4 py-2.5 text-xs font-bold rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
                >
                  <option value="high">Haute (90%) - Profil Très Favorable</option>
                  <option value="med">Moyenne (72%) - Analyse Requise</option>
                  <option value="low">Faible (55%) - Risque / Refus Antérieur</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Notes & Remarques Initiales</label>
                <textarea
                  rows={2}
                  placeholder="Précisions sur la situation du prospect, questions posées ou objectifs..."
                  value={newLeadNotes}
                  onChange={(e) => setNewLeadNotes(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs font-medium rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="px-5 py-2.5 rounded-2xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button 
                type="submit"
                className="px-6 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all cursor-pointer inline-flex items-center gap-2"
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

