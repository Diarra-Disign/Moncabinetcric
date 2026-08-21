"use client"

import * as React from "react"
import { useFirm } from "@/components/app-shell/firm-provider"
import { RaccordCalendly } from "@/components/calendar/raccord-calendly"
import type { EtatCalendly } from "@/lib/data/calendly-actions"
import { 
  Building2, 
  ShieldCheck, 
  CreditCard, 
  Video, 
  Save, 
  CheckCircle2, 
  Lock, 
  FileText, 
  Globe, 
  Upload,
  Check,
  AlertTriangle,
  FileImage,
  Loader2
} from "lucide-react"
import { PageHeader } from "@/components/app-shell/page-header"
import { useRouter } from "@/i18n/routing"
import { updateFirmSettings } from "@/lib/data/actions"
import { PROVINCES } from "@/lib/data/adresse"

/** La classe des champs de ce formulaire, écrite une fois. Six champs
 *  d'adresse recopiant la même chaîne auraient divergé au premier ajustement. */
const CHAMP_PARAM =
  "w-full px-4 py-2.5 text-xs font-medium rounded-2xl bg-muted/40 border border-border " +
  "focus:bg-card focus:border-primary focus:outline-none transition-all"

export function SettingsClient({ calendly }: { calendly: EtatCalendly }) {
  const firm = useFirm()
  const router = useRouter()
  const [activeTab, setActiveTab] = React.useState<"cabinet" | "taxes" | "stripe" | "zoom">("cabinet")
  const [notice, setNotice] = React.useState<string | null>(null)
  const [isSaving, setIsSaving] = React.useState(false)
  /** §10 : l'échec doit se voir, et dire pourquoi. */
  const [erreur, setErreur] = React.useState<string | null>(null)

  // Cabinet state
  const [companyName, setCompanyName] = React.useState(firm.name)
  const [rcicNumber, setRcicNumber] = React.useState(firm.rcicNumber)
  const [rcicName, setRcicName] = React.useState(firm.rcicName)
  const [address, setAddress] = React.useState(firm.address)
  // L'ADRESSE EN MORCEAUX. Un seul champ libre suffisait à un en-tête de
  // facture, où l'adresse n'est qu'un repère. Il ne suffit pas à un contrat :
  // c'est là qu'elle IDENTIFIE le représentant, et le document doit pouvoir
  // écrire « Gatineau (Québec) J8X 0B9 » sans deviner où finit la ville.
  const [addressLine2, setAddressLine2] = React.useState(firm.addressLine2)
  const [city, setCity] = React.useState(firm.city)
  const [province, setProvince] = React.useState(firm.province)
  const [postalCode, setPostalCode] = React.useState(firm.postalCode)
  const [country, setCountry] = React.useState(firm.country || "Canada")
  const [phone, setPhone] = React.useState(firm.phone)
  const [email, setEmail] = React.useState(firm.email)
  const [replyToEmail, setReplyToEmail] = React.useState(firm.replyToEmail)
  const [emailSenderName, setEmailSenderName] = React.useState(firm.emailSenderName)
  // Ces champs affichaient « 123456789 RT0001 », un numéro d'inscription
  // INVENTÉ, identique pour tous les cabinets et qui n'était jamais
  // enregistré. Un consultant pouvait le croire sien et l'imprimer sur ses
  // factures — un numéro de TPS erroné sur une pièce comptable n'est pas une
  // coquille d'affichage.
  const [tpsNumber, setTpsNumber] = React.useState(firm.taxGstNumber)
  const [tvqNumber, setTvqNumber] = React.useState(firm.taxQstNumber)
  const [tpsRate, setTpsRate] = React.useState(String(Math.round(firm.taxGstRate * 10000) / 100))
  const [tvqRate, setTvqRate] = React.useState(String(Math.round(firm.taxQstRate * 10000) / 100))
  const [invoicePrefix, setInvoicePrefix] = React.useState(firm.invoicePrefix)
  const [paymentTerms, setPaymentTerms] = React.useState(firm.paymentTerms)
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
    setAddressLine2(firm.addressLine2)
    setCity(firm.city)
    setProvince(firm.province)
    setPostalCode(firm.postalCode)
    setCountry(firm.country || "Canada")
    setPhone(firm.phone)
    setEmail(firm.email)
    setReplyToEmail(firm.replyToEmail)
    setEmailSenderName(firm.emailSenderName)
    setTpsNumber(firm.taxGstNumber)
    setTvqNumber(firm.taxQstNumber)
    setTpsRate(String(Math.round(firm.taxGstRate * 10000) / 100))
    setTvqRate(String(Math.round(firm.taxQstRate * 10000) / 100))
    setInvoicePrefix(firm.invoicePrefix)
    setPaymentTerms(firm.paymentTerms)
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


  // Stripe Connect n'est pas branché, et ces trois valeurs le disent.
  //
  // C'étaient des `useState` dont aucun `set` n'était jamais appelé : un état
  // qui ne change pas est une constante, et l'écrire comme un état laissait
  // croire qu'un branchement viendrait le remplir. Le jour où Stripe Connect
  // existera, ces lignes redeviendront des états — et le compilateur signalera
  // tout ce qu'il faut alors rebrancher.
  const stripeConnected = false
  const stripeAccountId = ""
  const publishableKey = ""

  // Le lien de prise de rendez-vous, LU DEPUIS LA BASE.
  //
  // Quatre états vivaient ici : un lien Calendly, un mode de visioconférence,
  // un compte Zoom/Google et un booléen « Zoom connecté ». Aucun n'était
  // envoyé au serveur, et la table `firms` n'avait aucune colonne où les
  // écrire. L'écran annonçait « enregistrés avec succès », puis le
  // rafraîchissement relisait la base et vidait les champs.
  //
  // Il n'en reste qu'un, et il part maintenant avec le formulaire.
  const [bookingUrl, setBookingUrl] = React.useState(firm.bookingUrl ?? "")

  // Le même contrôle que la base et que le serveur, mais rendu tout de suite.
  // La contrainte Postgres reste le dernier rempart ; ici on évite seulement
  // au cabinet d'apprendre sa faute de frappe après un aller-retour.
  const lienInvalide = React.useMemo(() => {
    const v = bookingUrl.trim()
    return v.length > 0 && !/^https:\/\/[^\s<>"]+$/i.test(v)
  }, [bookingUrl])

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    const payload = {
      name: companyName,
      rcicNumber,
      rcicName,
      address,
      addressLine2,
      city,
      province,
      postalCode,
      country,
      phone,
      email,
      replyToEmail,
      emailSenderName,
      taxGstNumber: tpsNumber,
      taxQstNumber: tvqNumber,
      taxGstRate: Number(tpsRate) || 0,
      taxQstRate: Number(tvqRate) || 0,
      invoicePrefix,
      paymentTerms,
      logoUrl,
      bookingUrl,
    }

    // ── PLUS DE COPIE DANS LE NAVIGATEUR ───────────────────────────────
    //
    // Une copie de sept champs était rangée dans localStorage et réappliquée
    // par-dessus les données du serveur au chargement. Elle ne servait à rien
    // et masquait tout : quand l'écriture en base échouait, ces sept champs
    // « persistaient » depuis le navigateur, tandis que la ville, la province,
    // le code postal et le numéro de bureau — absents de la copie —
    // disparaissaient. D'où le symptôme : une moitié de la fiche tient,
    // l'autre s'efface.
    //
    // Il n'y a plus qu'une source : la table `firms` (§16).
    try {
      const r = await updateFirmSettings(payload)
      setIsSaving(false)

      if (!r.ok) {
        // §10 : ne JAMAIS faire croire à un enregistrement qui n'a pas eu
        // lieu. Le message du serveur est repris tel quel — il nomme la cause.
        setErreur(r.message)
        setTimeout(() => setErreur(null), 12000)
        return
      }

      setNotice("Paramètres du cabinet enregistrés avec succès.")
      setTimeout(() => setNotice(null), 5000)
      // Le rafraîchissement relit la base : c'est LUI qui prouve que
      // l'enregistrement a eu lieu, et non les champs restés remplis.
      router.refresh()
    } catch (err) {
      setIsSaving(false)
      setErreur(
        `Impossible d'enregistrer les paramètres : ${
          err instanceof Error ? err.message : "erreur inattendue"
        }`
      )
      setTimeout(() => setErreur(null), 12000)
    }
  }

  // Détection si l'URL saisie pointe vers un dossier au lieu d'un fichier image
  const isDirectoryUrl = React.useMemo(() => {
    const trimmed = logoUrl.trim()
    if (!trimmed) return false
    return trimmed.endsWith("/") || /\/public_html\/[^\.\/]+\/?$/i.test(trimmed)
  }, [logoUrl])


  return (
    <div className="flex flex-col gap-8 pb-16">
      
      {/* §10 — L'ÉCHEC SE VOIT, ET DIT POURQUOI.
          Il n'y avait aucun bandeau d'erreur : l'exception était écrite dans
          la console du navigateur, puis « enregistré avec succès » s'affichait
          quand même. */}
      {erreur && (
        <div
          role="alert"
          className="bg-error/10 border border-error/40 text-error-strong rounded-3xl p-4 flex items-start gap-3 shadow-md animate-fadeIn"
        >
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-xs sm:text-sm">Les paramètres n&apos;ont PAS été enregistrés.</p>
            <p className="text-xs mt-0.5">{erreur}</p>
          </div>
        </div>
      )}

      {/* NOTICE BANNER */}
      {notice && (
        <div className="bg-success/10 border border-success/30 text-success-strong rounded-3xl p-4 flex items-center justify-between shadow-md animate-fadeIn">
          <div className="flex items-center gap-3 font-bold text-xs sm:text-sm">
            <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
            <span>{notice}</span>
          </div>
        </div>
      )}

      <PageHeader
        title="Paramètres Cabinet & Intégrations"
        subtitle="Identité du cabinet, numéros de taxe, encaissement par carte et prise de rendez-vous."
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
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-foreground hover:bg-foreground/90 border border-border px-4 py-2.5 text-xs font-bold text-background shadow-sm transition-all cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-background/70" />
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

      {/* HEADER & ONGLETS DE NAVIGATION DE PARAMÈTRES */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-card p-4 rounded-3xl border border-border shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-1 bg-muted p-1 rounded-2xl w-full sm:w-auto overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("cabinet")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === "cabinet" ? "bg-card text-primary-strong shadow-xs" : "text-foreground/75 hover:text-foreground"
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Identité Cabinet & CICC</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("taxes")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === "taxes" ? "bg-card text-primary-strong shadow-xs" : "text-foreground/75 hover:text-foreground"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Taxes & Fidéicommis</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("stripe")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === "stripe" ? "bg-card text-primary-strong shadow-xs" : "text-foreground/75 hover:text-foreground"
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Stripe Connect (Paiements)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("zoom")}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === "zoom" ? "bg-card text-primary-strong shadow-xs" : "text-foreground/75 hover:text-foreground"
            }`}
          >
            <Video className="w-4 h-4" />
            <span>Zoom & Google Calendar</span>
          </button>
        </div>
      </div>

      {/* CONTENU DE L'ONGLET SÉLECTIONNÉ */}
      <form onSubmit={handleSaveSettings} className="bg-card rounded-3xl border border-border shadow-[0_4px_20px_rgba(0,0,0,0.02)] p-6 sm:p-8 flex flex-col gap-6">
        
        {/* TAB 1: IDENTITÉ CABINET */}
        {activeTab === "cabinet" && (
          <div className="flex flex-col gap-5 animate-fadeIn">
            <div className="border-b border-border pb-3">
              <h3 className="text-lg font-black text-foreground">Coordonnées Officielle du Cabinet CRIC</h3>
              <p className="text-xs text-muted-foreground font-medium">Ces informations apparaîtront sur vos factures, mandats CICC et portail client.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">Raison Sociale / Nom du Cabinet</label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs font-medium rounded-2xl bg-muted/40 border border-border focus:bg-card focus:border-primary focus:outline-none transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">Nom du Consultant Principal (RCIC)</label>
                <input
                  type="text"
                  required
                  value={rcicName}
                  onChange={(e) => setRcicName(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs font-medium rounded-2xl bg-muted/40 border border-border focus:bg-card focus:border-primary focus:outline-none transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">N° de Permis / Licence CICC</label>
                <input
                  type="text"
                  required
                  value={rcicNumber}
                  onChange={(e) => setRcicNumber(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs font-medium rounded-2xl bg-muted/40 border border-border focus:bg-card focus:border-primary focus:outline-none transition-all font-mono"
                />
              </div>

              {/* ---------------------------------------------------------
                  L'ADRESSE PROFESSIONNELLE
                  Elle s'imprime sur les contrats, les factures et les reçus.
                  C'est la SEULE source : le consultant ne la retape nulle part
                  ailleurs, et la corriger ici vaut pour tous les documents à
                  venir — jamais pour ceux déjà signés.
                  --------------------------------------------------------- */}
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">Numéro et rue</label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="88 rue Dollard-des-Ormeaux"
                  className={CHAMP_PARAM}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">Appartement, bureau, unité</label>
                <input
                  type="text"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                  placeholder="Bureau 801"
                  className={CHAMP_PARAM}
                />
                <span className="text-[11px] text-muted-foreground">Facultatif. Laissé vide, il ne s&apos;imprime pas.</span>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">Ville</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Gatineau"
                  className={CHAMP_PARAM}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">Province ou territoire</label>
                {/* Une LISTE et non un champ libre : « QC », « Qc », « Québec »
                    et « Quebec » désignent la même province, et c'est ce texte
                    exact qui s'imprime sur le contrat. */}
                <select
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  className={CHAMP_PARAM}
                >
                  <option value="">Choisir…</option>
                  {PROVINCES.map((p) => (
                    <option key={p.valeur} value={p.valeur}>{p.fr}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">Code postal</label>
                <input
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="J8X 0B9"
                  className={`${CHAMP_PARAM} font-mono uppercase`}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">Pays</label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className={CHAMP_PARAM}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">Courriel Professionnel Officiel</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs font-medium rounded-2xl bg-muted/40 border border-border focus:bg-card focus:border-primary focus:outline-none transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">Téléphone de Contact</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs font-medium rounded-2xl bg-muted/40 border border-border focus:bg-card focus:border-primary focus:outline-none transition-all"
                />
              </div>

              {/* ---------------------------------------------------------
                  L'IDENTITÉ DES COURRIELS ENVOYÉS AUX CLIENTS
                  --------------------------------------------------------- */}
              <div className="flex flex-col gap-3 sm:col-span-2 border-t border-border pt-4">
                <div>
                  <h3 className="text-xs font-extrabold text-foreground uppercase tracking-wider">
                    Courriels envoyés à vos clients
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                    Ce que voit le destinataire d&apos;un questionnaire, d&apos;un rappel ou d&apos;une
                    invitation au portail.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">
                      Nom affiché
                    </label>
                    <input
                      type="text"
                      value={emailSenderName}
                      onChange={(e) => setEmailSenderName(e.target.value)}
                      placeholder={companyName}
                      className="placeholder:text-foreground/60 w-full px-4 py-2.5 text-xs font-medium rounded-2xl bg-muted/40 border border-border focus:bg-card focus:border-primary focus:outline-none transition-all"
                    />
                    <span className="text-[11px] text-muted-foreground">
                      Vide : votre raison sociale, « {companyName || "—"} ».
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">
                      Adresse de réponse
                    </label>
                    <input
                      type="email"
                      value={replyToEmail}
                      onChange={(e) => setReplyToEmail(e.target.value)}
                      placeholder={email || "vous@votrecabinet.ca"}
                      className="placeholder:text-foreground/60 w-full px-4 py-2.5 text-xs font-medium rounded-2xl bg-muted/40 border border-border focus:bg-card focus:border-primary focus:outline-none transition-all"
                    />
                    <span className="text-[11px] text-muted-foreground">
                      Vide : votre courriel professionnel ci-dessus.
                    </span>
                  </div>
                </div>

                {/* Ce que le destinataire verra, avec les valeurs saisies —
                    montré plutôt que décrit : la cascade « nom affiché, sinon
                    raison sociale » se comprend d'un coup d'œil, là où une
                    phrase l'aurait fait deviner. */}
                <div className="rounded-2xl border border-border bg-muted/40 p-3">
                  <span className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">
                    Aperçu dans la boîte de réception
                  </span>
                  <p className="text-xs font-bold text-foreground mt-1">
                    {emailSenderName || companyName || "Votre cabinet"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Répondre à : {replyToEmail || email || "—"}
                  </p>
                </div>

                <p className="text-[11px] text-warning-strong leading-relaxed rounded-2xl border border-warning/40 bg-warning/10 p-3">
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
              <div className="flex flex-col gap-3 sm:col-span-2 border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">
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
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-primary-strong bg-primary/10 border border-primary/30 hover:bg-primary/20 rounded-xl transition-all cursor-pointer"
                  >
                    <FileImage className="w-3.5 h-3.5" />
                    <span>Choisir une image sur mon ordinateur</span>
                  </button>
                </div>

                <div className="flex flex-col md:flex-row items-start gap-4 bg-muted/40 p-4 rounded-2xl border border-border">
                  <div className="w-20 h-20 rounded-2xl border border-border bg-card flex items-center justify-center overflow-hidden shrink-0 shadow-xs relative">
                    {logoUrl && !imgError ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img 
                        src={logoUrl} 
                        alt="Logo Cabinet" 
                        onError={() => setImgError(true)}
                        className="w-full h-full object-contain p-1" 
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-muted-foreground p-1 text-center">
                        <span className="font-black text-2xl text-foreground font-mono">M</span>
                        <span className="text-[9px] text-muted-foreground font-medium">Aperçu Logo</span>
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
                        className={`placeholder:text-foreground/60 w-full px-3.5 py-2 text-xs font-mono font-medium rounded-xl border bg-card focus:outline-none transition-colors ${
                          isDirectoryUrl || imgError
                            ? "border-warning focus:border-warning bg-warning/5"
                            : "border-border focus:border-primary"
                        }`}
                      />
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-medium">
                      <Upload className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span>Ce logo sera imprimé en en-tête de toutes vos ententes de services, factures et reçus fidéicommis.</span>
                    </div>

                    {/* ALERTE DIAGNOSTIC SI L'URL POINTE VERS UN DOSSIER OU EST IMPOSSIBLE À CHARGER */}
                    {(isDirectoryUrl || imgError) && (
                      <div className="mt-1 p-3 bg-warning/10 border border-warning/40 rounded-xl text-warning-strong text-xs flex flex-col gap-1.5 animate-fadeIn">
                        <div className="flex items-center gap-2 font-bold text-warning-strong">
                          <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
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
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-primary-strong underline hover:text-primary-strong cursor-pointer"
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
            <div className="border-b border-border pb-3">
              <h3 className="text-lg font-black text-foreground">Matrice Fiscale & Numéros de Taxes Canadiennes</h3>
              <p className="text-xs text-muted-foreground font-medium">Vos numéros d&apos;inscription, vos taux et vos conditions — imprimés sur chaque facture et chaque reçu.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">N° de TPS / TVH (Canada Revenue Agency)</label>
                <input
                  type="text"
                  required
                  value={tpsNumber}
                  onChange={(e) => setTpsNumber(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs font-medium rounded-2xl bg-muted/40 border border-border focus:bg-card focus:border-primary focus:outline-none transition-all font-mono"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">N° de TVQ (Revenu Québec)</label>
                <input
                  type="text"
                  required
                  value={tvqNumber}
                  onChange={(e) => setTvqNumber(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs font-medium rounded-2xl bg-muted/40 border border-border focus:bg-card focus:border-primary focus:outline-none transition-all font-mono"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">Taux de TPS / TVH (%)</label>
                <input
                  type="number" step="0.001" min="0" max="100"
                  value={tpsRate}
                  onChange={(e) => setTpsRate(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs font-medium rounded-2xl bg-muted/40 border border-border focus:bg-card focus:border-primary focus:outline-none transition-all font-mono"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">Taux de TVQ (%)</label>
                <input
                  type="number" step="0.001" min="0" max="100"
                  value={tvqRate}
                  onChange={(e) => setTvqRate(e.target.value)}
                  className="w-full px-4 py-2.5 text-xs font-medium rounded-2xl bg-muted/40 border border-border focus:bg-card focus:border-primary focus:outline-none transition-all font-mono"
                />
              </div>

              <div className="sm:col-span-2 rounded-2xl border border-warning/40 bg-warning/10 p-3">
                <p className="text-[11px] text-warning-strong leading-relaxed">
                  <strong>Changer un taux recalcule les factures non réglées.</strong> Celles qui ont
                  reçu ne serait-ce qu&apos;un acompte ne bougent pas : le prix a été accepté, il ne se
                  renégocie pas. Une facture déjà payée reste telle que votre client l&apos;a reçue.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">Préfixe des numéros de facture</label>
                <input
                  type="text" maxLength={8}
                  value={invoicePrefix}
                  onChange={(e) => setInvoicePrefix(e.target.value.toUpperCase())}
                  placeholder="FAC"
                  className="placeholder:text-foreground/60 w-full px-4 py-2.5 text-xs font-medium rounded-2xl bg-muted/40 border border-border focus:bg-card focus:border-primary focus:outline-none transition-all font-mono"
                />
                <span className="text-[11px] text-muted-foreground">
                  Vos factures seront numérotées {invoicePrefix || "FAC"}-{new Date().getFullYear()}-000001.
                  Les factures déjà émises gardent leur numéro.
                </span>
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">Conditions de paiement</label>
                <textarea
                  rows={3}
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  placeholder="Paiement dû sous 30 jours. Virement Interac accepté à infos@…"
                  className="placeholder:text-foreground/60 w-full px-4 py-2.5 text-xs font-medium rounded-2xl bg-muted/40 border border-border focus:bg-card focus:border-primary focus:outline-none transition-all resize-y"
                />
                <span className="text-[11px] text-muted-foreground">Imprimées au bas de chaque facture et de chaque reçu.</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: STRIPE CONNECT */}
        {activeTab === "stripe" && (
          <div className="flex flex-col gap-5 animate-fadeIn">
            <div className="border-b border-border pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-foreground">Intégration Stripe Connect (Paiements Fidéicommis & Général)</h3>
                <p className="text-xs text-muted-foreground font-medium">Encaissez les honoraires par carte de crédit sans gérer les données bancaires (Conforme PCI-DSS).</p>
              </div>
              {stripeConnected ? (
                <span className="inline-flex items-center gap-1 bg-success/15 text-success-strong border border-success/40 font-mono text-xs font-bold px-3 py-1 rounded-full">
                  <Check className="w-3.5 h-3.5" /> Connecté à Stripe
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 bg-muted text-muted-foreground border border-border font-mono text-xs font-bold px-3 py-1 rounded-full">
                  <AlertTriangle className="w-3.5 h-3.5" /> Non configuré
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4">
              {stripeConnected ? (
                <div className="bg-muted/40 p-4 rounded-2xl border border-border flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">Identifiant de Compte Stripe Connect :</span>
                    <span className="font-mono text-xs font-black text-foreground">{stripeAccountId}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-border pt-2">
                    <span className="text-xs font-bold text-foreground">Clé Publique (Publishable Key) :</span>
                    <span className="font-mono text-xs text-muted-foreground">{publishableKey}</span>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-6 flex flex-col items-center justify-center text-center gap-2">
                  <CreditCard className="w-8 h-8 text-muted-foreground" />
                  <p className="text-xs font-bold text-foreground">Aucun compte Stripe Connect rattaché</p>
                  <p className="text-[11px] text-muted-foreground max-w-md">
                    L&apos;encaissement direct par carte de crédit sera activé après la liaison de votre compte Stripe Connect. Les encaissements enregistrés manuellement demeurent pleinement opérationnels.
                  </p>
                </div>
              )}

              <div className="bg-primary/10 border border-primary/30 text-primary-strong p-4 rounded-2xl text-xs font-medium leading-relaxed flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span>
                  <strong>Fidéicommis :</strong> les encaissements par carte ne sont pas encore
                  rattachés au compte en fidéicommis. Les acomptes reçus se saisissent depuis
                  l&apos;écran Fidéicommis, qui tient le registre et le rapprochement.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: CALENDLY & VISIOCONFÉRENCE */}
        {activeTab === "zoom" && (
          <div className="flex flex-col gap-5 animate-fadeIn">
            <div className="border-b border-border pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-foreground">Prise de rendez-vous en ligne</h3>
                <p className="text-xs text-muted-foreground font-medium">
                  Votre lien de réservation Calendly, TidyCal ou Cal.com, offert à vos clients depuis leur portail.
                </p>
              </div>
              {/* La pastille suit la BASE, non la frappe en cours : elle
                  annonçait « configuré » sur un état React que le
                  rechargement effaçait. */}
              {(firm.bookingUrl ?? "").trim() ? (
                <span className="inline-flex items-center gap-1 bg-success/15 text-success-strong border border-success/40 font-mono text-xs font-bold px-3 py-1 rounded-full">
                  <Check className="w-3.5 h-3.5" /> Lien enregistré
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 bg-muted text-muted-foreground border border-border font-mono text-xs font-bold px-3 py-1 rounded-full">
                  <AlertTriangle className="w-3.5 h-3.5" /> Aucun lien
                </span>
              )}
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="lien-reservation" className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider">
                  Votre lien de réservation
                </label>
                <div className="relative flex items-center">
                  <Globe aria-hidden className="absolute left-3 w-4 h-4 text-muted-foreground" />
                  <input
                    id="lien-reservation"
                    type="url"
                    inputMode="url"
                    placeholder="https://calendly.com/votre-nom/consultation"
                    value={bookingUrl}
                    onChange={(e) => setBookingUrl(e.target.value)}
                    aria-invalid={lienInvalide || undefined}
                    aria-describedby="lien-reservation-aide"
                    className={`placeholder:text-foreground/60 w-full pl-9 pr-4 py-2.5 text-xs font-bold font-mono rounded-2xl bg-muted/40 border focus:bg-card focus:outline-none transition-all ${
                      lienInvalide ? "border-danger focus:border-danger" : "border-border focus:border-primary"
                    }`}
                  />
                </div>
                <p id="lien-reservation-aide" className={`text-[11px] ${lienInvalide ? "text-danger-strong font-bold" : "text-muted-foreground"}`}>
                  {lienInvalide
                    ? "L'adresse doit être complète et commencer par https://"
                    : "Vos clients le verront sur leur portail. Laissez vide pour ne rien proposer."}
                </p>
              </div>

              {(firm.bookingUrl ?? "").trim() ? (
                <a
                  href={firm.bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-fit items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2.5 text-xs font-bold text-foreground transition-colors hover:bg-muted"
                >
                  <Globe aria-hidden className="w-3.5 h-3.5 text-muted-foreground" />
                  Ouvrir la page que verront vos clients
                </a>
              ) : null}

              <RaccordCalendly etat={calendly} />

              {/* Ce qui existe, dit sans promettre ce qui n'existe pas. Il n'y
                  a ni intégration Zoom, ni Google Meet, ni synchronisation :
                  l'écran l'annonçait, et ces trois contrôles ne menaient
                  nulle part. */}
              <div className="bg-muted/40 border border-border text-muted-foreground p-4 rounded-2xl text-xs leading-relaxed flex items-start gap-2.5">
                <Video aria-hidden className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Le rendez-vous se prend et se tient chez votre fournisseur — c&apos;est lui qui
                  envoie les invitations et crée le lien de visioconférence. Le cabinet ne conserve
                  que l&apos;adresse de réservation, pour l&apos;offrir à vos clients.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Save button */}
        <div className="flex items-center justify-end pt-4 border-t border-border">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground px-6 py-3 text-xs font-bold shadow-md transition-all cursor-pointer"
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
