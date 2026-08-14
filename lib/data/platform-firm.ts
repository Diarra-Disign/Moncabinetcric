import "server-only"

import { getServerSupabase } from "@/lib/supabase/server"
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
 * ─── POURQUOI PLUS LA CLÉ ANONYME ──────────────────────────────────────────
 *
 * Cette fonction lisait `firms` avec la clé anonyme, ce qui obligeait à ouvrir
 * la table aux visiteurs par la politique `firms_public_operator`. Son
 * commentaire affirmait n'exposer que « les champs qui figurent de toute façon
 * dans des mentions légales publiques » — mais UNE POLITIQUE POSTGRES S'APPLIQUE
 * PAR LIGNE, JAMAIS PAR COLONNE. Les 35 colonnes de la ligne étaient donc
 * lisibles sans aucun compte : courriel, téléphone, notes internes, forfait,
 * statut d'abonnement, date de suspension, et les numéros de TPS et de TVQ dès
 * qu'ils seraient renseignés.
 *
 * Vérifié avec la clé anonyme avant correction : une ligne, 35 colonnes.
 *
 * Ce module porte `server-only` depuis toujours : il n'avait donc aucune raison
 * d'employer une clé destinée au navigateur. La lecture passe désormais par le
 * client de service, et la politique publique a été retirée — plus rien
 * n'ouvre `firms` à un visiteur.
 */
export async function getPlatformOperatorFirm(): Promise<FirmIdentity> {
  // `getServerSupabase()` LÈVE quand la configuration manque, là où la version
  // précédente retombait doucement sur EMPTY_FIRM. Les pages légales sont
  // publiques : les faire planter parce qu'une variable d'environnement a été
  // effacée serait un recul. On garde donc le repli — la page s'affiche alors
  // sans les coordonnées, ce qui se voit et se corrige, au lieu d'un écran
  // d'erreur pour un visiteur.
  let supabase
  try {
    supabase = getServerSupabase()
  } catch {
    return EMPTY_FIRM
  }

  const { data, error } = await supabase
    .from("firms")
    .select(
      "id, name, rcic_license_number, owner_name, address, address_line2, city, province, postal_code, country, phone, email, website, logo_letter, logo_url, plan, status, trial_ends_at"
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
