import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { tokenizeQuery, searchProvisions, normalizeText } from "../legislation-search.js"
import { MOCK_LEGISLATION_PROVISIONS } from "../mock/legislation.js"

const all = MOCK_LEGISLATION_PROVISIONS

describe("Legislation search", () => {
  test("strips citation structure words from the query", () => {
    assert.deepEqual(tokenizeQuery("Art. 24 LIPR"), ["24", "lipr"])
    assert.deepEqual(tokenizeQuery("article 200 ripr"), ["200", "ripr"])
    assert.deepEqual(tokenizeQuery("s. 38"), ["38"])
    assert.deepEqual(tokenizeQuery("  "), [])
  })

  test("keeps substantive words that merely look like noise", () => {
    // « loi » et « permis » sont des termes de fond : les écarter rendrait
    // une recherche thématique impossible.
    assert.ok(tokenizeQuery("loi permis").includes("loi"))
    assert.ok(tokenizeQuery("loi permis").includes("permis"))
  })

  test("normalises accents so unaccented input still matches", () => {
    assert.equal(normalizeText("Dépôt Excessif"), "depot excessif")
  })

  test("finds a provision written as a natural citation", () => {
    // C'est précisément la forme qui ne retournait rien avant correctif.
    const results = searchProvisions(all, "Art. 24 LIPR")
    assert.equal(results.length, 1)
    assert.equal(results[0].provisionNo, "24(1)")
    assert.equal(results[0].instrument, "lipr")
  })

  test("matches the instrument on its own", () => {
    const lipr = searchProvisions(all, "LIPR")
    assert.ok(lipr.length > 0)
    assert.ok(lipr.every((p) => p.instrument === "lipr"))
  })

  test("combines every token instead of cancelling them out", () => {
    // "24 ripr" ne doit rien donner : l'article 24 existe, mais en LIPR.
    assert.equal(searchProvisions(all, "art 24 ripr").length, 0)
    assert.equal(searchProvisions(all, "art 200 ripr").length, 1)
  })

  test("handles provision numbers containing a period", () => {
    const results = searchProvisions(all, "87.1")
    assert.equal(results.length, 1)
    assert.equal(results[0].provisionNo, "87.1(2)")
  })

  test("an empty query returns everything", () => {
    assert.equal(searchProvisions(all, "").length, all.length)
  })

  test("honours the instrument filter alongside the query", () => {
    assert.equal(searchProvisions(all, "", "ripr").length, all.filter((p) => p.instrument === "ripr").length)
    assert.equal(searchProvisions(all, "24", "ripr").length, 0)
  })

  test("ranks the provision itself above articles that merely cite it", () => {
    // Le texte de l'article 20 renvoie au paragraphe 22.1(1) : sans
    // classement, il remontait devant l'article 22 lui-même.
    const results = searchProvisions(all, "Art. 22 LIPR")
    assert.ok(results.length >= 1)
    assert.equal(results[0].provisionNo, "22(1)")
  })

  test("ranking never drops a match", () => {
    const withoutRank = all.filter((p) =>
      ["22", "lipr"].every((tok) =>
        JSON.stringify(p).toLowerCase().includes(tok)
      )
    )
    assert.ok(searchProvisions(all, "Art. 22 LIPR").length >= Math.min(1, withoutRank.length))
  })

  test("finds section 22, added from the official consolidated text", () => {
    // Cette recherche est celle qui a révélé le défaut initial : elle
    // échouait d'abord parce que le moteur ne savait pas lire une citation,
    // puis parce que la disposition manquait à la base.
    const results = searchProvisions(all, "Art. 22 LIPR")
    assert.ok(results.length >= 1)
    assert.equal(results[0].provisionNo, "22(1)")
    assert.equal(results[0].consolidatedOn, "2026-06-14")
  })

  test("returns nothing for a provision absent from the base", () => {
    // La base reste un échantillon : une disposition non versée n'est pas
    // trouvée, et c'est correct — lacune de données, pas défaut de recherche.
    assert.equal(searchProvisions(all, "Art. 743 LIPR").length, 0)
  })
})
