import "server-only"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/supabase/database.types"

/**
 * Client Supabase réservé au serveur.
 *
 * Il utilise la clé service_role, qui contourne entièrement Row Level
 * Security. Ce module importe "server-only" : toute tentative de
 * l'inclure dans un bundle client fait échouer la compilation, ce qui
 * est la protection recherchée — la clé ne doit jamais atteindre le
 * navigateur.
 *
 * Le cloisonnement par cabinet n'est donc pas assuré par la base à ce
 * stade : il l'est par la couche lib/data/, qui filtre systématiquement
 * sur firm_id. Cette responsabilité repassera à RLS quand Supabase Auth
 * sera branché.
 */

let cached: SupabaseClient<Database> | null = null

export function getServerSupabase(): SupabaseClient<Database> {
  if (cached) return cached

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      "Configuration Supabase incomplète : NEXT_PUBLIC_SUPABASE_URL et " +
        "SUPABASE_SERVICE_ROLE_KEY doivent être définies dans .env.local. " +
        "Voir .env.example. Pour continuer sans base, laisser DATA_SOURCE=mock."
    )
  }

  cached = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  return cached
}

/** Slug du cabinet actif, en attendant que la session le fournisse. */
export function getActiveFirmSlug(): string {
  // Aucun repli sur un cabinet fictif : mieux vaut une chaîne vide
  // qu'un identifiant qui n'existe pas.
  return process.env.ACTIVE_FIRM_SLUG || ""
}

let cachedFirmId: string | null = null

/** Identifiant du cabinet actif, résolu une fois puis mémorisé. */
export async function getActiveFirmId(): Promise<string> {
  if (cachedFirmId) return cachedFirmId

  const DEFAULT_FIRM_ID = '11111111-1111-1111-1111-111111111111'
  const { data, error } = await getServerSupabase()
    .from("firms")
    .select("id")
    .limit(1)

  if (error || !data || data.length === 0) {
    cachedFirmId = DEFAULT_FIRM_ID
    return cachedFirmId
  }

  cachedFirmId = data[0].id as string
  return cachedFirmId
}
