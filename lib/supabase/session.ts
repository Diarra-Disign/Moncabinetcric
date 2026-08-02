import "server-only"

import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"
import { EMPTY_FIRM, mapFirmRow, type FirmIdentity, type FirmRow } from "@/lib/data/firm"

/**
 * Client Supabase porteur de la session de l'utilisateur.
 *
 * Contrairement à getServerSupabase(), qui emploie la clé service_role et
 * contourne Row Level Security, ce client utilise la clé anonyme et le
 * jeton de session. Toutes ses requêtes sont donc soumises aux politiques
 * RLS : c'est la base qui décide de ce que l'utilisateur peut voir, plus
 * un filtre écrit dans le code applicatif.
 *
 * C'est la différence entre « l'application oublie de filtrer et tout
 * fuit » et « l'application oublie de filtrer et la base refuse ».
 */
export async function getSessionSupabase(): Promise<SupabaseClient> {
  const cookieStore = await cookies()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(
      "Configuration Supabase incomplète : NEXT_PUBLIC_SUPABASE_URL et " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY doivent être définies dans .env.local."
    )
  }

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Écriture impossible depuis un Server Component : c'est attendu.
          // Le rafraîchissement du jeton est assuré par proxy.ts, qui lui
          // dispose d'une réponse modifiable.
        }
      },
    },
  })
}

/**
 * Identité du cabinet de l'utilisateur connecté.
 *
 * Lue avec le client de session : la politique RLS de `firms` restreint
 * déjà la lecture au cabinet du membre, aucun filtre applicatif n'est
 * donc nécessaire — et surtout, aucun n'est oubliable.
 */
export async function getCurrentFirm(): Promise<FirmIdentity> {
  const supabase = await getSessionSupabase()

  const { data, error } = await supabase
    .from("firms")
    .select("id, name, rcic_license_number, owner_name, address, phone, email, logo_letter, logo_url")
    .maybeSingle()

  if (error || !data) return EMPTY_FIRM
  return mapFirmRow(data as FirmRow)
}

export interface CurrentMember {
  userId: string
  email: string
  fullName: string
  ciccRole: string
  firmId: string
  firmName: string
}

/**
 * Membre connecté et cabinet auquel il appartient.
 *
 * Renvoie null si aucune session valide, ou si le compte authentifié n'a
 * pas de profil rattaché — cas volontairement traité comme un refus : un
 * compte sans profil n'appartient à aucun cabinet et ne doit rien voir.
 */
export async function getCurrentMember(): Promise<CurrentMember | null> {
  const supabase = await getSessionSupabase()

  // getUser() et non getSession() : getUser interroge le serveur Supabase et
  // valide le jeton, là où getSession se contente de lire le cookie, qui est
  // manipulable côté client.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, cicc_role, firm_id, firms(name)")
    .eq("user_id", user.id)
    .maybeSingle()

  if (!profile) return null

  const firm = profile.firms as unknown as { name?: string } | null

  return {
    userId: user.id,
    email: profile.email ?? user.email ?? "",
    fullName: profile.full_name ?? "",
    ciccRole: profile.cicc_role ?? "staff",
    firmId: profile.firm_id as string,
    firmName: firm?.name ?? "",
  }
}
