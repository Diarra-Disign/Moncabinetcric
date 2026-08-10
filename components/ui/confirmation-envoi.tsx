"use client"

import * as React from "react"
import { AlertTriangle, Send, X, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * La confirmation avant tout envoi vers l'extérieur.
 *
 * Un seul composant pour toute l'application, et c'est le point : une fenêtre
 * par module aurait fini par en avoir une qui oublie de nommer le
 * destinataire — c'est-à-dire celle qui laisse partir un document chez la
 * mauvaise personne.
 *
 * Trois principes, tirés de ce qu'un envoi a d'irréversible :
 *
 * 1. RIEN NE PART AU PREMIER CLIC. Le bouton « Envoyer » ouvre cette fenêtre
 *    et rien d'autre. L'action réelle n'est appelée que depuis « Confirmer ».
 *
 * 2. ON MONTRE À QUI. Le nom seul ne suffit pas : deux clients peuvent
 *    s'appeler Tremblay. C'est l'ADRESSE qui décide où part le document, donc
 *    c'est elle qu'il faut lire avant de confirmer.
 *
 * 3. ANNULER N'EST PAS UN DEMI-ENVOI. Fermer la fenêtre ne change aucun
 *    statut, n'écrit aucune trace, ne produit aucune notification.
 */

export interface DestinataireEnvoi {
  nom: string
  courriel?: string
  telephone?: string
}

export interface ConfirmationEnvoiProps {
  /** Ce que l'utilisateur s'apprête à faire, en une phrase. */
  action: string
  /** Ce qui part : nom du document, numéro de facture, titre du questionnaire. */
  objet: string
  /** Détail secondaire de l'objet : montant, échéance, nombre de pages. */
  objetDetail?: string
  destinataires: DestinataireEnvoi[]
  /** « Courriel », « Portail client », « Lien sécurisé »… */
  mode?: string
  /** Le message qui accompagnera l'envoi, montré tel qu'il partira. */
  message?: string
  /**
   * Avertissement pour un geste qu'on ne rattrape pas. Sa présence suffit à
   * rendre la fenêtre plus insistante — on ne demande pas à l'appelant de
   * penser aussi à changer la couleur.
   */
  irreversible?: string
  /** Libellé du bouton de confirmation. « Confirmer l'envoi » par défaut. */
  libelleConfirmer?: string
  onAnnuler: () => void
  onConfirmer: () => void | Promise<void>
}

export function ConfirmationEnvoi({
  action, objet, objetDetail, destinataires, mode = "Courriel",
  message, irreversible, libelleConfirmer = "Confirmer l'envoi",
  onAnnuler, onConfirmer,
}: ConfirmationEnvoiProps) {
  const [enCours, setEnCours] = React.useState(false)

  // Échap annule, comme partout ailleurs dans l'application — mais seulement
  // tant que rien n'est parti : interrompre l'affichage d'un envoi en cours
  // laisserait l'utilisateur ignorer s'il a eu lieu.
  React.useEffect(() => {
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !enCours) onAnnuler()
    }
    document.addEventListener("keydown", auClavier)
    return () => document.removeEventListener("keydown", auClavier)
  }, [onAnnuler, enCours])

  const sansAdresse = destinataires.filter((d) => !d.courriel?.trim())
  const pluriel = destinataires.length > 1

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={action}
      className="fixed inset-0 z-[300] flex items-center justify-center bg-foreground/50 p-4"
    >
      <div className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl flex flex-col max-h-[92vh]">
        <header className="p-5 border-b border-border flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-foreground">Confirmer l&apos;envoi</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{action}</p>
          </div>
          <button
            type="button"
            onClick={onAnnuler}
            disabled={enCours}
            aria-label="Annuler"
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground cursor-pointer disabled:opacity-40"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <section className="rounded-xl border border-border bg-muted/40 p-4">
            <h3 className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              {pluriel ? "Ce qui sera envoyé" : "Élément à envoyer"}
            </h3>
            <p className="text-sm font-bold text-foreground mt-1">{objet}</p>
            {objetDetail && <p className="text-xs text-muted-foreground mt-0.5">{objetDetail}</p>}
            <p className="text-[11px] text-muted-foreground mt-2">Mode d&apos;envoi : {mode}</p>
          </section>

          <section>
            <h3 className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
              {pluriel ? `${destinataires.length} destinataires` : "Destinataire"}
            </h3>
            <ul className="mt-1 space-y-1.5">
              {destinataires.slice(0, 8).map((d, i) => (
                <li key={i} className="text-xs">
                  <span className="font-bold text-foreground">{d.nom || "Sans nom"}</span>
                  {/* L'adresse est ce qui décide où part le document : elle est
                      montrée en toutes lettres, jamais résumée. */}
                  <span className="block text-muted-foreground">
                    {d.courriel || <span className="text-error-strong font-bold">aucune adresse courriel</span>}
                    {d.telephone ? ` · ${d.telephone}` : ""}
                  </span>
                </li>
              ))}
              {destinataires.length > 8 && (
                <li className="text-[11px] text-muted-foreground">
                  … et {destinataires.length - 8} autres.
                </li>
              )}
            </ul>
            {pluriel && (
              <p className="text-[11px] text-muted-foreground mt-2">
                Chaque destinataire recevra un envoi qui lui est propre.
              </p>
            )}
          </section>

          {message && (
            <section>
              <h3 className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Message</h3>
              <p className="mt-1 rounded-xl border border-border bg-background p-3 text-xs text-foreground whitespace-pre-wrap max-h-40 overflow-y-auto">
                {message}
              </p>
            </section>
          )}

          {sansAdresse.length > 0 && (
            <p className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs text-warning-strong flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              {sansAdresse.length === destinataires.length
                ? "Aucun courriel n'est enregistré : rien ne partira par message, mais un lien vous sera remis à copier."
                : `${sansAdresse.length} destinataire(s) sans adresse : un lien vous sera remis pour eux.`}
            </p>
          )}

          {irreversible && (
            <p className="rounded-xl border border-error/30 bg-error/10 p-3 text-xs text-error-strong flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              {irreversible}
            </p>
          )}
        </div>

        <footer className="p-5 border-t border-border flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onAnnuler}
            disabled={enCours}
            className="px-4 py-2 rounded-xl border border-border font-bold text-xs hover:bg-muted cursor-pointer text-foreground disabled:opacity-40"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={enCours}
            onClick={async () => {
              // Désactivé AVANT l'appel, pas après : entre les deux, un second
              // clic partirait, et le destinataire recevrait deux fois la même
              // chose. Le verrou est ici parce que c'est ici que le doublon
              // naît.
              setEnCours(true)
              try {
                await onConfirmer()
              } finally {
                setEnCours(false)
              }
            }}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs disabled:opacity-60 cursor-pointer",
              irreversible
                ? "bg-error text-white hover:bg-error/90"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            {enCours ? (
              <><Send className="h-4 w-4 animate-pulse" /> Envoi en cours…</>
            ) : (
              <><CheckCircle2 className="h-4 w-4" /> {libelleConfirmer}</>
            )}
          </button>
        </footer>
      </div>
    </div>
  )
}
