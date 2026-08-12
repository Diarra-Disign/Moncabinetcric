"use client"

import * as React from "react"
import {
  X, Loader2, Check, AlertTriangle, User, Phone, MapPin, FileText, Clock, ChevronDown,
} from "lucide-react"
import { modifierFiche, chargerFiche, journalFiche } from "@/lib/data/fiche-actions"
import { CHAMPS_SENSIBLES, libelleChamp, type ChampsFiche, type EntreeJournal } from "@/lib/data/fiche-criteres"
import { SelecteurCivilite } from "@/components/ui/civilite"
import { ChampsAdresse, type ValeursAdresse } from "@/components/ui/adresse-postale"
import { PROGRAM_GROUPS } from "@/lib/data/services-immigration"
import { type Civilite } from "@/lib/data/identite"
import { cn } from "@/lib/utils"

/**
 * Modifier une fiche client ou prospect.
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

const dateLisible = (v: string) => {
  const d = new Date(v)
  return Number.isNaN(d.getTime())
    ? v
    : d.toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" }) +
      " à " + d.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })
}

export function ModifierFiche({
  type,
  id,
  nomAffiche,
  onFerme,
  onEnregistre,
}: {
  type: Type
  id: string
  /** Le nom tel que l'écran appelant l'affiche — pour le titre, avant chargement. */
  nomAffiche?: string
  onFerme: () => void
  onEnregistre?: (message: string) => void
}) {
  const [chargement, setChargement] = React.useState(true)
  const [initial, setInitial] = React.useState<ChampsFiche | null>(null)
  const [valeurs, setValeurs] = React.useState<ChampsFiche>({})
  const [journal, setJournal] = React.useState<EntreeJournal[]>([])
  const [journalOuvert, setJournalOuvert] = React.useState(false)
  const [enCours, setEnCours] = React.useState(false)
  const [aConfirmer, setAConfirmer] = React.useState(false)
  const [resultat, setResultat] = React.useState<{ ok: boolean; message: string } | null>(null)

  React.useEffect(() => {
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
  }, [type, id])

  const maj = (champ: keyof ChampsFiche, v: string | null) =>
    setValeurs((p) => ({ ...p, [champ]: v }))

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

  const enregistrer = async () => {
    setEnCours(true)
    setResultat(null)
    const r = await modifierFiche(type, id, valeurs)
    setResultat(r)
    setEnCours(false)
    setAConfirmer(false)
    if (r.ok) {
      onEnregistre?.(r.message)
      setTimeout(onFerme, 1200)
    }
  }

  const soumettre = () => {
    if (changements.length === 0) {
      setResultat({ ok: false, message: "Aucune modification à enregistrer." })
      return
    }
    // §7 : on ne demande confirmation que si un champ opposable change.
    if (sensibles.length > 0 && !aConfirmer) { setAConfirmer(true); return }
    void enregistrer()
  }

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-foreground/50 p-4">
      <div className="bg-card w-full max-w-3xl rounded-2xl border border-border shadow-2xl flex flex-col max-h-[92vh]">
        <header className="p-5 border-b border-border flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-foreground">
              Modifier {type === "client" ? "la fiche client" : "la fiche prospect"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {nomAffiche || valeurs.first_name || "—"}
              {" · "}
              Les documents DÉJÀ produits ne changent pas ; les suivants prendront ces valeurs.
            </p>
          </div>
          <button onClick={onFerme} aria-label="Fermer"
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
                  <label htmlFor="fiche-prenom" className={ETIQUETTE}>Prénom</label>
                  <input id="fiche-prenom" type="text" className={CHAMP}
                    value={valeurs.first_name ?? ""} onChange={(e) => maj("first_name", e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="fiche-nom" className={ETIQUETTE}>Nom</label>
                  <input id="fiche-nom" type="text" className={CHAMP}
                    value={valeurs.last_name ?? ""} onChange={(e) => maj("last_name", e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
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
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="fiche-naissance" className={ETIQUETTE}>Date de naissance</label>
                  <input id="fiche-naissance" type="date" className={CHAMP}
                    value={(valeurs.birth_date ?? "").slice(0, 10)}
                    onChange={(e) => maj("birth_date", e.target.value || null)} />
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
                  <label htmlFor="fiche-courriel" className={ETIQUETTE}>Courriel</label>
                  <input id="fiche-courriel" type="email" className={CHAMP}
                    value={valeurs.email ?? ""} onChange={(e) => maj("email", e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="fiche-courriel2" className={ETIQUETTE}>Courriel secondaire</label>
                  <input id="fiche-courriel2" type="email" className={CHAMP}
                    value={valeurs.email_secondary ?? ""} onChange={(e) => maj("email_secondary", e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="fiche-tel" className={ETIQUETTE}>Téléphone</label>
                  <input id="fiche-tel" type="tel" className={CHAMP}
                    value={valeurs.phone ?? ""} onChange={(e) => maj("phone", e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="fiche-tel2" className={ETIQUETTE}>Téléphone secondaire</label>
                  <input id="fiche-tel2" type="tel" className={CHAMP}
                    value={valeurs.phone_secondary ?? ""} onChange={(e) => maj("phone_secondary", e.target.value)} />
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

                {type === "client" ? (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="fiche-nationalite" className={ETIQUETTE}>Nationalité</label>
                      <input id="fiche-nationalite" type="text" className={CHAMP}
                        value={valeurs.citizenship ?? ""} onChange={(e) => maj("citizenship", e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="fiche-neq" className={ETIQUETTE}>NEQ (employeur)</label>
                      <input id="fiche-neq" type="text" className={CHAMP}
                        value={valeurs.neq_number ?? ""} onChange={(e) => maj("neq_number", e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <label htmlFor="fiche-motif" className={ETIQUETTE}>Motif d&apos;ouverture</label>
                      <textarea id="fiche-motif" rows={2} className={CHAMP}
                        value={valeurs.intake_motif ?? ""} onChange={(e) => maj("intake_motif", e.target.value)} />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="fiche-entreprise" className={ETIQUETTE}>Entreprise</label>
                      <input id="fiche-entreprise" type="text" className={CHAMP}
                        value={valeurs.company ?? ""} onChange={(e) => maj("company", e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="fiche-origine" className={ETIQUETTE}>Origine du contact</label>
                      <input id="fiche-origine" type="text" className={CHAMP}
                        value={valeurs.source ?? ""} onChange={(e) => maj("source", e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <label htmlFor="fiche-notes" className={ETIQUETTE}>Notes</label>
                      <textarea id="fiche-notes" rows={2} className={CHAMP}
                        value={valeurs.notes ?? ""} onChange={(e) => maj("notes", e.target.value)} />
                    </div>
                  </>
                )}
              </div>
            </section>

            {/* ---------------- Le journal (§6) ---------------- */}
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

        <footer className="p-5 border-t border-border flex items-center justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">
            {changements.length === 0
              ? "Aucune modification"
              : `${changements.length} modification${changements.length > 1 ? "s" : ""} en attente`}
          </p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={aConfirmer ? () => setAConfirmer(false) : onFerme}
              className="px-4 py-2 rounded-xl border border-border font-bold text-xs hover:bg-muted cursor-pointer text-foreground">
              Annuler
            </button>
            <button type="button" onClick={soumettre} disabled={enCours || chargement}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 disabled:opacity-40 cursor-pointer">
              {enCours ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {aConfirmer ? "Confirmer et enregistrer" : "Enregistrer les modifications"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
