"use client"

import * as React from "react"
import { FileText, Eye, Send, CheckCircle2, Clock, Loader2, Stamp } from "lucide-react"
import { emettreEntente, envoyerPourSignature, type EntenteListee } from "@/lib/data/ententes-actions"
import { cn } from "@/lib/utils"

/**
 * Les ententes réelles du cabinet, et ce qu'on peut en faire.
 *
 * TROIS ÉTATS, TROIS GESTES, ET PAS PLUS. Un brouillon s'émet ; une entente
 * émise s'envoie en signature ; une entente signée se relit. Offrir les trois
 * boutons en permanence obligerait à découvrir le refus après l'avoir cliqué —
 * et « Émettre » sur un contrat déjà signé n'est pas une erreur qu'on veut
 * expliquer après coup.
 *
 * Le PDF s'ouvre par une route, pas par un téléchargement forcé : on veut
 * d'abord le VOIR. Le navigateur offre l'enregistrement depuis sa visionneuse.
 */

const ETATS: Record<string, { libelle: string; classe: string; Icone: typeof FileText }> = {
  draft: {
    libelle: "Brouillon",
    classe: "bg-muted text-foreground border-border",
    Icone: FileText,
  },
  ready: {
    libelle: "Émise",
    classe: "bg-primary/10 text-primary-strong border-primary/30",
    Icone: Stamp,
  },
  sent: {
    libelle: "En attente de signature",
    classe: "bg-warning/15 text-warning-strong border-warning/40",
    Icone: Clock,
  },
  viewed: {
    libelle: "Consultée",
    classe: "bg-warning/15 text-warning-strong border-warning/40",
    Icone: Clock,
  },
  partially_signed: {
    libelle: "Partiellement signée",
    classe: "bg-warning/15 text-warning-strong border-warning/40",
    Icone: Clock,
  },
  signed: {
    libelle: "Signée",
    classe: "bg-success/15 text-success-strong border-success/40",
    Icone: CheckCircle2,
  },
  declined: { libelle: "Refusée", classe: "bg-muted text-muted-foreground border-border", Icone: FileText },
  expired: { libelle: "Expirée", classe: "bg-muted text-muted-foreground border-border", Icone: FileText },
  cancelled: { libelle: "Annulée", classe: "bg-muted text-muted-foreground border-border", Icone: FileText },
}

const argent = (v: number) =>
  new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(v)

const BOUTON =
  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-colors " +
  "disabled:opacity-50 disabled:cursor-not-allowed"

export function ListeEntentes({ ententes }: { ententes: EntenteListee[] }) {
  const [enCours, setEnCours] = React.useState<string | null>(null)
  const [message, setMessage] = React.useState<{ ok: boolean; texte: string } | null>(null)

  const agir = async (id: string, action: () => Promise<{ ok: boolean; message: string }>) => {
    setEnCours(id)
    setMessage(null)
    const r = await action()
    setMessage({ ok: r.ok, texte: r.message })
    setEnCours(null)
    // La liste vient du serveur : après une émission, elle doit être relue,
    // sinon le bouton « Émettre » resterait offert sur une entente qui l'est
    // déjà, et le second clic serait refusé sans que l'écran l'explique.
    if (r.ok) window.location.reload()
  }

  if (ententes.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <FileText className="w-8 h-8 mx-auto text-muted-foreground" />
        <p className="mt-3 text-sm font-bold text-foreground">Aucune entente pour l&apos;instant</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Créez-en une : le contractant, les honoraires et les articles se remplissent depuis la fiche.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {message && (
        <p
          role="status"
          className={cn(
            "px-4 py-2.5 text-xs font-semibold border-b border-border",
            message.ok ? "bg-success/10 text-success-strong" : "bg-destructive/10 text-destructive"
          )}
        >
          {message.texte}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/60 text-muted-foreground">
            <tr>
              <th className="py-3 px-4 font-bold">Référence</th>
              <th className="py-3 px-4 font-bold">Contractant</th>
              <th className="py-3 px-4 font-bold">Objet</th>
              <th className="py-3 px-4 font-bold text-right">Total</th>
              <th className="py-3 px-4 font-bold text-center">État</th>
              <th className="py-3 px-4 font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ententes.map((e) => {
              const etat = ETATS[e.statut] ?? ETATS.draft
              const occupe = enCours === e.id
              return (
                <tr key={e.id} className="hover:bg-muted/50 transition-colors">
                  <td className="py-3 px-4 whitespace-nowrap">
                    <strong className="block font-mono font-bold text-foreground">{e.reference}</strong>
                    <span className="text-[11px] text-muted-foreground font-mono">{e.date}</span>
                  </td>
                  <td className="py-3 px-4 font-bold text-foreground">{e.contractant}</td>
                  <td className="py-3 px-4 max-w-[240px] truncate text-foreground">{e.titre}</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-foreground whitespace-nowrap">
                    {/* Pro bono : « 0,00 $ » se lirait comme une grille tarifaire
                        non remplie, alors que l'absence d'honoraires est le
                        propos même du contrat. */}
                    {e.proBono ? "Pro bono" : argent(e.total)}
                  </td>
                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border",
                        etat.classe
                      )}
                    >
                      <etat.Icone className="w-3.5 h-3.5" />
                      <span>{etat.libelle}</span>
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-2">
                      <a
                        href={`/api/agreements/${e.id}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(BOUTON, "bg-muted hover:bg-border text-foreground")}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Voir le PDF</span>
                      </a>

                      {e.statut === "draft" && (
                        <button
                          onClick={() => agir(e.id, () => emettreEntente(e.id))}
                          disabled={occupe}
                          className={cn(BOUTON, "bg-primary text-primary-foreground hover:opacity-90")}
                        >
                          {occupe ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Stamp className="w-3.5 h-3.5" />}
                          <span>Émettre</span>
                        </button>
                      )}

                      {e.statut === "ready" && e.documentId && (
                        <button
                          onClick={() => agir(e.id, () => envoyerPourSignature(e.id))}
                          disabled={occupe}
                          className={cn(BOUTON, "bg-primary text-primary-foreground hover:opacity-90")}
                        >
                          {occupe ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          <span>Envoyer pour signature</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
