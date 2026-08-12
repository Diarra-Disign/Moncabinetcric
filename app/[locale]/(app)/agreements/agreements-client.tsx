"use client"

import React, { useState } from "react"
import { PageHeader } from "@/components/app-shell/page-header"
import { AgreementRecord, ClauseDefinition, GovernmentFee } from "@/lib/data/types"
import { useFirm } from "@/components/app-shell/firm-provider"
import { triggerDocumentPdfDownload } from "@/lib/utils/download-helper"
import { SmartAgreementBuilder } from "./smart-agreement-builder"
import { CreerEntente } from "@/components/agreements/creer-entente"
import { ListeEntentes } from "@/components/agreements/liste-ententes"
import type { EntenteListee } from "@/lib/data/ententes-actions"
import { 
  FileSignature, 
  Plus, 
  Search, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  FileText, 
  Users, 
  Lock, 
  Printer, 
  Eye, 
  X,
  Building2,
  DollarSign
} from "lucide-react"

interface AgreementsClientProps {
  initialAgreements: AgreementRecord[]
  governmentFees: GovernmentFee[]
  clauses: ClauseDefinition[]
  /** Les modèles d'entente réels, système et du cabinet. */
  modelesEntente?: {
    id: string; duCabinet: boolean; code: string; kind: string
    titre: string; description: string; version: string; parDefaut: boolean
  }[]
  /** Les ententes réelles du cabinet, lues par RLS. */
  ententes?: EntenteListee[]
}

export function AgreementsClient({
  initialAgreements,
  governmentFees,
  clauses,
  modelesEntente = [],
  ententes = [],
}: AgreementsClientProps) {
  // La création d'entente sur les vraies données. L'ancien parcours reste en
  // place tant qu'il n'est pas remplacé de bout en bout : le §34 demande de
  // connecter, pas de reconstruire.
  const [creation, setCreation] = useState(false)
  const firm = useFirm()
  const [agreements, setAgreements] = useState<AgreementRecord[]>(initialAgreements)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [showBuilder, setShowBuilder] = useState(false)
  const [previewAgreement, setPreviewAgreement] = useState<AgreementRecord | null>(null)
  const [showDownloadAlert, setShowDownloadAlert] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  // Filter logic
  const filteredAgreements = agreements.filter(agr => {
    const matchesSearch = 
      agr.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agr.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agr.program.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus = statusFilter === "all" || agr.status === statusFilter

    return matchesSearch && matchesStatus
  })

  // KPIs
  const totalAgreements = agreements.length
  const totalProfFeesCents = agreements.reduce((acc, a) => acc + a.totalProfessionalFeesCents, 0)
  const totalGovFeesCents = agreements.reduce((acc, a) => acc + a.totalGovernmentFeesCents, 0)
  const signedCount = agreements.filter(a => a.status === "fully_signed").length
  const signedRate = totalAgreements > 0 ? Math.round((signedCount / totalAgreements) * 100) : 100

  const formatCurrency = (cents: number) => {
    return (cents / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })
  }

  const handleCreated = (newAgreement: AgreementRecord) => {
    setAgreements(prev => [newAgreement, ...prev])
    setShowBuilder(false)
    setNotice(`Nouvelle entente de service ${newAgreement.reference} générée avec succès !`)
    setTimeout(() => setNotice(null), 5000)
  }

  return (
    <div className="flex flex-col gap-8 pb-16">

      {creation && (
        <CreerEntente modeles={modelesEntente} onFerme={() => setCreation(false)} />
      )}
      
      {/* NOTICE BANNER */}
      {notice && (
        <div className="bg-success text-background px-5 py-3.5 rounded-2xl shadow-lg border border-success/40 flex items-center justify-between animate-in fade-in duration-300">
          <div className="flex items-center gap-3 text-xs font-bold">
            <CheckCircle2 className="w-5 h-5 text-success-strong" />
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice(null)} className="text-success-strong hover:text-background">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* PAGE HEADER */}
      <PageHeader 
        title="Ententes de service"
        subtitle="Rédigez, personnalisez et suivez vos ententes de service et vos contrats de mandat."
        action={
          <button 
            onClick={() => setCreation(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold text-xs shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nouvelle Entente de Service</span>
          </button>
        }
      />

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card p-5 rounded-2xl border border-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-extrabold uppercase tracking-wider">Ententes Actives</span>
            <div className="w-8 h-8 rounded-xl bg-primary/15 text-primary-strong flex items-center justify-center">
              <FileSignature className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <strong className="text-2xl font-black text-foreground font-mono">{totalAgreements}</strong>
            <span className="text-[11px] text-muted-foreground block mt-0.5">Dossiers sous contrat CICC</span>
          </div>
        </div>

        <div className="bg-card p-5 rounded-2xl border border-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-extrabold uppercase tracking-wider">Honoraires Engagés</span>
            <div className="w-8 h-8 rounded-xl bg-success/15 text-success-strong flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <strong className="text-2xl font-black text-foreground font-mono">{formatCurrency(totalProfFeesCents)}</strong>
            <span className="text-[11px] text-muted-foreground block mt-0.5">Total honoraires nets HT</span>
          </div>
        </div>

        <div className="bg-card p-5 rounded-2xl border border-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-extrabold uppercase tracking-wider">Débours IRCC/MIFI</span>
            <div className="w-8 h-8 rounded-xl bg-warning/15 text-warning-strong flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <strong className="text-2xl font-black text-foreground font-mono">{formatCurrency(totalGovFeesCents)}</strong>
            <span className="text-[11px] text-muted-foreground block mt-0.5">Dépôts Fidéicommis non taxables</span>
          </div>
        </div>

        <div className="bg-card p-5 rounded-2xl border border-border shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-extrabold uppercase tracking-wider">Taux de Signature</span>
            <div className="w-8 h-8 rounded-xl bg-success/15 text-success-strong flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <strong className="text-2xl font-black text-success-strong font-mono">{signedRate}%</strong>
            <span className="text-[11px] text-muted-foreground block mt-0.5">Contrats signés & opposables</span>
          </div>
        </div>
      </div>

      {/* LES ENTENTES RÉELLES.
          Le tableau qui suit lit getAgreements(), qui rend un tableau VIDE dès
          que la source est Supabase : il montrait donc des données de
          démonstration en développement et rien du tout en production. Celui-ci
          lit la base. Les deux coexistent tant que l'ancien parcours n'est pas
          remplacé de bout en bout — le §34 demande de connecter, pas de
          reconstruire. */}
      <section className="space-y-3">
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-muted-foreground">
          Vos ententes
        </h2>
        <ListeEntentes ententes={ententes} />
      </section>

      {/* FILTER BAR & SEARCH */}
      <div className="bg-card p-4 rounded-2xl border border-border shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* STATUS TABS */}
        <div className="flex items-center gap-1.5 bg-muted p-1 rounded-xl w-full md:w-auto overflow-x-auto text-xs font-semibold">
          <button 
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === "all" ? "bg-card text-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"}`}
          >
            Toutes ({agreements.length})
          </button>
          <button 
            onClick={() => setStatusFilter("fully_signed")}
            className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === "fully_signed" ? "bg-card text-success-strong shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"}`}
          >
            Signées ({agreements.filter(a => a.status === "fully_signed").length})
          </button>
          <button 
            onClick={() => setStatusFilter("pending_signatures")}
            className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === "pending_signatures" ? "bg-card text-warning-strong shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"}`}
          >
            En attente ({agreements.filter(a => a.status === "pending_signatures").length})
          </button>
          <button 
            onClick={() => setStatusFilter("draft")}
            className={`px-3 py-1.5 rounded-lg transition-all ${statusFilter === "draft" ? "bg-card text-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"}`}
          >
            Brouillons ({agreements.filter(a => a.status === "draft").length})
          </button>
        </div>

        {/* SEARCH INPUT */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher entente, client..."
            className="w-full pl-10 pr-4 py-2 text-xs font-medium rounded-xl border border-border bg-muted focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary transition-all"
          />
        </div>
      </div>

      {/* AGREEMENTS TABLE */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-muted border-b border-border text-[11px] font-extrabold uppercase text-muted-foreground tracking-wider">
                <th className="py-3.5 px-4">Référence & Date</th>
                <th className="py-3.5 px-4">Client & Dépendants</th>
                <th className="py-3.5 px-4">Prestations CICC</th>
                <th className="py-3.5 px-4 text-right">Honoraires HT</th>
                <th className="py-3.5 px-4 text-right">Débours IRCC</th>
                <th className="py-3.5 px-4 text-right">Total Général</th>
                <th className="py-3.5 px-4 text-center">Statut Signature</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-medium text-foreground">
              {filteredAgreements.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground font-medium">
                    Aucune entente de service trouvée.
                  </td>
                </tr>
              ) : (
                filteredAgreements.map((agr) => (
                  <tr key={agr.id} className="hover:bg-muted transition-colors">
                    <td className="py-4 px-4 whitespace-nowrap">
                      <strong className="block text-foreground font-mono font-bold text-xs">{agr.reference}</strong>
                      <span className="text-[11px] text-muted-foreground font-mono">{agr.date}</span>
                    </td>

                    <td className="py-4 px-4">
                      <strong className="block text-foreground font-bold">{agr.clientName}</strong>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {agr.persons.map(p => (
                          <span key={p.id} className="text-[10px] bg-muted text-muted-foreground font-semibold px-2 py-0.5 rounded border border-border">
                            {p.personName} ({p.partyRole})
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="py-4 px-4 max-w-[220px]">
                      <span className="font-semibold text-foreground block truncate">{agr.program}</span>
                      <span className="text-[11px] text-muted-foreground block truncate">{agr.services.length} prestation(s) CICC rattachée(s)</span>
                    </td>

                    <td className="py-4 px-4 text-right font-mono font-bold text-foreground whitespace-nowrap">
                      {formatCurrency(agr.totalProfessionalFeesCents)}
                    </td>

                    <td className="py-4 px-4 text-right font-mono font-bold text-warning-strong whitespace-nowrap">
                      {formatCurrency(agr.totalGovernmentFeesCents)}
                    </td>

                    <td className="py-4 px-4 text-right font-mono font-black text-primary-strong text-sm whitespace-nowrap">
                      {formatCurrency(agr.grandTotalCents)}
                    </td>

                    <td className="py-4 px-4 text-center whitespace-nowrap">
                      {agr.status === "fully_signed" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-success/15 text-success-strong border border-success/40">
                          <CheckCircle2 className="w-3.5 h-3.5 text-success-strong" />
                          <span>Signé & Opposable</span>
                        </span>
                      )}
                      {agr.status === "pending_signatures" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-warning/15 text-warning-strong border border-warning/40">
                          <Clock className="w-3.5 h-3.5 text-warning-strong" />
                          <span>En attente (Signatures)</span>
                        </span>
                      )}
                      {agr.status === "draft" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-muted text-foreground border border-border">
                          <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>Brouillon</span>
                        </span>
                      )}
                    </td>

                    <td className="py-4 px-4 text-right whitespace-nowrap">
                      <button 
                        onClick={() => setPreviewAgreement(agr)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted hover:bg-muted text-foreground font-bold text-xs transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Aperçu Contrat PDF</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SMART AGREEMENT BUILDER WIZARD */}
      <SmartAgreementBuilder 
        isOpen={showBuilder}
        onClose={() => setShowBuilder(false)}
        onCreated={handleCreated}
        governmentFees={governmentFees}
        clauses={clauses}
      />

      {/* PREVIEW CONTRACT PDF MODAL */}
      {previewAgreement && (
        <div id="printable-contract-modal" className="fixed inset-0 z-50 bg-foreground/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card rounded-3xl shadow-2xl border border-border w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 print:max-h-none print:shadow-none print:border-none print:w-full print:rounded-none">
            
            <div className="no-print px-6 py-4 bg-foreground text-background flex items-center justify-between border-b border-border">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary-strong" />
                <span className="font-bold text-sm">Contrat Officiel CICC — {previewAgreement.reference}</span>
              </div>
              <button 
                onClick={() => setPreviewAgreement(null)}
                className="w-8 h-8 rounded-lg bg-card/10 hover:bg-card/20 flex items-center justify-center text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="printable-document p-8 overflow-y-auto flex-1 bg-card text-foreground text-xs flex flex-col gap-6 font-serif leading-relaxed print:overflow-visible print:p-0">
              <div className="flex justify-between items-start border-b border-border/20 pb-6 font-sans">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-foreground border border-border flex items-center justify-center overflow-hidden shrink-0 shadow-md">
                    {firm.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={firm.logoUrl} alt={firm.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-mono font-black text-background text-xl">M</span>
                    )}
                  </div>
                  <div>
                    <h1 className="text-xl font-black tracking-tight text-foreground">ENTENTE DE SERVICES PROFESSIONNELS</h1>
                    <p className="text-xs text-muted-foreground mt-1">Conforme au Code de conduite professionnelle du CICC</p>
                    <p className="text-xs font-mono text-muted-foreground">Cabinet : <strong>{firm.name} (CICC #{previewAgreement.rcicLicenceNo})</strong></p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="bg-foreground text-background text-xs font-mono font-black px-3 py-1 rounded">
                    RÉF. {previewAgreement.reference}
                  </span>
                  <p className="text-xs font-mono text-muted-foreground mt-2">Émise le : {previewAgreement.date}</p>
                </div>
              </div>

              <div>
                <strong className="font-sans font-bold text-sm block mb-2 text-primary-strong">1. IDENTIFICATION ET COORDONNÉES DES PARTIES (CONFORMITÉ CICC)</strong>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-sans text-xs mb-3">
                  {/* CABINET / CONSULTANT RCIC */}
                  <div className="p-3.5 bg-muted rounded-xl border border-border">
                    <strong className="text-foreground font-extrabold block border-b border-border pb-1.5 mb-2">
                      LE CABINET / CONSULTANT AGRÉÉ
                    </strong>
                    <div className="space-y-1 text-foreground">
                      <p><strong>Cabinet :</strong> {firm.name}</p>
                      <p><strong>Consultant Titulaire :</strong> {previewAgreement.rcicName} (RCIC #{previewAgreement.rcicLicenceNo})</p>
                      {firm.address && <p><strong>Adresse :</strong> {firm.address}</p>}
                      <p><strong>Téléphone / Courriel :</strong> {firm.phone || "—"} · {firm.email || "—"}</p>
                    </div>
                  </div>

                  {/* CLIENT PRINCIPAL */}
                  <div className="p-3.5 bg-primary/15 rounded-xl border border-primary/40">
                    <strong className="text-primary-strong font-extrabold block border-b border-primary/40 pb-1.5 mb-2">
                      LE CLIENT / DEMANDEUR PRINCIPAL
                    </strong>
                    <div className="space-y-1 text-foreground">
                      <p><strong>Nom Complet :</strong> {previewAgreement.clientName}</p>
                      <p><strong>Adresse Postale :</strong> {previewAgreement.clientAddress || "7420 Boulevard Saint-Laurent, App. 402, Montréal (QC) H2R 1W6"}</p>
                      <p><strong>Pays de Résidence Actuel :</strong> <span className="font-bold text-primary-strong">{previewAgreement.clientCountryOfResidence || "Canada (Québec)"}</span></p>
                      <p><strong>Téléphone :</strong> {previewAgreement.clientPhone || "+1 (514) 892-3401"}</p>
                      <p><strong>Adresse Courriel :</strong> <span className="font-mono text-primary-strong">{previewAgreement.clientEmail || "client@courriel.ca"}</span></p>
                    </div>
                  </div>
                </div>

                <p className="font-sans text-[11px] text-muted-foreground font-medium mb-1.5">
                  Membres de la famille & personnes rattachées au présent mandat :
                </p>
                <ul className="list-disc pl-5 space-y-1 font-sans text-xs">
                  {previewAgreement.persons.map(p => (
                    <li key={p.id}>
                      <strong>{p.personName}</strong> — Rôle : <span className="font-semibold text-foreground">{p.partyRole}</span> ({p.isSignatory ? "Signataire Opposable" : "Bénéficiaire Couvert"})
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <strong className="font-sans font-bold text-sm block mb-2 text-primary-strong">2. VENTILATION DES SERVICES & HONORAIRES</strong>
                <table className="w-full text-left border border-border font-sans text-xs">
                  <thead className="bg-muted font-bold border-b">
                    <tr>
                      <th className="p-2.5">Prestation & Bénéficiaire</th>
                      <th className="p-2.5">Portée Incluse</th>
                      <th className="p-2.5 text-right">Honoraires HT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y border-b">
                    {previewAgreement.services.map(s => (
                      <tr key={s.id}>
                        <td className="p-2.5 font-bold">{s.programName}<br/><span className="text-[10px] text-muted-foreground">Pour : {s.personName}</span></td>
                        <td className="p-2.5 text-foreground">{s.scopeIncluded}</td>
                        <td className="p-2.5 text-right font-mono font-bold">{formatCurrency(s.feeCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <strong className="font-sans font-bold text-sm block mb-2 text-primary-strong">3. DÉBOURS GOUVERNEMENTAUX IRCC / MIFI (NON TAXABLES)</strong>
                <div className="bg-warning/15 p-4 rounded-xl border border-warning/40 font-sans text-xs flex flex-col gap-2">
                  {previewAgreement.governmentFees.map((gf, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span>{gf.label} (×{gf.quantity}) :</span>
                      <span className="font-mono font-bold text-warning-strong">{formatCurrency(gf.amountCents * gf.quantity)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION 4 : CLAUSES CONTRACTUELLES ET RÉGLEMENTAIRES CICC */}
              <div>
                <strong className="font-sans font-bold text-sm block mb-2 text-primary-strong">4. CLAUSES CONTRACTUELLES ET RÉGLEMENTAIRES CICC</strong>
                <div className="flex flex-col gap-3 font-sans">
                  {clauses.map((c) => (
                    <div key={c.id} className="p-3.5 bg-muted rounded-xl border border-border flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        {c.level === "structural" && (
                          <span className="bg-foreground text-background text-[9px] font-mono font-bold px-2 py-0.5 rounded">
                            Structurelle 🔒
                          </span>
                        )}
                        {c.level === "cicc_required" && (
                          <span className="bg-success text-background text-[9px] font-mono font-bold px-2 py-0.5 rounded">
                            Exigée CICC 🛡️
                          </span>
                        )}
                        {c.level === "free" && (
                          <span className="bg-primary text-primary-foreground text-[9px] font-mono font-bold px-2 py-0.5 rounded">
                            Libre ✍️
                          </span>
                        )}
                        <strong className="text-xs text-foreground font-extrabold">{c.titleFr}</strong>
                      </div>
                      <p className="text-[11px] text-foreground leading-relaxed font-serif pt-1">{c.bodyFr}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-border pt-4 flex justify-end font-sans">
                <div className="w-full max-w-md ml-auto flex flex-col gap-2 text-xs bg-muted p-4 rounded-2xl border border-border shadow-xs">
                  <div className="flex justify-between items-center gap-4 text-foreground">
                    <span>Sous-total Honoraires Nets HT :</span>
                    <span className="font-mono font-bold text-foreground whitespace-nowrap">{formatCurrency(previewAgreement.totalProfessionalFeesCents)}</span>
                  </div>
                  <div className="flex justify-between items-center gap-4 text-foreground">
                    <span>TPS (5.00%) :</span>
                    <span className="font-mono font-bold text-foreground whitespace-nowrap">
                      {previewAgreement.isTaxExempt ? "0,00 $ (Exonéré)" : formatCurrency(previewAgreement.tpsCents)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-4 text-foreground">
                    <span>TVQ (9.975%) :</span>
                    <span className="font-mono font-bold text-foreground whitespace-nowrap">
                      {previewAgreement.isTaxExempt ? "0,00 $ (Exonéré)" : formatCurrency(previewAgreement.tvqCents)}
                    </span>
                  </div>
                  {previewAgreement.isTaxExempt && (
                    <span className="text-[10px] text-success-strong font-bold bg-success/15 border border-success/40 px-2.5 py-1 rounded-lg text-right block my-0.5 font-mono">
                      Client hors-Canada (Art. 9 Partie V Annexe VI LTV)
                    </span>
                  )}
                  <div className="flex justify-between items-center gap-4 text-warning-strong border-t border-border pt-1.5">
                    <span className="font-semibold">Débours IRCC/MIFI (Non Taxables) :</span>
                    <span className="font-mono font-bold whitespace-nowrap">{formatCurrency(previewAgreement.totalGovernmentFeesCents)}</span>
                  </div>
                  <div className="flex justify-between items-center gap-4 font-black text-sm text-primary-strong border-t-2 border-border pt-2.5 mt-1">
                    <span className="uppercase tracking-tight">TOTAL DU CONTRAT :</span>
                    <span className="font-mono text-base text-primary-strong whitespace-nowrap">{formatCurrency(previewAgreement.grandTotalCents)} CAD</span>
                  </div>
                </div>
              </div>

              {/* SECTION 5 : BLOCS DE SIGNATURES ET D'OPPOSABILITÉ DES PARTIES */}
              <div className="font-sans border-t border-border pt-6">
                <strong className="font-bold text-sm block mb-3 text-primary-strong uppercase tracking-wider">
                  5. SIGNATURES ET CONSENTEMENT OPPOSABLE DES PARTIES
                </strong>
                <p className="text-[11px] text-muted-foreground mb-4 leading-relaxed font-serif">
                  En signant ci-dessous, les parties reconnaissent avoir lu, compris et accepté l&apos;intégralité des clauses contractuelles et de la ventilation financière de la présente entente de services professionnels.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  {/* SIGNATURE CLIENT PRINCIPAL */}
                  <div className="border border-border rounded-2xl p-4 bg-muted flex flex-col justify-between h-40">
                    <div>
                      <span className="text-[10px] font-mono uppercase font-black text-muted-foreground block">Signataire 1 — Client Principal</span>
                      <strong className="text-xs text-foreground font-extrabold block mt-0.5">{previewAgreement.clientName}</strong>
                    </div>

                    <div className="border-b border-dashed border-border my-2 pt-6 text-center">
                      {previewAgreement.signedAt ? (
                        <span className="font-serif italic text-primary-strong font-bold text-sm text-primary-strong">
                          {previewAgreement.clientName} (Signé électroniement)
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground italic">Emplacement de signature du client</span>
                      )}
                    </div>

                    <div className="flex justify-between items-center text-[10px] font-mono text-muted-foreground">
                      <span>Date : {previewAgreement.signedAt ? previewAgreement.signedAt.split(" ")[0] : previewAgreement.date}</span>
                      <span>{previewAgreement.signedAt ? "Statut : Signé & Certifié" : "En attente de signature"}</span>
                    </div>
                  </div>

                  {/* SIGNATURE CONSULTANT RCIC */}
                  <div className="border border-primary/40 rounded-2xl p-4 bg-primary/15 flex flex-col justify-between h-40">
                    <div>
                      <span className="text-[10px] font-mono uppercase font-black text-primary-strong block">Signataire 2 — Consultant Titulaire CICC</span>
                      <strong className="text-xs text-foreground font-extrabold block mt-0.5">
                        Me {previewAgreement.rcicName} (RCIC #{previewAgreement.rcicLicenceNo})
                      </strong>
                    </div>

                    <div className="border-b border-dashed border-border my-2 pt-6 text-center">
                      <span className="font-serif italic text-primary-strong font-bold text-sm text-primary-strong flex items-center justify-center gap-2">
                        <span>{previewAgreement.rcicName}</span>
                        <span className="text-[9px] font-mono font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded not-italic">SCEAU RCIC</span>
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-[10px] font-mono text-muted-foreground">
                      <span>Date : {previewAgreement.date}</span>
                      <span>Permis CICC #{firm.rcicNumber} Validé</span>
                    </div>
                  </div>
                </div>
              </div>

              {previewAgreement.signedAt && (
                <div className="bg-success/15 border border-success/40 p-4 rounded-xl font-sans text-xs flex items-center justify-between">
                  <div>
                    <strong className="text-success-strong font-bold block">Signature Électronique Certifiée Opposable</strong>
                    <span className="text-success-strong font-mono text-[10px]">SHA-256 : {previewAgreement.sha256}</span>
                  </div>
                  <span className="font-mono font-bold text-success-strong">Horodaté le {previewAgreement.signedAt}</span>
                </div>
              )}
            </div>

            <div className="no-print px-6 py-4 bg-muted border-t border-border flex items-center justify-between font-sans">
              <button 
                onClick={() => setPreviewAgreement(null)}
                className="px-4 py-2 bg-muted hover:bg-muted text-foreground text-xs font-bold rounded-xl"
              >
                Fermer
              </button>
              <button 
                onClick={() => {
                  if (previewAgreement) {
                    const filename = `Entente-CICC-${previewAgreement.reference}.html`
                    const docTitle = `Entente de Services CICC ${previewAgreement.reference}`
                    const html = document.querySelector('.printable-document')?.innerHTML || ""
                    triggerDocumentPdfDownload(filename, docTitle, html)
                  } else {
                    window.print()
                  }
                }}
                className="inline-flex items-center gap-2 px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimer / Télécharger PDF</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* BOÎTE D'ALERTE PERSONNALISÉE (CUSTOM ALERT MODAL) - MASKED ON PRINT */}
      {showDownloadAlert && previewAgreement && (
        <div id="custom-download-alert" className="no-print fixed inset-0 z-50 bg-foreground/50 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-foreground border border-primary/40 rounded-3xl p-6 shadow-2xl max-w-md w-full text-background flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/30 border border-primary/40 flex items-center justify-center shrink-0">
                <FileSignature className="w-6 h-6 text-primary-strong" />
              </div>
              <div>
                <h3 className="text-base font-extrabold tracking-tight text-background flex items-center gap-2">
                  Impression & Export PDF CICC
                  <span className="text-[9px] uppercase font-mono font-bold bg-primary/20 text-primary-strong border border-primary/30 px-2 py-0.5 rounded">
                    Art. 13
                  </span>
                </h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Le contrat officiel <strong className="text-background font-mono">{previewAgreement.reference}</strong> est prêt avec ses clauses réglementaires CICC et sa ventilation fiscale.
                </p>
              </div>
            </div>

            <div className="bg-background/10 p-4 rounded-2xl border border-border/80 text-xs flex flex-col gap-2 font-mono">
              <div className="flex justify-between text-muted-foreground">
                <span>Client :</span>
                <strong className="text-background">{previewAgreement.clientName}</strong>
              </div>
              <div className="flex justify-between text-muted-foreground border-t border-border/60 pt-2">
                <span>Montant Total :</span>
                <strong className="text-success-strong font-black">{formatCurrency(previewAgreement.grandTotalCents)} CAD</strong>
              </div>
              <div className="flex justify-between text-muted-foreground border-t border-border/60 pt-2">
                <span>Consultant RCIC :</span>
                <strong className="text-muted-foreground">{firm.rcicName} (#{firm.rcicNumber})</strong>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-success-strong flex items-center gap-1.5 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-success-strong" />
                Fenêtre d&apos;impression OS ouverte
              </span>
              <button 
                onClick={() => setShowDownloadAlert(false)}
                className="px-5 py-2 bg-primary hover:bg-primary/100 text-background font-bold text-xs rounded-xl transition-all shadow-md"
              >
                Fermer l&apos;alerte
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
