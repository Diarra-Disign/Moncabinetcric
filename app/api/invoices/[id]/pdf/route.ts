import { NextResponse } from "next/server"
import { getSessionSupabase } from "@/lib/supabase/session"
import { facturePdf } from "@/lib/invoices/pdf"

/**
 * Sert le PDF d'une facture.
 *
 * Aucun contrôle d'accès n'est écrit ici, et c'est délibéré : la lecture passe
 * par le client de SESSION, donc par Row Level Security. Un membre d'un autre
 * cabinet n'obtient pas la ligne — la requête revient vide, et la route répond
 * 404. Filtrer en plus sur firm_id dans ce fichier donnerait l'illusion que
 * c'est LUI qui protège, et l'oubli du même filtre ailleurs passerait alors
 * inaperçu.
 *
 * La route vit sous /api, hors du filtre de proxy.ts qui ne couvre que les
 * chemins localisés. Ce n'est pas un trou : sans session valide, le client
 * Supabase n'a aucun droit, et la même requête revient vide.
 */
export async function GET(
  _requete: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const sb = await getSessionSupabase()

  const { data: facture } = await sb
    .from("invoices")
    .select(
      "id, invoice_number, date, due_on, status, client_name, service_description, " +
        "clients(name, email, residence), matters(reference, rcic), firms(name, address, phone, email, rcic_license_number, logo_url, tax_gst_number, tax_qst_number, payment_terms)"
    )
    .eq("id", id)
    .maybeSingle()

  if (!facture) {
    return new NextResponse("Facture introuvable.", { status: 404 })
  }
  const ligne = facture as unknown as Record<string, unknown>

  const [{ data: lignes }, { data: totaux }, { data: regle }] = await Promise.all([
    sb.from("invoice_lines").select("description, quantity, unit_price, taxable, position").eq("invoice_id", id).order("position"),
    sb.rpc("invoice_totals", { p_invoice_id: id }),
    sb.rpc("invoice_paid_amount", { i_id: id }),
  ])

  const t = (Array.isArray(totaux) ? totaux[0] : totaux) ?? { sous_total: 0, tps: 0, tvq: 0, total: 0 }
  const client = ligne.clients as unknown as { name?: string; email?: string; residence?: string } | null
  const dossier = ligne.matters as unknown as { reference?: string; rcic?: string } | null
  const cabinet = ligne.firms as unknown as Record<string, string | null> | null

  const jour = (v: unknown) =>
    v ? new Date(String(v)).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" }) : ""

  const octets = await facturePdf(
    {
      numero: String(ligne.invoice_number),
      date: jour(ligne.date),
      echeance: ligne.due_on ? jour(ligne.due_on) : null,
      statut: String(ligne.status),
      clientNom: client?.name ?? String(ligne.client_name ?? ""),
      clientCourriel: client?.email ?? "",
      clientAdresse: client?.residence ?? "",
      dossierReference: dossier?.reference ?? "",
      consultant: dossier?.rcic ?? "",
      lignes: (lignes ?? []).map((l) => ({
        description: String(l.description),
        quantite: Number(l.quantity),
        prixUnitaire: Number(l.unit_price),
        taxable: l.taxable !== false,
      })),
      sousTotal: Number(t.sous_total ?? 0),
      tps: Number(t.tps ?? 0),
      tvq: Number(t.tvq ?? 0),
      total: Number(t.total ?? 0),
      regle: Number(regle ?? 0),
      notes: String(ligne.service_description ?? ""),
    },
    {
      nom: cabinet?.name ?? "",
      adresse: cabinet?.address ?? "",
      telephone: cabinet?.phone ?? "",
      courriel: cabinet?.email ?? "",
      numeroPermis: cabinet?.rcic_license_number ?? "",
      numeroTps: cabinet?.tax_gst_number ?? "",
      numeroTvq: cabinet?.tax_qst_number ?? "",
      conditionsPaiement: cabinet?.payment_terms ?? "",
      logoUrl: cabinet?.logo_url ?? "",
    }
  )

  return new NextResponse(Buffer.from(octets), {
    headers: {
      "Content-Type": "application/pdf",
      // « inline » ouvre le PDF dans l'onglet plutôt que de le téléverser dans
      // les téléchargements : on veut d'abord le VOIR. Le navigateur offre
      // l'enregistrement depuis sa propre visionneuse.
      "Content-Disposition": `inline; filename="${ligne.invoice_number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  })
}
