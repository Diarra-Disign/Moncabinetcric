/**
 * Le vocabulaire des statuts de membre.
 *
 * Module PUR, et il ne l'est pas par élégance : `member-actions.ts` porte la
 * directive « use server », et Next EXIGE qu'un tel module n'exporte QUE des
 * fonctions asynchrones. Un tableau y était exporté — `STATUTS_MEMBRE` —, ce
 * qui fait échouer le module ENTIER au moment où un composant client
 * l'atteint :
 *
 *     A "use server" file can only export async functions, found object.
 *
 * L'erreur ne se voit ni à la compilation ni au « build » : elle est levée à
 * l'exécution, quand l'action est appelée. Toutes les actions du fichier
 * tombaient avec elle.
 */

/**
 * Statuts qu'un propriétaire peut poser sur un membre de son cabinet.
 *
 * `revoked` est définitif du point de vue de l'usage courant, mais reste
 * techniquement réversible : c'est une décision, pas une destruction.
 */
export const STATUTS_MEMBRE = ["active", "suspended", "revoked"] as const
export type StatutMembre = (typeof STATUTS_MEMBRE)[number]
