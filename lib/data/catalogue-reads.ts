import "server-only"

import { getSessionSupabase } from "@/lib/supabase/session"

/**
 * Lectures du catalogue pour la console d'exploitation.
 *
 * Aucun filtre applicatif : les politiques de `features`, `plan_features`,
 * `firm_feature_overrides` et `platform_audit` décident déjà de ce qui est
 * visible, et la dernière n'est ouverte qu'à un administrateur de plateforme.
 */

export interface FonctionnaliteVue {
  key: string
  labelFr: string
  labelEn: string
  descriptionFr: string
  category: string
  rank: number
  alwaysOn: boolean
}

export interface ExceptionVue {
  firmId: string
  feature: string
  enabled: boolean
  reason: string
  grantedAt: string
  expiresAt: string
  /** Une exception échue ne produit plus d'effet, mais reste affichée. */
  echue: boolean
}

export interface EntreeJournalExploitant {
  id: string
  occurredAt: string
  actorEmail: string
  action: string
  firmName: string
  summary: string
}

export async function getFonctionnalites(): Promise<FonctionnaliteVue[]> {
  const supabase = await getSessionSupabase()
  const { data } = await supabase
    .from("features")
    .select("key, label_fr, label_en, description_fr, category, rank, always_on")
    .order("rank", { ascending: true })

  return (data ?? []).map((f) => ({
    key: f.key as string,
    labelFr: (f.label_fr as string) ?? "",
    labelEn: (f.label_en as string) ?? "",
    descriptionFr: (f.description_fr as string) ?? "",
    category: (f.category as string) ?? "general",
    rank: (f.rank as number) ?? 100,
    alwaysOn: Boolean(f.always_on),
  }))
}

/** Matrice forfait → fonctionnalité → activée. */
export async function getMatriceForfaits(): Promise<Record<string, Record<string, boolean>>> {
  const supabase = await getSessionSupabase()
  const { data } = await supabase.from("plan_features").select("plan, feature, enabled")

  const matrice: Record<string, Record<string, boolean>> = {}
  for (const l of data ?? []) {
    const p = l.plan as string
    matrice[p] ??= {}
    matrice[p][l.feature as string] = Boolean(l.enabled)
  }
  return matrice
}

export async function getExceptions(): Promise<ExceptionVue[]> {
  const supabase = await getSessionSupabase()
  const { data } = await supabase
    .from("firm_feature_overrides")
    .select("firm_id, feature, enabled, reason, granted_at, expires_at")
    .order("granted_at", { ascending: false })

  const maintenant = Date.now()
  return (data ?? []).map((o) => ({
    firmId: o.firm_id as string,
    feature: o.feature as string,
    enabled: Boolean(o.enabled),
    reason: (o.reason as string) ?? "",
    grantedAt: ((o.granted_at as string) ?? "").slice(0, 10),
    expiresAt: ((o.expires_at as string) ?? "").slice(0, 10),
    echue: Boolean(o.expires_at) && new Date(o.expires_at as string).getTime() < maintenant,
  }))
}

export async function getJournalExploitant(limite = 50): Promise<EntreeJournalExploitant[]> {
  const supabase = await getSessionSupabase()
  const { data } = await supabase
    .from("platform_audit")
    .select("id, occurred_at, actor_email, action, firm_name, summary")
    .order("occurred_at", { ascending: false })
    .limit(limite)

  return (data ?? []).map((l) => ({
    id: l.id as string,
    occurredAt: ((l.occurred_at as string) ?? "").slice(0, 16).replace("T", " "),
    actorEmail: (l.actor_email as string) ?? "",
    action: (l.action as string) ?? "",
    firmName: (l.firm_name as string) ?? "",
    summary: (l.summary as string) ?? "",
  }))
}
