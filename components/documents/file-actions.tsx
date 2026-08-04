"use client"

import * as React from "react"
import { UploadCloud, Download, ShieldCheck, Check, AlertTriangle, Loader2 } from "lucide-react"
import { deposerFichier, lienTelechargement, verifierEmpreinte } from "@/lib/data/storage"
import { cn } from "@/lib/utils"

export interface EtiquettesFichier {
  upload: string
  uploadRunning: string
  uploadDone: string
  uploadHint: string
  download: string
  verify: string
  verifyRunning: string
  noFile: string
  fingerprint: string
}

interface ActionsFichierProps {
  documentId: string
  clientId: string
  /** Chemin actuel, ou null si aucun fichier n'est encore déposé. */
  storagePath: string | null
  sha256: string | null
  labels: EtiquettesFichier
  /** Le client du portail ne vérifie pas : c'est un contrôle du cabinet. */
  peutVerifier?: boolean
  onChange?: () => void
}

/**
 * Dépôt, téléchargement et vérification d'un fichier attaché à une fiche.
 *
 * Le même composant sert au cabinet et au portail client : ce sont les
 * politiques du compartiment qui décident de ce qui est permis, pas ce
 * code. Un client qui tenterait de supprimer verrait la base refuser.
 */
export function ActionsFichier({
  documentId,
  clientId,
  storagePath,
  sha256,
  labels,
  peutVerifier = true,
  onChange,
}: ActionsFichierProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [enCours, setEnCours] = React.useState<"depot" | "verif" | null>(null)
  const [message, setMessage] = React.useState<{ ok: boolean; texte: string } | null>(null)

  async function deposer(e: React.ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0]
    if (!fichier) return

    setEnCours("depot")
    setMessage(null)
    const r = await deposerFichier(documentId, clientId, fichier)
    setEnCours(null)

    // Le champ est vidé même en cas de succès : sans cela, redéposer le
    // même fichier après une erreur ne déclencherait aucun événement.
    if (inputRef.current) inputRef.current.value = ""

    setMessage(r.ok ? { ok: true, texte: labels.uploadDone } : { ok: false, texte: r.erreur ?? "Échec" })
    if (r.ok) onChange?.()
  }

  async function telecharger() {
    if (!storagePath) return
    const { url, erreur } = await lienTelechargement(storagePath)
    if (url) window.open(url, "_blank", "noopener,noreferrer")
    else setMessage({ ok: false, texte: erreur ?? "Lien indisponible" })
  }

  async function verifier() {
    setEnCours("verif")
    setMessage(null)
    const r = await verifierEmpreinte(documentId)
    setEnCours(null)
    setMessage({ ok: r.ok, texte: r.message })
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {!storagePath ? (
          <>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={enCours !== null}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
            >
              {enCours === "depot" ? (
                <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <UploadCloud aria-hidden className="h-3.5 w-3.5" />
              )}
              {enCours === "depot" ? labels.uploadRunning : labels.upload}
            </button>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.heic"
              onChange={deposer}
            />
            <span className="text-[11px] text-muted-foreground">{labels.uploadHint}</span>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={telecharger}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Download aria-hidden className="h-3.5 w-3.5" />
              {labels.download}
            </button>

            {peutVerifier && (
              <button
                type="button"
                onClick={verifier}
                disabled={enCours !== null}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
              >
                {enCours === "verif" ? (
                  <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ShieldCheck aria-hidden className="h-3.5 w-3.5" />
                )}
                {enCours === "verif" ? labels.verifyRunning : labels.verify}
              </button>
            )}
          </>
        )}
      </div>

      {sha256 && (
        <p className="font-mono text-[10px] break-all text-muted-foreground">
          <span className="font-sans font-bold uppercase tracking-wider">{labels.fingerprint} </span>
          {sha256}
        </p>
      )}

      {message && (
        <p
          role="status"
          className={cn(
            "flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold",
            message.ok ? "bg-success/10 text-success" : "bg-error/10 text-error"
          )}
        >
          {message.ok ? (
            <Check aria-hidden className="mt-px h-3 w-3 shrink-0" />
          ) : (
            <AlertTriangle aria-hidden className="mt-px h-3 w-3 shrink-0" />
          )}
          {message.texte}
        </p>
      )}
    </div>
  )
}
