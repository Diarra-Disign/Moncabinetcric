import { NextResponse } from "next/server"
import { getSessionSupabase } from "@/lib/supabase/session"
import { recuPdf } from "@/lib/invoices/pdf"

/**
 * Sert le reçu d'un paiement.
 *
 * Même principe que le PDF de facture : aucun contrôle d'accès écrit ici, la
 * lecture passe par le client de session et donc par RLS. Un paiement d'un
 * autre cabinet ne revient pas, et la route répond 404.
 */
export async function GET(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sb = await getSessionSupabase()

  const { data: paiement } = await sb
    .from("payments")
    .select(
      "id, amount, paid_on, method, reference, notes, destination, invoice_id, " +
        "clients(name, email), matters(reference), " +
        "firms(name, address, phone, email, rcic_license_number, logo_url, tax_gst_number, tax_qst_number, payment_terms)"
    )
    .eq("id", id)
    .maybeSingle()

  if (!paiement) return new NextResponse("Paiement introuvable.", { status: 404 })
  const p = paiement as unknown as Record<string, unknown>

  // La facture est facultative : un acompte peut être encaissé avant toute
  // facturation, et le reçu doit exister quand même — c'est même là qu'il
  // compte le plus, puisque rien d'autre n'atteste l'encaissement.
  let factureNumero = ""
  let factureTotal = 0
  let dejaRegle = 0
  if (p.invoice_id) {
    const [{ data: f }, { data: totaux }, { data: regle }] = await Promise.all([
      sb.from("invoices").select("invoice_number").eq("id", String(p.invoice_id)).maybeSingle(),
      sb.rpc("invoice_totals", { p_invoice_id: String(p.invoice_id) }),
      sb.rpc("invoice_paid_amount", { i_id: String(p.invoice_id) }),
    ])
    factureNumero = String((f as { invoice_number?: string } | null)?.invoice_number ?? "")
    const t = (Array.isArray(totaux) ? totaux[0] : totaux) ?? { total: 0 }
    factureTotal = Number(t.total ?? 0)
    dejaRegle = Number(regle ?? 0)
  }

  const client = p.clients as unknown as { name?: string; email?: string } | null
  const dossier = p.matters as unknown as { reference?: string } | null
  const cab = p.firms as unknown as Record<string, string | null> | null

  const jour = (v: unknown) =>
    v ? new Date(String(v)).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" }) : ""

  // Le numéro du reçu dérive de celui du paiement : il est unique parce que
  // l'identifiant l'est, et il ne demande aucune séquence à maintenir.
  const numero = `REC-${String(p.id).slice(0, 8).toUpperCase()}`

  const octets = await recuPdf(
    {
      numero,
      date: jour(p.paid_on),
      montant: Number(p.amount ?? 0),
      mode: String(p.method ?? ""),
      reference: String(p.reference ?? ""),
      notes: String(p.notes ?? ""),
      clientNom: client?.name ?? "",
      clientCourriel: client?.email ?? "",
      dossierReference: dossier?.reference ?? "",
      factureNumero,
      factureTotal,
      dejaRegle,
      enFideicommis: p.destination === "trust",
    },
    {
      nom: cab?.name ?? "",
      adresse: cab?.address ?? "",
      telephone: cab?.phone ?? "",
      courriel: cab?.email ?? "",
      numeroPermis: cab?.rcic_license_number ?? "",
      numeroTps: cab?.tax_gst_number ?? "",
      numeroTvq: cab?.tax_qst_number ?? "",
      conditionsPaiement: cab?.payment_terms ?? "",
      logoUrl: cab?.logo_url ?? "",
    }
  )

  return new NextResponse(Buffer.from(octets), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${numero}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  })
}
