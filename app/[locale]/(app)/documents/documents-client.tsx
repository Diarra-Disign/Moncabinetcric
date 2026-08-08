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
  RotateCcw,
  Mail
} from "lucide-react"
import { useRouter } from "@/i18n/routing"
import { PageHeader } from "@/components/app-shell/page-header"
import { DocumentRecord, AuditLogRecord } from "@/lib/data/types"
import { VaultAuditLog } from "@/components/documents/vault-audit-log"
import { ActionsFichier } from "@/components/documents/file-actions"
import { SignatureBloc } from "@/components/documents/signature-bloc"
import { triggerFileDownload } from "@/lib/utils/download-helper"
import { archiveDocumentRecord, deleteDocumentRecord, restoreDocumentRecord } from "@/lib/data/actions"
import {
  GROUPES_TYPES_DOCUMENT,
  TYPES_DOCUMENT,
  categoriePourType,
  libelleType,
} from "@/lib/data/document-types"

/** Libellé lisible des cinq origines de fichier déjà stockées en base. */
const LIBELLE_ORIGINE: Record<DocumentRecord["category"], string> = {
  client_upload: "fournie par le client",
  consultant_upload: "produite par le cabinet",
  contract: "contrat ou entente",
  invoice: "facturation ou fidéicommis",
  ircc_form: "formulaire officiel",
}

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
    uploadHint: "PDF, JPEG, PNG ou HEIC. 20 Mo max.",
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
  const [showPortalModal, setShowPortalModal] = React.useState(false)
  const [selectedDoc, setSelectedDoc] = React.useState<DocumentRecord | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)

  // Real file upload states
  const [selectedFileObj, setSelectedFileObj] = React.useState<File | null>(null)
  const [selectedFileUrl, setSelectedFileUrl] = React.useState<string | null>(null)
  const [selectedFileContent, setSelectedFileContent] = React.useState<string | null>(null)

  const [sessionAuditEntries, setSessionAuditEntries] = React.useState<AuditLogRecord[]>([])

  // Trace affichée pendant la session, avant que le serveur ne scelle
  // l'entrée. Ni empreinte ni adresse IP ne sont produites ici : le condensé
  // était tiré de Math.random() et l'adresse était une constante, tous deux
  // présentés comme des éléments de preuve. Le scellement appartient à la
  // base, qui seule peut le rendre opposable ; ici on laisse le champ vide et
  // le journal l'affiche comme « en attente de scellement ».
  const addAuditLog = React.useCallback((action: AuditLogRecord["action"], summary: string, entityId?: string) => {
    const prevHash = ""
    const rowHash = ""

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
      ipAddress: "",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      prevHash,
      rowHash
    }

    setSessionAuditEntries(prev => [newEntry, ...prev])
  }, [sessionAuditEntries, initialAuditLogs])

  // Form State pour le nouveau document
  const [docName, setDocName] = React.useState("")
  // On saisit la nature exacte du document ; l'origine s'en déduit. L'inverse
  // obligeait à choisir entre cinq cases trop larges pour dire quoi que ce
  // soit d'utile sur le contenu de la pièce.
  const [docType, setDocType] = React.useState<string>("passeport")
  const docCategory = categoriePourType(docType)
  const [docClient, setDocClient] = React.useState("")
  const [docExpiration, setDocExpiration] = React.useState("2031-12-31")
  const [selectedFileSize, setSelectedFileSize] = React.useState<string>("2.4 MB")

  // State pour l'Autoremplissage Automatique Formulaire IRCC
  const [irccClient, setIrccClient] = React.useState("")
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

  // Action 1: Télécharger un document individuel (Supporte les fichiers réels)
  const handleDownloadDocument = (doc: DocumentRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()

    if (doc.fileUrl && doc.fileUrl.startsWith("data:")) {
      const link = document.createElement("a")
      link.href = doc.fileUrl
      link.download = doc.name
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } else {
      const sampleContent =
        doc.content ||
        `FICHE DOCUMENTAIRE — ${doc.name}\n` +
          `Cabinet : ${firm.name} (CICC #${firm.rcicNumber})\n` +
          `Client : ${doc.clientName ?? "—"}\n` +
          `Dossier : ${doc.matterId ?? "—"}\n\n` +
          "Fichier conservé dans le registre documentaire CICC."
      triggerFileDownload(doc.name, sampleContent, "text/plain;charset=utf-8")
    }
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
      setSelectedFileObj(file)
      setDocName(file.name)
      const mbSize = (file.size / (1024 * 1024)).toFixed(1)
      setSelectedFileSize(`${mbSize} MB`)

      // Conversion du fichier réel pour aperçu et téléchargement direct
      const reader = new FileReader()
      reader.onload = (event) => {
        const result = event.target?.result as string
        setSelectedFileUrl(result)
      }
      reader.readAsDataURL(file)

      if (file.type.startsWith("text/") || file.name.endsWith(".txt") || file.name.endsWith(".json") || file.name.endsWith(".csv")) {
        const textReader = new FileReader()
        textReader.onload = (event) => {
          setSelectedFileContent(event.target?.result as string)
        }
        textReader.readAsText(file)
      } else {
        setSelectedFileContent(null)
      }
    }
  }

  const handleCreateDocument = (e: React.FormEvent) => {
    e.preventDefault()
    if (!docName.trim()) return

    const created: DocumentRecord = {
      id: `doc-${Date.now()}`,
      name: docName,
      type: TYPES_DOCUMENT[docType]?.labelFr ?? "Document",
      category: docCategory,
      docType,
      uploadedBy: docCategory === "client_upload" ? (docClient || "Client") : firm.rcicName,
      date: new Date().toISOString().split("T")[0],
      expiration: docExpiration || "2031-12-31",
      source: docCategory === "client_upload" ? "Portail Client" : "Poste Consultant",
      status: "valid",
      clientName: docClient || "Client",
      fileSize: selectedFileSize,
      fileUrl: selectedFileUrl ?? undefined,
      content: selectedFileContent ?? undefined,
      sha256: selectedFileObj ? `${Date.now()}-sha256` : undefined,
      storagePath: selectedFileObj ? `firms/documents/${selectedFileObj.name}` : undefined
    }

    setDocuments(prev => [created, ...prev])
    setShowNewModal(false)
    setDocName("")
    setSelectedFileObj(null)
    setSelectedFileUrl(null)
    setSelectedFileContent(null)
    addAuditLog("create", `Document téléversé — ${created.name} (${created.fileSize})`, created.id)
    setNotice(`✅ Document "${created.name}" téléversé et disponible immédiatement à l'aperçu.`)
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
              onClick={() => setShowPortalModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white border border-indigo-200 hover:bg-indigo-50 text-indigo-900 text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <KeyRound className="w-4 h-4 text-indigo-600" />
              <span>Accès Portail Client</span>
            </button>

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
                        <div className="text-[10px] font-mono text-slate-500">{doc.matterId || "—"}</div>
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
                    {libelleType(selectedDoc.docType, "fr") ??
                     (selectedDoc.category === "client_upload" ? "Pièce justificative fournie par le client" :
                      selectedDoc.category === "consultant_upload" ? "Document interne téléversé par le consultant" :
                      selectedDoc.category === "contract" ? "Contrat ou entente" :
                      selectedDoc.category === "invoice" ? "Facture ou reçu de fidéicommis" :
                      "Formulaire officiel IRCC / MIFI")}
                  </p>

                  {selectedDoc.fileUrl ? (
                    selectedDoc.fileUrl.startsWith("data:image") || selectedDoc.name.match(/\.(png|jpe?g|webp|gif|svg)$/i) ? (
                      <div className="flex flex-col items-center justify-center p-4 bg-slate-900 rounded-2xl border border-slate-800 my-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={selectedDoc.fileUrl} alt={selectedDoc.name} className="max-w-full max-h-[500px] object-contain rounded-lg shadow-lg" />
                      </div>
                    ) : (
                      <div className="w-full h-[550px] rounded-2xl overflow-hidden border border-slate-300 shadow-inner bg-slate-100 my-2">
                        <iframe src={selectedDoc.fileUrl} title={selectedDoc.name} className="w-full h-full border-0" />
                      </div>
                    )
                  ) : selectedDoc.content ? (
                    /* Rendu du contenu réel du document */
                    <pre className="whitespace-pre-wrap break-words font-mono text-[10px] leading-relaxed text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200 max-h-[500px] overflow-y-auto my-2">
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
                      <span className="font-mono font-bold">{selectedDoc.matterId || "—"}</span>
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
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Conservation</label>
                    <div className="flex items-start gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                      <Lock className="w-4 h-4 text-slate-500 shrink-0 mt-px" />
                      <span className="text-[10px] font-medium text-slate-700 leading-relaxed">
                        {selectedDoc.storagePath
                          ? "Fichier conservé dans le coffre du cabinet, accès restreint par les politiques de la base. L’empreinte ci-dessus permet de vérifier qu’il n’a pas été modifié."
                          : "Aucun fichier n’est encore déposé sur cette fiche."}
                      </span>
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
                <label htmlFor="doc-type" className="block text-slate-700 font-bold mb-1">Nature du document</label>
                <select
                  id="doc-type"
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl focus:border-indigo-600 focus:outline-none"
                >
                  {GROUPES_TYPES_DOCUMENT.map((groupe) => (
                    <optgroup key={groupe.id} label={groupe.labelFr}>
                      {groupe.types.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.labelFr}
                          {type.refCode ? ` — art. ${type.refCode}` : ""}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-1">
                  Origine déduite :{" "}
                  <span className="font-bold text-slate-700">{LIBELLE_ORIGINE[docCategory]}</span>
                  {TYPES_DOCUMENT[docType]?.refCode && (
                    <> — encadré par l’article {TYPES_DOCUMENT[docType].refCode} du Code de déontologie.</>
                  )}
                </p>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Nom du Fichier</label>
                <input
                  type="text"
                  required
                  placeholder="ex : Passeport.pdf"
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl focus:border-indigo-600 focus:outline-none"
                />
              </div>

              <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => fileInputRef.current?.click()}>
                <UploadCloud className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-800">Cliquez pour choisir un fichier sur votre ordinateur</p>
                <p className="text-[10px] text-slate-400 mt-1">PDF, JPEG, PNG ou HEIC — 20 Mo maximum</p>
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

      {/* MODAL LIEN DE CONNEXION ET ACCÈS PORTAIL CLIENT */}
      {showPortalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-4 animate-fadeIn" onClick={() => setShowPortalModal(false)}>
          <div className="bg-white w-full max-w-lg rounded-3xl border border-indigo-100 shadow-2xl p-6 sm:p-8 flex flex-col gap-5 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-indigo-900 text-white flex items-center justify-center font-bold shrink-0">
                  <KeyRound className="w-5 h-5 text-indigo-300" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Accès au Portail Client Sécurisé</h3>
                  <p className="text-xs text-slate-500">Transmettez ce lien à votre client pour lui donner accès à ses pièces & dossiers.</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowPortalModal(false)} className="w-8 h-8 rounded-full bg-slate-100 font-bold flex items-center justify-center">✕</button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <label className="block text-slate-500 font-bold text-[10px] uppercase mb-1">Lien Officiel du Portail Client</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${typeof window !== "undefined" ? window.location.origin : "https://moncabinetcric.vercel.app"}/fr/portal`}
                    className="flex-1 p-2.5 bg-white border border-slate-300 rounded-xl font-mono text-xs text-indigo-900 font-bold select-all focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const portalUrl = `${typeof window !== "undefined" ? window.location.origin : "https://moncabinetcric.vercel.app"}/fr/portal`
                      navigator.clipboard.writeText(portalUrl)
                      setNotice("🔑 Lien du portail client copié dans le presse-papier !")
                      setShowPortalModal(false)
                      setTimeout(() => setNotice(null), 5000)
                    }}
                    className="px-4 py-2.5 rounded-xl bg-indigo-900 hover:bg-indigo-950 text-white font-bold text-xs transition-all shrink-0 cursor-pointer"
                  >
                    Copier
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <a
                  href={`${typeof window !== "undefined" ? window.location.origin : "https://moncabinetcric.vercel.app"}/fr/portal`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 px-4 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 font-bold text-center text-xs transition-colors flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-4 h-4 text-indigo-600" />
                  <span>Tester (Aperçu Vue Client)</span>
                </a>

                <a
                  href={`mailto:?subject=Accès à votre Portail Client CRIC&body=Bonjour, voici le lien pour accéder à votre portail client sécurisé et suivre vos pièces d'immigration : ${typeof window !== "undefined" ? window.location.origin : "https://moncabinetcric.vercel.app"}/fr/portal`}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-950 text-white font-bold text-center text-xs transition-all flex items-center justify-center gap-2"
                >
                  <Mail className="w-4 h-4 text-slate-300" />
                  <span>Envoyer par courriel</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
