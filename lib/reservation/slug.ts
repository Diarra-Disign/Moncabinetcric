/**
 * Une raison sociale devient une adresse de page publique.
 *
 * ─── POURQUOI CE FICHIER EXISTE SÉPARÉMENT ─────────────────────────────────
 *
 * Cette fonction vivait d'abord dans `disponibilites-actions.ts`, marqué
 * `"use server"`. Le build a refusé : dans un module de Server Actions, TOUT
 * export doit être une fonction asynchrone, puisque chacun devient un point
 * d'entrée appelable depuis le navigateur. Une fonction pure et synchrone n'y a
 * pas sa place.
 *
 * ─── LES ACCENTS ───────────────────────────────────────────────────────────
 *
 * `normalize("NFD")` sépare « é » en « e » + accent combinant, que l'intervalle
 * ̀-ͯ retire ensuite. Sans cela, « Île-du-Prince-Édouard » perdrait
 * ses lettres accentuées entières et donnerait « le-du-prince-douard ».
 */
export function slugDepuis(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "")
}
