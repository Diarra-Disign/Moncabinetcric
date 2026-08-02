/**
 * Sélecteur de source de données.
 *
 * "mock" (défaut)  : lib/data/mock/, aucun accès réseau.
 * "supabase"       : base réelle, via lib/data/supabase/.
 *
 * Le défaut est volontairement "mock" : tant que DATA_SOURCE n'est pas
 * explicitement positionné, l'application se comporte exactement comme
 * avant ce branchement. Aucune régression possible par simple oubli de
 * configuration.
 */
export type DataSourceName = "mock" | "supabase"

export function getDataSource(): DataSourceName {
  return process.env.DATA_SOURCE === "supabase" ? "supabase" : "mock"
}

export function isSupabaseSource(): boolean {
  return getDataSource() === "supabase"
}
