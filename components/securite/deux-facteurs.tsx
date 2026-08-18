"use client"

import * as React from "react"
import { ShieldCheck, ShieldOff, Loader2, Check, AlertCircle } from "lucide-react"
import { getBrowserSupabase } from "@/lib/supabase/browser"
import { Button } from "@/components/ui/button"

/**
 * Enrôlement du second facteur (TOTP).
 *
 * ─── POURQUOI DANS LE NAVIGATEUR ───────────────────────────────────────────
 *
 * L'enrôlement TOTP est le seul moment où le secret partagé transite. Il vient
 * de Supabase et doit atteindre l'application d'authentification de la
 * personne — jamais notre serveur, qui n'a aucune raison de le connaître et
 * dont les journaux pourraient le retenir. Le client d'authentification du
 * navigateur est donc le bon endroit, et le seul.
 *
 * ─── CE QUI REND CET ÉCRAN HONNÊTE ─────────────────────────────────────────
 *
 * Un facteur n'est ACTIF qu'une fois un code vérifié. Tant que la personne n'a
 * pas prouvé que son application lit bien le secret, le facteur reste au
 * statut « unverified » et n'est pas exigé à la connexion. C'est ce qui évite
 * le pire scénario : quelqu'un qui croit avoir activé le second facteur, qui
 * perd son mot de passe, et découvre qu'il n'a jamais rien enrôlé.
 */

type Etape = "repos" | "enrolement" | "occupe"

interface Facteur {
  id: string
  statut: string
  cree: string
}

export function DeuxFacteurs() {
  const [facteurs, setFacteurs] = React.useState<Facteur[]>([])
  const [etape, setEtape] = React.useState<Etape>("occupe")
  const [qr, setQr] = React.useState<string | null>(null)
  const [secret, setSecret] = React.useState<string | null>(null)
  const [facteurId, setFacteurId] = React.useState<string | null>(null)
  const [code, setCode] = React.useState("")
  const [erreur, setErreur] = React.useState<string | null>(null)
  const [succes, setSucces] = React.useState<string | null>(null)

  const recharger = React.useCallback(async () => {
    setEtape("occupe")
    const sb = getBrowserSupabase()
    const { data, error } = await sb.auth.mfa.listFactors()
    if (error) {
      setErreur(error.message)
      setEtape("repos")
      return
    }
    setFacteurs(
      (data?.all ?? []).map((f) => ({
        id: f.id,
        statut: f.status,
        cree: (f.created_at ?? "").slice(0, 10),
      }))
    )
    setEtape("repos")
  }, [])

  React.useEffect(() => {
    let actif = true
    const sb = getBrowserSupabase()
    void sb.auth.mfa.listFactors().then(({ data, error }) => {
      if (!actif) return
      if (error) {
        setErreur(error.message)
        setEtape("repos")
        return
      }
      setFacteurs(
        (data?.all ?? []).map((f) => ({
          id: f.id,
          statut: f.status,
          cree: (f.created_at ?? "").slice(0, 10),
        }))
      )
      setEtape("repos")
    })
    return () => {
      actif = false
    }
  }, [])

  const commencer = async () => {
    setErreur(null)
    setSucces(null)
    setEtape("occupe")
    const sb = getBrowserSupabase()

    // Un enrôlement inachevé laisse un facteur « unverified » derrière lui, et
    // Supabase refuse un second enrôlement tant qu'il traîne. On nettoie donc
    // avant, plutôt que de renvoyer une erreur incompréhensible.
    const { data: existants } = await sb.auth.mfa.listFactors()
    for (const f of existants?.all ?? []) {
      if (f.status !== "verified") await sb.auth.mfa.unenroll({ factorId: f.id })
    }

    const { data, error } = await sb.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `Application — ${new Date().toISOString().slice(0, 10)}`,
    })
    if (error || !data) {
      setErreur(error?.message ?? "L'enrôlement n'a pas abouti.")
      setEtape("repos")
      return
    }
    setFacteurId(data.id)
    setQr(data.totp.qr_code)
    setSecret(data.totp.secret)
    setEtape("enrolement")
  }

  const confirmer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!facteurId) return
    setErreur(null)
    setEtape("occupe")
    const sb = getBrowserSupabase()

    const { data: defi, error: eDefi } = await sb.auth.mfa.challenge({ factorId: facteurId })
    if (eDefi || !defi) {
      setErreur(eDefi?.message ?? "Le défi n'a pas pu être créé.")
      setEtape("enrolement")
      return
    }

    const { error } = await sb.auth.mfa.verify({
      factorId: facteurId,
      challengeId: defi.id,
      code: code.trim(),
    })
    if (error) {
      // Le message brut de Supabase est en anglais et technique.
      setErreur("Ce code n'est pas valide. Vérifiez l'heure de votre téléphone, puis réessayez.")
      setEtape("enrolement")
      return
    }

    setQr(null)
    setSecret(null)
    setFacteurId(null)
    setCode("")
    setSucces("Le second facteur est actif. Il vous sera demandé à chaque connexion.")
    await recharger()
  }

  const retirer = async (id: string) => {
    setErreur(null)
    setSucces(null)
    setEtape("occupe")
    const sb = getBrowserSupabase()
    const { error } = await sb.auth.mfa.unenroll({ factorId: id })
    if (error) setErreur(error.message)
    else setSucces("Le second facteur a été retiré.")
    await recharger()
  }

  const actif = facteurs.find((f) => f.statut === "verified")

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h3 className="flex items-center gap-2 text-sm font-black text-foreground">
        {actif ? (
          <ShieldCheck aria-hidden className="h-4 w-4 text-success" />
        ) : (
          <ShieldOff aria-hidden className="h-4 w-4 text-muted-foreground" />
        )}
        Second facteur d&apos;authentification
      </h3>

      <p className="mt-1 max-w-prose text-xs leading-relaxed text-muted-foreground">
        Un code à six chiffres, engendré par une application sur votre téléphone, en plus de
        votre mot de passe. C&apos;est le seul mécanisme qui protège encore un dossier quand un
        mot de passe a fuité — et les adresses des consultants réglementés sont publiques au
        registre du Collège.
      </p>

      {erreur && (
        <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl border border-error/30 bg-error/10 px-3 py-2 text-xs text-foreground">
          <AlertCircle aria-hidden className="mt-px h-4 w-4 shrink-0 text-error" />
          {erreur}
        </p>
      )}
      {succes && (
        <p role="status" className="mt-3 flex items-start gap-2 rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-xs text-foreground">
          <Check aria-hidden className="mt-px h-4 w-4 shrink-0 text-success" />
          {succes}
        </p>
      )}

      {etape === "occupe" && (
        <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
          Un instant…
        </p>
      )}

      {etape === "repos" && actif && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-success/30 bg-success/5 px-4 py-3">
          <span className="text-xs font-bold text-foreground">
            Actif depuis le {actif.cree}
          </span>
          <button
            type="button"
            onClick={() => retirer(actif.id)}
            className="min-h-9 rounded-lg border border-border px-3 text-xs font-bold text-foreground transition-colors hover:bg-muted"
          >
            Retirer
          </button>
        </div>
      )}

      {etape === "repos" && !actif && (
        <Button type="button" onClick={commencer} className="mt-4">
          Activer le second facteur
        </Button>
      )}

      {etape === "enrolement" && qr && (
        <form onSubmit={confirmer} className="mt-4 space-y-4">
          <ol className="space-y-3 text-xs text-muted-foreground">
            <li>
              <strong className="text-foreground">1.</strong> Ouvrez votre application
              d&apos;authentification — Google Authenticator, Authy, 1Password, ou celle de votre
              gestionnaire de mots de passe.
            </li>
            <li>
              <strong className="text-foreground">2.</strong> Balayez ce code :
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qr}
                alt="Code à balayer pour enrôler le second facteur"
                className="mt-2 h-44 w-44 rounded-xl border border-border bg-white p-2"
              />
              {secret && (
                <span className="mt-2 block">
                  Impossible de balayer ? Saisissez cette clé à la main :{" "}
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                    {secret}
                  </code>
                </span>
              )}
            </li>
            <li>
              <strong className="text-foreground">3.</strong> Saisissez le code affiché pour
              confirmer. <strong className="text-foreground">Sans cette confirmation, rien
              n&apos;est activé</strong> — mieux vaut le savoir maintenant que le jour où vous
              perdrez votre mot de passe.
            </li>
          </ol>

          <div className="flex flex-wrap items-end gap-3">
            <label className="text-[11px] font-bold text-muted-foreground">
              Code à six chiffres
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                required
                className="mt-1 block w-36 rounded-xl border border-border bg-background px-3 py-2.5 font-mono text-sm tracking-widest text-foreground"
              />
            </label>
            <Button type="submit" disabled={code.length !== 6}>
              Confirmer
            </Button>
            <button
              type="button"
              onClick={() => { setQr(null); setSecret(null); setEtape("repos") }}
              className="min-h-9 px-2 text-xs font-bold text-muted-foreground hover:text-foreground"
            >
              Annuler
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
