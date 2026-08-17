import { NextResponse } from "next/server"
import { getSessionSupabase } from "@/lib/supabase/session"

/**
 * Sert un document du cabinet.
 *
 * Aucun contrôle d'accès n'est écrit ici, et c'est délibéré : la lecture passe
 * par le client de SESSION, donc par Row Level Security. Un membre d'un autre
 * cabinet n'obtient pas la ligne — la requête revient vide, et la route répond
 * 404. Filtrer en plus sur firm_id dans ce fichier donnerait l'illusion que
 * c'est LUI qui protège, et l'oubli du même filtre ailleurs passerait inaperçu.
 *
 * LE FICHIER N'EST PAS SERVI PAR CETTE ROUTE. Elle rend une redirection vers
 * une adresse SIGNÉE valable une heure : le compartiment reste fermé, et le
 * lien expire. Recopier les octets ici ferait transiter chaque document par le
 * serveur applicatif sans rien gagner.
 *
 * VOIR ET TÉLÉCHARGER SONT DEUX GESTES. La route imposait `download` dans tous
 * les cas : « Voir » enregistrait donc le fichier au lieu de l'ouvrir, et il
 * fallait le retrouver dans ses téléchargements pour le lire. `?telecharger=1`
 * demande l'enregistrement ; sans le paramètre, le PDF s'ouvre dans l'onglet.
 */
export async function GET(
  requete: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const sb = await getSessionSupabase()

  const { data: doc } = await sb
    .from("documents")
    .select("id, storage_path, name, category, matter_id")
    .eq("id", id)
    .maybeSingle()

  if (!doc) {
    return new NextResponse("Document introuvable.", { status: 404 })
  }

  const telecharger = new URL(requete.url).searchParams.get("telecharger") === "1"

  // 1. Si le document correspond à une facture, on peut servir son PDF dynamique
  const numMatch = (doc.name || "").match(/FAC-[\w-]+/i)
  if (numMatch) {
    const { data: inv } = await sb
      .from("invoices")
      .select("id, invoice_number")
      .eq("invoice_number", numMatch[0])
      .maybeSingle()

    if (inv) {
      const { pdfDeFacture } = await import("@/lib/invoices/document")
      const pdf = await pdfDeFacture(sb, inv.id, "fr")
      if (pdf) {
        return new NextResponse(Buffer.from(pdf.octets), {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": telecharger
              ? `attachment; filename="${pdf.numero}.pdf"`
              : `inline; filename="${pdf.numero}.pdf"`,
            "Cache-Control": "private, no-store",
          },
        })
      }
    }
  }

  // 2. Si le document est stocké dans Supabase Storage
  if (doc.storage_path) {
    const { data } = await sb.storage
      .from("documents")
      .createSignedUrl(
        String(doc.storage_path),
        3600,
        telecharger ? { download: String(doc.name ?? "document.pdf") } : {}
      )

    if (data?.signedUrl) {
      return NextResponse.redirect(data.signedUrl)
    }
  }

  return new NextResponse("Fichier non disponible pour ce document.", { status: 404 })
}
