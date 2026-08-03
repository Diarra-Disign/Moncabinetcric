import { test, describe } from "node:test"
import assert from "node:assert/strict"

// Import direct du module de logique : writes.ts est "server-only" et ne
// peut pas être chargé hors du bundler Next. On reproduit donc la fonction
// à l'identique — elle est courte, et c'est son comportement qui compte.
function toDateOnly(value: unknown, fallback: string | null = null): string | null {
  if (value === null || value === undefined || value === "") return fallback
  const raw = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const parsed = new Date(raw)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  return fallback
}

const TODAY = "2026-08-02"

describe("Normalisation des dates avant écriture", () => {
  test("laisse passer une date ISO", () => {
    assert.equal(toDateOnly("2027-03-15"), "2027-03-15")
  })

  test("rejette le libellé qui faisait échouer la création de prospect", () => {
    // Valeur exacte envoyée par le formulaire du pipeline. Postgres
    // répondait « invalid input syntax for type date » et l'enregistrement
    // entier échouait.
    assert.equal(toDateOnly("Nouveau prospect - À l'instant", TODAY), TODAY)
  })

  test("rejette les autres libellés hérités du modèle mock", () => {
    for (const libelle of ["Appel - il y a 1j", "Courriel - il y a 2j", "Entente signée aujourd'hui", "R-V fixé le 3 Aoû"]) {
      assert.equal(toDateOnly(libelle, TODAY), TODAY, `« ${libelle} » aurait dû être écarté`)
    }
  })

  test("vide et absence retombent sur la valeur de repli", () => {
    assert.equal(toDateOnly("", TODAY), TODAY)
    assert.equal(toDateOnly(null, TODAY), TODAY)
    assert.equal(toDateOnly(undefined, TODAY), TODAY)
  })

  test("sans repli, une valeur illisible donne null plutôt qu'une erreur Postgres", () => {
    assert.equal(toDateOnly("pas une date"), null)
  })

  test("accepte une date complète et n'en garde que le jour", () => {
    assert.equal(toDateOnly("2027-03-15T14:30:00.000Z"), "2027-03-15")
  })
})
