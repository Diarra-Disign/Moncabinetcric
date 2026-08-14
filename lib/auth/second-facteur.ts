import "server-only"

import { redirect } from "next/navigation"
import { getSessionSupabase } from "@/lib/supabase/session"

/**
 * Exige le second facteur quand le compte en a enrôlé un.
 *
 * ─── POURQUOI CE CONTRÔLE EST LE SEUL QUI COMPTE ───────────────────────────
 *
 * L'écran de connexion PROPOSE le défi ; il ne l'impose pas. Une session issue
 * du mot de passe seul est parfaitement valide — simplement de niveau `aal1`.
 * Sans ce garde, il suffirait de fermer l'onglet au moment du code et de
 * revenir sur /fr/dashboard : la session tient, et le second facteur n'aurait
 * servi à rien.
 *
 * Un second facteur qu'on peut sauter n'est pas un second facteur. C'est une
 * case cochée dans un audit.
 *
 * ─── CE QU'IL NE FAIT PAS ──────────────────────────────────────────────────
 *
 * `nextLevel` ne vaut « aal2 » que si un facteur est VÉRIFIÉ. Un enrôlement
 * abandonné en cours de route laisse `nextLevel` à « aal1 » : personne ne se
 * retrouve enfermé dehors par une tentative inachevée.
 *
 * En cas d'erreur de lecture, on LAISSE PASSER. C'est délibéré, et c'est le
 * même arbitrage que pour la limitation de débit : ce garde renforce, il ne
 * garde pas les données. Ce qui garde les données, c'est la RLS, et elle ne
 * dépend pas d'ici. Fermer l'application entière parce qu'un appel réseau a
 * échoué coûterait plus qu'il ne protégerait.
 *
 * ─── LE PARAMÈTRE « probleme » N'EST PAS DÉCORATIF ─────────────────────────
 *
 * `proxy.ts` renvoie tout utilisateur connecté hors de /connexion, vers le
 * tableau de bord. Sans ce paramètre, la redirection ci-dessous rebondirait
 * aussitôt ici, et l'utilisateur ferait des allers-retours sans jamais voir le
 * champ du code.
 */
export async function exigerSecondFacteur(): Promise<void> {
  let niveau
  try {
    const supabase = await getSessionSupabase()
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (error) return
    niveau = data
  } catch {
    return
  }

  if (niveau?.nextLevel === "aal2" && niveau.currentLevel !== "aal2") {
    redirect("/fr/connexion?probleme=facteur")
  }
}
