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
  const r = await signerParJeton(jeton, courriel, trace, champs, ip, agent)

  // LA DERNIÈRE SIGNATURE DÉCLENCHE LA SUITE, et seulement elle.
  //
  // Ni la finalisation ni les réactions du CRM ne font échouer la signature :
  // elle est déjà enregistrée en base, scellée par un déclencheur. Si le PDF
  // final ne se compose pas, on le reproduira — refuser la signature pour
  // autant serait absurde à expliquer au signataire, qui a bel et bien signé.
  if (r.ok && r.complete) {
    try {
      // L'identifiant vient de la BASE, pas d'une seconde résolution du jeton :
      // après la dernière signature, la demande est close et le jeton ne
      // résout plus rien.
      if (r.demandeId) await conclure(r.demandeId)
    } catch (e) {
      console.error("apposerSignature : suite non exécutée —", e instanceof Error ? e.message : e)
    }
  }

  return r
}

/**
 * Ce qui suit la dernière signature : le document final, puis les réactions.
 *
 * Séparée pour être appelable seule — si la composition du PDF échoue une
 * fois, on la rejoue sans redemander de signature à personne.
 */
async function conclure(demandeId: string) {
  const { clientService } = await import("@/lib/signature/public")
  const sb = clientService()

  const { data: demande } = await sb
    .from("signature_requests").select("firm_id").eq("id", demandeId).maybeSingle()
  if (!demande) return

  const ctx = { firmId: String(demande.firm_id), fullName: "Système" }

  const { finaliser } = await import("@/lib/signature/finalisation")
  const f = await finaliser(sb, ctx, demandeId)
  if (!f.ok) console.error("conclure : finalisation —", f.message)

  const { reagirASignature } = await import("@/lib/workflow/signature-reactions")
  await reagirASignature(sb, ctx, "signature.completed", demandeId)
}

export async function declinerSignature(jeton: string, motif: string): Promise<ResultatPublic> {
  const { ip, agent } = await origine()
  return refuserParJeton(jeton, motif, ip, agent)
}
