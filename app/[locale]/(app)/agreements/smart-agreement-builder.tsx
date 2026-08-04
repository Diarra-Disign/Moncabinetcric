"use client"

import React, { useState } from "react"
import { X, CheckCircle2, ShieldCheck, Lock, Plus, Trash2, ArrowRight, ArrowLeft, DollarSign, Users, FileSignature, Sparkles, Building } from "lucide-react"
import { AgreementRecord, ClauseDefinition, GovernmentFee } from "@/lib/data/types"
import { useFirm } from "@/components/app-shell/firm-provider"

interface SmartAgreementBuilderProps {
  isOpen: boolean
  onClose: () => void
  onCreated: (agreement: AgreementRecord) => void
  governmentFees: GovernmentFee[]
  clauses: ClauseDefinition[]
}

export function SmartAgreementBuilder({
  isOpen,
  onClose,
  onCreated,
  governmentFees,
  clauses
}: SmartAgreementBuilderProps) {
  const firm = useFirm()
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1)

  // Step 1: Persons
  const [clientName, setClientName] = useState("")
  // Aucune partie par défaut : l'entente s'ouvrait pré-remplie de deux
  // personnes qui n'existent pas. Le type est annoté explicitement, sans
  // quoi un tableau vide devient never[] et bloque tout ajout.
  const [persons, setPersons] = useState<
    { id: string; name: string; role: "principal" | "spouse" | "child" | "employer" | "sponsor"; isSignatory: boolean }[]
  >([])

  // Client Contact Details (CICC Regulation)
  const [clientAddress, setClientAddress] = useState("")
  const [clientCountry, setClientCountry] = useState("Canada (Québec)")
  const [clientPhone, setClientPhone] = useState("")
  const [clientEmail, setClientEmail] = useState("jf.tremblay@email.ca")

  // Step 2: Services
  const [services, setServices] = useState([
    {
      id: "s-1",
      personId: "p-1",
      personName: "",
      programName: "Programme de l'Expérience Québécoise (PEQ)",
      scopeIncluded: "Constitution complète du dossier CSQ + Demande de RP fédérale IRCC",
      scopeExcluded: "Traduction certifiée de documents non fournis en français/anglais",
      feeCents: 350000
    },
    {
      id: "s-2",
      personId: "p-2",
      personName: "",
      programName: "Permis de travail ouvert conjoint",
      scopeIncluded: "Dépôt conjoint et suivi permis de travail rattaché",
      scopeExcluded: "Frais de renouvellement ultérieur",
      feeCents: 120000
    }
  ])

  // Step 3: Government Fees (Débours)
  const [selectedFees, setSelectedFees] = useState<{ feeId: string; quantity: number }[]>([
    { feeId: "fee-01", quantity: 1 },
    { feeId: "fee-02", quantity: 1 },
    { feeId: "fee-04", quantity: 1 },
    { feeId: "fee-03", quantity: 2 }
  ])

  // Step 4: Clauses selection
  const [selectedClauseIds, setSelectedClauseIds] = useState<string[]>(clauses.map(c => c.id))

  // Step 5: Financials & Discount & Tax Exemption
  const [discountCents, setDiscountCents] = useState(20000) // $200.00
  const [discountLabel, setDiscountLabel] = useState("Remise Client Privilégié")
  const [isTaxExempt, setIsTaxExempt] = useState(false) // Checkbox client hors-Canada

  if (!isOpen) return null

  // Helpers
  const addPerson = () => {
    const newId = `p-${Date.now()}`
    setPersons(prev => [...prev, { id: newId, name: "", role: "child", isSignatory: false }])
  }

  const removePerson = (id: string) => {
    if (persons.length <= 1) return
    setPersons(prev => prev.filter(p => p.id !== id))
    setServices(prev => prev.filter(s => s.personId !== id))
  }

  const addService = () => {
    const defaultPerson = persons[0]
    setServices(prev => [
      ...prev,
      {
        id: `s-${Date.now()}`,
        personId: defaultPerson ? defaultPerson.id : "p-1",
        personName: defaultPerson ? defaultPerson.name : "Client",
        programName: "Entrée Express Fédéral",
        scopeIncluded: "Accompagnement et dépôt du profil MonCIC",
        scopeExcluded: "Frais d'évaluation EDE",
        feeCents: 250000
      }
    ])
  }

  const removeService = (id: string) => {
    setServices(prev => prev.filter(s => s.id !== id))
  }

  const toggleFee = (feeId: string) => {
    setSelectedFees(prev => {
      const exists = prev.find(f => f.feeId === feeId)
      if (exists) {
        return prev.filter(f => f.feeId !== feeId)
      } else {
        return [...prev, { feeId, quantity: 1 }]
      }
    })
  }

  // Financial Calculations
  const grossProfFeesCents = services.reduce((acc, s) => acc + s.feeCents, 0)
  const netProfFeesCents = Math.max(0, grossProfFeesCents - discountCents)
  const tpsCents = isTaxExempt ? 0 : Math.round(netProfFeesCents * 0.05)
  const tvqCents = isTaxExempt ? 0 : Math.round(netProfFeesCents * 0.09975)

  const totalGovFeesCents = selectedFees.reduce((acc, sf) => {
    const gf = governmentFees.find(f => f.id === sf.feeId)
    return acc + (gf ? gf.amountCents * sf.quantity : 0)
  }, 0)

  const grandTotalCents = netProfFeesCents + tpsCents + tvqCents + totalGovFeesCents

  const formatMoney = (cents: number) => {
    return (cents / 100).toLocaleString("fr-CA", { style: "currency", currency: "CAD" })
  }

  const handleFinalize = () => {
    // eslint-disable-next-line react-hooks/purity
    const ts = Date.now()
    const primaryPerson = persons.find(p => p.role === "principal") || persons[0]
    const primaryService = services[0]

    const created: AgreementRecord = {
      id: `agr-${ts}`,
      reference: `SA-2026-${ts.toString().slice(-6)}`,
      clientName: primaryPerson ? primaryPerson.name : clientName,
      clientAddress,
      clientCountryOfResidence: clientCountry,
      clientPhone,
      clientEmail,
      program: primaryService ? primaryService.programName : "Mandat Immigration CICC",
      date: new Date().toLocaleDateString("fr-CA"),
      status: "pending_signatures",
      persons: persons.map(p => ({
        id: p.id,
        personName: p.name || "Participant",
        partyRole: p.role,
        isSignatory: p.isSignatory
      })),
      services: services.map(s => ({
        id: s.id,
        personId: s.personId,
        personName: s.personName,
        programName: s.programName,
        scopeIncluded: s.scopeIncluded,
        scopeExcluded: s.scopeExcluded,
        feeCents: s.feeCents
      })),
      governmentFees: selectedFees.map(sf => {
        const gf = governmentFees.find(f => f.id === sf.feeId)
        return {
          feeId: sf.feeId,
          label: gf?.labelFr || "Frais officiel IRCC",
          amountCents: gf?.amountCents || 0,
          quantity: sf.quantity
        }
      }),
      discountCents,
      discountLabel,
      totalProfessionalFeesCents: netProfFeesCents,
      totalGovernmentFeesCents: totalGovFeesCents,
      tpsCents,
      tvqCents,
      isTaxExempt,
      grandTotalCents,
      rcicName: "Adama Diarra",
      rcicLicenceNo: firm.rcicNumber
    }

    onCreated(created)
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* MODAL HEADER */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center">
              <FileSignature className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="font-extrabold text-base tracking-tight text-white flex items-center gap-2">
                Assistant d&apos;Élaboration d&apos;Entente de Service CICC
                <span className="text-[10px] uppercase tracking-wider font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded">
                  PILIER A
                </span>
              </h2>
              <p className="text-xs text-slate-400">Générateur conforme au Règlement du CICC & Art. 13 Fidéicommis</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* STEP PROGRESS BAR */}
        <div className="bg-slate-100 border-b border-slate-200 px-6 py-3 flex items-center justify-between text-xs font-semibold text-slate-600">
          <div className={`flex items-center gap-2 ${step >= 1 ? "text-blue-700 font-bold" : ""}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono ${step >= 1 ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-600"}`}>1</span>
            <span>Personnes</span>
          </div>
          <div className="h-0.5 w-8 bg-slate-300"></div>
          <div className={`flex items-center gap-2 ${step >= 2 ? "text-blue-700 font-bold" : ""}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono ${step >= 2 ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-600"}`}>2</span>
            <span>Services</span>
          </div>
          <div className="h-0.5 w-8 bg-slate-300"></div>
          <div className={`flex items-center gap-2 ${step >= 3 ? "text-blue-700 font-bold" : ""}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono ${step >= 3 ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-600"}`}>3</span>
            <span>Débours IRCC</span>
          </div>
          <div className="h-0.5 w-8 bg-slate-300"></div>
          <div className={`flex items-center gap-2 ${step >= 4 ? "text-blue-700 font-bold" : ""}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono ${step >= 4 ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-600"}`}>4</span>
            <span>Clauses</span>
          </div>
          <div className="h-0.5 w-8 bg-slate-300"></div>
          <div className={`flex items-center gap-2 ${step >= 5 ? "text-blue-700 font-bold" : ""}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono ${step >= 5 ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-600"}`}>5</span>
            <span>Finances</span>
          </div>
        </div>

        {/* BODY STEP CONTENT */}
        <div className="p-6 overflow-y-auto flex-1 text-slate-800 text-sm">
          
          {/* STEP 1 : PERSONNES */}
          {step === 1 && (
            <div className="flex flex-col gap-5">
              <div className="bg-blue-50/70 border border-blue-200 p-4 rounded-2xl flex items-start gap-3 text-xs text-blue-900">
                <Users className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-sm font-bold text-blue-950">Structure Personne × Service (Modèle A.1)</strong>
                  Chaque entente rattache un client principal et ses dépendants. Les honoraires seront associés à chaque personne selon les prestations rendues.
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col gap-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <Building className="w-4 h-4 text-blue-600" />
                  Coordonnées Officiellement Validées du Client Principal (Conformité CICC)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Adresse postale complète</label>
                    <input 
                      type="text"
                      value={clientAddress}
                      onChange={(e) => setClientAddress(e.target.value)}
                      placeholder="Rue, App., Ville, Code Postal"
                      className="w-full px-3 py-2 font-semibold rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Pays de résidence actuel</label>
                    <input 
                      type="text"
                      value={clientCountry}
                      onChange={(e) => setClientCountry(e.target.value)}
                      placeholder="Ex: Canada (Québec), France, Sénégal..."
                      className="w-full px-3 py-2 font-semibold rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Numéro de téléphone</label>
                    <input 
                      type="text"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      placeholder="+1 (514) 000-0000"
                      className="w-full px-3 py-2 font-semibold rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Adresse courriel officielle</label>
                    <input 
                      type="email"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      placeholder="client@courriel.ca"
                      className="w-full px-3 py-2 font-semibold rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <label className="text-xs font-extrabold uppercase tracking-wider text-slate-600">
                  Membres de la Famille & Rôles
                </label>
                
                {persons.map((p, idx) => (
                  <div key={p.id} className="grid grid-cols-12 gap-3 items-center p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                    <div className="col-span-5">
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Nom complet</label>
                      <input 
                        type="text" 
                        value={p.name}
                        onChange={(e) => {
                          const val = e.target.value
                          setPersons(prev => prev.map(item => item.id === p.id ? { ...item, name: val } : item))
                        }}
                        placeholder="Prénom et Nom"
                        className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="col-span-4">
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Rôle contractuel</label>
                      <select 
                        value={p.role}
                        onChange={(e) => {
                          const val = e.target.value as "principal" | "spouse" | "child" | "sponsor" | "employer"
                          setPersons(prev => prev.map(item => item.id === p.id ? { ...item, role: val } : item))
                        }}
                        className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="principal">Demandeur Principal</option>
                        <option value="spouse">Conjoint(e)</option>
                        <option value="child">Enfant à charge</option>
                        <option value="sponsor">Répondant / Garant</option>
                        <option value="employer">Employeur (B2B)</option>
                      </select>
                    </div>
                    <div className="col-span-2 text-center">
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">Signataire ?</label>
                      <input 
                        type="checkbox"
                        checked={p.isSignatory}
                        onChange={(e) => {
                          const val = e.target.checked
                          setPersons(prev => prev.map(item => item.id === p.id ? { ...item, isSignatory: val } : item))
                        }}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                      />
                    </div>
                    <div className="col-span-1 text-right">
                      {idx > 0 && (
                        <button 
                          onClick={() => removePerson(p.id)}
                          className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                <button 
                  onClick={addPerson}
                  className="mt-2 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-slate-300 text-blue-600 font-bold text-xs hover:bg-blue-50 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Ajouter une personne (département / membre)</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2 : SERVICES */}
          {step === 2 && (
            <div className="flex flex-col gap-5">
              <div className="bg-emerald-50/70 border border-emerald-200 p-4 rounded-2xl flex items-start gap-3 text-xs text-emerald-900">
                <Sparkles className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-sm font-bold text-emerald-950">Attribution des Services CICC</strong>
                  Associez chaque prestation d&apos;immigration à la personne concernée. Le montant des honoraires professionnels sera calculé en temps réel.
                </div>
              </div>

              <div className="flex flex-col gap-4">
                {services.map((s, idx) => (
                  <div key={s.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col gap-3">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <span className="text-xs font-black uppercase text-blue-900">Prestation #{idx + 1}</span>
                      {idx > 0 && (
                        <button 
                          onClick={() => removeService(s.id)}
                          className="text-xs font-semibold text-rose-600 hover:text-rose-800"
                        >
                          Supprimer
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">Rattaché à la personne :</label>
                        <select 
                          value={s.personId}
                          onChange={(e) => {
                            const pid = e.target.value
                            const pName = persons.find(p => p.id === pid)?.name || "Participant"
                            setServices(prev => prev.map(item => item.id === s.id ? { ...item, personId: pid, personName: pName } : item))
                          }}
                          className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-white"
                        >
                          {persons.map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({p.role})</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">Programme CICC visé :</label>
                        <input 
                          type="text" 
                          value={s.programName}
                          onChange={(e) => {
                            const val = e.target.value
                            setServices(prev => prev.map(item => item.id === s.id ? { ...item, programName: val } : item))
                          }}
                          className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 bg-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">Portée Incluse :</label>
                        <textarea 
                          value={s.scopeIncluded}
                          onChange={(e) => {
                            const val = e.target.value
                            setServices(prev => prev.map(item => item.id === s.id ? { ...item, scopeIncluded: val } : item))
                          }}
                          rows={2}
                          className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-300 bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">Portée Exclue :</label>
                        <textarea 
                          value={s.scopeExcluded}
                          onChange={(e) => {
                            const val = e.target.value
                            setServices(prev => prev.map(item => item.id === s.id ? { ...item, scopeExcluded: val } : item))
                          }}
                          rows={2}
                          className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-300 bg-white text-slate-600"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-200/60">
                      <span className="text-xs font-bold text-slate-700">Honoraires HT ($ CAD) :</span>
                      <input 
                        type="number" 
                        value={s.feeCents / 100}
                        onChange={(e) => {
                          const valCents = Math.round(parseFloat(e.target.value || "0") * 100)
                          setServices(prev => prev.map(item => item.id === s.id ? { ...item, feeCents: valCents } : item))
                        }}
                        className="w-32 px-3 py-1.5 text-xs font-mono font-bold text-blue-900 rounded-xl border border-blue-300 bg-blue-50/50 text-right"
                      />
                    </div>
                  </div>
                ))}

                <button 
                  onClick={addService}
                  className="mt-2 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-emerald-300 text-emerald-700 font-bold text-xs hover:bg-emerald-50 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Ajouter une prestation de service CICC</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 3 : DÉBOURS GOUVERNEMENTAUX */}
          {step === 3 && (
            <div className="flex flex-col gap-5">
              <div className="bg-amber-50/70 border border-amber-200 p-4 rounded-2xl flex items-start gap-3 text-xs text-amber-900">
                <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-sm font-bold text-amber-950">Catalogue de Frais Gouvernementaux (Débours)</strong>
                  Les frais officiels de traitement IRCC / MIFI sont traités comme des **débours non taxables**. Ils sont perçus en Fidéicommis puis versés aux autorités.
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                {governmentFees.map(fee => {
                  const isSelected = selectedFees.some(sf => sf.feeId === fee.id)
                  const currentQty = selectedFees.find(sf => sf.feeId === fee.id)?.quantity || 1

                  return (
                    <div 
                      key={fee.id}
                      onClick={() => toggleFee(fee.id)}
                      className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                        isSelected 
                          ? "bg-amber-50/80 border-amber-300 shadow-sm" 
                          : "bg-slate-50 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input 
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}} // handled by div click
                          className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                        />
                        <div>
                          <strong className="text-xs font-bold text-slate-900 block">{fee.labelFr}</strong>
                          <span className="text-[11px] text-slate-500 font-mono">Autorité : {fee.authority} | Règle : {fee.calcRule}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {isSelected && (
                          <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                            <span className="text-[11px] font-semibold text-slate-500">Qté :</span>
                            <input 
                              type="number" 
                              min={1}
                              max={10}
                              value={currentQty}
                              onChange={(e) => {
                                const q = parseInt(e.target.value || "1", 10)
                                setSelectedFees(prev => prev.map(sf => sf.feeId === fee.id ? { ...sf, quantity: q } : sf))
                              }}
                              className="w-14 px-2 py-1 text-xs font-mono font-bold rounded-lg border border-slate-300 bg-white text-center"
                            />
                          </div>
                        )}
                        <span className="font-mono font-black text-sm text-slate-900">{formatMoney(fee.amountCents * (isSelected ? currentQty : 1))}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* STEP 4 : CLAUSES & VERROUILLAGE */}
          {step === 4 && (
            <div className="flex flex-col gap-5">
              <div className="bg-purple-50/70 border border-purple-200 p-4 rounded-2xl flex items-start gap-3 text-xs text-purple-900">
                <Lock className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-sm font-bold text-purple-950">Système de Clauses à 3 Niveaux de Verrouillage</strong>
                  Validation des clauses contractuelles requises par le Collège des consultants en immigration (CICC).
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {clauses.map(c => {
                  const isChecked = selectedClauseIds.includes(c.id)

                  return (
                    <div key={c.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {c.level === "structural" && (
                            <span className="bg-slate-900 text-white text-[10px] font-mono font-black px-2 py-0.5 rounded flex items-center gap-1">
                              <Lock className="w-3 h-3 text-slate-300" /> Structurelle 🔒
                            </span>
                          )}
                          {c.level === "cicc_required" && (
                            <span className="bg-emerald-800 text-white text-[10px] font-mono font-black px-2 py-0.5 rounded flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3 text-emerald-300" /> Exigée CICC 🛡️
                            </span>
                          )}
                          {c.level === "free" && (
                            <span className="bg-blue-800 text-white text-[10px] font-mono font-black px-2 py-0.5 rounded flex items-center gap-1">
                              Clause Libre ✍️
                            </span>
                          )}
                          <strong className="text-xs font-extrabold text-slate-900">{c.titleFr}</strong>
                        </div>

                        {c.isOptional && (
                          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                            <input 
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedClauseIds(prev => [...prev, c.id])
                                } else {
                                  setSelectedClauseIds(prev => prev.filter(id => id !== c.id))
                                }
                              }}
                              className="w-4 h-4 text-purple-600 rounded"
                            />
                            <span>Inclure dans l&apos;entente</span>
                          </label>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-200 leading-relaxed font-medium">
                        {c.bodyFr}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* STEP 5 : FINANCES & VENTILATION */}
          {step === 5 && (
            <div className="flex flex-col gap-5">
              
              {/* MODIFICATION DIRECTE DES FRAIS DE SERVICE */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col gap-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    Ajustement & Modification des Honoraires Professionnels
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">Modifiable avant émission</span>
                </h4>
                <div className="flex flex-col gap-2">
                  {services.map((s) => (
                    <div key={s.id} className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <strong className="text-slate-900 font-bold block">{s.programName}</strong>
                        <span className="text-[11px] text-slate-500">Pour : {s.personName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 font-semibold">Honoraires ($) :</span>
                        <input 
                          type="number"
                          value={s.feeCents / 100}
                          onChange={(e) => {
                            const newAmount = Math.round(parseFloat(e.target.value || "0") * 100)
                            setServices(prev => prev.map(item => item.id === s.id ? { ...item, feeCents: newAmount } : item))
                          }}
                          className="w-28 px-3 py-1.5 font-mono font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded-xl text-right focus:bg-white focus:border-blue-600 outline-none"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* CASE À COCHER EXONÉRATION DE TAXES (CLIENT HORS CANADA) */}
              <div className="p-4 bg-amber-50/80 border border-amber-300 rounded-2xl flex items-center justify-between gap-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={isTaxExempt}
                    onChange={(e) => setIsTaxExempt(e.target.checked)}
                    className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 shrink-0"
                  />
                  <div>
                    <strong className="text-xs font-black text-amber-950 block">
                      Client résidant actuellement à l&apos;extérieur du Canada (Exonération de Taxes)
                    </strong>
                    <span className="text-[11px] text-amber-800 font-medium block">
                      Applique une taxe TPS/TVQ à 0.00$ (Art. 9 Partie V Annexe VI de la Loi sur la taxe de vente).
                    </span>
                  </div>
                </label>
                <span className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-full uppercase shrink-0 ${isTaxExempt ? "bg-emerald-700 text-white" : "bg-slate-200 text-slate-700"}`}>
                  {isTaxExempt ? "Exonéré (0% Taxe)" : "Taxable (QC/CA)"}
                </span>
              </div>

              <div className="bg-emerald-900 text-white p-5 rounded-3xl shadow-lg flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div>
                    <h3 className="font-extrabold text-base text-white tracking-tight">Récapitulatif Financier Opposable CICC</h3>
                    <p className="text-xs text-emerald-200">Ventilation stricte des honoraires, remises, taxes et débours</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-mono font-bold bg-white/20 text-white px-3 py-1 rounded">
                      CAD ($)
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium">
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between text-emerald-100">
                      <span>Honoraires professionnels Bruts :</span>
                      <span className="font-mono font-bold text-white">{formatMoney(grossProfFeesCents)}</span>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-amber-300">
                      <input 
                        type="text"
                        value={discountLabel}
                        onChange={(e) => setDiscountLabel(e.target.value)}
                        placeholder="Libellé de la remise"
                        className="bg-transparent border-b border-amber-300/40 text-amber-200 font-semibold text-[11px] outline-none w-36"
                      />
                      <input 
                        type="number"
                        value={discountCents / 100}
                        onChange={(e) => setDiscountCents(Math.round(parseFloat(e.target.value || "0") * 100))}
                        className="w-24 px-2 py-1 text-xs font-mono font-bold text-emerald-950 bg-amber-200 rounded-lg text-right"
                      />
                    </div>

                    <div className="flex justify-between text-emerald-100 pt-1 border-t border-emerald-800">
                      <span>Sous-total Honoraires Nets HT :</span>
                      <span className="font-mono font-bold text-white">{formatMoney(netProfFeesCents)}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 border-t md:border-t-0 md:border-l border-emerald-800 pt-2 md:pt-0 md:pl-4">
                    <div className="flex justify-between text-emerald-100">
                      <span>TPS (5.00%) :</span>
                      <span className="font-mono text-white">
                        {isTaxExempt ? "0,00 $ (Exonéré)" : formatMoney(tpsCents)}
                      </span>
                    </div>
                    <div className="flex justify-between text-emerald-100">
                      <span>TVQ (9.975%) :</span>
                      <span className="font-mono text-white">
                        {isTaxExempt ? "0,00 $ (Exonéré)" : formatMoney(tvqCents)}
                      </span>
                    </div>
                    <div className="flex justify-between text-amber-200 pt-1 border-t border-emerald-800">
                      <span>Débours IRCC / MIFI (Exonérés) :</span>
                      <span className="font-mono font-bold text-amber-300">{formatMoney(totalGovFeesCents)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center bg-white/10 p-4 rounded-2xl border border-white/20">
                  <span className="font-black text-sm uppercase tracking-wide text-white">TOTAL GÉNÉRAL DU CONTRAT :</span>
                  <span className="font-mono font-black text-2xl text-amber-300">{formatMoney(grandTotalCents)} CAD</span>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs flex items-center justify-between">
                <div>
                  <strong className="block text-slate-900 font-bold">Consultant Titulaire Responsable</strong>
                  <span className="text-slate-500 font-mono">{firm.rcicName} (Permis CICC #{firm.rcicNumber})</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Contresignature électronique prête</span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* MODAL FOOTER */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            disabled={step === 1}
            onClick={() => setStep(prev => Math.max(1, prev - 1) as 1 | 2 | 3 | 4 | 5)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Précédent</span>
          </button>

          {step < 5 ? (
            <button
              onClick={() => setStep(prev => Math.min(5, prev + 1) as 1 | 2 | 3 | 4 | 5)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm font-semibold"
            >
              <span>Étape suivante</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleFinalize}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-md animate-pulse"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Émettre & Transmettre l&apos;Entente CICC</span>
            </button>
          )}
        </div>

      </div>
    </div>
  )
}
