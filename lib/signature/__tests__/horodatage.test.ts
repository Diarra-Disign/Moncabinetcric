import { test } from "node:test"
import assert from "node:assert/strict"
import {
  dateSignature, heureSignature, horodatage, abreviationFuseau, FUSEAU,
} from "../horodatage"

/**
 * Le fuseau de l'Est, et sa bascule.
 *
 * CE QUE CES ÉPREUVES CHERCHENT À PRENDRE EN DÉFAUT : un décalage fixe. Écrire
 * « UTC−5 » donne le bon résultat quatre mois par an et se trompe d'une heure
 * le reste du temps. Sur une pièce qui atteste l'instant d'un consentement,
 * cette heure fausse ne se voit pas — d'où ces épreuves, qui la voient.
 */

// Deux instants choisis de part et d'autre de la bascule, en temps universel.
const ETE = "2026-08-12T02:14:30.000Z"    // 12 août, 22 h 14 la veille à Montréal
const HIVER = "2026-01-15T18:30:00.000Z"  // 15 janvier, 13 h 30 à Montréal

test("le fuseau visé est bien celui de l'Est canadien", () => {
  assert.equal(FUSEAU, "America/Toronto")
})

test("l'été, l'Est est à UTC−4 : 02:14 UTC devient 22 h 14 la veille", () => {
  // « 22 h 14 » et non « 22:14 » : c'est la forme française canadienne, celle
  // que le reste du produit imprime déjà sur les factures et les reçus.
  assert.equal(heureSignature(ETE), "22 h 14")
  assert.equal(dateSignature(ETE), "11 août 2026")
})

test("l'hiver, l'Est est à UTC−5", () => {
  assert.equal(heureSignature(HIVER), "13 h 30")
  assert.equal(dateSignature(HIVER), "15 janvier 2026")
})

test("l'abréviation suit la saison", () => {
  assert.equal(abreviationFuseau(ETE), "EDT")
  assert.equal(abreviationFuseau(HIVER), "EST")
})

test("la date change de JOUR quand l'heure universelle est passée minuit", () => {
  // Le piège que le fuseau évite : sans conversion, une signature apposée le
  // 11 août à 22 h 14 à Montréal serait datée du 12 sur le contrat.
  assert.equal(dateSignature(ETE), "11 août 2026")
  assert.notEqual(dateSignature(ETE), "12 août 2026")
})

test("l'horodatage complet est ISO pour la date, 24 h pour l'heure", () => {
  assert.equal(horodatage(ETE), "2026-08-11 22:14:30")
  assert.equal(horodatage(HIVER), "2026-01-15 13:30:00")
})

test("minuit s'écrit 00 et non 24", () => {
  // 04:30 UTC en été = 00:30 à Montréal. Certaines plateformes rendent « 24 ».
  assert.equal(horodatage("2026-07-04T04:30:00.000Z").slice(-8), "00:30:00")
})

test("l'anglais rend le mois en anglais, le même jour", () => {
  assert.equal(dateSignature(ETE, "en"), "August 11, 2026")
})

test("une valeur illisible ne fabrique pas de date", () => {
  assert.equal(dateSignature("pas une date"), "")
  assert.equal(heureSignature(""), "")
  // L'horodatage rend l'entrée telle quelle : la perdre effacerait la trace.
  assert.equal(horodatage("pas une date"), "pas une date")
})
