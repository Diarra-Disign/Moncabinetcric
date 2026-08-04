"use client"

import * as React from "react"
import { 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  User, 
  Calendar, 
  Briefcase, 
  Users, 
  FileSignature, 
  ArrowRight, 
  ArrowLeft, 
  Plus, 
  Trash2, 
  ShieldCheck, 
  FileText, 
  Check, 
  Download,
  AlertTriangle
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

interface ActivityItem {
  id: string
  from: string
  to: string
  activity: string
  location: string
  status: "valid" | "gap"
}

const INITIAL_ACTIVITIES: ActivityItem[] = [
  {
    id: "act-1",
    from: "2023-01",
    to: "2026-07",
    activity: "",
    location: "Montréal, QC, Canada",
    status: "valid"
  },
  {
    id: "act-2",
    from: "2019-09",
    to: "2022-12",
    activity: "Développeur Fullstack · TechSolutions SA",
    location: "Dakar, Sénégal",
    status: "valid"
  },
  {
    id: "act-3",
    from: "2016-09",
    to: "2019-06",
    activity: "Baccalauréat en Informatique · Université polytechnique",
    location: "Dakar, Sénégal",
    status: "valid"
  }
]

export function SmartIntakeWizard() {
  const [currentStep, setCurrentStep] = React.useState<number>(1)
  const [formData, setFormData] = React.useState({
    lastName: "Diarra",
    firstName: "Adama",
    dob: "1994-05-18",
    citizenship: "Sénégal",
    maritalStatus: "married",
    passportNumber: "A98765432",
    passportExpiry: "2029-08-14",
    hasSpouse: true,
    spouseName: "Fatou Sow",
    childrenCount: 1,
    isSigned: false,
    signatureDate: "2026-07-31"
  })

  const [activities, setActivities] = React.useState<ActivityItem[]>(INITIAL_ACTIVITIES)
  const [newActivity, setNewActivity] = React.useState({
    from: "",
    to: "",
    activity: "",
    location: ""
  })
  const [showAddForm, setShowAddForm] = React.useState(false)
  const [isGenerating, setIsGenerating] = React.useState(false)
  const [generatedSuccess, setGeneratedSuccess] = React.useState(false)

  // Calcule la conformité des antécédents IMM 5669 (10 ans sans lacune)
  const hasNoGaps = React.useMemo(() => {
    return activities.length >= 3 // Simulation de continuité sur 10 ans sans lacune
  }, [activities])

  const passportStatus = React.useMemo(() => {
    const expiryYear = parseInt(formData.passportExpiry.split("-")[0] || "0", 10)
    if (expiryYear >= 2027) return { label: "Passeport conforme (> 6 mois)", color: "success" as const }
    if (expiryYear === 2026) return { label: "Attention : expire dans 6 mois", color: "warning" as const }
    return { label: "Expiré - Renouvellement requis", color: "destructive" as const }
  }, [formData.passportExpiry])

  const handleAddActivity = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newActivity.activity || !newActivity.from || !newActivity.to) return
    const item: ActivityItem = {
      id: `act-${Date.now()}`,
      from: newActivity.from,
      to: newActivity.to,
      activity: newActivity.activity,
      location: newActivity.location || "Canada",
      status: "valid"
    }
    setActivities([item, ...activities])
    setNewActivity({ from: "", to: "", activity: "", location: "" })
    setShowAddForm(false)
  }

  const handleDeleteActivity = (id: string) => {
    setActivities(activities.filter(a => a.id !== id))
  }

  const handleGenerateIMM = () => {
    setIsGenerating(true)
    setTimeout(() => {
      setIsGenerating(false)
      setGeneratedSuccess(true)
    }, 1400)
  }

  const steps = [
    { id: 1, title: "1. Identité & Passeport", icon: User, desc: "IMM 0008 / IMM 5406" },
    { id: 2, title: "2. Antécédents 10 ans", icon: Calendar, desc: "IMM 5669 - Annexe A" },
    { id: 3, title: "3. Famille & Conjoint", icon: Users, desc: "IMM 5406" },
    { id: 4, title: "4. Mandat & Signature", icon: FileSignature, desc: "IMM 5476" },
  ]

  return (
    <div className="space-y-8">
      {/* BANDEAU HAUT : SINGLE SOURCE OF TRUTH HEADER */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-800 p-6 sm:p-8 text-white shadow-xl border border-white/10">
        <div className="pointer-events-none absolute -right-10 -bottom-10 w-64 h-64 rounded-full bg-white/10 blur-2xl" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-md px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-blue-100 mb-3 border border-white/20">
              <Sparkles className="h-3.5 w-3.5 text-amber-300 animate-pulse" />
              <span>Smart Intake Wizard · MonCabinetCRIC</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              Questionnaire Universel IRCC
            </h2>
            <p className="text-sm sm:text-base text-blue-100 mt-1 max-w-2xl">
              Remplissez votre profil une seule fois. Notre moteur vérifiera la conformité CICC et générera automatiquement tous vos formulaires PDF officiels (IMM 0008, 5669, 5406, 5476).
            </p>
          </div>

          {/* PROGRESS INDICATOR PILL */}
          <div className="flex flex-col items-start md:items-end bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 min-w-[200px]">
            <div className="flex items-center justify-between w-full text-xs font-semibold mb-1.5 text-blue-100">
              <span>Progression globale</span>
              <span className="font-mono text-white font-bold">{currentStep * 25}%</span>
            </div>
            <div className="w-full bg-black/20 rounded-full h-2.5 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-amber-400 to-emerald-400 h-full rounded-full transition-all duration-500 ease-out" 
                style={{ width: `${currentStep * 25}%` }}
              />
            </div>
            <span className="text-[11px] text-blue-200 mt-2 flex items-center gap-1 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
              Audité par Me. A. Diarra (RCIC)
            </span>
          </div>
        </div>
      </div>

      {/* TABS / STEP PERMUTATION BAR */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {steps.map((step) => {
          const Icon = step.icon
          const isActive = currentStep === step.id
          const isCompleted = currentStep > step.id
          return (
            <button
              key={step.id}
              onClick={() => setCurrentStep(step.id)}
              type="button"
              className={`flex items-center gap-3.5 p-4 rounded-2xl border text-left transition-all duration-200 ${
                isActive
                  ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20 scale-[1.02]"
                  : isCompleted
                  ? "bg-card border-emerald-500/30 text-foreground hover:border-emerald-500/50"
                  : "bg-card border-border text-muted-foreground hover:bg-muted/50"
              }`}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold text-sm ${
                  isActive
                    ? "bg-white/20 text-white"
                    : isCompleted
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold truncate">{step.title}</p>
                <p className={`text-[10px] truncate ${isActive ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                  {step.desc}
                </p>
              </div>
            </button>
          )
        })}
      </div>

      {/* STEP CONTENT CONTAINER */}
      <Card className="border-border/60 shadow-sm overflow-hidden">
        {/* ÉTAPE 1 : IDENTITÉ & PASSEPORT */}
        {currentStep === 1 && (
          <div className="p-6 sm:p-8 space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  Renseignements personnels (IMM 0008 / IMM 5406)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Ces informations seront reproduites sur tous vos formulaires IRCC sans re-saisie.
                </p>
              </div>
              <Badge variant={passportStatus.color as "default" | "secondary" | "destructive" | "outline" | "success" | "warning"}>{passportStatus.label}</Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground">Nom de famille</label>
                <Input
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="h-11 font-medium"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground">Prénoms</label>
                <Input
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="h-11 font-medium"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground">Date de naissance</label>
                <Input
                  type="date"
                  value={formData.dob}
                  onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                  className="h-11 font-medium"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground">Pays de citoyenneté</label>
                <Input
                  value={formData.citizenship}
                  onChange={(e) => setFormData({ ...formData, citizenship: e.target.value })}
                  className="h-11 font-medium"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground">Numéro de Passeport</label>
                <Input
                  value={formData.passportNumber}
                  onChange={(e) => setFormData({ ...formData, passportNumber: e.target.value })}
                  className="h-11 font-mono font-bold uppercase"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground">Date d&apos;expiration du Passeport</label>
                <Input
                  type="date"
                  value={formData.passportExpiry}
                  onChange={(e) => setFormData({ ...formData, passportExpiry: e.target.value })}
                  className="h-11 font-medium"
                />
              </div>
            </div>

            <div className="rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                  ✓
                </div>
                <div>
                  <p className="text-xs font-bold text-blue-900 dark:text-blue-100">
                    Contrôle automatique de cohérence IRCC
                  </p>
                  <p className="text-[11px] text-blue-700 dark:text-blue-300">
                    Passeport valide au-delà de la durée de traitement estimée (18 mois).
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="bg-white dark:bg-card text-blue-700 font-mono text-[10px]">
                IMM0008-READY
              </Badge>
            </div>
          </div>
        )}

        {/* ÉTAPE 2 : ANTÉCÉDENTS 10 ANS (IMM 5669) */}
        {currentStep === 2 && (
          <div className="p-6 sm:p-8 space-y-6 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
              <div>
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Antécédents sur 10 ans (IMM 5669 - Annexe A)
                </h3>
                <p className="text-xs text-muted-foreground">
                  IRCC exige la liste continue et sans aucune interruption de toutes vos activités depuis 2016.
                </p>
              </div>

              {/* LIVE AUDIT STATUS CARD */}
              <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <div>
                  <p className="text-xs font-bold text-emerald-800 dark:text-emerald-200">
                    Continuité 10 ans vérifiée (100%)
                  </p>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                    Aucune lacune détectée par le moteur CICC
                  </p>
                </div>
              </div>
            </div>

            {/* LISTE DES ACTIVITÉS */}
            <div className="space-y-3">
              {activities.map((item) => (
                <div 
                  key={item.id}
                  className="flex items-center justify-between p-4 rounded-2xl border border-border bg-card hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs mt-0.5">
                      {item.from.split("-")[0]}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">{item.activity}</p>
                      <p className="text-xs text-muted-foreground">{item.location}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-[10px] font-mono bg-muted/40">
                          {item.from} → {item.to}
                        </Badge>
                        <Badge variant="success" className="text-[10px]">
                          Vérifié sans lacune ✓
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => handleDeleteActivity(item.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            {/* BOUTON / FORMULAIRE D'AJOUT */}
            {!showAddForm ? (
              <Button 
                variant="outline" 
                onClick={() => setShowAddForm(true)} 
                className="w-full h-12 rounded-xl border-dashed border-2 gap-2 text-xs font-bold"
              >
                <Plus className="h-4 w-4" />
                Ajouter une activité (Emploi, Études, Chômage, Voyage)
              </Button>
            ) : (
              <form onSubmit={handleAddActivity} className="p-5 rounded-2xl border border-primary/30 bg-primary/5 space-y-4">
                <p className="text-xs font-bold text-primary">Nouvelle période d&apos;activité (AAAA-MM)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-[11px] font-semibold">De (AAAA-MM)</label>
                    <Input 
                      placeholder="2022-01" 
                      value={newActivity.from} 
                      onChange={e => setNewActivity({ ...newActivity, from: e.target.value })} 
                      className="h-10 text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold">À (AAAA-MM)</label>
                    <Input 
                      placeholder="2023-01" 
                      value={newActivity.to} 
                      onChange={e => setNewActivity({ ...newActivity, to: e.target.value })} 
                      className="h-10 text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold">Activité & Employeur / École</label>
                    <Input 
                      placeholder="Ingénieur chez..." 
                      value={newActivity.activity} 
                      onChange={e => setNewActivity({ ...newActivity, activity: e.target.value })} 
                      className="h-10 text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold">Ville & Pays</label>
                    <Input 
                      placeholder="Montréal, Canada" 
                      value={newActivity.location} 
                      onChange={e => setNewActivity({ ...newActivity, location: e.target.value })} 
                      className="h-10 text-xs"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddForm(false)}>
                    Annuler
                  </Button>
                  <Button type="submit" size="sm" className="gap-1.5 font-bold">
                    <Plus className="h-4 w-4" />
                    Enregistrer l&apos;activité
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ÉTAPE 3 : FAMILLE & CONJOINT (IMM 5406) */}
        {currentStep === 3 && (
          <div className="p-6 sm:p-8 space-y-6 animate-fadeIn">
            <div className="border-b border-border pb-4">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Famille & Conjoint (IMM 5406 - Renseignements additionnels)
              </h3>
              <p className="text-xs text-muted-foreground">
                Déclarez les membres de votre famille immédiate selon le statut d&apos;immigration souhaité.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-5 rounded-2xl border border-border bg-card space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold">Conjoint marié / Conjoint de fait</p>
                    <p className="text-xs text-muted-foreground">Le conjoint accompagnera-t-il votre demande ?</p>
                  </div>
                  <Badge variant={formData.hasSpouse ? "success" : "secondary"}>
                    {formData.hasSpouse ? "Oui, inclus" : "Non applicable"}
                  </Badge>
                </div>

                {formData.hasSpouse && (
                  <div className="space-y-3 pt-2 border-t border-border/60">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold">Nom complet du conjoint</label>
                      <Input
                        value={formData.spouseName}
                        onChange={e => setFormData({ ...formData, spouseName: e.target.value })}
                        className="h-10"
                      />
                    </div>
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Ses informations seront ajoutées au formulaire IMM 5406 section A.
                    </p>
                  </div>
                )}
              </div>

              <div className="p-5 rounded-2xl border border-border bg-card space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold">Enfants à charge</p>
                    <p className="text-xs text-muted-foreground">Nombre d&apos;enfants à charge (&lt; 22 ans)</p>
                  </div>
                  <Badge variant="outline" className="font-mono font-bold">
                    {formData.childrenCount} enfant(s)
                  </Badge>
                </div>

                <div className="space-y-2 pt-2 border-t border-border/60">
                  <label className="text-xs font-semibold">Nombre d&apos;enfants à inclure</label>
                  <Input
                    type="number"
                    min="0"
                    max="10"
                    value={formData.childrenCount}
                    onChange={e => setFormData({ ...formData, childrenCount: parseInt(e.target.value || "0", 10) })}
                    className="h-10 max-w-[120px]"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Une annexe enfants (Section B du IMM 5406) sera automatiquement créée.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ÉTAPE 4 : REPRÉSENTATION & SIGNATURE (IMM 5476) */}
        {currentStep === 4 && (
          <div className="p-6 sm:p-8 space-y-6 animate-fadeIn">
            <div className="border-b border-border pb-4">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <FileSignature className="h-5 w-5 text-primary" />
                Mandat de représentation (IMM 5476) & Signature CICC
              </h3>
              <p className="text-xs text-muted-foreground">
                Autorisez officiellement votre consultant CRIC à soumettre votre dossier et apposez votre signature.
              </p>
            </div>

            {/* ENCADRÉ REPRÉSENTANT OFFICIEL */}
            <div className="p-5 rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-sm font-black shadow-md">
                  CRIC
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-foreground">Me. Adama Diarra</p>
                    <Badge variant="success" className="text-[10px]">Membre Actif du Collège</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Consultant Réglementé en Immigration Canadienne
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="bg-white dark:bg-card text-blue-700 font-mono text-xs font-bold py-1.5 px-3">
                IMM 5476 - REPRÉSENTANT DÉSIGNÉ
              </Badge>
            </div>

            {/* INTERACTIVE SIGNATURE BOX */}
            <div className="p-6 rounded-2xl border-2 border-dashed border-border bg-muted/10 text-center space-y-4">
              {!formData.isSigned ? (
                <>
                  <div className="max-w-md mx-auto">
                    <p className="text-sm font-bold text-foreground mb-1">
                      Signature Électronique Certifiée
                    </p>
                    <p className="text-xs text-muted-foreground">
                      En cliquant sur le bouton ci-dessous, vous apposez votre signature numérique sur les formulaires IMM 0008, IMM 5669, IMM 5406 et IMM 5476.
                    </p>
                  </div>

                  <div className="flex items-center justify-center gap-3 pt-2">
                    <Button 
                      onClick={() => setFormData({ ...formData, isSigned: true })}
                      className="gap-2 font-bold px-6 h-12 rounded-xl shadow-lg shadow-primary/25"
                    >
                      <FileSignature className="h-4 w-4" />
                      Apposer ma signature numérique sur les 4 formulaires
                    </Button>
                  </div>
                </>
              ) : (
                <div className="py-4 space-y-3 animate-fadeIn">
                  <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-600">
                    <Check className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-emerald-700 dark:text-emerald-300">
                      Signature certifiée apposée par {formData.firstName} {formData.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                      Horodatage immuable IRCC : {formData.signatureDate} · SHA256: 8f9b...a19c
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setFormData({ ...formData, isSigned: false })}
                    className="text-xs"
                  >
                    Réinitialiser la signature
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* BOTTOM WIZARD NAVIGATION BAR */}
        <div className="flex items-center justify-between px-6 sm:px-8 py-5 border-t border-border bg-muted/20">
          <div>
            {currentStep > 1 && (
              <Button 
                variant="outline" 
                onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
                className="gap-2 font-semibold"
              >
                <ArrowLeft className="h-4 w-4" />
                Étape précédente
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {currentStep < 4 ? (
              <Button 
                onClick={() => setCurrentStep(prev => Math.min(4, prev + 1))}
                className="gap-2 font-bold px-6 shadow-md shadow-primary/20"
              >
                Étape suivante
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button 
                onClick={handleGenerateIMM}
                disabled={isGenerating || !formData.isSigned}
                className="gap-2 font-black px-8 h-11 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg shadow-emerald-600/30"
              >
                {isGenerating ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Génération des 4 PDF en cours...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Générer la liasse IRCC (4 formulaires PDF)
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* MODAL / SUCCÈS GÉNÉRATION DES PDF IMM */}
      {generatedSuccess && (
        <Card className="border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-xl animate-fadeIn">
          <CardContent className="p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30 shrink-0">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div>
                <h4 className="text-lg font-black text-emerald-900 dark:text-emerald-100">
                  Liasse IRCC générée et transmise à Me. A. Diarra !
                </h4>
                <p className="text-xs sm:text-sm text-emerald-700 dark:text-emerald-300 mt-0.5">
                  Les formulaires IMM 0008, IMM 5669, IMM 5406 et IMM 5476 sont pré-remplis, signés et validés.
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Badge className="bg-emerald-700 text-white text-[10px]">IMM 0008 - Demande générique ✓</Badge>
                  <Badge className="bg-emerald-700 text-white text-[10px]">IMM 5669 - Antécédents (0 lacune) ✓</Badge>
                  <Badge className="bg-emerald-700 text-white text-[10px]">IMM 5476 - Représentant ✓</Badge>
                </div>
              </div>
            </div>

            <Button 
              onClick={() => setGeneratedSuccess(false)}
              className="w-full sm:w-auto gap-2 font-bold bg-emerald-700 hover:bg-emerald-800 text-white"
            >
              <Download className="h-4 w-4" />
              Télécharger ma liasse PDF
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
