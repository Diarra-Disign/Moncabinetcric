"use client"

import * as React from "react"
import { Mail, Check, AlertTriangle, Clock } from "lucide-react"
import { demanderAide, type ResultatAide } from "@/lib/data/support-request"

/**
 * Écrire à l'exploitant depuis un écran d'accès fermé.
 *
 * ─── CE QUE CE FORMULAIRE REMPLACE, ET POURQUOI ────────────────────────────
 *
 * Un lien `mailto:`. Chez quiconque lit son courrier dans un onglet — la
 * majorité — il ne produisait RIEN : pas d'erreur, pas de fenêtre, rien à
 * l'écran. Le seul recours offert à une personne bloquée dehors était un
 * bouton qui semblait mort.
 *
 * Il pointait de surcroît vers une adresse dont le domaine n'avait aucun
 * serveur de courrier entrant : même ouvert, le message rebondissait.
 *
 * Un écran cul-de-sac ne doit dépendre de rien d'extérieur au produit. Ce
 * formulaire écrit une ligne que la console d'exploitation montre ; le
 * courriel qui l'accompagne n'est qu'un rappel, et sa perte ne perd pas la
 * demande.
 *
 * ─── LE MESSAGE EST OBLIGATOIRE ────────────────────────────────────────────
 *
 * On aurait pu se contenter d'un bouton « prévenir l'exploitant », plus
 * rapide à cliquer. Il aurait produit des avis identiques et muets, et il
 * aurait fallu écrire pour comprendre — soit un aller-retour de plus, à
 * l'endroit du parcours où l'on en a le moins les moyens. Dix caractères
 * suffisent à orienter une réponse.
 */
export function DemandeAide({
  langue,
  labels,
}: {
  langue: string
  labels: Record<string, string>
}) {
  const [resultat, setResultat] = React.useState<ResultatAide | null>(null)
  const [enCours, demarrer] = React.useTransition()

  // Une demande partie ne se rejoue pas : le formulaire cède la place à sa
  // confirmation. Le laisser affiché inviterait à recliquer, et l'index
  // unique refuserait — ce qui ressemblerait à une panne.
  if (resultat?.ok) {
    const attente = resultat.cle === "already"
    return (
      <p
        role="status"
        className="flex items-start gap-2.5 rounded-2xl border border-success/30 bg-success/10 px-4 py-4 text-sm font-medium leading-relaxed text-foreground"
      >
        {attente ? (
          <Clock aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-success" />
        ) : (
          <Check aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-success" />
        )}
        {attente ? labels.helpAlready : labels.helpSent}
      </p>
    )
  }

  return (
    <form
      action={(fd) => demarrer(async () => setResultat(await demanderAide(fd)))}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="langue" value={langue === "en" ? "en" : "fr"} />

      <label htmlFor="message-aide" className="text-xs font-bold text-foreground">
        {labels.helpLabel}
      </label>
      <textarea
        id="message-aide"
        name="message"
        required
        minLength={10}
        maxLength={2000}
        rows={4}
        placeholder={labels.helpPlaceholder}
        className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
      />

      {resultat && !resultat.ok && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-error/30 bg-error/10 px-3 py-2.5 text-xs font-bold text-error"
        >
          <AlertTriangle aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" />
          {resultat.detail ?? labels.helpError}
        </p>
      )}

      <button
        type="submit"
        disabled={enCours}
        className="inline-flex min-h-10 items-center gap-2 self-start rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50"
      >
        <Mail aria-hidden className="h-3.5 w-3.5" />
        {enCours ? labels.helpSending : labels.helpSend}
      </button>
    </form>
  )
}
