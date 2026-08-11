"use server"

import { listerDossiersRecents } from "./dossiers-recents"
import type {
  CritèresDossiersRecents,
  PageDossiersRecents,
} from "./dossiers-recents-criteres"

/**
 * Rejouer la recherche des dossiers récents depuis l'écran.
 *
 * La première page arrive par le rendu serveur : le tableau de bord affiche
 * donc ses dossiers sans attendre le moindre appel. Cette action ne sert qu'à
 * ce qui suit — changer de période, de tri, taper une recherche.
 *
 * Elle passe par listerDossiersRecents(), donc par firm_recent_matters(), donc
 * par RLS. Une seconde implémentation du filtrage pour l'interactivité aurait
 * fini par diverger de celle du rendu initial, et l'écran aurait montré deux
 * réponses différentes à la même question selon qu'on ait touché un filtre ou
 * non.
 */
export async function chercherDossiersRecents(
  criteres: CritèresDossiersRecents
): Promise<PageDossiersRecents> {
  return listerDossiersRecents(criteres)
}
