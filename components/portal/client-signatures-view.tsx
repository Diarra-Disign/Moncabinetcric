"use client"

import React from "react"
import { PenLine, FileText, CheckCircle2, Clock, ArrowRight, ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export interface PortalSignatureItem {
  id: string
  title: string
  reference?: string
  status: "pending" | "signed" | "declined" | "expired"
  createdAt?: string
  signedAt?: string
  signUrl?: string
  documentName?: string
}

interface ClientSignaturesViewProps {
  signatures?: PortalSignatureItem[]
  isReadOnlyPreview?: boolean
}

export function ClientSignaturesView({
  signatures = [],
  isReadOnlyPreview = false,
}: ClientSignaturesViewProps) {
  const enAttente = signatures.filter((s) => s.status === "pending")

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <PenLine className="h-5 w-5 text-primary" />
          <h2 className="text-base font-black tracking-tight text-foreground">
            Mes Ententes & Signatures Électroniques
          </h2>
        </div>
        {enAttente.length > 0 && (
          <Badge variant="outline" className="bg-warning/15 text-warning-strong border-warning/40 font-bold text-xs self-start">
            <Clock className="h-3.5 w-3.5 mr-1" /> {enAttente.length} signature{enAttente.length > 1 ? "s" : ""} en attente
          </Badge>
        )}
      </div>

      {signatures.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-6 py-8 text-center bg-card">
          <ShieldCheck className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
          <p className="text-xs font-bold text-foreground">Aucun document en attente de signature</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 max-w-sm mx-auto">
            Vos ententes de services professionnels et contrats CICC apparaîtront ici pour signature électronique.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {signatures.map((sig) => {
            const isPending = sig.status === "pending"
            const isSigned = sig.status === "signed"

            return (
              <div
                key={sig.id}
                className="p-4 rounded-2xl border border-border bg-card shadow-2xs flex flex-col justify-between gap-3 hover:border-primary/30 transition-all"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold ${
                        isPending
                          ? "bg-warning/15 text-warning-strong border-warning/40"
                          : isSigned
                          ? "bg-success/15 text-success-strong border-success/30"
                          : "bg-muted text-muted-foreground border-border"
                      }`}
                    >
                      {isPending ? "À signer" : isSigned ? "Signé ✓" : "Clôturé"}
                    </Badge>

                    {sig.reference && (
                      <span className="text-[10px] font-mono font-semibold text-muted-foreground">
                        {sig.reference}
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-bold text-foreground leading-snug">
                    {sig.title}
                  </h3>

                  {sig.documentName && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="truncate">{sig.documentName}</span>
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t border-border/60 flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">
                    {isSigned && sig.signedAt
                      ? `Signé le ${new Date(sig.signedAt).toLocaleDateString("fr-CA")}`
                      : isPending
                      ? "Conforme CICC"
                      : "Document archivé"}
                  </span>

                  {isPending ? (
                    isReadOnlyPreview ? (
                      <span className="text-[11px] font-bold text-muted-foreground bg-muted px-2.5 py-1 rounded-lg cursor-not-allowed">
                        Réservé au client
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        className="h-8 text-xs font-bold gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
                        onClick={() => {
                          if (sig.signUrl) window.location.href = sig.signUrl
                        }}
                      >
                        <span>Signer l&apos;entente</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    )
                  ) : (
                    <span className="text-xs font-bold text-success-strong flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4 text-success" /> Validé
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
