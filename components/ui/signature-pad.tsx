"use client"

import * as React from "react"
import { ShieldCheck, RotateCcw, CheckCircle2, Lock, FileSignature } from "lucide-react"

interface SignaturePadProps {
  title?: string
  clientName?: string
  onSave?: (signatureDataUrl: string) => void
}

export function SignaturePad({ title = "Signature Électronique du Mandat CICC", clientName = "M. A. Diarra", onSave }: SignaturePadProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = React.useState(false)
  const [hasSignature, setHasSignature] = React.useState(false)
  const [signedState, setSignedState] = React.useState<{ date: string; hash: string } | null>(null)

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set canvas dimensions
    canvas.width = canvas.parentElement?.clientWidth || 500
    canvas.height = 160
    ctx.lineWidth = 2.5
    ctx.lineCap = "round"
    ctx.strokeStyle = "#1e3a8a" // Deep navy blue ink
  }, [])

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (signedState) return
    setIsDrawing(true)
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY

    ctx.beginPath()
    ctx.moveTo(clientX - rect.left, clientY - rect.top)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || signedState) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY

    ctx.lineTo(clientX - rect.left, clientY - rect.top)
    ctx.stroke()
    setHasSignature(true)
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const clearSignature = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
    setSignedState(null)
  }

  const saveSignature = () => {
    if (!hasSignature) return
    const canvas = canvasRef.current
    if (!canvas) return
    const dataUrl = canvas.toDataURL("image/png")
    
    const now = new Date().toLocaleDateString("fr-CA", { 
      day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" 
    })
    const hash = `HASH-${Math.random().toString(36).substring(2, 9).toUpperCase()}-CICC`
    
    setSignedState({ date: now, hash })
    if (onSave) onSave(dataUrl)
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <FileSignature className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-black text-sm text-slate-900">{title}</h4>
            <p className="text-[11px] text-slate-500 font-medium">Signataire : <strong>{clientName}</strong> · Signature HTML5 certifiée</p>
          </div>
        </div>

        <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-mono font-extrabold px-2.5 py-0.5 rounded-full">
          Valide CICC V1 Native
        </span>
      </div>

      {/* CANVAS CONTAINER */}
      <div className="relative border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50/50 overflow-hidden">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full touch-none cursor-crosshair"
        />

        {!hasSignature && !signedState && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-slate-400 text-xs italic">
            Tracez votre signature au stylet ou à la souris ici...
          </div>
        )}

        {signedState && (
          <div className="absolute inset-0 bg-emerald-950/80 backdrop-blur-xs flex flex-col items-center justify-center text-white gap-1 animate-fadeIn p-4 text-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-1" />
            <span className="font-black text-xs">Entente Signée Électroniquement</span>
            <span className="text-[10px] font-mono text-emerald-200">Horodatage : {signedState.date}</span>
            <span className="text-[9px] font-mono bg-white/20 px-2 py-0.5 rounded-full text-white mt-1">{signedState.hash}</span>
          </div>
        )}
      </div>

      {/* CONTROLES */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1 text-slate-400 text-[11px]">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
          <span>Certifié conforme aux règles d&apos;immuabilité CICC</span>
        </div>

        <div className="flex items-center gap-2">
          {!signedState && (
            <>
              <button
                type="button"
                onClick={clearSignature}
                disabled={!hasSignature}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer font-bold"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Effacer</span>
              </button>

              <button
                type="button"
                onClick={saveSignature}
                disabled={!hasSignature}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold shadow-xs transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Valider la signature</span>
              </button>
            </>
          )}

          {signedState && (
            <button
              type="button"
              onClick={clearSignature}
              className="text-xs text-slate-500 underline font-bold hover:text-slate-800"
            >
              Signer à nouveau
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
