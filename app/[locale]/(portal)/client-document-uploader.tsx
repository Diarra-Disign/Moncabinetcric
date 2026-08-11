"use client"

import * as React from "react"
import { 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Check, 
  FileCheck, 
  Download, 
  Eye, 
  Trash2, 
  RefreshCw, 
  ArrowUpRight,
  ShieldCheck
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface ClientDoc {
  id: string
  title: string
  subtitle: string
  requiredFor: string
  status: "pending" | "uploading" | "validated"
  file?: {
    name: string
    size: string
    uploadedAt: string
    url?: string
  }
  progress?: number
}

const INITIAL_DOCS: ClientDoc[] = [
  {
    id: "doc-passport",
    title: "Passeport International (Pages 1 à 5 & Visas)",
    subtitle: "PDF ou JPEG lisible · Max 25 Mo · Doit être valide > 6 mois",
    requiredFor: "Document Obligatoire IRCC",
    status: "pending"
  },
  {
    id: "doc-funds",
    title: "Preuve de Capacité Financière (Relevé Bancaire 6 mois)",
    subtitle: "Formulaires officiels de la banque et lettre d'attestation de solde",
    requiredFor: "Fidéicommis & Conformité IRCC",
    status: "pending"
  },
  {
    id: "doc-birth",
    title: "Acte de Naissance & État Civil Traduit",
    subtitle: "Copie certifiée conforme et traduction assermentée",
    requiredFor: "Demande de Résidence / Permis",
    status: "pending"
  },
  {
    id: "doc-tef",
    title: "Attestation Officielle NCLC / TEF Canada ou IELTS",
    subtitle: "Relevé officiel des résultats de test linguistique validé par IRCC",
    requiredFor: "Critère d'Éligibilité NCLC",
    status: "validated",
    file: {
      name: "TEF_Canada_Attestation_NCLC8.pdf",
      size: "2.4 Mo",
      uploadedAt: "28 juillet 2026"
    }
  }
]

export function ClientDocumentUploader() {
  const [docs, setDocs] = React.useState<ClientDoc[]>(INITIAL_DOCS)
  const [activeUploadDocId, setActiveUploadDocId] = React.useState<string | null>(null)
  const [toastNotice, setToastNotice] = React.useState<string | null>(null)
  const [selectedPreviewDoc, setSelectedPreviewDoc] = React.useState<ClientDoc | null>(null)

  const fileInputRef = React.useRef<HTMLInputElement | null>(null)

  // Disparition automatique du toast
  React.useEffect(() => {
    if (toastNotice) {
      const timer = setTimeout(() => setToastNotice(null), 4500)
      return () => clearTimeout(timer)
    }
  }, [toastNotice])

  const triggerFileUpload = (docId: string) => {
    setActiveUploadDocId(docId)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
      fileInputRef.current.click()
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !activeUploadDocId) return

    const targetDocId = activeUploadDocId
    const fileName = file.name
    const fileSizeFormatted = `${(file.size / (1024 * 1024)).toFixed(1)} Mo`
    const todayFormatted = "31 juillet 2026"

    // 1. Passer le doc en statut "uploading"
    setDocs(prev => prev.map(d => {
      if (d.id === targetDocId) {
        return {
          ...d,
          status: "uploading",
          progress: 15
        }
      }
      return d
    }))

    // 2. Simuler la progression du téléversement
    let currentProgress = 15
    const interval = setInterval(() => {
      currentProgress += 25
      if (currentProgress >= 100) {
        clearInterval(interval)
        
        // 3. Finaliser l'envoi
        setDocs(prev => prev.map(d => {
          if (d.id === targetDocId) {
            return {
              ...d,
              status: "validated",
              progress: 100,
              file: {
                name: fileName,
                size: fileSizeFormatted,
                uploadedAt: todayFormatted
              }
            }
          }
          return d
        }))

        setToastNotice(`✓ Fichier "${fileName}" téléversé et transmis avec succès au Cabinet CICC !`)
        setActiveUploadDocId(null)
      } else {
        setDocs(prev => prev.map(d => {
          if (d.id === targetDocId) {
            return { ...d, progress: currentProgress }
          }
          return d
        }))
      }
    }, 250)
  }

  const handleDeleteDoc = (docId: string) => {
    setDocs(prev => prev.map(d => {
      if (d.id === docId) {
        return {
          ...d,
          status: "pending",
          file: undefined,
          progress: undefined
        }
      }
      return d
    }))
    setToastNotice("Fichier supprimé. Vous pouvez téléverser une nouvelle version.")
  }

  const pendingDocs = docs.filter(d => d.status === "pending" || d.status === "uploading")
  const validatedDocs = docs.filter(d => d.status === "validated")

  return (
    <div className="space-y-6">

      {/* INPUT FILE MASQUÉ RÉUTILISABLE */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".pdf,.png,.jpg,.jpeg,.heic,.docx"
        className="hidden"
      />

      {/* TOAST DE CONFIRMATION DU TÉLÉVERSEMENT */}
      {toastNotice && (
        <div className="fixed top-6 right-6 z-[300] bg-foreground text-background p-4 rounded-2xl shadow-2xl border border-border font-bold text-xs sm:text-sm flex items-center gap-3 animate-slideInRight">
          <div className="h-9 w-9 rounded-xl bg-background/15 text-background flex items-center justify-center font-black shrink-0">
            <Check className="w-5 h-5" />
          </div>
          <span>{toastNotice}</span>
        </div>
      )}

      {/* MODALE DE PRÉVISUALISATION DE DOCUMENT */}
      {selectedPreviewDoc && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-foreground/50 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-card rounded-3xl border border-border shadow-2xl w-full max-w-xl overflow-hidden animate-scaleUp">
            <div className="p-6 border-b border-border bg-muted/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold">
                  <FileCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">{selectedPreviewDoc.title}</h3>
                  <p className="text-xs text-muted-foreground font-medium">{selectedPreviewDoc.file?.name} ({selectedPreviewDoc.file?.size})</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setSelectedPreviewDoc(null)}
                className="p-2 rounded-xl bg-card border border-border text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-muted border border-border rounded-2xl p-8 text-center space-y-3">
                <FileText className="w-16 h-16 mx-auto text-primary" />
                <div>
                  <h4 className="text-sm font-bold text-foreground">{selectedPreviewDoc.file?.name}</h4>
                  <p className="text-xs text-muted-foreground font-medium">Téléversé le {selectedPreviewDoc.file?.uploadedAt} · Statut : Conforme & Reçu</p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-success-strong bg-success/10 border border-success/30 px-3 py-1 rounded-full">
                  <ShieldCheck className="w-3.5 h-3.5" /> Reçu par le Consultant Réglementé CICC
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedPreviewDoc(null)}
                  className="px-4 py-2.5 text-xs font-bold text-muted-foreground hover:text-foreground"
                >
                  Fermer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPreviewDoc(null)
                    setToastNotice("Fichier téléchargé sur votre ordinateur ✓")
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold shadow-xs cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Télécharger la copie</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GRILLE 2 COLONNES DES DOCUMENTS : ACTIONS REQUISES & DOCUMENTS VALIDÉS */}
      <div className="grid gap-6 md:grid-cols-2">

        {/* 1. DOCUMENTS EN ATTENTE / ACTIONS REQUISES */}
        <Card className="border-warning/40 bg-card shadow-sm">
          <CardHeader className="border-b border-warning/30 bg-warning/10 pb-4">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-foreground text-base font-black">
                <AlertCircle className="h-5 w-5 text-warning" />
                <span>Documents requis (Actions à entreprendre)</span>
              </div>
              <Badge variant="outline" className="bg-warning/15 text-warning-strong border-warning/40 font-mono text-xs font-bold">
                {pendingDocs.length} à fournir
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground font-medium">
              Téléversez vos pièces justificatives sous format numérisé pour vérification par votre consultant.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-5 space-y-4">
            {pendingDocs.length === 0 ? (
              <div className="p-8 text-center bg-muted/40 rounded-2xl border border-border space-y-2">
                <CheckCircle2 className="w-10 h-10 mx-auto text-success" />
                <h4 className="text-sm font-bold text-foreground">Toutes les pièces requises ont été téléversées !</h4>
                <p className="text-xs text-muted-foreground">Votre dossier est complet et en cours de traitement par le cabinet.</p>
              </div>
            ) : (
              pendingDocs.map((d) => (
                <div key={d.id} className="p-4 rounded-2xl border border-border bg-card hover:border-primary transition-all space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-xl bg-warning/10 border border-warning/40 text-warning-strong flex items-center justify-center shrink-0 mt-0.5 font-bold">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-foreground">{d.title}</h4>
                        <p className="text-xs text-muted-foreground font-medium mt-0.5">{d.subtitle}</p>
                      </div>
                    </div>
                  </div>

                  {/* BARRE DE PROGRESSION SI TÉLÉVERSEMENT EN COURS */}
                  {d.status === "uploading" ? (
                    <div className="space-y-1.5 pt-2">
                      <div className="flex items-center justify-between text-xs font-bold text-primary">
                        <span className="flex items-center gap-1.5">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Téléversement en cours...
                        </span>
                        <span>{d.progress}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                        <div className="bg-primary h-2 rounded-full transition-all duration-200" style={{ width: `${d.progress}%` }} />
                      </div>
                    </div>
                  ) : (
                    <div className="pt-2 flex items-center justify-between gap-3 border-t border-border">
                      <span className="text-[11px] font-mono font-bold text-warning-strong bg-warning/10 px-2.5 py-0.5 rounded-md border border-warning/40">
                        {d.requiredFor}
                      </span>
                      <Button
                        size="sm"
                        onClick={() => triggerFileUpload(d.id)}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-xs gap-2 cursor-pointer"
                      >
                        <UploadCloud className="h-4 w-4" />
                        <span>Téléverser le fichier</span>
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* 2. DOCUMENTS VALIDÉS & TRANSMIS */}
        <Card className="border-success/30 bg-card shadow-sm">
          <CardHeader className="border-b border-success/25 bg-success/10 pb-4">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-foreground text-base font-black">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <span>Documents Validés & Transmis</span>
              </div>
              <Badge variant="outline" className="bg-success/15 text-success-strong border-success/40 font-mono text-xs font-bold">
                {validatedDocs.length} validé(s)
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground font-medium">
              Pièces justificatives vérifiées et enregistrées sur votre portail sécurisé.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-5 space-y-4">
            {validatedDocs.length === 0 ? (
              <div className="p-8 text-center bg-muted/40 rounded-2xl border border-border text-muted-foreground text-xs font-bold">
                Aucun document validé pour l&apos;instant.
              </div>
            ) : (
              validatedDocs.map((d) => (
                <div key={d.id} className="p-4 rounded-2xl border border-success/30 bg-success/5 hover:border-success transition-all space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-xl bg-success/15 text-success-strong flex items-center justify-center shrink-0 mt-0.5 font-bold shadow-xs">
                        <FileCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-foreground">{d.title}</h4>
                        {d.file && (
                          <p className="text-xs font-mono font-bold text-success-strong mt-0.5 flex items-center gap-1.5">
                            <span>📄 {d.file.name}</span>
                            <span>({d.file.size})</span>
                          </p>
                        )}
                        <p className="text-[11px] text-muted-foreground font-medium mt-1">Transmis le {d.file?.uploadedAt || "31 juillet 2026"}</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between gap-2 border-t border-success/25">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-success-strong bg-success/15 px-2.5 py-0.5 rounded-md border border-success/30">
                      <Check className="w-3.5 h-3.5" /> Reçu par le Cabinet
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedPreviewDoc(d)}
                        className="p-1.5 text-xs font-bold text-primary-strong hover:bg-primary/10 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Aperçu</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => triggerFileUpload(d.id)}
                        className="p-1.5 text-xs font-bold text-muted-foreground hover:bg-muted rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                        title="Téléverser une nouvelle version"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Remplacer</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteDoc(d.id)}
                        className="p-1.5 text-xs font-bold text-error hover:bg-error/10 rounded-lg transition-colors cursor-pointer"
                        title="Supprimer la pièce"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
