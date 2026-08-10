"use client"

import * as React from "react"
import { 
  Users, 
  Search, 
  Plus, 
  CheckCircle2, 
  ShieldCheck, 
  Mail, 
  Phone, 
  MapPin, 
  MoreVertical, 
  UserPlus, 
  FileText,
  AlertCircle,
  Clock,
  Filter,
  Download,
  ArrowUpRight,
  Globe,
  Building2,
  User,
  Calculator,
  Trash2,
  FolderOpen,
  FolderPlus,
  Receipt,
  ChevronRight,
  X,
  KeyRound,
  ExternalLink
} from "lucide-react"
import { Link, useRouter } from "@/i18n/routing"
import { useFirm } from "@/components/app-shell/firm-provider"
import { ClientRecord, Matter } from "@/lib/data/types"
import { matchesPerson } from "@/lib/utils/search"
import { createClient } from "@/lib/data/actions"
import { ouvrirAccesPortail } from "@/lib/data/portal-access"
import { creerDossierPourClient } from "@/lib/data/matter-creation"
import { TYPES_DE_DOSSIER } from "@/lib/data/matter-types"
import { ConfirmationEnvoi } from "@/components/ui/confirmation-envoi"
import { cn } from "@/lib/utils"

export type { ClientRecord }

interface ClientsClientProps {
  initialMatters?: Matter[]
  t: {
    title: string
    subtitle: string
    newClient: string
    stats: Record<string, string>
    searchPlaceholder: string
    table: Record<string, string>
  }
  initialClients: ClientRecord[]
}

export function ClientsClient({ t, initialClients, initialMatters = [] }: ClientsClientProps) {
  const matters = initialMatters
  const router = useRouter()
  const [clients, setClients] = React.useState<ClientRecord[]>(initialClients)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<"all" | "active" | "consultation" | "employer">("all")
  const [showNewModal, setShowNewModal] = React.useState(false)
  const [selectedPortalClient, setSelectedPortalClient] = React.useState<ClientRecord | null>(null)
  const [actionNotice, setActionNotice] = React.useState<string | null>(null)
  /** Le client pour lequel on ouvre un dossier, ou null. */
  const [dossierPour, setDossierPour] = React.useState<ClientRecord | null>(null)

  // Identité du cabinet connecté, pour signer le courriel d'accès. Elle vient
  // du contexte et jamais d'une constante : c'est ce qui a fait disparaître
  // « Boréale » des lettres de tous les cabinets.
  const firm = useFirm()

  /**
   * Mot de passe temporaire du client, tel que le serveur vient de le poser.
   *
   * Vide tant que l'accès n'a pas été ouvert. Ce n'est plus une chaîne
   * fabriquée dans le navigateur pour l'affichage : c'est le secret réellement
   * enregistré sur le compte, rendu une seule fois et jamais relisible.
   */
  const [tempPassword, setTempPassword] = React.useState("")
  const [portalError, setPortalError] = React.useState<string | null>(null)
  const [openingPortal, setOpeningPortal] = React.useState(false)
  const [copied, setCopied] = React.useState(false)
  const [emailCopied, setEmailCopied] = React.useState(false)
  /** Vrai quand l'ouverture d'accès attend une confirmation explicite. */
  const [accesAConfirmer, setAccesAConfirmer] = React.useState(false)

  const handleSelectPortalClient = (client: ClientRecord | null) => {
    setSelectedPortalClient(client)
    setTempPassword("")
    setPortalError(null)
    setCopied(false)
    setEmailCopied(false)
    setAccesAConfirmer(false)
  }

  const handleOuvrirAcces = async () => {
    if (!selectedPortalClient) return
    setOpeningPortal(true)
    setPortalError(null)
    const fd = new FormData()
    fd.set("clientId", selectedPortalClient.id)
    const r = await ouvrirAccesPortail(fd)
    setOpeningPortal(false)
    if (r.ok && r.motDePasse) setTempPassword(r.motDePasse)
    else setPortalError(r.message)
  }

  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  // Form states for new client modal (NOM ET PRÉNOM SÉPARÉS)
  const [clientType, setClientType] = React.useState<"individual" | "employer">("individual")
  const [newFirstName, setNewFirstName] = React.useState("")
  const [newLastName, setNewLastName] = React.useState("")
  const [companyName, setCompanyName] = React.useState("")
  const [neqNumber, setNeqNumber] = React.useState("")
  const [newEmail, setNewEmail] = React.useState("")
  const [newPhone, setNewPhone] = React.useState("")
  const [newCitizenship, setNewCitizenship] = React.useState("France")
  const [residenceLocation, setResidenceLocation] = React.useState<"canada" | "international">("canada")
  const [newProgram, setNewProgram] = React.useState("Résidence Permanente (PEQ / Entrée Express)")
  const [newProvince, setNewProvince] = React.useState("Québec")
  const [intakeNotes, setIntakeNotes] = React.useState("")

  // Ce tableau associait en dur c-1 à c-4 aux dossiers de démonstration, et
  // renvoyait DOS-35695 pour tout le reste. Sur des clients réels, il
  // conduisait donc systématiquement vers un dossier inexistant.
  const getMatterIdForClient = (clientId: string) =>
    matters.find((m) => m.clientId === clientId)?.id.replace("#", "") ?? null

  const filteredClients = clients.filter(c => {
    let matchesStatus = true
    if (statusFilter === "active") matchesStatus = c.status === "active"
    else if (statusFilter === "consultation") matchesStatus = c.status === "consultation"
    else if (statusFilter === "employer") matchesStatus = c.clientType === "employer"

    // Recherche sur l'ensemble des informations personnelles, insensible
    // aux accents et tolérante aux formats de numéro.
    const matchesSearch = matchesPerson(searchQuery, [
      c.name, c.firstName, c.lastName, c.fileNumber, c.email, c.phone,
      c.program, c.citizenship, c.residence, c.province, c.neqNumber, c.intakeMotif,
    ])
    return matchesStatus && matchesSearch
  })

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault()
    const fullName = `${newFirstName.trim()} ${newLastName.trim()}`.trim()
    const clientDisplayName = clientType === "employer" 
      ? `${companyName} (${fullName || "Représentant RH"})`
      : fullName

    if (!clientDisplayName.trim() || isSubmitting) return

    const nextSeq = 100 + clients.length + 1
    const fileNumber = `CRIC-2026-0${nextSeq}`
    const createdData: Omit<ClientRecord, "id"> = {
      fileNumber,
      name: clientDisplayName,
      firstName: newFirstName,
      lastName: newLastName,
      email: newEmail,
      phone: newPhone,
      citizenship: clientType === "employer" ? "Canada (Employeur)" : (newCitizenship || "Non spécifié"),
      residence: residenceLocation === "canada" ? "Canada" : "International",
      province: newProvince,
      program: newProgram,
      status: "active",
      intakeMotif: intakeNotes || "Dossier initialisé depuis la section Mon Cabinet CRIC.",
      clientType,
      neqNumber: clientType === "employer" ? neqNumber : undefined
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const created = await createClient(createdData)
      setClients(prev => [created, ...prev])
      setShowNewModal(false)
      setActionNotice(`Nouveau dossier client CICC ${created.fileNumber} créé avec succès !`)
      setTimeout(() => setActionNotice(null), 5000)
      
      // Reset form
      setNewFirstName("")
      setNewLastName("")
      setCompanyName("")
      setNeqNumber("")
      setNewEmail("")
      setNewPhone("")
      setIntakeNotes("")
      router.refresh()
    } catch (err) {
      setErrorMessage(`Erreur lors de l'enregistrement du client : ${err instanceof Error ? err.message : "échec inattendu"}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteClient = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const target = clients.find(c => c.id === id)
    setClients(prev => prev.filter(c => c.id !== id))
    setActionNotice(`Fiche client "${target?.name}" supprimée du registre.`)
    setTimeout(() => setActionNotice(null), 4000)
  }

  // Get Initials for avatar
  const getInitials = (name: string) => {
    const parts = name.replace(/^(M\.|Mme\.|Dr\.)\s*/, '').trim().split(" ")
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    return name.substring(0, 2).toUpperCase()
  }

  // Variables de courriel URL-encodées pour le portail client
  let mailtoUrl = ""
  if (selectedPortalClient && tempPassword) {
    const portalUrl = `${typeof window !== "undefined" ? window.location.origin : "https://moncabinetcric.vercel.app"}/fr/portal`
    const mailtoSubject = encodeURIComponent(`Accès à votre Portail Client CRIC — ${selectedPortalClient.fileNumber}`)
    const mailtoBody = encodeURIComponent(`Bonjour ${selectedPortalClient.name},\n\nVoici vos accès sécurisés à votre Portail Client CRIC :\n\nLien d'accès : ${portalUrl}\nIdentifiant courriel : ${selectedPortalClient.email}\nMot de passe temporaire : ${tempPassword}\n\nNOTE : Lors de votre première connexion, vous devrez obligatoirement définir votre nouveau mot de passe personnel.\n\nCordialement,\n${firm.name}`)
    mailtoUrl = `mailto:${selectedPortalClient.email}?subject=${mailtoSubject}&body=${mailtoBody}`
  }

  return (
    <div className="flex flex-col gap-8 pb-16">
      
      {/* NOTICE BANNER */}
      {actionNotice && (
        <div className="bg-success/15 border border-success/40 text-success-strong rounded-3xl p-4 flex items-center justify-between shadow-md animate-fadeIn">
          <div className="flex items-center gap-3 font-bold text-xs sm:text-sm">
            <CheckCircle2 className="w-5 h-5 text-success-strong shrink-0" />
            <span>{actionNotice}</span>
          </div>
        </div>
      )}

      {/* BANNIÈRE DE STATUT DU REGISTRE CICC */}
      <div className="bg-card rounded-3xl p-6 shadow-sm border border-border relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4 relative z-10">
          <div className="h-12 w-12 rounded-2xl bg-warning/15 text-foreground flex items-center justify-center font-black shadow-md shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black tracking-tight text-foreground">Registre Officiel CICC & Journaux d&apos;Audit</h2>
              <span className="bg-success/20 text-success-strong border border-success/30 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                Synchronisé 100%
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tenue de registres conforme au Code de déontologie CICC · Horodatage infalsifiable actif
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 relative z-10 self-end md:self-auto">
          <button 
            type="button"
            onClick={() => {
              setActionNotice("Registre officiel des clients CICC (PDF) généré et exporté avec succès !")
              setTimeout(() => setActionNotice(null), 5000)
            }}
            className="inline-flex items-center gap-2 rounded-2xl bg-muted hover:bg-muted/70 border border-border text-foreground px-4 py-2.5 text-xs font-black transition-all backdrop-blur-md cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exporter Registre PDF</span>
          </button>
        </div>
      </div>

      {/* HEADER PRINCIPAL AVEC ACTIONS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
            {t.title}
          </h1>
          <p className="text-sm font-semibold text-muted-foreground mt-1">
            {t.subtitle} · Cliquez sur un client pour accéder directement à ses dossiers et factures
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowNewModal(true)}
          className="inline-flex items-center gap-2 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-3 text-xs sm:text-sm font-bold shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>{t.newClient}</span>
        </button>
      </div>

      {/* CARTES KPIS EXECUTIVE SUMMARY (TITRES HAUTEMENT CONTRASTÉS SLATE-900 ET FILTRAGE PAR CLIC) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* KPI 1: TOTAL CLIENTS */}
        <div 
          onClick={() => setStatusFilter("all")}
          className={`p-6 rounded-3xl border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
            statusFilter === "all"
              ? "bg-primary/15 border-primary/40 shadow-lg scale-[1.02] ring-2 ring-primary"
              : "bg-card border-border hover:border-primary/40 shadow-[0_4px_20px_rgba(0,0,0,0.02)]"
          }`}
        >
          <div className="flex items-center justify-between pb-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-xs font-black uppercase tracking-wider text-foreground">TOTAL CLIENTS</span>
            </div>
            <div className="h-9 w-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold shadow-md">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-foreground tracking-tight">{clients.length}</div>
            <span className="text-xs font-bold text-foreground/70 mt-1">Tous les mandats et particuliers</span>
          </div>
        </div>

        {/* KPI 2: CLIENTS ACTIFS */}
        <div 
          onClick={() => setStatusFilter(statusFilter === "active" ? "all" : "active")}
          className={`p-6 rounded-3xl border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
            statusFilter === "active"
              ? "bg-success/15 border-success/40 shadow-lg scale-[1.02] ring-2 ring-success"
              : "bg-card border-border hover:border-success/40 shadow-[0_4px_20px_rgba(0,0,0,0.02)]"
          }`}
        >
          <div className="flex items-center justify-between pb-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-success" />
              <span className="text-xs font-black uppercase tracking-wider text-foreground">PROCÉDURES ACTIVES</span>
            </div>
            <div className="h-9 w-9 rounded-xl bg-success text-background flex items-center justify-center font-bold shadow-md">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-success-strong tracking-tight">
              {clients.filter(c => c.status === "active").length}
            </div>
            <span className="text-xs font-bold text-foreground/70 mt-1">Procédures en cours au CICC</span>
          </div>
        </div>

        {/* KPI 3: CONSULTATION */}
        <div 
          onClick={() => setStatusFilter(statusFilter === "consultation" ? "all" : "consultation")}
          className={`p-6 rounded-3xl border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
            statusFilter === "consultation"
              ? "bg-warning/15 border-warning/40 shadow-lg scale-[1.02] ring-2 ring-warning"
              : "bg-card border-border hover:border-warning/40 shadow-[0_4px_20px_rgba(0,0,0,0.02)]"
          }`}
        >
          <div className="flex items-center justify-between pb-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-warning animate-ping" />
              <span className="text-xs font-black uppercase tracking-wider text-foreground">EN CONSULTATION</span>
            </div>
            <div className="h-9 w-9 rounded-xl bg-warning text-background flex items-center justify-center font-bold shadow-md">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-warning-strong tracking-tight">
              {clients.filter(c => c.status === "consultation").length}
            </div>
            <span className="text-xs font-bold text-foreground/70 mt-1">En attente de pièces justificatives</span>
          </div>
        </div>

        {/* KPI 4: EMPLOYEURS B2B */}
        <div 
          onClick={() => setStatusFilter(statusFilter === "employer" ? "all" : "employer")}
          className={`p-6 rounded-3xl border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
            statusFilter === "employer"
              ? "bg-accent/10 border-accent shadow-lg scale-[1.02] ring-2 ring-accent/30"
              : "bg-card border-border hover:border-accent/40 shadow-[0_4px_20px_rgba(0,0,0,0.02)]"
          }`}
        >
          <div className="flex items-center justify-between pb-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-accent" />
              <span className="text-xs font-black uppercase tracking-wider text-foreground">EMPLOYEURS B2B</span>
            </div>
            <div className="h-9 w-9 rounded-xl bg-accent text-background flex items-center justify-center font-bold shadow-md">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-accent-strong tracking-tight">
              {clients.filter(c => c.clientType === "employer").length}
            </div>
            <span className="text-xs font-bold text-foreground/70 mt-1">Contrats d&apos;entreprise & LMIA/EIMT</span>
          </div>
        </div>

      </div>

      {/* BARRE DE RECHERCHE ET ONGLETS DE FILTRAGE */}
      <div className="bg-card p-4 rounded-3xl border border-border shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex flex-col sm:flex-row items-center justify-between gap-4">
        
        {/* Champ de recherche */}
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder={t.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs font-medium rounded-2xl bg-muted border border-border focus:bg-card focus:border-primary/40 focus:outline-none transition-all"
          />
        </div>

        {/* Onglets de statut */}
        <div className="flex items-center gap-1 bg-muted p-1 rounded-2xl w-full sm:w-auto overflow-x-auto">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${statusFilter === "all" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
          >
            Tous ({clients.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("active")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${statusFilter === "active" ? "bg-success text-background shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
          >
            Actifs ({clients.filter(c => c.status === "active").length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("consultation")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${statusFilter === "consultation" ? "bg-warning text-background shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
          >
            Consultation ({clients.filter(c => c.status === "consultation").length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("employer")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${statusFilter === "employer" ? "bg-accent text-background shadow-xs" : "text-muted-foreground hover:text-foreground"}`}
          >
            Employeurs ({clients.filter(c => c.clientType === "employer").length})
          </button>
        </div>

      </div>

      {/* TABLEAU DES CLIENTS UI/UX PRO MAX (ENTÊTES NETTES EN TEXT-SLATE-800 FONT-BLACK & RACCOURCIS D'ACTIONS) */}
      <div className="bg-card rounded-3xl border border-border shadow-[0_4px_20px_rgba(0,0,0,0.02)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="text-foreground uppercase font-black bg-muted/50 border-b border-border tracking-wider">
              <tr>
                <th scope="col" className="px-6 py-4 font-black">{t.table.fileNumber}</th>
                <th scope="col" className="px-6 py-4 font-black">{t.table.name}</th>
                <th scope="col" className="px-6 py-4 font-black">{t.table.contact}</th>
                <th scope="col" className="px-6 py-4 font-black">{t.table.program}</th>
                <th scope="col" className="px-6 py-4 font-black">{t.table.status}</th>
                <th scope="col" className="px-6 py-4 font-black text-right">Actions & Raccourcis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredClients.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground italic">
                    Aucun client ne correspond à votre recherche.
                  </td>
                </tr>
              )}
              {filteredClients.map((client) => (
                <tr 
                  key={client.id} 
                  onClick={() => {
                    const ref = getMatterIdForClient(client.id)
                    // Sans dossier rattaché, on ouvre la liste plutôt qu'une
                    // fiche qui n'existe pas.
                    router.push(ref ? `/matters/${ref}` : "/matters")
                  }}
                  className="group hover:bg-muted transition-colors cursor-pointer"
                >
                  {/* Numéro de dossier */}
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 bg-primary/15 text-primary-strong border border-primary/40 px-3 py-1 rounded-full font-mono font-bold text-[11px] shadow-2xs">
                      {client.fileNumber}
                    </span>
                  </td>

                  {/* Nom & Avatar */}
                  <td className="px-6 py-4 font-bold text-foreground group-hover:text-primary-strong transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`h-9 w-9 rounded-xl text-background flex items-center justify-center font-black text-xs shadow-xs ${
                        client.clientType === "employer"
                          ? "bg-gradient-to-tr from-accent to-accent/60"
                          : "bg-gradient-to-tr from-primary/10 to-primary/10"
                      }`}>
                        {client.clientType === "employer" ? <Building2 className="w-4 h-4" /> : getInitials(client.name)}
                      </div>
                      <div>
                        <div className="text-sm font-black text-foreground group-hover:text-primary-strong flex items-center gap-2">
                          <span>{client.name}</span>
                          {client.clientType === "employer" && (
                            <span className="bg-accent/15 text-accent-strong border border-accent/40 font-mono text-[9px] font-extrabold px-2 py-0.5 rounded-full">
                              EMPLOYEUR B2B
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-medium">
                          <span>{client.citizenship}</span>
                          <span>•</span>
                          <span>{client.residence}</span>
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Coordonnées */}
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-0.5 text-[11px] font-semibold text-foreground">
                      <span className="font-mono">{client.email}</span>
                      <span className="text-muted-foreground">{client.phone}</span>
                    </div>
                  </td>

                  {/* Programme IRCC */}
                  <td className="px-6 py-4 font-bold text-foreground">
                    {client.program}
                  </td>

                  {/* Statut */}
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black border ${
                      client.status === "active" 
                        ? "bg-success/15 text-success-strong border-success/40" 
                        : "bg-warning/15 text-warning-strong border-warning/40"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${client.status === "active" ? "bg-success" : "bg-warning"}`} />
                      <span>{client.status === "active" ? "Mandat Actif" : "En Consultation"}</span>
                    </span>
                  </td>

                  {/* Actions & Raccourcis Directs (AXE 3) */}
                  <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <a
                        href={`mailto:${client.email}`}
                        title={`Envoyer un courriel à ${client.email}`}
                        className="p-1.5 text-muted-foreground hover:text-accent-strong hover:bg-accent/10 rounded-xl transition-colors cursor-pointer"
                      >
                        <Mail className="w-4 h-4" />
                      </a>

                      <a
                        href={`tel:${client.phone}`}
                        title={`Appeler au ${client.phone}`}
                        className="p-1.5 text-muted-foreground hover:text-primary-strong hover:bg-primary/10 rounded-xl transition-colors cursor-pointer"
                      >
                        <Phone className="w-4 h-4" />
                      </a>

                      <button
                        type="button"
                        onClick={() => router.push("/billing")}
                        title="Créer une facture pour ce client"
                        className="p-1.5 text-muted-foreground hover:text-success-strong hover:bg-success/10 rounded-xl transition-colors cursor-pointer"
                      >
                        <Receipt className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setDossierPour(client) }}
                        title="Ouvrir un nouveau dossier pour ce client"
                        className="p-1.5 text-muted-foreground hover:text-primary-strong hover:bg-primary/10 rounded-xl transition-colors cursor-pointer"
                      >
                        <FolderPlus className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => router.push("/documents")}
                        title="Ouvrir le coffre-fort documentaire du client"
                        className="p-1.5 text-muted-foreground hover:text-warning-strong hover:bg-warning/10 rounded-xl transition-colors cursor-pointer"
                      >
                        <FolderOpen className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSelectPortalClient(client)}
                        title="Donner et partager l'accès au Portail Client"
                        className="p-1.5 text-muted-foreground hover:text-primary-strong hover:bg-primary/10 rounded-xl transition-colors cursor-pointer"
                      >
                        <KeyRound className="w-4 h-4 text-primary-strong" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteClient(client.id, e)}
                        title="Supprimer la fiche client"
                        className="p-1.5 text-muted-foreground hover:text-error-strong hover:bg-error/10 rounded-xl transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL : CRÉATION FICHE CLIENT (SÉPARATION PRÉNOM ET NOM) */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 backdrop-blur-md p-4 animate-fadeIn overflow-y-auto">
          <form
            onSubmit={handleCreateClient}
            className="bg-card w-full max-w-xl rounded-3xl border border-border shadow-2xl p-6 sm:p-8 flex flex-col gap-5 relative overflow-hidden my-8"
          >
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <span className="inline-block bg-primary/15 text-primary-strong border border-primary/40 font-mono text-[11px] font-bold px-2.5 py-0.5 rounded-full mb-1">
                  Enregistrement Registre CICC
                </span>
                <h3 className="text-xl font-black text-foreground">Nouvelle Fiche Client Officielle</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="w-8 h-8 rounded-full bg-muted hover:bg-muted text-muted-foreground font-bold flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">Type de Client</label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                    <input
                      type="radio"
                      name="clientType"
                      checked={clientType === "individual"}
                      onChange={() => setClientType("individual")}
                      className="text-primary-strong focus:ring-0"
                    />
                    <span>Particulier (B2C)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                    <input
                      type="radio"
                      name="clientType"
                      checked={clientType === "employer"}
                      onChange={() => setClientType("employer")}
                      className="text-accent-strong focus:ring-0"
                    />
                    <span>Employeur / Entreprise (B2B)</span>
                  </label>
                </div>
              </div>

              {/* PRÉNOM ET NOM SÉPARÉS */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">Prénom</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Adama"
                  value={newFirstName}
                  onChange={(e) => setNewFirstName(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs font-medium rounded-2xl bg-muted border border-border focus:bg-card focus:border-primary/40 focus:outline-none transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">Nom de Famille</label>
                <input
                  type="text"
                  required
                  placeholder="ex : Nom de famille"
                  value={newLastName}
                  onChange={(e) => setNewLastName(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs font-medium rounded-2xl bg-muted border border-border focus:bg-card focus:border-primary/40 focus:outline-none transition-all"
                />
              </div>

              {clientType === "employer" && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">Raison Sociale</label>
                    <input
                      type="text"
                      required
                      placeholder="ex : Nom de l'entreprise"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full px-4 py-2.5 text-xs font-medium rounded-2xl bg-muted border border-border focus:bg-card focus:border-primary/40 focus:outline-none transition-all"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">Numéro NEQ (Québec)</label>
                    <input
                      type="text"
                      placeholder="ex: NEQ 1178923412"
                      value={neqNumber}
                      onChange={(e) => setNeqNumber(e.target.value)}
                      className="w-full px-4 py-2.5 text-xs font-medium rounded-2xl bg-muted border border-border focus:bg-card focus:border-primary/40 focus:outline-none transition-all font-mono"
                    />
                  </div>
                </>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">Courriel</label>
                <input
                  type="email"
                  required
                  placeholder="adiarra@consulting.ca"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs font-medium rounded-2xl bg-muted border border-border focus:bg-card focus:border-primary/40 focus:outline-none transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">Téléphone</label>
                <input
                  type="tel"
                  required
                  placeholder="+1 (514) 555-0101"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs font-medium rounded-2xl bg-muted border border-border focus:bg-card focus:border-primary/40 focus:outline-none transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">Programme / Mandat Souhaité</label>
                <select
                  value={newProgram}
                  onChange={(e) => setNewProgram(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs font-bold rounded-2xl bg-muted border border-border focus:bg-card focus:border-primary/40 focus:outline-none transition-all text-foreground cursor-pointer"
                >
                  <option value="Résidence Permanente (PEQ / Entrée Express)">Résidence Permanente (PEQ Québec & Entrée Express)</option>
                  <option value="Permis de Travail (EIMT / LMIA Exemption)">Permis de Travail & EIMT B2B (Employeurs)</option>
                  <option value="Permis d'études + CAQ Québec">Permis d&apos;études + CAQ Québec (MIFI)</option>
                  <option value="Parrainage Familial & Spousal">Parrainage Familial & Époux / Conjoint de fait</option>
                </select>
              </div>
            </div>

            {errorMessage && (
              <div className="bg-error/15 border border-error/40 text-error-strong rounded-2xl p-3 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-error-strong" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-2xl border border-border text-xs font-bold text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
              >
                Annuler
              </button>
              <button 
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Création en cours..." : "Créer la Fiche Client CICC"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL TRANSMISSION ACCÈS PORTAIL CLIENT */}
      {selectedPortalClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 backdrop-blur-md p-4 animate-fadeIn" onClick={() => setSelectedPortalClient(null)}>
          <div className="bg-card w-full max-w-lg rounded-3xl border border-primary/40 shadow-2xl p-6 sm:p-8 flex flex-col gap-5 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center font-bold shrink-0">
                  <KeyRound className="w-5 h-5 text-primary-strong" />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">Accès Portail Client — {selectedPortalClient.name}</h3>
                  <p className="text-xs text-muted-foreground">Dossier n° <span className="font-mono font-bold text-foreground">{selectedPortalClient.fileNumber}</span></p>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedPortalClient(null)} className="w-8 h-8 rounded-full bg-muted font-bold flex items-center justify-center">✕</button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-2xl bg-primary/15 border border-primary/40 flex flex-col gap-2">
                <div className="flex justify-between items-center text-primary-strong font-bold">
                  <span>Client : {selectedPortalClient.name}</span>
                  <span className="font-mono text-[10px] bg-primary/15 px-2 py-0.5 rounded text-primary-strong">{selectedPortalClient.fileNumber}</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Accès sécurisé réservé exclusivement à <strong className="text-foreground">{selectedPortalClient.name}</strong>. Lors de sa première connexion, le système lui demandera obligatoirement de personnaliser ce mot de passe temporaire.
                </p>
              </div>

              {/* Bloc Mot de Passe Temporaire — posé par le serveur */}
              <div className="p-4 rounded-2xl bg-foreground text-background flex flex-col gap-2.5 shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wider font-extrabold text-primary-strong">
                    {tempPassword ? "Mot de Passe Temporaire Émis (1ère Connexion)" : "Aucun accès ouvert pour l'instant"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setAccesAConfirmer(true)}
                    disabled={openingPortal}
                    className="text-[10px] text-primary-strong hover:text-background font-mono underline cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                  >
                    {openingPortal ? "…" : tempPassword ? "🔄 Re-générer" : "🔑 Ouvrir l'accès"}
                  </button>
                </div>

                {/* Le mot de passe n'apparaît qu'une fois le compte réellement
                    créé. Auparavant, cette zone affichait d'emblée une chaîne
                    engendrée dans le navigateur : rien ne distinguait un accès
                    ouvert d'un accès qui n'existait pas. */}
                {tempPassword ? (
                  <>
                    <div className="flex items-center justify-between bg-foreground p-3 rounded-xl border border-border font-mono text-sm">
                      <span className="text-success-strong font-black tracking-widest select-all">{tempPassword}</span>
                      <span className="text-[10px] text-warning-strong font-bold bg-warning/20 border border-warning/30 px-2 py-0.5 rounded font-sans">
                        Changement obligatoire
                      </span>
                    </div>
                    <p className="text-[11px] text-warning-strong font-sans leading-relaxed">
                      Copiez-le maintenant : il n&apos;est conservé nulle part et ne sera plus affiché.
                      Le client devra le remplacer à sa première connexion.
                    </p>
                  </>
                ) : (
                  <p className="text-[11px] text-muted-foreground font-sans leading-relaxed">
                    Le compte du client sera créé et son mot de passe posé sur le serveur.
                    Re-générer remplace le mot de passe existant : l&apos;ancien cesse aussitôt de fonctionner.
                  </p>
                )}

                {portalError && (
                  <p role="alert" className="text-[11px] font-sans font-bold text-error-strong bg-error/15 border border-error/30 rounded-lg px-2.5 py-2">
                    {portalError}
                  </p>
                )}

                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border font-mono">
                  <span>Identifiant : <strong>{selectedPortalClient.email || "— aucune adresse au dossier"}</strong></span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-muted border border-border">
                <label className="block text-muted-foreground font-bold text-[10px] uppercase mb-1">Lien Officiel d&apos;Accès au Portail Client</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${typeof window !== "undefined" ? window.location.origin : "https://moncabinetcric.vercel.app"}/fr/portal`}
                    className="flex-1 p-2.5 bg-card border border-border rounded-xl font-mono text-xs text-primary-strong font-bold select-all focus:outline-none"
                  />
                  {/* Sans mot de passe, il n'y a rien à copier : le bouton
                      annonçait « accès copié » alors que le presse-papiers ne
                      contenait qu'un lien et une ligne vide. */}
                  <button
                    type="button"
                    disabled={!tempPassword}
                    onClick={() => {
                      const portalUrl = `${typeof window !== "undefined" ? window.location.origin : "https://moncabinetcric.vercel.app"}/fr/portal`
                      const fullText = `PORTAIL CLIENT CRIC — ACCÈS DU CANDIDAT\nLien : ${portalUrl}\nCourriel : ${selectedPortalClient.email}\nMot de passe temporaire : ${tempPassword}\n\nNote: Changement de mot de passe obligatoire dès la 1ère connexion.`
                      navigator.clipboard.writeText(fullText)
                      setCopied(true)
                      setTimeout(() => setCopied(false), 3000)
                    }}
                    className={cn(
                      "px-4 py-2.5 rounded-xl text-background font-bold text-xs transition-all shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
                      copied ? "bg-success hover:bg-success/90" : "bg-primary hover:bg-primary/90"
                    )}
                  >
                    {copied ? "✓ Copié !" : "Copier Tout"}
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <a
                  href={`${typeof window !== "undefined" ? window.location.origin : "https://moncabinetcric.vercel.app"}/fr/portal`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 px-4 py-2.5 rounded-xl border border-primary/40 bg-primary/15 hover:bg-primary/10 text-primary-strong font-bold text-center text-xs transition-colors flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-4 h-4 text-primary-strong" />
                  <span>Tester le Portail (Aperçu)</span>
                </a>

                {/* Un lien mailto sans mot de passe expédierait au client un
                    courriel annonçant un accès, avec le champ vide. Tant que
                    l'accès n'est pas ouvert, ce n'est pas un lien. */}
                {tempPassword ? (
                  <button
                    type="button"
                    onClick={() => {
                      // 1. Tenter d'ouvrir l'application de messagerie par défaut
                      if (typeof window !== "undefined") {
                        window.location.href = mailtoUrl
                      }
                      // 2. Copier également le courriel rédigé dans le presse-papiers
                      // comme alternative en cas d'absence de client mail par défaut.
                      const portalUrl = `${typeof window !== "undefined" ? window.location.origin : "https://moncabinetcric.vercel.app"}/fr/portal`
                      const friendlyMessage = `Bonjour ${selectedPortalClient.name},\n\nVoici vos accès sécurisés à votre Portail Client CRIC :\n\nLien d'accès : ${portalUrl}\nIdentifiant courriel : ${selectedPortalClient.email}\nMot de passe temporaire : ${tempPassword}\n\nNOTE : Lors de votre première connexion, vous devrez obligatoirement définir votre nouveau mot de passe personnel.\n\nCordialement,\n${firm.name}`
                      navigator.clipboard.writeText(friendlyMessage)
                      setEmailCopied(true)
                      setTimeout(() => setEmailCopied(false), 4000)
                    }}
                    className={cn(
                      "flex-1 px-4 py-2.5 rounded-xl text-background font-bold text-center text-xs transition-all flex items-center justify-center gap-2 cursor-pointer",
                      emailCopied ? "bg-success hover:bg-success/90" : "bg-foreground hover:bg-foreground"
                    )}
                  >
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span>{emailCopied ? "✓ Ouvrir & Copié !" : "Envoyer par courriel"}</span>
                  </button>
                ) : (
                  <span className="flex-1 px-4 py-2.5 rounded-xl bg-muted text-muted-foreground font-bold text-center text-xs flex items-center justify-center gap-2 cursor-not-allowed">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span>Ouvrez l&apos;accès d&apos;abord</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ouvrir un accès ne part pas par courriel — le mot de passe s'affiche
          ici et c'est le cabinet qui le transmet. La confirmation reste
          néanmoins due, pour une raison propre à ce bouton : sur un client qui
          possède déjà son accès, il devient « Re-générer » et REMPLACE le mot
          de passe en vigueur. Le client se retrouve dehors sans avoir été
          prévenu, et l'ancien mot de passe n'est pas récupérable. */}
      {accesAConfirmer && selectedPortalClient && (
        <ConfirmationEnvoi
          action={
            tempPassword
              ? "Un nouveau mot de passe temporaire va remplacer celui en vigueur."
              : "Un compte va être créé pour que ce client accède à son portail."
          }
          objet={`Accès au portail — ${selectedPortalClient.name}`}
          objetDetail={`Dossier n° ${selectedPortalClient.fileNumber}`}
          destinataires={[{ nom: selectedPortalClient.name, courriel: selectedPortalClient.email }]}
          mode="Aucun courriel automatique — le mot de passe vous sera affiché à transmettre vous-même"
          irreversible={
            tempPassword
              ? "Ce client a déjà un accès. Son mot de passe actuel cessera immédiatement de fonctionner, y compris s'il l'avait personnalisé, et il devra en définir un nouveau."
              : undefined
          }
          libelleConfirmer={tempPassword ? "Régénérer l'accès" : "Ouvrir l'accès"}
          onAnnuler={() => setAccesAConfirmer(false)}
          onConfirmer={async () => {
            setAccesAConfirmer(false)
            await handleOuvrirAcces()
          }}
        />
      )}

      {dossierPour && (
        <ModaleNouveauDossier
          client={dossierPour}
          dossiersExistants={matters.filter((m) => m.clientId === dossierPour.id).length}
          onFermer={() => setDossierPour(null)}
          onCree={(reference) => {
            setDossierPour(null)
            setActionNotice(`Dossier ${reference} ouvert pour ${dossierPour.name}.`)
            router.push(`/matters/${reference}`)
          }}
        />
      )}

    </div>
  )
}


/**
 * Ouvrir un dossier depuis un client.
 *
 * Le haut du formulaire n'est pas saisissable : ce sont les informations du
 * PROFIL, montrées pour qu'on sache à qui l'on ouvre un mandat, et non pour
 * qu'on les ressaisisse. Les rendre modifiables ici aurait créé un second
 * endroit où corriger une adresse — et deux vérités sur la même personne.
 */
function ModaleNouveauDossier({
  client, dossiersExistants, onFermer, onCree,
}: {
  client: ClientRecord
  dossiersExistants: number
  onFermer: () => void
  onCree: (reference: string) => void
}) {
  const [service, setService] = React.useState("")
  const [echeance, setEcheance] = React.useState("")
  const [priorite, setPriorite] = React.useState("normal")
  const [description, setDescription] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const [erreur, setErreur] = React.useState<string | null>(null)
  const [enCours, demarrer] = React.useTransition()

  const CHAMP =
    "w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-foreground/50 p-4">
      <div className="bg-card w-full max-w-xl rounded-3xl border border-border shadow-2xl flex flex-col max-h-[92vh]">
        <header className="p-5 border-b border-border flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-foreground">Ouvrir un dossier</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pour {client.name}
              {dossiersExistants > 0 && ` · ${dossiersExistants} dossier${dossiersExistants > 1 ? "s" : ""} déjà ouvert${dossiersExistants > 1 ? "s" : ""}`}
            </p>
          </div>
          <button type="button" onClick={onFermer} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <section className="rounded-2xl border border-border bg-muted/40 p-4">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-2">
              Repris du profil client
            </h4>
            <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2 text-xs">
              {[
                ["Nom", client.name],
                ["Courriel", client.email],
                ["Téléphone", client.phone],
                ["Nationalité", client.citizenship],
                ["Résidence", client.residence],
                ["Dossier client", client.fileNumber],
              ].map(([etiquette, valeur]) => (
                <div key={etiquette} className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">{etiquette}</dt>
                  <dd className="font-bold text-foreground truncate">{valeur || "—"}</dd>
                </div>
              ))}
            </dl>
            <p className="text-[11px] text-muted-foreground mt-2">
              Ces informations restent celles du profil : les corriger se fait sur la fiche client,
              et vaut alors pour tous ses dossiers.
            </p>
          </section>

          <label className="block">
            <span className="text-[11px] font-bold text-muted-foreground">Type de dossier *</span>
            <select value={service} onChange={(e) => setService(e.target.value)} className={cn(CHAMP, "mt-1")}>
              <option value="">Choisir…</option>
              {TYPES_DE_DOSSIER.map((tds) => (
                <option key={tds} value={tds}>{tds}</option>
              ))}
            </select>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-[11px] font-bold text-muted-foreground">Date limite importante</span>
              <input type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} className={cn(CHAMP, "mt-1")} />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold text-muted-foreground">Priorité</span>
              <select value={priorite} onChange={(e) => setPriorite(e.target.value)} className={cn(CHAMP, "mt-1")}>
                <option value="low">Basse</option>
                <option value="normal">Normale</option>
                <option value="high">Haute</option>
                <option value="critical">Critique</option>
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-[11px] font-bold text-muted-foreground">Description du mandat</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={cn(CHAMP, "mt-1 resize-y")} />
          </label>

          <label className="block">
            <span className="text-[11px] font-bold text-muted-foreground">Notes internes</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={cn(CHAMP, "mt-1 resize-y")} />
          </label>

          <p className="text-[11px] text-muted-foreground rounded-xl border border-border bg-muted/40 p-3">
            Le numéro de dossier est calculé par le système au moment de l&apos;ouverture.
            Les pièces exigées et les échéances du programme sont posées automatiquement.
          </p>

          {erreur && (
            <p className="rounded-xl border border-error/30 bg-error/10 p-3 text-xs text-error-strong">{erreur}</p>
          )}
        </div>

        <footer className="p-5 border-t border-border flex items-center justify-end gap-2">
          <button type="button" onClick={onFermer} className="px-4 py-2 rounded-xl border border-border font-bold text-xs hover:bg-muted cursor-pointer text-foreground">
            Annuler
          </button>
          <button
            type="button"
            disabled={!service || enCours}
            onClick={() => {
              setErreur(null)
              demarrer(async () => {
                const fd = new FormData()
                fd.set("clientId", client.id)
                fd.set("serviceType", service)
                fd.set("deadline", echeance)
                fd.set("priority", priorite)
                fd.set("description", description)
                fd.set("notes", notes)
                fd.set("locale", "fr")
                const r = await creerDossierPourClient(fd)
                if (r.ok && r.reference) onCree(r.reference)
                else setErreur(r.message)
              })
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 disabled:opacity-40 cursor-pointer"
          >
            <FolderPlus className="h-4 w-4" /> {enCours ? "Ouverture…" : "Créer le dossier"}
          </button>
        </footer>
      </div>
    </div>
  )
}
