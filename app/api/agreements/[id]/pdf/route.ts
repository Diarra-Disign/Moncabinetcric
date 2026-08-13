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
 * ─── DEUX SOURCES, ET L'ORDRE COMPTE ───────────────────────────────────────
 *
 * SI L'ENTENTE A ÉTÉ SIGNÉE, on sert le fichier signé. Cette route recomposait
 * l'entente à chaque appel, y compris après signature — elle affichait donc le
 * contrat SANS les signatures apposées et SANS les pages de certificat, qui
 * n'existent que dans le fichier produit par `finaliser()`. C'était la version
 * que le consultant montrait à un client qui réclamait son contrat signé.
 *
 * Le commentaire précédent affirmait que les deux versions « ne peuvent donc
 * pas diverger ». C'est vrai à l'émission, puisque la composition part du même
 * instantané figé. C'est faux après signature : le document signé porte en plus
 * ce que la signature y a ajouté.
 *
 * SINON on recompose, et c'est nécessaire tant que l'entente est un brouillon :
 * le consultant doit voir ce qu'il vient de modifier.
 */
export async function GET(
  requete: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const sb = await getSessionSupabase()

  // Le document signé, s'il existe. On part de l'entente pour atteindre son
  // document émis, puis de la demande de signature qui le vise. Deux sauts
  // plutôt qu'un parce que `agreements.document_id` désigne l'ORIGINAL — celui
  // qu'on a envoyé signer — jamais le résultat.
  const { data: entente } = await sb
    .from("agreements")
    .select("document_id, reference")
    .eq("id", id)
    .maybeSingle()

  if (entente?.document_id) {
    const { data: demande } = await sb
      .from("signature_requests")
      .select("signed_document_id")
      .eq("document_id", entente.document_id)
      .not("signed_document_id", "is", null)
      .limit(1)
      .maybeSingle()

    if (demande?.signed_document_id) {
      const { data: doc } = await sb
        .from("documents")
        .select("storage_path, name")
        .eq("id", demande.signed_document_id)
        .maybeSingle()

      if (doc?.storage_path) {
        const { data: lien } = await sb.storage
          .from("documents")
          .createSignedUrl(String(doc.storage_path), 60)

        // REDIRECTION plutôt que relais : les octets ne transitent pas par le
        // serveur applicatif, comme dans /api/documents/[id]. Si le lien signé
        // échoue, on retombe sur la recomposition — mieux vaut le contrat non
        // signé qu'une page d'erreur.
        if (lien?.signedUrl) return NextResponse.redirect(lien.signedUrl)
      }
    }
  }

  // La route vit hors de /[locale] : la langue du document ne peut donc pas se
  // déduire du chemin, elle est demandée explicitement.
  const langue = langueDeLEntente(new URL(requete.url).searchParams.get("lang"))

  const compose = await pdfDEntente(sb, id, langue)
  if (!compose) return new NextResponse("Entente introuvable.", { status: 404 })

  return new NextResponse(Buffer.from(compose.octets), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${compose.reference}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  })
}
