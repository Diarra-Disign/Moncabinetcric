"use client"

import * as React from "react"
import { useFirm } from "@/components/app-shell/firm-provider"
import { 
  Building2, 
  User, 
  ShieldCheck, 
  CreditCard, 
  Video, 
  Calendar, 
  Save, 
  CheckCircle2, 
  Sparkles, 
  Lock, 
  FileText, 
  DollarSign, 
  Globe, 
  Key, 
  Upload,
  Check,
  AlertTriangle,
  FileImage,
  Loader2
} from "lucide-react"
import { PageHeader } from "@/components/app-shell/page-header"
import { useRouter } from "@/i18n/routing"
import { updateFirmSettings } from "@/lib/data/actions"

export function SettingsClient() {
  const firm = useFirm()
  const router = useRouter()
  const [activeTab, setActiveTab] = React.useState<"cabinet" | "taxes" | "stripe" | "zoom">("cabinet")
  const [notice, setNotice] = React.useState<string | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)

  // Cabinet state
  const [companyName, setCompanyName] = React.useState(firm.name)
  const [rcicNumber, setRcicNumber] = React.useState(firm.rcicNumber)
  const [rcicName, setRcicName] = React.useState(firm.rcicName)
  const [address, setAddress] = React.useState(firm.address)
  const [phone, setPhone] = React.useState(firm.phone)
  const [email, setEmail] = React.useState(firm.email)
  const [replyToEmail, setReplyToEmail] = React.useState(firm.replyToEmail)
  const [emailSenderName, setEmailSenderName] = React.useState(firm.emailSenderName)
  const [logoUrl, setLogoUrl] = React.useState(firm.logoUrl)

  // Logo error & file upload state
  const [imgError, setImgError] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Synchronise les états quand la prop firm change
  const [prevFirm, setPrevFirm] = React.useState(firm)
  if (firm !== prevFirm) {
    setPrevFirm(firm)
    setCompanyName(firm.name)
    setRcicNumber(firm.rcicNumber)
    setRcicName(firm.rcicName)
    setAddress(firm.address)
    setPhone(firm.phone)
    setEmail(firm.email)
    setReplyToEmail(firm.replyToEmail)
    setEmailSenderName(firm.emailSenderName)
    setLogoUrl(firm.logoUrl)
  }

  // Reset img error on logoUrl change
  const handleLogoUrlChange = (newUrl: string) => {
    setLogoUrl(newUrl)
    setImgError(false)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      alert("Veuillez choisir un fichier image (PNG, JPG, SVG, WEBP).")
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setLogoUrl(reader.result)
        setImgError(false)
      }
    }
    reader.readAsDataURL(file)
  }

  // Taxes state
  const [tpsNumber, setTpsNumber] = React.useState("123456789 RT0001")
  const [tvqNumber, setTvqNumber] = React.useState("1234567890 TQ0001")
  const [autoTaxExempt, setAutoTaxExempt] = React.useState(true)

  // Stripe State
  const [stripeConnected, setStripeConnected] = React.useState(true)
  const [stripeAccountId, setStripeAccountId] = React.useState("acct_1M89x2KkL90aZZ2")
  const [publishableKey, setPublishableKey] = React.useState("pk_live_51M89x2KkL90aZZ2...")

  // Zoom / Meet / Calendly State
  const [zoomConnected, setZoomConnected] = React.useState(true)
  const [zoomEmail, setZoomEmail] = React.useState("")
  const [calendlyUrl, setCalendlyUrl] = React.useState("")  // À saisir par le cabinet : aucun lien par défaut.
  const [preferredPlatform, setPreferredPlatform] = React.useState<"calendly" | "zoom" | "google_meet">("calendly")

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    const payload = {
      name: companyName,
      rcicNumber,
      rcicName,
      address,
      phone,
      email,
      replyToEmail,
      emailSenderName,
      logoUrl,
    }

    // 1. Sauvegarde locale immédiate dans localStorage
    try {
      localStorage.setItem("cric_firm_settings", JSON.stringify({
        companyName,
        rcicNumber,
        rcicName,
        address,
        phone,
        email,
        replyToEmail,
        emailSenderName,
        logoUrl,
      }))
      window.dispatchEvent(new Event("cric-firm-updated"))
    } catch {
      // Ignorer si localStorage désactivé
    }

    // 2. Sauvegarde backend / Supabase
    try {
      await updateFirmSettings(payload)
    } catch (err) {
      console.error("Erreur enregistrement paramètres cabinet :", err)
    } finally {
      setIsSaving(false)
    }

    setNotice("Paramètres du cabinet et logo enregistrés avec succès !")
    setTimeout(() => setNotice(null), 5000)
    router.refresh()
  }

  // Détection si l'URL saisie pointe vers un dossier au lieu d'un fichier image
  const isDirectoryUrl = React.useMemo(() => {
    const trimmed = logoUrl.trim()
    if (!trimmed) return false
    return trimmed.endsWith("/") || /\/public_html\/[^\.\/]+\/?$/i.test(trimmed)
  }, [logoUrl])


  return (
    <div className="flex flex-col gap-8 pb-16">
      
      {/* NOTICE BANNER */}
      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-3xl p-4 flex items-center justify-between shadow-md animate-fadeIn">
          <div className="flex items-center gap-3 font-bold text-xs sm:text-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{notice}</span>
          </div>
        </div>
      )}

      <PageHeader
        title="Paramètres Cabinet & Intégrations"
        subtitle="Personnalisez les informations légales, numéros de taxe, intégrations Stripe et visioconférence de votre étude."
        action={
          <div className="flex items-center gap-3">
            {/* L'abonnement était jusqu'ici sans porte d'entrée : la page
                existait, aucun écran n'y menait. */}
            <button
              type="button"
              onClick={() => router.push("/settings/subscription")}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-bold text-foreground shadow-sm transition-colors hover:bg-muted cursor-pointer"
            >
              <CreditCard className="w-4 h-4 text-muted-foreground" />
              <span>Abonnement</span>
            </button>

            <button
              type="button"
              onClick={() => router.push("/settings/audit")}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-950 hover:bg-indigo-900 border border-indigo-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-all cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Journal d&apos;Audit CICC & Approbations</span>
            </button>

            <button 
              type="button"
              onClick={handleSaveSettings}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Enregistrer les Modifications</span>
            </button>
          </div>
        }
      />

      {/* BANNIÈRE DE BIENVENUE MULTI-TENANT */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-3xl p-6 shadow-xl border border-blue-400/20 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="pointer-events-none absolute -top-24 -right-24 w-64 h-64 rounded-full bg-blue-500/20 blur-3xl" />
        
        <div className="flex items-center gap-4 relative z-10">
          <div className="h-12 w-12 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-md shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black tracking-tight text-white">Profil Cabinet CRIC & Intégrations APIs (V1 SaaS)</h2>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                Multi-Tenant Isolé
              </span>
            </div>
            <p className="text-xs text-white/70 mt-0.5">
              Personnalisez les factures, numéros de taxes, Stripe Connect & visio Zoom de votre cabinet
            </p>
          </div>
        </div>

        <button 
          type="button"
          onClick={handleSaveSettings}
          className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 text-xs font-bold transition-all shadow-md cursor-pointer self-end md:self-auto"
        >
          <Save className="w-4 h-4" />
          <span>Enregistrer les Modifications</span>
        </button>
      </div>

      {/* HEADER & ONGLETS DE NAVIGATION DE PARAMÈTRES */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl w-full sm:w-auto overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("cabinet")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === "cabinet" ? "bg-white text-blue-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Identité Cabinet & CICC</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("taxes")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === "taxes" ? "bg-white text-blue-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Taxes & Fidéicommis</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("stripe")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === "stripe" ? "bg-white text-emerald-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Stripe Connect (Paiements)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("zoom")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === "zoom" ? "bg-white text-purple-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Video className="w-4 h-4" />
            <span>Zoom & Google Calendar</span>
          </button>
        </div>
      </div>

      {/* CONTENU DE L'ONGLET SÉLECTIONNÉ */}
      <form onSubmit={handleSaveSettings} className="bg-white rounded-3xl border border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.02)] p-6 sm:p-8 flex flex-col gap-6">
        
        {/* TAB 1: IDENTITÉ CABINET */}
        {activeTab === "cabinet" && (
          <div className="flex flex-col gap-5 animate-fadeIn">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black text-slate-900">Coordonnées Officielle du Cabinet CRIC</h3>
              <p className="text-xs text-slate-500 font-medium">Ces informations apparaîtront sur vos factures, mandats CICC et portail client.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Raison Sociale / Nom du Cabinet</label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs font-medium rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Nom du Consultant Principal (RCIC)</label>
                <input
                  type="text"
                  required
                  value={rcicName}
                  onChange={(e) => setRcicName(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs font-medium rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">N° de Permis / Licence CICC</label>
                <input
                  type="text"
                  required
                  value={rcicNumber}
                  onChange={(e) => setRcicNumber(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs font-medium rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none transition-all font-mono"
                />
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Adresse Physique du Cabinet au Canada</label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs font-medium rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Courriel Professionnel Officiel</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs font-medium rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Téléphone de Contact</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs font-medium rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
                />
              </div>

              {/* ---------------------------------------------------------
                  L'IDENTITÉ DES COURRIELS ENVOYÉS AUX CLIENTS
                  --------------------------------------------------------- */}
              <div className="flex flex-col gap-3 sm:col-span-2 border-t border-slate-100 pt-4">
                <div>
                  <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                    Courriels envoyés à vos clients
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    Ce que voit le destinataire d&apos;un questionnaire, d&apos;un rappel ou d&apos;une
                    invitation au portail.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                      Nom affiché
                    </label>
                    <input
                      type="text"
                      value={emailSenderName}
                      onChange={(e) => setEmailSenderName(e.target.value)}
                      placeholder={companyName}
                      className="w-full px-4 py-2.5 text-xs font-medium rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
                    />
                    <span className="text-[11px] text-slate-400">
                      Vide : votre raison sociale, « {companyName || "—"} ».
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                      Adresse de réponse
                    </label>
                    <input
                      type="email"
                      value={replyToEmail}
                      onChange={(e) => setReplyToEmail(e.target.value)}
                      placeholder={email || "vous@votrecabinet.ca"}
                      className="w-full px-4 py-2.5 text-xs font-medium rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
                    />
                    <span className="text-[11px] text-slate-400">
                      Vide : votre courriel professionnel ci-dessus.
                    </span>
                  </div>
                </div>

                {/* Ce que le destinataire verra, avec les valeurs saisies —
                    montré plutôt que décrit : la cascade « nom affiché, sinon
                    raison sociale » se comprend d'un coup d'œil, là où une
                    phrase l'aurait fait deviner. */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                    Aperçu dans la boîte de réception
                  </span>
                  <p className="text-xs font-bold text-slate-900 mt-1">
                    {emailSenderName || companyName || "Votre cabinet"}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Répondre à : {replyToEmail || email || "—"}
                  </p>
                </div>

                <p className="text-[11px] text-slate-500 leading-relaxed rounded-2xl border border-amber-200 bg-amber-50 p-3">
                  <strong>L&apos;adresse d&apos;expédition technique reste celle de la plateforme.</strong>{" "}
                  Un fournisseur de courriel n&apos;expédie que depuis un domaine dont la propriété est
                  prouvée par des enregistrements DNS : expédier directement depuis votre domaine
                  ferait rejeter le message, ou le classerait en indésirable sans que personne ne
                  l&apos;apprenne. Votre nom et votre adresse de réponse, eux, sont bien les vôtres —
                  c&apos;est ce que votre client voit et ce à quoi sa réponse parviendra. Pour expédier
                  depuis votre propre domaine, écrivez-nous : cela demande de vérifier ce domaine.
                </p>
              </div>

              {/* GESTIONNAIRE DE LOGO DU CABINET */}
              <div className="flex flex-col gap-3 sm:col-span-2 border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                    Logo Personnel du Cabinet (Affiché sur Ententes, Factures et Reçus CICC)
                  </label>
                  
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    accept="image/*" 
                    className="hidden" 
                  />
                  
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-xl transition-all cursor-pointer"
                  >
                    <FileImage className="w-3.5 h-3.5" />
                    <span>Choisir une image sur mon ordinateur</span>
                  </button>
                </div>

                <div className="flex flex-col md:flex-row items-start gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div className="w-20 h-20 rounded-2xl border border-slate-300 bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-xs relative">
                    {logoUrl && !imgError ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img 
                        src={logoUrl} 
                        alt="Logo Cabinet" 
                        onError={() => setImgError(true)}
                        className="w-full h-full object-contain p-1" 
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-400 p-1 text-center">
                        <span className="font-black text-2xl text-slate-800 font-mono">M</span>
                        <span className="text-[9px] text-slate-500 font-medium">Aperçu Logo</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 flex flex-col gap-2 text-xs w-full">
                    <div className="flex items-center gap-2">
                      <input 
                        type="text" 
                        value={logoUrl}
                        onChange={(e) => handleLogoUrlChange(e.target.value)}
                        placeholder="Ex: https://votredomaine.com/logo.png (ou téléversez une image ci-dessus)"
                        className={`w-full px-3.5 py-2 text-xs font-mono font-medium rounded-xl border bg-white focus:outline-none transition-colors ${
                          isDirectoryUrl || imgError
                            ? "border-amber-400 focus:border-amber-600 bg-amber-50/30"
                            : "border-slate-300 focus:border-blue-600"
                        }`}
                      />
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                      <Upload className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span>Ce logo sera imprimé en en-tête de toutes vos ententes de services, factures et reçus fidéicommis.</span>
                    </div>

                    {/* ALERTE DIAGNOSTIC SI L'URL POINTE VERS UN DOSSIER OU EST IMPOSSIBLE À CHARGER */}
                    {(isDirectoryUrl || imgError) && (
                      <div className="mt-1 p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs flex flex-col gap-1.5 animate-fadeIn">
                        <div className="flex items-center gap-2 font-bold text-amber-950">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>Attention : Le lien du logo n&apos;est pas valide ou ne charge pas</span>
                        </div>
                        {isDirectoryUrl ? (
                          <p className="text-[11px] leading-relaxed">
                            L&apos;URL renseignée (<code>.../public_html/Images/</code>) pointe vers un <strong>dossier / répertoire web</strong> et non vers un fichier d&apos;image. Une image requiert le nom complet du fichier avec son extension (ex: <code>.../Images/logo.png</code>).
                          </p>
                        ) : (
                          <p className="text-[11px] leading-relaxed">
                            Le navigateur n&apos;a pas pu charger l&apos;image à cette adresse. Assurez-vous qu&apos;il s&apos;agit d&apos;un lien direct vers un fichier image (PNG, JPG, SVG).
                          </p>
                        )}
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 underline hover:text-blue-900 cursor-pointer"
                          >
                            👉 Cliquez ici pour importer directement le fichier image depuis votre ordinateur
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: TAXES & FIDÉICOMMIS */}
        {activeTab === "taxes" && (
          <div className="flex flex-col gap-5 animate-fadeIn">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-lg font-black text-slate-900">Matrice Fiscale & Numéros de Taxes Canadiennes</h3>
              <p className="text-xs text-slate-500 font-medium">Configurez vos identifiants TPS/TVQ pour le calcul automatique sur les factures.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">N° de TPS / TVH (Canada Revenue Agency)</label>
                <input
                  type="text"
                  required
                  value={tpsNumber}
                  onChange={(e) => setTpsNumber(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs font-medium rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none transition-all font-mono"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">N° de TVQ (Revenu Québec)</label>
                <input
                  type="text"
                  required
                  value={tvqNumber}
                  onChange={(e) => setTvqNumber(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs font-medium rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:outline-none transition-all font-mono"
                />
              </div>

              <div className="flex flex-col gap-2 sm:col-span-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoTaxExempt}
                    onChange={(e) => setAutoTaxExempt(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-0 cursor-pointer"
                  />
                  <span>Exonérer automatiquement la TPS/TVQ pour les candidats résidant hors du Canada (Mention légale 0$)</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: STRIPE CONNECT */}
        {activeTab === "stripe" && (
          <div className="flex flex-col gap-5 animate-fadeIn">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900">Intégration Stripe Connect (Paiements Fidéicommis & Général)</h3>
                <p className="text-xs text-slate-500 font-medium">Encaissez les honoraires par carte de crédit sans gérer les données bancaires (Conforme PCI-DSS).</p>
              </div>
              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono text-xs font-bold px-3 py-1 rounded-full">
                <Check className="w-3.5 h-3.5" /> Connecté à Stripe
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Identifiant de Compte Stripe Connect :</span>
                  <span className="font-mono text-xs font-black text-slate-900">{stripeAccountId}</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200/60 pt-2">
                  <span className="text-xs font-bold text-slate-700">Clé Publique (Publishable Key) :</span>
                  <span className="font-mono text-xs text-slate-500">{publishableKey}</span>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 text-blue-900 p-4 rounded-2xl text-xs font-medium leading-relaxed flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Isolation Fidéicommis :</strong> Les acomptes payés par carte bancaire sont dirigés directement vers votre sous-compte Fidéicommis Stripe avec rapprochement automatique dans le SaaS.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: CALENDLY & VISIOCONFÉRENCE */}
        {activeTab === "zoom" && (
          <div className="flex flex-col gap-5 animate-fadeIn">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900">Intégration Calendly & Visioconférence (Zoom / Google Meet)</h3>
                <p className="text-xs text-slate-500 font-medium">Fournissez votre lien Calendly/TidyCal personnel ou utilisez la génération automatique Zoom/Meet pour vos clients.</p>
              </div>
              <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-800 border border-purple-300 font-mono text-xs font-bold px-3 py-1 rounded-full">
                <Check className="w-3.5 h-3.5" /> Calendly & Zoom Activés
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Votre Lien de Réservation Calendly / TidyCal</label>
                <div className="relative flex items-center">
                  <Globe className="absolute left-3 w-4 h-4 text-slate-400" />
                  <input
                    type="url"
                    placeholder="https://calendly.com/votre-nom/consultation"
                    value={calendlyUrl}
                    onChange={(e) => setCalendlyUrl(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 text-xs font-bold font-mono rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-purple-600 focus:outline-none transition-all"
                  />
                </div>
                <p className="text-[11px] text-slate-500">Ce lien sera proposé automatiquement à vos candidats sur leur Portail Client et dans vos signatures de courriels.</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Mode de visioconférence par défaut</label>
                <select
                  value={preferredPlatform}
                  onChange={(e) => setPreferredPlatform(e.target.value as "calendly" | "zoom" | "google_meet")}
                  className="w-full px-4 py-2.5 text-xs font-bold rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-purple-600 focus:outline-none transition-all"
                >
                  <option value="calendly">Utiliser mon lien Calendly (Prise de RDV libre par le client)</option>
                  <option value="zoom">Zoom Video (Lien généré automatiquement)</option>
                  <option value="google_meet">Google Meet (Lien généré via Google Calendar)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Compte Zoom / Google Associé</label>
                <input
                  type="email"
                  required
                  value={zoomEmail}
                  onChange={(e) => setZoomEmail(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs font-medium rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-purple-600 focus:outline-none transition-all"
                />
              </div>

              <div className="md:col-span-2 bg-purple-50 border border-purple-200 text-purple-900 p-4 rounded-2xl text-xs font-medium leading-relaxed flex items-start gap-2.5">
                <Video className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Synchronisation bidirectionnelle :</strong> Lorsqu&apos;un client choisit un créneau via votre lien Calendly ou que vous planifiez une visio depuis sa fiche dossier, la date et le lien de rencontre sont synchronisés en temps réel sur le <strong>Portail Client</strong>.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Save button */}
        <div className="flex items-center justify-end pt-4 border-t border-slate-100">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-3 text-xs font-bold shadow-md transition-all cursor-pointer"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{isSaving ? "Enregistrement en cours..." : "Enregistrer les Paramètres"}</span>
          </button>
        </div>

      </form>
    </div>
  )
}
