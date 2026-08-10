import { NextResponse } from "next/server"
import { getSessionSupabase } from "@/lib/supabase/session"
import { pdfDeRecu, langueDuDocument } from "@/lib/invoices/document"

/**
 * Sert le reçu d'un paiement.
 *
 * Même principe que le PDF de facture : aucun contrôle d'accès écrit ici, la
 * lecture passe par le client de session et donc par RLS. Un paiement d'un
 * autre cabinet ne revient pas, et la route répond 404.
 *
 * La composition du document a quitté ce fichier pour lib/invoices/document.ts
 * le jour où le reçu a pu s'ENVOYER : c'est ce qui garantit que la pièce jointe
 * au courriel est celle que le consultant vient de regarder.
 */
export async function GET(requete: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sb = await getSessionSupabase()

  const langue = langueDuDocument(new URL(requete.url).searchParams.get("lang"))

  const doc = await pdfDeRecu(sb, id, langue)
  if (!doc) return new NextResponse("Paiement introuvable.", { status: 404 })

  return new NextResponse(Buffer.from(doc.octets), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${doc.numero}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  })
}
