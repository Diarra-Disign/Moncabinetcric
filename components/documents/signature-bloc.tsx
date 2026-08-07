"use client"

import * as React from "react"
import {
  PenLine,
  Send,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  Check,
  Info,
} from "lucide-react"
import { SignaturePad } from "@/components/ui/signature-pad"
import { demanderSignature, signer, etatSignature, type EtatSignature } from "@/lib/data/signatures"
import { cn } from "@/lib/utils"

interface SignatureBlocProps {
  documentId: string
  documentName: string
  /** Nom affiché dans le bloc de signature. */
  signataire: string
}

/**
 * Bloc de signature d'un document.
 *
 * Sert au cabinet comme au portail client : c'est l'état renvoyé par le
 * serveur qui détermine ce qui est proposé, et ce sont les politiques de la
 * base qui refusent le reste. Un client ne verra jamais le bouton
 * « Envoyer en signature », et le lui afficher ne lui donnerait rien.
 *
 * Le tracé manuscrit est recueilli à titre illustratif. Ce qui est
 * enregistré et fait preuve, c'est l'empreinte du fichier figée par la base
 * à l'instant de la signature.
 */
export function SignatureBloc({ documentId, documentName, signataire }: SignatureBlocProps) {
  const [etat, setEtat] = React.useState<EtatSignature | null>(null)
  const [enCours, setEnCours] = React.useState(false)
  const [message, setMessage] = React.useState<{ ok: boolean; texte: string } | null>(null)
  const [padOuvert, setPadOuvert] = React.useState(false)

  const recharger = React.useCallback(async () => {
    const res = await etatSignature(documentId)
    setEtat(res)
  }, [documentId])

  React.useEffect(() => {
    let actif = true
    void etatSignature(documentId).then((res) => {
      if (actif) setEtat(res)
    })
    return () => {
      actif = false
    }
  }, [documentId])

  async function envoyer() {
    setEnCours(true)
    setMessage(null)
    const r = await demanderSignature(documentId)
    setEnCours(false)
    setMessage(r.ok ? { ok: true, texte: "Document envoyé en signature." } : { ok: false, texte: r.erreur ?? "Échec" })
    if (r.ok) await recharger()
  }

  async function apposer(trace: string) {
    if (!etat?.requestId) return
    setEnCours(true)
    setMessage(null)
    const r = await signer(etat.requestId, trace)
    setEnCours(false)
    setPadOuvert(false)
    setMessage(
      r.ok
        ? { ok: true, texte: `Signature enregistrée. Empreinte : ${r.empreinte?.slice(0, 24)}…` }
        : { ok: false, texte: r.erreur ?? "Échec" }
    )
    if (r.ok) await recharger()
  }

  if (!etat) {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" /> Chargement…
      </p>
    )
  }

  // Sans fichier déposé, il n'y a rien à signer : le dire plutôt que
  // proposer une action qui échouerait.
  if (!etat.fichierPresent) {
    return (
      <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
        <Info aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" />
        Déposez d&apos;abord un fichier : la signature porte sur son contenu.
      </p>
    )
  }

  const divergence = etat.signatures.some((s) => !s.stillMatching)

  return (
    <div className="space-y-3">
      {/* Signatures déjà apposées */}
      {etat.signatures.length > 0 && (
        <ul className="space-y-1.5">
          {etat.signatures.map((s, i) => (
            <li
              key={i}
              className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-lg border border-border bg-card px-3 py-2"
            >
              <Check aria-hidden className="h-3.5 w-3.5 shrink-0 text-success" />
              <span className="text-xs font-bold text-foreground">{s.signerName}</span>
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">
                {s.signerKind === "member" ? s.signerRole ?? "cabinet" : "client"}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {new Date(s.signedAt).toLocaleString("fr-CA")}
              </span>
              <span
                className={cn(
                  "ml-auto font-mono text-[10px]",
                  s.stillMatching ? "text-success" : "text-error font-bold"
                )}
              >
                {s.stillMatching ? "document inchangé" : "DOCUMENT MODIFIÉ DEPUIS"}
              </span>
            </li>
          ))}
        </ul>
      )}

      {divergence && (
        <p className="flex items-start gap-2 rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-[11px] font-medium text-error">
          <AlertTriangle aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" />
          Le fichier actuel ne correspond plus à celui qui a été signé. Les signatures
          ci-dessus portent sur une version antérieure.
        </p>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        {!etat.requestId && etat.peutDemander && (
          <button
            type="button"
            onClick={envoyer}
            disabled={enCours}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50"
          >
            {enCours ? (
              <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send aria-hidden className="h-3.5 w-3.5" />
            )}
            Envoyer en signature
          </button>
        )}

        {etat.requestId && !etat.dejaSigne && (
          <button
            type="button"
            onClick={() => setPadOuvert((v) => !v)}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <PenLine aria-hidden className="h-3.5 w-3.5" />
            Signer
          </button>
        )}

        {etat.requestId && etat.dejaSigne && (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-success/10 px-3 py-1.5 text-xs font-bold text-success">
            <ShieldCheck aria-hidden className="h-3.5 w-3.5" />
            Vous avez signé
          </span>
        )}

        {etat.expiresAt && !etat.dejaSigne && (
          <span className="font-mono text-[10px] text-muted-foreground">
            à signer avant le {new Date(etat.expiresAt).toLocaleDateString("fr-CA")}
          </span>
        )}
      </div>

      {padOuvert && etat.requestId && (
        <div className="rounded-2xl border border-border p-1">
          <SignaturePad
            title={`Signature — ${documentName}`}
            clientName={signataire}
            onSave={apposer}
          />
        </div>
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
