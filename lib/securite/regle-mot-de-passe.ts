/**
 * La règle de mot de passe, écrite une seule fois.
 *
 * ─── POURQUOI CE FICHIER EXISTE ────────────────────────────────────────────
 *
 * La règle vivait à trois endroits — les deux formulaires et l'action de
 * serveur — et les trois ne regardaient que la LONGUEUR. Or la console
 * Supabase exige désormais quatre familles de caractères en plus des douze.
 *
 * Le résultat se voyait au pire moment. Un invité saisissait
 * « consultationimmigration » : vingt-trois caractères, accepté par le
 * formulaire, refusé par le serveur. Et le message affiché disait « il doit
 * compter au moins 12 caractères » — une phrase à la fois fausse et
 * décourageante, qui l'envoyait rallonger un mot de passe déjà bien assez
 * long. Au dernier écran du parcours, celui qui ouvre son accès.
 *
 * Ce module ne protège rien par lui-même : il tourne dans le navigateur, donc
 * il se contourne. Sa seule raison d'être est de DIRE LA VÉRITÉ avant
 * l'envoi. La règle qui fait foi reste celle de la console Supabase — et ce
 * fichier n'a de valeur que tant qu'il la recopie fidèlement.
 *
 * ─── SI LA RÈGLE CHANGE DANS LA CONSOLE ────────────────────────────────────
 *
 * Il faut modifier `EXIGENCES` ici, et rien d'autre : les trois appelants en
 * héritent. Relevé le 2026-08-15 dans `password_required_characters` :
 *
 *   abcdefghijklmnopqrstuvwxyz : ABCDEFGHIJKLMNOPQRSTUVWXYZ
 *   0123456789                 : !@#$%^&*()_+-=[]{};'\:"|<>?,./`~
 *
 * Aucune entrée-sortie, aucun `server-only` : ce module doit rester
 * utilisable des deux côtés de la frontière serveur/client, faute de quoi on
 * retomberait dans deux règles pour une seule vérité.
 */

export const LONGUEUR_MINIMALE = 12

/**
 * Les symboles acceptés, énumérés plutôt que déduits.
 *
 * « tout ce qui n'est ni lettre ni chiffre » aurait été plus court et faux :
 * un mot de passe dont le seul symbole serait « € » ou « £ » passerait ici et
 * se ferait refuser par le serveur. C'est précisément le décalage qu'on
 * cherche à supprimer.
 */
const SYMBOLES = "!@#$%^&*()_+-=[]{};'\\:\"|<>?,./`~"

/** Ce qu'il manque à un mot de passe, dans l'ordre où on le dit à l'écran. */
export type Exigence = "longueur" | "minuscule" | "majuscule" | "chiffre" | "symbole"

const EXIGENCES: { cle: Exigence; satisfaite: (m: string) => boolean }[] = [
  { cle: "longueur", satisfaite: (m) => m.length >= LONGUEUR_MINIMALE },
  { cle: "minuscule", satisfaite: (m) => /[a-z]/.test(m) },
  { cle: "majuscule", satisfaite: (m) => /[A-Z]/.test(m) },
  { cle: "chiffre", satisfaite: (m) => /[0-9]/.test(m) },
  { cle: "symbole", satisfaite: (m) => [...m].some((c) => SYMBOLES.includes(c)) },
]

/**
 * Les exigences NON satisfaites, dans l'ordre d'affichage.
 *
 * Renvoie une liste plutôt qu'un booléen : dire « il manque une majuscule et
 * un chiffre » vaut mieux que « mot de passe invalide », et permet la liste
 * qui se coche à la frappe.
 */
export function exigencesManquantes(motDePasse: string): Exigence[] {
  return EXIGENCES.filter((e) => !e.satisfaite(motDePasse)).map((e) => e.cle)
}

/** Toutes les exigences sont-elles remplies ? */
export function motDePasseValide(motDePasse: string): boolean {
  return exigencesManquantes(motDePasse).length === 0
}
