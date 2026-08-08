import "server-only"

import { createClient } from "@supabase/supabase-js"
import type { Plan } from "./plans"

/**
 * Lecture du catalogue de forfaits.
 *
 * La table `plan_limits` fait autorité : c'est elle que lisent aussi
 * firm_effective_plan(), firm_seat_limit() et firm_has_feature() côté base.
 * Un prix modifié depuis la console d'exploitation change donc du même coup
 * la page publique, le tunnel de paiement et le calcul du revenu — sans
 * déploiement, et sans qu'aucune des trois ne puisse diverger des autres.
 *
 * La lecture passe par la clé de service et non par la session : ce catalogue
 * est affiché sur la page publique, qu'un visiteur consulte sans compte. La
 * politique RLS ne l'ouvre qu'aux comptes authentifiés, et il n'y a aucune
 * raison de l'ouvrir davantage — ce sont des conditions commerciales, pas un
 * secret, mais rien n'oblige à les rendre interrogeables anonymement.
 */

let cache: { valeur: Plan[]; expire: number } | null = null

/**
 * Durée de mise en cache.
 *
 * Courte à dessein : un prix corrigé dans la console doit apparaître sur la
 * page publique en moins d'une minute. Assez longue pour qu'une page vue mille
 * fois ne provoque pas mille requêtes.
 */
const CACHE_MS = 30_000

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Configuration Supabase incomplète.")
  return createClient(url, key, { auth: { persistSession: false } })
}

interface LignePlan {
  plan: string
  label_fr: string | null
  label_en: string | null
  tagline_fr: string | null
  tagline_en: string | null
  rank: number | null
  purchasable: boolean | null
  monthly_cents: number | null
  annual_cents: number | null
  extra_seat_monthly_cents: number | null
  extra_seat_annual_cents: number | null
  seats_included: number | null
  max_seats: number | null
  ai_connector: boolean | null
}

function versPlan(r: LignePlan): Plan {
  return {
    key: r.plan,
    labelFr: r.label_fr ?? r.plan,
    labelEn: r.label_en ?? r.plan,
    taglineFr: r.tagline_fr ?? "",
    taglineEn: r.tagline_en ?? "",
    rank: r.rank ?? 100,
    purchasable: Boolean(r.purchasable),
    monthly: r.monthly_cents,
    annual: r.annual_cents,
    extraSeatMonthly: r.extra_seat_monthly_cents ?? 0,
    extraSeatAnnual: r.extra_seat_annual_cents ?? 0,
    seatsIncluded: r.seats_included ?? 1,
    maxSeats: r.max_seats,
    aiConnector: Boolean(r.ai_connector),
  }
}

/** Tous les forfaits, dans l'ordre d'affichage. */
export async function getCatalogue(): Promise<Plan[]> {
  if (cache && cache.expire > Date.now()) return cache.valeur

  const { data, error } = await serviceClient()
    .from("plan_limits")
    .select(
      "plan, label_fr, label_en, tagline_fr, tagline_en, rank, purchasable, monthly_cents, annual_cents, extra_seat_monthly_cents, extra_seat_annual_cents, seats_included, max_seats, ai_connector"
    )
    .order("rank", { ascending: true })

  if (error || !data) {
    // Un catalogue vide vaut mieux qu'un catalogue inventé : les écrans
    // affichent alors « aucun forfait disponible » plutôt qu'un prix de repli
    // que personne n'a arrêté. C'est la leçon des replis codés en dur.
    return []
  }

  const plans = (data as LignePlan[]).map(versPlan)
  cache = { valeur: plans, expire: Date.now() + CACHE_MS }
  return plans
}

/** Les forfaits qu'un cabinet peut souscrire lui-même. */
export async function getForfaitsSouscriptibles(): Promise<Plan[]> {
  return (await getCatalogue()).filter((p) => p.purchasable)
}

export async function getPlan(cle: string): Promise<Plan | null> {
  return (await getCatalogue()).find((p) => p.key === cle) ?? null
}

/** Vide le cache — après une modification du catalogue depuis la console. */
export function invaliderCatalogue(): void {
  cache = null
}
