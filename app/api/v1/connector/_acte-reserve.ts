import "server-only"

import { NextResponse } from "next/server"
import {
  autoriserAppel,
  journaliserAppel,
  cleDeLaRequete,
  ipDeLaRequete,
} from "@/lib/data/connector-auth"

/**
 * Traitement commun des actes réservés : finaliser, envoyer, signer, annuler.
 *
 * Ces quatre routes répondaient 403 sans rien vérifier — un refus par
 * construction, écrit en dur dans la réponse. Le résultat était juste, mais
 * pour une mauvaise raison : rien ne consultait les réglages du cabinet, et
 * une clé inconnue recevait le même refus qu'une clé légitime, sans que la
 * tentative laisse de trace imputable.
 *
 * Le refus vient désormais de la base, où la liste des actes réservés est
 * tenue par cabinet. Il tient donc même si quelqu'un modifiait ce fichier :
 * connector_authorize() refuserait de toute façon.
 *
 * Distinguer les deux refus compte. « Clé invalide » et « acte réservé à un
 * consultant » n'appellent pas la même correction : le premier est un
 * problème de configuration, le second un rappel déontologique — c'est le
 * cœur de ce que le CICC exige qu'une machine ne fasse pas.
 */
export async function refuserActeReserve(
  request: Request,
  action: "finalize" | "send" | "sign" | "cancel",
  agreementId: string
) {
  const cle = cleDeLaRequete(request)
  const auth = await autoriserAppel(cle, action)

  await journaliserAppel({
    cle,
    action,
    statut: auth.motif.toLowerCase(),
    resume: `Refusé (${auth.motif}) : ${action} sur l'entente ${agreementId}.`,
    ressourceId: agreementId,
    ip: ipDeLaRequete(request),
  })

  if (auth.motif === "RESERVED_HUMAN_ACTION") {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "RESERVED_HUMAN_ACTION",
          message:
            "Acte réservé à un consultant réglementé. Finaliser, envoyer, signer ou annuler une entente se fait dans le tableau de bord, par une personne.",
        },
      },
      { status: 403 }
    )
  }

  // Clé absente, inconnue, révoquée, expirée, cabinet suspendu ou
  // connecteur désactivé : un seul message, pour ne rien apprendre à
  // l'appelant sur l'existence des clés.
  return NextResponse.json(
    {
      success: false,
      error: { code: "UNAUTHORIZED", message: "Clé d'API absente, invalide ou connecteur désactivé." },
    },
    { status: 401 }
  )
}
