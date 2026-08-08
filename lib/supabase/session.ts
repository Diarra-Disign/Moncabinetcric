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
 * Le filtre sur l'identifiant est indispensable, contrairement à ce que
 * cette fonction supposait d'abord.
 *
 * Elle interrogeait `firms` sans aucune clause et comptait sur la RLS pour
 * ne renvoyer qu'une ligne. Ce raisonnement a cessé d'être vrai le jour où
 * la politique `firms_public_operator` a ouvert la lecture du cabinet
 * exploitant à tout le monde, pour alimenter les pages légales publiques.
 * Depuis, un membre d'un autre cabinet en voit deux : le sien et celui de
 * l'exploitant. `maybeSingle()` refuse alors de choisir, renvoie une
 * erreur, et l'identité retombe sur EMPTY_FIRM — dont `accessOpen` vaut
 * false.
 *
 * Conséquence observée : tout membre d'un cabinet autre que l'exploitant
 * se voyait refuser l'entrée avec « Accès suspendu », plan et statut
 * vides, quel que soit son abonnement réel.
 *
 * Le cabinet vient donc du profil du membre. La RLS reste le verrou — elle
 * refuse toujours la ligne d'un cabinet tiers — mais elle n'a plus à
 * servir de sélecteur, ce qu'une politique n'a jamais promis d'être.
 */
export async function getCurrentFirm(): Promise<FirmIdentity> {
  const supabase = await getSessionSupabase()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return EMPTY_FIRM

  // Lisible même sous suspension : c'est ce qui permet d'afficher au membre
  // le plan et le statut réels de son cabinet plutôt que deux tirets.
  const { data: profile } = await supabase
    .from("profiles")
    .select("firm_id")
    .eq("user_id", user.id)
    .maybeSingle()

  if (!profile?.firm_id) return EMPTY_FIRM

  const { data, error } = await supabase
    .from("firms")
    .select("id, name, rcic_license_number, owner_name, address, phone, email, logo_letter, logo_url, plan, status, trial_ends_at")
    .eq("id", profile.firm_id)
    .maybeSingle()

  if (error || !data) return EMPTY_FIRM
  return mapFirmRow(data as FirmRow)
}

export interface PortalClient {
  userId: string
  clientId: string
  firmId: string
  email: string
  name: string
  fileNumber: string
  program: string
  firmName: string
}

/**
 * Client connecté au portail, ou null.
 *
 * La lecture s'appuie sur les politiques posées par la migration
 * client_portal : un compte client ne voit que sa propre fiche. Aucun
 * filtre applicatif n'intervient — si la base refuse, le portail est vide.
 *
 * Renvoie également null pour un membre de cabinet : is_portal_client()
 * exclut délibérément quiconque possède un profil, afin que les deux jeux
 * de politiques ne se cumulent jamais.
 */
export async function getCurrentPortalClient(): Promise<PortalClient | null> {
  const supabase = await getSessionSupabase()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return null

  const { data: lien } = await supabase
    .from("client_users")
    .select("client_id, firm_id, email")
    .eq("user_id", user.id)
    .maybeSingle()

  if (!lien) return null

  const { data: client } = await supabase
    .from("clients")
    .select("id, name, file_number, program, firms(name)")
    .eq("id", lien.client_id)
    .maybeSingle()

  // Le rattachement existe mais la fiche est invisible : cabinet suspendu.
  // current_client_id() renvoie alors NULL et toutes les politiques refusent.
  if (!client) return null

  const firm = client.firms as unknown as { name?: string } | null

  return {
    userId: user.id,
    clientId: client.id as string,
    firmId: lien.firm_id as string,
    email: (lien.email as string) ?? user.email ?? "",
    name: (client.name as string) ?? "",
    fileNumber: (client.file_number as string) ?? "",
    program: (client.program as string) ?? "",
    firmName: firm?.name ?? "",
  }
}

export interface PlatformAdmin {
  userId: string
  email: string
  fullName: string
}

/**
 * Administrateur de la plateforme connecté, ou null.
 *
 * La lecture passe par le client de session : la politique de
 * platform_admins n'accorde la table qu'à un administrateur. Un membre de
 * cabinet obtient donc null, sans qu'aucun filtre applicatif n'intervienne.
 */
export async function getCurrentPlatformAdmin(): Promise<PlatformAdmin | null> {
  const supabase = await getSessionSupabase()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) return null

  const { data } = await supabase
    .from("platform_admins")
    .select("user_id, email, full_name")
    .eq("user_id", user.id)
    .maybeSingle()

  if (!data) return null
  return {
    userId: data.user_id as string,
    email: (data.email as string) ?? user.email ?? "",
    fullName: (data.full_name as string) ?? "",
  }
}

export interface CurrentMember {
  userId: string
  email: string
  fullName: string
  ciccRole: string
  firmId: string
  firmName: string
  /**
   * active | suspended | revoked.
   *
   * Lu SANS filtrer : un membre suspendu doit rester identifiable, sans quoi
   * l'application se viderait devant lui sans rien expliquer — toutes ses
   * requêtes échouant en silence, il en conclurait que ses dossiers ont été
   * perdus. C'est current_firm_id() qui refuse l'accès, pas cette lecture.
   */
  statut: string
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
    .select("full_name, email, cicc_role, firm_id, status, firms(name)")
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
    statut: (profile.status as string) ?? "active",
  }
}
