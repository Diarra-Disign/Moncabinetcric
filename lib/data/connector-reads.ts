import "server-only"

import { getSessionSupabase } from "@/lib/supabase/session"

/**
 * Lectures du connecteur, pour l'écran de réglages.
 *
 * Aucun filtre sur le cabinet n'est écrit ici : les politiques RLS de
 * `ai_api_keys`, `ai_connector_settings` et `ai_connector_logs` bornent
 * déjà chaque table au cabinet du membre connecté. Un oubli de filtre ne
 * peut donc pas ouvrir les clés ou le journal d'un autre cabinet — la base
 * refuse d'elle-même.
 */

export interface ReglagesConnecteur {
  enabled: boolean
  enabledAt: string
  allowedActions: string[]
  reservedActions: string[]
}

export interface CleApiVue {
  id: string
  label: string
  prefixe: string
  creeLe: string
  dernierUsage: string
  expireLe: string
  revoquee: boolean
}

export interface EntreeJournal {
  id: string
  occurredAt: string
  prefixe: string
  action: string
  statut: string
  resume: string
  ip: string
}

const DEFAUT: ReglagesConnecteur = {
  enabled: false,
  enabledAt: "",
  allowedActions: [],
  // Repli volontairement fermé : si les réglages sont illisibles, mieux
  // vaut afficher un connecteur clos qu'un connecteur qu'on croit ouvert.
  reservedActions: ["finalize", "send", "sign", "cancel"],
}

export async function getReglagesConnecteur(): Promise<ReglagesConnecteur> {
  const supabase = await getSessionSupabase()
  const { data } = await supabase
    .from("ai_connector_settings")
    .select("enabled, enabled_at, allowed_actions, reserved_actions")
    .maybeSingle()

  if (!data) return DEFAUT
  return {
    enabled: Boolean(data.enabled),
    enabledAt: ((data.enabled_at as string) ?? "").slice(0, 10),
    allowedActions: (data.allowed_actions as string[]) ?? [],
    reservedActions: (data.reserved_actions as string[]) ?? DEFAUT.reservedActions,
  }
}

export async function getClesApi(): Promise<CleApiVue[]> {
  const supabase = await getSessionSupabase()
  const { data } = await supabase
    .from("ai_api_keys")
    .select("id, label, key_prefix, created_at, last_used_at, expires_at, revoked_at")
    .order("created_at", { ascending: false })

  return (data ?? []).map((k) => ({
    id: k.id as string,
    label: (k.label as string) ?? "",
    prefixe: (k.key_prefix as string) ?? "",
    creeLe: ((k.created_at as string) ?? "").slice(0, 10),
    dernierUsage: ((k.last_used_at as string) ?? "").slice(0, 16).replace("T", " "),
    expireLe: ((k.expires_at as string) ?? "").slice(0, 10),
    revoquee: Boolean(k.revoked_at),
  }))
}

export async function getJournalConnecteur(limite = 50): Promise<EntreeJournal[]> {
  const supabase = await getSessionSupabase()
  const { data } = await supabase
    .from("ai_connector_logs")
    .select("id, occurred_at, key_prefix, action, status, summary, client_ip")
    .order("occurred_at", { ascending: false })
    .limit(limite)

  return (data ?? []).map((l) => ({
    id: l.id as string,
    occurredAt: ((l.occurred_at as string) ?? "").slice(0, 16).replace("T", " "),
    prefixe: (l.key_prefix as string) ?? "",
    action: (l.action as string) ?? "",
    statut: (l.status as string) ?? "",
    resume: (l.summary as string) ?? "",
    ip: (l.client_ip as string) ?? "",
  }))
}
