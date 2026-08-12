import "server-only"

import { getSessionSupabase, getCurrentMember } from "@/lib/supabase/session"
import {
  partieDepuisClient, partieDepuisProspect, cabinetDepuisFirm,
} from "@/lib/ententes/contractant"
import type { PartieContractante, CabinetContrat } from "@/lib/ententes/variables"
import { chargerContractantAvec, type PreRemplissage } from "./contractant-lecture"

export { chargerContractantAvec }
export type { PreRemplissage }

/**
 * Retrouver un contractant, et ce que le cabinet sait déjà de lui.
 *
 * Le §30 est la règle : si une information existe dans Prospects, Clients ou
 * Dossiers, elle est récupérée — jamais retapée. Ce fichier est le chemin par
 * lequel elle arrive.
 *
 * La lecture passe par le client de SESSION, donc par Row Level Security :
 * chercher « Diallo » ne peut ramener que les Diallo du cabinet. Aucun filtre
 * firm_id n'est écrit ici, et c'est délibéré — l'écrire donnerait l'illusion
 * que c'est LUI qui protège, et son oubli ailleurs passerait inaperçu.
 */

export interface ContractantTrouve {
  type: "client" | "lead"
  id: string
  nom: string
  courriel: string
  telephone: string
  /** Numéro de dossier pour un client ; l'étape du pipeline pour un prospect. */
  detail: string
}

/**
 * Recherche par prénom, nom, courriel, téléphone ou numéro de dossier (§4).
 *
 * Les deux tables sont interrogées en parallèle. Les prospects DÉJÀ CONVERTIS
 * en sont exclus : proposer un prospect converti ferait signer un contrat à
 * une identité qui n'existe plus, alors que son client existe.
 */
export async function chercherContractants(recherche: string, limite = 12): Promise<ContractantTrouve[]> {
  const q = recherche.trim()
  if (q.length < 2) return []
  const sb = await getSessionSupabase()
  const motif = `%${q}%`

  const [clients, prospects] = await Promise.all([
    sb.from("clients")
      .select("id, name, first_name, last_name, email, phone, file_number")
      .or(`name.ilike.${motif},email.ilike.${motif},phone.ilike.${motif},file_number.ilike.${motif}`)
      .limit(limite),
    sb.from("leads")
      .select("id, name, first_name, last_name, email, phone, stage")
      .is("converted_client_id", null)
      .or(`name.ilike.${motif},email.ilike.${motif},phone.ilike.${motif}`)
      .limit(limite),
  ])

  const resultats: ContractantTrouve[] = [
    ...(clients.data ?? []).map((c) => ({
      type: "client" as const,
      id: String(c.id),
      nom: String(c.name ?? ""),
      courriel: String(c.email ?? ""),
      telephone: String(c.phone ?? ""),
      detail: String(c.file_number ?? ""),
    })),
    ...(prospects.data ?? []).map((l) => ({
      type: "lead" as const,
      id: String(l.id),
      nom: String(l.name ?? ""),
      courriel: String(l.email ?? ""),
      telephone: String(l.phone ?? ""),
      detail: `Prospect · ${String(l.stage ?? "")}`,
    })),
  ]

  // Les clients d'abord : un contrat s'adresse plus souvent à quelqu'un qu'on
  // représente déjà. À type égal, l'ordre alphabétique, pour que deux
  // recherches identiques ne rendent pas deux ordres différents.
  return resultats
    .sort((a, b) => (a.type === b.type ? a.nom.localeCompare(b.nom, "fr") : a.type === "client" ? -1 : 1))
    .slice(0, limite)
}


/** Même chose, la session étant tirée du contexte de la requête. */
export async function chargerContractant(
  type: "client" | "lead",
  id: string
): Promise<PreRemplissage | null> {
  const sb = await getSessionSupabase()
  const membre = await getCurrentMember()
  return chargerContractantAvec(sb, membre, type, id)
}
