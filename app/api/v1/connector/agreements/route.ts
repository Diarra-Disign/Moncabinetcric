import { NextResponse } from "next/server"
import {
  autoriserAppel,
  journaliserAppel,
  cleDeLaRequete,
  ipDeLaRequete,
} from "@/lib/data/connector-auth"

/**
 * Ententes de service, vues par le connecteur.
 *
 * Ces routes lisaient auparavant l'en-tête Authorization pour en tirer un
 * libellé de journal, sans jamais comparer la clé à quoi que ce soit — et
 * inventaient une valeur par défaut quand l'en-tête manquait. Toute requête
 * anonyme passait.
 *
 * Le cabinet n'est jamais transmis par l'appelant : il est résolu en base à
 * partir de la clé. Il n'existe donc aucun paramètre par lequel demander
 * les données d'un autre cabinet.
 */

/** Réponse de refus, volontairement identique pour tous les cas d'échec. */
function refus(motif: string) {
  const messages: Record<string, { code: string; message: string; statut: number }> = {
    RESERVED_HUMAN_ACTION: {
      code: "RESERVED_HUMAN_ACTION",
      message:
        "Acte réservé à un consultant réglementé. Finaliser, envoyer, signer ou annuler une entente se fait dans le tableau de bord, par une personne.",
      statut: 403,
    },
    ACTION_NOT_ALLOWED: {
      code: "ACTION_NOT_ALLOWED",
      message: "Cette action n'est pas autorisée pour ce connecteur.",
      statut: 403,
    },
  }
  const m = messages[motif] ?? {
    // Message unique pour clé absente, inconnue, révoquée, expirée, cabinet
    // suspendu ou connecteur désactivé : distinguer ces cas apprendrait à
    // un appelant quelles clés existent.
    code: "UNAUTHORIZED",
    message: "Clé d'API absente, invalide ou connecteur désactivé.",
    statut: 401,
  }
  return NextResponse.json({ success: false, error: { code: m.code, message: m.message } }, { status: m.statut })
}

export async function GET(request: Request) {
  const cle = cleDeLaRequete(request)
  const action = "list_agreements"
  const auth = await autoriserAppel(cle, action)

  if (!auth.autorise) {
    await journaliserAppel({
      cle,
      action,
      statut: auth.motif.toLowerCase(),
      resume: `Refusé (${auth.motif}) : lecture des ententes.`,
      ip: ipDeLaRequete(request),
    })
    return refus(auth.motif)
  }

  await journaliserAppel({
    cle,
    action,
    statut: "success",
    resume: "Lecture des ententes du cabinet.",
    ip: ipDeLaRequete(request),
  })

  // La table des ententes n'existe pas encore en base : le connecteur ne
  // peut donc rien rendre. Renvoyer une liste vide et le dire vaut mieux
  // que de servir les ententes d'une maquette, qui appartiendraient à un
  // cabinet fictif.
  return NextResponse.json({
    success: true,
    data: [],
    notice: "Aucune entente en base pour ce cabinet.",
  })
}

export async function POST(request: Request) {
  const cle = cleDeLaRequete(request)
  const action = "create_agreement_draft"
  const ip = ipDeLaRequete(request)

  // Le corps est lu pour valider sa forme, et rien de plus tant que le
  // stockage des ententes n'existe pas.
  try {
    await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: { code: "INVALID_JSON", message: "Corps de requête JSON invalide." } },
      { status: 400 }
    )
  }

  // L'autorisation précède toute lecture du contenu : un appelant refusé ne
  // doit pas pouvoir déduire quoi que ce soit de la validation de sa charge.
  const auth = await autoriserAppel(cle, action)
  if (!auth.autorise) {
    await journaliserAppel({
      cle,
      action,
      statut: auth.motif.toLowerCase(),
      resume: `Refusé (${auth.motif}) : ouverture d'un brouillon d'entente.`,
      ip,
    })
    return refus(auth.motif)
  }

  await journaliserAppel({
    cle,
    action,
    statut: "success",
    resume: "Ouverture d'un brouillon d'entente demandée par l'assistant.",
    ip,
  })

  // Rien n'est écrit tant que la table des ententes n'existe pas. La
  // réponse le dit au lieu d'inventer un identifiant, comme le faisait la
  // version précédente avec Math.random().
  return NextResponse.json(
    {
      success: true,
      data: { status: "not_persisted" },
      notice:
        "Requête autorisée et journalisée. Le stockage des ententes n'est pas encore en service : aucun brouillon n'a été créé.",
    },
    { status: 202 }
  )
}
