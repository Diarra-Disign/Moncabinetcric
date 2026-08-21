"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { KeyRound, RefreshCw, Check, AlertTriangle, Loader2 } from "lucide-react"
import { enregistrerJetonCalendly, releverCalendly, type EtatCalendly } from "@/lib/data/calendly-actions"

/**
 * Le raccordement du cabinet à son compte Calendly.
 *
 * ─── LE CHAMP EST EN ÉCRITURE SEULE ────────────────────────────────────────
 *
 * Le jeton n'est jamais relu vers le navigateur : `etatCalendly()` ne renvoie
 * qu'un booléen et deux dates. Un jeton d'accès personnel Calendly lit tout le
 * compte du consultant — le réafficher pour « confirmer » ce qui est enregistré
 * l'exposerait à quiconque ouvre les outils de développement, pour aucun gain.
 *
 * L'écran montre donc « raccordé » ou « non raccordé », jamais la valeur.
 *
 * ─── LA DERNIÈRE ERREUR EST AFFICHÉE, ET C'EST LE POINT ────────────────────
 *
 * Un jeton révoqué se traduirait autrement par un calendrier qui cesse
 * simplement de se remplir. Personne ne remarque une absence ; tout le monde
 * remarque un message.
 */
export function RaccordCalendly({ etat }: { etat: EtatCalendly }) {
  const router = useRouter()
  const [jeton, setJeton] = React.useState("")
  const [occupe, setOccupe] = React.useState<"jeton" | "releve" | null>(null)
  const [avis, setAvis] = React.useState<{ ok: boolean; texte: string } | null>(null)

  const annoncer = (ok: boolean, texte: string) => {
    setAvis({ ok, texte })
    setTimeout(() => setAvis(null), 8000)
  }

  const enregistrer = async () => {
    setOccupe("jeton")
    const donnees = new FormData()
    donnees.set("jeton", jeton)
    const r = await enregistrerJetonCalendly(donnees)
    setOccupe(null)
    annoncer(r.ok, r.message)
    // Le champ se vide dans tous les cas : ce qu'on vient d'y taper ne doit
    // pas rester à l'écran, et ne sert plus à rien une fois enregistré.
    if (r.ok) { setJeton(""); router.refresh() }
  }

  const relever = async () => {
    setOccupe("releve")
    const r = await releverCalendly(true)
    setOccupe(null)
    annoncer(r.ok, r.message)
    if (r.ok) router.refresh()
  }

  const dateLisible = etat.derniereReleve
    ? new Date(etat.derniereReleve).toLocaleString("fr-CA", {
        dateStyle: "long", timeStyle: "short", timeZone: "America/Toronto",
      })
    : null

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-muted/20 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="flex items-center gap-2 text-sm font-black text-foreground">
            <KeyRound aria-hidden className="h-4 w-4 text-primary-strong" />
            Relever automatiquement les rendez-vous
          </h4>
          {/* UNE ADRESSE DIRECTE, ET NON UN CHEMIN DE MENU.
              La consigne renvoyait d'abord à « Automations → Integrations &
              apps », repris de la page d'aide de Calendly. Ce menu n'existe pas
              partout : il varie selon le forfait et selon les refontes de leur
              interface, et le cabinet s'est retrouvé à chercher une entrée
              absente. L'adresse, elle, ne bouge pas. */}
          <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-muted-foreground">
            Les rendez-vous réservés par vos clients apparaissent dans votre calendrier à
            son ouverture. Créez un jeton sur{" "}
            <a
              href="https://calendly.com/integrations/api_webhooks"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-primary-strong underline underline-offset-2 hover:no-underline"
            >
              la page API &amp; Webhooks de Calendly
            </a>{" "}
            — bouton <span className="font-bold">Get a token now</span> — puis collez-le ici.
            Connectez-vous à Calendly avant d&apos;ouvrir ce lien.
          </p>
        </div>
        {etat.raccorde ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/15 px-3 py-1 font-mono text-xs font-bold text-success-strong">
            <Check aria-hidden className="h-3.5 w-3.5" /> Raccordé
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-3 py-1 font-mono text-xs font-bold text-muted-foreground">
            <AlertTriangle aria-hidden className="h-3.5 w-3.5" /> Non raccordé
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex min-w-64 flex-1 flex-col gap-1.5">
          <label htmlFor="jeton-calendly" className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
            {etat.raccorde ? "Remplacer le jeton" : "Jeton d'accès Calendly"}
          </label>
          <input
            id="jeton-calendly"
            type="password"
            autoComplete="off"
            value={jeton}
            onChange={(e) => setJeton(e.target.value)}
            placeholder={etat.raccorde ? "•••••••• — laissez vide pour conserver" : "eyJraWQiOiIxY2UxZTEz…"}
            className="w-full rounded-2xl border border-border bg-card px-4 py-2.5 font-mono text-xs font-bold transition-all placeholder:text-foreground/50 focus:border-primary focus:outline-none"
          />
        </div>

        <button
          type="button"
          onClick={enregistrer}
          disabled={occupe !== null || !jeton.trim()}
          className="inline-flex min-h-10 items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {occupe === "jeton" ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <Check aria-hidden className="h-4 w-4" />}
          Raccorder
        </button>

        {etat.raccorde && (
          <button
            type="button"
            onClick={relever}
            disabled={occupe !== null}
            className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-border bg-card px-5 py-2.5 text-xs font-bold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            {occupe === "releve" ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <RefreshCw aria-hidden className="h-4 w-4 text-muted-foreground" />}
            Relever maintenant
          </button>
        )}
      </div>

      {avis && (
        <p aria-live="polite" className={`text-[11px] font-bold ${avis.ok ? "text-success-strong" : "text-danger-strong"}`}>
          {avis.texte}
        </p>
      )}

      {etat.raccorde && (
        <div className="flex flex-col gap-1 border-t border-border pt-3 text-[11px] text-muted-foreground">
          <span>Dernière relève : {dateLisible ?? "jamais"}</span>
          {etat.derniereErreur && (
            <span className="font-bold text-danger-strong">Dernière erreur : {etat.derniereErreur}</span>
          )}
          {/* Dit franchement plutôt que découvert à l'usage. */}
          <span>
            Le rendez-vous apparaît à l&apos;ouverture du calendrier, non à la seconde où le client
            réserve : les notifications instantanées de Calendly exigent un forfait payant.
          </span>
        </div>
      )}
    </div>
  )
}
