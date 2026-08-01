import { InvoiceRecord } from "../types"

export const MOCK_INVOICES: InvoiceRecord[] = [
  {
    id: "inv-1",
    invoiceNumber: "#FAC-202601",
    clientName: "Les Industries Nordiques Inc. (12 EIMT)",
    serviceDescription: "Mandat Entreprise B2B — Accompagnement, rédaction & dépôt de 12 demandes d'EIMT (Recrutement International)",
    amount: 18500,
    date: "18-05-2026",
    status: "trust_reconciled",
    isTrustAccount: true,
    matterId: "#DOS-35698",
    clientId: "c-4"
  },
  {
    id: "inv-2",
    invoiceNumber: "#FAC-202602",
    clientName: "Dr. S. Rahman",
    serviceDescription: "Honoraires professionnels — Accompagnement Entrée Express, Évaluation ÉDE & Dépôt d'intérêt d'immigration",
    amount: 4200,
    date: "16-05-2026",
    status: "paid",
    isTrustAccount: true,
    matterId: "#DOS-35697",
    clientId: "c-2"
  },
  {
    id: "inv-3",
    invoiceNumber: "#FAC-202603",
    clientName: "Santé Québec Express",
    serviceDescription: "Accompagnement Réglementaire CICC — Programme Santé Québec & Recrutement d'Infirmières Diplômées Hors Canada",
    amount: 14400,
    date: "15-05-2026",
    status: "pending",
    isTrustAccount: true,
    matterId: "#DOS-35696",
    clientId: "c-4"
  },
  {
    id: "inv-4",
    invoiceNumber: "#FAC-202604",
    clientName: "K. Tremblay",
    serviceDescription: "Programme de l'Expérience Québécoise (PEQ Travailleur) — Dépôt CSQ & Résidence Permanente IRCC",
    amount: 3800,
    date: "12-05-2026",
    status: "paid",
    matterId: "#DOS-35695",
    clientId: "c-1"
  }
]
