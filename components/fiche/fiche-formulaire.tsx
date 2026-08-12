"use client"

import * as React from "react"
import {
  X, Loader2, Check, AlertTriangle, User, Phone, MapPin, FileText, Clock, ChevronDown,
} from "lucide-react"
import { modifierFiche, creerFiche, chargerFiche, journalFiche } from "@/lib/data/fiche-actions"
import {
  CHAMPS_SENSIBLES, libelleChamp, valider,
  type ChampsFiche, type EntreeJournal,
} from "@/lib/data/fiche-criteres"
import { SelecteurCivilite } from "@/components/ui/civilite"
import { ChampsAdresse, type ValeursAdresse } from "@/components/ui/adresse-postale"
import { PROGRAM_GROUPS } from "@/lib/data/services-immigration"
import { type Civilite } from "@/lib/data/identite"
import { cn } from "@/lib/utils"

/**
 * Le formulaire d'une fiche client ou prospect — CRÉATION ET MODIFICATION.
 *
 * UN SEUL COMPOSANT, DEUX MODES, et c'est le §17. La création et la
 * modification avaient chacune leur écran, et ils avaient DÉJÀ divergé : la
 * création acceptait une adresse quand la modification n'existait pas, puis la
 * modification a gagné le nom légal, la date de naissance et les seconds
 * moyens de contact que la création ignorait encore. Deux écrans pour une même
 * fiche ne restent jamais d'accord ; celui qu'on ouvre le moins souvent finit
 * par perdre un champ.
 *
 * La seule différence entre les deux modes est le CONTEXTE : en modification,
 * la fiche est relue et les champs arrivent remplis ; en création, ils sont
 * vides. Le reste — sections, espacements, boutons, validation — est
 * strictement le même code, donc ne peut pas diverger.
 *
 * UN SEUL FORMULAIRE POUR LES TROIS PORTES — Clients, Prospects, Dossier. Le
 * §8 le demande, et la raison n'est pas l'économie : trois formulaires
 * finiraient par appliquer trois règles. Celui qui journalise, celui qui
 * oublie, et celui qui ne propose pas le code postal. Le consultant, lui,
 * verrait un même geste donner trois résultats selon l'écran d'où il est parti.
 *
 * LA FICHE EST RELUE À L'OUVERTURE, jamais reçue de l'écran appelant. Une liste
 * affichée il y a dix minutes montre l'état d'il y a dix minutes ; ouvrir le
 * formulaire dessus ferait réenregistrer des valeurs périmées par-dessus celles
 * d'un confrère.
 *
 * LA CONFIRMATION N'EST PAS UNE POLITESSE (§7). Elle ne se déclenche que sur
 * les champs qui S'IMPRIMENT sur un document opposable, et elle dit ce qui
 * change : « Ville : Montréal → Gatineau ». Une confirmation générique — « êtes
 * vous sûr ? » — s'apprend à cliquer sans lire.
 */

type Type = "client" | "lead"

const CHAMP =
  "w-full px-3.5 py-2.5 text-xs font-medium rounded-xl bg-muted/50 border border-border " +
  "focus:bg-card focus:border-primary focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-primary transition-all text-foreground"
const ETIQUETTE = "text-[11px] font-bold text-muted-foreground"
const CHAMP_FAUTIF = "border-error focus:border-error focus-visible:ring-error"

/** L'état de départ d'une création. Hors du composant : une constante recréée
 *  à chaque rendu ferait repartir l'état d'initialisation à zéro. */
const DEPART_CREATION: ChampsFiche = { country: "Canada", type: "b2c", client_type: "individual" }

const dateLisible = (v: string) => {
  const d = new Date(v)
  return Number.isNaN(d.getTime())
    ? v
    : d.toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" }) +
      " à " + d.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })
}

export function FicheFormulaire({
  mode = "edit",
  type,
  id,
  nomAffiche,
  onFerme,
  onEnregistre,
}: {
  /** « edit » relit la fiche ; « create » ouvre sur des champs vides. */
  mode?: "create" | "edit"
  type: Type
  /** Requis en modification, absent en création. */
  id?: string
  /** Le nom tel que l'écran appelant l'affiche — pour le titre, avant chargement. */
  nomAffiche?: string
  onFerme: () => void
  onEnregistre?: (message: string, id?: string) => void
}) {
  const creation = mode === "create"
  const [chargement, setChargement] = React.useState(mode === "edit")
  // L'état de départ d'une CRÉATION est posé à l'initialisation, pas dans un
  // effet : un effet qui appelle setState provoque un second rendu pour rien,
  // et React le signale à juste titre. Le pays part sur « Canada », seule
  // valeur qu'on puisse proposer sans rien inventer.
  const [initial, setInitial] = React.useState<ChampsFiche | null>(
    mode === "create" ? DEPART_CREATION : null
  )
  const [valeurs, setValeurs] = React.useState<ChampsFiche>(
    mode === "create" ? DEPART_CREATION : {}
  )
  const [journal, setJournal] = React.useState<EntreeJournal[]>([])
  const [journalOuvert, setJournalOuvert] = React.useState(false)
  const [enCours, setEnCours] = React.useState(false)
  const [aConfirmer, setAConfirmer] = React.useState(false)
  const [resultat, setResultat] = React.useState<{ ok: boolean; message: string } | null>(null)
  /** §12 : on ne montre l'erreur d'un champ qu'APRÈS l'avoir quitté. Signaler
   *  « courriel incomplet » sur la première lettre tapée est du harcèlement. */
  const [touches, setTouches] = React.useState<Set<string>>(new Set())
  /** §15 : fermer avec des saisies non enregistrées demande confirmation. */
  const [sortieAConfirmer, setSortieAConfirmer] = React.useState(false)

  React.useEffect(() => {
    // Rien à relire en création : l'état de départ est déjà posé, et c'est lui
    // qui sert à savoir si quelque chose a été saisi — donc à demander
    // confirmation avant de fermer (§15).
    if (creation || !id) return
    let vivant = true
    ;(async () => {
      const [fiche, entrees] = await Promise.all([chargerFiche(type, id), journalFiche(type, id)])
      if (!vivant) return
      setInitial(fiche ?? {})
      setValeurs(fiche ?? {})
      setJournal(entrees)
      setChargement(false)
    })()
    return () => { vivant = false }
  }, [type, id, creation])

  const maj = (champ: keyof ChampsFiche, v: string | null) =>
    setValeurs((p) => ({ ...p, [champ]: v }))

  const estEntreprise =
    type === "client" ? valeurs.client_type === "employer" : valeurs.type === "b2b"

  const adresse: ValeursAdresse = {
    address: valeurs.address ?? "",
    addressLine2: valeurs.address_line2 ?? "",
    city: valeurs.city ?? "",
    province: valeurs.province ?? "",
    postalCode: valeurs.postal_code ?? "",
    country: valeurs.country ?? "Canada",
  }
  const majAdresse = (a: ValeursAdresse) =>
    setValeurs((p) => ({
      ...p,
      address: a.address, address_line2: a.addressLine2, city: a.city,
      province: a.province, postal_code: a.postalCode, country: a.country,
    }))

  /** Ce qui a réellement changé — la même comparaison que le serveur. */
  const changements = React.useMemo(() => {
    if (!initial) return []
    return (Object.keys(valeurs) as (keyof ChampsFiche)[])
      .filter((c) => String(initial[c] ?? "").trim() !== String(valeurs[c] ?? "").trim())
      .map((c) => ({
        champ: c,
        libelle: libelleChamp(c),
        avant: String(initial[c] ?? "").trim(),
        apres: String(valeurs[c] ?? "").trim(),
      }))
  }, [initial, valeurs])

  const sensibles = changements.filter((c) => CHAMPS_SENSIBLES.includes(c.champ))

  /** Les erreurs de saisie, calculées à chaque frappe mais montrées plus tard. */
  const erreurs = React.useMemo(() => {
    const sortie: Partial<Record<string, string>> = {}
    for (const champ of ["last_name", "email", "email_secondary", "phone", "phone_secondary", "postal_code", "birth_date"] as const) {
      const m = valider(champ, String(valeurs[champ] ?? ""))
      if (m) sortie[champ] = m
    }
    return sortie
  }, [valeurs])

  const erreurVisible = (champ: string) => (touches.has(champ) ? erreurs[champ] : undefined)
  const quitte = (champ: string) => setTouches((t) => new Set(t).add(champ))

  const enregistrer = async () => {
    setEnCours(true)
    setResultat(null)
    const r = creation
      ? await creerFiche(type, valeurs)
      : await modifierFiche(type, id!, valeurs)
    setResultat(r)
    setEnCours(false)
    setAConfirmer(false)
    if (r.ok) {
      onEnregistre?.(r.message, (r as { id?: string }).id)
      setTimeout(onFerme, 1400)
    }
  }

  const soumettre = () => {
    // §11 et §12 : à la soumission, TOUT devient « touché » — c'est le moment
    // où l'on doit voir ce qui manque, y compris dans un champ jamais ouvert.
    if (Object.keys(erreurs).length > 0) {
      setTouches(new Set(Object.keys(erreurs)))
      setResultat({ ok: false, message: "Certains renseignements sont incomplets." })
      return
    }
    if (creation) { void enregistrer(); return }

    if (changements.length === 0) {
      setResultat({ ok: false, message: "Aucune modification à enregistrer." })
      return
    }
    // §7 : on ne demande confirmation que si un champ opposable change.
    if (sensibles.length > 0 && !aConfirmer) { setAConfirmer(true); return }
    void enregistrer()
  }

  /** §15 : fermer en perdant des saisies doit être un choix, pas un accident. */
  const demanderFermeture = () => {
    if (changements.length > 0 && !resultat?.ok) { setSortieAConfirmer(true); return }
    onFerme()
  }

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-foreground/50 p-4">
      <div className="bg-card w-full max-w-3xl rounded-2xl border border-border shadow-2xl flex flex-col max-h-[92vh]">
        <header className="p-5 border-b border-border flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-foreground">
              {creation
                ? (type === "client" ? "Nouveau client" : "Nouveau prospect")
                : `Modifier ${type === "client" ? "la fiche client" : "la fiche prospect"}`}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {creation ? (
                type === "client"
                  ? "Le numéro de dossier est attribué à l'enregistrement."
                  : "Seuls le nom et le courriel sont nécessaires ; le reste se complète en chemin."
              ) : (
                <>
                  {nomAffiche || valeurs.first_name || "—"}
                  {" · "}
                  Les documents DÉJÀ produits ne changent pas ; les suivants prendront ces valeurs.
                </>
              )}
            </p>
          </div>
          <button onClick={demanderFermeture} aria-label="Fermer"
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </header>

        {chargement ? (
          <div className="p-12 text-center">
            <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="overflow-y-auto p-5 space-y-6">
            {/* ---------------- Identité ---------------- */}
            <section>
              <h3 className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-3">
                <User className="h-3 w-3" /> Identité
              </h3>
              {/* L'ORDRE SUIT LA LECTURE, PAS LA STRUCTURE DE LA TABLE.
                  « Prénom » et « Nom » occupent la MÊME rangée : ce sont deux
                  moitiés d'une seule information, et les séparer sur deux
                  lignes fait chercher la seconde. La civilité et la date de
                  naissance, elles, sont deux repères indépendants. */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className={ETIQUETTE}>Civilité</label>
                  <SelecteurCivilite
                    id="fiche-civilite"
                    valeur={(valeurs.civility ?? "") as Civilite | ""}
                    onChange={(v) => maj("civility", v || null)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="fiche-naissance" className={ETIQUETTE}>Date de naissance</label>
                  <input id="fiche-naissance" type="date"
                    className={cn(CHAMP, erreurVisible("birth_date") && CHAMP_FAUTIF)}
                    aria-invalid={Boolean(erreurVisible("birth_date"))}
                    value={(valeurs.birth_date ?? "").slice(0, 10)}
                    onChange={(e) => maj("birth_date", e.target.value || null)}
                    onBlur={() => quitte("birth_date")} />
                  {erreurVisible("birth_date") && (
                    <span className="text-[11px] font-semibold text-error">{erreurVisible("birth_date")}</span>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="fiche-prenom" className={ETIQUETTE}>Prénom</label>
                  <input id="fiche-prenom" type="text" className={CHAMP}
                    value={valeurs.first_name ?? ""} onChange={(e) => maj("first_name", e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="fiche-nom" className={ETIQUETTE}>
                    Nom <span className="text-error">*</span>
                  </label>
                  <input id="fiche-nom" type="text"
                    className={cn(CHAMP, erreurVisible("last_name") && CHAMP_FAUTIF)}
                    aria-invalid={Boolean(erreurVisible("last_name"))}
                    value={valeurs.last_name ?? ""}
                    onChange={(e) => maj("last_name", e.target.value)}
                    onBlur={() => quitte("last_name")} />
                  {erreurVisible("last_name") && (
                    <span className="text-[11px] font-semibold text-error">{erreurVisible("last_name")}</span>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label htmlFor="fiche-legal" className={ETIQUETTE}>Nom légal</label>
                  <input id="fiche-legal" type="text" className={CHAMP}
                    placeholder="s'il diffère du nom usuel"
                    value={valeurs.legal_name ?? ""} onChange={(e) => maj("legal_name", e.target.value)} />
                  {/* Ce n'est pas un doublon : c'est le nom du passeport, et
                      c'est LUI qui est porté au contrat. */}
                  <span className="text-[11px] text-muted-foreground">
                    Tel qu&apos;au passeport. Porté au contrat s&apos;il est renseigné.
                  </span>
                </div>
              </div>
            </section>

            {/* ---------------- Coordonnées ---------------- */}
            <section>
              <h3 className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-3">
                <Phone className="h-3 w-3" /> Coordonnées
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="fiche-courriel" className={ETIQUETTE}>
                    Courriel <span className="text-error">*</span>
                  </label>
                  <input id="fiche-courriel" type="email"
                    className={cn(CHAMP, erreurVisible("email") && CHAMP_FAUTIF)}
                    aria-invalid={Boolean(erreurVisible("email"))}
                    value={valeurs.email ?? ""}
                    onChange={(e) => maj("email", e.target.value)}
                    onBlur={() => quitte("email")} />
                  {erreurVisible("email") && (
                    <span className="text-[11px] font-semibold text-error">{erreurVisible("email")}</span>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="fiche-courriel2" className={ETIQUETTE}>Courriel secondaire</label>
                  <input id="fiche-courriel2" type="email"
                    className={cn(CHAMP, erreurVisible("email_secondary") && CHAMP_FAUTIF)}
                    aria-invalid={Boolean(erreurVisible("email_secondary"))}
                    value={valeurs.email_secondary ?? ""}
                    onChange={(e) => maj("email_secondary", e.target.value)}
                    onBlur={() => quitte("email_secondary")} />
                  {erreurVisible("email_secondary") && (
                    <span className="text-[11px] font-semibold text-error">{erreurVisible("email_secondary")}</span>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="fiche-tel" className={ETIQUETTE}>Téléphone</label>
                  <input id="fiche-tel" type="tel"
                    className={cn(CHAMP, erreurVisible("phone") && CHAMP_FAUTIF)}
                    aria-invalid={Boolean(erreurVisible("phone"))}
                    value={valeurs.phone ?? ""}
                    onChange={(e) => maj("phone", e.target.value)}
                    onBlur={() => quitte("phone")} />
                  {erreurVisible("phone") && (
                    <span className="text-[11px] font-semibold text-error">{erreurVisible("phone")}</span>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="fiche-tel2" className={ETIQUETTE}>Téléphone secondaire</label>
                  <input id="fiche-tel2" type="tel"
                    className={cn(CHAMP, erreurVisible("phone_secondary") && CHAMP_FAUTIF)}
                    aria-invalid={Boolean(erreurVisible("phone_secondary"))}
                    value={valeurs.phone_secondary ?? ""}
                    onChange={(e) => maj("phone_secondary", e.target.value)}
                    onBlur={() => quitte("phone_secondary")} />
                  {erreurVisible("phone_secondary") && (
                    <span className="text-[11px] font-semibold text-error">{erreurVisible("phone_secondary")}</span>
                  )}
                  {/* Un client qui arrive au Canada change de numéro. Écraser
                      le premier ferait perdre le seul lien qui reste. */}
                  <span className="text-[11px] text-muted-foreground">
                    Conservé en plus du premier, jamais à sa place.
                  </span>
                </div>
              </div>
            </section>

            {/* ---------------- Adresse ---------------- */}
            <section>
              <h3 className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-3">
                <MapPin className="h-3 w-3" /> Adresse postale
              </h3>
              <ChampsAdresse valeurs={adresse} onChange={majAdresse} prefixe="fiche" />
            </section>

            {/* ---------------- Le reste de la fiche ---------------- */}
            <section>
              <h3 className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground mb-3">
                <FileText className="h-3 w-3" /> Dossier
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label htmlFor="fiche-programme" className={ETIQUETTE}>Programme / mandat</label>
                  <select
                    id="fiche-programme"
                    className={CHAMP}
                    value={(type === "client" ? valeurs.program : valeurs.visa_type) ?? ""}
                    onChange={(e) => maj(type === "client" ? "program" : "visa_type", e.target.value)}
                  >
                    <option value="">Non précisé</option>
                    {PROGRAM_GROUPS.map((g) => (
                      <optgroup key={g.label} label={g.label}>
                        {g.options.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="fiche-type" className={ETIQUETTE}>
                    {type === "client" ? "Type de client" : "Type de prospect"}
                  </label>
                  {/* Le type commande l'affichage de la raison sociale et du
                      NEQ : le demander APRÈS aurait fait remplir des champs
                      qu'on retire ensuite. */}
                  <select
                    id="fiche-type"
                    className={CHAMP}
                    value={(type === "client" ? valeurs.client_type : valeurs.type) ?? (type === "client" ? "individual" : "b2c")}
                    onChange={(e) => maj(type === "client" ? "client_type" : "type", e.target.value)}
                  >
                    <option value={type === "client" ? "individual" : "b2c"}>Particulier</option>
                    <option value={type === "client" ? "employer" : "b2b"}>Entreprise / employeur</option>
                  </select>
                </div>

                {estEntreprise && (
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="fiche-societe" className={ETIQUETTE}>Raison sociale</label>
                    <input id="fiche-societe" type="text" className={CHAMP}
                      value={valeurs.company ?? ""} onChange={(e) => maj("company", e.target.value)} />
                  </div>
                )}

                {type === "client" ? (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="fiche-nationalite" className={ETIQUETTE}>Nationalité</label>
                      <input id="fiche-nationalite" type="text" className={CHAMP}
                        value={valeurs.citizenship ?? ""} onChange={(e) => maj("citizenship", e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="fiche-residence" className={ETIQUETTE}>Lieu de résidence</label>
                      <select id="fiche-residence" className={CHAMP}
                        value={valeurs.residence ?? ""} onChange={(e) => maj("residence", e.target.value)}>
                        <option value="">Non précisé</option>
                        <option value="Canada">Canada</option>
                        <option value="International">International</option>
                      </select>
                    </div>
                    {estEntreprise && (
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="fiche-neq" className={ETIQUETTE}>NEQ (employeur)</label>
                        <input id="fiche-neq" type="text" className={CHAMP}
                          value={valeurs.neq_number ?? ""} onChange={(e) => maj("neq_number", e.target.value)} />
                      </div>
                    )}
                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <label htmlFor="fiche-motif" className={ETIQUETTE}>Motif d&apos;ouverture</label>
                      <textarea id="fiche-motif" rows={2} className={CHAMP}
                        value={valeurs.intake_motif ?? ""} onChange={(e) => maj("intake_motif", e.target.value)} />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="fiche-origine" className={ETIQUETTE}>Origine du contact</label>
                      <input id="fiche-origine" type="text" className={CHAMP}
                        value={valeurs.source ?? ""} onChange={(e) => maj("source", e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="fiche-intention" className={ETIQUETTE}>Intention de contact</label>
                      <select id="fiche-intention" className={CHAMP}
                        value={valeurs.contact_intent ?? ""} onChange={(e) => maj("contact_intent", e.target.value || null)}>
                        <option value="">Non précisée</option>
                        <option value="info">Demande d&apos;information</option>
                        <option value="consultation">Consultation</option>
                        <option value="mandate">Mandat complet</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="fiche-valeur" className={ETIQUETTE}>Honoraires estimés (CAD)</label>
                      <input id="fiche-valeur" type="number" min={0} step={100} className={CHAMP}
                        value={String(valeurs.estimated_value ?? "")}
                        onChange={(e) => setValeurs((p) => ({ ...p, estimated_value: Number(e.target.value) || 0 }))} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="fiche-faisabilite" className={ETIQUETTE}>Faisabilité</label>
                      <select id="fiche-faisabilite" className={CHAMP}
                        value={valeurs.score_label ?? "med"} onChange={(e) => maj("score_label", e.target.value)}>
                        <option value="high">Élevée</option>
                        <option value="med">Moyenne</option>
                        <option value="low">Faible</option>
                      </select>
                    </div>
                    {estEntreprise && (
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor="fiche-postes" className={ETIQUETTE}>Postes visés</label>
                        <input id="fiche-postes" type="number" min={1} className={CHAMP}
                          value={String(valeurs.lmia_positions ?? "")}
                          onChange={(e) => setValeurs((p) => ({ ...p, lmia_positions: Number(e.target.value) || 1 }))} />
                      </div>
                    )}
                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <label htmlFor="fiche-notes" className={ETIQUETTE}>Notes</label>
                      <textarea id="fiche-notes" rows={2} className={CHAMP}
                        value={valeurs.notes ?? ""} onChange={(e) => maj("notes", e.target.value)} />
                    </div>
                  </>
                )}
              </div>
            </section>

            {/* ---------------- Le journal (§6) ----------------
                Absent en création : une fiche qui n'existe pas n'a pas
                d'historique, et un panneau « 0 modification » n'apprend rien. */}
            {!creation && (
            <section className="border-t border-border pt-4">
              <button
                type="button"
                onClick={() => setJournalOuvert((o) => !o)}
                className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <Clock className="h-3 w-3" />
                Historique des modifications ({journal.length})
                <ChevronDown className={cn("h-3 w-3 transition-transform", journalOuvert && "rotate-180")} />
              </button>

              {journalOuvert && (
                journal.length === 0 ? (
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    Aucune modification enregistrée depuis la création de cette fiche.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {journal.map((e) => (
                      <li key={e.id} className="rounded-xl border border-border bg-muted/30 p-3">
                        <p className="text-[11px] font-bold text-foreground">
                          {dateLisible(e.date)} — {e.resume}
                        </p>
                        <p className="text-[11px] text-muted-foreground">Par {e.acteur || "—"}</p>
                        <ul className="mt-1.5 space-y-0.5">
                          {e.changements.map((c) => (
                            <li key={c.champ} className="text-[11px] text-foreground">
                              <span className="font-semibold">{c.libelle} :</span>{" "}
                              <span className="text-muted-foreground line-through">{c.avant || "—"}</span>
                              {" → "}
                              <span>{c.apres || "—"}</span>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                )
              )}
            </section>
            )}
          </div>
        )}

        {/* ---------------- Confirmation (§7) ---------------- */}
        {aConfirmer && (
          <div className="mx-5 mb-3 rounded-xl border border-warning/40 bg-warning/10 p-3">
            <p className="flex items-center gap-1.5 text-xs font-black text-warning-strong">
              <AlertTriangle className="h-3.5 w-3.5" />
              Ces renseignements figureront sur vos prochains documents
            </p>
            <ul className="mt-1.5 space-y-0.5">
              {sensibles.map((c) => (
                <li key={c.champ} className="text-[11px] text-foreground">
                  <span className="font-semibold">{c.libelle} :</span>{" "}
                  <span className="text-muted-foreground line-through">{c.avant || "—"}</span>
                  {" → "}
                  <span>{c.apres || "—"}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Les contrats, factures et reçus déjà produits ne sont pas modifiés.
            </p>
          </div>
        )}

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

        {/* §15 — quitter en perdant ce qu'on a saisi doit être un choix. */}
        {sortieAConfirmer && (
          <div className="mx-5 mb-3 rounded-xl border border-warning/40 bg-warning/10 p-3">
            <p className="flex items-center gap-1.5 text-xs font-black text-warning-strong">
              <AlertTriangle className="h-3.5 w-3.5" /> Quitter sans enregistrer ?
            </p>
            <p className="mt-1 text-[11px] text-foreground">
              {changements.length} renseignement{changements.length > 1 ? "s saisis seront perdus" : " saisi sera perdu"}.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <button type="button" onClick={onFerme}
                className="rounded-lg bg-warning-strong/10 px-2.5 py-1.5 text-[11px] font-bold text-warning-strong hover:bg-warning-strong/20 cursor-pointer">
                Quitter sans enregistrer
              </button>
              <button type="button" onClick={() => setSortieAConfirmer(false)}
                className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-bold text-foreground hover:bg-muted cursor-pointer">
                Continuer la saisie
              </button>
            </div>
          </div>
        )}

        <footer className="p-5 border-t border-border flex items-center justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">
            {changements.length === 0
              ? (creation ? "Nom et courriel suffisent" : "Aucune modification")
              : `${changements.length} ${creation ? "renseignement" : "modification"}${changements.length > 1 ? "s" : ""}${creation ? " saisi" : " en attente"}${creation && changements.length > 1 ? "s" : ""}`}
          </p>
          <div className="flex items-center gap-2">
            <button type="button"
              onClick={aConfirmer ? () => setAConfirmer(false) : demanderFermeture}
              className="px-4 py-2 rounded-xl border border-border font-bold text-xs hover:bg-muted cursor-pointer text-foreground">
              Annuler
            </button>
            {/* §14 : désactivé pendant l'appel — un double clic ne doit pas
                créer deux fiches. */}
            <button type="button" onClick={soumettre} disabled={enCours || chargement}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 disabled:opacity-40 cursor-pointer">
              {enCours ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {enCours
                ? (creation ? "Création…" : "Enregistrement…")
                : creation
                  ? (type === "client" ? "Créer le client" : "Créer le prospect")
                  : aConfirmer ? "Confirmer et enregistrer" : "Enregistrer les modifications"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}

/**
 * Les deux présélections.
 *
 * Elles n'ajoutent AUCUN comportement : elles fixent le mode et rendent les
 * appels lisibles à l'endroit où on les lit. `<ModifierFiche>` et
 * `<CreerFiche>` sont le même composant — c'est précisément ce que le §17
 * demande, et c'est ce qui empêche les deux écrans de diverger à nouveau.
 */
export function ModifierFiche(
  props: Omit<React.ComponentProps<typeof FicheFormulaire>, "mode"> & { id: string }
) {
  return <FicheFormulaire {...props} mode="edit" />
}

export function CreerFiche(
  props: Omit<React.ComponentProps<typeof FicheFormulaire>, "mode" | "id">
) {
  return <FicheFormulaire {...props} mode="create" />
}
