import "server-only"

import { createClient } from "@supabase/supabase-js"
import { EMPTY_FIRM, mapFirmRow, type FirmIdentity, type FirmRow } from "@/lib/data/firm"

/**
 * Identité de l'entité qui exploite la plateforme.
 *
 * Alimente les mentions légales des pages publiques — politique de
 * confidentialité et conditions d'utilisation. Ces pages n'ont aucune
 * session : elles ne peuvent pas déduire le cabinet du membre connecté,
 * d'où le marqueur explicite is_platform_operator en base.
 *
 * Ces coordonnées étaient auparavant figées dans les catalogues de
 * traduction, avec un cabinet fictif et un numéro de permis inexistant.
 * La politique de confidentialité désignait donc un responsable de la
 * protection des renseignements personnels qui n'existe pas — le contraire
 * de ce que la Loi 25 attend de ce document.
 *
 * La lecture emploie la clé anonyme : une politique dédiée n'expose que le
 * cabinet exploitant, et seulement les champs qui figurent de toute façon
 * dans des mentions légales publiques.
 */
export async function getPlatformOperatorFirm(): Promise<FirmIdentity> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return EMPTY_FIRM

  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await supabase
    .from("firms")
    .select(
      "id, name, rcic_license_number, owner_name, address, phone, email, website, logo_letter, logo_url, plan, status, trial_ends_at"
    )
    .eq("is_platform_operator", true)
    .maybeSingle()

  if (error || !data) return EMPTY_FIRM
  return mapFirmRow(data as FirmRow)
}

/**
 * Ville et pays, pour la ligne d'adresse des mentions légales.
 * « 801-88 rue X, Gatineau, QC J8X 0B9 » devient « Gatineau, QC J8X 0B9 ».
 */
export function shortLocation(address: string): string {
  if (!address) return ""
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean)
  return parts.slice(-2).join(", ")
}
