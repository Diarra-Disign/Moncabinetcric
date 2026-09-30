/**
 * La destination à retrouver après une connexion.
 *
 * ─── POURQUOI CETTE FONCTION EXISTE ────────────────────────────────────────
 *
 * `proxy.ts` mémorisait le seul CHEMIN de la page demandée. Une adresse
 * porteuse de paramètres — `/fr/matters?client=…`, la liste des dossiers d'un
 * client — revenait donc amputée : après connexion, on atterrissait sur la
 * liste complète du cabinet, sans le filtre demandé.
 *
 * Le chemin et sa requête voyagent maintenant ensemble, dans le seul
 * paramètre `suivant`. L'adresse de connexion, elle, est nettoyée : les
 * paramètres de la page demandée n'ont rien à y faire.
 *
 * La valeur reste un chemin interne, jamais une adresse absolue : le
 * formulaire de connexion refuse tout ce qui ne commence pas par « / », et
 * tout ce qui commence par « // » — ce serait une redirection vers un autre
 * domaine après authentification.
 */
export function destinationApresConnexion(pathname: string, search: string): string {
  return `${pathname}${search}`
}
