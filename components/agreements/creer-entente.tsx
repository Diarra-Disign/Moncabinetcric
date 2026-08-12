"use client"

import * as React from "react"
import {
  Search, X, FileText, Check, ArrowUp, ArrowDown, Lock, AlertTriangle, User,
  Building2, Settings,
} from "lucide-react"
import Link from "next/link"
import { ModifierFiche } from "@/components/fiche/fiche-formulaire"
import { EditeurContenu, CONTENU_VIDE, type ContenuContrat } from "./editeur-contenu"
import { verifierEcheancier } from "@/lib/ententes/echeancier"
import {
  rechercherContractant, preremplir, articlesDuModele, creerEntente,
  chargerBrouillon, modifierBrouillon,
  type ArticleEntente,
} from "@/lib/data/ententes-actions"
import {
  variablesDe, substituer, verifierAvantGeneration,
  lignesAdresseCabinet, adresseDuContractant,
} from "@/lib/ententes/variables"
import { lignesAdresse } from "@/lib/data/adresse"
import { nomAvecCivilite } from "@/lib/data/identite"
import { cn } from "@/lib/utils"

/**
 * Créer une entente : modèle → contractant → articles → aperçu.
 *
 * L'APERÇU EMPLOIE LE MÊME MODULE QUE LE SERVEUR. variables.ts est pur — ni
 * « server-only », ni accès base — précisément pour que ce qui s'affiche ici
 * soit ce que le PDF composera. Deux implémentations donneraient un aperçu qui
 * ne correspond pas au document envoyé, et c'est l'écart qu'on ne découvre
 * qu'après l'avoir envoyé.
 *
 * LES ARTICLES STRUCTURELS NE SE DÉCOCHENT PAS. Ce ne sont pas ceux qui sont
 * « validés » : ce sont ceux dont l'absence rendrait l'entente incomplète pour
 * un consultant réglementé — portée du mandat, absence de garantie de
 * résultat, recours au Collège, protection des renseignements personnels. Le
 * cadenas le dit à l'écran plutôt que de laisser découvrir le refus après coup.
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

export function CreerEntente({
  modeles,
  onFerme,
  brouillonId,
}: {
  modeles: Modele[]
  onFerme: () => void
  /**
   * Rouvre un brouillon existant (§25).
   *
   * LE MÊME ÉCRAN sert à créer et à reprendre. Un second écran d'édition
   * aurait divergé au premier champ ajouté — c'est déjà arrivé entre la
   * création et la modification d'une fiche client, et le remède avait été le
   * même : un composant, deux modes.
   *
   * Ce qui NE se reprend pas : le contractant et le modèle. Ils définissent
   * l'identité du document ; les changer reviendrait à faire un autre contrat
   * sous le même numéro.
   */
  brouillonId?: string
}) {
  const reprise = Boolean(brouillonId)
  const [modele, setModele] = React.useState<Modele | null>(null)
  const [recherche, setRecherche] = React.useState("")
  const [trouves, setTrouves] = React.useState<Trouve[]>([])
  const [choisi, setChoisi] = React.useState<Trouve | null>(null)
  const [source, setSource] = React.useState<Prerempli>(null)
  const [articles, setArticles] = React.useState<ArticleEntente[]>([])
  const [honoraires, setHonoraires] = React.useState("")
  const [enCours, setEnCours] = React.useState(false)
  const [resultat, setResultat] = React.useState<{ ok: boolean; message: string } | null>(null)
  // §9 : corriger la fiche sans quitter le contrat en préparation.
  const [ficheAModifier, setFicheAModifier] = React.useState(false)
  /** Le contenu personnalisé du brouillon : services, échéancier, conditions. */
  const [contenu, setContenu] = React.useState<ContenuContrat>(CONTENU_VIDE)
  const [chargement, setChargement] = React.useState(Boolean(brouillonId))
  /** La référence du brouillon repris, pour l'annoncer en tête. */
  const [reference, setReference] = React.useState("")

  const proBono = (modele?.kind ?? "").includes("probono")

  /**
   * Reprise d'un brouillon : tout est relu EN BASE, jamais reçu de la liste.
   *
   * Une liste affichée il y a dix minutes montre l'état d'il y a dix minutes.
   * Rouvrir dessus ferait réenregistrer des valeurs périmées par-dessus celles
   * d'un confrère — le même raisonnement que pour la fiche client.
   */
  React.useEffect(() => {
    if (!brouillonId) return
    let vivant = true
    ;(async () => {
      const b = await chargerBrouillon(brouillonId)
      if (!vivant || !b) { setChargement(false); return }

      setReference(b.reference)
      setHonoraires(String(b.honoraires || ""))
      // LE TITRE DU CONTRAT, pas celui du modèle. Un contrat porte son propre
      // objet — « Permis de travail » — même s'il est né d'un modèle intitulé
      // « Entente de consultation initiale ». Afficher le second ferait croire
      // qu'on a rouvert le mauvais document.
      const trouve = modeles.find((m) => m.id === b.templateId)
      setModele(trouve ? { ...trouve, titre: b.titre } : {
        // Le modèle a pu être supprimé depuis. Le contrat, lui, garde ses
        // articles : on reconstitue juste ce qu'il faut pour l'afficher.
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
      // Le contractant est relu pour que l'aperçu et les deux blocs
      // d'identification restent exacts.
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
  }, [brouillonId, modeles])

  // La recherche est temporisée : sans cela « Diallo » enverrait six requêtes,
  // et les réponses reviendraient dans le désordre.
  React.useEffect(() => {
    if (recherche.trim().length < 2) { setTrouves([]); return }
    const t = setTimeout(async () => setTrouves(await rechercherContractant(recherche)), 250)
    return () => clearTimeout(t)
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
    }
  }, [source, honoraires, modele, proBono])

  /** L'aperçu, composé exactement comme le sera le PDF. */
  const apercu = React.useMemo(() => {
    if (!contexte) return []
    const variables = variablesDe(contexte)
    return articles.filter((a) => a.enabled).map((a) => ({
      code: a.code,
      titre: substituer(a.titleFr, variables).texte,
      corps: substituer(a.bodyFr, variables).texte,
    }))
  }, [contexte, articles])

  /**
   * Le contrôle du §29 joué À L'ÉCRAN, avec la MÊME fonction que le serveur.
   *
   * Il ne remplace pas celui de l'action — l'action reste la frontière, et elle
   * est appelable sans cet écran. Il évite au consultant de composer un contrat
   * entier pour se voir refuser à la dernière seconde, et il dit OÙ corriger.
   */
  const controle = React.useMemo(() => {
    if (!contexte) return null
    const base = verifierAvantGeneration(
      contexte,
      articles.filter((a) => a.enabled).map((a) => `${a.titleFr}\n${a.bodyFr}`)
    )
    // L'échéancier est contrôlé par la MÊME fonction que le serveur : un
    // second calcul aurait fini par accepter ici ce que l'action refuse.
    const echeancier = verifierEcheancier(
      contenu.echeancier, Number(honoraires) || 0, proBono
    )
    if (base.ok && echeancier.length === 0) return base
    return {
      ok: false as const,
      manquants: [...(base.ok ? [] : base.manquants), ...echeancier],
      profilACompleter: base.ok ? false : base.profilACompleter,
    }
  }, [contexte, articles, contenu.echeancier, honoraires, proBono])

  /** Les deux blocs du §8, tels qu'ils s'imprimeront. */
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
      // §24 — reprendre un brouillon réenregistre son CONTENU et ses montants.
      // Ni le contractant ni le modèle : ils font l'identité du document.
      if (brouillonId) {
        const r = await modifierBrouillon(brouillonId, {
          honoraires: Number(honoraires) || 0,
          taxes: 0,
          proBono,
          servicesDescription: contenu.servicesDescription,
          servicesItems: contenu.servicesItems,
          echeancier: contenu.echeancier,
          modesPaiement: contenu.modesPaiement,
          conditionsPaiement: contenu.conditionsPaiement,
          fraisNonInclus: contenu.fraisNonInclus,
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
        articles,
        servicesDescription: contenu.servicesDescription,
        servicesItems: contenu.servicesItems,
        echeancier: contenu.echeancier,
        modesPaiement: contenu.modesPaiement,
        conditionsPaiement: contenu.conditionsPaiement,
        fraisNonInclus: contenu.fraisNonInclus,
      })
      setResultat(r)
      if (r.ok) setTimeout(onFerme, 1400)
    } finally {
      setEnCours(false)
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
            {/* Le MODÈLE et le CONTRACTANT ne s'affichent qu'à la création.
                En reprise, ils sont figés : les changer reviendrait à faire un
                autre contrat sous le même numéro. Les montrer sans pouvoir les
                changer ferait chercher pourquoi ils ne réagissent pas. */}
            {!reprise && (
            <section>
              <h3 className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-2">
                1. Le modèle
              </h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {modeles.map((m) => (
                  <button key={m.id} type="button" onClick={() => setModele(m)}
                    className={cn(
                      "text-left rounded-xl border p-3 transition-colors cursor-pointer",
                      modele?.id === m.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:bg-muted"
                    )}>
                    <span className="block text-xs font-black text-foreground">{m.titre}</span>
                    <span className="block text-[11px] text-muted-foreground mt-0.5">{m.description}</span>
                    {!m.duCabinet && (
                      <span className="mt-1 inline-block text-[10px] font-bold text-muted-foreground">
                        Modèle fourni
                      </span>
                    )}
                  </button>
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

            {!proBono && (
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
                <h3 className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-2">
                  {proBono ? "3" : "4"}. Les articles ({articles.filter((a) => a.enabled).length}/{articles.length})
                </h3>
                <ul className="space-y-1.5">
                  {articles.map((a, i) => (
                    <li key={a.code}
                      className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                      <input type="checkbox" checked={a.enabled}
                        disabled={a.level === "structural"}
                        aria-label={`Inclure « ${a.titleFr} »`}
                        onChange={(e) => setArticles((p) =>
                          p.map((x, k) => (k === i ? { ...x, enabled: e.target.checked } : x)))} />
                      <span className="flex-1 text-xs font-bold text-foreground truncate">{a.titleFr}</span>
                      {a.level === "structural" && (
                        <span title="Article indispensable à une entente réglementée">
                          <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                        </span>
                      )}
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
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* ---------------- Personnalisation du brouillon (§2) ----------
                Elle vient APRÈS les articles : le modèle sert de point de
                départ, la personnalisation vient ensuite (§16). */}
            {modele && (
              <section className="border-t border-border pt-4">
                <h3 className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-3">
                  Personnaliser le contrat
                </h3>
                <EditeurContenu
                  contenu={contenu}
                  onChange={setContenu}
                  honoraires={Number(honoraires) || 0}
                  proBono={proBono}
                />
              </section>
            )}
          </div>

          {/* ---------------- Aperçu ---------------- */}
          <div className="p-5 bg-muted/20">
            <h3 className="text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-3">
              Aperçu
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
              <article className="rounded-xl border border-border bg-card p-5 space-y-4 text-foreground">
                <header className="border-b border-border pb-3">
                  <h4 className="text-sm font-black">{modele?.titre}</h4>
                </header>

                {/* LES DEUX JEUX DE DONNÉES, VISIBLES AVANT LA GÉNÉRATION (§9).
                    Côte à côte et séparés : le consultant doit pouvoir vérifier
                    d'un regard que rien ne s'est mélangé. */}
                {blocs && choisi && (
                  <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                    {/* §9 ET §10 : le bouton dit CE QU'IL MODIFIE. Un
                        « Modifier » nu laisserait croire qu'on ne retouche que
                        ce contrat-ci, alors qu'on écrit dans le CRM. */}
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
                      { cle: "consultant", titre: "Consultant / Représentant", Icone: Building2, d: blocs.consultant },
                      { cle: "client", titre: "Client / Contractant", Icone: User, d: blocs.client },
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
                        {/* Aucune ligne vide (§4) : ce qui manque ne s'affiche
                            pas, et son absence se voit dans le contrôle. */}
                        {d.adresse.map((l) => (
                          <p key={l} className="text-[11px] text-muted-foreground">{l}</p>
                        ))}
                        {d.telephone && <p className="text-[11px] text-muted-foreground">Tél. {d.telephone}</p>}
                        {d.courriel && <p className="text-[11px] text-muted-foreground">{d.courriel}</p>}
                      </div>
                    ))}
                  </div>
                )}

                {/* §5 — le refus dit CE qui manque, et mène OÙ le corriger. */}
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
                {apercu.map((a, i) => (
                  <section key={a.code}>
                    <h5 className="text-xs font-black">{i + 1}. {a.titre}</h5>
                    <p className="text-[11px] text-muted-foreground whitespace-pre-wrap mt-1 leading-relaxed">
                      {a.corps}
                    </p>
                  </section>
                ))}
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
              : "Le brouillon reste modifiable. Rien n'est envoyé à cette étape."}
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
                : reprise ? "Enregistrer le brouillon" : "Créer le brouillon"}
            </button>
          </div>
        </footer>
      </div>
      {/* Le MÊME formulaire que partout ailleurs. Après enregistrement, le
          pré-remplissage est relu : le contrat en préparation prend la
          correction, et l'aperçu la montre immédiatement. */}
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
