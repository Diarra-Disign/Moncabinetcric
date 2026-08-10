"use client"

import * as React from "react"
import { 
  ChevronRight, 
  Check, 
  Plus, 
  Minus, 
  Folder, 
  FileText, 
  CheckCircle2, 
  ShieldCheck, 
  Clock, 
  ArrowUpRight, 
  Lock, 
  TrendingUp,
  AlertCircle,
  FileCheck2,
  Users,
  Search,
  SlidersHorizontal,
  Bell,
  Award
} from "lucide-react"
import { Link } from "@/i18n/routing"
import { useTranslations } from "next-intl"

interface LandingClientProps {
  t: {
    nav: Record<string, string>
    hero: Record<string, string>
    stats: Record<string, string>
    features: Record<string, string>
    pricing: {
      badge: string
      title: string
      subtitle: string
      period: string
      taxNote: string
      includedLabel: string
      plusProLabel: string
      plusBusinessLabel: string
      plusEnterpriseLabel: string
      // Une clé par forfait, portant son nom. « basic » et « business »
      // désignaient Solo et Cabinet Pro : le vrai forfait Business n'aurait pas
      // pu s'ajouter sans ambiguïté.
      solo: Record<string, string>
      cabinet: Record<string, string>
      business: Record<string, string>
      enterprise: Record<string, string>
    }
    finalCta: {
      title: string
      subtitle: string
      ctaPrimary: string
      ctaSecondary: string
    }
    faq: {
      badge: string
      title: string
      q1: string
      a1: string
      q2: string
      a2: string
      q3: string
      a3: string
      q4: string
      a4: string
    }
  }
}

export function LandingClient({ t }: LandingClientProps) {
  // Les libellés légaux réutilisent les titres du catalogue juridique
  // plutôt que d'introduire des clés en double.
  const tLegal = useTranslations("Legal")
  const [openFaq, setOpenFaq] = React.useState<number | null>(0)
  const [activeTab, setActiveTab] = React.useState<"all" | "expiring" | "audit">("all")

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index)
  }

  // Dynamic Case Mockup Data based on selected Tab
  const mockupCases = React.useMemo(() => {
    switch (activeTab) {
      case "expiring":
        return [
          {
            tag: "PT",
            tagBg: "bg-amber-100 text-amber-800",
            title: "Permis Travail - LMIA",
            client: "Client — Entrée express",
            badge: "J-18 Échéance",
            badgeBg: "bg-amber-100 text-amber-800",
            icon: Clock,
            sub: "Alerte SMS automatique envoyée",
            date: "17 Aoû 2026",
            dateColor: "text-amber-700 font-bold"
          },
          {
            tag: "VT",
            tagBg: "bg-rose-100 text-rose-800",
            title: "Visa Travailleur Temporaire",
            client: "Client: O. Camara",
            badge: "Urgent J-5",
            badgeBg: "bg-rose-100 text-rose-800 animate-pulse",
            icon: AlertCircle,
            sub: "Passeport expire avant renouvellement",
            date: "05 Aoû 2026",
            dateColor: "text-rose-700 font-bold"
          },
          {
            tag: "PE",
            tagBg: "bg-amber-100 text-amber-800",
            title: "CAQ & Permis d'Études",
            client: "Client: L. Zhang",
            badge: "J-12 Échéance",
            badgeBg: "bg-amber-100 text-amber-800",
            icon: Clock,
            sub: "Relance justificatifs bancaires",
            date: "11 Aoû 2026",
            dateColor: "text-amber-700 font-bold"
          }
        ]
      case "audit":
        return [
          {
            tag: "EE",
            tagBg: "bg-emerald-50 text-emerald-700",
            title: "Express Entry - PR Status",
            client: "Client — Parrainage",
            badge: "100% Conforme",
            badgeBg: "bg-emerald-100 text-emerald-800",
            icon: CheckCircle2,
            sub: "4 / 4 pièces vérifiées et horodatées",
            date: "Audit Validé",
            dateColor: "text-emerald-700 font-bold"
          },
          {
            tag: "RP",
            tagBg: "bg-emerald-50 text-emerald-700",
            title: "Résidence Permanente (PEQ)",
            client: "Client: M. Dubois",
            badge: "Journal CICC OK",
            badgeBg: "bg-emerald-100 text-emerald-800",
            icon: ShieldCheck,
            sub: "Attestation MIFI & CSQ archivés",
            date: "Audit Validé",
            dateColor: "text-emerald-700 font-bold"
          },
          {
            tag: "CIT",
            tagBg: "bg-purple-50 text-purple-700",
            title: "Demande de Citoyenneté",
            client: "Client: A. Ndiaye",
            badge: "Prêt IRCC",
            badgeBg: "bg-emerald-100 text-emerald-800",
            icon: CheckCircle2,
            sub: "Contrat & Facture exonérée TPS/TVQ",
            date: "Audit Validé",
            dateColor: "text-emerald-700 font-bold"
          }
        ]
      default:
        return [
          {
            tag: "IR",
            tagBg: "bg-blue-50 text-blue-600",
            title: "Dossier #4821 - Express Entry",
            client: "Client — Parrainage",
            badge: "Valide",
            badgeBg: "bg-emerald-100 text-emerald-800",
            icon: CheckCircle2,
            sub: "4 / 4 pièces vérifiées",
            date: "Expire: 14 Oct 2027",
            dateColor: "text-slate-700"
          },
          {
            tag: "PT",
            tagBg: "bg-amber-100 text-amber-700",
            title: "Permis Travail - LMIA",
            client: "Client — Entrée express",
            badge: "J-18",
            badgeBg: "bg-amber-100 text-amber-800",
            icon: Clock,
            sub: "Alerte SMS automatique envoyée",
            date: "17 Aoû 2026",
            dateColor: "text-amber-700 font-bold"
          },
          {
            tag: "PE",
            tagBg: "bg-purple-50 text-purple-600",
            title: "Permis Études - UdeM",
            client: "Client: M. Dubois",
            badge: "Valide",
            badgeBg: "bg-emerald-100 text-emerald-800",
            icon: CheckCircle2,
            sub: "CAQ + IMM5709 conformes",
            date: "Expire: 01 Sep 2028",
            dateColor: "text-slate-700"
          }
        ]
    }
  }, [activeTab])

  return (
    <div className="flex flex-col items-center w-full min-h-screen selection:bg-blue-600 selection:text-white">
      
      {/* 1. HERO SECTION (ULTRA-PREMIUM BLUE PILL CONTAINER) */}
      <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-16">
        <div className="bg-gradient-to-b from-[#2563eb] via-[#1d4ed8] to-[#1e40af] rounded-[36px] sm:rounded-[48px] overflow-hidden relative shadow-[0_25px_60px_-15px_rgba(37,99,235,0.45)] border border-white/10">
          
          {/* Ambient Light Gradients inside Hero */}
          <div className="pointer-events-none absolute -top-40 -left-40 w-96 h-96 rounded-full bg-blue-300/20 blur-3xl animate-pulse-glow" />
          <div className="pointer-events-none absolute top-20 -right-40 w-96 h-96 rounded-full bg-indigo-300/25 blur-3xl animate-pulse-glow" />

          {/* Navigation Bar */}
          <nav className="relative z-30 flex items-center justify-between px-6 sm:px-10 py-6">
            <div className="flex items-center gap-3 text-white font-black text-2xl tracking-tight">
              <div className="h-10 w-10 rounded-xl bg-white text-[#2563eb] flex items-center justify-center font-extrabold shadow-md transform -rotate-3 hover:rotate-0 transition-transform duration-300">
                M
              </div>
              <span className="tracking-tighter">moncabinetcric</span>
            </div>

            <div className="hidden lg:flex items-center gap-8 text-white/85 text-sm font-semibold">
              <a href="#features" className="hover:text-white transition-colors duration-200">{t.nav.features}</a>
              <a href="#features" className="hover:text-white transition-colors duration-200">{t.nav.solution}</a>
              <a href="#features" className="hover:text-white transition-colors duration-200">{t.nav.testimonials}</a>
              <a href="#faq" className="hover:text-white transition-colors duration-200">{t.nav.faq}</a>
            </div>

            <div className="flex items-center gap-3">
              <Link 
                href="/connexion" 
                className="hidden sm:inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 text-xs sm:text-sm font-semibold backdrop-blur-md transition-all duration-200 hover:border-white/40"
              >
                {t.nav.login}
              </Link>
              <Link
                href="/demo"
                className="inline-flex items-center justify-center rounded-full bg-white text-[#1e40af] px-5 sm:px-6 py-2.5 text-xs sm:text-sm font-bold shadow-lg hover:bg-slate-100 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
              >
                {t.nav.bookDemo}
              </Link>
            </div>
          </nav>

          {/* Hero Content */}
          {/* La réserve de place sous le contenu ne dépend plus d'un padding
              deviné : la maquette est dans le flux, et c'est elle qui pousse
              ce qui la précède. Voir le commentaire du bloc plus bas. */}
          <div className="relative z-20 flex flex-col items-center text-center px-4 sm:px-6 pt-8 sm:pt-12 pb-12 sm:pb-16 max-w-4xl mx-auto">
            
            {/* Pill Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 backdrop-blur-md px-4 py-1.5 text-xs sm:text-sm font-bold text-white mb-6 shadow-sm">
              <span>{t.hero.badge}</span>
            </div>

            {/* Title & Subtitle */}
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight leading-[1.08] mb-6">
              {t.hero.title}
            </h1>
            <p className="text-base sm:text-xl text-white/80 font-normal leading-relaxed max-w-2xl mb-8">
              {t.hero.subtitle}
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto mb-10">
              <Link
                href="/demo"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 text-white px-8 py-4 text-sm sm:text-base font-bold shadow-2xl hover:bg-black hover:scale-[1.02] transition-all duration-200 group"
              >
                <span>{t.hero.ctaPrimary}</span>
                <ArrowUpRight className="h-4 w-4 text-blue-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </Link>
              <Link 
                href="/portal" 
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 hover:bg-white/20 text-white px-8 py-4 text-sm sm:text-base font-semibold backdrop-blur-md transition-all duration-200"
              >
                <span>{t.hero.ctaSecondary}</span>
                <ChevronRight className="h-4 w-4 opacity-75" />
              </Link>
            </div>

            {/* Ce bandeau montrait quatre avatars dont un « +150 », cinq
                étoiles pleines, « 4.9/5 » et « Adopté par les consultants
                agréés CICC au Canada ». Aucun cabinet n'est abonné à ce
                jour : c'était une note et une clientèle inventées sur la
                page publique d'un professionnel réglementé. Rien ne le
                remplace — une preuve sociale s'affiche quand elle existe. */}

          </div>

          {/* MAQUETTE D'APERÇU DE L'APPLICATION
              Elle était en position absolue, ancrée en bas et descendue de
              80 px, tandis que le contenu au-dessus réservait sa place avec
              un padding fixe. Les deux valeurs ne se parlaient pas : la
              carte, haute de 450 px, remontait 186 px plus haut que la
              réserve et recouvrait le bas du héros — mesuré à 1440 px,
              elementFromPoint renvoyait la maquette là où le texte était
              censé être.

              Elle est maintenant dans le flux : sa hauteur pousse d'elle-même
              ce qui la précède, à toute largeur. La marge négative ne sert
              plus qu'à la faire déborder sous le panneau bleu, où le
              overflow-hidden du héros la coupe — l'effet recherché. */}
          <div className="relative z-20 w-full max-w-5xl mx-auto px-4 -mb-20 sm:-mb-24">
            <div className="bg-white/95 backdrop-blur-2xl rounded-t-[28px] shadow-[0_-20px_50px_rgba(0,0,0,0.25)] border border-white/60 p-3 sm:p-5 h-[450px] sm:h-[490px] overflow-hidden flex flex-col gap-4 relative">
              
              {/* Fake OS Header */}
              <div className="flex items-center justify-between px-2 pb-2 border-b border-slate-100">
                <div className="flex gap-2 items-center">
                  <div className="w-3 h-3 rounded-full bg-rose-400" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400" />
                </div>
                <div className="flex items-center gap-2 bg-slate-100/80 px-4 py-1.5 rounded-full text-xs font-mono text-slate-500 font-medium">
                  <Lock className="h-3 w-3 text-emerald-600" />
                  <span>moncabinetcric-app.ca/dossiers</span>
                </div>
                {/* La maquette affichait « Me. A. Diarra ». Me est réservé
                    aux avocats et aux notaires : un consultant réglementé
                    qui le porte laisse croire à un titre qu'il n'a pas, et
                    la page publique est précisément l'endroit où cela se
                    lit comme une qualification. La désignation du CICC est
                    CRIC en français, RCIC en anglais, et elle suit le nom. */}
                <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                  <span className="hidden sm:inline">Connecté en tant que:</span>
                  <span className="font-bold text-slate-700">A. Diarra, CRIC</span>
                </div>
              </div>

              {/* Fake Application Dashboard Content */}
              <div className="flex-1 bg-slate-50/70 rounded-2xl border border-slate-200/70 flex flex-col p-4 sm:p-6 gap-5 overflow-hidden">
                
                {/* Header of UI */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-xl text-slate-900">Suivi Réglementaire CICC</h3>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                        <CheckCircle2 className="w-3 h-3" /> Conformité 99.8%
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">Mis à jour instantanément · Journal d&apos;audit horodaté actif</p>
                  </div>

                  {/* Filter Tabs inside Mockup */}
                  <div role="tablist" aria-label="Filtres des dossiers" className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-xs self-start">
                    <button 
                      type="button"
                      role="tab"
                      aria-selected={activeTab === "all"}
                      onClick={() => setActiveTab("all")} 
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${activeTab === "all" ? "bg-blue-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"}`}
                    >
                      Tous les dossiers (48)
                    </button>
                    <button 
                      type="button"
                      role="tab"
                      aria-selected={activeTab === "expiring"}
                      onClick={() => setActiveTab("expiring")} 
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${activeTab === "expiring" ? "bg-amber-500 text-white shadow-xs" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"}`}
                    >
                      Visas à échéance (3)
                    </button>
                    <button 
                      type="button"
                      role="tab"
                      aria-selected={activeTab === "audit"}
                      onClick={() => setActiveTab("audit")} 
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer ${activeTab === "audit" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"}`}
                    >
                      Audits Prêts (45)
                    </button>
                  </div>
                </div>

                {/* DYNAMIC GRID OF CARDS INSIDE MOCKUP */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-fadeIn">
                  {mockupCases.map((item, idx) => {
                    const IconComp = item.icon
                    return (
                      <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between gap-3 hover:border-blue-300 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${item.tagBg}`}>
                              {item.tag}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-900">{item.title}</div>
                              <div className="text-[11px] text-slate-400">{item.client}</div>
                            </div>
                          </div>
                          <span className={`rounded-full text-[10px] font-bold px-2 py-0.5 flex items-center gap-1 ${item.badgeBg}`}>
                            <IconComp className="w-2.5 h-2.5" /> {item.badge}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                          <span>{item.sub}</span>
                          <span className={`font-mono text-xs ${item.dateColor}`}>{item.date}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Simulated Document & Storage Breakdown Bar */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                      <FileCheck2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">Protection au Journal d&apos;Audit CICC</div>
                      <div className="text-[11px] text-slate-500">Horodatage cryptographique infalsifiable actif</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-semibold text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>421 Validés</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <span>12 En révision</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      <span>0 Expiré</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Bottom Fade overlay */}
              <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none" />
            </div>
          </div>

        </div>
      </section>

      {/* L'espaceur de 176 à 256 px qui suivait compensait une maquette
          flottante qui, elle, était déjà coupée par le héros. Il ne
          réservait donc de la place pour rien, et creusait le vide qu'on
          voyait entre le héros et les chiffres. */}

      {/* 2. STATS / TRUST SECTION */}
      <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="text-4xl sm:text-5xl font-black text-blue-600 tracking-tight mb-2">
              {t.stats.stat1Value}
            </div>
            <p className="text-sm font-semibold text-slate-600">
              {t.stats.stat1Label}
            </p>
          </div>
          <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight mb-2">
              {t.stats.stat2Value}
            </div>
            <p className="text-sm font-semibold text-slate-600">
              {t.stats.stat2Label}
            </p>
          </div>
          <div className="bg-white rounded-3xl p-8 border border-slate-200/80 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="text-4xl sm:text-5xl font-black text-emerald-600 tracking-tight mb-2">
              {t.stats.stat3Value}
            </div>
            <p className="text-sm font-semibold text-slate-600">
              {t.stats.stat3Label}
            </p>
          </div>
        </div>
      </section>

      {/* 3. BENTO GRID FEATURES (AXE 3: ENRICHISSEMENT GLOW) */}
      <section id="features" className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        
        {/* Section Header */}
        <div className="flex flex-col items-center text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-black tracking-widest uppercase text-blue-600 bg-blue-50 px-3.5 py-1.5 rounded-full mb-4">
            {t.features.sectionBadge}
          </span>
          <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight mb-6">
            {t.features.sectionTitle}
          </h2>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            {t.features.sectionSubtitle}
          </p>
        </div>

        {/* 2x2 Elevated Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Card 1 */}
          <div className="group bg-white rounded-[36px] p-8 sm:p-10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-200/80 hover:border-blue-500/50 hover:shadow-xl transition-all duration-300 flex flex-col justify-between gap-8">
            <div className="h-48 bg-slate-50 rounded-2xl p-6 flex flex-col justify-center items-center relative overflow-hidden border border-slate-100">
              <div className="bg-white rounded-2xl p-4 shadow-md border border-slate-200/80 w-full max-w-xs flex flex-col gap-3 group-hover:scale-105 transition-transform duration-300">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-slate-800">Conformité des passeports</span>
                  <span className="text-emerald-600 font-mono">100% Ok</span>
                </div>
                <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                  <div className="h-full bg-emerald-500 w-[85%]" />
                  <div className="h-full bg-amber-500 w-[15%]" />
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-100 text-[11px]">
                  <span className="text-slate-400">Audité par CICC Log</span>
                  <span className="text-slate-700 font-bold">Zéro anomalie</span>
                </div>
              </div>
              <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-blue-100/50 rounded-full blur-xl group-hover:bg-blue-200 transition-colors" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">
                {t.features.f1Title}
              </h3>
              <p className="text-slate-600 leading-relaxed text-sm sm:text-base">
                {t.features.f1Desc}
              </p>
            </div>
          </div>

          {/* Card 2 */}
          <div className="group bg-white rounded-[36px] p-8 sm:p-10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-200/80 hover:border-blue-500/50 hover:shadow-xl transition-all duration-300 flex flex-col justify-between gap-8">
            <div className="h-48 bg-slate-50 rounded-2xl p-6 flex flex-col justify-center items-center relative overflow-hidden border border-slate-100">
              <div className="bg-gradient-to-br from-[#1e40af] to-[#2563eb] rounded-2xl p-4 shadow-lg text-white w-full max-w-xs flex flex-col gap-3 group-hover:scale-105 transition-transform duration-300">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-300" />
                    <span className="text-xs font-bold">Coffre-fort client</span>
                  </div>
                  {/* Le badge annonçait « AES-256 » — dernière occurrence
                      publique d'une allégation de chiffrement que rien dans
                      le code ne soutient. L'empreinte SHA-256, elle, est
                      bien calculée sur le serveur à chaque dépôt : voir
                      lib/data/storage.ts. */}
                  <span className="text-[10px] uppercase font-mono bg-white/20 px-2 py-0.5 rounded">SHA-256</span>
                </div>
                <div className="bg-white/10 rounded-lg p-2.5 flex items-center justify-between text-xs">
                  <span>IMM5709_Signé.pdf</span>
                  <span className="text-emerald-300 font-bold flex items-center gap-1">
                    <Check className="w-3 h-3" /> Transmis
                  </span>
                </div>
              </div>
              <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-indigo-100/50 rounded-full blur-xl group-hover:bg-indigo-200 transition-colors" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">
                {t.features.f2Title}
              </h3>
              <p className="text-slate-600 leading-relaxed text-sm sm:text-base">
                {t.features.f2Desc}
              </p>
            </div>
          </div>

          {/* Card 3 */}
          <div className="group bg-white rounded-[36px] p-8 sm:p-10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-200/80 hover:border-blue-500/50 hover:shadow-xl transition-all duration-300 flex flex-col justify-between gap-8">
            <div className="h-48 bg-slate-50 rounded-2xl p-6 flex flex-col justify-center items-center relative overflow-hidden border border-slate-100">
              <div className="bg-white rounded-2xl p-4 shadow-md border border-slate-200/80 w-full max-w-xs flex flex-col gap-2 group-hover:scale-105 transition-transform duration-300">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-700">Prospect → Mandat actif</span>
                  <span className="font-bold text-blue-600">+100% fluidité</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-center">
                    <div className="text-[10px] font-bold text-blue-700">1. Entente</div>
                    <div className="text-xs font-black text-slate-900">Signée</div>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-center">
                    <div className="text-[10px] font-bold text-emerald-700">2. Taxes</div>
                    <div className="text-xs font-black text-slate-900">Exonéré</div>
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-2 text-center">
                    <div className="text-[10px] font-bold text-purple-700">3. Dossier</div>
                    <div className="text-xs font-black text-slate-900">Ouvert</div>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">
                {t.features.f3Title}
              </h3>
              <p className="text-slate-600 leading-relaxed text-sm sm:text-base">
                {t.features.f3Desc}
              </p>
            </div>
          </div>

          {/* Card 4 */}
          <div className="group bg-white rounded-[36px] p-8 sm:p-10 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-200/80 hover:border-blue-500/50 hover:shadow-xl transition-all duration-300 flex flex-col justify-between gap-8">
            <div className="h-48 bg-slate-50 rounded-2xl p-6 flex flex-col justify-center items-center relative overflow-hidden border border-slate-100">
              <div className="bg-white rounded-2xl p-4 shadow-md border border-slate-200/80 w-full max-w-xs flex flex-col gap-2.5 group-hover:scale-105 transition-transform duration-300">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-800">Calculateur Exonération</span>
                  <span className="text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">Automatique</span>
                </div>
                <div className="flex justify-between items-center text-xs bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="text-slate-500">Client International</span>
                  <span className="font-mono font-bold text-slate-900">TPS / TVQ = 0.00$</span>
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">
                {t.features.f4Title}
              </h3>
              <p className="text-slate-600 leading-relaxed text-sm sm:text-base">
                {t.features.f4Desc}
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* 4. INTERACTIVE PRICING SECTION (AXE 3 DYNAMIQUE -20%) */}
      <section id="pricing" className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 flex flex-col items-center">
        <span className="text-xs font-black tracking-widest uppercase text-blue-600 bg-blue-50 px-3.5 py-1.5 rounded-full mb-4">
          {t.pricing.badge}
        </span>
        <h2 className="text-3xl sm:text-5xl font-black text-center mb-4 text-slate-900 tracking-tight">
          {t.pricing.title}
        </h2>
        <p className="text-base sm:text-lg text-slate-600 text-center max-w-2xl mb-10">
          {t.pricing.subtitle}
        </p>
        
        {/* Le sélecteur mensuel / annuel et sa promesse « Économisez 20% »
            ont été retirés avec les montants : un basculement qui ne change
            plus aucun prix affiché est un bouton mort de plus, et le rabais
            annoncé porterait sur un tarif qui n'est pas publié. */}

        {/* 4 Pricing Cards */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 items-stretch w-full max-w-7xl">
          
          {/* Solo Card */}
          <div className="bg-white rounded-3xl p-8 shadow-xs border border-slate-200 flex flex-col justify-between hover:shadow-lg transition-shadow">
            <div>
              <h3 className="text-xl font-extrabold text-slate-900 mb-2">{t.pricing.solo.name}</h3>
              <p className="text-xs text-slate-500 mb-6 min-h-[32px]">{t.pricing.solo.desc}</p>
              {/* Le code affichait 89$ et 69$, le fichier de traduction
                  99$ et 79$ : deux tarifs publics contradictoires, dont un
                  seul était traduit. Le montant vient désormais du catalogue
                  qui sert aussi à facturer — il ne peut plus diverger. */}
              <div className="mb-8">
                <div className="text-3xl sm:text-4xl font-black text-slate-900 flex items-baseline gap-1.5">
                  {t.pricing.solo.price}
                  <span className="text-sm font-bold text-slate-400">{t.pricing.period}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{t.pricing.solo.annual}</p>
              </div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">{t.pricing.includedLabel}</div>
              <ul className="flex flex-col gap-4 text-sm font-medium text-slate-700 mb-8">
                <li className="flex items-center gap-3"><Check className="w-4 h-4 text-emerald-500 shrink-0" /> <span>{t.pricing.solo.f1}</span></li>
                <li className="flex items-center gap-3"><Check className="w-4 h-4 text-emerald-500 shrink-0" /> <span>{t.pricing.solo.f2}</span></li>
                <li className="flex items-center gap-3"><Check className="w-4 h-4 text-emerald-500 shrink-0" /> <span>{t.pricing.solo.f3}</span></li>
                <li className="flex items-center gap-3"><Check className="w-4 h-4 text-emerald-500 shrink-0" /> <span>{t.pricing.solo.f4}</span></li>
              </ul>
            </div>
            {/* Les trois boutons de cette section étaient des <button> sans
                onClick ni href : inertes, à l'endroit précis où le visiteur
                venait de décider. Ce sont des liens, et ils mènent au seul
                parcours qui existe réellement — la demande de démonstration,
                l'inscription libre étant fermée par conception. */}
            <Link
              href="/demo"
              className="w-full inline-flex items-center justify-center rounded-full border border-slate-300 py-3.5 text-sm font-bold text-slate-800 hover:bg-slate-50 transition-colors"
            >
              {t.pricing.solo.btn}
            </Link>
          </div>

          {/* Cabinet Pro Card */}
          <div className="relative bg-gradient-to-b from-[#2563eb] to-[#1e40af] text-white rounded-3xl p-8 sm:p-10 shadow-[0_20px_50px_rgba(37,99,235,0.35)] border border-blue-400/30 flex flex-col justify-between xl:-translate-y-4">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-amber-400 text-slate-950 text-[11px] font-black uppercase tracking-wider px-4 py-1 rounded-full shadow-md">
              {t.pricing.cabinet.badge || "RECOMMANDÉ"}
            </div>

            <div>
              <h3 className="text-xl font-extrabold text-white mb-2">{t.pricing.cabinet.name}</h3>
              <p className="text-xs text-white/80 mb-6 min-h-[32px]">{t.pricing.cabinet.desc}</p>
              <div className="mb-8">
                <div className="text-3xl sm:text-4xl font-black text-white flex items-baseline gap-1.5">
                  {t.pricing.cabinet.price}
                  <span className="text-sm font-bold text-white/60">{t.pricing.period}</span>
                </div>
                <p className="mt-1 text-xs text-white/70">{t.pricing.cabinet.annual}</p>
              </div>
              <div className="h-px w-full bg-white/20 mb-6" />
              <div className="text-xs font-bold uppercase tracking-wider text-white/70 mb-4">{t.pricing.plusProLabel}</div>
              <ul className="flex flex-col gap-4 text-sm font-medium text-white mb-8">
                <li className="flex items-center gap-3"><Check className="w-4 h-4 text-amber-300 shrink-0" /> <span>{t.pricing.cabinet.f1}</span></li>
                <li className="flex items-center gap-3"><Check className="w-4 h-4 text-amber-300 shrink-0" /> <span>{t.pricing.cabinet.f2}</span></li>
                <li className="flex items-center gap-3"><Check className="w-4 h-4 text-amber-300 shrink-0" /> <span>{t.pricing.cabinet.f3}</span></li>
                <li className="flex items-center gap-3"><Check className="w-4 h-4 text-amber-300 shrink-0" /> <span>{t.pricing.cabinet.f4}</span></li>
              </ul>
            </div>
            <Link
              href="/demo"
              className="w-full inline-flex items-center justify-center rounded-full bg-white text-[#1e40af] py-4 text-sm font-black shadow-xl hover:bg-slate-100 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
            >
              {t.pricing.cabinet.btn}
            </Link>
          </div>

          {/* Cabinet Business Card */}
          {/* Ses fonctions sont EXACTEMENT celles de Cabinet Pro — vérifié
              dans plan_features. L'écart est économique : huit places au lieu
              de trois, et des places moins chères. Cette carte ne promet donc
              aucune fonction supplémentaire, parce qu'il n'y en a aucune. Un
              argumentaire inventé pour équilibrer visuellement trois colonnes
              se retourne à la première question d'un client. */}
          <div className="bg-white rounded-3xl p-8 shadow-xs border border-slate-200 flex flex-col justify-between hover:shadow-lg transition-shadow">
            <div>
              <h3 className="text-xl font-extrabold text-slate-900 mb-2">{t.pricing.business.name}</h3>
              <p className="text-xs text-slate-500 mb-6 min-h-[32px]">{t.pricing.business.desc}</p>
              <div className="mb-8">
                <div className="text-3xl sm:text-4xl font-black text-slate-900 flex items-baseline gap-1.5">
                  {t.pricing.business.price}
                  <span className="text-sm font-bold text-slate-400">{t.pricing.period}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">{t.pricing.business.annual}</p>
              </div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">{t.pricing.plusBusinessLabel}</div>
              <ul className="flex flex-col gap-4 text-sm font-medium text-slate-700 mb-8">
                <li className="flex items-center gap-3"><Check className="w-4 h-4 text-emerald-500 shrink-0" /> <span>{t.pricing.business.f1}</span></li>
                <li className="flex items-center gap-3"><Check className="w-4 h-4 text-emerald-500 shrink-0" /> <span>{t.pricing.business.f2}</span></li>
                <li className="flex items-center gap-3"><Check className="w-4 h-4 text-emerald-500 shrink-0" /> <span>{t.pricing.business.f3}</span></li>
                <li className="flex items-center gap-3"><Check className="w-4 h-4 text-emerald-500 shrink-0" /> <span>{t.pricing.business.f4}</span></li>
              </ul>
            </div>
            <Link
              href="/demo"
              className="w-full inline-flex items-center justify-center rounded-full border border-slate-300 py-3.5 text-sm font-bold text-slate-800 hover:bg-slate-50 transition-colors"
            >
              {t.pricing.business.btn}
            </Link>
          </div>

          {/* Enterprise Card */}
          <div className="bg-white rounded-3xl p-8 shadow-xs border border-slate-200 flex flex-col justify-between hover:shadow-lg transition-shadow">
            <div>
              <h3 className="text-xl font-extrabold text-slate-900 mb-2">{t.pricing.enterprise.name}</h3>
              <p className="text-xs text-slate-500 mb-6 min-h-[32px]">{t.pricing.enterprise.desc}</p>
              {/* Ce libellé était écrit en dur, donc identique en anglais sur
                  une page par ailleurs entièrement traduite. */}
              <div className="text-3xl sm:text-4xl font-black text-slate-900 mb-8">
                {t.pricing.enterprise.price}
              </div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">{t.pricing.plusEnterpriseLabel}</div>
              <ul className="flex flex-col gap-4 text-sm font-medium text-slate-700 mb-8">
                <li className="flex items-center gap-3"><Check className="w-4 h-4 text-blue-600 shrink-0" /> <span>{t.pricing.enterprise.f1}</span></li>
                <li className="flex items-center gap-3"><Check className="w-4 h-4 text-blue-600 shrink-0" /> <span>{t.pricing.enterprise.f2}</span></li>
                <li className="flex items-center gap-3"><Check className="w-4 h-4 text-blue-600 shrink-0" /> <span>{t.pricing.enterprise.f3}</span></li>
                <li className="flex items-center gap-3"><Check className="w-4 h-4 text-blue-600 shrink-0" /> <span>{t.pricing.enterprise.f4}</span></li>
              </ul>
            </div>
            <Link
              href="/demo"
              className="w-full inline-flex items-center justify-center rounded-full border border-slate-300 py-3.5 text-sm font-bold text-slate-800 hover:bg-slate-50 transition-colors"
            >
              {t.pricing.enterprise.btn}
            </Link>
          </div>

        </div>

        {/* Devise et taxes annoncées avec les montants. Un prix canadien
            affiché sans mention de taxe se lit comme un prix toutes taxes
            comprises, et la première facture dément la page. */}
        <p className="mt-8 text-xs text-slate-500 text-center max-w-2xl">{t.pricing.taxNote}</p>
      </section>

      {/* 5. INTERACTIVE FAQ ACCORDION SECTION */}
      <section id="faq" className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="flex flex-col items-center text-center mb-12">
          <span className="text-xs font-black tracking-widest uppercase text-blue-600 bg-blue-50 px-3.5 py-1.5 rounded-full mb-4">
            {t.faq.badge}
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            {t.faq.title}
          </h2>
        </div>

        <div className="flex flex-col gap-4">
          {[
            { q: t.faq.q1, a: t.faq.a1 },
            { q: t.faq.q2, a: t.faq.a2 },
            { q: t.faq.q3, a: t.faq.a3 },
            { q: t.faq.q4, a: t.faq.a4 }
          ].map((item, i) => (
            <div 
              key={i} 
              className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden transition-all duration-200"
            >
              <button
                type="button"
                onClick={() => toggleFaq(i)}
                aria-expanded={openFaq === i}
                className="w-full px-6 py-5 flex items-center justify-between text-left font-bold text-slate-900 hover:text-blue-600 transition-colors cursor-pointer"
              >
                <span className="text-base sm:text-lg pr-4">{item.q}</span>
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                  {openFaq === i ? <Minus className="w-4 h-4 text-blue-600" /> : <Plus className="w-4 h-4 text-slate-500" />}
                </div>
              </button>
              {openFaq === i && (
                <div className="px-6 pb-6 text-slate-600 text-sm sm:text-base leading-relaxed border-t border-slate-100/60 pt-4 animate-fadeIn">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 6. CALL TO ACTION FOOTER BANNER */}
      <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="bg-slate-950 rounded-3xl p-10 sm:p-16 text-center text-white flex flex-col items-center justify-center gap-6 relative overflow-hidden shadow-2xl">
          <div className="pointer-events-none absolute -top-32 -right-32 w-80 h-80 rounded-full bg-blue-600/30 blur-3xl animate-pulse-glow" />
          <div className="pointer-events-none absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-indigo-600/30 blur-3xl animate-pulse-glow" />
          
          {/* Ces quatre textes étaient écrits en dur, donc identiques en
              anglais. Le sous-titre invitait par ailleurs à « rejoindre les
              consultants de référence » qui utilisent la plateforme : il
              n'y en a aucun à ce jour. */}
          <h2 className="text-3xl sm:text-5xl font-black max-w-2xl tracking-tight leading-tight relative z-10">
            {t.finalCta.title}
          </h2>
          <p className="text-white/70 max-w-xl text-sm sm:text-base relative z-10">
            {t.finalCta.subtitle}
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4 relative z-10 mt-2">
            <Link
              href="/demo"
              className="rounded-full bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 text-sm sm:text-base font-bold shadow-xl transition-all hover:scale-105"
            >
              {t.finalCta.ctaPrimary}
            </Link>
            <Link
              href="/connexion"
              className="rounded-full border border-white/20 bg-white/10 hover:bg-white/20 text-white px-8 py-4 text-sm sm:text-base font-semibold backdrop-blur-md transition-all"
            >
              {t.finalCta.ctaSecondary}
            </Link>
          </div>
        </div>
      </section>
      
      {/* 7. REFINED MINIMALIST FOOTER */}
      <footer className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-slate-200/60 flex flex-col sm:flex-row items-center justify-between gap-6 text-sm text-slate-500">
        <div className="flex items-center gap-2 font-bold text-slate-800">
          <div className="h-6 w-6 rounded-md bg-blue-600 text-white flex items-center justify-center text-xs font-black">M</div>
          <span>moncabinetcric</span>
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium">
          <a href="#features" className="hover:text-slate-900 transition-colors">Fonctionnalités</a>
          <a href="#pricing" className="hover:text-slate-900 transition-colors">Tarification</a>
          <a href="#faq" className="hover:text-slate-900 transition-colors">FAQ</a>
          <Link href="/portal" className="hover:text-slate-900 transition-colors">Portail Client</Link>
          <Link href="/confidentialite" className="hover:text-slate-900 transition-colors">
            {tLegal("privacy.title")}
          </Link>
          <Link href="/conditions" className="hover:text-slate-900 transition-colors">
            {tLegal("terms.title")}
          </Link>
        </nav>
        <div className="text-xs text-slate-400">
          © 2026 moncabinetcric. Conçu avec excellence pour les consultants réglementés CICC.
        </div>
      </footer>

    </div>
  )
}
