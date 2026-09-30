import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { destinationApresConnexion } from "../redirection-connexion"

/**
 * Ce que la page de connexion doit rendre après authentification.
 *
 * ─── L'INCIDENT ────────────────────────────────────────────────────────────
 *
 * `proxy.ts` clonait l'adresse demandée, remplaçait le chemin par celui de la
 * connexion et ajoutait `suivant=<chemin>`. Deux conséquences : les
 * paramètres de la page demandée restaient collés à l'adresse de connexion
 * (`/fr/connexion?client=…&suivant=/fr/matters`), et `suivant` les perdait.
 * Après connexion, on arrivait sur la liste complète au lieu de la liste
 * filtrée sur le client.
 */
describe("destinationApresConnexion", () => {
  test("les paramètres de la page demandée sont conservés", () => {
    assert.equal(
      destinationApresConnexion("/fr/matters", "?client=03777116-081f-404d-9456-edc5956b2e72"),
      "/fr/matters?client=03777116-081f-404d-9456-edc5956b2e72"
    )
  })

  test("une page sans paramètre reste inchangée", () => {
    assert.equal(destinationApresConnexion("/fr/clients", ""), "/fr/clients")
  })

  test("plusieurs paramètres sont conservés dans l'ordre", () => {
    assert.equal(
      destinationApresConnexion("/en/matters", "?client=c-1&tab=rencontres"),
      "/en/matters?client=c-1&tab=rencontres"
    )
  })

  test("la destination reste un chemin interne", () => {
    // La page de connexion refuse tout ce qui ne commence pas par « / », et
    // « // » ouvrirait vers un autre domaine.
    for (const destination of [
      destinationApresConnexion("/fr/matters", "?client=abc"),
      destinationApresConnexion("/fr/clients", ""),
    ]) {
      assert.equal(destination.startsWith("/"), true)
      assert.equal(destination.startsWith("//"), false)
    }
  })
})
