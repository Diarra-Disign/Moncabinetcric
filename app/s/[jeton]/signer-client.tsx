"use client"

import * as React from "react"
import {
  FileText, ShieldCheck, Check, AlertTriangle, Loader2, ExternalLink, Clock, X,
} from "lucide-react"
import { PaveSignature } from "@/components/signature/pave-signature"
import { apposerSignature, declinerSignature } from "@/lib/data/signature-publique-actions"
import { LIBELLE_CHAMP, libelleRole, type TypeChamp } from "@/lib/signature/statuts"
import { cn } from "@/lib/utils"

/**
 * Le parcours de signature, vu par le destinataire.
 *
 * ─── CE QUE CET ÉCRAN REFUSE DE FAIRE ──────────────────────────────────────
 *
 * Il ne cache PAS le document derrière la signature. Le lien de lecture est
 * offert d'emblée et reste visible jusqu'au bout : demander à quelqu'un de
 * signer ce qu'il n'a pas pu lire est exactement ce qu'un contrat ne doit
 * jamais faire.
 *
 * Il ne PRÉCOCHE rien. Ni le consentement, ni les cases du document. Une case
 * précochée n'est pas un consentement, c'est un piège — et la Loi 25 demande
 * un consentement manifeste et libre.
 *
 * Il ne cache PAS le refus. Un signataire qui n'a aucun bouton pour dire non
 * se contente de ne rien faire, et le cabinet relance indéfiniment quelqu'un
 * qui a déjà décidé.
 *
 * ─── LE TÉLÉPHONE D'ABORD ──────────────────────────────────────────────────
 *
 * Une colonne, des cibles larges, et le pavé qui suit la largeur disponible.
 * La plupart des gens signeront depuis leur téléphone, souvent en marchant.
 */

interface Vue {
  nom: string
  courriel: string
  role: string
  documentNom: string
  cabinetNom: string
  methodeAuth: string
  statutDestinataire: string
  mode: string
  expireLe: string | null
  sonTour: boolean
}

interface Champ {
  id: string
  type: string
  libelle: string
  obligatoire: boolean
  valeur: string | null
  position: number
}

const CHAMP_CSS =
  "w-full rounded-xl border border-border bg-card px-3.5 py-3 text-sm text-foreground " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"

const dateLisible = (v: string) =>
  new Date(v).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" })

export function SignerClient({
  jeton,
  vue,
  champs,
  lienDocument,
}: {
  jeton: string
  vue: Vue
  champs: Champ[]
  lienDocument: string | null
}) {
  const [valeurs, setValeurs] = React.useState<Record<string, string>>(
    Object.fromEntries(champs.map((c) => [c.id, c.valeur ?? ""]))
  )
  const [trace, setTrace] = React.useState<string | null>(null)
  const [courriel, setCourriel] = React.useState("")
  const [consent, setConsent] = React.useState(false)
  const [enCours, setEnCours] = React.useState(false)
  const [refusOuvert, setRefusOuvert] = React.useState(false)
  const [motifRefus, setMotifRefus] = React.useState("")
  const [resultat, setResultat] = React.useState<{ ok: boolean; message: string } | null>(null)
  const [fini, setFini] = React.useState<"signe" | "refuse" | null>(null)

  const demandeCourriel = vue.methodeAuth === "email_confirm"
  const champsASaisir = champs.filter((c) => c.type !== "signature")
  const besoinTrace = champs.some((c) => c.type === "signature")

  const manque = React.useMemo(() => {
    const m: string[] = []
    if (demandeCourriel && !courriel.trim()) m.push("votre courriel")
    if (besoinTrace && !trace) m.push("votre signature")
    for (const c of champsASaisir) {
      if (!c.obligatoire) continue
      const v = (valeurs[c.id] ?? "").trim()
      if (c.type === "checkbox" ? v !== "true" : !v) m.push(c.libelle || LIBELLE_CHAMP[c.type as TypeChamp])
    }
    if (!consent) m.push("votre consentement")
    return m
  }, [demandeCourriel, courriel, besoinTrace, trace, champsASaisir, valeurs, consent])

  const signer = async () => {
    setEnCours(true)
    setResultat(null)
    const r = await apposerSignature(
      jeton, courriel, trace,
      champsASaisir.map((c) => ({ id: c.id, valeur: valeurs[c.id] ?? "" }))
    )
    setEnCours(false)
    setResultat(r)
    if (r.ok) setFini("signe")
  }

  const refuser = async () => {
    setEnCours(true)
    const r = await declinerSignature(jeton, motifRefus)
    setEnCours(false)
    setResultat(r)
    if (r.ok) setFini("refuse")
  }

  // ── Après coup ───────────────────────────────────────────────────────────
  if (fini) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-4 px-5 py-16 text-center">
        <div className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full",
          fini === "signe" ? "bg-success/15 text-success-strong" : "bg-muted text-muted-foreground"
        )}>
          {fini === "signe" ? <Check className="h-7 w-7" /> : <X className="h-7 w-7" />}
        </div>
        <h1 className="text-xl font-black text-foreground">
          {fini === "signe" ? "Document signé" : "Refus enregistré"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {fini === "signe"
            ? `Merci. Votre signature a été enregistrée et ${vue.cabinetNom} en a été informé. Vous pouvez fermer cette page.`
            : `Votre refus a été transmis à ${vue.cabinetNom}. Vous pouvez fermer cette page.`}
        </p>
        {fini === "signe" && lienDocument && (
          <a href={lienDocument} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-primary-strong underline">
            <ExternalLink className="h-4 w-4" aria-hidden /> Relire le document
          </a>
        )}
      </main>
    )
  }

  // ── Déjà signé, ou ce n'est pas encore son tour ──────────────────────────
  if (vue.statutDestinataire === "signed") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-4 px-5 py-16 text-center">
        <Check className="h-10 w-10 text-success-strong" aria-hidden />
        <h1 className="text-xl font-black text-foreground">Vous avez déjà signé</h1>
        <p className="text-sm text-muted-foreground">
          Votre signature est enregistrée. Il n&apos;y a rien de plus à faire.
        </p>
      </main>
    )
  }

  if (!vue.sonTour) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-4 px-5 py-16 text-center">
        <Clock className="h-10 w-10 text-muted-foreground" aria-hidden />
        <h1 className="text-xl font-black text-foreground">Ce n&apos;est pas encore à vous</h1>
        <p className="text-sm text-muted-foreground">
          Une autre personne doit signer avant vous. Vous serez prévenu dès que ce
          sera votre tour — ce lien restera valide.
        </p>
      </main>
    )
  }

  // ── Le parcours ──────────────────────────────────────────────────────────
  return (
    <main className="mx-auto max-w-2xl px-5 py-8 sm:py-12">
      <header className="mb-6">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {vue.cabinetNom}
        </p>
        <h1 className="mt-1 text-2xl font-black leading-tight text-foreground text-balance">
          {vue.documentNom}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Bonjour {vue.nom}. Vous êtes invité à signer ce document
          {" "}en qualité de {libelleRole(vue.role).toLowerCase()}.
        </p>
        {vue.expireLe && (
          <p className="mt-1 text-xs text-muted-foreground">
            Ce lien est valide jusqu&apos;au {dateLisible(vue.expireLe)}.
          </p>
        )}
      </header>

      {/* LE DOCUMENT D'ABORD. On ne demande pas de signer ce qu'on n'a pas
          pu lire. */}
      <section className="mb-6 rounded-2xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 text-sm font-black text-foreground">
          <FileText className="h-4 w-4 text-muted-foreground" aria-hidden />
          Le document
        </h2>
        {lienDocument ? (
          <a
            href={lienDocument}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 sm:w-auto"
          >
            <ExternalLink className="h-4 w-4" aria-hidden /> Lire le document
          </a>
        ) : (
          <p className="mt-2 text-sm text-error-strong">
            Le document n&apos;a pas pu être ouvert. Prévenez le cabinet plutôt que de signer.
          </p>
        )}
        <p className="mt-2 text-[11px] text-muted-foreground">
          Prenez le temps de le lire en entier. Une fois signé, il ne pourra plus être modifié.
        </p>
      </section>

      <section className="mb-6 space-y-5 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-black text-foreground">Votre signature</h2>

        {demandeCourriel && (
          <div className="space-y-1.5">
            <label htmlFor="courriel" className="text-xs font-bold text-foreground">
              Confirmez le courriel auquel ce lien vous a été envoyé
            </label>
            <input
              id="courriel"
              type="email"
              inputMode="email"
              autoComplete="email"
              className={CHAMP_CSS}
              value={courriel}
              onChange={(e) => setCourriel(e.target.value)}
              placeholder="vous@exemple.com"
            />
            <p className="text-[11px] text-muted-foreground">
              Cette confirmation empêche qu&apos;un lien transféré soit signé par
              quelqu&apos;un d&apos;autre.
            </p>
          </div>
        )}

        {champsASaisir.map((c) => (
          <div key={c.id} className="space-y-1.5">
            {c.type === "checkbox" ? (
              <label className="flex items-start gap-2.5 text-sm text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]"
                  checked={valeurs[c.id] === "true"}
                  onChange={(e) =>
                    setValeurs((v) => ({ ...v, [c.id]: e.target.checked ? "true" : "" }))
                  }
                />
                <span>
                  {c.libelle || LIBELLE_CHAMP[c.type as TypeChamp]}
                  {c.obligatoire && <span className="text-error"> *</span>}
                </span>
              </label>
            ) : (
              <>
                <label htmlFor={`c-${c.id}`} className="text-xs font-bold text-foreground">
                  {c.libelle || LIBELLE_CHAMP[c.type as TypeChamp]}
                  {c.obligatoire && <span className="text-error"> *</span>}
                </label>
                <input
                  id={`c-${c.id}`}
                  type={c.type === "date" ? "date" : "text"}
                  className={CHAMP_CSS}
                  value={valeurs[c.id] ?? ""}
                  onChange={(e) => setValeurs((v) => ({ ...v, [c.id]: e.target.value }))}
                />
              </>
            )}
          </div>
        ))}

        {besoinTrace && <PaveSignature nom={vue.nom} onChange={setTrace} />}

        {/* Le consentement n'est JAMAIS précoché. */}
        <label className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/30 p-3 text-sm text-foreground cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span>
            J&apos;ai lu le document et j&apos;accepte de le signer électroniquement.
            <span className="mt-1 block text-[11px] text-muted-foreground">
              La date, l&apos;heure, votre adresse de connexion et l&apos;empreinte du
              document sont enregistrées pour établir l&apos;intégrité de votre
              signature.
            </span>
          </span>
        </label>
      </section>

      {resultat && !resultat.ok && (
        <p role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-error/40 bg-error/10 p-3 text-sm font-bold text-error-strong">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden /> {resultat.message}
        </p>
      )}

      {manque.length > 0 && (
        <p className="mb-3 text-[11px] text-muted-foreground">
          Il reste à renseigner : {manque.join(", ")}.
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row-reverse">
        <button
          type="button"
          onClick={signer}
          disabled={enCours || manque.length > 0}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-black text-primary-foreground hover:bg-primary/90 disabled:opacity-40 cursor-pointer"
        >
          {enCours ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                   : <ShieldCheck className="h-4 w-4" aria-hidden />}
          Signer le document
        </button>
        <button
          type="button"
          onClick={() => setRefusOuvert((o) => !o)}
          className="rounded-xl border border-border px-5 py-3.5 text-sm font-bold text-foreground hover:bg-muted cursor-pointer"
        >
          Je refuse de signer
        </button>
      </div>

      {refusOuvert && (
        <div className="mt-4 rounded-2xl border border-border bg-card p-5">
          <h2 className="text-sm font-black text-foreground">Refuser de signer</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Le cabinet en sera informé. Dites-lui pourquoi, s&apos;il y a lieu.
          </p>
          <textarea
            rows={3}
            className={cn(CHAMP_CSS, "mt-3")}
            value={motifRefus}
            onChange={(e) => setMotifRefus(e.target.value)}
            placeholder="Facultatif"
          />
          <button
            type="button"
            onClick={refuser}
            disabled={enCours}
            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-error/40 bg-error/10 px-4 py-2.5 text-sm font-bold text-error-strong hover:bg-error/20 disabled:opacity-40 cursor-pointer"
          >
            {enCours && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            Confirmer mon refus
          </button>
        </div>
      )}

      <footer className="mt-8 border-t border-border pt-4 text-[11px] text-muted-foreground">
        Ce lien vous est personnel. Ne le transférez pas : il porte votre
        signature.
      </footer>
    </main>
  )
}
