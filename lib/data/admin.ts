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
  /** active | suspended | revoked. Seul un membre actif occupe une place. */
  statut: string
}

/** Dernier segment de l'adresse : « Gatineau, QC J8X 0B9 » suffit à situer. */
function cityOf(address: string | null): string {
  if (!address) return ""
  const parts = address.split(",").map((p) => p.trim())
  return parts.slice(-2).join(", ")
}

export interface PageCabinets {
  lignes: AdminFirmRow[]
  /** Nombre TOTAL de cabinets correspondant à la recherche, pages comprises. */
  total: number
  page: number
  parPage: number
}

/** Au-delà, la page devient longue à lire autant qu'à charger. */
export const CABINETS_PAR_PAGE = 25

/**
 * Une page de cabinets.
 *
 * ─── POURQUOI LA RECHERCHE ET LA PAGINATION SONT EN BASE ───────────────────
 *
 * Cette fonction chargeait TOUS les cabinets, TOUS les profils et TOUS les
 * abonnements, puis assemblait le tout en mémoire. Avec trois cabinets réels
 * cela ne se voyait pas ; la base en a porté quatre-vingt-dix cet été, et
 * l'écran les rendait tous.
 *
 * Filtrer en JavaScript après avoir tout chargé ne pagine rien : le coût est
 * déjà payé quand on jette les lignes. `ilike` et `range` font le travail là
 * où sont les données.
 *
 * Les profils et abonnements ne sont lus QUE pour les cabinets de la page —
 * `in()` sur les identifiants retenus. C'est ce qui évite les trois lectures
 * intégrales, sans faire une requête par ligne.
 */
export async function getAdminFirms(options: {
  recherche?: string
  page?: number
  parPage?: number
} = {}): Promise<PageCabinets> {
  const supabase = await getSessionSupabase()

  const recherche = (options.recherche ?? "").trim()
  const parPage = options.parPage ?? CABINETS_PAR_PAGE
  const page = Math.max(1, options.page ?? 1)
  const debut = (page - 1) * parPage

  let requete = supabase
    .from("firms")
    .select(
      "id, name, rcic_license_number, owner_name, email, phone, address, created_at, plan, status, trial_ends_at",
      { count: "exact" }
    )

  if (recherche) {
    // Le nom, le courriel et le permis : les trois façons dont un exploitant
    // désigne un cabinet quand on lui en parle au téléphone.
    const motif = `%${recherche.replace(/[%_]/g, "")}%`
    requete = requete.or(
      `name.ilike.${motif},email.ilike.${motif},rcic_license_number.ilike.${motif}`
    )
  }

  const { data: firms, count } = await requete
    .order("created_at", { ascending: true })
    .range(debut, debut + parPage - 1)

  const ids = (firms ?? []).map((f) => f.id as string)
  if (ids.length === 0) {
    return { lignes: [], total: count ?? 0, page, parPage }
  }

  const [{ data: profiles }, { data: abonnements }, { data: acces }] = await Promise.all([
    supabase.from("profiles").select("id, firm_id, email, full_name, cicc_role, status").in("firm_id", ids),
    supabase
      .from("firm_subscriptions")
      .select(
        "firm_id, plan, cadence, status, seats, current_period_end, cancel_at_period_end, grace_until, payment_method, payment_last4, stripe_customer_id"
      )
      .in("firm_id", ids),
    supabase.rpc("firms_access_state"),
  ])

  return {
    lignes: assembler(firms ?? [], profiles ?? [], abonnements ?? [], acces ?? []),
    total: count ?? 0,
    page,
    parPage,
  }
}

/**
 * Tous les cabinets, sans pagination — pour les CALCULS d'ensemble.
 *
 * Le tableau de bord et le bloc financier additionnent des abonnements : leur
 * servir une page fausserait le chiffre d'affaires, qui deviendrait celui des
 * vingt-cinq premiers cabinets. Cette lecture est donc entière, mais elle ne
 * charge ni les membres ni l'état d'accès, dont aucun total n'a besoin.
 */
export interface AdminFirmFinance {
  id: string
  name: string
  ownerName: string
  email: string
  plan: string
  trialEndsAt: string
  subscription: AdminSubscriptionRow | null
}

export async function getTousLesAbonnements(): Promise<AdminFirmFinance[]> {
  const supabase = await getSessionSupabase()
  const [{ data: firms }, { data: abonnements }] = await Promise.all([
    supabase.from("firms").select("id, name, owner_name, email, plan, trial_ends_at").order("name"),
    supabase
      .from("firm_subscriptions")
      .select(
        "firm_id, plan, cadence, status, seats, current_period_end, cancel_at_period_end, grace_until, payment_method, payment_last4, stripe_customer_id"
      ),
  ])

  const parCabinet = indexerAbonnements(abonnements ?? [])
  return (firms ?? []).map((f) => ({
    id: f.id as string,
    name: (f.name as string) ?? "",
    ownerName: (f.owner_name as string) ?? "",
    email: (f.email as string) ?? "",
    plan: (f.plan as string) ?? "",
    trialEndsAt: (f.trial_ends_at as string) ?? "",
    subscription: parCabinet.get(f.id as string) ?? null,
  }))
}

/**
 * Les cabinets, pour un sélecteur — identifiant et nom, rien d'autre.
 *
 * L'écran des exceptions du catalogue appelait `getAdminFirms()` pour remplir
 * un menu déroulant : il chargeait donc les membres, les abonnements et l'état
 * d'accès de chaque cabinet pour n'en afficher que le nom.
 */
export async function getCabinetsPourChoix(): Promise<
  { id: string; name: string; plan: string }[]
> {
  const supabase = await getSessionSupabase()
  const { data } = await supabase.from("firms").select("id, name, plan").order("name")
  return (data ?? []).map((f) => ({
    id: f.id as string,
    name: (f.name as string) ?? "",
    plan: (f.plan as string) ?? "",
  }))
}

function indexerAbonnements(lignes: Record<string, unknown>[]) {
  const parCabinet = new Map<string, AdminSubscriptionRow>()
  for (const s of lignes) {
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
  return parCabinet
}

function assembler(
  firms: Record<string, unknown>[],
  profiles: Record<string, unknown>[],
  abonnements: Record<string, unknown>[],
  acces: unknown[]
): AdminFirmRow[] {
  const parCabinet = indexerAbonnements(abonnements)
  const ouvertureDe = new Map(
    (acces as { firm_id: string; access_open: boolean }[])
      .map((a) => [String(a.firm_id), Boolean(a.access_open)])
  )

  return firms.map((f) => ({
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
    // Fermé par défaut si la base n'a rien dit : sur un écran de supervision,
    // l'ignorance doit ressembler à une fermeture, jamais à une ouverture.
    accessOpen: ouvertureDe.get(f.id as string) ?? false,
    members: profiles
      .filter((p) => p.firm_id === f.id)
      .map((p) => ({
        id: p.id as string,
        email: (p.email as string) ?? "",
        fullName: (p.full_name as string) ?? "",
        ciccRole: (p.cicc_role as string) ?? "",
        statut: (p.status as string) ?? "active",
      })),
    subscription: parCabinet.get(f.id as string) ?? null,
  }))
}


export interface AdminUtilisateurRow {
  id: string
  fullName: string
  email: string
  ciccRole: string
  statut: string
  firmId: string
  firmName: string
  creeLe: string
}

export interface PageUtilisateurs {
  lignes: AdminUtilisateurRow[]
  total: number
  page: number
  parPage: number
}

export const UTILISATEURS_PAR_PAGE = 25

/**
 * Les personnes de la plateforme, tous cabinets confondus.
 *
 * La console voyait les cabinets et, à l'intérieur de chaque ligne, leurs
 * membres. On ne pouvait donc pas répondre à « qui est untel » sans savoir
 * d'abord à quel cabinet il appartient — c'est-à-dire l'information qu'on
 * cherche quand quelqu'un écrit au soutien depuis une adresse qu'on ne
 * reconnaît pas.
 *
 * La politique `profiles_read_firm` ouvre déjà cette table à l'exploitant : il
 * n'y a rien à élargir, seulement à afficher.
 */
export async function getAdminUtilisateurs(options: {
  recherche?: string
  page?: number
  parPage?: number
} = {}): Promise<PageUtilisateurs> {
  const supabase = await getSessionSupabase()

  const recherche = (options.recherche ?? "").trim()
  const parPage = options.parPage ?? UTILISATEURS_PAR_PAGE
  const page = Math.max(1, options.page ?? 1)
  const debut = (page - 1) * parPage

  let requete = supabase
    .from("profiles")
    .select("id, firm_id, email, full_name, cicc_role, status, created_at", { count: "exact" })

  if (recherche) {
    const motif = `%${recherche.replace(/[%_]/g, "")}%`
    requete = requete.or(`full_name.ilike.${motif},email.ilike.${motif}`)
  }

  const { data, count } = await requete
    .order("created_at", { ascending: false })
    .range(debut, debut + parPage - 1)

  // Le nom du cabinet, pour les seuls cabinets de la page.
  const ids = [...new Set((data ?? []).map((p) => p.firm_id as string))]
  const { data: firms } = ids.length
    ? await supabase.from("firms").select("id, name").in("id", ids)
    : { data: [] }
  const nomDe = new Map((firms ?? []).map((f) => [f.id as string, (f.name as string) ?? ""]))

  return {
    lignes: (data ?? []).map((p) => ({
      id: p.id as string,
      fullName: (p.full_name as string) ?? "",
      email: (p.email as string) ?? "",
      ciccRole: (p.cicc_role as string) ?? "",
      statut: (p.status as string) ?? "active",
      firmId: p.firm_id as string,
      firmName: nomDe.get(p.firm_id as string) ?? "",
      creeLe: ((p.created_at as string) ?? "").slice(0, 10),
    })),
    total: count ?? 0,
    page,
    parPage,
  }
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

/**
 * Les chiffres de la plateforme entière.
 *
 * `summarise()` les tirait de la liste affichée. Depuis que celle-ci est
 * paginée, elle ne montre que vingt-cinq cabinets : le tableau de bord
 * annoncerait « 25 organisations » quel qu'en soit le nombre réel, et
 * « 0 fermé » dès que les cabinets fermés seraient en deuxième page.
 *
 * Un tableau de supervision qui compte ce qu'il affiche ne supervise rien.
 */
export async function getStatistiquesPlateforme(): Promise<AdminOverview & {
  essais: number
  suspendus: number
  abonnesActifs: number
}> {
  const supabase = await getSessionSupabase()

  const [
    { count: cabinets },
    { count: membres },
    { count: suspendus },
    { count: essais },
    { count: abonnes },
    { data: acces },
    { data: proprietaires },
  ] = await Promise.all([
    supabase.from("firms").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("firms").select("id", { count: "exact", head: true }).eq("status", "suspended"),
    supabase.from("firms").select("id", { count: "exact", head: true }).eq("plan", "trial"),
    supabase
      .from("firm_subscriptions")
      .select("firm_id", { count: "exact", head: true })
      .in("status", ["active", "trialing"]),
    supabase.rpc("firms_access_state"),
    // Les cabinets QUI ONT un propriétaire ; l'écart avec le total donne ceux
    // qui n'en ont pas. Compter l'absence demanderait une jointure externe.
    supabase.from("profiles").select("firm_id").eq("cicc_role", "owner"),
  ])

  const avecProprietaire = new Set((proprietaires ?? []).map((p) => String(p.firm_id)))
  const fermes = ((acces ?? []) as { access_open: boolean }[])
    .filter((a) => !a.access_open).length

  return {
    firmCount: cabinets ?? 0,
    memberCount: membres ?? 0,
    firmsWithoutOwner: Math.max(0, (cabinets ?? 0) - avecProprietaire.size),
    firmsClosed: fermes,
    essais: essais ?? 0,
    suspendus: suspendus ?? 0,
    abonnesActifs: abonnes ?? 0,
  }
}
