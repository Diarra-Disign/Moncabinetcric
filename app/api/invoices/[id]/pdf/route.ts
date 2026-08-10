import { NextResponse } from "next/server"
import { getSessionSupabase } from "@/lib/supabase/session"
import { pdfDeFacture } from "@/lib/invoices/document"

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

  const doc = await pdfDeFacture(sb, id)
  if (!doc) return new NextResponse("Facture introuvable.", { status: 404 })

  return new NextResponse(Buffer.from(doc.octets), {
    headers: {
      "Content-Type": "application/pdf",
      // « inline » ouvre le PDF dans l'onglet plutôt que de le déposer dans
      // les téléchargements : on veut d'abord le VOIR. Le navigateur offre
      // l'enregistrement depuis sa propre visionneuse.
      "Content-Disposition": `inline; filename="${doc.numero}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  })
}
