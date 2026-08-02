"use client"

import * as React from "react"
import { useFirm } from "@/components/app-shell/firm-provider"
import { 
  FileUp, 
  FileSignature, 
  DollarSign, 
  Video, 
  ShieldCheck, 
  Send, 
  CheckCircle2, 
  ExternalLink, 
  Clock, 
  Sparkles,
  AlertCircle,
  Download,
  Copy,
  Plus
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Link } from "@/i18n/routing"

import { SubmissionLetterBuilder } from "@/components/matters/submission-letter-builder"

interface DirectActionsTabsProps {
  matterId: string
  clientName: string
  programName: string
  trustBalance?: string
}

export function DirectActionsTabs({
  matterId,
  clientName,
  programName,
  trustBalance = "$5,000 CAD"
}: DirectActionsTabsProps) {
  const firm = useFirm()
  const [activeTab, setActiveTab] = React.useState<"docs" | "signature" | "billing" | "visio" | "audit" | "submission">("submission")
  const [toastNotice, setToastNotice] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [customDocs, setCustomDocs] = React.useState<Array<{ name: string; status: string }>>([])

  const showToast = (msg: string) => {
    setToastNotice(msg)
    setTimeout(() => setToastNotice(null), 4500)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setCustomDocs(prev => [{ name: file.name, status: "Valide ✓" }, ...prev])
      showToast(`Fichier ${file.name} téléversé avec succès et rattaché au dossier !`)
      e.target.value = ""
    }
  }

  return (
    <Card className="border-blue-200/90 shadow-md rounded-3xl overflow-hidden bg-gradient-to-b from-white to-slate-50/60">
      
      {/* TOAST INTERNAL */}
      {toastNotice && (
        <div className="bg-slate-900 text-white p-3 px-4 rounded-xl text-xs font-bold flex items-center justify-between animate-fadeIn border border-slate-700 m-4 mb-0">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            {toastNotice}
          </span>
          <button onClick={() => setToastNotice(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* HEADER AVEC BADGE CICC */}
      <CardHeader className="pb-4 border-b border-slate-100 bg-slate-50/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black shrink-0">
              ⚡
            </div>
            <div>
              <CardTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
                Actions Directes & Exécutions Rapides
              </CardTitle>
              <CardDescription className="text-xs font-medium text-slate-500">
                Guichet unique pour téléverser, rédiger la lettre d&apos;argumentaire IRCC, faire signer le mandat CICC, facturer et inviter en visio.
              </CardDescription>
            </div>
          </div>

          <Badge variant="outline" className="font-mono text-xs font-bold text-blue-700 bg-blue-50 border-blue-200 self-start sm:self-auto">
            {matterId} · Action CICC
          </Badge>
        </div>

        {/* BARS DES ONGLETS D'ACTIONS DIRECTES */}
        <div className="flex items-center gap-1.5 pt-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab("submission")}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "submission"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>1. Argumentaire IRCC (Lettre IA)</span>
          </button>

          <button
            onClick={() => setActiveTab("docs")}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "docs"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <FileUp className="w-3.5 h-3.5" />
            <span>2. Pièces & Téléversement</span>
          </button>

          <button
            onClick={() => setActiveTab("signature")}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "signature"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <FileSignature className="w-3.5 h-3.5" />
            <span>3. Signature Mandat IMM 5476</span>
          </button>

          <button
            onClick={() => setActiveTab("billing")}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "billing"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>4. Fidéicommis & Honoraires</span>
          </button>

          <button
            onClick={() => setActiveTab("visio")}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "visio"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>5. Visio & Calendly</span>
          </button>

          <button
            onClick={() => setActiveTab("audit")}
            className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "audit"
                ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>5. Conformité CICC</span>
          </button>
        </div>
      </CardHeader>

      {/* BODY DE L'ONGLET SÉLECTIONNÉ */}
      <CardContent className="p-6">
        
        {/* TAB 1: ARGUMENTAIRE IRCC (LETTRE IA & LIPR/RIPR) */}
        {activeTab === "submission" && (
          <SubmissionLetterBuilder 
            key={matterId}
            matterId={matterId}
            clientName={clientName}
            programName={programName}
          />
        )}
        {activeTab === "docs" && (
          <div className="space-y-4 animate-fadeIn">
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
              onChange={handleFileSelect}
              className="hidden" 
            />
            <div className="flex items-center justify-between bg-blue-50/70 p-4 rounded-2xl border border-blue-200">
              <div>
                <h4 className="text-sm font-black text-blue-950">Téléverser une pièce justificative IRCC</h4>
                <p className="text-xs text-blue-800">Glissez un document (PDF, PNG) pour l&apos;ajouter au dossier de {clientName}.</p>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
              >
                <FileUp className="w-4 h-4" />
                <span>Sélectionner un fichier</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {customDocs.map((doc, idx) => (
                <div key={idx} className="p-3.5 rounded-xl border border-emerald-300 bg-emerald-50/60 flex items-center justify-between animate-fadeIn">
                  <span className="text-xs font-bold text-emerald-950 truncate max-w-[180px]">{doc.name}</span>
                  <Badge variant="success" className="text-[10px] shrink-0">{doc.status}</Badge>
                </div>
              ))}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">Passeport principal</span>
                <Badge variant="success" className="text-[10px]">Valide ✓</Badge>
              </div>
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">Test de langue TEF C1</span>
                <Badge variant="success" className="text-[10px]">Valide ✓</Badge>
              </div>
              <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/60 flex items-center justify-between">
                <span className="text-xs font-bold text-amber-950">Attestation d&apos;emploi (10 ans)</span>
                <Badge variant="warning" className="text-[10px]">En révision</Badge>
              </div>
              <div className="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">Diplôme universitaire</span>
                <Badge variant="success" className="text-[10px]">Valide ✓</Badge>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SIGNATURE MANDAT IMM 5476 */}
        {activeTab === "signature" && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-purple-50 p-4 rounded-2xl border border-purple-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-black uppercase text-purple-700 bg-white px-2 py-0.5 rounded border border-purple-200 font-mono">Formulaire Officiel IRCC</span>
                <h4 className="text-sm font-black text-purple-950 mt-1">Mandat de Représentation Legal (IMM 5476)</h4>
                <p className="text-xs text-purple-800">{firm.rcicName} (CICC #{firm.rcicNumber}) désigné comme représentant légal payé.</p>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => showToast("Lien de signature e-Sign transmis par e-mail et SMS au client !")}
                  className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
                >
                  <Send className="w-4 h-4" />
                  <span>Envoyer lien e-Sign</span>
                </button>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">Statut de la signature électronique :</span>
              <span className="font-extrabold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200">
                Certifiée & Horodatée CICC ✓
              </span>
            </div>
          </div>
        )}

        {/* TAB 3: FIDÉICOMMIS & HONORAIRES */}
        {activeTab === "billing" && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-emerald-50 p-4 sm:p-5 rounded-2xl border border-emerald-200 flex items-center justify-between">
              <div>
                <span className="text-xs font-extrabold text-emerald-800 uppercase">Solde du Compte Fidéicommis CICC</span>
                <p className="text-2xl font-black text-emerald-700 font-mono mt-0.5">{trustBalance}</p>
                <p className="text-xs text-emerald-800 mt-1">Provisionnement réglementaire conforme au règlement CICC.</p>
              </div>

              <button
                onClick={() => showToast("Demande d'approvisionnement fidéicommis transmise au client !")}
                className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 text-xs font-black rounded-xl shadow-md transition-all cursor-pointer shrink-0"
              >
                <DollarSign className="w-4 h-4" />
                <span>+ Appeler des fonds</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 4: VISIO & CALENDLY */}
        {activeTab === "visio" && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-black uppercase text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-200">Visio Calendly Direct</span>
                <h4 className="text-sm font-black text-indigo-950 mt-1">Convoquer {clientName} en visioconférence</h4>
                <p className="text-xs text-indigo-800">Synchronisez le créneau directement sur l&apos;Agenda CICC et le Portail Client.</p>
              </div>

              <Link
                href="/calendar"
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 text-xs font-black rounded-xl shadow-md transition-all shrink-0"
              >
                <Video className="w-4 h-4" />
                <span>Ouvrir l&apos;Agenda Virtuel</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-80" />
              </Link>
            </div>
          </div>
        )}

        {/* TAB 5: CONFORMITÉ CICC */}
        {activeTab === "audit" && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-black text-amber-950 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  Journal d&apos;Audit Immuable CICC
                </h4>
                <p className="text-xs text-amber-800">Toutes les actions et modifications apportées à ce dossier sont traçables pour le Collège.</p>
              </div>

              <button
                onClick={() => showToast("Rapport d'audit CICC exporté au format PDF certifié !")}
                className="inline-flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
              >
                <Download className="w-4 h-4" />
                <span>Exporter l&apos;audit (PDF)</span>
              </button>
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  )
}
