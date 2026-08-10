import { NextResponse } from "next/server"
import { getSessionSupabase } from "@/lib/supabase/session"
import { pdfDeRapprochement, langueDuDocument } from "@/lib/invoices/document"

/**
 * Sert l'état de rapprochement d'une période.
 *
 * Même principe que les deux autres pièces : aucun contrôle d'accès écrit ici,
 * la lecture passe par la session et donc par RLS. Le rapprochement d'un autre
 * cabinet ne revient pas, et la route répond 404.
 */
export async function GET(requete: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sb = await getSessionSupabase()
  const langue = langueDuDocument(new URL(requete.url).searchParams.get("lang"))

  const doc = await pdfDeRapprochement(sb, id, langue)
  if (!doc) return new NextResponse("Rapprochement introuvable.", { status: 404 })

  return new NextResponse(Buffer.from(doc.octets), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${doc.numero}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  })
}
