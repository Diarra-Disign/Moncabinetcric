import { test } from "node:test"
import assert from "node:assert/strict"
import type { PDFFont } from "pdf-lib"
import { nomCabinetEnLignes } from "@/lib/pdf/primitives"

/**
 * Ce que ces épreuves cherchent à prendre en défaut.
 *
 * `nomCabinetEnLignes()` remplace un `couper(c.nom, gras, 15, 220)` qui
 * amputait la raison sociale du cabinet en tête de CHAQUE entente, facture,
 * reçu, registre et note de rencontre. « Diarra Global Visa & Immigration
 * Services Inc. » réclame 329 points à quinze, pour 220 alloués : il
 * s'imprimait « Diarra Global Visa & Immigr… », et ce qui tombait avec les
 * points de suspension était « ation Services Inc. » — la forme juridique
 * comprise. L'en-tête d'un contrat nommait donc une entité absente du registre,
 * alors que sa seule fonction est de dire QUI s'engage.
 *
 * L'INVARIANT QUI COMPTE EST UNIQUE : aucun caractère du nom ne disparaît,
 * jamais, quelle que soit la longueur. Le nombre de lignes et la taille de
 * police sont des moyens ; c'est l'intégralité qui est la garantie. Ces tests
 * l'éprouvent d'abord, et vérifient ensuite que les cas ordinaires — un nom qui
 * tenait déjà — ne changent pas de rendu.
 *
 * LA POLICE EST FEINTE, comme dans les épreuves d'`envelopper()` : mesurer avec
 * Helvetica éprouverait les métriques de pdf-lib, qui ne sont pas de mon
 * ressort. Une largeur proportionnelle au nombre de caractères éprouve la
 * logique de composition, qui l'est.
 */
const police = {
  widthOfTextAtSize: (texte: string, taille: number) => texte.length * taille * 0.5,
} as unknown as PDFFont

/** Reconstitue le nom à partir des lignes rendues, pour vérifier qu'il est entier. */
const recompose = (lignes: string[]) => lignes.join(" ")

test("nomCabinetEnLignes : un nom court garde une seule ligne et la taille pleine", () => {
  // 12 caractères à 15 : 12 × 15 × 0,5 = 90 points, largement sous 232.
  const { lignes, taille } = nomCabinetEnLignes("Cabinet Roux", police, 232)

  assert.deepEqual(lignes, ["Cabinet Roux"])
  assert.equal(taille, 15, "un nom qui tenait déjà ne doit pas être réduit")
})

test("nomCabinetEnLignes : la raison sociale qui débordait passe sur deux lignes, entière", () => {
  const nom = "Diarra Global Visa & Immigration Services Inc."
  const { lignes } = nomCabinetEnLignes(nom, police, 232)

  assert.equal(lignes.length, 2)
  assert.equal(recompose(lignes), nom, "aucun mot ne doit manquer")
  assert.ok(!lignes.some((l) => l.includes("…")), "plus aucune troncature")
})

test("nomCabinetEnLignes : aucune ligne ne dépasse la largeur donnée", () => {
  const nom = "Société d'avocats et consultants réglementés en immigration du Québec Inc."
  const LARGEUR = 232
  const { lignes, taille } = nomCabinetEnLignes(nom, police, LARGEUR)

  for (const ligne of lignes) {
    assert.ok(
      police.widthOfTextAtSize(ligne, taille) <= LARGEUR,
      `« ${ligne} » déborde : ${police.widthOfTextAtSize(ligne, taille)} > ${LARGEUR}`
    )
  }
})

test("nomCabinetEnLignes : la taille ne baisse que si deux lignes ne suffisent pas", () => {
  // Assez long pour ne pas tenir à 15, assez court pour tenir en deux lignes
  // une fois la police réduite : c'est le moment où le repli doit s'enclencher.
  const nom = "Groupe conseil en immigration et mobilite internationale Inc."
  const { lignes, taille } = nomCabinetEnLignes(nom, police, 232)

  assert.ok(lignes.length <= 2, "deux lignes au plus tant que la taille le permet")
  assert.ok(taille <= 15)
  assert.ok(taille >= 11, "la taille ne descend jamais sous le plancher")
  assert.equal(recompose(lignes), nom)
})

test("nomCabinetEnLignes : un nom démesuré prend des lignes plutôt que d'être amputé", () => {
  // Le cas où même le plancher de taille ne tient pas en deux lignes. La
  // fonction doit alors préférer une troisième ligne au silence : un nom entier
  // sur trois lignes vaut mieux qu'un nom coupé sur deux.
  const nom = Array.from({ length: 30 }, (_, i) => `Mot${i}`).join(" ")
  const { lignes } = nomCabinetEnLignes(nom, police, 232)

  assert.ok(lignes.length > 2, "la contrainte de deux lignes cède avant l'intégralité")
  assert.equal(recompose(lignes), nom, "aucun mot perdu, même dans le pire cas")
})
