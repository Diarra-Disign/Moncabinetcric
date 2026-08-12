import { NextResponse } from "next/server"
import { getSessionSupabase } from "@/lib/supabase/session"
import { pdfDEntente, langueDeLEntente } from "@/lib/ententes/document"

/**
 * Sert le PDF d'une entente de service.
 *
 * Aucun contrôle d'accès n'est écrit ici, et c'est délibéré : la lecture passe
 * par le client de SESSION, donc par Row Level Security. Un membre d'un autre
 * cabinet n'obtient pas la ligne — la requête revient vide, et la route répond
 * 404. Filtrer en plus sur firm_id dans ce fichier donnerait l'illusion que
 * c'est LUI qui protège, et l'oubli du même filtre ailleurs passerait alors
 * inaperçu.
 *
 * Le PDF est RECOMPOSÉ à chaque appel plutôt que servi depuis le stockage, et
 * c'est voulu tant que l'entente est un brouillon : le consultant doit voir ce
 * qu'il vient de modifier. Une fois émise, la composition part du même
 * instantané figé — le document produit ici et celui qui est classé au dossier
 * ne peuvent donc pas diverger.
 */
export async function GET(
  requete: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const sb = await getSessionSupabase()

  // La route vit hors de /[locale] : la langue du document ne peut donc pas se
  // déduire du chemin, elle est demandée explicitement.
  const langue = langueDeLEntente(new URL(requete.url).searchParams.get("lang"))

  const entente = await pdfDEntente(sb, id, langue)
  if (!entente) return new NextResponse("Entente introuvable.", { status: 404 })

  return new NextResponse(Buffer.from(entente.octets), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${entente.reference}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  })
}
