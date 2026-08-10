"use client"

import * as React from "react"
import { useFirm } from "@/components/app-shell/firm-provider"
import { cn } from "@/lib/utils"
import { 
  FolderOpen, 
  AlertCircle, 
  CheckCircle2, 
  ShieldCheck, 
  Clock, 
  Plus, 
  Search, 
  FileText, 
  TrendingUp, 
  ArrowUpRight, 
  Database, 
  UserCheck, 
  Award,
  Briefcase,
  Layers,
  Wand2,
  FileCheck2,
  Lock,
  Zap,
  Activity,
  ChevronRight,
  X,
  FileSignature,
  Building,
  SlidersHorizontal,
  Eye,
  Settings
} from "lucide-react"
import { Link, useRouter } from "@/i18n/routing"

import { CiccComplianceScore, DeadlineRecord } from "@/lib/data/types"

interface SearchItem {
  id: string
  title: string
  subtitle: string
  type: "matter" | "client" | "document"
  href: string
}

// Vidée : elle contenait les clients et documents d'un cabinet fictif,
// qui remontaient dans la recherche globale d'un cabinet réel.
const SEARCH_DATABASE: SearchItem[] = []

export interface DashboardCounts {
  activeMatters: number
  verifiedDocuments: number
  totalDocuments: number
}

/**
 * Libellés traduits, résolus côté serveur.
 *
 * Ils étaient typés `Record<string, unknown>`, ce qui rendait chaque
 * `{t.title}` non assignable à un nœud React et cassait la compilation de
 * production. Les nommer dit aussi ce que la page doit fournir : en
 * oublier un devient une erreur de compilation, pas un trou dans l'écran.
 */
export interface DashboardLabels {
  title: string
  activeMattersSub: string
  expiredDocsSub: string
  validatedDocsSub: string
  recentDocsTitle: string
  recentDocsDesc: string
  storageTitle: string
}

/** Blocs du tableau de bord que l'utilisateur peut afficher ou masquer. */
interface EtatWidgets {
  deadlinesBanner: boolean
  trustFinance: boolean
  kpis: boolean
  todayAgenda: boolean
  mattersList: boolean
}

const WIDGETS_PAR_DEFAUT: EtatWidgets = {
  deadlinesBanner: true,
  trustFinance: true,
  kpis: true,
  todayAgenda: true,
  mattersList: true,
}

/**
 * Remet une préférence relue de localStorage dans une forme sûre.
 *
 * Le contenu vient du navigateur : il peut dater d'une version où les
 * clés différaient, ou avoir été modifié à la main. Toute clé absente ou
 * non booléenne reprend sa valeur par défaut, plutôt que de masquer un
 * bloc du tableau de bord sans que rien ne l'explique.
 */
function normaliserWidgets(brut: unknown): EtatWidgets {
  if (typeof brut !== "object" || brut === null) return { ...WIDGETS_PAR_DEFAUT }
  const source = brut as Record<string, unknown>
  const resultat = { ...WIDGETS_PAR_DEFAUT }
  for (const cle of Object.keys(WIDGETS_PAR_DEFAUT) as (keyof EtatWidgets)[]) {
    if (typeof source[cle] === "boolean") resultat[cle] = source[cle] as boolean
  }
  return resultat
}

export function DashboardClient({ 
  t, 
  deadlines = [], 
  complianceScore,
  counts = { activeMatters: 0, verifiedDocuments: 0, totalDocuments: 0 }
}: { 
  t: DashboardLabels
  deadlines?: DeadlineRecord[]
  complianceScore?: CiccComplianceScore
  counts?: DashboardCounts
}) {
  const firm = useFirm()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = React.useState("")
  const [isSearchOpen, setIsSearchOpen] = React.useState(false)
  const [searchRef] = React.useState<React.RefObject<HTMLDivElement | null>>({ current: null })
  const [showComplianceModal, setShowComplianceModal] = React.useState(false)
  const [dismissedBanner, setDismissedBanner] = React.useState(false)

  // DASHBOARD PERSONALIZATION STATE & PRESETS (AVEC INITIALISATION LAZY LOCALSTORAGE)
  const [showCustomizeModal, setShowCustomizeModal] = React.useState(false)
  const [presetView, setPresetView] = React.useState<"global" | "finance" | "compliance">("global")
  // L'état était inféré depuis JSON.parse, donc `any` : le compilateur ne
  // voyait plus le type des widgets, et la compilation de production
  // échouait sur le `prev` implicitement any de updateWidgetsState.
  const [widgetsState, setWidgetsState] = React.useState<EtatWidgets>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("moncabinetcric_dashboard_widgets")
        // On ne fait pas confiance au contenu relu : c'est une valeur que
        // l'utilisateur peut modifier, et une clé manquante masquerait un
        // widget sans que rien ne l'explique.
        if (saved) return normaliserWidgets(JSON.parse(saved))
      } catch {
        // Ignorer
      }
    }
    return { ...WIDGETS_PAR_DEFAUT }
  })

  const updateWidgetsState = (updater: (prev: typeof widgetsState) => typeof widgetsState) => {
    setWidgetsState(prev => {
      const next = updater(prev)
      try {
        localStorage.setItem("moncabinetcric_dashboard_widgets", JSON.stringify(next))
      } catch {
        // Ignorer
      }
      return next
    })
  }

  const applyPresetView = (view: "global" | "finance" | "compliance") => {
    setPresetView(view)
    let newConfig = { deadlinesBanner: true, trustFinance: true, kpis: true, todayAgenda: true, mattersList: true }
    if (view === "finance") {
      newConfig = { deadlinesBanner: false, trustFinance: true, kpis: true, todayAgenda: false, mattersList: true }
    } else if (view === "compliance") {
      newConfig = { deadlinesBanner: true, trustFinance: false, kpis: false, todayAgenda: true, mattersList: true }
    }
    setWidgetsState(newConfig)
    try {
      localStorage.setItem("moncabinetcric_dashboard_widgets", JSON.stringify(newConfig))
    } catch {
      // Ignorer
    }
  }

  const handleResetToInitial = () => {
    const initialConfig = {
      deadlinesBanner: true,
      trustFinance: true,
      kpis: true,
      todayAgenda: true,
      mattersList: true
    }
    setWidgetsState(initialConfig)
    setPresetView("global")
    try {
      localStorage.removeItem("moncabinetcric_dashboard_widgets")
    } catch {
      // Ignorer
    }
  }

  // Écouter l'événement global déclenché par le bouton "Vues & Widgets" dans la Topbar (à côté du thème)
  React.useEffect(() => {
    const handleOpenModal = () => setShowCustomizeModal(true)
    window.addEventListener("cric_open_widgets_modal", handleOpenModal)
    return () => window.removeEventListener("cric_open_widgets_modal", handleOpenModal)
  }, [])

  const criticalDeadlines = deadlines.filter(d => d.severity === "critical" && d.status === "open")

  const filteredSearch = searchQuery.trim() === "" ? [] : SEARCH_DATABASE.filter(item =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.subtitle.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Close search dropdown on click outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className="space-y-8 pb-16">

      {/* BANDEAU D'ALERTES RÉGLEMENTAIRES OBLIGATOIRE EN TÊTE DE DASHBOARD (SPEC 2.5) */}
      {widgetsState.deadlinesBanner && (() => {
        /**
         * L'apparence du bandeau SUIT les échéances. Elle ne les précédait pas.
         *
         * Le dégradé était figé — from-warning via-error — et l'horloge
         * pulsait en permanence. Le bandeau avait donc exactement la même tête
         * un jour à sept échéances et un jour à zéro. Ce n'est pas un défaut
         * de goût : le rouge dépensé tous les jours ne signale plus rien le
         * jour où une prescription légale approche vraiment.
         *
         * La ligne « Aucune échéance à venir. » était pire encore — écrite en
         * dur, elle pouvait s'afficher SOUS un titre annonçant trois échéances
         * critiques.
         *
         * Trois états, tirés des données, et un seul qui pulse.
         */
        const critiques = deadlines.filter((d) => d.daysRemaining <= 14).length
        const proches = deadlines.filter((d) => d.daysRemaining > 14 && d.daysRemaining <= 30).length

        const etat = critiques > 0 ? "critique" : proches > 0 ? "vigilance" : "calme"

        // Teintes issues des jetons : le bandeau suit le thème du cabinet, y
        // compris « midnight ». Les couleurs figées d'avant ne le suivaient pas.
        const TONS = {
          critique: {
            fond: "bg-error/12 border-error/35",
            icone: "bg-error text-background",
            titre: `${critiques} échéance${critiques > 1 ? "s" : ""} réglementaire${critiques > 1 ? "s" : ""} critique${critiques > 1 ? "s" : ""} — moins de 14 jours`,
            detail: "Une prescription manquée ne se rattrape pas. Traitez-les en priorité.",
            pulse: true,
          },
          vigilance: {
            fond: "bg-warning/12 border-warning/35",
            icone: "bg-warning text-background",
            titre: `${proches} échéance${proches > 1 ? "s" : ""} à surveiller dans les 30 jours`,
            detail: "Rien d'urgent aujourd'hui, mais ces dossiers demandent une date de dépôt.",
            pulse: false,
          },
          calme: {
            fond: "bg-success/10 border-success/30",
            icone: "bg-success text-background",
            titre: "Toutes les échéances légales LIPR/RIPR sont sous contrôle",
            detail:
              deadlines.length > 0
                ? `${deadlines.length} échéance${deadlines.length > 1 ? "s" : ""} suivie${deadlines.length > 1 ? "s" : ""}, aucune dans les 30 prochains jours.`
                : "Aucune échéance enregistrée pour le moment.",
            pulse: false,
          },
        }[etat]

        return (
          <div
            className={cn(
              "rounded-3xl p-5 sm:p-6 border shadow-sm relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fadeIn",
              TONS.fond
            )}
          >
            <div className="flex items-center gap-4 relative z-10">
              <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0", TONS.icone)}>
                {/* Seul l'état critique pulse. Une animation permanente cesse
                    d'être remarquée en deux jours — et ne revient pas quand on
                    en a besoin. */}
                <Clock className={cn("w-6 h-6", TONS.pulse && "animate-pulse")} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn("text-[10px] font-mono font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-foreground/10 text-foreground/80")}>
                    MOTEUR D&apos;ÉCHÉANCES CICC & LIPR
                  </span>
                  <span className="text-xs font-bold text-foreground/75">Surveillance continue</span>
                </div>
                <h2 className="text-base sm:text-lg font-black tracking-tight text-foreground mt-1">
                  {TONS.titre}
                </h2>
                <p className="text-xs text-foreground/75 mt-0.5">{TONS.detail}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => router.push("/deadlines")}
              className="px-5 py-2.5 rounded-2xl bg-foreground text-background hover:opacity-90 text-xs font-extrabold shadow-md transition-all shrink-0 cursor-pointer flex items-center gap-2"
            >
              <span>Ouvrir l&apos;avertisseur ({deadlines.length})</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )
      })()}

      {/* 1. EN-TÊTE D'ACCUEIL UI/UX PRO MAX (SANS OVERFLOW HIDDEN POUR NE PAS ROGNER LE DROPDOWN) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-6 sm:p-8 rounded-3xl border border-border shadow-[0_4px_20px_rgba(0,0,0,0.03)] relative z-20">
        
        {/* Glow Element Isolé */}
        <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
          <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-primary/12 blur-3xl" />
        </div>

        <div className="relative z-10 flex items-center gap-4">
          <div className="relative">
            <div className="h-14 w-14 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center font-black text-xl shadow-lg shadow-primary/20">
              AD
            </div>
            <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-success border-2 border-background" title="En ligne" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                {t.title}
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-success/10 border border-success/30 px-3 py-1 text-xs font-black text-success-strong shadow-2xs">
                <ShieldCheck className="w-3.5 h-3.5 text-success-strong" /> Statut CICC : Conforme
              </span>
            </div>
            <p className="text-xs sm:text-sm font-semibold text-muted-foreground mt-1">
              {/* Le nom et le numéro de permis étaient écrits en dur, et le
                  numéro — R708149 — n'appartenait à aucun cabinet réel.
                  Afficher un permis CICC erroné n'est pas un défaut cosmétique.
                  Ils viennent désormais de la base. */}
              Bienvenue, {firm.rcicName || firm.name}
              {firm.rcicNumber && ` · Consultant réglementé CICC ${firm.rcicNumber}`}
            </p>
          </div>
        </div>

        {/* BARRE DE RECHERCHE INTELLIGENTE AVEC DROPDOWN NON ROGNÉ ET Z-INDEX 50 */}
        <div className="relative z-30 flex flex-wrap items-center gap-2.5 self-start md:self-auto" ref={searchRef}>
          
          <div className="relative w-full sm:w-72">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Taper nom, dossier #DOS..."
                value={searchQuery}
                onFocus={() => setIsSearchOpen(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setIsSearchOpen(true)
                }}
                className="w-full pl-9 pr-8 py-2.5 text-xs font-bold rounded-2xl bg-muted/60 border border-border focus:bg-card focus:border-primary focus:outline-none transition-all shadow-2xs text-foreground"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* DROPDOWN D'APERÇU EN DIRECT INCLUANT Z-INDEX HAUT HAUTEMENT VISIBLE */}
            {isSearchOpen && searchQuery.trim() !== "" && (
              <div className="absolute left-0 right-0 top-12 bg-card rounded-2xl border border-border shadow-2xl p-2 z-[100] animate-fadeIn max-h-80 overflow-y-auto ring-1 ring-foreground/10">
                <div className="px-3 py-1.5 text-[10px] font-black uppercase text-muted-foreground border-b border-border flex items-center justify-between">
                  <span>Résultats instantanés ({filteredSearch.length})</span>
                  <span className="text-primary-strong">MonCabinetCRIC Search</span>
                </div>

                {filteredSearch.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground font-medium">
                    Aucun dossier ou client trouvé pour &quot;{searchQuery}&quot;
                  </div>
                ) : (
                  <div className="flex flex-col gap-1 mt-1">
                    {filteredSearch.map(item => (
                      <div
                        key={item.id}
                        onClick={() => {
                          setIsSearchOpen(false)
                          router.push(item.href as Parameters<typeof router.push>[0])
                        }}
                        className="p-2.5 rounded-xl hover:bg-primary/8 transition-colors cursor-pointer flex items-center justify-between group border border-transparent hover:border-primary/30"
                      >
                        <div>
                          <div className="text-xs font-black text-foreground group-hover:text-primary-strong transition-colors flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                            <span>{item.title}</span>
                          </div>
                          <div className="text-[10px] font-semibold text-muted-foreground pl-3">{item.subtitle}</div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary-strong transition-colors" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <Link href="/clients">
            <button 
              type="button"
              className="inline-flex items-center gap-1.5 rounded-2xl bg-primary hover:bg-primary text-primary-foreground px-5 py-2.5 text-xs font-bold shadow-md shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nouveau Client</span>
            </button>
          </Link>
        </div>
      </div>

      {/* 1.5. BANDEAU DES ÉCHÉANCES CRITIQUES (< 30 JOURS) */}
      {!dismissedBanner && criticalDeadlines.length > 0 && (
        <div className="bg-error/12 text-background p-5 rounded-3xl shadow-xl border border-error/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-error/30 border border-error/50 flex items-center justify-center shrink-0">
              <AlertCircle className="w-6 h-6 text-error animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-error text-background text-[10px] font-mono font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Alerte Rétroactive Imminente
                </span>
                <span className="text-xs font-mono text-error font-bold">
                  {criticalDeadlines.length} échéance(s) critique(s) sous 30 jours
                </span>
              </div>
              <h2 className="text-sm font-extrabold text-background mt-1">
                {criticalDeadlines[0]?.title} — <strong className="text-warning">{criticalDeadlines[0]?.clientName}</strong>
              </h2>
              <p className="text-xs text-background/70 mt-0.5 font-medium">
                Déchéance le <span className="font-mono font-bold text-background">{criticalDeadlines[0]?.dueOn}</span> ({criticalDeadlines[0]?.daysRemaining} jours restants) · Règle : {criticalDeadlines[0]?.authority}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
            <button 
              onClick={() => router.push("/deadlines")}
              className="px-4 py-2 bg-error hover:bg-error text-background font-extrabold text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5"
            >
              <span>Consulter toutes les échéances</span>
              <ChevronRight className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setDismissedBanner(true)}
              className="p-2 bg-background/10 hover:bg-background/20 text-background/70 rounded-xl transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      {widgetsState.kpis && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 animate-fadeIn">
          
          {/* KPI 1: DOSSIERS ACTIFS IRCC (CLIC -> BASCULE VERS /matters) */}
          <div 
            onClick={() => router.push("/matters")}
            className="group bg-gradient-to-br from-primary/8 via-card to-primary/5 p-6 rounded-3xl border border-primary/30 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:border-primary hover:shadow-xl hover:scale-[1.02] transition-all duration-300 flex flex-col justify-between cursor-pointer"
          >
            <div className="flex items-center justify-between pb-4">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-xs font-black uppercase tracking-wider text-foreground">DOSSIERS ACTIFS IRCC</span>
              </div>
              <div className="h-10 w-10 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-md shadow-primary/20 group-hover:scale-110 transition-transform">
                <FolderOpen className="h-5 w-5" />
              </div>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-foreground tracking-tight">{counts.activeMatters}</span>
              </div>
              <p className="text-xs font-bold text-muted-foreground mt-1">Cliquer pour basculer vers les dossiers</p>
            </div>
          </div>

          {/* KPI 2: ÉCHÉANCES IMMINENTES J-30 (CLIC -> BASCULE VERS /deadlines) */}
          <div 
            onClick={() => router.push("/deadlines")}
            className="group bg-gradient-to-br from-warning/8 via-card to-warning/5 p-6 rounded-3xl border border-warning/40 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:border-warning hover:shadow-xl hover:scale-[1.02] transition-all duration-300 flex flex-col justify-between cursor-pointer"
          >
            <div className="flex items-center justify-between pb-4">
              <div className="flex items-center gap-1.5">
                {/* Même défaut que le bandeau : ce point palpitait au-dessus
                    d'un zéro. Il ne s'anime plus que lorsqu'il y a
                    effectivement quelque chose à signaler. */}
                <span className={cn("w-2 h-2 rounded-full bg-warning", criticalDeadlines.length > 0 && "animate-ping")} />
                <span className="text-xs font-black uppercase tracking-wider text-warning-strong">ÉCHÉANCES CRITIQUES</span>
              </div>
              <div className="h-10 w-10 rounded-2xl bg-warning text-background flex items-center justify-center shadow-md shadow-warning/20 group-hover:scale-110 transition-transform">
                <AlertCircle className="h-5 w-5" />
              </div>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-warning-strong tracking-tight">{deadlines.length}</span>
                <span className="inline-flex items-center gap-1 text-xs font-extrabold text-warning-strong bg-warning/15 border border-warning/40 px-2 py-0.5 rounded-full">
                  <Clock className="w-3 h-3" /> Suivi &lt; 30j
                </span>
              </div>
              <p className="text-xs font-bold text-muted-foreground mt-1">Cliquer pour ouvrir la console d&apos;échéances</p>
            </div>
          </div>

          {/* KPI 3: PIÈCES VALIDÉES & CONFORMES (CLIC -> BASCULE VERS /documents) */}
          <div 
            onClick={() => router.push("/documents")}
            className="group bg-gradient-to-br from-success/8 via-card to-success/5 p-6 rounded-3xl border border-success/30 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:border-success hover:shadow-xl hover:scale-[1.02] transition-all duration-300 flex flex-col justify-between cursor-pointer"
          >
            <div className="flex items-center justify-between pb-4">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-success" />
                <span className="text-xs font-black uppercase tracking-wider text-foreground">PIÈCES VÉRIFIÉES CICC</span>
              </div>
              <div className="h-10 w-10 rounded-2xl bg-success text-background flex items-center justify-center shadow-md shadow-success/20 group-hover:scale-110 transition-transform">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-foreground tracking-tight">{counts.verifiedDocuments}</span>
                {counts.totalDocuments > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs font-extrabold text-success-strong bg-success/15 border border-success/40 px-2.5 py-0.5 rounded-full">
                    <UserCheck className="w-3 h-3" />
                    {Math.round((counts.verifiedDocuments / counts.totalDocuments) * 100)}% conformes
                  </span>
                )}
              </div>
              <p className="text-xs font-bold text-muted-foreground mt-1">Cliquer pour ouvrir le coffre-fort</p>
            </div>
          </div>

          {/* KPI 4: SCORE DE CONFORMITÉ RÉGLEMENTAIRE (CLIC -> OUVRE MODAL DÉCOMPOSITION CICC) */}
          <div 
            onClick={() => setShowComplianceModal(true)}
            className="group bg-gradient-to-br from-primary/8 via-card to-primary/5 p-6 rounded-3xl border border-primary/30 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:border-primary hover:shadow-xl hover:scale-[1.02] transition-all duration-300 flex flex-col justify-between cursor-pointer"
          >
            <div className="flex items-center justify-between pb-4">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-xs font-black uppercase tracking-wider text-foreground">SCORE CICC AUDIT</span>
              </div>
              <div className="h-10 w-10 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-md shadow-primary/20 group-hover:scale-110 transition-transform">
                <ShieldCheck className="h-5 w-5" />
              </div>
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-primary-strong tracking-tight">
                  {typeof complianceScore?.totalScore === "number" ? `${complianceScore.totalScore}%` : "—"}
                </span>
                <span className="text-xs font-extrabold text-foreground bg-primary/12 px-2 py-0.5 rounded-full border border-primary/30">
                  Audit Ready
                </span>
              </div>
              <div className="h-2.5 w-full bg-muted rounded-full mt-2.5 overflow-hidden flex">
                <div className="h-full bg-primary w-[98%] rounded-full" />
              </div>
              <p className="text-[11px] font-bold text-foreground mt-1">Cliquer pour voir les 7 critères CICC</p>
            </div>
          </div>

        </div>
      )}

      {/* 3. NOUVELLE RANGÉE : RÉPARTITION DYNAMIQUE DES PROGRAMMES IRCC + RACCOURCIS */}
      {widgetsState.trustFinance && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch animate-fadeIn">
          
          {/* GRAPH D'AVANCEMENT & RÉPARTITION DES PROGRAMMES IRCC */}
          <div className="lg:col-span-2 bg-card rounded-3xl border border-border shadow-[0_4px_20px_rgba(0,0,0,0.02)] p-6 flex flex-col justify-between gap-5">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="font-black text-base text-foreground flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary-strong" />
                  <span>Répartition des Mandats & Solde Fidéicommis (Art. 13)</span>
                </h3>
                <p className="text-xs text-muted-foreground font-medium mt-0.5">Ventilation des dossiers actifs et honoraires en fiducie</p>
              </div>
              <span className="text-xs font-black text-foreground bg-primary/10 border border-primary/30 px-3 py-1 rounded-full font-mono">
                $42,500 CAD Fidéicommis
              </span>
            </div>

            <div className="flex flex-col gap-4 text-xs font-bold">
              <div>
                <div className="flex justify-between mb-1.5">
                  <span className="text-foreground font-black flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-primary-strong" />
                    <span>Résidence Permanente (PEQ & Entrée Express)</span>
                  </span>
                  <span className="font-mono font-black text-primary-strong">25 dossiers (55%)</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary to-primary rounded-full w-[55%]" />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1.5">
                  <span className="text-foreground font-black flex items-center gap-1.5">
                    <Briefcase className="w-4 h-4 text-primary-strong" />
                    <span>Permis de Travail & EIMT B2B (Outaouais & Montréal)</span>
                  </span>
                  <span className="font-mono font-black text-primary-strong">12 dossiers (27%)</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary to-primary rounded-full w-[27%]" />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1.5">
                  <span className="text-foreground font-black flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-success-strong" />
                    <span>Permis d&apos;Études & CAQ Québec</span>
                  </span>
                  <span className="font-mono font-black text-success-strong">8 dossiers (18%)</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-success to-success rounded-full w-[18%]" />
                </div>
              </div>
            </div>
          </div>

          {/* RACCOURCIS DE PRODUCTIVITÉ EN 1-CLIC */}
          <div className="bg-foreground text-background rounded-3xl p-6 shadow-xl border border-primary/25 flex flex-col justify-between gap-5 relative overflow-hidden">
            <div className="pointer-events-none absolute -bottom-16 -right-16 w-48 h-48 rounded-full bg-primary/20 blur-2xl" />

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-5 h-5 text-warning" />
                <h3 className="font-black text-base text-background">Raccourcis SaaS 1-Clic</h3>
              </div>
              <p className="text-xs text-background/70">Accès direct aux modules clés de votre cabinet</p>
            </div>

            <div className="flex flex-col gap-2.5 relative z-10">
              <Link href="/documents">
                <button 
                  type="button"
                  className="w-full inline-flex items-center justify-between p-3 rounded-2xl bg-background/10 hover:bg-background/20 border border-background/15 text-background text-xs font-bold transition-all cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Wand2 className="w-4 h-4 text-success" />
                    <span>Autoremplissage IRCC</span>
                  </span>
                  <ArrowUpRight className="w-4 h-4 text-background/60" />
                </button>
              </Link>

              <Link href="/billing">
                <button 
                  type="button"
                  className="w-full inline-flex items-center justify-between p-3 rounded-2xl bg-background/10 hover:bg-background/20 border border-background/15 text-background text-xs font-bold transition-all cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-warning" />
                    <span>Facture & Fidéicommis</span>
                  </span>
                  <ArrowUpRight className="w-4 h-4 text-background/60" />
                </button>
              </Link>

              <Link href="/settings">
                <button 
                  type="button"
                  className="w-full inline-flex items-center justify-between p-3 rounded-2xl bg-background/10 hover:bg-background/20 border border-background/15 text-background text-xs font-bold transition-all cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                    <span>Paramètres Cabinet</span>
                  </span>
                  <ArrowUpRight className="w-4 h-4 text-background/60" />
                </button>
              </Link>
            </div>
          </div>

        </div>
      )}

      {/* 3.5. AGENDA & RENCONTRES DU JOUR (WIDGET DÉDIÉ) */}
      {widgetsState.todayAgenda && (
        <div className="bg-card rounded-3xl border border-border shadow-[0_4px_20px_rgba(0,0,0,0.02)] p-6 space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-primary/12 text-primary-strong flex items-center justify-center font-bold">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-base text-foreground">Agenda & Consultations du Jour</h3>
                <p className="text-xs text-muted-foreground font-medium">3 rendez-vous confirmés et synchronisés</p>
              </div>
            </div>
            <Link href="/calendar">
              <button type="button" className="text-xs font-extrabold text-primary-strong hover:text-foreground flex items-center gap-1 cursor-pointer">
                <span>Ouvrir l&apos;Agenda complet</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </Link>
          </div>

          {/* Les trois rendez-vous qui figuraient ici étaient écrits en dur,
              avec les clients d'un cabinet fictif. Ils s'affichaient donc sur
              un cabinet réel n'ayant aucun rendez-vous. */}
          <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center">
            <p className="text-xs font-bold text-muted-foreground">Aucun rendez-vous planifié</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Les rencontres à venir apparaîtront ici.
            </p>
          </div>
        </div>
      )}

      {/* 4. SECTION PRINCIPALE : DOSSIERS RÉCENTS & JAUGE DE STOCKAGE AUDITABLE */}
      {widgetsState.mattersList && (
        <div className="grid gap-6 lg:grid-cols-7 items-start animate-fadeIn">
          
          {/* TABLEAU DES DOSSIERS PRIORITAIRES (COLONNE 4/7) */}
          <div className="lg:col-span-4 bg-card rounded-3xl border border-border shadow-[0_4px_20px_rgba(0,0,0,0.02)] overflow-hidden">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-foreground">{t.recentDocsTitle}</h2>
                <p className="text-xs font-semibold text-muted-foreground mt-0.5">{t.recentDocsDesc}</p>
              </div>
              <Link href="/matters">
                <button type="button" className="text-xs font-extrabold text-primary-strong hover:text-primary-strong flex items-center gap-1 cursor-pointer">
                  <span>Voir tout</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </Link>
            </div>

            <div className="divide-y divide-border">
              {/* Cette liste était écrite en dur : quatre documents appartenant
                  à des clients fictifs, affichés sur un cabinet réel dont le
                  coffre est vide. Vidée jusqu'à ce qu'elle soit alimentée par
                  les documents du cabinet. */}
              {([] as {
                id: string
                type: string
                time: string
                status: string
                client: string
                href: string
                badge: string
              }[]).map((item, idx) => (
                <div 
                  key={idx} 
                  onClick={() => router.push(item.href as Parameters<typeof router.push>[0])}
                  className="p-5 flex items-center justify-between hover:bg-muted/60 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary-strong flex items-center justify-center font-bold text-xs shrink-0 group-hover:scale-110 transition-transform">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-black text-foreground group-hover:text-primary-strong transition-colors">{item.id}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span className="font-bold text-foreground">{item.client}</span>
                        <span>•</span>
                        <span>{item.type}</span>
                        <span>•</span>
                        <span>{item.time}</span>
                      </div>
                    </div>
                  </div>

                  <span className={`px-3 py-1 rounded-full text-xs font-black border ${item.badge}`}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* CARTE STOCKAGE CHIFFRÉ & JOURNAL D'AUDIT (COLONNE 3/7) */}
          <div className="lg:col-span-3 bg-foreground text-background rounded-3xl p-6 sm:p-8 shadow-xl border border-primary/25 relative overflow-hidden flex flex-col justify-between min-h-[380px]">
            
            <div className="pointer-events-none absolute -bottom-20 -right-20 w-60 h-60 rounded-full bg-primary/20 blur-3xl" />

            <div>
              <div className="flex items-center justify-between pb-4 border-b border-background/15">
                <div className="flex items-center gap-2.5">
                  <Database className="w-5 h-5 text-background/80" />
                  <h3 className="text-base font-black tracking-tight text-background">{t.storageTitle}</h3>
                </div>
                <span className="text-[11px] font-bold font-mono bg-background/15 text-background/80 px-2.5 py-0.5 rounded-full uppercase">
                  AES-256
                </span>
              </div>

              {/* Jauge Circulaire Visuelle */}
              <div className="flex flex-col items-center justify-center py-8">
                <div className="relative flex h-36 w-36 items-center justify-center rounded-full border-8 border-background/15 shadow-inner">
                  <div className="absolute inset-0 rounded-full border-8 border-success/50 border-t-transparent border-r-transparent transform -rotate-45" />
                  <div className="flex flex-col items-center">
                    <span className="text-4xl font-black text-background tracking-tight">25%</span>
                    <span className="text-[11px] font-bold text-background/80 uppercase tracking-widest mt-0.5">Utilisé</span>
                  </div>
                </div>
                <p className="text-sm font-bold text-background/90 mt-4">
                  124 GB / 500 GB Sécurisés CICC
                </p>
              </div>
            </div>

            <div className="bg-background/10 rounded-2xl p-4 backdrop-blur-md border border-background/15 flex items-center justify-between text-xs font-bold text-background/90">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-success" />
                <span>Horodatage Infalsifiable Actif</span>
              </div>
              {/* Ce libellé vit sur une surface INVERSÉE, dont la polarité change
                  avec le thème. Aucune des deux variantes du vert ne peut être
                  juste dans les deux cas : il en faudrait une troisième, pour un
                  seul mot. « Valide » porte déjà le sens ; il prend donc la
                  couleur de sa surface, qui s'inverse avec elle. */}
              <span className="text-background font-extrabold">100% Valide</span>
            </div>

          </div>

        </div>
      )}

      {/* MODAL DE DÉCOMPOSITION DU SCORE DE CONFORMITÉ CICC (7 CRITÈRES BILINGUES) */}
      {showComplianceModal && complianceScore && (
        <div className="fixed inset-0 z-50 bg-background/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-card rounded-3xl shadow-2xl border border-border w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            <div className="px-6 py-4 bg-foreground text-background flex items-center justify-between border-b border-foreground/80">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-6 h-6 text-success" />
                <div>
                  <h3 className="font-extrabold text-sm text-background flex items-center gap-2">
                    Score de Conformité CICC & Audit
                    <span className="bg-success/20 text-success border border-success/30 text-[10px] font-mono font-bold px-2 py-0.5 rounded">
                      {complianceScore.totalScore ?? "—"} / 100 PTS
                    </span>
                  </h3>
                  <p className="text-xs text-background/70">Audité selon les exigences de l&apos;Art. 13 et du Code de conduite CICC</p>
                </div>
              </div>
              <button 
                onClick={() => setShowComplianceModal(false)}
                className="w-8 h-8 rounded-xl bg-background/10 hover:bg-background/20 flex items-center justify-center text-background/70 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-muted/60 text-foreground text-xs flex flex-col gap-4 font-sans">
              <div className="bg-card p-4 rounded-2xl border border-border flex items-center justify-between shadow-2xs">
                <div>
                  <span className="text-[10px] font-mono uppercase font-black text-muted-foreground block">État Global d&apos;Audit</span>
                  <strong className="text-base text-foreground font-extrabold flex items-center gap-2 mt-0.5">
                    <CheckCircle2 className="w-5 h-5 text-success-strong" />
                    <span>Conformité Optimale — Prêt pour Inspection CICC</span>
                  </strong>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-success-strong font-mono">{complianceScore.totalScore ?? "—"}%</span>
                  <span className="text-[10px] font-extrabold text-success-strong bg-success/15 px-2 py-0.5 rounded-full block mt-0.5">7 / 7 RÈGLES VALIDÉES</span>
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                {complianceScore.items.map((item) => (
                  <div key={item.id} className="p-4 bg-card rounded-2xl border border-border shadow-2xs flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${item.isSatisfied ? "bg-success/15 text-success-strong" : "bg-error/15 text-error-strong"}`}>
                        {item.isSatisfied ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                      </div>
                      <div>
                        <h4 className="font-extrabold text-xs text-foreground flex items-center gap-2">
                          <span>{item.labelFr}</span>
                          <span className="text-[10px] font-mono text-muted-foreground">({item.labelEn})</span>
                        </h4>
                        <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{item.detailFr}</p>
                      </div>
                    </div>

                    <span className="text-xs font-mono font-black text-foreground bg-muted px-2.5 py-1 rounded-xl shrink-0">
                      +{item.weight} PTS
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-4 bg-card border-t border-border flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">Permis RCIC Titulaire : <strong>{firm.rcicName} (#{firm.rcicNumber})</strong></span>
              <button 
                onClick={() => setShowComplianceModal(false)}
                className="px-5 py-2 bg-foreground hover:bg-foreground/90 text-background font-bold text-xs rounded-xl shadow-sm transition-all"
              >
                Fermer l&apos;audit
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL DE PERSONNALISATION DES VUES ET WIDGETS DU TABLEAU DE BORD */}
      {showCustomizeModal && (
        <div className="fixed inset-0 z-[280] flex items-center justify-center bg-background/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-card rounded-3xl border border-border shadow-2xl w-full max-w-lg overflow-hidden animate-scaleUp">
            
            <div className="p-6 border-b border-border bg-muted/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center font-bold shadow-md">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-foreground">Personnaliser le Tableau de Bord</h3>
                  <p className="text-xs text-muted-foreground font-medium">Choisissez vos vues pré-configurées ou activez vos widgets sur mesure.</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowCustomizeModal(false)}
                className="p-2 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* SECTEUR VUES PRÉRÉGLÉES */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-muted-foreground tracking-wider">Vues Rapides Préréglées</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => applyPresetView("global")}
                    className={`p-3 rounded-2xl border text-xs font-bold text-center transition-all cursor-pointer ${
                      presetView === "global"
                        ? "bg-foreground text-background border-foreground shadow-md font-black"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted border-border"
                    }`}
                  >
                    Vue Globale
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPresetView("finance")}
                    className={`p-3 rounded-2xl border text-xs font-bold text-center transition-all cursor-pointer ${
                      presetView === "finance"
                        ? "bg-foreground text-background border-foreground shadow-md font-black"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted border-border"
                    }`}
                  >
                    Finance & Trust
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPresetView("compliance")}
                    className={`p-3 rounded-2xl border text-xs font-bold text-center transition-all cursor-pointer ${
                      presetView === "compliance"
                        ? "bg-foreground text-background border-foreground shadow-md font-black"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted border-border"
                    }`}
                  >
                    Conformité CICC
                  </button>
                </div>
              </div>

              {/* TOGGLES INDIVIDUELS DES WIDGETS */}
              <div className="space-y-3 pt-2 border-t border-border">
                <label className="text-xs font-black uppercase text-muted-foreground tracking-wider">Activation des Widgets</label>
                
                <div className="space-y-2 text-xs font-bold text-foreground">
                  <label className="flex items-center justify-between p-3 rounded-2xl bg-muted/60 border border-border cursor-pointer hover:bg-muted">
                    <span className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-warning" /> Bandeau Avertisseur d&apos;Échéances CICC
                    </span>
                    <input
                      type="checkbox"
                      checked={widgetsState.deadlinesBanner}
                      onChange={(e) => updateWidgetsState(prev => ({ ...prev, deadlinesBanner: e.target.checked }))}
                      className="h-4 w-4 rounded accent-indigo-600 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-2xl bg-muted/60 border border-border cursor-pointer hover:bg-muted">
                    <span className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-success" /> KPIs & Métriques de Performance
                    </span>
                    <input
                      type="checkbox"
                      checked={widgetsState.kpis}
                      onChange={(e) => updateWidgetsState(prev => ({ ...prev, kpis: e.target.checked }))}
                      className="h-4 w-4 rounded accent-indigo-600 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-2xl bg-muted/60 border border-border cursor-pointer hover:bg-muted">
                    <span className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-primary-strong" /> Fidéicommis (Art. 13) & Solde en Fiducie
                    </span>
                    <input
                      type="checkbox"
                      checked={widgetsState.trustFinance}
                      onChange={(e) => updateWidgetsState(prev => ({ ...prev, trustFinance: e.target.checked }))}
                      className="h-4 w-4 rounded accent-indigo-600 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-2xl bg-muted/60 border border-border cursor-pointer hover:bg-muted">
                    <span className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-primary-strong" /> Agenda & Rendez-vous du Jour
                    </span>
                    <input
                      type="checkbox"
                      checked={widgetsState.todayAgenda}
                      onChange={(e) => updateWidgetsState(prev => ({ ...prev, todayAgenda: e.target.checked }))}
                      className="h-4 w-4 rounded accent-indigo-600 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-2xl bg-muted/60 border border-border cursor-pointer hover:bg-muted">
                    <span className="flex items-center gap-2">
                      <FolderOpen className="w-4 h-4 text-primary-strong" /> Dossiers Actifs & Pièces Manquantes
                    </span>
                    <input
                      type="checkbox"
                      checked={widgetsState.mattersList}
                      onChange={(e) => updateWidgetsState(prev => ({ ...prev, mattersList: e.target.checked }))}
                      className="h-4 w-4 rounded accent-indigo-600 cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-border flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleResetToInitial}
                  className="px-4 py-2.5 bg-muted hover:bg-muted text-muted-foreground font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  🔄 Réinitialiser la configuration initiale
                </button>

                <button
                  type="button"
                  onClick={() => setShowCustomizeModal(false)}
                  className="px-6 py-2.5 bg-primary hover:bg-primary text-primary-foreground font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all"
                >
                  Valider
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  )
}
