"use server"

import { headers } from "next/headers"
import {
  vueParJeton, champsParJeton, lienDocument,
  marquerConsultation, signerParJeton, refuserParJeton,
  type ResultatPublic,
} from "@/lib/signature/public"

/**
 * Les gestes du signataire, depuis la page publique.
 *
 * Aucune session n'est lue ici : c'est le JETON qui autorise, et il est
 * revérifié par la base à chaque appel. Une action serveur reste appelable
 * sans l'écran — ce module ne peut donc pas se contenter de faire confiance à
 * ce que le navigateur lui envoie.
 *
 * L'ADRESSE D'ORIGINE EST LUE ICI, jamais transmise par le client. Une adresse
 * fournie par le navigateur n'atteste que d'une déclaration, et c'est
 * précisément la donnée qu'on voudra opposer en cas de contestation.
 */

async function origine() {
  const h = await headers()
  return {
    // La première adresse de la chaîne : les suivantes sont celles des relais.
    ip: (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || null,
    agent: h.get("user-agent") ?? null,
  }
}

export async function ouvrirSignature(jeton: string) {
  const [vue, champs, lien] = await Promise.all([
    vueParJeton(jeton), champsParJeton(jeton), lienDocument(jeton),
  ])
  if (!vue) return null

  const { ip, agent } = await origine()
  await marquerConsultation(jeton, ip, agent)

  return { vue, champs, lien }
}

export async function apposerSignature(
  jeton: string,
  courriel: string,
  trace: string | null,
  champs: { id: string; valeur: string }[]
): Promise<ResultatPublic> {
  const { ip, agent } = await origine()
  return signerParJeton(jeton, courriel, trace, champs, ip, agent)
}

export async function declinerSignature(jeton: string, motif: string): Promise<ResultatPublic> {
  const { ip, agent } = await origine()
  return refuserParJeton(jeton, motif, ip, agent)
}
