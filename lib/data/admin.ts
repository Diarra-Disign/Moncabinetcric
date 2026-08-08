import "server-only"

import { getSessionSupabase } from "@/lib/supabase/session"

/**
 * Lectures de la console d'exploitation.
 *
 * Ce module ne touche QUE firms, profiles et platform_admins. Il n'importe
 * délibérément aucune fonction d'accès aux clients, dossiers, documents,
 * factures ou journal d'audit : un administrateur de plateforme gère les
 * cabinets, jamais leur contenu.
 *
 * La base le refuserait de toute façon — aucune politique ne lui ouvre ces
 * tables — mais mieux vaut que le code ne le tente même pas. Une requête
 * qui échoue silencieusement finit par être « réparée » par quelqu'un qui
 * n'en connaît pas la raison.
 */

export interface AdminFirmRow {
  id: string
  name: string
  rcicLicenseNumber: string
  ownerName: string
  email: string
  phone: string
  city: string
  createdAt: string
  /** Plan accordé depuis cette console : « trial » ou « courtoisie ». */
  plan: string
  status: string
  trialEndsAt: string
  accessOpen: boolean
  members: AdminMemberRow[]
  /**
   * Abonnement Stripe, ou null.
   *
   * C'est la seule source recevable pour un calcul de revenu. `plan`
   * ci-dessus ne dit que ce qui a été accordé à la main ; il reste à
   * « cabinet » après une résiliation, jusqu'au prochain événement Stripe.
   */
  subscription: AdminSubscriptionRow | null
}

export interface AdminSubscriptionRow {
  plan: string
  cadence: string
  status: string
  seats: number
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  graceUntil: string
  paymentMethod: string
  paymentLast4: string
  stripeCustomerId: string
}

export interface AdminMemberRow {
  id: string
  email: string
  fullName: string
  ciccRole: string
}

/** Dernier segment de l'adresse : « Gatineau, QC J8X 0B9 » suffit à situer. */
function cityOf(address: string | null): string {
  if (!address) return ""
  const parts = address.split(",").map((p) => p.trim())
  return parts.slice(-2).join(", ")
}

export async function getAdminFirms(): Promise<AdminFirmRow[]> {
  const supabase = await getSessionSupabase()

  // La politique firm_subscriptions_read ouvre la table à l'administrateur
  // de plateforme : aucun filtre applicatif n'est nécessaire ici.
  const [{ data: firms }, { data: profiles }, { data: abonnements }] = await Promise.all([
    supabase
      .from("firms")
      .select("id, name, rcic_license_number, owner_name, email, phone, address, created_at, plan, status, trial_ends_at")
      .order("created_at", { ascending: true }),
    supabase.from("profiles").select("id, firm_id, email, full_name, cicc_role"),
    supabase
      .from("firm_subscriptions")
      .select(
        "firm_id, plan, cadence, status, seats, current_period_end, cancel_at_period_end, grace_until, payment_method, payment_last4, stripe_customer_id"
      ),
  ])

  const parCabinet = new Map<string, AdminSubscriptionRow>()
  for (const s of abonnements ?? []) {
    parCabinet.set(s.firm_id as string, {
      plan: (s.plan as string) ?? "",
      cadence: (s.cadence as string) ?? "monthly",
      status: (s.status as string) ?? "",
      seats: (s.seats as number) ?? 1,
      currentPeriodEnd: ((s.current_period_end as string) ?? "").slice(0, 10),
      cancelAtPeriodEnd: Boolean(s.cancel_at_period_end),
      graceUntil: ((s.grace_until as string) ?? "").slice(0, 10),
      paymentMethod: (s.payment_method as string) ?? "",
      paymentLast4: (s.payment_last4 as string) ?? "",
      stripeCustomerId: (s.stripe_customer_id as string) ?? "",
    })
  }

  return (firms ?? []).map((f) => ({
    id: f.id as string,
    name: (f.name as string) ?? "",
    rcicLicenseNumber: (f.rcic_license_number as string) ?? "",
    ownerName: (f.owner_name as string) ?? "",
    email: (f.email as string) ?? "",
    phone: (f.phone as string) ?? "",
    city: cityOf(f.address as string | null),
    createdAt: ((f.created_at as string) ?? "").slice(0, 10),
    plan: (f.plan as string) ?? "",
    status: (f.status as string) ?? "",
    trialEndsAt: (f.trial_ends_at as string) ?? "",
    accessOpen:
      f.status === "active" &&
      (f.plan !== "trial" ||
        !f.trial_ends_at ||
        (f.trial_ends_at as string) >= new Date().toISOString().slice(0, 10)),
    members: (profiles ?? [])
      .filter((p) => p.firm_id === f.id)
      .map((p) => ({
        id: p.id as string,
        email: (p.email as string) ?? "",
        fullName: (p.full_name as string) ?? "",
        ciccRole: (p.cicc_role as string) ?? "",
      })),
    subscription: parCabinet.get(f.id as string) ?? null,
  }))
}

export interface DemoRequestRow {
  id: string
  name: string
  email: string
  company: string
  phone: string
  message: string
  locale: string
  createdAt: string
}

/**
 * Demandes de démonstration encore en attente.
 *
 * Seules les demandes non traitées sont chargées : la console sert à
 * répondre, pas à consulter un historique. Celles qui ont abouti gardent
 * en base le cabinet qu'elles ont ouvert, celles écartées gardent leur
 * trace — ni les unes ni les autres n'ont à revenir devant les yeux.
 */
export async function getDemoRequests(): Promise<DemoRequestRow[]> {
  const supabase = await getSessionSupabase()

  const { data } = await supabase
    .from("demo_requests")
    .select("id, name, email, company, phone, message, locale, created_at")
    .eq("status", "new")
    .order("created_at", { ascending: false })

  return (data ?? []).map((d) => ({
    id: d.id as string,
    name: (d.name as string) ?? "",
    email: (d.email as string) ?? "",
    company: (d.company as string) ?? "",
    phone: (d.phone as string) ?? "",
    message: (d.message as string) ?? "",
    locale: (d.locale as string) ?? "fr",
    createdAt: (d.created_at as string) ?? "",
  }))
}

export interface AdminOverview {
  firmCount: number
  memberCount: number
  firmsWithoutOwner: number
  firmsClosed: number
}

export function summarise(firms: AdminFirmRow[]): AdminOverview {
  return {
    firmCount: firms.length,
    memberCount: firms.reduce((n, f) => n + f.members.length, 0),
    // Un cabinet sans propriétaire ne peut ni inviter, ni modifier son
    // identité : c'est une impasse silencieuse, à signaler.
    firmsWithoutOwner: firms.filter((f) => !f.members.some((m) => m.ciccRole === "owner")).length,
    firmsClosed: firms.filter((f) => !f.accessOpen).length,
  }
}
