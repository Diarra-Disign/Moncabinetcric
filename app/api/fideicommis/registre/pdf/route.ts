import { NextResponse } from "next/server"
import { getRegistreMensuel } from "@/lib/data/trust"
import { getCurrentFirm } from "@/lib/supabase/session"
import { langueDuDocument } from "@/lib/invoices/document"

/**
 * Le registre mensuel du compte client, en PDF.
 *
 * Aucun cabinet n'est transmis par l'appelant : `getRegistreMensuel()` le
 * résout depuis la session, et la fonction SQL revérifie par
 * `peut_lire_cabinet()`. Il n'existe donc aucun paramètre par lequel réclamer
 * le registre d'un autre cabinet — la leçon des dix-sept fonctions du
 * 2026-08-16.
 *
 * `inline` plutôt que `attachment` : le consultant regarde la pièce avant de
 * l'imprimer ou de la classer, et un téléchargement forcé l'oblige à ouvrir un
 * fichier pour voir s'il s'est trompé de mois.
 */
export async function GET(requete: Request) {
  const url = new URL(requete.url)
  const mois = url.searchParams.get("mois") ?? ""
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mois)) {
    return new NextResponse("Mois invalide.", { status: 400 })
  }

  const langue = langueDuDocument(url.searchParams.get("lang"))
  const [registre, cabinet] = await Promise.all([
    getRegistreMensuel(mois),
    getCurrentFirm(),
  ])
  if (!registre) return new NextResponse("Session expirée.", { status: 401 })

  // Le mois en toutes lettres, dans la langue de la pièce. En UTC : le premier
  // du mois lu dans un fuseau à l'ouest reculerait au mois précédent, et
  // l'en-tête annoncerait avril sur un registre de mai.
  const [annee, m] = mois.split("-").map(Number)
  const periode = new Date(Date.UTC(annee, m - 1, 1)).toLocaleDateString(
    langue === "en" ? "en-CA" : "fr-CA",
    { month: "long", year: "numeric", timeZone: "UTC" }
  )

  const { registreMensuelPdf } = await import("@/lib/invoices/pdf")
  const octets = await registreMensuelPdf(
    {
      periode,
      lignes: registre.lignes.map((l) => ({
        nom: l.clientNom,
        dernierMouvement: l.dernierMouvement,
        ouverture: l.ouverture,
        depots: l.depots,
        retraits: l.retraits,
        cloture: l.cloture,
      })),
      totaux: registre.totaux,
      langue,
    },
    {
      nom: cabinet.name ?? "",
      adresse: [cabinet.address, cabinet.city, cabinet.province, cabinet.postalCode]
        .filter(Boolean).join(", "),
      telephone: cabinet.phone ?? "",
      courriel: cabinet.email ?? "",
      numeroPermis: cabinet.rcicNumber ?? "",
      numeroTps: cabinet.taxGstNumber ?? "",
      numeroTvq: "",
      conditionsPaiement: "",
      logoUrl: cabinet.logoUrl ?? "",
    }
  )

  return new NextResponse(Buffer.from(octets), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="registre-compte-client-${mois}.pdf"`,
      // Un état comptable ne se met pas en cache : le mois en cours change à
      // chaque écriture.
      "Cache-Control": "private, no-store",
    },
  })
}
