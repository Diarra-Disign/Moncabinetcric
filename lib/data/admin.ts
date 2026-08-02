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
  members: AdminMemberRow[]
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

  const [{ data: firms }, { data: profiles }] = await Promise.all([
    supabase
      .from("firms")
      .select("id, name, rcic_license_number, owner_name, email, phone, address, created_at")
      .order("created_at", { ascending: true }),
    supabase.from("profiles").select("id, firm_id, email, full_name, cicc_role"),
  ])

  return (firms ?? []).map((f) => ({
    id: f.id as string,
    name: (f.name as string) ?? "",
    rcicLicenseNumber: (f.rcic_license_number as string) ?? "",
    ownerName: (f.owner_name as string) ?? "",
    email: (f.email as string) ?? "",
    phone: (f.phone as string) ?? "",
    city: cityOf(f.address as string | null),
    createdAt: ((f.created_at as string) ?? "").slice(0, 10),
    members: (profiles ?? [])
      .filter((p) => p.firm_id === f.id)
      .map((p) => ({
        id: p.id as string,
        email: (p.email as string) ?? "",
        fullName: (p.full_name as string) ?? "",
        ciccRole: (p.cicc_role as string) ?? "",
      })),
  }))
}

export interface AdminOverview {
  firmCount: number
  memberCount: number
  firmsWithoutOwner: number
}

export function summarise(firms: AdminFirmRow[]): AdminOverview {
  return {
    firmCount: firms.length,
    memberCount: firms.reduce((n, f) => n + f.members.length, 0),
    // Un cabinet sans propriétaire ne peut ni inviter, ni modifier son
    // identité : c'est une impasse silencieuse, à signaler.
    firmsWithoutOwner: firms.filter((f) => !f.members.some((m) => m.ciccRole === "owner")).length,
  }
}
