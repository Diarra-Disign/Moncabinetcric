import type { PDFFont, PDFPage } from "pdf-lib"

/**
 * Le texte d'une pièce PDF : ce qui s'imprime, et comment il se plie.
 *
 * Module PUR — ni « server-only », ni pdf-lib à l'exécution : le type PDFFont
 * est effacé à la compilation, et rien ici n'appelle autre chose que
 * `widthOfTextAtSize`. C'est délibéré, et c'est la leçon déjà apprise sur
 * `verifierSections()` et `bornesDeLaPeriode()` : une fonction qu'aucun test ne
 * peut appeler finit par n'être éprouvée qu'en production.
 *
 * Ce qui se joue ici mérite ce soin. `sur()` décide de ce qui est imprimable et
 * `envelopper()` de ce qui tient sur la page — deux endroits où une erreur ne
 * lève aucune exception : elle fait simplement disparaître du texte d'un
 * contrat, en silence.
 */

/**
 * Rend un texte imprimable par une police standard de PDF.
 *
 * LE DÉFAUT QUE CECI CORRIGE : les polices standard ne couvrent que le
 * WinAnsi, et pdf-lib LÈVE UNE ERREUR sur tout caractère hors de ce jeu. Une
 * cliente nommée Nguyễn, un client nommé Wojciech ou أحمد rendaient donc leur
 * facture impossible à produire — la route répondait 500 et le bouton
 * « Voir le PDF » ne faisait rien. Pour un cabinet d'immigration, ces noms
 * sont la règle, pas l'exception.
 *
 * On translittère plutôt que d'échouer : « ễ » se décompose en « e » plus des
 * accents, dont on garde la base — c'est la romanisation qu'IRCC emploie déjà
 * sur les documents de voyage. Les lettres latines qui ne se décomposent pas
 * (ł, đ) ont leur équivalent en table.
 *
 * Ce qui ne se translittère pas — arabe, chinois, cyrillique — devient « ? ».
 * C'est un compromis ASSUMÉ et il se voit : mieux vaut un nom visiblement
 * incomplet, qu'on corrige, qu'un document qui n'existe pas. Imprimer ces
 * écritures demanderait d'intégrer une police Unicode au PDF.
 */
const EQUIVALENTS: Record<string, string> = {
  "ł": "l", "Ł": "L", "đ": "d", "Đ": "D", "ħ": "h", "Ħ": "H",
  "ı": "i", "ŋ": "n", "Ŋ": "N", "ŧ": "t", "Ŧ": "T", "ə": "e",
  "‑": "-", "‒": "-", "―": "-", "′": "'", "″": '"',
  // U+2212, le vrai signe moins. Il est plus juste typographiquement que le
  // trait d'union, et c'est celui qu'on écrit spontanément devant un montant
  // déduit — mais WinAnsi ne le connaît pas. Sans cette ligne, « Déjà réglé »
  // s'imprimait « ?300,00 $ » sur chaque reçu.
  "−": "-",
}

/**
 * Les vingt-sept caractères que WinAnsi loge entre 0x80 et 0x9F, hors du
 * latin-1 : sans cette liste, l'apostrophe courbe et le tiret cadratin
 * — fréquents dans un texte français — seraient translittérés pour rien.
 */
const WINANSI_SUP = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ''“”•–—˜™š›œžŸ")

const encodable = (c: string) => {
  const n = c.codePointAt(0) ?? 0
  return (n >= 0x20 && n <= 0x7e) || (n >= 0xa0 && n <= 0xff) || WINANSI_SUP.has(c)
}

export function sur(texte: string): string {
  let sortie = ""
  for (const c of texte) {
    if (encodable(c)) { sortie += c; continue }
    if (EQUIVALENTS[c]) { sortie += EQUIVALENTS[c]; continue }
    // « ễ » se décompose en « e » suivi de deux marques : on garde la base.
    const base = [...c.normalize("NFD")].filter((d) => encodable(d)).join("")
    sortie += base || "?"
  }
  return sortie
}

/** Toute écriture passe par ici : un seul point où le texte est assaini. */
export function ecrire(
  page: PDFPage, texte: string,
  options: Parameters<PDFPage["drawText"]>[1]
) {
  page.drawText(sur(texte), options)
}

/**
 * Coupe un texte à la largeur disponible.
 *
 * Sans cela, une description un peu longue sort de la page — le texte n'est
 * pas tronqué par le PDF, il continue simplement dans le vide et devient
 * invisible à l'impression. On ne s'en apercevrait que sur la facture d'un
 * vrai client.
 */
export function couper(entree: string, police: PDFFont, taille: number, largeur: number): string {
  // Mesuré APRÈS assainissement : « Nguyễn » et « Nguyen » n'ont pas la même
  // largeur, et c'est le second qui sera écrit.
  const texte = sur(entree)
  if (police.widthOfTextAtSize(texte, taille) <= largeur) return texte
  let court = texte
  while (court.length > 1 && police.widthOfTextAtSize(court + "…", taille) > largeur) {
    court = court.slice(0, -1)
  }
  return court + "…"
}

/**
 * Découpe un texte en lignes qui tiennent dans la largeur.
 *
 * COUPER NE SUFFIT PAS ICI, et c'est la différence entre une facture et un
 * contrat. Une description de facture tient sur une ligne : ce qui dépasse est
 * du détail, et l'abréger est acceptable. Un article de contrat fait dix
 * lignes : l'abréger, c'est retirer des obligations du texte que le client
 * signe. Il faut donc envelopper, jamais tronquer.
 *
 * Les retours à la ligne explicites du modèle sont respectés — un article
 * rédigé en alinéas doit s'imprimer en alinéas.
 *
 * Un mot plus long que la ligne entière (une URL, un identifiant) est coupé de
 * force : sans cela il déborderait dans le vide et deviendrait invisible.
 */
export function envelopper(
  entree: string, police: PDFFont, taille: number, largeur: number
): string[] {
  const lignes: string[] = []
  // LA DÉCOUPE D'ABORD, L'ASSAINISSEMENT ENSUITE. Le retour à la ligne ne fait
  // pas partie du WinAnsi : `sur()` le remplace par « ? ». Appliqué au texte
  // entier avant la découpe, il effaçait donc les alinéas — un article rédigé
  // en a) b) c) s'imprimait d'un seul bloc, ponctué de « ?? » aux jointures.
  // Le défaut ne levait rien : il se serait vu sur le premier contrat envoyé.
  for (const brut of entree.split("\n")) {
    const paragraphe = sur(brut)
    if (!paragraphe.trim()) { lignes.push(""); continue }
    let courante = ""
    for (const mot of paragraphe.split(/\s+/).filter(Boolean)) {
      const essai = courante ? `${courante} ${mot}` : mot
      if (police.widthOfTextAtSize(essai, taille) <= largeur) { courante = essai; continue }
      if (courante) lignes.push(courante)
      if (police.widthOfTextAtSize(mot, taille) <= largeur) { courante = mot; continue }
      // Mot indivisible plus large que la ligne : on le brise caractère par
      // caractère plutôt que de le laisser sortir de la page.
      let reste = mot
      while (police.widthOfTextAtSize(reste, taille) > largeur && reste.length > 1) {
        let morceau = reste
        while (morceau.length > 1 && police.widthOfTextAtSize(morceau, taille) > largeur) {
          morceau = morceau.slice(0, -1)
        }
        lignes.push(morceau)
        reste = reste.slice(morceau.length)
      }
      courante = reste
    }
    lignes.push(courante)
  }
  return lignes
}
