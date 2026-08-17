"use client"

import React, { useState } from "react"
import { X, CheckCircle2, ShieldCheck, Lock, Plus, Trash2, ArrowRight, ArrowLeft, DollarSign, Users, FileSignature, Wand2, Building } from "lucide-react"
import { AgreementRecord, ClauseDefinition, GovernmentFee } from "@/lib/data/types"
import { useFirm } from "@/components/app-shell/firm-provider"
import { ConformiteContrat } from "@/components/agreements/conformite-contrat"
import { EXIGENCES_CONTRATS, type TypeContratCicc } from "@/lib/legal/cicc-contrats"

const LIBELLES_ETAPES: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "Personnes",
  2: "Services",
  3: "Débours IRCC",
  4: "Clauses",
  5: "Finances",
}

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

  // Le Code prévoit deux contrats distincts, à deux moments distincts : le
  // contrat de consultation avant la consultation initiale (art. 23), le
  // contrat de services avant toute prestation (art. 24). Tant que ce choix
  // n'est pas fait, on ne sait pas quel contenu le contrat doit couvrir, et
  // ouvrir l'assistant sur le formulaire d'honoraires n'aurait pas de sens.
  const [typeContrat, setTypeContrat] = useState<TypeContratCicc | null>(null)

  // Objet, portée et honoraires de la consultation — art. 23(2)c) et e). Les
  // honoraires ont leur propre champ : ceux du contrat de services sont portés
  // par la liste des services, que le contrat de consultation n'a pas.
  const [objetConsultation, setObjetConsultation] = useState("")
  const [honorairesConsultationCents, setHonorairesConsultationCents] = useState(0)
  const [consultationProBono, setConsultationProBono] = useState(false)
  const [dureeConsultationMinutes, setDureeConsultationMinutes] = useState(60)

  // Mentions que l'article 24 exige et qu'aucun autre champ ne recueillait.
  const [conseilsPreliminaires, setConseilsPreliminaires] = useState("")
  const [instructionsClient, setInstructionsClient] = useState("")
  const [delaisEstimes, setDelaisEstimes] = useState("")
  const [personnesAssistantes, setPersonnesAssistantes] = useState("")
  const [langueService, setLangueService] = useState<"français" | "anglais">("français")
  // Éléments de rédaction attestés par le titulaire (voir ConformiteContrat).
  const [attestes, setAttestes] = useState<Set<string>>(new Set())
  const basculerAttestation = (ref: string) =>
    setAttestes(prev => {
      const suivant = new Set(prev)
      if (suivant.has(ref)) suivant.delete(ref)
      else suivant.add(ref)
      return suivant
    })

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
  const [clientCountry, setClientCountry] = useState("")
  const [clientPhone, setClientPhone] = useState("")
  const [clientEmail, setClientEmail] = useState("")

  // Step 2 : Services. Aucun service par défaut — l'assistant s'ouvrait sur un
  // mandat PEQ à 3 500 $ et un permis de travail à 1 200 $ pour un client qui
  // n'existe pas. Des honoraires pré-inscrits dans un contrat réglementé se
  // signent sans être relus.
  const [services, setServices] = useState<
    {
      id: string
      personId: string
      personName: string
      programName: string
      scopeIncluded: string
      scopeExcluded: string
      feeCents: number
    }[]
  >([])

  // Step 3 : débours. Rien de coché : les frais gouvernementaux dépendent du
  // programme et du nombre de personnes, pas d'un choix par défaut.
  const [selectedFees, setSelectedFees] = useState<{ feeId: string; quantity: number }[]>([])

  // Step 4: Clauses selection
  const [selectedClauseIds, setSelectedClauseIds] = useState<string[]>(clauses.map(c => c.id))

  // Step 5: Financials & Discount & Tax Exemption
  const [discountCents, setDiscountCents] = useState(0)
  const [discountLabel, setDiscountLabel] = useState("")
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
        personName: defaultPerson ? defaultPerson.name : "",
        programName: "",
        scopeIncluded: "",
        scopeExcluded: "",
        feeCents: 0
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
  const grossProfFeesCents =
    typeContrat === "consultation"
      ? honorairesConsultationCents
      : services.reduce((acc, s) => acc + s.feeCents, 0)
  const netProfFeesCents = Math.max(0, grossProfFeesCents - discountCents)
  const tpsCents = isTaxExempt ? 0 : Math.round(netProfFeesCents * 0.05)
  const tvqCents = isTaxExempt ? 0 : Math.round(netProfFeesCents * 0.09975)

  const totalGovFeesCents = selectedFees.reduce((acc, sf) => {
    const gf = governmentFees.find(f => f.id === sf.feeId)
    return acc + (gf ? gf.amountCents * sf.quantity : 0)
  }, 0)

  const grandTotalCents = netProfFeesCents + tpsCents + tvqCents + totalGovFeesCents

  /**
   * Éléments du Code que les données saisies couvrent effectivement.
   *
   * Un élément n'est coché que si la donnée correspondante existe. On ne
   * suppose rien : un champ vide reste un manque, y compris quand le contexte
   * rend l'oubli improbable.
   */
  // Pas de useMemo ici : ce composant retourne null quand il est fermé, et un
  // hook placé après ce retour ne serait pas appelé à chaque rendu. Le calcul
  // parcourt quelques dizaines d'éléments, il ne coûte rien.
  const couvertsParLesDonnees = ((): Set<string> => {
    const c = new Set<string>()
    const nomClient = (persons.find(p => p.role === "principal") ?? persons[0])?.name || clientName
    const cabinetComplet = Boolean(
      firm.rcicName && firm.rcicNumber && firm.address && firm.phone && firm.email
    )

    if (typeContrat === "consultation") {
      if (cabinetComplet) c.add("23(2)a)")
      if (nomClient.trim() && (clientAddress.trim() || clientPhone.trim() || clientEmail.trim())) {
        c.add("23(2)b)")
      }
      // Le Code accepte l'un ou l'autre : un montant, ou l'énoncé pro bono.
      if (grossProfFeesCents > 0 || consultationProBono) c.add("23(2)c)")
      if (objetConsultation.trim()) c.add("23(2)e)")
      return c
    }

    if (cabinetComplet) c.add("24(3)a)")
    if (nomClient.trim() && clientAddress.trim() && clientPhone.trim() && clientEmail.trim()) {
      c.add("24(3)b)")
    }
    if (conseilsPreliminaires.trim()) c.add("24(3)c)")
    if (personnesAssistantes.trim()) c.add("24(3)e)")
    if (instructionsClient.trim()) c.add("24(3)f)")
    if (services.length > 0 && services.every(s => s.programName.trim() && s.scopeIncluded.trim())) {
      c.add("24(3)g)")
    }
    if (delaisEstimes.trim()) c.add("24(3)h)")
    if (grossProfFeesCents > 0) c.add("24(3)i)")
    if (selectedFees.length > 0) c.add("24(3)j)")
    // Les taxes figurent au récapitulatif dans les deux cas : soit calculées,
    // soit indiquées comme exonérées avec le motif.
    c.add("24(3)k)")
    if (langueService) c.add("24(3)s)")
    return c
  })()

  const exigences = typeContrat ? EXIGENCES_CONTRATS[typeContrat] : null
  const manquants = exigences
    ? exigences.elements.filter(e =>
        e.origine === "redaction" ? !attestes.has(e.ref) : !couvertsParLesDonnees.has(e.ref)
      )
    : []

  /** Le contrat de consultation n'a ni services multiples, ni débours, ni clauses. */
  const etapesUtiles: (1 | 2 | 3 | 4 | 5)[] =
    typeContrat === "consultation" ? [1, 5] : [1, 2, 3, 4, 5]
  const indexEtape = Math.max(0, etapesUtiles.indexOf(step))
  const etapeSuivante = etapesUtiles[indexEtape + 1]
  const etapePrecedente = etapesUtiles[indexEtape - 1]

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
      rcicName: firm.rcicName,
      rcicLicenceNo: firm.rcicNumber,
      contractType: typeContrat ?? undefined,
      consultationScope: objetConsultation || undefined,
      attestedElements: [...attestes]
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
              <h2 className="font-extrabold text-base tracking-tight text-white">
                {exigences ? `Ébauche — ${exigences.titreFr}` : "Nouveau contrat"}
              </h2>
              {/* Le sous-titre annonçait un « générateur conforme au Règlement
                  du CICC ». Un gabarit ne rend pas un contrat conforme, et
                  l'affirmer déchargeait le titulaire d'une vérification qui
                  lui revient. */}
              <p className="text-xs text-slate-400">
                {exigences
                  ? `Contenu énuméré à l’article ${exigences.article} du Code de déontologie (DORS/2022-128)`
                  : "Code de déontologie (DORS/2022-128), articles 23 et 24"}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* CHOIX DU CONTRAT — préalable à tout le reste */}
        {!typeContrat && (
          <div className="p-6 overflow-y-auto flex-1 text-slate-800">
            <p className="text-xs leading-relaxed text-slate-600 mb-5">
              Le Code de déontologie (DORS/2022-128) prévoit deux contrats distincts, à deux
              moments distincts de la relation. Ce ne sont pas deux formules au choix : le contenu
              exigé n’est pas le même, et l’un ne dispense pas de l’autre.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(["consultation", "services"] as const).map((t) => {
                const ex = EXIGENCES_CONTRATS[t]
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { setTypeContrat(t); setStep(1) }}
                    className="text-left rounded-2xl border-2 border-slate-200 bg-white p-5 transition-colors hover:border-blue-500 hover:bg-blue-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                  >
                    <span className="inline-block rounded-full bg-slate-900 px-2.5 py-0.5 font-mono text-[10px] font-bold text-white">
                      art. {ex.article}
                    </span>
                    <h3 className="mt-2.5 text-sm font-black text-slate-900">{ex.titreFr}</h3>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-slate-600">
                      {ex.declencheurFr}
                    </p>
                    <p className="mt-3 border-t border-slate-100 pt-2.5 text-[10px] font-bold text-slate-500">
                      {ex.elements.length} éléments de contenu exigés
                    </p>
                  </button>
                )
              })}
            </div>

            <p className="mt-5 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-[11px] leading-relaxed text-amber-900">
              Les articles 23 et 24 ne s’appliquent pas dans les cas prévus à l’article 25, et le
              Collège peut accorder une exemption dans ceux de l’article 26. Cet assistant produit
              une ébauche : le contrat que vous ferez signer relève de votre responsabilité
              professionnelle et devrait être revu par un conseiller juridique.
            </p>
          </div>
        )}

        {/* STEP PROGRESS BAR */}
        {typeContrat && (
        <div className="bg-slate-100 border-b border-slate-200 px-6 py-3 flex items-center justify-between text-xs font-semibold text-slate-600">
          {/* Le contrat de consultation n'a ni services multiples, ni débours,
              ni clauses : afficher ces étapes reviendrait à annoncer un
              parcours qu'on ne lui fera pas suivre. */}
          {etapesUtiles.map((e, i) => (
            <React.Fragment key={e}>
              {i > 0 && <div className="h-0.5 w-8 bg-slate-300" />}
              <div className={`flex items-center gap-2 ${step >= e ? "text-blue-700 font-bold" : ""}`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono ${step >= e ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-600"}`}>
                  {i + 1}
                </span>
                <span>{LIBELLES_ETAPES[e]}</span>
              </div>
            </React.Fragment>
          ))}
        </div>
        )}

        {/* BODY STEP CONTENT */}
        {typeContrat && (
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
                <Wand2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
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

              {/* OBJET ET PORTÉE — exigé au contrat de consultation, 23(2)e) */}
              {typeContrat === "consultation" && (
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col gap-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                    Objet et portée de la consultation
                    <span className="ml-2 font-mono text-[10px] font-normal text-slate-400">23(2)e)</span>
                  </h4>
                  <textarea
                    value={objetConsultation}
                    onChange={(e) => setObjetConsultation(e.target.value)}
                    rows={3}
                    placeholder="Ce sur quoi portera la consultation, et ce qu'elle ne couvre pas."
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex flex-wrap items-center gap-4 border-t border-slate-200 pt-3">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-semibold text-slate-600">Durée :</span>
                      <div className="flex gap-1">
                        {[30, 45, 60, 90, 120].map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setDureeConsultationMinutes(d)}
                            className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                              dureeConsultationMinutes === d
                                ? "bg-blue-600 text-white border-blue-600"
                                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            {d} min
                          </button>
                        ))}
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-xs">
                      <span className="font-semibold text-slate-600">
                        Honoraires de la consultation ($)
                        <span className="ml-1.5 font-mono text-[10px] font-normal text-slate-400">23(2)c)</span>
                      </span>
                      <input
                        type="number"
                        min={0}
                        disabled={consultationProBono}
                        value={honorairesConsultationCents / 100}
                        onChange={(e) =>
                          setHonorairesConsultationCents(Math.round(parseFloat(e.target.value || "0") * 100))
                        }
                        className="w-28 px-3 py-1.5 font-mono font-bold text-right rounded-xl border border-slate-300 bg-white disabled:bg-slate-100 disabled:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </label>
                    <label className="flex items-center gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={consultationProBono}
                        onChange={(e) => {
                          setConsultationProBono(e.target.checked)
                          if (e.target.checked) setHonorairesConsultationCents(0)
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="font-semibold text-slate-600">
                        Consultation offerte pro bono
                      </span>
                    </label>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    L’alinéa c) exige soit le montant des honoraires, soit un énoncé indiquant que
                    la consultation est offerte pro bono. Des honoraires laissés à zéro sans cette
                    mention ne couvrent ni l’un ni l’autre.
                  </p>
                </div>
              )}

              {/* MENTIONS EXIGÉES QU'AUCUN AUTRE CHAMP NE RECUEILLAIT */}
              {typeContrat === "services" && (
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col gap-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                    Mentions exigées par l’article 24
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <label className="flex flex-col gap-1 md:col-span-2">
                      <span className="font-semibold text-slate-600">
                        Résumé des conseils préliminaires donnés
                        <span className="ml-1.5 font-mono text-[10px] font-normal text-slate-400">24(3)c)</span>
                      </span>
                      <textarea
                        value={conseilsPreliminaires}
                        onChange={(e) => setConseilsPreliminaires(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </label>
                    <label className="flex flex-col gap-1 md:col-span-2">
                      <span className="font-semibold text-slate-600">
                        Instructions du client
                        <span className="ml-1.5 font-mono text-[10px] font-normal text-slate-400">24(3)f)</span>
                      </span>
                      <textarea
                        value={instructionsClient}
                        onChange={(e) => setInstructionsClient(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="font-semibold text-slate-600">
                        Délais estimés de prestation
                        <span className="ml-1.5 font-mono text-[10px] font-normal text-slate-400">24(3)h)</span>
                      </span>
                      <input
                        type="text"
                        value={delaisEstimes}
                        onChange={(e) => setDelaisEstimes(e.target.value)}
                        placeholder="ex. dépôt sous 8 semaines à compter des pièces complètes"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="font-semibold text-slate-600">
                        Personnes susceptibles de vous assister
                        <span className="ml-1.5 font-mono text-[10px] font-normal text-slate-400">24(3)e)</span>
                      </span>
                      <input
                        type="text"
                        value={personnesAssistantes}
                        onChange={(e) => setPersonnesAssistantes(e.target.value)}
                        placeholder="Noms, ou « aucune » s’il n’y en a pas"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="font-semibold text-slate-600">
                        Langue officielle de prestation
                        <span className="ml-1.5 font-mono text-[10px] font-normal text-slate-400">24(3)s)</span>
                      </span>
                      <select
                        value={langueService}
                        onChange={(e) => setLangueService(e.target.value as "français" | "anglais")}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="français">Français</option>
                        <option value="anglais">Anglais</option>
                      </select>
                    </label>
                  </div>
                </div>
              )}

              {/* MODIFICATION DIRECTE DES FRAIS DE SERVICE.
                  Masqué pour la consultation : elle n'a pas de liste de
                  services, et laisser un éditeur vide qu'aucune étape ne
                  remplit ne mène nulle part. */}
              {typeContrat === "services" && (
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
              )}

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
                    <h3 className="font-extrabold text-base text-white tracking-tight">Récapitulatif financier</h3>
                    <p className="text-xs text-emerald-200">
                      Honoraires, remises, taxes et débours — alinéas i) à l) de l’article 24
                    </p>
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
                    {/* L'étape « Débours » n'existe pas pour la consultation :
                        afficher une ligne que rien ne peut remplir. */}
                    {typeContrat === "services" && (
                      <div className="flex justify-between text-amber-200 pt-1 border-t border-emerald-800">
                        <span>Débours IRCC / MIFI (Exonérés) :</span>
                        <span className="font-mono font-bold text-amber-300">{formatMoney(totalGovFeesCents)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center bg-white/10 p-4 rounded-2xl border border-white/20">
                  <span className="font-black text-sm uppercase tracking-wide text-white">TOTAL GÉNÉRAL DU CONTRAT :</span>
                  <span className="font-mono font-black text-2xl text-amber-300">{formatMoney(grandTotalCents)} CAD</span>
                </div>
              </div>

              {typeContrat && (
                <ConformiteContrat
                  type={typeContrat}
                  couvertsParLesDonnees={couvertsParLesDonnees}
                  attestes={attestes}
                  onBasculer={basculerAttestation}
                />
              )}

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs flex items-center justify-between">
                <div>
                  <strong className="block text-slate-900 font-bold">Consultant Titulaire Responsable</strong>
                  <span className="text-slate-500 font-mono">
                    {firm.rcicName || "—"}
                    {firm.rcicNumber && ` (permis CICC #${firm.rcicNumber})`}
                  </span>
                </div>
              </div>
            </div>
          )}

        </div>
        )}

        {/* MODAL FOOTER */}
        {typeContrat && (
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-4">
          <button
            onClick={() => {
              if (etapePrecedente) setStep(etapePrecedente)
              else setTypeContrat(null)
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{etapePrecedente ? "Précédent" : "Changer de contrat"}</span>
          </button>

          {etapeSuivante ? (
            <button
              onClick={() => setStep(etapeSuivante)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
            >
              <span>Étape suivante</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex items-center gap-3">
              {/* Le bouton reste actif : refuser l'émission reviendrait à
                  décider à la place du titulaire, alors que l'assistant ne
                  peut constater qu'un manque parmi les éléments qu'il connaît.
                  Il le dit, il ne bloque pas. */}
              {manquants.length > 0 && (
                <span className="text-[11px] font-bold text-amber-800">
                  {manquants.length} élément{manquants.length > 1 ? "s" : ""} de l’article{" "}
                  {exigences?.article} non couvert{manquants.length > 1 ? "s" : ""}
                </span>
              )}
              <button
                onClick={handleFinalize}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-md"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Émettre l’ébauche du {exigences?.titreFr.toLowerCase()}</span>
              </button>
            </div>
          )}
        </div>
        )}

      </div>
    </div>
  )
}
