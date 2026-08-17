"use client"

import * as React from "react"
import {
  Search, X, FileText, Check, ArrowUp, ArrowDown, Lock, AlertTriangle, User,
  Building2, Settings, Clock, Calendar, Video, ShieldCheck, Edit3, BookmarkPlus,
  PenTool, Trash2,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ModifierFiche } from "@/components/fiche/fiche-formulaire"
import { EditeurContenu, CONTENU_VIDE, type ContenuContrat } from "./editeur-contenu"
import { verifierEcheancier } from "@/lib/ententes/echeancier"
import {
  rechercherContractant, preremplir, articlesDuModele, creerEntente,
  chargerBrouillon, modifierBrouillon, sauvegarderModelePersonnalise,
  supprimerModelePersonnalise, listerModelesEntente,
  type ArticleEntente,
} from "@/lib/data/ententes-actions"
import {
  variablesDe, substituer, verifierAvantGeneration,
  lignesAdresseCabinet, adresseDuContractant,
} from "@/lib/ententes/variables"
import { renumeroterArticles } from "@/lib/ententes/numerotation"
import { lignesAdresse } from "@/lib/data/adresse"
import { nomAvecCivilite } from "@/lib/data/identite"
import { cn } from "@/lib/utils"

/**
 * Créer / Modifier une entente : modèle → contractant → paramètres (durée/honoraires) → articles modifiables → aperçu.
 *
 * L'APERÇU EMPLOIE LE MÊME MODULE QUE LE SERVEUR. variables.ts est pur — ni
 * « server-only », ni accès base — précisément pour que ce qui s'affiche ici
 * soit ce que le PDF composera.
 *
 * Le consultant peut cocher/décocher librement n'importe quel article, réordonner,
 * éditer le texte des clauses, sauvegarder et supprimer des MODÈLES PERSONNALISÉS
 * pour son cabinet.
 *
 * En cas de décochage d'une clause, la numérotation des articles actifs (« ARTICLE 1 »,
 * « ARTICLE 2 », etc.) s'ajuste automatiquement et en temps réel sans saut de numéro.
 */

interface Modele {
  id: string; duCabinet: boolean; code: string; kind: string
  titre: string; description: string; version: string; parDefaut: boolean
}

type Trouve = Awaited<ReturnType<typeof rechercherContractant>>[number]
type Prerempli = Awaited<ReturnType<typeof preremplir>>

const CHAMP =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"

const DUREES_PREDEFINIES = [30, 45, 60, 90, 120] as const

export function CreerEntente({
  modeles,
  onFerme,
  brouillonId,
}: {
  modeles: Modele[]
  onFerme: () => void
  brouillonId?: string
}) {
  const router = useRouter()
  const reprise = Boolean(brouillonId)
  const [modelesAjoutes, setModelesAjoutes] = React.useState<Modele[]>([])
  const listeModeles = React.useMemo(() => {
    const ids = new Set(modelesAjoutes.map((m) => m.id))
    return [...modelesAjoutes, ...modeles.filter((m) => !ids.has(m.id))]
  }, [modeles, modelesAjoutes])
  const [modele, setModele] = React.useState<Modele | null>(null)
  const [recherche, setRecherche] = React.useState("")
  const [trouves, setTrouves] = React.useState<Trouve[]>([])
  const [choisi, setChoisi] = React.useState<Trouve | null>(null)
  const [source, setSource] = React.useState<Prerempli>(null)
  const [articles, setArticles] = React.useState<ArticleEntente[]>([])
  const [honoraires, setHonoraires] = React.useState("")
  const [enCours, setEnCours] = React.useState(false)
  const [resultat, setResultat] = React.useState<{ ok: boolean; message: string } | null>(null)
  const [ficheAModifier, setFicheAModifier] = React.useState(false)
  const [contenu, setContenu] = React.useState<ContenuContrat>(CONTENU_VIDE)
  const [chargement, setChargement] = React.useState(Boolean(brouillonId))
  const [reference, setReference] = React.useState("")

  // Édition manuelle d'un article dans le brouillon
  const [editeArticleCode, setEditeArticleCode] = React.useState<string | null>(null)

  // Modal Sauvegarde de modèle personnalisé réutilisable
  const [modalSauvegardeModele, setModalSauvegardeModele] = React.useState(false)
  const [nomNouveauModele, setNomNouveauModele] = React.useState("")
  const [descNouveauModele, setDescNouveauModele] = React.useState("")
  const [sauvegardeEnCours, setSauvegardeEnCours] = React.useState(false)
  const [erreurSauvegardeModele, setErreurSauvegardeModele] = React.useState<string | null>(null)

  // Modal Suppression de modèle personnalisé du cabinet
  const [modeleASupprimer, setModeleASupprimer] = React.useState<Modele | null>(null)
  const [suppressionEnCours, setSuppressionEnCours] = React.useState(false)
  const [erreurSuppression, setErreurSuppression] = React.useState<string | null>(null)

  // Paramètres spécifiques de consultation initiale
  const [dureeMinutes, setDureeMinutes] = React.useState<number>(60)
  const [dureePersonnalisee, setDureePersonnalisee] = React.useState<string>("")
  const [estDureePerso, setEstDureePerso] = React.useState<boolean>(false)
  const [dateHeure, setDateHeure] = React.useState<string>("")
  const [modeConsultation, setModeConsultation] = React.useState<string>("visioconférence (Zoom, Teams, Google Meet)")
  const [notesConsultation, setNotesConsultation] = React.useState<string>("")

  const proBono = (modele?.kind ?? "").includes("probono")
  const isConsultation = (modele?.kind ?? "").includes("consultation")

  const effDuree = estDureePerso && Number(dureePersonnalisee) > 0
    ? Number(dureePersonnalisee)
    : dureeMinutes

  // Calcul dynamique de la numérotation séquentielle des articles actifs
  const articlesRenumerotes = React.useMemo(() => {
    return renumeroterArticles(articles)
  }, [articles])

  React.useEffect(() => {
    if (!brouillonId) return
    let vivant = true
    ;(async () => {
      const b = await chargerBrouillon(brouillonId)
      if (!vivant || !b) { setChargement(false); return }

      setReference(b.reference)
      setHonoraires(String(b.honoraires || ""))
      const trouve = listeModeles.find((m) => m.id === b.templateId)
      setModele(trouve ? { ...trouve, titre: b.titre } : {
        id: b.templateId, duCabinet: false, code: "", kind: b.kind,
        titre: b.titre, description: "", version: "1.0", parDefaut: false,
      })
      setArticles(b.articles.map((a, i) => ({
        code: a.code, titleFr: a.title_fr, bodyFr: a.body_fr,
        level: a.level, enabled: true, position: a.position || i + 1,
      })))
      setContenu({
        servicesDescription: b.servicesDescription,
        servicesItems: b.servicesItems,
        echeancier: b.echeancier,
        modesPaiement: b.modesPaiement,
        conditionsPaiement: b.conditionsPaiement,
        fraisNonInclus: b.fraisNonInclus,
      })
      const p = await preremplir(b.contractantType, b.contractantId)
      if (!vivant) return
      setSource(p)
      setChoisi({
        type: b.contractantType, id: b.contractantId,
        nom: [p?.partie.firstName, p?.partie.lastName].filter(Boolean).join(" "),
        courriel: p?.partie.email ?? "", telephone: p?.partie.phone ?? "", detail: "",
      })
      setChargement(false)
    })()
    return () => { vivant = false }
  }, [brouillonId, listeModeles])

  React.useEffect(() => {
    let vivant = true
    const t = setTimeout(async () => {
      if (recherche.trim().length < 2) {
        if (vivant) setTrouves([])
        return
      }
      const res = await rechercherContractant(recherche)
      if (vivant) setTrouves(res)
    }, 250)
    return () => {
      vivant = false
      clearTimeout(t)
    }
  }, [recherche])

  React.useEffect(() => {
    if (!modele) return
    articlesDuModele(modele.id).then(setArticles)
  }, [modele])

  const choisir = async (t: Trouve) => {
    setChoisi(t)
    setTrouves([])
    setRecherche("")
    setSource(await preremplir(t.type, t.id))
  }

  const deplacer = (i: number, vers: number) => {
    if (vers < 0 || vers >= articles.length) return
    const copie = [...articles]
    const [pris] = copie.splice(i, 1)
    copie.splice(vers, 0, pris)
    setArticles(copie.map((a, k) => ({ ...a, position: k + 1 })))
  }

  /** Le contexte du contrat — le MÊME que celui que le serveur assemblera. */
  const contexte = React.useMemo(() => {
    if (!source) return null
    const montant = Number(honoraires) || 0
    return {
      contractant: source.partie,
      cabinet: source.cabinet,
      montants: { honoraires: montant, taxes: 0, total: montant },
      entente: { numero: "—", date: new Date().toISOString().slice(0, 10), titre: modele?.titre ?? "" },
      locale: "fr",
      proBono,
      consultation: isConsultation ? {
        dureeMinutes: effDuree,
        dateHeure: dateHeure || undefined,
        mode: modeConsultation,
        notes: notesConsultation,
      } : undefined,
    }
  }, [source, honoraires, modele, proBono, isConsultation, effDuree, dateHeure, modeConsultation, notesConsultation])

  /** L'aperçu, composé avec les articles renumérotés dynamiquement. */
  const apercu = React.useMemo(() => {
    if (!contexte) return []
    const variables = variablesDe(contexte)
    return articlesRenumerotes.filter((a) => a.enabled).map((a) => ({
      code: a.code,
      titre: substituer(a.titleFr, variables).texte,
      corps: substituer(a.bodyFr, variables).texte,
    }))
  }, [contexte, articlesRenumerotes])

  /** Le contrôle joué à l'écran. */
  const controle = React.useMemo(() => {
    if (!contexte) return null
    const base = verifierAvantGeneration(
      contexte,
      articlesRenumerotes.filter((a) => a.enabled).map((a) => `${a.titleFr}\n${a.bodyFr}`)
    )
    const echeancier = isConsultation
      ? []
      : verifierEcheancier(contenu.echeancier, Number(honoraires) || 0, proBono)
    if (base.ok && echeancier.length === 0) return base
    return {
      ok: false as const,
      manquants: [...(base.ok ? [] : base.manquants), ...echeancier],
      profilACompleter: base.ok ? false : base.profilACompleter,
    }
  }, [contexte, articlesRenumerotes, contenu.echeancier, honoraires, proBono, isConsultation])

  const blocs = React.useMemo(() => {
    if (!source) return null
    return {
      consultant: {
        nom: nomAvecCivilite(
          { civility: source.cabinet.civiliteConsultant, name: source.cabinet.consultant }, "fr"
        ),
        organisation: source.cabinet.nom,
        permis: source.cabinet.permis,
        adresse: lignesAdresseCabinet(source.cabinet),
        telephone: source.cabinet.telephone ?? "",
        courriel: source.cabinet.courriel ?? "",
      },
      client: {
        nom: nomAvecCivilite(
          {
            civility: source.partie.civility,
            firstName: source.partie.firstName,
            lastName: source.partie.lastName,
          },
          "fr"
        ),
        organisation: source.partie.legalName ?? "",
        permis: "",
        adresse: lignesAdresse(adresseDuContractant(source.partie)),
        telephone: source.partie.phone ?? "",
        courriel: source.partie.email ?? "",
      },
    }
  }, [source])

  const enregistrer = async () => {
    if (!modele || !choisi) return
    setEnCours(true)
    try {
      if (brouillonId) {
        const r = await modifierBrouillon(brouillonId, {
          honoraires: Number(honoraires) || 0,
          taxes: 0,
          proBono,
          articles: articlesRenumerotes,
          servicesDescription: isConsultation ? (notesConsultation || contenu.servicesDescription) : contenu.servicesDescription,
          servicesItems: isConsultation ? [] : contenu.servicesItems,
          echeancier: isConsultation ? [] : contenu.echeancier,
          modesPaiement: isConsultation ? (modeConsultation ? [modeConsultation] : []) : contenu.modesPaiement,
          conditionsPaiement: contenu.conditionsPaiement,
          fraisNonInclus: contenu.fraisNonInclus,
          consultationDurationMinutes: isConsultation ? effDuree : undefined,
          consultationDateTime: isConsultation && dateHeure ? dateHeure : undefined,
          consultationMode: isConsultation ? modeConsultation : undefined,
          consultationNotes: isConsultation ? notesConsultation : undefined,
        })
        setResultat(r)
        if (r.ok) setTimeout(onFerme, 1400)
        return
      }

      const r = await creerEntente({
        templateId: modele.id,
        contractantType: choisi.type,
        contractantId: choisi.id,
        titre: modele.titre,
        kind: modele.kind,
        proBono,
        honoraires: Number(honoraires) || 0,
        taxes: 0,
        articles: articlesRenumerotes,
        servicesDescription: isConsultation ? (notesConsultation || contenu.servicesDescription) : contenu.servicesDescription,
        servicesItems: isConsultation ? [] : contenu.servicesItems,
        echeancier: isConsultation ? [] : contenu.echeancier,
        modesPaiement: isConsultation ? (modeConsultation ? [modeConsultation] : []) : contenu.modesPaiement,
        conditionsPaiement: contenu.conditionsPaiement,
        fraisNonInclus: contenu.fraisNonInclus,
        consultationDurationMinutes: isConsultation ? effDuree : undefined,
        consultationDateTime: isConsultation && dateHeure ? dateHeure : undefined,
        consultationMode: isConsultation ? modeConsultation : undefined,
        consultationNotes: isConsultation ? notesConsultation : undefined,
      })
      setResultat(r)
      if (r.ok) setTimeout(onFerme, 1400)
    } finally {
      setEnCours(false)
    }
  }

  const sauvegarderModele = async () => {
    if (!nomNouveauModele.trim() || !modele) return
    setSauvegardeEnCours(true)
    setErreurSauvegardeModele(null)
    try {
      const r = await sauvegarderModelePersonnalise({
        titre: nomNouveauModele.trim(),
        description: descNouveauModele.trim(),
        kind: modele.kind,
        articles: articlesRenumerotes,
      })
      if (r.ok) {
        setResultat(r)
        router.refresh()
        const misAJour = await listerModelesEntente()
        setModelesAjoutes(misAJour)
        if (r.id) {
          const nouveau = misAJour.find((m) => m.id === r.id)
          if (nouveau) setModele(nouveau)
        }
        setModalSauvegardeModele(false)
      } else {
        setErreurSauvegardeModele(r.message)
      }
    } catch (err) {
      setErreurSauvegardeModele(err instanceof Error ? err.message : "Erreur inattendue")
    } finally {
      setSauvegardeEnCours(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-foreground/50 p-4">
      <div className="bg-card w-full max-w-5xl rounded-2xl border border-border shadow-2xl flex flex-col max-h-[92vh]">
        <header className="p-5 border-b border-border flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-foreground">
              {reprise ? `Modifier le brouillon${reference ? ` ${reference}` : ""}` : "Créer une entente"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {modele ? modele.titre : "Choisissez d'abord un modèle"}
              {choisi ? ` · ${choisi.nom}` : ""}
              {reprise ? " · Le contractant et le modèle ne changent plus." : ""}
            </p>
          </div>
          <button type="button" onClick={onFerme} aria-label="Fermer"
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto grid gap-0 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border">
          {/* ---------------- Édition ---------------- */}
          <div className="p-5 space-y-5">
            {!reprise && (
            <section>
              <h3 className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-2">
                1. Le modèle
              </h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {listeModeles.map((m) => (
                  <div key={m.id} className="relative group">
                    <button
                      type="button"
                      onClick={() => setModele(m)}
                      className={cn(
                        "w-full text-left rounded-xl border p-3 transition-colors cursor-pointer",
                        m.duCabinet ? "pr-9" : "",
                        modele?.id === m.id
                          ? "border-primary bg-primary/10"
                          : "border-border hover:bg-muted"
                      )}
                    >
                      <span className="block text-xs font-black text-foreground">{m.titre}</span>
                      <span className="block text-[11px] text-muted-foreground mt-0.5">{m.description}</span>
                      {m.duCabinet ? (
                        <span className="mt-1 inline-block text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                          Modèle du cabinet
                        </span>
                      ) : (
                        <span className="mt-1 inline-block text-[10px] font-bold text-muted-foreground">
                          Modèle officiel
                        </span>
                      )}
                    </button>
                    {m.duCabinet && (
                      <button
                        type="button"
                        title="Supprimer ce modèle personnalisé"
                        aria-label={`Supprimer le modèle ${m.titre}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          setModeleASupprimer(m)
                        }}
                        className="absolute top-2.5 right-2.5 p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
            )}

            {!reprise && (
            <section>
              <h3 className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-2">
                2. Le contractant
              </h3>
              {choisi ? (
                <div className="rounded-xl border border-border bg-muted/30 p-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-black text-foreground">{choisi.nom}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {choisi.courriel || "aucun courriel"} · {choisi.detail}
                    </p>
                    {source && source.famille.length > 0 && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {source.famille.length} proche(s) connu(s) — ajoutables comme parties.
                      </p>
                    )}
                  </div>
                  <button type="button" onClick={() => { setChoisi(null); setSource(null) }}
                    className="text-[11px] font-bold text-muted-foreground hover:text-foreground cursor-pointer shrink-0">
                    Changer
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input value={recherche} onChange={(e) => setRecherche(e.target.value)}
                    placeholder="Rechercher un prospect ou un client…"
                    aria-label="Rechercher un contractant"
                    className={cn(CHAMP, "pl-9 placeholder:text-foreground/55")} />
                  {trouves.length > 0 && (
                    <ul className="mt-2 rounded-xl border border-border divide-y divide-border overflow-hidden">
                      {trouves.map((t) => (
                        <li key={`${t.type}-${t.id}`}>
                          <button type="button" onClick={() => choisir(t)}
                            className="w-full text-left px-3 py-2 hover:bg-muted cursor-pointer">
                            <span className="text-xs font-bold text-foreground">{t.nom}</span>
                            <span className="block text-[11px] text-muted-foreground">
                              {t.type === "client" ? "Client" : "Prospect"} · {t.courriel || "aucun courriel"} · {t.detail}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </section>
            )}

            {/* Section spécifique Consultation Initiale : Durée et Honoraires configurables */}
            {isConsultation && (
              <section className="space-y-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-primary">
                    Paramètres de la consultation
                  </h3>
                </div>

                {/* 1. Durée de la consultation */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-foreground block">
                    Durée de la consultation
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {DUREES_PREDEFINIES.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          setDureeMinutes(d)
                          setEstDureePerso(false)
                        }}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer border",
                          !estDureePerso && dureeMinutes === d
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-border text-foreground hover:bg-muted"
                        )}
                      >
                        {d} min
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setEstDureePerso(true)}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer border",
                        estDureePerso
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border text-foreground hover:bg-muted"
                      )}
                    >
                      Autre durée
                    </button>
                  </div>
                  {estDureePerso && (
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        type="number"
                        min="5"
                        max="480"
                        step="5"
                        placeholder="Ex: 75"
                        value={dureePersonnalisee}
                        onChange={(e) => setDureePersonnalisee(e.target.value)}
                        className={cn(CHAMP, "w-32")}
                      />
                      <span className="text-xs text-muted-foreground font-semibold">minutes</span>
                    </div>
                  )}
                </div>

                {/* 2. Honoraires (si non pro bono) */}
                {!proBono && (
                  <div className="space-y-1.5 border-t border-border/60 pt-3">
                    <label className="text-[11px] font-bold text-foreground block">
                      Honoraires de la consultation ($ CAD)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={honoraires}
                      onChange={(e) => setHonoraires(e.target.value)}
                      placeholder="150.00"
                      className={cn(CHAMP, "font-mono")}
                    />
                    <p className="text-[10px] text-muted-foreground">
                      La durée et les honoraires sont deux paramètres indépendants configurables par le consultant.
                    </p>
                  </div>
                )}

                {/* 3. Modalités du rendez-vous (optionnel) */}
                <div className="grid gap-3 sm:grid-cols-2 border-t border-border/60 pt-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Date & Heure (optionnel)
                    </label>
                    <input
                      type="datetime-local"
                      value={dateHeure}
                      onChange={(e) => setDateHeure(e.target.value)}
                      className={CHAMP}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Video className="h-3 w-3" /> Mode de rencontre
                    </label>
                    <select
                      value={modeConsultation}
                      onChange={(e) => setModeConsultation(e.target.value)}
                      className={CHAMP}
                    >
                      <option value="visioconférence (Zoom, Teams, Google Meet)">Visioconférence (Zoom, Teams, Meet)</option>
                      <option value="en personne aux bureaux du cabinet">En personne aux bureaux</option>
                      <option value="téléphone">Téléphone</option>
                      <option value="courriel (échange écrit)">Courriel (échange écrit)</option>
                    </select>
                  </div>
                </div>
              </section>
            )}

            {/* Honoraires pour mandat régulier */}
            {!isConsultation && !proBono && (
              <section>
                <h3 className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-2">
                  {reprise ? "Les honoraires" : "3. Les honoraires"}
                </h3>
                <input type="number" min="0" step="0.01" value={honoraires}
                  onChange={(e) => setHonoraires(e.target.value)}
                  placeholder="4500.00" aria-label="Honoraires"
                  className={cn(CHAMP, "font-mono")} />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Les taxes seront calculées d&apos;après vos Paramètres à l&apos;émission.
                </p>
              </section>
            )}

            {modele && (
              <section>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                    {proBono ? "3" : "4"}. Les articles ({articles.filter((a) => a.enabled).length}/{articles.length})
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setNomNouveauModele(modele?.titre ? `${modele.titre} (Personnalisé)` : "Mon modèle personnalisé")
                        setDescNouveauModele("Modèle avec clauses personnalisées réutilisable pour le cabinet")
                        setErreurSauvegardeModele(null)
                        setModalSauvegardeModele(true)
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:text-primary/80 px-2 py-1 rounded-lg border border-primary/30 bg-primary/5 hover:bg-primary/10 cursor-pointer"
                      title="Sauvegarder cette sélection et ce texte d'articles comme modèle réutilisable"
                    >
                      <BookmarkPlus className="h-3.5 w-3.5" />
                      Sauvegarder comme modèle
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground mb-2.5">
                  Vous pouvez cocher ou décocher n&apos;importe quel article. La numérotation s&apos;ajuste automatiquement sans saut de numéro.
                </p>
                <ul className="space-y-2">
                  {articles.map((a, i) => {
                    const renum = articlesRenumerotes.find((x) => x.code === a.code)
                    const titreAffiche = a.enabled ? (renum?.titleFr ?? a.titleFr) : a.titleFr

                    return (
                      <li key={a.code}
                        className={cn(
                          "rounded-xl border transition-all overflow-hidden",
                          !a.enabled ? "opacity-50 border-border bg-muted/20" : "border-border bg-card"
                        )}>
                        <div className="flex items-center gap-2 p-2.5">
                          <input
                            type="checkbox"
                            checked={a.enabled}
                            aria-label={`Inclure « ${titreAffiche} »`}
                            onChange={(e) =>
                              setArticles((p) =>
                                p.map((x, k) => (k === i ? { ...x, enabled: e.target.checked } : x))
                              )
                            }
                            className="h-4 w-4 rounded border-border cursor-pointer accent-primary"
                          />
                          <span className={cn("flex-1 text-xs font-bold truncate", a.enabled ? "text-foreground" : "text-muted-foreground line-through")}>
                            {titreAffiche}
                          </span>
                          {a.level === "structural" && (
                            <span title="Clause recommandée Code CICC" className="inline-flex items-center gap-1 text-[10px] font-bold text-primary px-1.5 py-0.5 rounded bg-primary/10">
                              <ShieldCheck className="h-3 w-3" /> CICC
                            </span>
                          )}
                          <button
                            type="button"
                            aria-label="Modifier le texte"
                            onClick={() => setEditeArticleCode(editeArticleCode === a.code ? null : a.code)}
                            className={cn(
                              "p-1.5 rounded-lg border text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer",
                              editeArticleCode === a.code
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                            title="Modifier le texte de cette clause dans le brouillon"
                          >
                            <Edit3 className="h-3 w-3" />
                            <span className="text-[10px]">Modifier</span>
                          </button>
                          <button type="button" aria-label="Monter" disabled={i === 0}
                            onClick={() => deplacer(i, i - 1)}
                            className="p-1 rounded hover:bg-muted text-muted-foreground disabled:opacity-30 cursor-pointer">
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" aria-label="Descendre" disabled={i === articles.length - 1}
                            onClick={() => deplacer(i, i + 1)}
                            className="p-1 rounded hover:bg-muted text-muted-foreground disabled:opacity-30 cursor-pointer">
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Éditeur dépliable pour personnaliser le texte de la clause */}
                        {editeArticleCode === a.code && (
                          <div className="p-3 border-t border-border/60 bg-background/80 space-y-2.5 animate-in fade-in duration-200">
                            <div>
                              <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block mb-1">
                                Titre de la clause
                              </label>
                              <input
                                type="text"
                                className={CHAMP}
                                value={a.titleFr}
                                onChange={(e) => {
                                  const val = e.target.value
                                  setArticles((p) => p.map((x, k) => (k === i ? { ...x, titleFr: val } : x)))
                                }}
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block mb-1">
                                Texte de la clause
                              </label>
                              <textarea
                                rows={6}
                                className={CHAMP}
                                value={a.bodyFr}
                                onChange={(e) => {
                                  const val = e.target.value
                                  setArticles((p) => p.map((x, k) => (k === i ? { ...x, bodyFr: val } : x)))
                                }}
                              />
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                              Les variables entre doubles accolades (ex : {`{{nom_consultant}}`}, {`{{nom_complet_client}}`}, {`{{duree_consultation}}`}, {`{{honoraires}}`}) sont substituées automatiquement dans l&apos;aperçu et sur le document final.
                            </p>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}

            {modele && (
              <section className="border-t border-border pt-4">
                <h3 className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-3">
                  {isConsultation ? "Précisions sur la consultation" : "Personnaliser le contrat"}
                </h3>
                <EditeurContenu
                  contenu={contenu}
                  onChange={setContenu}
                  honoraires={Number(honoraires) || 0}
                  proBono={proBono}
                  isConsultation={isConsultation}
                />
              </section>
            )}
          </div>

          {/* ---------------- Aperçu ---------------- */}
          <div className="p-5 bg-muted/20">
            <h3 className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-3">
              Aperçu en temps réel
            </h3>
            {!source ? (
              <div className="rounded-xl border border-dashed border-border px-6 py-14 text-center">
                <FileText className="mx-auto h-7 w-7 text-muted-foreground/70" />
                <p className="mt-2 text-xs font-bold text-foreground">L&apos;aperçu attend un contractant</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Les informations du prospect ou du client rempliront le contrat.
                </p>
              </div>
            ) : (
              <article className="rounded-xl border border-border bg-card p-5 space-y-4 text-foreground shadow-sm">
                <header className="border-b border-border pb-3 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-black">{modele?.titre}</h4>
                    <p className="text-[10px] text-muted-foreground">Initial Immigration Consultation Agreement</p>
                  </div>
                  {isConsultation && (
                    <span className="text-[11px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {effDuree} min
                    </span>
                  )}
                </header>

                {blocs && choisi && (
                  <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                    <p className="text-[11px] text-muted-foreground">
                      Une erreur dans les coordonnées ? La correction s&apos;applique à la fiche.
                    </p>
                    <button
                      type="button"
                      onClick={() => setFicheAModifier(true)}
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] font-bold text-foreground hover:bg-muted cursor-pointer"
                    >
                      <User className="h-3 w-3" />
                      Modifier la fiche {choisi.type === "client" ? "client" : "prospect"}
                    </button>
                  </div>
                )}

                {blocs && (
                  <div className="grid gap-3 sm:grid-cols-2 border-b border-border pb-4">
                    {([
                      { cle: "consultant", titre: "Consultant réglementé / RCIC", Icone: Building2, d: blocs.consultant },
                      { cle: "client", titre: "Client potentiel / The Client", Icone: User, d: blocs.client },
                    ] as const).map(({ cle, titre, Icone, d }) => (
                      <div key={cle} className="rounded-lg border border-border bg-muted/30 p-3">
                        <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                          <Icone className="h-3 w-3" /> {titre}
                        </p>
                        <p className="mt-1.5 text-xs font-black">{d.nom || "—"}</p>
                        {d.organisation && d.organisation !== d.nom && (
                          <p className="text-[11px] font-bold">{d.organisation}</p>
                        )}
                        {d.permis && (
                          <p className="text-[11px] font-semibold">Permis CRIC {d.permis}</p>
                        )}
                        {d.adresse.map((l) => (
                          <p key={l} className="text-[11px] text-muted-foreground">{l}</p>
                        ))}
                        {d.telephone && <p className="text-[11px] text-muted-foreground">Tél. {d.telephone}</p>}
                        {d.courriel && <p className="text-[11px] text-muted-foreground">{d.courriel}</p>}
                      </div>
                    ))}
                  </div>
                )}

                {controle && !controle.ok && (
                  <div className="rounded-lg border border-warning/40 bg-warning/10 p-3">
                    <p className="flex items-center gap-1.5 text-xs font-black text-warning-strong">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {controle.profilACompleter
                        ? "Adresse professionnelle incomplète"
                        : "Renseignements manquants"}
                    </p>
                    <ul className="mt-1.5 space-y-0.5">
                      {controle.manquants.map((mq) => (
                        <li key={mq} className="text-[11px] text-foreground">{mq}</li>
                      ))}
                    </ul>
                    {controle.profilACompleter && (
                      <Link
                        href="/fr/settings"
                        className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-warning-strong/10 px-2.5 py-1.5 text-[11px] font-bold text-warning-strong hover:bg-warning-strong/20"
                      >
                        <Settings className="h-3 w-3" /> Compléter mon profil
                      </Link>
                    )}
                  </div>
                )}

                {apercu.map((a) => (
                  <section key={a.code} className="space-y-1">
                    <h5 className="text-xs font-black text-foreground">{a.titre}</h5>
                    <p className="text-[11px] text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {a.corps}
                    </p>
                  </section>
                ))}

                {/* SECTION SIGNATURES DES DEUX PARTIES */}
                <div className="pt-4 border-t-2 border-border/80 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-foreground">
                    <PenTool className="h-3.5 w-3.5 text-primary" />
                    <span>Signatures des parties</span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {/* Consultant */}
                    <div className="rounded-xl border border-border bg-muted/30 p-3.5 space-y-3 flex flex-col justify-between">
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-wider text-primary px-2 py-0.5 rounded bg-primary/10 inline-block mb-1.5">
                          Le consultant en immigration réglementé
                        </span>
                        <p className="text-xs font-black text-foreground">
                          {blocs?.consultant.nom || "Adama Diarra"}
                        </p>
                        {blocs?.consultant.permis && (
                          <p className="text-[11px] font-semibold text-muted-foreground">
                            Permis CRIC : {blocs.consultant.permis}
                          </p>
                        )}
                        {blocs?.consultant.organisation && (
                          <p className="text-[11px] text-muted-foreground">{blocs.consultant.organisation}</p>
                        )}
                      </div>
                      <div className="pt-3 border-t border-dashed border-border/80 text-[11px] text-muted-foreground space-y-1">
                        <p className="text-[10px]">Date : __________________________</p>
                        <p className="text-[10px] italic">Signature du consultant</p>
                      </div>
                    </div>

                    {/* Client */}
                    <div className="rounded-xl border border-border bg-muted/30 p-3.5 space-y-3 flex flex-col justify-between">
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-wider text-foreground/80 px-2 py-0.5 rounded bg-muted inline-block mb-1.5">
                          Le/La Client(e)
                        </span>
                        <p className="text-xs font-black text-foreground">
                          {blocs?.client.nom || choisi?.nom || "Client potentiel"}
                        </p>
                        {blocs?.client.courriel && (
                          <p className="text-[11px] text-muted-foreground">{blocs.client.courriel}</p>
                        )}
                        {blocs?.client.telephone && (
                          <p className="text-[11px] text-muted-foreground">Tél : {blocs.client.telephone}</p>
                        )}
                      </div>
                      <div className="pt-3 border-t border-dashed border-border/80 text-[11px] text-muted-foreground space-y-1">
                        <p className="text-[10px]">Date : __________________________</p>
                        <p className="text-[10px] italic">Signature du/de la client(e)</p>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            )}
          </div>
        </div>

        {resultat && (
          <div className={cn(
            "mx-5 mb-3 rounded-xl border p-3 text-xs font-bold flex items-start gap-2",
            resultat.ok
              ? "border-success/40 bg-success/10 text-success-strong"
              : "border-error/40 bg-error/10 text-error-strong"
          )}>
            {resultat.ok ? <Check className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
            <span>{resultat.message}</span>
          </div>
        )}

        <footer className="p-5 border-t border-border flex items-center justify-between gap-2">
          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" />
            {reprise
              ? "Tant qu'elle est un brouillon, elle reste modifiable. Une fois émise, elle est figée."
              : "Le brouillon reste modifiable. Vous pouvez adapter les clauses avant l'émission."}
          </p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onFerme}
              className="px-4 py-2 rounded-xl border border-border font-bold text-xs hover:bg-muted cursor-pointer text-foreground">
              Annuler
            </button>
            <button type="button" disabled={!modele || !choisi || enCours || chargement} onClick={enregistrer}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 disabled:opacity-40 cursor-pointer">
              <FileText className="h-4 w-4" />
              {enCours
                ? (reprise ? "Enregistrement…" : "Création…")
                : reprise ? "Enregistrer les modifications" : "Créer le brouillon"}
            </button>
          </div>
        </footer>
      </div>

      {/* Modal Sauvegarder comme modèle personnalisé réutilisable */}
      {modalSauvegardeModele && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-foreground/60 p-4 animate-in fade-in">
          <div className="bg-card w-full max-w-md rounded-2xl border border-border p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookmarkPlus className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-black text-foreground">Sauvegarder comme modèle</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalSauvegardeModele(false)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              Ce modèle enregistrera votre sélection actuelle d&apos;articles ({articles.filter(a => a.enabled).length} articles actifs) et vos personnalisations de texte pour être réutilisé à volonté par votre cabinet.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-foreground block mb-1">
                  Nom du modèle <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={nomNouveauModele}
                  onChange={(e) => setNomNouveauModele(e.target.value)}
                  placeholder="Ex: Consultation Express 45 min"
                  className={CHAMP}
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-foreground block mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={descNouveauModele}
                  onChange={(e) => setDescNouveauModele(e.target.value)}
                  placeholder="Ex: Consultation avec clauses spécifiques adaptées au cabinet"
                  className={CHAMP}
                />
              </div>

              {erreurSauvegardeModele && (
                <div className="rounded-xl border border-error/40 bg-error/10 p-2.5 text-xs text-error-strong font-bold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{erreurSauvegardeModele}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setModalSauvegardeModele(false)}
                className="px-3 py-1.5 rounded-xl border border-border text-xs font-bold hover:bg-muted cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={!nomNouveauModele.trim() || sauvegardeEnCours}
                onClick={sauvegarderModele}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-40 cursor-pointer"
              >
                <BookmarkPlus className="h-4 w-4" />
                {sauvegardeEnCours ? "Enregistrement…" : "Enregistrer le modèle"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmation de Suppression de Modèle Personnalisé */}
      {modeleASupprimer && (
        <div className="fixed inset-0 z-[230] flex items-center justify-center bg-foreground/60 p-4 animate-in fade-in">
          <div className="bg-card w-full max-w-sm rounded-2xl border border-border p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="text-sm font-black">Supprimer ce modèle ?</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Êtes-vous sûr de vouloir supprimer définitivement le modèle <strong className="text-foreground">« {modeleASupprimer.titre} »</strong> ? Les contrats déjà émis ne seront pas affectés.
            </p>
            {erreurSuppression && (
              <div className="rounded-xl border border-error/40 bg-error/10 p-2.5 text-xs text-error-strong font-bold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{erreurSuppression}</span>
              </div>
            )}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => {
                  setModeleASupprimer(null)
                  setErreurSuppression(null)
                }}
                className="px-3 py-1.5 rounded-xl border border-border text-xs font-bold hover:bg-muted cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={suppressionEnCours}
                onClick={async () => {
                  setSuppressionEnCours(true)
                  setErreurSuppression(null)
                  try {
                    const r = await supprimerModelePersonnalise(modeleASupprimer.id)
                    if (r.ok) {
                      if (modele?.id === modeleASupprimer.id) {
                        setModele(null)
                        setArticles([])
                      }
                      router.refresh()
                      const misAJour = await listerModelesEntente()
                      setModelesAjoutes(misAJour)
                      setModeleASupprimer(null)
                      setResultat(r)
                    } else {
                      setErreurSuppression(r.message)
                    }
                  } finally {
                    setSuppressionEnCours(false)
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-destructive text-destructive-foreground text-xs font-bold hover:bg-destructive/90 disabled:opacity-40 cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
                {suppressionEnCours ? "Suppression…" : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {ficheAModifier && choisi && (
        <ModifierFiche
          type={choisi.type}
          id={choisi.id}
          nomAffiche={choisi.nom}
          onFerme={() => setFicheAModifier(false)}
          onEnregistre={async () => {
            setSource(await preremplir(choisi.type, choisi.id))
          }}
        />
      )}
    </div>
  )
}
