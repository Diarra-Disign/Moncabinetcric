import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { estIdentifiantTechnique, expressionIdentifiantClient } from "../supabase/identifiant-client"

/**
 * Reconnaître un client par l'identifiant que l'application expose.
 *
 * Constaté sur les données réelles : six clients sur sept n'ont pas
 * d'identifiant hérité. Les lectures qui ne filtraient que sur `legacy_id`
 * ne les trouvaient jamais — sans erreur, sans trace, avec un résultat vide
 * que les écrans prenaient pour « ce client n'a rien ».
 */
describe("estIdentifiantTechnique", () => {
  test("un uuid est reconnu, quelle que soit la casse", () => {
    assert.equal(estIdentifiantTechnique("03777116-081f-404d-9456-edc5956b2e72"), true)
    assert.equal(estIdentifiantTechnique("03777116-081F-404D-9456-EDC5956B2E72"), true)
  })

  test("un identifiant hérité n'est pas un uuid", () => {
    assert.equal(estIdentifiantTechnique("c-1786926682284"), false)
    assert.equal(estIdentifiantTechnique("c-1"), false)
  })

  test("une valeur tronquée ou bruitée n'est pas prise pour un uuid", () => {
    assert.equal(estIdentifiantTechnique("03777116-081f-404d-9456"), false)
    assert.equal(estIdentifiantTechnique("03777116-081f-404d-9456-edc5956b2e72 "), false)
    assert.equal(estIdentifiantTechnique(""), false)
  })
})

describe("expressionIdentifiantClient", () => {
  test("un uuid interroge les deux colonnes", () => {
    assert.equal(
      expressionIdentifiantClient("03777116-081f-404d-9456-edc5956b2e72"),
      "legacy_id.eq.03777116-081f-404d-9456-edc5956b2e72,id.eq.03777116-081f-404d-9456-edc5956b2e72"
    )
  })

  test("un identifiant hérité n'interroge PAS la colonne uuid", () => {
    // La base rejetterait la requête entière : « invalid input syntax for
    // type uuid ». L'appelant se rabat alors sur une égalité simple.
    assert.equal(expressionIdentifiantClient("c-1786926682284"), null)
  })

  test("une valeur qui pourrait déformer le filtre ne produit aucune expression", () => {
    assert.equal(expressionIdentifiantClient("c-1,id.eq.autre"), null)
    assert.equal(expressionIdentifiantClient("(legacy_id.eq.x)"), null)
  })
})
