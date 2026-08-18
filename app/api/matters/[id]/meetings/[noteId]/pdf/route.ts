import { NextResponse } from "next/server"
import { getSessionSupabase } from "@/lib/supabase/session"
import { obtenirNoteRencontre } from "@/lib/data/meeting-notes-actions"
import { compteRenduRencontrePdf } from "@/lib/meeting-notes/pdf"
import { langueDuDocument } from "@/lib/invoices/document"

/**
 * Sert le compte rendu PDF officiel d'une note de rencontre.
 */
export async function GET(
  requete: Request,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  const { id: matterId, noteId } = await params
  const sb = await getSessionSupabase()

  const note = await obtenirNoteRencontre(noteId)
  if (!note) {
    return new NextResponse("Note de rencontre introuvable.", { status: 404 })
  }

  // Charger les informations du cabinet et du dossier/client
  const { data: matterData } = await sb
    .from("matters")
    .select(`
      reference,
      program,
      rcic,
      client_name,
      clients(name, email, phone),
      firms(name, address, phone, email, rcic_license_number, logo_url)
    `)
    .eq("id", note.matterId)
    .maybeSingle()

  const clientInfo = matterData?.clients as unknown as { name?: string; email?: string; phone?: string } | null
  const firmInfo = matterData?.firms as unknown as Record<string, string | null> | null

  const langue = langueDuDocument(new URL(requete.url).searchParams.get("lang"))

  const octets = await compteRenduRencontrePdf(
    {
      note,
      clientName: clientInfo?.name || matterData?.client_name || "Client",
      clientEmail: clientInfo?.email,
      clientPhone: clientInfo?.phone,
      matterReference: matterData?.reference || matterId,
      programName: matterData?.program,
      consultantName: note.createdByName || matterData?.rcic || "Adama Diarra, CRIC",
      consultantLicence: firmInfo?.rcic_license_number || "R-514982",
      langue,
    },
    {
      nom: firmInfo?.name || "Cabinet Immigration Boréale Inc.",
      adresse: firmInfo?.address || "1100, boul. René-Lévesque Ouest, Suite 2100, Montréal (QC) H3B 4X9",
      telephone: firmInfo?.phone || "+1 514 555-0199",
      courriel: firmInfo?.email || "contact@immigrationboreale.ca",
      numeroPermis: firmInfo?.rcic_license_number || "R-514982",
      numeroTps: firmInfo?.tax_gst_number || "",
      numeroTvq: firmInfo?.tax_qst_number || "",
      conditionsPaiement: firmInfo?.payment_terms || "",
      logoUrl: firmInfo?.logo_url || "",
    }
  )

  return new NextResponse(Buffer.from(octets), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${note.reference}_Compte_Rendu.pdf"`,
      "Cache-Control": "private, no-store",
    },
  })
}
