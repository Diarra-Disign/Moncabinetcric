import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { facturePdf } from "./pdf"

/**
 * Le PDF d'une facture, et ce qu'il faut pour l'envoyer.
 *
 * Cette fonction existe pour que la route qui AFFICHE la facture et l'action
 * qui l'ENVOIE produisent exactement le même document. Deux compositions
 * séparées auraient divergé, et le client aurait reçu par courriel une pièce
 * différente de celle que le consultant a sous les yeux — écart qu'on ne
 * découvre qu'en les comparant, c'est-à-dire jamais.
 */
export async function pdfDeFacture(sb: SupabaseClient, id: string) {
  const { data } = await sb
    .from("invoices")
    .select(
      "id, invoice_number, date, due_on, status, client_name, service_description, " +
        "clients(name, email, residence), matters(reference, rcic), " +
        "firms(name, address, phone, email, rcic_license_number, logo_url, tax_gst_number, tax_qst_number, payment_terms)"
    )
    .eq("id", id)
    .maybeSingle()

  if (!data) return null
  const l = data as unknown as Record<string, unknown>

  const [{ data: lignes }, { data: totaux }, { data: regle }] = await Promise.all([
    sb.from("invoice_lines").select("description, quantity, unit_price, taxable, position").eq("invoice_id", id).order("position"),
    sb.rpc("invoice_totals", { p_invoice_id: id }),
    sb.rpc("invoice_paid_amount", { i_id: id }),
  ])

  const t = (Array.isArray(totaux) ? totaux[0] : totaux) ?? { sous_total: 0, tps: 0, tvq: 0, total: 0 }
  const client = l.clients as unknown as { name?: string; email?: string; residence?: string } | null
  const dossier = l.matters as unknown as { reference?: string; rcic?: string } | null
  const cab = l.firms as unknown as Record<string, string | null> | null

  const jour = (v: unknown) =>
    v ? new Date(String(v)).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" }) : ""

  const octets = await facturePdf(
    {
      numero: String(l.invoice_number),
      date: jour(l.date),
      echeance: l.due_on ? jour(l.due_on) : null,
      statut: String(l.status),
      clientNom: client?.name ?? String(l.client_name ?? ""),
      clientCourriel: client?.email ?? "",
      clientAdresse: client?.residence ?? "",
      dossierReference: dossier?.reference ?? "",
      consultant: dossier?.rcic ?? "",
      lignes: (lignes ?? []).map((x) => ({
        description: String(x.description),
        quantite: Number(x.quantity),
        prixUnitaire: Number(x.unit_price),
        taxable: x.taxable !== false,
      })),
      sousTotal: Number(t.sous_total ?? 0),
      tps: Number(t.tps ?? 0),
      tvq: Number(t.tvq ?? 0),
      total: Number(t.total ?? 0),
      regle: Number(regle ?? 0),
      notes: String(l.service_description ?? ""),
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

  return {
    octets,
    numero: String(l.invoice_number),
    statut: String(l.status),
    total: Number(t.total ?? 0),
    echeance: l.due_on ? jour(l.due_on) : "",
    clientNom: client?.name ?? String(l.client_name ?? ""),
    clientCourriel: client?.email ?? "",
    dossierReference: dossier?.reference ?? "",
  }
}
