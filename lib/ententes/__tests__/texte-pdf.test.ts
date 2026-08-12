import { test } from "node:test"
import assert from "node:assert/strict"
import type { PDFFont } from "pdf-lib"
import { sur, couper, envelopper } from "@/lib/pdf/texte"

/**
 * Ce que ces épreuves cherchent à prendre en défaut.
 *
 * `envelopper()` est la seule fonction du moteur PDF dont l'erreur est
 * SILENCIEUSE. Une police mal mesurée lève ; un texte qui déborde ne lève pas —
 * il sort de la page et devient invisible à l'impression. Sur un contrat, cela
 * veut dire une obligation retirée du document que le client signe, et personne
 * ne s'en aperçoit avant qu'on ne la lui oppose.
 *
 * LA POLICE EST FEINTE, et c'est délibéré. Mesurer avec Helvetica éprouverait
 * les métriques de pdf-lib, qui ne sont pas de mon ressort. Une largeur
 * proportionnelle au nombre de caractères éprouve la LOGIQUE DE PLIAGE, qui
 * l'est. Le contrat de la fonction tient en une phrase : aucune ligne rendue ne
 * dépasse la largeur donnée, et aucun mot ne disparaît.
 */
const police = {
  widthOfTextAtSize: (texte: string, taille: number) => texte.length * taille * 0.5,
} as unknown as PDFFont

/** 10 caractères à la taille 10 : 10 × 10 × 0,5 = 50. */
const LARGEUR_10_CARACTERES = 50

test("envelopper : un texte court tient sur une seule ligne", () => {
  assert.deepEqual(envelopper("Honoraires", police, 10, LARGEUR_10_CARACTERES), ["Honoraires"])
})

test("envelopper : aucune ligne ne dépasse la largeur donnée", () => {
  const texte =
    "Le consultant s'engage à représenter le client devant Immigration, " +
    "Réfugiés et Citoyenneté Canada dans le cadre du mandat décrit à l'article premier."
  const lignes = envelopper(texte, police, 9.5, 400)
  for (const ligne of lignes) {
    assert.ok(
      police.widthOfTextAtSize(ligne, 9.5) <= 400,
      `Ligne trop large : « ${ligne} »`
    )
  }
})

test("envelopper : aucun mot n'est perdu ni dupliqué", () => {
  const texte =
    "Le présent mandat ne comporte aucune garantie de résultat, la décision " +
    "appartenant exclusivement à l'autorité compétente."
  const lignes = envelopper(texte, police, 9.5, 180)
  assert.equal(lignes.join(" ").split(/\s+/).join(" "), sur(texte))
})

test("envelopper : les alinéas du modèle sont respectés", () => {
  // Un article rédigé en alinéas doit s'imprimer en alinéas. Aplatir les
  // retours à la ligne collerait « a) » et « b) » sur la même ligne.
  const lignes = envelopper("Premier alinéa.\n\nSecond alinéa.", police, 10, 500)
  assert.deepEqual(lignes, ["Premier alinéa.", "", "Second alinéa."])
})

test("envelopper : un mot plus large que la ligne est brisé, jamais laissé déborder", () => {
  // Une adresse de courriel longue, un numéro de dossier : sans cette
  // précaution, le mot sort de la page et disparaît à l'impression.
  const lignes = envelopper("abcdefghijklmnopqrstuvwxyz", police, 10, LARGEUR_10_CARACTERES)
  assert.ok(lignes.length > 1)
  for (const ligne of lignes) {
    assert.ok(police.widthOfTextAtSize(ligne, 10) <= LARGEUR_10_CARACTERES)
  }
  assert.equal(lignes.join(""), "abcdefghijklmnopqrstuvwxyz")
})

test("envelopper : un texte vide rend une ligne vide, pas rien", () => {
  // Rendre un tableau vide ferait disparaître l'espacement d'un article sans
  // corps, et le titre suivant viendrait se coller au précédent.
  assert.deepEqual(envelopper("", police, 10, 100), [""])
})

test("sur : un nom vietnamien devient imprimable au lieu de faire échouer le document", () => {
  // Le défaut d'origine : pdf-lib LÈVE sur un caractère hors WinAnsi, et la
  // pièce n'existait pas du tout. Pour un cabinet d'immigration, ces noms sont
  // la règle.
  assert.equal(sur("Nguyễn"), "Nguyen")
})

test("sur : une écriture non latine devient visible comme incomplète", () => {
  // Compromis assumé : un nom visiblement incomplet se corrige, un document
  // qui n'existe pas ne se corrige pas.
  assert.equal(sur("أحمد"), "????")
})

test("sur : les accents français et la typographie courante passent intacts", () => {
  assert.equal(sur("Réfugiés — l'entente « pro bono »"), "Réfugiés — l'entente « pro bono »")
})

test("sur : le vrai signe moins devient un trait d'union imprimable", () => {
  // Sans cette équivalence, « Déjà réglé » s'imprimait « ?300,00 $ ».
  assert.equal(sur("−300,00 $"), "-300,00 $")
})

test("couper : abrège avec des points de suspension au lieu de déborder", () => {
  const court = couper("Honoraires professionnels du cabinet", police, 10, LARGEUR_10_CARACTERES)
  assert.ok(court.endsWith("…"))
  assert.ok(police.widthOfTextAtSize(court, 10) <= LARGEUR_10_CARACTERES)
})

test("couper : mesure APRÈS translittération", () => {
  // « Nguyễn » et « Nguyen » n'ont pas la même longueur, et c'est le second qui
  // sera écrit : mesurer le premier abrégerait pour rien.
  assert.equal(couper("Nguyễn", police, 10, LARGEUR_10_CARACTERES), "Nguyen")
})
