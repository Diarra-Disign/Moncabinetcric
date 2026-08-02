"use client"

import * as React from "react"
import { 
  FileText, 
  Sparkles, 
  Copy, 
  CheckCircle2, 
  ShieldCheck, 
  Printer, 
  RefreshCw, 
  BookOpen,
  Edit3,
  RotateCcw
} from "lucide-react"

interface SubmissionLetterBuilderProps {
  matterId: string
  clientName: string
  programName: string
  rcicName?: string
  rcicNumber?: string
}

export function SubmissionLetterBuilder({
  matterId,
  clientName,
  programName,
  rcicName = "Adama Diarra, RCIC",
  rcicNumber = "R-514982"
}: SubmissionLetterBuilderProps) {
  const [processingOffice, setProcessingOffice] = React.useState("Centre de Traitement des Demandes (CTD-Ottawa)")
  const [language, setLanguage] = React.useState<"fr" | "en">("fr")
  const [customArgument, setCustomArgument] = React.useState(
    "Le candidat démontre une intégration économique et linguistique optimale avec un score NCLC 9 et une expérience qualifiée au Québec au sens de l'article 87.1 du RIPR."
  )
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [copied, setCopied] = React.useState(false)

  // Citations légales automatiques d'après la LIPR / RIPR selon le programme
  const getLegalCitations = () => {
    const prog = programName.toLowerCase()
    if (prog.includes("peq") || prog.includes("résidence") || prog.includes("express")) {
      return {
        law: "Loi sur l'immigration et la protection des réfugiés (LIPR, L.C. 2001, c. 27)",
        section: "Article 12(1) — Catégorie de l'immigration économique",
        reg: "Règlement sur l'immigration et la protection des réfugiés (RIPR, DORS/2002-227)",
        regSection: "Article 87.1 — Catégorie de l'expérience canadienne",
        summary: "Le demandeur satisfait pleinement aux critères d'admissibilité de la catégorie économique en vertu de son expérience professionnelle qualifiée et de sa maîtrise linguistique avérée."
      }
    } else if (prog.includes("parrainage") || prog.includes("époux") || prog.includes("conjoint")) {
      return {
        law: "Loi sur l'immigration et la protection des réfugiés (LIPR, L.C. 2001, c. 27)",
        section: "Article 12(2) — Catégorie du regroupement familial (Époux / Conjoint de fait)",
        reg: "Règlement sur l'immigration et la protection des réfugiés (RIPR, DORS/2002-227)",
        regSection: "Article 124 — Membre de la catégorie des époux ou conjoints de fait au Canada",
        summary: "La relation entre le répondant et le demandeur parrainé est authentique et n'a pas été contractée aux fins d'acquérir un statut au sens de l'article 4 du RIPR."
      }
    } else if (prog.includes("travail") || prog.includes("eimt") || prog.includes("lmia")) {
      return {
        law: "Loi sur l'immigration et la protection des réfugiés (LIPR, L.C. 2001, c. 27)",
        section: "Article 30(1) — Autorisation de travailler au Canada",
        reg: "Règlement sur l'immigration et la protection des réfugiés (RIPR, DORS/2002-227)",
        regSection: "Article 200 — Délivrance du permis de travail avec EIMT conforme",
        summary: "L’offre d'emploi respecte l’ensemble des conditions du marché du travail canadien et bénéficie d’une étude d’impact sur le marché du travail (EIMT) favorable émise par EDSC/MIFI."
      }
    } else {
      return {
        law: "Loi sur l'immigration et la protection des réfugiés (LIPR, L.C. 2001, c. 27)",
        section: "Article 30(2) — Autorisation d'étudier au Canada",
        reg: "Règlement sur l'immigration et la protection des réfugiés (RIPR, DORS/2002-227)",
        regSection: "Article 216 — Exigence d'établissement et capacité financière",
        summary: "Le demandeur a établi la légitimité de son projet d'études, dispose des ressources financières suffisantes et quittera le Canada à l'expiration de son séjour autorisé."
      }
    }
  }

  const legalInfo = getLegalCitations()

  const generateDefaultTemplate = React.useCallback((overrideLang?: "fr" | "en", overrideVariant?: number) => {
    const activeLang = overrideLang || language
    const currentVariant = overrideVariant !== undefined ? overrideVariant : variantIndex

    let variantParagraphFr = ""
    let variantParagraphEn = ""

    if (currentVariant === 1) {
      variantParagraphFr = `ENRICHISSEMENT DU PROFIL — INTÉGRATION ÉCONOMIQUE & LINGUISTIQUE (VARIANTE 2) :
Le candidat présente un dossier exemplaire caractérisé par une maîtrise linguistique supérieure (NCLC 9 vérifié), une expérience professionnelle ininterrompue au Canada et une contribution fiscale mesurable. Son profil s'inscrit directement dans les priorités ministérielles de rétention des talents qualifiés au Québec et au Canada.`
      variantParagraphEn = `PROFILE ENHANCEMENT — ECONOMIC INTEGRATION & LANGUAGE PROFICIENCY (VARIANT 2):
The applicant presents an exemplary application highlighted by superior language proficiency (verified CLB 9), uninterrupted qualifying Canadian work experience, and a established tax track record. Their profile aligns directly with ministerial priorities for retaining skilled talent.`
    } else if (currentVariant === 2) {
      variantParagraphFr = `CONFORMITÉ RIGOUREUSE ET TRAITEMENT PRIORITAIRE (VARIANTE 3) :
L'ensemble des exigences médicales, sécuritaires et biométriques a fait l'objet d'un audit préalable rigoureux par notre cabinet. Aucune interdiction de territoire au sens des articles 34 à 42 de la LIPR n'est applicable. Nous sollicitons un examen diligent au regard de l'échéance d'embauche imminente.`
      variantParagraphEn = `RIGOROUS COMPLIANCE & EXPEDITED PROCESSING (VARIANT 3):
All medical, background, and biometric prerequisites have undergone prior verification by our firm. No inadmissibility grounds under sections 34 to 42 of the IRPA apply. We respectfully request expedited review in light of the imminent employment start date.`
    } else {
      variantParagraphFr = `PRÉSENTATION DU DOSSIER ET ADMISSIBILITÉ (VARIANTE 1) :
${customArgument}`
      variantParagraphEn = `APPLICATION OVERVIEW & ELIGIBILITY (VARIANT 1):
${customArgument}`
    }

    if (activeLang === "fr") {
      return `CABINET IMMIGRATION BORÉALE INC.
Consultants Réglementés en Immigration Canadienne (CRIC / RCIC)
Permis CICC : ${rcicNumber} | Titulaire : ${rcicName}
Montréal & Outaouais, Québec, Canada

Date : ${new Date().toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" })}

À L'ATTENTION DE L'AGENT D'IMMIGRATION
Immigration, Réfugiés et Citoyenneté Canada (IRCC)
${processingOffice}

OBJET : SOUMISSION DE LA DEMANDE D'IMMIGRATION — ${programName.toUpperCase()}
Dossier Réf. : ${matterId}
Demandeur principal : ${clientName}

Madame, Monsieur l'Agent,

En notre qualité de mandataire accrédité au sens du formulaire IMM 5476 (Conseiller en immigration titulaire du permis CICC n° ${rcicNumber}), nous avons l'honneur de vous soumettre la présente demande au nom de notre client(e), ${clientName}.

1. FONDEMENT JURIDIQUE ET ÉLIGIBILITÉ
Cette demande est présentée en vertu de la ${legalInfo.law}, notamment l'${legalInfo.section}, ainsi que du ${legalInfo.reg} (${legalInfo.regSection}).

${variantParagraphFr}

2. INVENTAIRE DES PIÈCES JUSTIFICATIVES ATTACHÉES (ANNEXE A)
Conformément au guide de contrôle d'IRCC, l'ensemble des pièces requises a été scrupuleusement vérifié, numéroté et certifié conforme par notre cabinet :
- Annexe A.1 : Pièces d'identité et Passeport certifié conforme
- Annexe A.2 : Résultats des tests linguistiques officiels (NCLC 9)
- Annexe A.3 : Attestations d'expérience professionnelle et relevés d'emplois qualifiés
- Annexe A.4 : Preuves de capacité financière et quittance de fidéicommis (Art. 13 CICC)
- Annexe A.5 : Formulaire IMM 5476 dûment signé et horodaté

CONCLUSION ET DEMANDE FORMELLE
Considérant que ${clientName} remplit l'ensemble des exigences statutaires prescrites par la LIPR et le RIPR, nous sollicitons respectueusement l'approbation de sa demande et l'émission des documents d'immigration correspondants.

Veuillez agréer, Madame, Monsieur l'Agent, l'expression de notre haute considération.

_______________________________________
${rcicName}, RCIC / CRIC
Membre du Collège des consultants en immigration (CICC) # ${rcicNumber}
Cabinet Immigration Boréale Inc.`
    } else {
      return `BOREAL IMMIGRATION CABINET INC.
Regulated Canadian Immigration Consultants (RCIC)
CICC Licence #: ${rcicNumber} | Licensee: ${rcicName}
Montreal & Outaouais, Quebec, Canada

Date: ${new Date().toLocaleDateString("en-CA", { day: "numeric", month: "long", year: "numeric" })}

TO THE ATTENTION OF THE IMMIGRATION OFFICER
Immigration, Refugees and Citizenship Canada (IRCC)
${processingOffice}

SUBJECT: SUBMISSION OF IMMIGRATION APPLICATION — ${programName.toUpperCase()}
Matter Ref.: ${matterId}
Principal Applicant: ${clientName}

Dear Immigration Officer,

As the authorized representative under form IMM 5476 (Regulated Canadian Immigration Consultant, CICC Licence #${rcicNumber}), we are pleased to submit this formal application on behalf of our client, ${clientName}.

1. STATUTORY BASIS & ELIGIBILITY
This application is submitted pursuant to the ${legalInfo.law}, specifically ${legalInfo.section}, and the ${legalInfo.reg} (${legalInfo.regSection}).

${variantParagraphEn}

2. INDEX OF ATTACHED SUPPORTING DOCUMENTS (SCHEDULE A)
In strict compliance with the IRCC document checklist, all required evidence has been audited, indexed, and verified by our firm:
- Schedule A.1: Certified Passport and Identity Documents
- Schedule A.2: Official Language Test Results
- Schedule A.3: Verified Employment Reference Letters & Proof of Qualifying Experience
- Schedule A.4: Proof of Financial Sufficiency & CICC Trust Account Receipt (Art. 13)
- Schedule A.5: Duly Executed IMM 5476 Representation Form

CONCLUSION & FORMAL REQUEST
Considering that ${clientName} fully satisfies all statutory requirements established under the IRPA and IRPR, we respectfully request the approval of this application and the issuance of the corresponding status documents.

Sincerely,

_______________________________________
${rcicName}, RCIC / CRIC
College of Immigration and Citizenship Consultants (CICC) Licence #${rcicNumber}
Boreal Immigration Cabinet Inc.`
    }
  }, [language, variantIndex, processingOffice, programName, matterId, clientName, rcicNumber, rcicName, legalInfo, customArgument])

  // État local du texte de la lettre pour permettre la modification directe
  const [editableLetterText, setEditableLetterText] = React.useState<string>(() => generateDefaultTemplate())

  const handleGenerate = () => {
    setIsGenerating(true)
    const nextVariant = (variantIndex + 1) % 3
    setVariantIndex(nextVariant)

    setTimeout(() => {
      setIsGenerating(false)
      const newText = generateDefaultTemplate(language, nextVariant)
      setEditableLetterText(newText)
      
      const varName = language === "fr" ? VARIATION_NAMES_FR[nextVariant] : VARIATION_NAMES_EN[nextVariant]
      setToastNotice(`✨ Nouvelle lettre IA générée avec succès : ${varName}`)
      setTimeout(() => setToastNotice(null), 5000)
    }, 500)
  }

  const handleToggleLanguage = () => {
    const nextLang = language === "fr" ? "en" : "fr"
    setLanguage(nextLang)
    setIsGenerating(true)
    setTimeout(() => {
      setIsGenerating(false)
      setEditableLetterText(generateDefaultTemplate(nextLang, variantIndex))
    }, 400)
  }

  const handleResetToDefault = () => {
    setEditableLetterText(generateDefaultTemplate(language, variantIndex))
    setToastNotice("Texte réinitialisé au modèle d'origine.")
    setTimeout(() => setToastNotice(null), 3000)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(editableLetterText)
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  const handlePrint = () => {
    const printWindow = window.open("", "_blank")
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Lettre de Soumission IRCC - ${clientName} (${matterId})</title>
            <style>
              body { font-family: 'Times New Roman', serif; padding: 40px; line-height: 1.6; color: #111; font-size: 13pt; }
              .header { font-family: sans-serif; border-bottom: 2px solid #1e3a8a; padding-bottom: 15px; margin-bottom: 30px; }
              .header h1 { color: #1e3a8a; font-size: 16pt; margin: 0; }
              .header p { margin: 2px 0; font-size: 9pt; color: #555; }
              .legal-box { background: #f8fafc; border-left: 4px solid #2563eb; padding: 10px; margin: 15px 0; font-size: 11pt; }
              pre { white-space: pre-wrap; font-family: 'Times New Roman', serif; font-size: 12pt; }
            </style>
          </head>
          <body>
            <pre>${editableLetterText}</pre>
            <script>window.print();</script>
          </body>
        </html>
      `)
      printWindow.document.close()
    }
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* TOAST INTAL DE CONFIRMATION DE GÉNÉRATION */}
      {toastNotice && (
        <div className="bg-emerald-950 text-emerald-200 border border-emerald-500/50 p-3 px-4 rounded-2xl text-xs font-bold flex items-center justify-between shadow-lg animate-fadeIn">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            {toastNotice}
          </span>
          <button onClick={() => setToastNotice(null)} className="text-emerald-400 hover:text-white">✕</button>
        </div>
      )}

      {/* BANDEAU SUPÉRIEUR INTELLIGENT AVEC BADGE CICC */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-6 rounded-3xl shadow-xl border border-blue-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-2xl bg-blue-500/20 border border-blue-400/30 text-blue-300 flex items-center justify-center font-bold shrink-0">
            <Sparkles className="w-6 h-6 text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-300 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded">
                Générateur d&apos;Élite IRCC / LIPR
              </span>
              <span className="text-[10px] font-mono text-slate-300">
                v2.5 Éditabilité Intégrale
              </span>
            </div>
            <h2 className="text-lg font-black text-white mt-1">
              Générateur d&apos;Argumentaire & Lettre de Soumission IRCC
            </h2>
            <p className="text-xs text-slate-300 font-medium mt-0.5">
              Citations légales automatiques de la LIPR / RIPR. Rédigez, modifiez ou ajoutez directement vos éléments dans le texte.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
          <button
            type="button"
            onClick={handleToggleLanguage}
            className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/15 transition-all cursor-pointer"
          >
            🌐 {language === "fr" ? "Passer en Anglais (EN)" : "Passer en Français (FR)"}
          </button>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-md shadow-blue-600/30 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? "animate-spin" : ""}`} />
            <span>{isGenerating ? "Génération..." : "Régénérer"}</span>
          </button>
        </div>
      </div>

      {/* RANGÉE : CONFIGURATION DU BAREME JURIDIQUE + FEUILLE ÉDITABLE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* PARAMÈTRES JURIDIQUES ET ARGUMENTS (COLONNE 1/3) */}
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-2">
              <BookOpen className="w-4 h-4 text-blue-600" />
              <span>Citations de Loi & Bureau IRCC</span>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Bureau d&apos;Instruction IRCC Destinataire
              </label>
              <select
                value={processingOffice}
                onChange={(e) => setProcessingOffice(e.target.value)}
                className="w-full text-xs font-semibold p-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
              >
                <option value="Centre de Traitement des Demandes (CTD-Ottawa)">Centre de Traitement des Demandes (CTD-Ottawa)</option>
                <option value="Bureau des Visas d'IRCC — Montréal, Québec">Bureau des Visas d&apos;IRCC — Montréal, Québec</option>
                <option value="Ambassade du Canada à Paris (France)">Ambassade du Canada à Paris (France)</option>
                <option value="Haut-Commissariat du Canada à Dakar (Sénégal)">Haut-Commissariat du Canada à Dakar (Sénégal)</option>
                <option value="Centre de Traitement Principal — Sydney (Nouvelle-Écosse)">Centre de Traitement Principal — Sydney (N.-É.)</option>
              </select>
            </div>

            {/* ENCADRÉ CITATION AUTOMATIQUE LIPR / RIPR */}
            <div className="p-3.5 rounded-2xl bg-blue-50/80 border border-blue-200 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-blue-900 text-[11px] uppercase">Règles Légales Détectées</span>
                <span className="text-[10px] font-mono font-black text-blue-700">LIPR / RIPR</span>
              </div>
              <p className="font-bold text-slate-900">{legalInfo.law}</p>
              <p className="text-[11px] text-blue-900 font-semibold">{legalInfo.section}</p>
              <p className="text-[11px] text-blue-900 font-semibold">{legalInfo.regSection}</p>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Argumentation Sur-Mesure du Consultant
              </label>
              <textarea
                rows={4}
                value={customArgument}
                onChange={(e) => setCustomArgument(e.target.value)}
                className="w-full text-xs font-medium p-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-600 focus:outline-none transition-all leading-relaxed"
                placeholder="Rédigez l'argument d'intégration ou de praticabilité..."
              />
            </div>

            <div className="p-3 rounded-2xl bg-slate-100 text-[11px] text-slate-600 font-medium flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Conforme au Code de déontologie CICC & IMM 5476.</span>
            </div>
          </div>
        </div>

        {/* FEUILLE D'ÉDITION DIRECTE ET IMPRESSION (COLONNE 2/3) */}
        <div className="lg:col-span-2 space-y-4">
          
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-black text-slate-900">
                Texte Éditable en Direct ({language.toUpperCase()})
              </span>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Modification interactive active
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetToDefault}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                title="Rétablir le modèle de base initial"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Réinitialiser</span>
              </button>

              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors cursor-pointer"
              >
                {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Copié !" : "Copier le texte"}</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors cursor-pointer shadow-2xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimer / PDF</span>
              </button>
            </div>
          </div>

          {/* FEUILLE ÉDITABLE STYLE PAPIER DE SOUMISSION OFFICIEL */}
          <div className="bg-white p-6 sm:p-10 rounded-3xl border border-slate-300 shadow-xl font-serif text-slate-900 text-xs leading-relaxed space-y-4 relative min-h-[550px] ring-1 ring-slate-900/5">
            <div className="border-b-2 border-blue-900 pb-3 flex items-center justify-between">
              <div>
                <h3 className="font-sans font-black text-sm tracking-tight text-blue-900 uppercase">
                  Cabinet Immigration Boréale Inc.
                </h3>
                <p className="font-sans text-[10px] text-slate-500 font-semibold mt-0.5">
                  Consultants Réglementés en Immigration Canadienne (CRIC / RCIC)
                </p>
              </div>
              <div className="text-right font-sans text-[10px]">
                <span className="font-bold text-blue-900 block">Permis CICC : #{rcicNumber}</span>
                <span className="text-slate-500">{rcicName}</span>
              </div>
            </div>

            {/* TEXTAREA INTERACTIF EN GUISE DE FEUILLE DE SOUMISSION */}
            <textarea
              value={editableLetterText}
              onChange={(e) => setEditableLetterText(e.target.value)}
              rows={22}
              className="w-full font-serif text-xs leading-relaxed text-slate-900 bg-transparent border-0 focus:ring-0 focus:outline-none resize-y p-1 selection:bg-blue-100 leading-relaxed font-normal"
              placeholder="Saisissez ou modifiez le contenu de votre lettre..."
            />
          </div>

        </div>

      </div>
    </div>
  )
}
