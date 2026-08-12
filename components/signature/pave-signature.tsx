"use client"

import * as React from "react"
import { Eraser, PenLine, Type } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Le pavé de signature — dessiné ou typographié.
 *
 * ─── POURQUOI UN SECOND PAVÉ ───────────────────────────────────────────────
 *
 * `components/ui/signature-pad.tsx` existe, mais il est soudé à l'ancien
 * parcours : il gère lui-même son état « signé », affiche une empreinte, et
 * emploie SEIZE couleurs Tailwind écrites en dur — `bg-blue-50`,
 * `text-slate-900`, `bg-emerald-50` — au lieu des jetons du système. Il ne
 * suivrait aucun des cinq thèmes du produit.
 *
 * Celui-ci ne fait qu'une chose : recueillir un tracé et le rendre. L'ancien
 * sera remplacé quand son écran le sera, pas avant — retirer un composant
 * encore monté ailleurs casserait un chemin qui fonctionne.
 *
 * ─── LE DOIGT D'ABORD ──────────────────────────────────────────────────────
 *
 * La plupart des gens signeront sur un téléphone. Le canevas suit donc la
 * largeur disponible, capture les événements de POINTEUR — souris, doigt et
 * stylet par la même voie — et `touch-action: none` empêche la page de défiler
 * pendant qu'on signe. Sans cette dernière ligne, chaque trait fait bouger la
 * page et la signature devient illisible.
 */

export type ModeTrace = "dessin" | "texte"

const POLICES = [
  { cle: "cursive", nom: "Manuscrite", css: '"Segoe Script", "Bradley Hand", cursive' },
  { cle: "serif", nom: "Classique", css: 'Georgia, "Times New Roman", serif' },
  { cle: "sans", nom: "Moderne", css: 'system-ui, -apple-system, sans-serif' },
]

export function PaveSignature({
  nom,
  onChange,
  libelle = "Votre signature",
}: {
  /** Le nom du signataire, pour la signature typographique. */
  nom: string
  /** Le tracé, en data: URI. Vide quand rien n'est signé. */
  onChange: (trace: string | null) => void
  libelle?: string
}) {
  const [mode, setMode] = React.useState<ModeTrace>("dessin")
  const [police, setPolice] = React.useState(POLICES[0])
  const [vide, setVide] = React.useState(true)
  const canevas = React.useRef<HTMLCanvasElement>(null)
  const dessine = React.useRef(false)
  /**
   * Le dernier tracé, gardé pour survivre à un redimensionnement.
   *
   * LE DÉFAUT QUE CECI CORRIGE, trouvé en regardant une capture d'écran :
   * changer la taille d'un canevas EFFACE son contenu. Le pavé se
   * redimensionnait à chaque événement `resize` — et la signature disparaissait
   * sans un mot. Sur un téléphone, cela arrive dès qu'on pivote l'appareil ou
   * que le clavier s'ouvre : le moment exact où l'on vient de signer.
   */
  const dernierTrace = React.useRef<string | null>(null)

  /** Ajuste la résolution du canevas à celle de l'écran, sans perdre le tracé. */
  const dimensionner = React.useCallback(() => {
    const c = canevas.current
    if (!c) return
    const rect = c.getBoundingClientRect()
    const ratio = window.devicePixelRatio || 1
    const largeurVoulue = Math.round(rect.width * ratio)
    const hauteurVoulue = Math.round(rect.height * ratio)

    // Rien à faire si la taille n'a pas bougé : redimensionner pour rien
    // effacerait le canevas pour rien.
    if (c.width === largeurVoulue && c.height === hauteurVoulue) return

    const aRestaurer = dernierTrace.current
    c.width = largeurVoulue
    c.height = hauteurVoulue

    const ctx = c.getContext("2d")
    if (!ctx) return
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 2.2
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    // La couleur du trait vient du jeton, relu à chaud : le pavé suit donc le
    // thème du visiteur, y compris s'il en change en cours de route.
    ctx.strokeStyle =
      getComputedStyle(document.documentElement).getPropertyValue("--color-foreground").trim() ||
      "#0f172a"

    // On remet ce qui avait été signé. L'image est redessinée à la NOUVELLE
    // taille : le tracé s'étire un peu, ce qui vaut infiniment mieux que de
    // disparaître.
    if (aRestaurer) {
      const img = new Image()
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height)
      img.src = aRestaurer
    }
  }, [])

  React.useEffect(() => {
    dimensionner()
    window.addEventListener("resize", dimensionner)
    return () => window.removeEventListener("resize", dimensionner)
  }, [dimensionner])

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const commencer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canevas.current?.getContext("2d")
    if (!ctx) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dessine.current = true
    const p = point(e)
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
  }

  const tracer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dessine.current) return
    const ctx = canevas.current?.getContext("2d")
    if (!ctx) return
    const p = point(e)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    if (vide) setVide(false)
  }

  const finir = () => {
    if (!dessine.current) return
    dessine.current = false
    const c = canevas.current
    if (c && !vide) {
      const trace = c.toDataURL("image/png")
      dernierTrace.current = trace
      onChange(trace)
    }
  }

  const effacer = () => {
    const c = canevas.current
    const ctx = c?.getContext("2d")
    if (c && ctx) ctx.clearRect(0, 0, c.width, c.height)
    dernierTrace.current = null
    setVide(true)
    onChange(null)
  }

  /**
   * La signature typographique : le nom rendu dans une police manuscrite, puis
   * transformé en image. Elle est produite par le MÊME chemin que le tracé —
   * une image — pour que la suite du système n'ait pas deux formes à connaître.
   */
  const composerTexte = React.useCallback((cssPolice: string) => {
    if (!nom.trim()) { onChange(null); return }
    const c = document.createElement("canvas")
    const ratio = window.devicePixelRatio || 1
    c.width = 600 * ratio
    c.height = 160 * ratio
    const ctx = c.getContext("2d")
    if (!ctx) return
    ctx.scale(ratio, ratio)
    ctx.fillStyle =
      getComputedStyle(document.documentElement).getPropertyValue("--color-foreground").trim() ||
      "#0f172a"
    ctx.font = `44px ${cssPolice}`
    ctx.textBaseline = "middle"
    ctx.fillText(nom, 20, 80)
    const trace = c.toDataURL("image/png")
    dernierTrace.current = trace
    onChange(trace)
    setVide(false)
  }, [nom, onChange])

  const choisirMode = (m: ModeTrace) => {
    setMode(m)
    effacer()
    if (m === "texte") composerTexte(police.css)
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold text-foreground">{libelle}</span>
        <div className="flex items-center gap-1" role="group" aria-label="Mode de signature">
          {([["dessin", "Dessiner", PenLine], ["texte", "Saisir", Type]] as const).map(
            ([cle, texte, Icone]) => (
              <button
                key={cle}
                type="button"
                aria-pressed={mode === cle}
                onClick={() => choisirMode(cle)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-colors cursor-pointer",
                  mode === cle
                    ? "border-primary bg-primary/10 text-primary-strong"
                    : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                <Icone className="h-3.5 w-3.5" aria-hidden />
                {texte}
              </button>
            )
          )}
        </div>
      </div>

      {mode === "dessin" ? (
        <div className="relative">
          <canvas
            ref={canevas}
            // `touch-none` : sans lui, chaque trait fait défiler la page sur un
            // téléphone, et la signature devient illisible.
            className="h-40 w-full touch-none rounded-xl border-2 border-dashed border-border bg-card"
            onPointerDown={commencer}
            onPointerMove={tracer}
            onPointerUp={finir}
            onPointerLeave={finir}
            aria-label="Zone de signature — dessinez avec le doigt, la souris ou un stylet"
          />
          {vide && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-muted-foreground"
            >
              Signez ici
            </span>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div
            className="flex h-40 items-center rounded-xl border-2 border-dashed border-border bg-card px-5"
            style={{ fontFamily: police.css, fontSize: "2.1rem" }}
          >
            <span className="truncate text-foreground">{nom || "—"}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {POLICES.map((p) => (
              <button
                key={p.cle}
                type="button"
                aria-pressed={police.cle === p.cle}
                onClick={() => { setPolice(p); composerTexte(p.css) }}
                className={cn(
                  "rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-colors cursor-pointer",
                  police.cle === p.cle
                    ? "border-primary bg-primary/10 text-primary-strong"
                    : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                {p.nom}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          Le tracé accompagne la signature. Ce qui fait foi est l&apos;empreinte du
          document, figée au moment où vous signez.
        </p>
        <button
          type="button"
          onClick={effacer}
          disabled={vide}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-bold text-foreground hover:bg-muted disabled:opacity-40 cursor-pointer"
        >
          <Eraser className="h-3.5 w-3.5" aria-hidden /> Effacer
        </button>
      </div>
    </div>
  )
}
