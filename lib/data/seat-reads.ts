import "server-only"

import { getCurrentMember, getSessionSupabase } from "@/lib/supabase/session"

/**
 * Lectures des demandes de places.
 *
 * La politique `seat_requests_read` borne déjà au cabinet du membre, ou ouvre
 * tout à l'exploitant. Aucun filtre applicatif : il n'y en a donc aucun à
 * oublier.
 */

export interface DemandeSiege {
  id: string
  firmId: string
  demandeur: string
  seats: number
  roleHint: string
  justification: string
  statut: string
  accordees: number
  reponse: string
  creeLe: string
}

function versDemande(d: Record<string, unknown>): DemandeSiege {
  return {
    id: d.id as string,
    firmId: d.firm_id as string,
    demandeur: (d.requester_name as string) ?? "",
    seats: (d.seats as number) ?? 0,
    roleHint: (d.role_hint as string) ?? "",
    justification: (d.justification as string) ?? "",
    statut: (d.status as string) ?? "pending",
    accordees: (d.granted_seats as number) ?? 0,
    reponse: (d.response as string) ?? "",
    creeLe: ((d.created_at as string) ?? "").slice(0, 10),
  }
}

const COLONNES =
  "id, firm_id, requester_name, seats, role_hint, justification, status, granted_seats, response, created_at"

/** Historique du cabinet du membre connecté, refus compris. */
export async function getDemandesDuCabinet(): Promise<DemandeSiege[]> {
  const supabase = await getSessionSupabase()
  const { data } = await supabase
    .from("seat_requests")
    .select(COLONNES)
    .order("created_at", { ascending: false })
  return (data ?? []).map(versDemande)
}

/** Places occupées et plafond du cabinet du membre connecté. */
export async function getPlacesDuCabinet(): Promise<{ occupees: number; limite: number | null }> {
  const membre = await getCurrentMember()
  if (!membre) return { occupees: 0, limite: null }

  const supabase = await getSessionSupabase()
  const [occ, lim] = await Promise.all([
    supabase.rpc("firm_seats_taken", { f_id: membre.firmId }),
    supabase.rpc("firm_seat_limit", { f_id: membre.firmId }),
  ])
  return {
    occupees: (occ.data as number) ?? 0,
    limite: (lim.data as number | null) ?? null,
  }
}

/** Demandes en attente, tous cabinets — pour la console d'exploitation. */
export async function getDemandesEnAttente(): Promise<DemandeSiege[]> {
  const supabase = await getSessionSupabase()
  const { data } = await supabase
    .from("seat_requests")
    .select(COLONNES)
    .in("status", ["pending", "info_requested"])
    .order("created_at", { ascending: true })
  return (data ?? []).map(versDemande)
}
