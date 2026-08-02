import "server-only"

import { getSessionSupabase, getCurrentMember } from "@/lib/supabase/session"
import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Contexte de données de la requête en cours.
 *
 * Avant l'authentification, la couche d'accès employait la clé
 * service_role et lisait le cabinet dans une variable d'environnement.
 * Deux conséquences : RLS était contournée, et le cloisonnement entre
 * cabinets ne tenait qu'au filtre `.eq("firm_id", …)` écrit à la main
 * dans chaque requête — un oubli suffisait à tout exposer.
 *
 * Désormais le client porte la session de l'utilisateur : la base
 * applique elle-même les politiques. Les filtres firm_id restent en
 * place, mais ils ne sont plus la seule barrière — ils deviennent une
 * seconde ligne de défense.
 */

export async function db(): Promise<SupabaseClient> {
  return getSessionSupabase()
}

/**
 * Cabinet de l'utilisateur connecté.
 *
 * Lève si aucune session : une lecture de données métier sans membre
 * authentifié est une erreur de programmation, pas un cas nominal. Mieux
 * vaut une exception visible qu'une requête silencieusement vide.
 */
export async function currentFirmId(): Promise<string> {
  const member = await getCurrentMember()
  if (!member) {
    throw new Error(
      "Aucune session authentifiée : la couche de données a été appelée " +
        "hors d'un contexte utilisateur. Vérifier que la route est bien " +
        "protégée par proxy.ts."
    )
  }
  return member.firmId
}
