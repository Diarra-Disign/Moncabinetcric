"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
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


/** Le statut d'un dossier, en un seul endroit. */
function StatutPastille({ statut }: { statut: string }) {
  const TONS: Record<string, { texte: string; classe: string; icone: React.ElementType }> = {
    valid: { texte: "Conforme", classe: "bg-success/15 text-success-strong border-success/30", icone: CheckCircle2 },
    alert: { texte: "Pièce manquante", classe: "bg-error/10 text-error-strong border-error/30", icone: AlertCircle },
    review: { texte: "En révision", classe: "bg-warning/15 text-warning-strong border-warning/40", icone: Clock },
    pending: { texte: "En attente", classe: "bg-muted text-foreground/70 border-border", icone: Clock },
  }
  const t = TONS[statut] ?? TONS.pending
  const Icone = t.icone
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border shrink-0", t.classe)}>
      <Icone className="w-3.5 h-3.5" /> {t.texte}
    </span>
  )
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
    <div className="flex flex-col gap-8 pb-20 selection:bg-primary selection:text-primary-foreground">
      
      {/* TOAST GLOBAL */}
      {toastNotice && (
        <div className="fixed top-20 right-6 z-[300] bg-foreground text-primary-foreground p-4 rounded-2xl shadow-2xl border border-foreground/70 font-bold text-xs sm:text-sm flex items-center gap-3 animate-slideInRight">
          <div className="h-9 w-9 rounded-xl bg-success text-primary-foreground flex items-center justify-center font-black shrink-0">
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
      <div className="bg-card rounded-3xl p-5 border border-border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* PROGRAM CATEGORY TABS */}
        <div className="flex items-center gap-1 bg-muted/60 p-1.5 rounded-2xl border border-border overflow-x-auto">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "all" ? "bg-primary text-primary-foreground shadow-xs font-black" : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            Tous ({matters.length})
          </button>
          <button
            onClick={() => setActiveTab("pr")}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "pr" ? "bg-primary text-primary-foreground shadow-xs font-black" : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            Résidence Permanente
          </button>
          <button
            onClick={() => setActiveTab("work")}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "work" ? "bg-primary text-primary-foreground shadow-xs font-black" : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            Permis Travail / EIMT
          </button>
          <button
            onClick={() => setActiveTab("study")}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "study" ? "bg-primary text-primary-foreground shadow-xs font-black" : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            Permis Études & CAQ
          </button>
          <button
            onClick={() => setActiveTab("tr")}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "tr" ? "bg-primary text-primary-foreground shadow-xs font-black" : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            Résidence Temporaire
          </button>
        </div>

        {/* SEARCH & STATUS FILTER */}
        <div className="flex items-center gap-3 max-w-md w-full">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Chercher par nom, dossier #DOS..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-xs font-bold rounded-xl bg-muted/60 border border-border focus:bg-card focus:border-primary focus:outline-none transition-all"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as "all" | "valid" | "alert" | "review")}
            className="h-10 px-3 text-xs font-bold rounded-xl bg-muted/60 border border-border focus:bg-card focus:border-primary focus:outline-none cursor-pointer"
          >
            <option value="all">Tous statuts</option>
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
            <h3 className="text-lg font-black text-foreground">
              Liste des Mandats ({filteredMatters.length})
            </h3>
            <span className="text-xs font-semibold text-muted-foreground">Cliquez sur un dossier pour le consulter</span>
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
                      ? "bg-primary/6 border-primary shadow-xs ring-2 ring-primary/20"
                      : "bg-card border-border hover:border-primary/40 hover:shadow-xs"
                  }`}
                >
                  {/* HEADER ROW */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-black text-foreground bg-card px-3 py-1 rounded-xl border border-border shadow-2xs">
                        {m.id}
                      </span>
                      {m.clientType === "b2b" ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-primary-strong bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/25">
                          <Building2 className="w-3 h-3" /> Entreprise B2B
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-primary-strong bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/25">
                          <User className="w-3 h-3" /> Particulier B2C
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setDrawerMatter(m); }}
                        className="px-2.5 py-1 rounded-xl bg-primary/10 hover:bg-primary/15 text-primary-strong border border-primary/25 text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                        title="Ouvrir le tiroir coulissant"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Coulissant</span>
                      </button>

                      <StatutPastille statut={m.status} />
                    </div>
                  </div>

                  {/* CLIENT & PROGRAM */}
                  <div>
                    <h4 className="text-xl font-black text-foreground group-hover:text-primary-strong transition-colors">
                      {m.clientName}
                    </h4>
                    <p className="text-xs sm:text-sm font-bold text-primary-strong mt-0.5">
                      {m.program}
                    </p>
                  </div>

                  {/* METADATA BAR */}
                  <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground font-medium">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-warning" /> Échéance : <strong className="text-foreground font-bold">{m.deadline || "à fixer"}</strong>
                    </span>
                    <span className="flex items-center gap-1 text-muted-foreground font-bold">
                      <User className="w-3.5 h-3.5 text-primary-strong" /> {m.rcic}
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
            <div className="bg-card rounded-3xl border border-dashed border-border p-10 text-center shadow-xs sticky top-6">
              <FolderOpen className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-black text-foreground">Aucun dossier sélectionné</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">Créez un premier dossier pour voir sa fiche s&apos;afficher ici.</p>
            </div>
          ) : (
          /**
           * Le panneau de droite SITUE un dossier ; il ne le rejoue pas.
           *
           * Il affichait auparavant un compte de fidéicommis, une liste
           * d'exigences IRCC et quatre actions rapides — c'est-à-dire une
           * seconde fiche, à côté de la vraie, accessible d'un clic. D'où
           * l'impression, juste, qu'on ne savait pas à quoi servait cette
           * page : elle faisait le travail de la suivante, en moins bien.
           *
           * Elle le faisait surtout avec des données INVENTÉES. « 5 000 $ CAD »
           * et « 1. Passeport principal (Valide > 6 mois) » étaient écrits en
           * dur : tous les dossiers de tous les cabinets affichaient le même
           * solde en fiducie et le même passeport coché. La fiche, elle, lit
           * client_trust_balance() et les exigences réelles. Deux nombres pour
           * le même fait, dont un faux — et c'est le rassurant qu'on croit.
           *
           * Ne reste ici que ce qu'une liste doit donner : de quoi reconnaître
           * le dossier, et une porte vers lui.
           */
          <div className="bg-card rounded-3xl border border-border p-6 shadow-md space-y-5 sticky top-6">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-black uppercase text-primary-strong bg-primary/10 px-3 py-1 rounded-full border border-primary/25 font-mono">
                {selectedMatter.id}
              </span>
              <StatutPastille statut={selectedMatter.status} />
            </div>

            <div>
              <h2 className="text-2xl font-black text-foreground leading-tight">
                {selectedMatter.clientName}
              </h2>
              <p className="text-sm font-extrabold text-primary-strong mt-0.5">
                {selectedMatter.program}
              </p>
            </div>

            <dl className="space-y-2.5 text-xs border-t border-border pt-4">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Consultant responsable</dt>
                <dd className="font-bold text-foreground">{selectedMatter.rcic || "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Ouvert le</dt>
                <dd className="font-bold text-foreground font-mono">{selectedMatter.openedDate || "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Prochaine échéance</dt>
                <dd className={cn("font-bold font-mono", selectedMatter.deadline ? "text-foreground" : "text-muted-foreground")}>
                  {selectedMatter.deadline || "à fixer"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Type de client</dt>
                <dd className="font-bold text-foreground">
                  {selectedMatter.clientType === "b2b" ? "Entreprise" : "Particulier"}
                </dd>
              </div>
            </dl>

            {selectedMatter.notes && (
              <p className="text-xs text-muted-foreground border-t border-border pt-4 whitespace-pre-wrap">
                {selectedMatter.notes}
              </p>
            )}

            {/* Une seule porte, et elle est grande. Les quatre « actions
                rapides » d'avant menaient toutes au même endroit. */}
            <Link
              href={`/matters/${selectedMatter.id.replace('#', '')}`}
              className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-2xl text-center shadow-md transition-all flex items-center justify-center gap-2 text-sm"
            >
              <span>Ouvrir le dossier</span>
              <ArrowUpRight className="w-4 h-4" />
            </Link>

            <p className="text-[11px] text-muted-foreground text-center">
              Fidéicommis, documents, formulaires, échéances et portail client
              s&apos;y trouvent, à jour.
            </p>
          </div>
          )}
        </div>

      </div>

      {/* 4. MODAL CRÉATION DE DOSSIER */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-foreground/50 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-card rounded-3xl border border-border shadow-2xl w-full max-w-lg overflow-hidden animate-scaleUp">
            
            <div className="p-6 border-b border-border bg-muted/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-foreground">Ouverture d&apos;un Nouveau Dossier CICC</h3>
                  <p className="text-xs text-muted-foreground font-medium">Initialisez un mandat client et générez la checklist IRCC.</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsNewModalOpen(false)}
                className="p-2 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground"
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
                <label className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">Nom du Client / Raison Sociale</label>
                <input
                  type="text"
                  required
                  value={nouveauClient}
                  onChange={(e) => setNouveauClient(e.target.value)}
                  placeholder="Nom complet du client, ou raison sociale"
                  className="w-full h-12 px-4 text-xs sm:text-sm font-bold rounded-2xl bg-muted/60 border border-border focus:bg-card focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">Programme d&apos;Immigration Requis</label>
                <select
                  value={nouveauProgramme}
                  onChange={(e) => setNouveauProgramme(e.target.value)}
                  className="w-full h-12 px-4 text-xs sm:text-sm font-bold rounded-2xl bg-muted/60 border border-border focus:bg-card focus:border-primary focus:outline-none"
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
                <label className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">CRIC responsable</label>
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
                  className="w-full h-12 px-4 text-xs font-bold rounded-2xl bg-muted border border-border text-muted-foreground"
                />
              </div>

              {erreurCreation && (
                <p role="alert" className="rounded-2xl bg-error/10 border border-error/30 px-4 py-2.5 text-xs font-bold text-error-strong">
                  {erreurCreation}
                </p>
              )}

              <div className="pt-3 border-t border-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-muted-foreground hover:text-foreground"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={creationEnCours || !nouveauClient.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary hover:bg-primary text-primary-foreground px-6 py-3 text-xs sm:text-sm font-bold shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div className="space-y-6 text-xs text-foreground">
            <div className="bg-card p-5 rounded-2xl border border-border shadow-xs space-y-3">
              <h4 className="font-black text-foreground text-sm flex items-center gap-2">
                <User className="w-4 h-4 text-primary-strong" /> Profil Candidate & Procédure
              </h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground font-bold block">Nom du Client :</span>
                  <span className="font-bold text-foreground">{drawerMatter.clientName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground font-bold block">Programme IRCC :</span>
                  <span className="font-bold text-primary-strong">{drawerMatter.program}</span>
                </div>
                <div>
                  <span className="text-muted-foreground font-bold block">Échéance Réglementaire :</span>
                  <span className="font-mono font-bold text-warning-strong">{drawerMatter.deadline || "à fixer"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground font-bold block">Consultant RCIC :</span>
                  <span className="font-bold text-foreground">{drawerMatter.rcic}</span>
                </div>
              </div>
            </div>

            {/* Le solde de fidéicommis a disparu d'ici, et c'est délibéré.
                Il valait « 5 000,00 $ CAD » en dur, pour tous les dossiers de
                tous les cabinets. Un montant en fiducie inventé, affiché sous
                l'article 13, à côté d'une fiche qui affiche le vrai — c'est
                exactement le genre de chiffre qu'on ne remet pas en question
                parce qu'il rassure. Le solde réel, calculé par
                client_trust_balance(), vit dans l'onglet Paiements du dossier. */}

            <div className="pt-2 flex items-center gap-3">
              <Link
                href={`/matters/${drawerMatter.id.replace('#', '')}`}
                className="w-full py-3 bg-foreground hover:bg-foreground text-primary-foreground font-bold rounded-2xl text-center shadow-md transition-all flex items-center justify-center gap-2"
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
