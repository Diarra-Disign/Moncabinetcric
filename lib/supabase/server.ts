import "server-only"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

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

let cached: SupabaseClient | null = null

export function getServerSupabase(): SupabaseClient {
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

  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  return cached
}

/** Slug du cabinet actif, en attendant que la session le fournisse. */
export function getActiveFirmSlug(): string {
  return process.env.ACTIVE_FIRM_SLUG || "firm-boreale"
}

let cachedFirmId: string | null = null

/** Identifiant du cabinet actif, résolu une fois puis mémorisé. */
export async function getActiveFirmId(): Promise<string> {
  if (cachedFirmId) return cachedFirmId

  const slug = getActiveFirmSlug()
  const { data, error } = await getServerSupabase()
    .from("firms")
    .select("id")
    .eq("slug", slug)
    .single()

  if (error || !data) {
    throw new Error(
      `Cabinet "${slug}" introuvable dans la table firms. ` +
        "Le schéma a-t-il bien été appliqué et peuplé ? " +
        `Détail : ${error?.message ?? "aucune ligne"}`
    )
  }

  cachedFirmId = data.id as string
  return cachedFirmId
}
