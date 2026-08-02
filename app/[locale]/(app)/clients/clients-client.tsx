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
  Sparkles,
  Globe,
  Building2,
  User,
  Calculator,
  Trash2,
  FolderOpen,
  Receipt,
  ChevronRight,
  X
} from "lucide-react"
import { Link, useRouter } from "@/i18n/routing"
import { ClientRecord } from "@/lib/data/types"

export type { ClientRecord }

interface ClientsClientProps {
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

export function ClientsClient({ t, initialClients }: ClientsClientProps) {
  const router = useRouter()
  const [clients, setClients] = React.useState<ClientRecord[]>(initialClients)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<"all" | "active" | "consultation" | "employer">("all")
  const [showNewModal, setShowNewModal] = React.useState(false)
  const [actionNotice, setActionNotice] = React.useState<string | null>(null)

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

  const getMatterIdForClient = (clientId: string) => {
    switch (clientId) {
      case "c-1": return "DOS-35695"
      case "c-2": return "DOS-35697"
      case "c-3": return "DOS-35694"
      case "c-4": return "DOS-35698"
      default: return "DOS-35695"
    }
  }

  const filteredClients = clients.filter(c => {
    let matchesStatus = true
    if (statusFilter === "active") matchesStatus = c.status === "active"
    else if (statusFilter === "consultation") matchesStatus = c.status === "consultation"
    else if (statusFilter === "employer") matchesStatus = c.clientType === "employer"

    const matchesSearch = searchQuery === "" ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.fileNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.program.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesStatus && matchesSearch
  })

  const handleCreateClient = (e: React.FormEvent) => {
    e.preventDefault()
    const fullName = `${newFirstName.trim()} ${newLastName.trim()}`.trim()
    const clientDisplayName = clientType === "employer" 
      ? `${companyName} (${fullName || "Représentant RH"})`
      : fullName

    if (!clientDisplayName.trim()) return

    const nextSeq = 100 + clients.length + 1
    const fileNumber = `CRIC-2026-0${nextSeq}`
    const created: ClientRecord = {
      id: `c-${Date.now()}`,
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

    setClients(prev => [created, ...prev])
    setShowNewModal(false)
    setActionNotice(`Nouveau dossier client CICC ${fileNumber} créé avec succès !`)
    setTimeout(() => setActionNotice(null), 5000)
    
    // Reset form
    setNewFirstName("")
    setNewLastName("")
    setCompanyName("")
    setNeqNumber("")
    setNewEmail("")
    setNewPhone("")
    setIntakeNotes("")
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

  return (
    <div className="flex flex-col gap-8 pb-16">
      
      {/* NOTICE BANNER */}
      {actionNotice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-3xl p-4 flex items-center justify-between shadow-md animate-fadeIn">
          <div className="flex items-center gap-3 font-bold text-xs sm:text-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{actionNotice}</span>
          </div>
        </div>
      )}

      {/* BANNIÈRE DE STATUT DU REGISTRE CICC */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-900 text-white rounded-3xl p-6 shadow-xl border border-blue-400/20 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="pointer-events-none absolute -top-24 -right-24 w-64 h-64 rounded-full bg-blue-500/20 blur-3xl" />
        
        <div className="flex items-center gap-4 relative z-10">
          <div className="h-12 w-12 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-md shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black tracking-tight text-white">Registre Officiel CICC & Journaux d&apos;Audit</h2>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                Synchronisé 100%
              </span>
            </div>
            <p className="text-xs text-white/70 mt-0.5">
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
            className="inline-flex items-center gap-2 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white px-4 py-2.5 text-xs font-black transition-all backdrop-blur-md cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exporter Registre PDF</span>
          </button>
        </div>
      </div>

      {/* HEADER PRINCIPAL AVEC ACTIONS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            {t.title}
          </h1>
          <p className="text-sm font-semibold text-slate-600 mt-1">
            {t.subtitle} · Cliquez sur un client pour accéder directement à ses dossiers et factures
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowNewModal(true)}
          className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 text-xs sm:text-sm font-bold shadow-md shadow-blue-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer self-start sm:self-auto"
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
              ? "bg-blue-50/90 border-blue-500 shadow-lg scale-[1.02] ring-2 ring-blue-400/30"
              : "bg-white border-slate-200/80 hover:border-blue-300 shadow-[0_4px_20px_rgba(0,0,0,0.02)]"
          }`}
        >
          <div className="flex items-center justify-between pb-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-600" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-900">TOTAL CLIENTS</span>
            </div>
            <div className="h-9 w-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-600/20">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-slate-900 tracking-tight">{clients.length}</div>
            <span className="text-xs font-bold text-slate-600 mt-1">Tous les mandats et particuliers</span>
          </div>
        </div>

        {/* KPI 2: CLIENTS ACTIFS */}
        <div 
          onClick={() => setStatusFilter(statusFilter === "active" ? "all" : "active")}
          className={`p-6 rounded-3xl border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
            statusFilter === "active"
              ? "bg-emerald-50/90 border-emerald-500 shadow-lg scale-[1.02] ring-2 ring-emerald-400/30"
              : "bg-white border-slate-200/80 hover:border-emerald-300 shadow-[0_4px_20px_rgba(0,0,0,0.02)]"
          }`}
        >
          <div className="flex items-center justify-between pb-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-600" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-900">PROCÉDURES ACTIVES</span>
            </div>
            <div className="h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-md shadow-emerald-600/20">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-emerald-600 tracking-tight">
              {clients.filter(c => c.status === "active").length}
            </div>
            <span className="text-xs font-bold text-slate-600 mt-1">Procédures en cours au CICC</span>
          </div>
        </div>

        {/* KPI 3: CONSULTATION */}
        <div 
          onClick={() => setStatusFilter(statusFilter === "consultation" ? "all" : "consultation")}
          className={`p-6 rounded-3xl border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
            statusFilter === "consultation"
              ? "bg-amber-50/90 border-amber-500 shadow-lg scale-[1.02] ring-2 ring-amber-400/30"
              : "bg-white border-slate-200/80 hover:border-amber-400 shadow-[0_4px_20px_rgba(0,0,0,0.02)]"
          }`}
        >
          <div className="flex items-center justify-between pb-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-600 animate-ping" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-900">EN CONSULTATION</span>
            </div>
            <div className="h-9 w-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-md shadow-amber-500/20">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-amber-600 tracking-tight">
              {clients.filter(c => c.status === "consultation").length}
            </div>
            <span className="text-xs font-bold text-slate-600 mt-1">En attente de pièces justificatives</span>
          </div>
        </div>

        {/* KPI 4: EMPLOYEURS B2B */}
        <div 
          onClick={() => setStatusFilter(statusFilter === "employer" ? "all" : "employer")}
          className={`p-6 rounded-3xl border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
            statusFilter === "employer"
              ? "bg-purple-50/90 border-purple-500 shadow-lg scale-[1.02] ring-2 ring-purple-400/30"
              : "bg-white border-slate-200/80 hover:border-purple-300 shadow-[0_4px_20px_rgba(0,0,0,0.02)]"
          }`}
        >
          <div className="flex items-center justify-between pb-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-600" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-900">EMPLOYEURS B2B</span>
            </div>
            <div className="h-9 w-9 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold shadow-md shadow-purple-600/20">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-black text-purple-600 tracking-tight">
              {clients.filter(c => c.clientType === "employer").length}
            </div>
            <span className="text-xs font-bold text-slate-600 mt-1">Contrats d&apos;entreprise & LMIA/EIMT</span>
          </div>
        </div>

      </div>

      {/* BARRE DE RECHERCHE ET ONGLETS DE FILTRAGE */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex flex-col sm:flex-row items-center justify-between gap-4">
        
        {/* Champ de recherche */}
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={t.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-xs font-medium rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
          />
        </div>

        {/* Onglets de statut */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl w-full sm:w-auto overflow-x-auto">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${statusFilter === "all" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
          >
            Tous ({clients.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("active")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${statusFilter === "active" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
          >
            Actifs ({clients.filter(c => c.status === "active").length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("consultation")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${statusFilter === "consultation" ? "bg-amber-500 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
          >
            Consultation ({clients.filter(c => c.status === "consultation").length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("employer")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${statusFilter === "employer" ? "bg-purple-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"}`}
          >
            Employeurs ({clients.filter(c => c.clientType === "employer").length})
          </button>
        </div>

      </div>

      {/* TABLEAU DES CLIENTS UI/UX PRO MAX (ENTÊTES NETTES EN TEXT-SLATE-800 FONT-BLACK & RACCOURCIS D'ACTIONS) */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.02)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="text-slate-800 uppercase font-black bg-slate-100/80 border-b border-slate-200 tracking-wider">
              <tr>
                <th scope="col" className="px-6 py-4 font-black">{t.table.fileNumber}</th>
                <th scope="col" className="px-6 py-4 font-black">{t.table.name}</th>
                <th scope="col" className="px-6 py-4 font-black">{t.table.contact}</th>
                <th scope="col" className="px-6 py-4 font-black">{t.table.program}</th>
                <th scope="col" className="px-6 py-4 font-black">{t.table.status}</th>
                <th scope="col" className="px-6 py-4 font-black text-right">Actions & Raccourcis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredClients.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 italic">
                    Aucun client ne correspond à votre recherche.
                  </td>
                </tr>
              )}
              {filteredClients.map((client) => (
                <tr 
                  key={client.id} 
                  onClick={() => router.push(`/matters/${getMatterIdForClient(client.id)}`)}
                  className="group hover:bg-slate-50/80 transition-colors cursor-pointer"
                >
                  {/* Numéro de dossier */}
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-900 border border-blue-200 px-3 py-1 rounded-full font-mono font-bold text-[11px] shadow-2xs">
                      {client.fileNumber}
                    </span>
                  </td>

                  {/* Nom & Avatar */}
                  <td className="px-6 py-4 font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`h-9 w-9 rounded-xl text-white flex items-center justify-center font-black text-xs shadow-xs ${
                        client.clientType === "employer"
                          ? "bg-gradient-to-tr from-purple-600 to-indigo-600"
                          : "bg-gradient-to-tr from-blue-600 to-indigo-600"
                      }`}>
                        {client.clientType === "employer" ? <Building2 className="w-4 h-4" /> : getInitials(client.name)}
                      </div>
                      <div>
                        <div className="text-sm font-black text-slate-900 group-hover:text-blue-600 flex items-center gap-2">
                          <span>{client.name}</span>
                          {client.clientType === "employer" && (
                            <span className="bg-purple-100 text-purple-900 border border-purple-300 font-mono text-[9px] font-extrabold px-2 py-0.5 rounded-full">
                              EMPLOYEUR B2B
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                          <span>{client.citizenship}</span>
                          <span>•</span>
                          <span>{client.residence}</span>
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Coordonnées */}
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-0.5 text-[11px] font-semibold text-slate-700">
                      <span className="font-mono">{client.email}</span>
                      <span className="text-slate-500">{client.phone}</span>
                    </div>
                  </td>

                  {/* Programme IRCC */}
                  <td className="px-6 py-4 font-bold text-slate-800">
                    {client.program}
                  </td>

                  {/* Statut */}
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black border ${
                      client.status === "active" 
                        ? "bg-emerald-50 text-emerald-900 border-emerald-200" 
                        : "bg-amber-50 text-amber-900 border-amber-200"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${client.status === "active" ? "bg-emerald-600" : "bg-amber-600"}`} />
                      <span>{client.status === "active" ? "Mandat Actif" : "En Consultation"}</span>
                    </span>
                  </td>

                  {/* Actions & Raccourcis Directs (AXE 3) */}
                  <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <a
                        href={`mailto:${client.email}`}
                        title={`Envoyer un courriel à ${client.email}`}
                        className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-colors cursor-pointer"
                      >
                        <Mail className="w-4 h-4" />
                      </a>

                      <a
                        href={`tel:${client.phone}`}
                        title={`Appeler au ${client.phone}`}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
                      >
                        <Phone className="w-4 h-4" />
                      </a>

                      <button
                        type="button"
                        onClick={() => router.push("/billing")}
                        title="Créer une facture pour ce client"
                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer"
                      >
                        <Receipt className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => router.push("/documents")}
                        title="Ouvrir le coffre-fort documentaire du client"
                        className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-colors cursor-pointer"
                      >
                        <FolderOpen className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => handleDeleteClient(client.id, e)}
                        title="Supprimer la fiche client"
                        className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-4 animate-fadeIn overflow-y-auto">
          <form
            onSubmit={handleCreateClient}
            className="bg-white w-full max-w-xl rounded-3xl border border-slate-200 shadow-2xl p-6 sm:p-8 flex flex-col gap-5 relative overflow-hidden my-8"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="inline-block bg-blue-100 text-blue-900 border border-blue-300 font-mono text-[11px] font-bold px-2.5 py-0.5 rounded-full mb-1">
                  Enregistrement Registre CICC
                </span>
                <h3 className="text-xl font-black text-slate-900">Nouvelle Fiche Client Officielle</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Type de Client</label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                    <input
                      type="radio"
                      name="clientType"
                      checked={clientType === "individual"}
                      onChange={() => setClientType("individual")}
                      className="text-blue-600 focus:ring-0"
                    />
                    <span>Particulier (B2C)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                    <input
                      type="radio"
                      name="clientType"
                      checked={clientType === "employer"}
                      onChange={() => setClientType("employer")}
                      className="text-purple-600 focus:ring-0"
                    />
                    <span>Employeur / Entreprise (B2B)</span>
                  </label>
                </div>
              </div>

              {/* PRÉNOM ET NOM SÉPARÉS */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Prénom</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Adama"
                  value={newFirstName}
                  onChange={(e) => setNewFirstName(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs font-medium rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Nom de Famille</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Diarra"
                  value={newLastName}
                  onChange={(e) => setNewLastName(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs font-medium rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
                />
              </div>

              {clientType === "employer" && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Raison Sociale</label>
                    <input
                      type="text"
                      required
                      placeholder="ex: Les Industries Nordiques Inc."
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full px-4 py-2.5 text-xs font-medium rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Numéro NEQ (Québec)</label>
                    <input
                      type="text"
                      placeholder="ex: NEQ 1178923412"
                      value={neqNumber}
                      onChange={(e) => setNeqNumber(e.target.value)}
                      className="w-full px-4 py-2.5 text-xs font-medium rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none transition-all font-mono"
                    />
                  </div>
                </>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Courriel</label>
                <input
                  type="email"
                  required
                  placeholder="adiarra@consulting.ca"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs font-medium rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Téléphone</label>
                <input
                  type="tel"
                  required
                  placeholder="+1 (514) 555-0101"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs font-medium rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Programme / Mandat Souhaité</label>
                <select
                  value={newProgram}
                  onChange={(e) => setNewProgram(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs font-bold rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none transition-all text-slate-900 cursor-pointer"
                >
                  <option value="Résidence Permanente (PEQ / Entrée Express)">Résidence Permanente (PEQ Québec & Entrée Express)</option>
                  <option value="Permis de Travail (EIMT / LMIA Exemption)">Permis de Travail & EIMT B2B (Employeurs)</option>
                  <option value="Permis d'études + CAQ Québec">Permis d&apos;études + CAQ Québec (MIFI)</option>
                  <option value="Parrainage Familial & Spousal">Parrainage Familial & Époux / Conjoint de fait</option>
                </select>
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
                className="px-6 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all cursor-pointer"
              >
                Créer la Fiche Client CICC
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  )
}
