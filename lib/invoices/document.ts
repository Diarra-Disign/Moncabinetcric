import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { facturePdf, recuPdf, type LanguePdf } from "./pdf"

/**
 * La langue du document.
 *
 * Il n'existe pas de colonne de langue sur les clients : elle vient donc de
 * l'appelant — la locale de l'écran pour un aperçu, celle portée par l'envoi
 * pour un courriel. Tout ce qui n'est pas « en » retombe sur le français
 * plutôt que de laisser passer une valeur inattendue jusque dans le PDF.
 */
export const langueDuDocument = (v: unknown): LanguePdf => (String(v ?? "") === "en" ? "en" : "fr")

/**
 * Le PDF d'une facture, et ce qu'il faut pour l'envoyer.
 *
 * Cette fonction existe pour que la route qui AFFICHE la facture et l'action
 * qui l'ENVOIE produisent exactement le même document. Deux compositions
 * séparées auraient divergé, et le client aurait reçu par courriel une pièce
 * différente de celle que le consultant a sous les yeux — écart qu'on ne
 * découvre qu'en les comparant, c'est-à-dire jamais.
 */
export async function pdfDeFacture(sb: SupabaseClient, id: string, langue: LanguePdf = "fr") {
  const { data } = await sb
    .from("invoices")
    .select(
      "id, invoice_number, date, due_on, status, client_name, service_description, tax_exempt, " +
        "clients(name, email, residence), matters(reference, rcic), " +
        // Les TAUX viennent avec le reste de l'identité du cabinet : le PDF
        // imprime « TPS 5,000 % » à côté du montant, et un taux qu'on ne lit
        // pas ici serait un taux réécrit en dur ailleurs.
        "firms(name, address, phone, email, rcic_license_number, logo_url, tax_gst_number, tax_qst_number, payment_terms, tax_gst_rate, tax_qst_rate)"
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
      tauxTps: Number(cab?.tax_gst_rate ?? 0),
      tauxTvq: Number(cab?.tax_qst_rate ?? 0),
      exonere: l.tax_exempt === true,
      langue,
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

/**
 * Le PDF d'un reçu, et ce qu'il faut pour l'envoyer.
 *
 * Cette composition vivait DANS la route qui affiche le reçu. Tant que le reçu
 * ne faisait que s'afficher, cela tenait. Du jour où il s'envoie aussi, cela
 * devenait le défaut exact qui avait été corrigé sur la facture : deux
 * compositions séparées finissent par diverger, et le client reçoit une pièce
 * différente de celle que le consultant a sous les yeux — écart qu'on ne
 * découvre qu'en les comparant, c'est-à-dire jamais.
 */
export async function pdfDeRecu(sb: SupabaseClient, id: string, langue: LanguePdf = "fr") {
  const { data: paiement } = await sb
    .from("payments")
    .select(
      "id, amount, paid_on, method, reference, notes, destination, invoice_id, " +
        "clients(name, email), matters(reference), " +
        "firms(name, address, phone, email, rcic_license_number, logo_url, tax_gst_number, tax_qst_number, payment_terms)"
    )
    .eq("id", id)
    .maybeSingle()

  if (!paiement) return null
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
  const montant = Number(p.amount ?? 0)

  const octets = await recuPdf(
    {
      numero,
      date: jour(p.paid_on),
      montant,
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
      langue,
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
    numero,
    montant,
    date: jour(p.paid_on),
    clientNom: client?.name ?? "",
    clientCourriel: client?.email ?? "",
    dossierReference: dossier?.reference ?? "",
    factureNumero,
    enFideicommis: p.destination === "trust",
  }
}
