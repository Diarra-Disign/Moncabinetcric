"use client"

import * as React from "react"
import {
  PenLine, Plus, Send, X, Clock, Check, AlertTriangle, Loader2,
  Eye, Download, History, Trash2, ArrowUp, ArrowDown,
} from "lucide-react"
import {
  envoyerEnSignature, listerSignatures, annulerSignature,
  relancerSignature, journalSignature, documentsSignables,
  type DestinataireSaisi,
} from "@/lib/data/signature-actions"
import {
  LIBELLE_DEMANDE, LIBELLE_DESTINATAIRE, ROLES_SIGNATAIRE, LIBELLE_EVENEMENT,
  libelleRole, type StatutDemande, type StatutDestinataire, type EvenementSignature,
} from "@/lib/signature/statuts"
import { cn } from "@/lib/utils"

/**
 * L'onglet Signature d'un dossier.
 *
 * ─── IL VIT DANS LE DOSSIER, PAS À CÔTÉ ────────────────────────────────────
 *
 * Le cahier des charges le demande, et il a raison : une expérience de
 * signature détachée du dossier oblige à retrouver deux fois le même client.
 * L'écran Signatures d'ensemble reste, pour le survol du cabinet ; celui-ci
 * répond à « où en est CE dossier ».
 *
 * ─── CE QU'IL MONTRE, ET DANS QUEL ORDRE ───────────────────────────────────
 *
 * L'état d'abord, les signataires ensuite, les actions en dernier. C'est
 * l'ordre des questions : où ça en est, qui manque, que puis-je faire.
 */

type Etat = Awaited<ReturnType<typeof listerSignatures>>[number]

const COULEUR_DEMANDE: Record<StatutDemande, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  ready: "bg-muted text-foreground border-border",
  sent: "bg-warning/15 text-warning-strong border-warning/40",
  viewed: "bg-warning/15 text-warning-strong border-warning/40",
  partially_signed: "bg-warning/15 text-warning-strong border-warning/40",
  completed: "bg-success/15 text-success-strong border-success/40",
  declined: "bg-error/10 text-error-strong border-error/40",
  cancelled: "bg-muted text-muted-foreground border-border",
  expired: "bg-muted text-muted-foreground border-border",
}

const COULEUR_DESTINATAIRE: Record<StatutDestinataire, string> = {
  pending: "text-muted-foreground",
  viewed: "text-warning-strong",
  signed: "text-success-strong",
  declined: "text-error-strong",
  expired: "text-muted-foreground",
}

const CHAMP =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"

const jour = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" }) : "—"

export function OngletSignature({
  matterId,
  clientNom,
  consultantNom,
  consultantCourriel,
  consultantPermis,
}: {
  matterId: string
  clientNom: string
  consultantNom: string
  consultantCourriel: string
  consultantPermis: string
}) {
  const [demandes, setDemandes] = React.useState<Etat[]>([])
  const [chargement, setChargement] = React.useState(true)
  const [creation, setCreation] = React.useState(false)
  const [message, setMessage] = React.useState<{ ok: boolean; texte: string } | null>(null)
  const [historique, setHistorique] = React.useState<
    { id: string; entrees: Awaited<ReturnType<typeof journalSignature>> } | null
  >(null)

  const relire = React.useCallback(async () => {
    setDemandes(await listerSignatures({ matterId }))
    setChargement(false)
  }, [matterId])

  React.useEffect(() => { void relire() }, [relire])

  const agir = async (action: () => Promise<{ ok: boolean; message: string }>) => {
    setMessage(null)
    const r = await action()
    setMessage({ ok: r.ok, texte: r.message })
    if (r.ok) await relire()
  }

  const voirHistorique = async (id: string) => {
    if (historique?.id === id) { setHistorique(null); return }
    setHistorique({ id, entrees: await journalSignature(id) })
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-black text-foreground">
            <PenLine className="h-4 w-4 text-muted-foreground" aria-hidden />
            Signature
          </h2>
          <p className="text-xs text-muted-foreground">
            Ce qui attend une signature dans ce dossier, et ce qui est signé.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreation(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 cursor-pointer"
        >
          <Plus className="h-4 w-4" aria-hidden /> Envoyer pour signature
        </button>
      </div>

      {message && (
        <p role="status" className={cn(
          "rounded-xl border p-3 text-xs font-bold",
          message.ok
            ? "border-success/40 bg-success/10 text-success-strong"
            : "border-error/40 bg-error/10 text-error-strong"
        )}>
          {message.texte}
        </p>
      )}

      {chargement ? (
        <div className="py-10 text-center">
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
        </div>
      ) : demandes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center">
          <PenLine className="mx-auto h-7 w-7 text-muted-foreground/70" aria-hidden />
          <p className="mt-2 text-xs font-bold text-foreground">Aucune signature en cours</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Envoyez un document du dossier pour signature. Le client n&apos;a pas besoin
            de compte : il reçoit un lien personnel.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {demandes.map((d) => (
            <li key={d.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">{d.documentNom}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Envoyée le {jour(d.envoyeLe ?? d.creeLe)}
                    {d.expireLe && ` · expire le ${jour(d.expireLe)}`}
                  </p>
                </div>
                <span className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold",
                  COULEUR_DEMANDE[d.statut]
                )}>
                  {d.statut === "completed" ? <Check className="h-3 w-3" aria-hidden />
                    : d.statut === "declined" ? <AlertTriangle className="h-3 w-3" aria-hidden />
                    : <Clock className="h-3 w-3" aria-hidden />}
                  {LIBELLE_DEMANDE[d.statut]}
                </span>
              </div>

              <ul className="mt-3 space-y-1">
                {d.destinataires.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-baseline gap-x-2 text-[11px]">
                    <span className={cn("font-bold", COULEUR_DESTINATAIRE[r.statut])}>
                      {r.statut === "signed" ? "✓" : r.statut === "declined" ? "✗" : "○"}
                    </span>
                    <span className="font-semibold text-foreground">{r.nom}</span>
                    <span className="text-muted-foreground">{libelleRole(r.role)}</span>
                    <span className={cn("ml-auto", COULEUR_DESTINATAIRE[r.statut])}>
                      {LIBELLE_DESTINATAIRE[r.statut]}
                      {r.signeLe && ` · ${jour(r.signeLe)}`}
                      {/* Dire QUI l'on attend évite de relancer la mauvaise
                          personne — en séquentiel, c'est le défaut le plus
                          fréquent. */}
                      {r.statut === "pending" && r.sonTour && " · c'est à lui"}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                {d.documentSigneId && (
                  <a
                    href={`/api/documents/${d.documentSigneId}`}
                    target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-success/15 px-2.5 py-1.5 text-[11px] font-bold text-success-strong hover:bg-success/25"
                  >
                    <Download className="h-3 w-3" aria-hidden /> Document signé
                  </a>
                )}
                <button type="button" onClick={() => voirHistorique(d.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-bold text-foreground hover:bg-muted cursor-pointer">
                  <History className="h-3 w-3" aria-hidden /> Historique
                </button>
                {["sent", "viewed", "partially_signed"].includes(d.statut) && (
                  <>
                    <button type="button" onClick={() => agir(() => relancerSignature(d.id))}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-bold text-foreground hover:bg-muted cursor-pointer">
                      <Send className="h-3 w-3" aria-hidden /> Renvoyer
                    </button>
                    <button type="button" onClick={() => agir(() => annulerSignature(d.id))}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-bold text-error-strong hover:bg-error/10 cursor-pointer">
                      <X className="h-3 w-3" aria-hidden /> Annuler
                    </button>
                  </>
                )}
              </div>

              {historique?.id === d.id && (
                <ol className="mt-3 space-y-1 border-t border-border pt-3">
                  {historique.entrees.length === 0 && (
                    <li className="text-[11px] text-muted-foreground">Aucun événement consigné.</li>
                  )}
                  {historique.entrees.map((e, i) => (
                    <li key={i} className="flex flex-wrap items-baseline gap-x-2 text-[11px]">
                      <span className="font-semibold text-foreground">
                        {LIBELLE_EVENEMENT[e.evenement as EvenementSignature] ?? e.evenement}
                      </span>
                      <span className="text-muted-foreground">{e.acteur}</span>
                      <span className="ml-auto font-mono text-muted-foreground">
                        {new Date(e.survenuLe).toLocaleString("fr-CA")}
                        {e.ip && ` · ${e.ip}`}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </li>
          ))}
        </ul>
      )}

      {creation && (
        <ModaleEnvoi
          matterId={matterId}
          clientNom={clientNom}
          consultantNom={consultantNom}
          consultantCourriel={consultantCourriel}
          consultantPermis={consultantPermis}
          onFerme={() => setCreation(false)}
          onEnvoye={(m) => { setMessage({ ok: true, texte: m }); void relire() }}
        />
      )}
    </section>
  )
}

/**
 * L'envoi en signature, en une fenêtre.
 *
 * LE CONSULTANT EST PROPOSÉ D'OFFICE, en second. C'est l'oubli le plus
 * fréquent : on envoie un contrat au client et on ne le signe jamais soi-même.
 * Il reste retirable — certaines pièces ne se signent que d'un côté.
 */
function ModaleEnvoi({
  matterId, clientNom, consultantNom, consultantCourriel, consultantPermis,
  onFerme, onEnvoye,
}: {
  matterId: string
  clientNom: string
  consultantNom: string
  consultantCourriel: string
  consultantPermis: string
  onFerme: () => void
  onEnvoye: (message: string) => void
}) {
  const [docs, setDocs] = React.useState<{ id: string; nom: string }[]>([])
  const [documentId, setDocumentId] = React.useState("")
  const [enCours, setEnCours] = React.useState(false)
  const [erreur, setErreur] = React.useState<string | null>(null)
  const [signataires, setSignataires] = React.useState<DestinataireSaisi[]>([
    { role: "client", nom: clientNom, courriel: "", rang: 1 },
    { role: "consultant", nom: consultantNom, courriel: consultantCourriel, permis: consultantPermis, rang: 2 },
  ])

  React.useEffect(() => {
    let vivant = true
    void documentsSignables(matterId).then((d) => { if (vivant) setDocs(d) })
    return () => { vivant = false }
  }, [matterId])

  const maj = (i: number, champ: keyof DestinataireSaisi, v: string) =>
    setSignataires((s) => s.map((x, k) => (k === i ? { ...x, [champ]: v } : x)))

  const deplacer = (i: number, sens: -1 | 1) => {
    const j = i + sens
    if (j < 0 || j >= signataires.length) return
    const copie = [...signataires]
    ;[copie[i], copie[j]] = [copie[j], copie[i]]
    setSignataires(copie.map((x, k) => ({ ...x, rang: k + 1 })))
  }

  const envoyer = async () => {
    setErreur(null)
    if (!documentId) { setErreur("Choisissez le document à faire signer."); return }
    const incomplets = signataires.filter((s) => !s.nom.trim() || !s.courriel.trim())
    if (incomplets.length > 0) {
      setErreur("Chaque signataire doit avoir un nom et un courriel.")
      return
    }
    setEnCours(true)
    const r = await envoyerEnSignature(documentId, signataires, { mode: "sequential" })
    setEnCours(false)
    if (!r.ok) { setErreur(r.message); return }
    onEnvoye(r.message)
    onFerme()
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-foreground/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-card shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div>
            <h3 className="text-base font-black text-foreground">Envoyer pour signature</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Le document sera verrouillé : son contenu ne pourra plus changer.
            </p>
          </div>
          <button type="button" onClick={onFerme} aria-label="Fermer"
            className="cursor-pointer rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <div className="space-y-1.5">
            <label htmlFor="doc-signature" className="text-[11px] font-bold text-muted-foreground">
              1. Le document
            </label>
            <select id="doc-signature" className={CHAMP}
              value={documentId} onChange={(e) => setDocumentId(e.target.value)}>
              <option value="">Choisissez…</option>
              {docs.map((d) => <option key={d.id} value={d.id}>{d.nom}</option>)}
            </select>
            {docs.length === 0 && (
              <p className="text-[11px] text-muted-foreground">
                Aucun document disponible. Les documents déjà envoyés en signature
                n&apos;apparaissent pas : ils sont verrouillés.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground">
                2. Les signataires, dans l&apos;ordre
              </span>
              <button type="button"
                onClick={() => setSignataires((s) => [...s, {
                  role: "other", nom: "", courriel: "", rang: s.length + 1,
                }])}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-bold text-foreground hover:bg-muted cursor-pointer">
                <Plus className="h-3 w-3" aria-hidden /> Ajouter
              </button>
            </div>

            {signataires.map((s, i) => (
              <div key={i} className="rounded-xl border border-border bg-muted/20 p-2.5">
                <div className="mb-2 flex items-center gap-2">
                  <span className="w-5 text-xs font-black text-primary-strong">{i + 1}</span>
                  <select className={CHAMP} value={s.role}
                    onChange={(e) => maj(i, "role", e.target.value)} aria-label="Rôle">
                    {ROLES_SIGNATAIRE.map((r) => (
                      <option key={r.valeur} value={r.valeur}>{r.fr}</option>
                    ))}
                  </select>
                  <button type="button" aria-label="Monter" onClick={() => deplacer(i, -1)}
                    className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-muted">
                    <ArrowUp className="h-3 w-3" aria-hidden />
                  </button>
                  <button type="button" aria-label="Descendre" onClick={() => deplacer(i, 1)}
                    className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-muted">
                    <ArrowDown className="h-3 w-3" aria-hidden />
                  </button>
                  <button type="button" aria-label="Retirer"
                    onClick={() => setSignataires((x) =>
                      x.filter((_, k) => k !== i).map((y, k) => ({ ...y, rang: k + 1 })))}
                    className="cursor-pointer rounded p-1 text-muted-foreground hover:bg-error/10 hover:text-error">
                    <Trash2 className="h-3 w-3" aria-hidden />
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input type="text" className={CHAMP} placeholder="Nom complet"
                    value={s.nom} onChange={(e) => maj(i, "nom", e.target.value)} aria-label="Nom" />
                  <input type="email" className={CHAMP} placeholder="courriel@exemple.com"
                    value={s.courriel} onChange={(e) => maj(i, "courriel", e.target.value)} aria-label="Courriel" />
                </div>
              </div>
            ))}

            <p className="text-[11px] text-muted-foreground">
              Chacun signe à son tour : le suivant n&apos;est prévenu que lorsque le
              précédent a signé.
            </p>
          </div>
        </div>

        {erreur && (
          <p role="alert" className="mx-5 mb-3 rounded-xl border border-error/40 bg-error/10 p-3 text-xs font-bold text-error-strong">
            {erreur}
          </p>
        )}

        <footer className="flex items-center justify-end gap-2 border-t border-border p-5">
          <button type="button" onClick={onFerme}
            className="cursor-pointer rounded-xl border border-border px-4 py-2 text-xs font-bold text-foreground hover:bg-muted">
            Annuler
          </button>
          <button type="button" onClick={envoyer} disabled={enCours}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-40">
            {enCours ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                     : <Send className="h-4 w-4" aria-hidden />}
            Envoyer pour signature
          </button>
        </footer>
      </div>
    </div>
  )
}
