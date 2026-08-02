"use client"

import { createBrowserClient } from "@supabase/ssr"

/**
 * Client Supabase du navigateur, réservé à l'authentification.
 *
 * Il ne porte que la clé anonyme — publique par conception — et n'est
 * utilisé que pour la connexion, la déconnexion et l'envoi de liens
 * magiques. Toute lecture de données métier passe par le serveur, afin
 * que la clé anonyme ne serve jamais à interroger directement les tables
 * depuis le navigateur.
 */
export function getBrowserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(
      "Configuration Supabase incomplète : NEXT_PUBLIC_SUPABASE_URL et " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY doivent être définies."
    )
  }

  return createBrowserClient(url, anonKey)
}
