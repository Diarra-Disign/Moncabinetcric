import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { matchesPerson, normalizeSearch } from "../../utils/search.js"

const client = [
  "Genevière Nguyễn", "Geneviève", "Nguyễn", "CRIC-2026-0007",
  "g.nguyen@exemple.ca", "438 921-2020", "Entrée express", "Viêt Nam",
]

describe("Recherche de personnes", () => {
  test("supprime les diacritiques", () => {
    assert.equal(normalizeSearch("Geneviève NGUYỄN"), "genevieve nguyen")
  })

  test("trouve un nom saisi sans accent", () => {
    // Cas courant : une clientèle d'immigration porte beaucoup d'accents,
    // rarement reproduits à la saisie.
    assert.ok(matchesPerson("genevieve", client))
    assert.ok(matchesPerson("nguyen", client))
    assert.ok(matchesPerson("viet nam", client))
  })

  test("trouve par courriel et par numéro de dossier", () => {
    assert.ok(matchesPerson("g.nguyen@exemple.ca", client))
    assert.ok(matchesPerson("CRIC-2026-0007", client))
  })

  test("trouve un téléphone quel qu'en soit le format", () => {
    for (const forme of ["438 921-2020", "4389212020", "(438) 921-2020", "921-2020", "9212020"]) {
      assert.ok(matchesPerson(forme, client), `« ${forme} » aurait dû correspondre`)
    }
  })

  test("une requête vide ne filtre rien", () => {
    assert.ok(matchesPerson("", client))
    assert.ok(matchesPerson("   ", client))
  })

  test("écarte ce qui ne correspond pas", () => {
    assert.equal(matchesPerson("Tremblay", client), false)
    assert.equal(matchesPerson("514", client), false)
  })

  test("une fiche incomplète reste trouvable sur ses champs remplis", () => {
    const partiel = ["Ana Silva", undefined, null, "", "ana@exemple.ca"]
    assert.ok(matchesPerson("silva", partiel))
    assert.ok(matchesPerson("ana@exemple.ca", partiel))
  })
})
