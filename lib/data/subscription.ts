import "server-only"

import { getCurrentMember, getSessionSupabase } from "@/lib/supabase/session"

/**
 * Lecture de l'abonnement du cabinet.
 *
 * Aucun filtre sur le cabinet n'est écrit ici : la politique
 * `firm_subscriptions_read` borne déjà la table au cabinet du membre. Elle
 * s'appuie sur current_firm_id_unchecked(), donc reste lisible même quand
 * l'accès est fermé — c'est précisément le moment où l'on a besoin de savoir
 * pourquoi.
 */

export interface AbonnementVue {
  existe: boolean
  plan: string
  cadence: string
  statut: string
  places: number
  placesOccupees: number
  /** null = sans limite. */
  placesMax: number | null
  finDePeriode: string
  resiliationDemandee: boolean
  delaiDeGrace: string
  moyenPaiement: string
  quatreDerniers: string
}

export const AUCUN_ABONNEMENT: AbonnementVue = {
  existe: false,
  plan: "",
  cadence: "",
  statut: "",
  places: 0,
  placesOccupees: 0,
  placesMax: null,
  finDePeriode: "",
  resiliationDemandee: false,
  delaiDeGrace: "",
  moyenPaiement: "",
  quatreDerniers: "",
}

export async function getAbonnement(): Promise<AbonnementVue> {
  const supabase = await getSessionSupabase()

  const [{ data }, places] = await Promise.all([
    supabase
      .from("firm_subscriptions")
      .select(
        "plan, cadence, status, seats, current_period_end, cancel_at_period_end, grace_until, payment_method, payment_last4"
      )
      .maybeSingle(),
    getPlaces(),
  ])

  if (!data) return { ...AUCUN_ABONNEMENT, ...places }

  return {
    existe: true,
    plan: (data.plan as string) ?? "",
    cadence: (data.cadence as string) ?? "monthly",
    statut: (data.status as string) ?? "",
    places: (data.seats as number) ?? 1,
    placesOccupees: places.placesOccupees,
    placesMax: places.placesMax,
    finDePeriode: ((data.current_period_end as string) ?? "").slice(0, 10),
    resiliationDemandee: Boolean(data.cancel_at_period_end),
    delaiDeGrace: ((data.grace_until as string) ?? "").slice(0, 10),
    moyenPaiement: (data.payment_method as string) ?? "",
    quatreDerniers: (data.payment_last4 as string) ?? "",
  }
}

/**
 * Places occupées et places autorisées.
 *
 * Les deux viennent de fonctions SQL, et non d'un comptage refait ici. Ce
 * sont exactement celles qu'interroge le déclencheur qui refuse une
 * invitation de trop : l'écran ne peut donc pas annoncer une place libre que
 * la base refusera.
 */
async function getPlaces(): Promise<{ placesOccupees: number; placesMax: number | null }> {
  // Le cabinet vient du profil du membre, jamais d'une lecture de `profiles`
  // sans clause : la politique de cette table rend visibles TOUS les profils
  // du cabinet, et maybeSingle() y échouerait dès le deuxième membre. Cette
  // erreur-là a déjà fermé l'application à tout le monde une fois.
  const membre = await getCurrentMember()
  if (!membre) return { placesOccupees: 0, placesMax: null }

  const supabase = await getSessionSupabase()
  const [occupees, limite] = await Promise.all([
    supabase.rpc("firm_seats_taken", { f_id: membre.firmId }),
    supabase.rpc("firm_seat_limit", { f_id: membre.firmId }),
  ])

  return {
    placesOccupees: (occupees.data as number) ?? 0,
    placesMax: (limite.data as number | null) ?? null,
  }
}
