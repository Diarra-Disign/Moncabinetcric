"use client"

import * as React from "react"
import { 
  FolderOpen, 
  Search, 
  Plus, 
  SlidersHorizontal, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  User, 
  Calendar, 
  ArrowUpRight, 
  Sparkles, 
  ShieldCheck, 
  Filter,
  MoreHorizontal,
  Briefcase,
  FileCheck2,
  TrendingUp,
  Award,
  Layers,
  ChevronRight,
  Trash2,
  Receipt,
  FileText,
  Building2,
  Eye,
  Check,
  DollarSign,
  Send,
  Video,
  FileUp,
  Download,
  ExternalLink,
  X
} from "lucide-react"
import { Link, useRouter } from "@/i18n/routing"
import { Matter } from "@/lib/data/types"
import { PageHeader } from "@/components/app-shell/page-header"
import { useFirm } from "@/components/app-shell/firm-provider"
import { createMatter } from "@/lib/data/actions"

import { SideSheetDrawer } from "@/components/ui/side-sheet-drawer"

interface MattersClientProps {
  t: {
    title: string
    subtitle: string
    newMatter: string
    stats?: Record<string, string>
    filters: Record<string, string>
    table: Record<string, string>
    statusLabels: Record<string, string>
    widgets: Record<string, string>
  }
  initialMatters: Matter[]
}

export function MattersClient({ t, initialMatters }: MattersClientProps) {
  const router = useRouter()
  const [matters, setMatters] = React.useState<Matter[]>(initialMatters)
  const [activeTab, setActiveTab] = React.useState<"all" | "pr" | "work" | "study" | "tr">("all")
  const [filterStatus, setFilterStatus] = React.useState<"all" | "valid" | "alert" | "review">("all")
  const [searchQuery, setSearchQuery] = React.useState("")
  // La liste peut être vide — un cabinet neuf n'a aucun dossier. L'annoter
  // « Matter » mentait au compilateur et laissait passer un accès à
  // undefined jusqu'à l'exécution.
  const [selectedMatter, setSelectedMatter] = React.useState<Matter | undefined>(matters[0])
  const [drawerMatter, setDrawerMatter] = React.useState<Matter | null>(null)

  // NEW MATTER MODAL
  const [isNewModalOpen, setIsNewModalOpen] = React.useState(false)
  const [toastNotice, setToastNotice] = React.useState<string | null>(null)

  // Ouverture d'un dossier : le formulaire annonçait « Nouveau dossier créé
  // avec succès et synchronisé sur le Registre CICC » sans rien enregistrer,
  // et attribuait le dossier à un numéro de permis inventé. Il écrit
  // maintenant en base, et le titulaire vient du profil du cabinet.
  const firm = useFirm()
  const [nouveauClient, setNouveauClient] = React.useState("")
  const [nouveauProgramme, setNouveauProgramme] = React.useState("Résidence permanente (PEQ Québec)")
  const [creationEnCours, setCreationEnCours] = React.useState(false)
  const [erreurCreation, setErreurCreation] = React.useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastNotice(msg)
    setTimeout(() => setToastNotice(null), 4500)
  }

  // FILTERED MATTERS
  const filteredMatters = React.useMemo(() => {
    return matters.filter(m => {
      const matchTab = activeTab === "all" || m.category === activeTab
      const matchStatus = filterStatus === "all" || m.status === filterStatus
      const matchSearch = m.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          m.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          m.program.toLowerCase().includes(searchQuery.toLowerCase())
      return matchTab && matchStatus && matchSearch
    })
  }, [matters, activeTab, filterStatus, searchQuery])

  return (
    <div className="flex flex-col gap-8 pb-20 selection:bg-blue-600 selection:text-white">
      
      {/* TOAST GLOBAL */}
      {toastNotice && (
        <div className="fixed top-20 right-6 z-[300] bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-700 font-bold text-xs sm:text-sm flex items-center gap-3 animate-slideInRight">
          <div className="h-9 w-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-black shrink-0">
            ✓
          </div>
          <span>{toastNotice}</span>
        </div>
      )}
      <PageHeader
        title={t.title || "Dossiers Réglementés CICC"}
        subtitle={t.subtitle || "Suivi réglementaire et état des procédures IRCC / MIFI de vos clients."}
        action={
          <button
            type="button"
            onClick={() => setIsNewModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t.newMatter || "+ Nouveau Dossier"}</span>
          </button>
        }
      />



      {/* 2. BARRE DE FILTRES ET RECHERCHE HAUTE DÉFINITION */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* PROGRAM CATEGORY TABS */}
        <div className="flex items-center gap-1.5 bg-slate-100/90 p-1.5 rounded-2xl overflow-x-auto">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "all" ? "bg-blue-600 text-white shadow-md font-black" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Tous ({matters.length})
          </button>
          <button
            onClick={() => setActiveTab("pr")}
            className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "pr" ? "bg-blue-600 text-white shadow-md font-black" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Résidence Permanente (PEQ / EE)
          </button>
          <button
            onClick={() => setActiveTab("work")}
            className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "work" ? "bg-blue-600 text-white shadow-md font-black" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Permis Travail / EIMT
          </button>
          <button
            onClick={() => setActiveTab("study")}
            className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "study" ? "bg-blue-600 text-white shadow-md font-black" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Permis Études & CAQ
          </button>
          <button
            onClick={() => setActiveTab("tr")}
            className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "tr" ? "bg-blue-600 text-white shadow-md font-black" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Résidence Temporaire (Visa, Super Visa)
          </button>
        </div>

        {/* SEARCH & STATUS FILTER */}
        <div className="flex items-center gap-3 max-w-md w-full">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Chercher par nom, dossier #DOS..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as "all" | "valid" | "alert" | "review")}
            className="h-10 px-3 text-xs font-bold rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none cursor-pointer"
          >
            <option value="all">Tous statut</option>
            <option value="valid">Conformes ✓</option>
            <option value="alert">Alertes ⚠️</option>
            <option value="review">En révision</option>
          </select>
        </div>

      </div>

      {/* 3. GRILLE DE DOSSIERS INTERACTIVE (2 COLONNES : LISTE DES DOSSIERS + FICHE DÉTAILLÉE DU DOSSIER SÉLECTIONNÉ) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: LIST OF DOSSIERS (7 COLONNES) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-lg font-black text-slate-900">
              Liste des Mandats ({filteredMatters.length})
            </h3>
            <span className="text-xs font-semibold text-slate-500">Cliquez sur un dossier pour le consulter</span>
          </div>

          <div className="space-y-3.5">
            {filteredMatters.map((m) => {
              const isSelected = selectedMatter?.id === m.id

              return (
                <div
                  key={m.id}
                  onClick={() => setSelectedMatter(m)}
                  className={`p-6 rounded-3xl border transition-all duration-200 cursor-pointer text-left space-y-3 relative group ${
                    isSelected
                      ? "bg-gradient-to-r from-blue-50/90 to-indigo-50/70 border-blue-500 shadow-md ring-2 ring-blue-500/20"
                      : "bg-white border-slate-200/80 hover:border-blue-300 hover:shadow-sm"
                  }`}
                >
                  {/* HEADER ROW */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-black text-slate-900 bg-white px-3 py-1 rounded-xl border border-slate-200 shadow-2xs">
                        {m.id}
                      </span>
                      {m.clientType === "b2b" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
                          <Building2 className="w-3 h-3" /> Entreprise B2B
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                          <User className="w-3 h-3" /> Particulier B2C
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setDrawerMatter(m); }}
                        className="px-2.5 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                        title="Ouvrir le tiroir coulissant"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Coulissant</span>
                      </button>

                      {m.status === "valid" ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Conforme
                        </span>
                      ) : m.status === "alert" ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1 rounded-full animate-pulse">
                          <AlertCircle className="w-3.5 h-3.5" /> Pièce manquante
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
                          <Clock className="w-3.5 h-3.5" /> En révision
                        </span>
                      )}
                    </div>
                  </div>

                  {/* CLIENT & PROGRAM */}
                  <div>
                    <h4 className="text-xl font-black text-slate-900 group-hover:text-blue-600 transition-colors">
                      {m.clientName}
                    </h4>
                    <p className="text-xs sm:text-sm font-bold text-blue-700 mt-0.5">
                      {m.program}
                    </p>
                  </div>

                  {/* METADATA BAR */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-amber-500" /> Échéance : <strong className="text-slate-900 font-bold">{m.deadline || "à fixer"}</strong>
                    </span>
                    <span className="flex items-center gap-1 text-slate-700 font-bold">
                      <User className="w-3.5 h-3.5 text-blue-600" /> {m.rcic}
                    </span>
                  </div>

                </div>
              )
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: FICHE COMPLÈTE DU DOSSIER SÉLECTIONNÉ (5 COLONNES) */}
        <div className="lg:col-span-5 space-y-6">
          {!selectedMatter ? (
            <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-10 text-center shadow-xs sticky top-6">
              <FolderOpen className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-black text-slate-800">Aucun dossier sélectionné</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">Créez un premier dossier pour voir sa fiche s&apos;afficher ici.</p>
            </div>
          ) : (
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-7 shadow-md space-y-6 sticky top-6">
            
            {/* CARD HEADER */}
            <div className="border-b border-slate-100 pb-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200 font-mono">
                  {selectedMatter.id}
                </span>

                <Link
                  href={`/matters/${selectedMatter.id.replace('#', '')}`}
                  className="inline-flex items-center gap-1.5 text-xs font-black text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-200 transition-all hover:scale-105"
                >
                  <span>Ouvrir la Fiche Complète</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div>
                <h2 className="text-2xl font-black text-slate-900">
                  {selectedMatter.clientName}
                </h2>
                <p className="text-xs sm:text-sm font-extrabold text-blue-700 mt-0.5">
                  {selectedMatter.program}
                </p>
              </div>
            </div>

            {/* FIDÉICOMMIS & REMARQUES DE CONFORMITÉ */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">Compte Fidéicommis CICC</span>
                <span className="text-sm font-black text-emerald-600 font-mono">$5,000 CAD</span>
              </div>
              <p className="text-xs text-slate-600 font-medium">
                💬 <strong>Notes :</strong> {selectedMatter.notes}
              </p>
            </div>

            {/* RACCOURCIS D'ACTIONS DIRECTES POUR CE DOSSIER */}
            <div className="space-y-3">
              <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                Actions Rapides sur ce Mandat
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  onClick={() => showToast("Formulaire officiel IMM 5476 ouvert pour la signature numérotée !")}
                  className="p-3.5 rounded-2xl bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 text-xs font-bold flex items-center gap-2.5 transition-all text-left cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Mandat IMM 5476</span>
                </button>

                <button
                  onClick={() => showToast("Appel de fonds fidéicommis envoyé à " + selectedMatter.clientName)}
                  className="p-3.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-xs font-bold flex items-center gap-2.5 transition-all text-left cursor-pointer"
                >
                  <DollarSign className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Compte Fidéicommis</span>
                </button>

                <Link
                  href="/calendar"
                  className="p-3.5 rounded-2xl bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 text-xs font-bold flex items-center gap-2.5 transition-all text-left"
                >
                  <Video className="w-4 h-4 text-purple-600 shrink-0" />
                  <span>Inviter en Visio</span>
                </Link>

                <button
                  onClick={() => showToast("Exportation du rapport d'audit pour le Collège (CICC)...")}
                  className="p-3.5 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold flex items-center gap-2.5 transition-all text-left cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Audit CICC</span>
                </button>
              </div>
            </div>

            {/* CHECKLIST EXPRESS */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                Exigences Documentaires IRCC
              </h4>

              <div className="space-y-2 text-xs">
                <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200 text-emerald-950 flex items-center justify-between font-medium">
                  <span>1. Passeport principal (Valide &gt; 6 mois)</span>
                  <Check className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200 text-emerald-950 flex items-center justify-between font-medium">
                  <span>2. Formulaire d&apos;antécédents IMM 5669</span>
                  <Check className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200 text-amber-950 flex items-center justify-between font-medium">
                  <span>3. Preuve financière & Fidéicommis</span>
                  <Clock className="w-4 h-4 text-amber-600" />
                </div>
              </div>
            </div>

          </div>
          )}
        </div>

      </div>

      {/* 4. MODAL CRÉATION DE DOSSIER */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-scaleUp">
            
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Ouverture d&apos;un Nouveau Dossier CICC</h3>
                  <p className="text-xs text-slate-500 font-medium">Initialisez un mandat client et générez la checklist IRCC.</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsNewModalOpen(false)}
                className="p-2 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault()
                if (!nouveauClient.trim() || creationEnCours) return
                setCreationEnCours(true)
                setErreurCreation(null)
                try {
                  const cree = await createMatter({
                    clientName: nouveauClient.trim(),
                    program: nouveauProgramme,
                    openedDate: new Date().toISOString().split("T")[0],
                    deadline: "",
                    rcic: firm.rcicName,
                    status: "pending",
                  })
                  setMatters(prev => [cree, ...prev])
                  setIsNewModalOpen(false)
                  setNouveauClient("")
                  showToast(`Dossier ${cree.id} ouvert pour ${cree.clientName}.`)
                  router.refresh()
                } catch (err) {
                  setErreurCreation(err instanceof Error ? err.message : "L'enregistrement a échoué.")
                } finally {
                  setCreationEnCours(false)
                }
              }}
              className="p-6 space-y-4"
            >
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Nom du Client / Raison Sociale</label>
                <input
                  type="text"
                  required
                  value={nouveauClient}
                  onChange={(e) => setNouveauClient(e.target.value)}
                  placeholder="Nom complet du client, ou raison sociale"
                  className="w-full h-12 px-4 text-xs sm:text-sm font-bold rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Programme d&apos;Immigration Requis</label>
                <select
                  value={nouveauProgramme}
                  onChange={(e) => setNouveauProgramme(e.target.value)}
                  className="w-full h-12 px-4 text-xs sm:text-sm font-bold rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none"
                >
                  <option value="PEQ">Résidence Permanente (PEQ Québec)</option>
                  <option value="EE">Entrée Express (Catégorie Santé / Tech)</option>
                  <option value="VTR">Visa de Visiteur (VTR / TRV)</option>
                  <option value="SUPER_VISA">Super Visa (Parents & Grands-Parents)</option>
                  <option value="PTO">Permis de Travail Ouvert (PTO / Mobilité Francophone)</option>
                  <option value="EIMT">Permis de Travail / EIMT Volet Talent</option>
                  <option value="CAQ">Permis d&apos;études & CAQ Québec</option>
                  <option value="Parrainage">Parrainage Familial / Époux & Conjoint de fait</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">CRIC responsable</label>
                {/* Ce champ affichait « Adama Diarra (RCIC #R512345) », un
                    numéro de permis inventé porté au nom du titulaire. Il est
                    lu du profil du cabinet, et n'affiche rien s'il n'y est
                    pas : un permis plausible affiché par défaut est une faute
                    déontologique, pas un dépannage. */}
                <input
                  type="text"
                  readOnly
                  value={
                    firm.rcicName
                      ? `${firm.rcicName}${firm.rcicNumber ? ` (permis CICC #${firm.rcicNumber})` : ""}`
                      : "Titulaire non renseigné — complétez le profil du cabinet"
                  }
                  className="w-full h-12 px-4 text-xs font-bold rounded-2xl bg-slate-100 border border-slate-200 text-slate-700"
                />
              </div>

              {erreurCreation && (
                <p role="alert" className="rounded-2xl bg-rose-50 border border-rose-200 px-4 py-2.5 text-xs font-bold text-rose-800">
                  {erreurCreation}
                </p>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={creationEnCours || !nouveauClient.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 text-xs sm:text-sm font-bold shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                  <span>{creationEnCours ? "Enregistrement…" : "Créer le dossier"}</span>
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* TIROIR COULISSANT LATERAL SANS PERTE DE CONTEXTE */}
      <SideSheetDrawer
        isOpen={!!drawerMatter}
        onClose={() => setDrawerMatter(null)}
        title={drawerMatter?.clientName || "Dossier Client"}
        subtitle={`Programme ${drawerMatter?.program} · ID: ${drawerMatter?.id}`}
        badgeText={drawerMatter?.status === "valid" ? "Conforme CICC" : drawerMatter?.status === "alert" ? "Pièce Manquante" : "En Révision"}
        badgeVariant={drawerMatter?.status === "valid" ? "emerald" : drawerMatter?.status === "alert" ? "amber" : "blue"}
      >
        {drawerMatter && (
          <div className="space-y-6 text-xs text-slate-800">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <h4 className="font-black text-slate-900 text-sm flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-600" /> Profil Candidate & Procédure
              </h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-500 font-bold block">Nom du Client :</span>
                  <span className="font-bold text-slate-900">{drawerMatter.clientName}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block">Programme IRCC :</span>
                  <span className="font-bold text-indigo-700">{drawerMatter.program}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block">Échéance Réglementaire :</span>
                  <span className="font-mono font-bold text-amber-700">{drawerMatter.deadline || "à fixer"}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block">Consultant RCIC :</span>
                  <span className="font-bold text-slate-900">{drawerMatter.rcic}</span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-5 rounded-2xl shadow-md space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-300 uppercase font-mono">Solde Fidéicommis (Art. 13)</span>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">$5,000.00 CAD</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Les fonds sont protégés en fiducie. Le virement vers le compte général sera proposé après validation de l&apos;étape de service.
              </p>
            </div>

            <div className="pt-2 flex items-center gap-3">
              <Link
                href={`/matters/${drawerMatter.id.replace('#', '')}`}
                className="w-full py-3 bg-indigo-900 hover:bg-indigo-950 text-white font-bold rounded-2xl text-center shadow-md transition-all flex items-center justify-center gap-2"
              >
                <span>Ouvrir la Fiche Complète du Dossier</span>
                <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}
      </SideSheetDrawer>

    </div>
  )
}
