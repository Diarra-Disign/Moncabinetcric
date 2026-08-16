import { test, describe } from "node:test"
import assert from "node:assert/strict"
import {
  LONGUEUR_MINIMALE,
  exigencesManquantes,
  motDePasseValide,
} from "../regle-mot-de-passe"

/**
 * La règle de mot de passe, éprouvée contre les cas qui l'ont fait échouer.
 *
 * L'épreuve centrale est celle du mot de passe LONG MAIS FAIBLE : c'est
 * exactement ce que produisait l'ancien contrôle, qui ne regardait que la
 * longueur et laissait passer vingt-trois lettres minuscules jusqu'au serveur,
 * qui les refusait.
 */
describe("exigencesManquantes", () => {
  test("le mot de passe long tout en minuscules est refusé, et on dit pourquoi", () => {
    const manque = exigencesManquantes("consultationimmigration")
    assert.equal(manque.includes("longueur"), false, "23 caractères suffisent en longueur")
    assert.deepEqual(manque, ["majuscule", "chiffre", "symbole"])
  })

  test("un mot de passe vide manque tout", () => {
    assert.deepEqual(exigencesManquantes(""), [
      "longueur",
      "minuscule",
      "majuscule",
      "chiffre",
      "symbole",
    ])
  })

  test("l'ordre annoncé est stable : longueur d'abord, symbole en dernier", () => {
    const manque = exigencesManquantes("A1!")
    assert.deepEqual(manque, ["longueur", "minuscule"])
  })

  test("onze caractères par ailleurs complets manquent encore la longueur", () => {
    assert.equal("Aa1!aaaaaaa".length, LONGUEUR_MINIMALE - 1)
    assert.deepEqual(exigencesManquantes("Aa1!aaaaaaa"), ["longueur"])
  })
})

describe("motDePasseValide", () => {
  test("accepte un mot de passe qui remplit les cinq conditions", () => {
    assert.equal(motDePasseValide("Cabinet2026!x"), true)
  })

  test("refuse dès qu'une seule condition manque", () => {
    // Tout y est sauf le symbole.
    assert.equal(motDePasseValide("Cabinet2026xy"), false)
    // Tout y est sauf la majuscule.
    assert.equal(motDePasseValide("cabinet2026!x"), false)
    // Tout y est sauf le chiffre.
    assert.equal(motDePasseValide("CabinetCabinet!"), false)
  })

  test("les symboles hors liste ne comptent pas — c'est le serveur qui tranche", () => {
    // « € » n'est pas dans le jeu accepté par Supabase. L'accepter ici
    // recréerait précisément le décalage que ce module supprime.
    assert.equal(motDePasseValide("Cabinet2026€x"), false)
    assert.equal(motDePasseValide("Cabinet2026.x"), true)
  })

  test("l'espace seul ne tient pas lieu de symbole", () => {
    assert.equal(motDePasseValide("Cabinet 2026 x"), false)
  })
})
