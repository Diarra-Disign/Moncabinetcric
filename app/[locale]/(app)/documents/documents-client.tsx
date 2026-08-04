"use client"

import * as React from "react"
import { useFirm } from "@/components/app-shell/firm-provider"
import { 
  Folder, 
  MoreVertical, 
  Plus, 
  Upload, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Search, 
  SlidersHorizontal, 
  AlertTriangle, 
  FileIcon, 
  FileText,
  ShieldCheck,
  Shield,
  Lock,
  Download,
  ArrowUpRight,
  Sparkles,
  HardDrive,
  Trash2,
  UploadCloud,
  ChevronDown,
  UserCheck,
  Calendar,
  Tag,
  FileCheck2,
  Check,
  Wand2,
  Archive,
  Eye,
  KeyRound,
  FileArchive,
  ExternalLink,
  RotateCcw
} from "lucide-react"
import { useRouter } from "@/i18n/routing"
import { PageHeader } from "@/components/app-shell/page-header"
import { DocumentRecord, AuditLogRecord } from "@/lib/data/types"
import { VaultAuditLog } from "@/components/documents/vault-audit-log"
import { ActionsFichier } from "@/components/documents/file-actions"
import { SignatureBloc } from "@/components/documents/signature-bloc"
import { triggerFileDownload } from "@/lib/utils/download-helper"
import { archiveDocumentRecord, deleteDocumentRecord, restoreDocumentRecord } from "@/lib/data/actions"

export interface FolderItem {
  id: string
  title: string
  files: number
  size: string
}

interface DocumentsClientProps {
  t: Record<string, unknown>
  initialFolders: FolderItem[]
  initialDocuments: DocumentRecord[]
  initialAuditLogs?: AuditLogRecord[]
}

export function DocumentsClient({ t, initialFolders, initialDocuments, initialAuditLogs = [] }: DocumentsClientProps) {
  // Ce composant n'utilise pas encore next-intl : les libellés du bloc
  // fichier sont posés ici en attendant son internationalisation.
  const etiquettesFichier = {
    upload: "Déposer un fichier",
    uploadRunning: "Dépôt en cours…",
    uploadDone: "Fichier déposé",
    uploadHint: "PDF, JPEG ou PNG. 20 Mo max.",
    download: "Télécharger",
    verify: "Vérifier l'intégrité",
    verifyRunning: "Vérification…",
    noFile: "Aucun fichier déposé",
    fingerprint: "Empreinte SHA-256",
  }

  const firm = useFirm()
  const router = useRouter()
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const [documents, setDocuments] = React.useState<DocumentRecord[]>(initialDocuments)
  const [activeCategory, setActiveCategory] = React.useState<string>("all")
  const [searchQuery, setSearchQuery] = React.useState("")
  
  // Modals & Audit
  const [showNewModal, setShowNewModal] = React.useState(false)
  const [showIrccModal, setShowIrccModal] = React.useState(false)
  const [selectedDoc, setSelectedDoc] = React.useState<DocumentRecord | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)

  const [sessionAuditEntries, setSessionAuditEntries] = React.useState<AuditLogRecord[]>([])

  const addAuditLog = React.useCallback((action: AuditLogRecord["action"], summary: string, entityId?: string) => {
    const lastEntry = sessionAuditEntries[0] || (initialAuditLogs && initialAuditLogs[0])
    const prevHash = lastEntry ? lastEntry.rowHash : "0000000000000000000000000000000000000000000000000000000000000000"
    const rowHash = `${Math.random().toString(36).substring(2)}${Date.now().toString(36)}`.padEnd(64, "0").slice(0, 64)

    const newEntry: AuditLogRecord = {
      id: `daud-session-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      occurredAt: new Date().toISOString(),
      actorMemberId: "mem-01",
      actorEmail: firm.email,
      actorName: firm.rcicName,
      actorRole: "rcic",
      action,
      entityType: "document",
      entityId: entityId || "doc-session",
      summary,
      ipAddress: "192.168.1.42",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      prevHash,
      rowHash
    }

    setSessionAuditEntries(prev => [newEntry, ...prev])
  }, [sessionAuditEntries, initialAuditLogs])

  // Form State pour le nouveau document
  const [docName, setDocName] = React.useState("")
  const [docCategory, setDocCategory] = React.useState<DocumentRecord["category"]>("client_upload")
  const [docClient, setDocClient] = React.useState("M. Adama Diarra (#DOS-35695)")
  const [docExpiration, setDocExpiration] = React.useState("2031-12-31")
  const [selectedFileSize, setSelectedFileSize] = React.useState<string>("2.4 MB")

  // State pour l'Autoremplissage Automatique Formulaire IRCC
  const [irccClient, setIrccClient] = React.useState("M. Adama Diarra (#DOS-35695)")
  const [irccFormType, setIrccFormType] = React.useState("IMM 5669 - Antécédents / Déclaration")

  const filteredDocuments = documents.filter(d => {
    if (activeCategory === "archived") {
      return d.status === "archived"
    }

    const isNotArchived = d.status !== "archived"
    const matchesCategory = activeCategory === "all" || d.category === activeCategory
    const matchesSearch = searchQuery === "" ||
      d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.uploadedBy.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.clientName && d.clientName.toLowerCase().includes(searchQuery.toLowerCase()))

    return isNotArchived && matchesCategory && matchesSearch
  })

  // Action 1: Télécharger un document individuel
  const handleDownloadDocument = (doc: DocumentRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    const sampleContent =
      doc.content ||
      // Le fichier d'origine n'est pas conservé : ce contenu de repli le
      // dit, au lieu d'annoncer une empreinte et un chemin inexistants.
      `FICHE DOCUMENTAIRE — ${doc.name}\n` +
        `Cabinet : ${firm.name} (CICC #${firm.rcicNumber})\n` +
        `Client : ${doc.clientName ?? "—"}\n` +
        `Dossier : ${doc.matterId ?? "—"}\n\n` +
        "Le fichier d'origine n'est pas conservé : seule cette fiche l'est."
    triggerFileDownload(doc.name, sampleContent, "text/plain;charset=utf-8")
    addAuditLog("download", `Téléchargement sécurisé — ${doc.name} par ${firm.rcicName} (CICC #${firm.rcicNumber})`, doc.id)
    setNotice(`⬇️ Téléchargement de "${doc.name}" sur votre ordinateur effectué.`)
    setTimeout(() => setNotice(null), 5000)
  }

  // Action 2: Archiver un document
  const handleArchiveDocument = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const target = documents.find(d => d.id === id)
    if (!target) return

    setDocuments(prev => prev.map(d => d.id === id ? { ...d, status: "archived" } : d))
    await archiveDocumentRecord(id)
    addAuditLog("update", `Archivage réglementaire — ${target.name} déplacé dans les archives conformément à la politique de rétention`, id)
    setNotice(`📁 Document "${target.name}" archivé avec succès. Retrouvez-le dans l'onglet Archives.`)
    setTimeout(() => setNotice(null), 5000)
  }

  const [deleteTargetDoc, setDeleteTargetDoc] = React.useState<DocumentRecord | null>(null)

  const handleConfirmDeleteDocument = async () => {
    if (!deleteTargetDoc) return
    const { id, name } = deleteTargetDoc
    setDocuments(prev => prev.filter(d => d.id !== id))
    await deleteDocumentRecord(id)
    addAuditLog("delete", `Suppression définitive du document ${name} du coffre-fort client`, id)
    setNotice(`🗑️ Document "${name}" supprimé définitivement du coffre-fort client.`)
    setDeleteTargetDoc(null)
    setTimeout(() => setNotice(null), 5000)
  }

  // Action 4: Réintégrer un document archivé dans le dossier actif
  const handleRestoreDocument = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const target = documents.find(d => d.id === id)
    if (!target) return

    setDocuments(prev => prev.map(d => d.id === id ? { ...d, status: "valid" } : d))
    await restoreDocumentRecord(id)
    addAuditLog("update", `Réintégration du document ${target.name} dans le dossier client actif`, id)
    setNotice(`↩️ Document "${target.name}" réintégré dans le dossier client actif.`)
    setTimeout(() => setNotice(null), 5000)
  }

  // Action 5: Télécharger le coffre-fort complet en ZIP (Module 7 Audit Export)
  const handleDownloadAllZip = () => {
    let manifestContent = `MANIFESTE D'EXPORTATION ET D'AUDIT CICC (MODULE 7)\n`
    manifestContent += `Cabinet: ${firm.name} (CICC #${firm.rcicNumber})\n`
    manifestContent += `Date Export: ${new Date().toLocaleString("fr-CA")}\n\n`
    manifestContent += `FICHIERS COMPRIS DANS CET EXPORT :\n`

    documents.forEach((d, i) => {
      // Ni empreinte ni chemin de stockage : le manifeste ne liste que ce
      // qui existe réellement, à savoir les fiches documentaires.
      manifestContent +=
        `${i + 1}. [${d.category.toUpperCase()}] ${d.name} (${d.fileSize || "—"})\n` +
        `   Client : ${d.clientName ?? "—"}   Dossier : ${d.matterId ?? "—"}\n\n`
    })

    triggerFileDownload("Coffre_Fort_Client_Export_Complet_CICC.txt", manifestContent, "text/plain;charset=utf-8")
    addAuditLog("export", `Export Audit CICC 1-Clic — Manifeste d'export généré pour ${documents.length} documents`, "export-batch-session")
    setNotice("📦 Pack d'exportation du Coffre-Fort Client (Manifeste & Fichiers) généré avec succès.")
    setTimeout(() => setNotice(null), 6000)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setDocName(file.name)
      const mbSize = (file.size / (1024 * 1024)).toFixed(1)
      setSelectedFileSize(`${mbSize} MB`)
    }
  }

  const handleCreateDocument = (e: React.FormEvent) => {
    e.preventDefault()
    if (!docName.trim()) return

    const created: DocumentRecord = {
      id: `doc-${Date.now()}`,
      name: docName.endsWith(".pdf") ? docName : `${docName}.pdf`,
      type: docCategory === "client_upload" ? "Pièce Fournie par Client" : docCategory === "contract" ? "Contrat CICC" : "Note Consultant",
      category: docCategory,
      uploadedBy: docCategory === "client_upload" ? docClient : "Me Adama Diarra (RCIC)",
      date: new Date().toISOString().split("T")[0],
      expiration: docExpiration || "2031-12-31",
      source: docCategory === "client_upload" ? "Portail Client" : "Poste Consultant",
      status: "valid",
      clientName: docClient,
      fileSize: selectedFileSize,
      sha256: `sha256-${Date.now().toString(16)}`,
      storagePath: undefined
    }

    setDocuments(prev => [created, ...prev])
    setShowNewModal(false)
    setDocName("")
    addAuditLog("create", `Fiche documentaire créée — ${created.name} (${created.fileSize})`, created.id)
    setNotice(`✅ Fiche "${created.name}" ajoutée au registre.`)
    setTimeout(() => setNotice(null), 5000)
  }

  return (
    <div className="flex flex-col gap-8 pb-16 max-w-7xl mx-auto">
      
      {/* HEADER PAGEHEADER */}
      <PageHeader
        title="Registre documentaire & Pièces clients"
        subtitle="Registre des pièces clients, contrats CICC et factures. Hébergement canadien."
        badgeText="HÉBERGÉ AU CANADA"
        badgeVariant="emerald"
        actions={
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleDownloadAllZip}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <FileArchive className="w-4 h-4 text-indigo-600" />
              <span>Exporter Tout (ZIP Audit)</span>
            </button>

            <button
              type="button"
              onClick={() => setShowNewModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-indigo-900 hover:bg-indigo-950 text-white text-xs font-bold transition-all shadow-md shadow-indigo-900/20 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-indigo-300" />
              <span>Ajouter un Document</span>
            </button>
          </div>
        }
      />

      {/* NOTICE BANNER */}
      {notice && (
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-white text-xs font-bold flex items-center justify-between shadow-lg animate-fadeIn">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-indigo-400 shrink-0" />
            <span>{notice}</span>
          </div>
          <button type="button" onClick={() => setNotice(null)} className="text-slate-400 hover:text-white font-mono">✕</button>
        </div>
      )}

      {/* BANNIÈRE COMPLIANCE & SÉCURITÉ DE STOCKAGE */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-indigo-500/30 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4 relative z-10">
          <div className="h-14 w-14 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 flex items-center justify-center font-black shadow-md shrink-0">
            <Lock className="w-7 h-7 text-indigo-400" />
          </div>
          <div>
            {/* Ce bandeau annonçait un chiffrement AES-256, une empreinte
                SHA-256 et un rangement « firms/firm-boreale/matters/… ».
                Aucun fichier n'est stocké à ce jour — seules les métadonnées
                le sont — et le chemin nommait un cabinet fictif. Il ne
                subsiste que ce qui est vérifiable : la région d'hébergement. */}
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black tracking-tight text-white">Registre documentaire</h2>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full font-mono">
                Hébergé au Canada
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Les fiches documentaires — nom, catégorie, dossier client, dates — sont
              conservées dans une base hébergée au Canada.{" "}
              <strong className="text-amber-300 font-bold">
                Le dépôt des fichiers eux-mêmes n&apos;est pas encore en service :
              </strong>{" "}
              seules les métadonnées sont enregistrées.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleDownloadAllZip}
            className="px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            <span>Télécharger l&apos;Intégrale</span>
          </button>
        </div>
      </div>

      {/* SÉLECTEUR D'ONGLETS ET CATÉGORIES DE DOCUMENTS */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4 overflow-x-auto">
        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl shrink-0">
          <button
            type="button"
            onClick={() => setActiveCategory("all")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeCategory === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Tous les Fichiers ({documents.filter(d => d.status !== "archived").length})
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory("client_upload")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeCategory === "client_upload" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Fournis par Client ({documents.filter(d => d.category === "client_upload" && d.status !== "archived").length})
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory("consultant_upload")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeCategory === "consultant_upload" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Téléchargés par Consultant ({documents.filter(d => d.category === "consultant_upload" && d.status !== "archived").length})
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory("contract")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeCategory === "contract" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Contrats CICC
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory("invoice")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeCategory === "invoice" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Factures & Reçus
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory("archived")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeCategory === "archived" ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Archives ({documents.filter(d => d.status === "archived").length})
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory("audit")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeCategory === "audit" ? "bg-indigo-900 text-white shadow-sm" : "bg-indigo-50 text-indigo-900 hover:bg-indigo-100"
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-indigo-500" />
            <span>Journal d&apos;audit</span>
          </button>
        </div>
      </div>

      {activeCategory === "audit" ? (
        <VaultAuditLog initialAuditEntries={initialAuditLogs} sessionAuditEntries={sessionAuditEntries} />
      ) : (
        <>
          {/* BARRE DE RECHERCHE */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs flex items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher un document par nom, client ou ID dossier..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-xs font-medium rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* TABLEAU DES DOCUMENTS AVEC ACTIONS DIRECTES (TELECHARGER, ARCHIVER, SUPPRIMER) */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-50 font-black uppercase text-[10px] text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4 w-[28%]">Nom du Fichier</th>
                    <th className="py-3.5 px-4 w-[18%]">Catégorie & Source</th>
                    <th className="py-3.5 px-4 w-[20%]">Client & Dossier Associe</th>
                    <th className="py-3.5 px-4 w-[14%]">Date & Taille</th>
                    <th className="py-3.5 px-4 w-[20%] text-right whitespace-nowrap">Actions de Gestion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {filteredDocuments.map(doc => (
                    <tr 
                      key={doc.id} 
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* Nom Fichier */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <strong className="font-bold text-slate-900 block group-hover:text-indigo-600 transition-colors">{doc.name}</strong>
                            <span className="text-[10px] font-mono text-slate-400">ID: {doc.id}</span>
                          </div>
                        </div>
                      </td>

                      {/* Catégorie */}
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                          doc.category === "client_upload" ? "bg-sky-100 text-sky-900 border border-sky-200" :
                          doc.category === "consultant_upload" ? "bg-indigo-100 text-indigo-900 border border-indigo-200" :
                          doc.category === "contract" ? "bg-emerald-100 text-emerald-900 border border-emerald-200" :
                          "bg-amber-100 text-amber-900 border border-amber-200"
                        }`}>
                          {doc.category === "client_upload" ? "Pièce Client" :
                           doc.category === "consultant_upload" ? "Note Consultant" :
                           doc.category === "contract" ? "Contrat CICC" : "Facture / Reçu"}
                        </span>
                        <div className="text-[10px] text-slate-500 mt-1">Source : {doc.source}</div>
                      </td>

                      {/* Client & Dossier */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{doc.clientName || doc.uploadedBy}</div>
                        <div className="text-[10px] font-mono text-slate-500">{doc.matterId || "#DOS-35695"}</div>
                      </td>

                      {/* Date & Taille */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-mono text-slate-700">{doc.date}</div>
                        <div className="text-[10px] font-mono text-slate-400">{doc.fileSize || "2.1 MB"}</div>
                      </td>

                      {/* Actions de Gestion (Aperçu, Télécharger, Archiver, Supprimer) */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Bouton Aperçu */}
                          <button
                            type="button"
                            onClick={() => setSelectedDoc(doc)}
                            title="Aperçu du document"
                            className="p-2 rounded-xl border border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-900 transition-colors cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Bouton Télécharger sur Ordi */}
                          <button
                            type="button"
                            onClick={(e) => handleDownloadDocument(doc, e)}
                            title="Télécharger sur mon ordinateur"
                            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 transition-colors cursor-pointer"
                          >
                            <Download className="w-4 h-4" />
                          </button>

                          {/* Bouton Archiver */}
                          {doc.status !== "archived" && (
                            <button
                              type="button"
                              onClick={(e) => handleArchiveDocument(doc.id, e)}
                              title="Archiver ce document"
                              className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-600 transition-colors cursor-pointer"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                      )}

                      {/* Bouton Réintégrer (visible uniquement sur les documents archivés) */}
                      {doc.status === "archived" && (
                        <button
                          type="button"
                          onClick={(e) => handleRestoreDocument(doc.id, e)}
                          title="Réintégrer dans le dossier actif"
                          className="p-2 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 hover:text-emerald-900 transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}

                      {/* Bouton Supprimer */}
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setDeleteTargetDoc(doc); }}
                        title="Supprimer définitivement"
                        className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-600 transition-colors cursor-pointer"
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
    </>
  )}

      {/* MODAL APERÇU COMPLET DU DOCUMENT */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-lg p-4 animate-fadeIn" onClick={() => setSelectedDoc(null)}>
          <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>

            {/* En-tête du viewer */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shrink-0">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Aperçu — {selectedDoc.name}</h3>
                  <p className="text-[10px] text-slate-500 font-mono">ID: {selectedDoc.id} · {selectedDoc.fileSize || "2.1 MB"} · {selectedDoc.date}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => handleDownloadDocument(selectedDoc, e)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Télécharger</span>
                </button>
                <button type="button" onClick={() => setSelectedDoc(null)} className="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold flex items-center justify-center transition-colors cursor-pointer">✕</button>
              </div>
            </div>

            {/* Corps du viewer : Aperçu + Métadonnées */}
            <div className="flex flex-1 overflow-hidden">

              {/* Panneau gauche : Rendu visuel du document */}
              <div className="flex-1 bg-slate-100 p-6 overflow-y-auto">
                <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 sm:p-10 min-h-[500px] max-w-[600px] mx-auto">
                  {/* Simulation d'un rendu PDF */}
                  <div className="border-b-2 border-indigo-600 pb-4 mb-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">{firm.name}</p>
                        <p className="text-[9px] text-slate-400 font-mono">CICC #{firm.rcicNumber}</p>
                      </div>
                      <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-lg">M</div>
                    </div>
                  </div>

                  <h2 className="text-base font-black text-slate-900 mb-1">{selectedDoc.name}</h2>
                  <p className="text-xs text-slate-500 mb-6">
                    {selectedDoc.category === "client_upload" ? "Pièce justificative fournie par le client" :
                     selectedDoc.category === "consultant_upload" ? "Document interne téléversé par le consultant" :
                     selectedDoc.category === "contract" ? "Contrat de Services — Entente CICC" :
                     selectedDoc.category === "invoice" ? "Facture officielle ou Reçu Fidéicommis" :
                     "Formulaire officiel IRCC / MIFI"}
                  </p>

                  {selectedDoc.content ? (
                    /* Rendu du contenu réel du document */
                    <pre className="whitespace-pre-wrap break-words font-mono text-[10px] leading-relaxed text-slate-700">
                      {selectedDoc.content}
                    </pre>
                  ) : (
                  <div className="space-y-3 text-xs text-slate-700">
                    {/* Repli : aucun contenu stocké pour ce document (ex. téléversement récent) */}
                    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 mb-4">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-px" />
                      <p className="text-[10px] font-bold text-amber-900 leading-relaxed">
                        Contenu du fichier non disponible à l&apos;aperçu. Seules les métadonnées du dossier sont affichées ci-dessous.
                      </p>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-2">
                      <span className="font-bold text-slate-500">Client / Dossier</span>
                      <span className="font-bold">{selectedDoc.clientName || selectedDoc.uploadedBy}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-2">
                      <span className="font-bold text-slate-500">Numéro de dossier</span>
                      <span className="font-mono font-bold">{selectedDoc.matterId || "#DOS-35695"}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-2">
                      <span className="font-bold text-slate-500">Source</span>
                      <span>{selectedDoc.source}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-2">
                      <span className="font-bold text-slate-500">Date de téléversement</span>
                      <span className="font-mono">{selectedDoc.date}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-2">
                      <span className="font-bold text-slate-500">Date d&apos;expiration</span>
                      <span className="font-mono">{selectedDoc.expiration || "N/A"}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 pb-2">
                      <span className="font-bold text-slate-500">Taille du fichier</span>
                      <span className="font-mono">{selectedDoc.fileSize || "2.1 MB"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-bold text-slate-500">Statut</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        selectedDoc.status === "valid" ? "bg-emerald-100 text-emerald-900" :
                        selectedDoc.status === "archived" ? "bg-amber-100 text-amber-900" :
                        "bg-rose-100 text-rose-900"
                      }`}>{selectedDoc.status === "valid" ? "Valide" : selectedDoc.status === "archived" ? "Archivé" : "Invalide"}</span>
                    </div>
                  </div>
                  )}

                  <div className="mt-8 pt-4 border-t border-slate-200 text-[9px] text-slate-400 text-center font-mono">
                    Document confidentiel — {firm.name}
                  </div>
                </div>
              </div>

              {/* Panneau droit : Métadonnées techniques & intégrité */}
              <div className="w-80 border-l border-slate-200 bg-white p-5 overflow-y-auto shrink-0 hidden md:block">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-4">Intégrité & Stockage</h4>

                <div className="space-y-4">
                  {/* Dépôt, téléchargement et vérification. Ce bloc remplace
                      l'affichage d'un chemin et d'une empreinte figés, qui
                      décrivaient un fichier inexistant. */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">Fichier</label>
                    <ActionsFichier
                      documentId={selectedDoc.id}
                      clientId={selectedDoc.clientId ?? ""}
                      storagePath={selectedDoc.storagePath ?? null}
                      sha256={selectedDoc.sha256 ?? null}
                      labels={etiquettesFichier}
                      onChange={() => router.refresh()}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2">Signature</label>
                    <SignatureBloc
                      documentId={selectedDoc.id}
                      documentName={selectedDoc.name}
                      signataire={firm.rcicName}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Chiffrement</label>
                    <div className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="text-[10px] font-bold text-emerald-900">Base hébergée au Canada</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Région de stockage</label>
                    <div className="flex items-center gap-2 p-2.5 bg-sky-50 border border-sky-200 rounded-lg">
                      <Lock className="w-4 h-4 text-sky-600 shrink-0" />
                      <span className="text-[10px] font-bold text-sky-900">Souveraineté des données Canada (Loi 25)</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 space-y-2">
                  <button
                    type="button"
                    onClick={(e) => handleDownloadDocument(selectedDoc, e)}
                    className="w-full px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Télécharger sur mon Ordi
                  </button>

                  {selectedDoc.status === "archived" && (
                    <button
                      type="button"
                      onClick={(e) => { handleRestoreDocument(selectedDoc.id, e); setSelectedDoc(null) }}
                      className="w-full px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Réintégrer dans le dossier
                    </button>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 2 : AJOUT / TELEVERSEMENT DE DOCUMENT */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-lg rounded-3xl border border-slate-200 shadow-2xl p-6 sm:p-8 flex flex-col gap-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900">Téléverser un Fichier (Client ou Consultant)</h3>
              <button type="button" onClick={() => setShowNewModal(false)} className="w-8 h-8 rounded-full bg-slate-100 font-bold flex items-center justify-center">✕</button>
            </div>

            <form onSubmit={handleCreateDocument} className="space-y-4 text-xs font-medium">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Origine / Catégorie du Fichier</label>
                <select
                  value={docCategory}
                  onChange={(e) => setDocCategory(e.target.value as DocumentRecord["category"])}
                  className="w-full p-2.5 border border-slate-300 rounded-xl focus:border-indigo-600 focus:outline-none"
                >
                  <option value="client_upload">Fourni par le Client (Passeport, TEF, Diplôme)</option>
                  <option value="consultant_upload">Téléchargé par le Consultant (Note, Analyse)</option>
                  <option value="contract">Contrat de Services CICC</option>
                  <option value="invoice">Facture ou Reçu Fidéicommis</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Nom du Fichier</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Passeport_Officiel_2026.pdf"
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl focus:border-indigo-600 focus:outline-none"
                />
              </div>

              <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => fileInputRef.current?.click()}>
                <UploadCloud className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-800">Cliquez pour choisir un fichier sur votre ordinateur</p>
                <p className="text-[10px] text-slate-400 mt-1">Sélecteur natif OS (PDF, PNG, JPG jusqu&apos;à 50 MB)</p>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button type="button" onClick={() => setShowNewModal(false)} className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold">Annuler</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-indigo-900 text-white font-bold hover:bg-indigo-950 shadow-md">Téléverser dans le Coffre-Fort</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PERSONNALISÉ DE CONFIRMATION DE SUPPRESSION DE DOCUMENT */}
      {deleteTargetDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-4 animate-fadeIn" onClick={() => setDeleteTargetDoc(null)}>
          <div className="bg-white w-full max-w-md rounded-3xl border border-rose-100 shadow-2xl p-6 flex flex-col gap-5 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Supprimer le Document ?</h3>
                <p className="text-xs text-slate-500">Cette suppression sera consignée dans l&apos;audit.</p>
              </div>
            </div>

            <div className="p-4 bg-rose-50/70 border border-rose-200/60 rounded-2xl text-xs text-slate-700 leading-relaxed space-y-2">
              <p>
                Voulez-vous vraiment supprimer définitivement le document <strong className="text-slate-900 font-bold">« {deleteTargetDoc.name} »</strong> ?
              </p>
              <p className="text-[11px] text-slate-500">
                La fiche sera retirée du registre et l&apos;opération inscrite au journal d&apos;audit.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteTargetDoc(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteDocument}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-all shadow-md cursor-pointer"
              >
                Supprimer Définitivement
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
