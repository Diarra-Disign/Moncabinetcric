"use client"

import * as React from "react"
import {
  FileText,
  Download,
  CheckCircle2,
  Clock,
  AlertCircle,
  CreditCard,
  Receipt,
  ExternalLink,
  ShieldCheck,
  Building2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export interface PortalInvoice {
  id: string
  number: string
  date: string
  dueDate?: string
  subtotal: number
  tax: number
  total: number
  paidAmount: number
  status: "paid" | "partial" | "pending" | "overdue" | "draft"
  matterReference?: string
}

export interface ClientInvoicesViewProps {
  invoices: PortalInvoice[]
  clientName: string
  firmName?: string
}

function formatMontant(n: number) {
  return new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(n)
}

export function ClientInvoicesView({ invoices = [], clientName, firmName }: ClientInvoicesViewProps) {
  const totalFacture = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0)
  const totalPaye = invoices.reduce((sum, inv) => sum + (inv.paidAmount || (inv.status === "paid" ? inv.total : 0)), 0)
  const soldeDu = Math.max(0, totalFacture - totalPaye)

  return (
    <div className="space-y-6">
      {/* 1. Résumé financier client */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl border border-border bg-card shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Facturé</span>
            <Receipt className="h-4 w-4 text-primary" />
          </div>
          <div>
            <span className="text-2xl font-black text-foreground">{formatMontant(totalFacture)}</span>
            <p className="text-[11px] text-muted-foreground mt-0.5">{invoices.length} facture(s) émise(s)</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-success/30 bg-success/5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-success-strong mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Réglé</span>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </div>
          <div>
            <span className="text-2xl font-black text-success-strong">{formatMontant(totalPaye)}</span>
            <p className="text-[11px] text-muted-foreground mt-0.5">Avances & paiements honorés</p>
          </div>
        </div>

        <div className={`p-4 rounded-2xl border shadow-xs flex flex-col justify-between ${
          soldeDu > 0
            ? "border-warning/40 bg-warning/5"
            : "border-border bg-card"
        }`}>
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Solde Restant Dû</span>
            <CreditCard className="h-4 w-4 text-warning" />
          </div>
          <div>
            <span className={`text-2xl font-black ${soldeDu > 0 ? "text-warning-strong" : "text-foreground"}`}>
              {formatMontant(soldeDu)}
            </span>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {soldeDu === 0 ? "Compte parfaitement à jour" : "Paiement en attente selon échéancier"}
            </p>
          </div>
        </div>
      </div>

      {/* 2. Tableau des factures et reçus */}
      <div className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FileText className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Historique des Factures & Reçus
            </h3>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            {firmName || "Cabinet Immigration Boréale Inc."}
          </span>
        </div>

        {invoices.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Receipt className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="text-xs font-bold text-foreground">Aucune facture émise pour le moment</p>
            <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
              Vos factures d&apos;honoraires et de débours IRCC apparaîtront ici dès leur émission par votre consultant.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {invoices.map((inv) => {
              const isPaid = inv.status === "paid"
              const isPartial = inv.status === "partial"
              const isOverdue = inv.status === "overdue"

              return (
                <div
                  key={inv.id}
                  className="p-4 hover:bg-muted/20 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-foreground">
                          {inv.number}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-semibold ${
                            isPaid
                              ? "border-success/30 text-success-strong bg-success/15"
                              : isPartial
                              ? "border-primary/30 text-primary-strong bg-primary/10"
                              : isOverdue
                              ? "border-error/30 text-error-strong bg-error/15"
                              : "border-warning/40 text-warning-strong bg-warning/15"
                          }`}
                        >
                          {isPaid ? "Payée ✓" : isPartial ? "Partielle" : isOverdue ? "En retard" : "En attente"}
                        </Badge>
                        {inv.matterReference && (
                          <span className="text-[11px] font-mono text-muted-foreground">
                            {inv.matterReference}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                        <span>Émise le : {inv.date}</span>
                        {inv.dueDate && (
                          <>
                            <span>·</span>
                            <span>Échéance : {inv.dueDate}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 self-end sm:self-center">
                    <div className="text-right">
                      <div className="font-bold text-sm text-foreground">{formatMontant(inv.total)}</div>
                      <div className="text-[10px] text-muted-foreground">Taxes comprises (CAD)</div>
                    </div>

                    <a
                      href={`/api/invoices/${inv.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card text-foreground text-xs font-semibold hover:border-primary hover:text-primary transition-colors shadow-2xs"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>PDF</span>
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 3. Note de conformité CICC sur le compte en fidéicommis */}
      <div className="p-4 rounded-2xl border border-primary/20 bg-primary/5 flex items-start gap-3 text-xs text-muted-foreground">
        <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold text-foreground">Conformité CICC — Protection de vos fonds</span>
          <p className="leading-relaxed text-[11px]">
            Conformément au Code de déontologie des CRIC, toute avance d&apos;honoraires ou débours est conservée dans un compte bancaire en fidéicommis distinct et inviolable jusqu&apos;à l&apos;accomplissement des services prévus par votre entente.
          </p>
        </div>
      </div>
    </div>
  )
}
