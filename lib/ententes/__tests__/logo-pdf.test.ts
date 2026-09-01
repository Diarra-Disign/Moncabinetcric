import { test } from "node:test"
import assert from "node:assert/strict"
import { boiteLogo } from "@/lib/pdf/primitives"

/**
 * Ce que ces épreuves cherchent à prendre en défaut.
 *
 * `boiteLogo()` remplace un calcul dont l'erreur était SILENCIEUSE et VISIBLE
 * en même temps — la pire combinaison. L'ancien code fixait la hauteur puis
 * plafonnait la largeur sans la recalculer :
 *
 *     const h = 44
 *     const l = (image.width / image.height) * h
 *     drawImage({ width: Math.min(l, 170), height: h })
 *
 * Au-delà du rapport 170/44 ≈ 3,86, la largeur était tronquée pendant que la
 * hauteur restait entière. Un logo en bandeau — le nom du cabinet sur une
 * ligne, la forme la plus répandue — sortait donc COMPRIMÉ sur chaque entente,
 * chaque facture et chaque reçu, sans qu'aucune exception ne soit levée. Le
 * cabinet voyait son logo déformé et n'avait aucune raison de soupçonner le
 * moteur plutôt que son propre fichier.
 *
 * LE CONTRAT TIENT EN DEUX PHRASES, et c'est ce que ces tests vérifient : la
 * boîte rendue ne dépasse aucune des deux bornes, et le rapport de l'image
 * d'origine est conservé exactement. Le reste — quelle borne mord, quelle
 * hauteur on accorde à quel document — relève de l'appelant.
 */

/** Le rapport doit survivre au calcul, à l'arrondi flottant près. */
function assertRapportConserve(
  image: { width: number; height: number },
  boite: { largeur: number; hauteur: number }
) {
  const attendu = image.width / image.height
  const obtenu = boite.largeur / boite.hauteur
  assert.ok(
    Math.abs(attendu - obtenu) < 1e-9,
    `rapport déformé : attendu ${attendu}, obtenu ${obtenu}`
  )
}

test("boiteLogo : un bandeau large n'est plus comprimé", () => {
  // 678 × 143, rapport 4,74 : exactement le cas que l'ancien plafond écrasait
  // à 170 × 44, soit un rapport 3,86 — près d'un cinquième de largeur perdue.
  const image = { width: 678, height: 143 }
  const boite = boiteLogo(image, 232, 64)

  assert.equal(boite.largeur, 232, "la largeur disponible doit être prise en entier")
  assertRapportConserve(image, boite)
  assert.ok(boite.hauteur < 64, "la hauteur doit rester sous son plafond")
})

test("boiteLogo : un carré monte jusqu'au plafond de hauteur, pas au-delà", () => {
  const image = { width: 124, height: 124 }
  const boite = boiteLogo(image, 232, 64)

  assert.equal(boite.hauteur, 64)
  assert.equal(boite.largeur, 64, "un carré ne doit pas s'étaler sur la largeur permise")
  assertRapportConserve(image, boite)
})

test("boiteLogo : un logo en hauteur est borné par la hauteur, jamais par la largeur", () => {
  const image = { width: 100, height: 200 }
  const boite = boiteLogo(image, 232, 64)

  assert.equal(boite.hauteur, 64)
  assert.equal(boite.largeur, 32)
  assertRapportConserve(image, boite)
})

test("boiteLogo : une image plus petite que la boîte est tout de même mise à l'échelle", () => {
  // La boîte décrit la place ACCORDÉE, pas un maximum à ne pas dépasser : un
  // petit logo doit remplir l'en-tête plutôt que d'y flotter. La résolution,
  // elle, est l'affaire du dépôt — c'est là que l'image est rééchantillonnée.
  const image = { width: 20, height: 20 }
  const boite = boiteLogo(image, 232, 64)

  assert.equal(boite.hauteur, 64)
  assertRapportConserve(image, boite)
})

test("boiteLogo : aucune des deux bornes n'est jamais dépassée", () => {
  const LARGEUR_MAX = 232
  const HAUTEUR_MAX = 64
  // Du très étiré à l'horizontale au très étiré à la verticale, en passant par
  // le carré : aucune forme ne doit sortir de la boîte.
  const formes = [
    { width: 4000, height: 100 },
    { width: 678, height: 143 },
    { width: 300, height: 200 },
    { width: 124, height: 124 },
    { width: 200, height: 300 },
    { width: 100, height: 4000 },
  ]

  for (const image of formes) {
    const boite = boiteLogo(image, LARGEUR_MAX, HAUTEUR_MAX)
    assert.ok(
      boite.largeur <= LARGEUR_MAX + 1e-9,
      `${image.width}×${image.height} déborde en largeur : ${boite.largeur}`
    )
    assert.ok(
      boite.hauteur <= HAUTEUR_MAX + 1e-9,
      `${image.width}×${image.height} déborde en hauteur : ${boite.hauteur}`
    )
    assertRapportConserve(image, boite)
  }
})
