import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { bornesDeLaPeriode } from "../dossiers-recents-criteres"

/**
 * Les bornes de période — la partie où une erreur d'un jour se glisse.
 *
 * « Les 7 derniers jours » compte aujourd'hui parmi les sept. Reculer de 7
 * jours en donnerait huit, et le consultant qui filtre sur une semaine verrait
 * un dossier de la semaine d'avant sans comprendre pourquoi.
 */
const LE_11_AOUT = new Date("2026-08-11T14:00:00Z")

describe("bornesDeLaPeriode", () => {
  test("« tout » ne borne rien", () => {
    assert.deepEqual(bornesDeLaPeriode("tout", LE_11_AOUT), { du: null, au: null })
  })

  test("« aujourd'hui » borne le jour même, des deux côtés", () => {
    assert.deepEqual(bornesDeLaPeriode("jour", LE_11_AOUT), { du: "2026-08-11", au: "2026-08-11" })
  })

  test("« 7 derniers jours » en compte SEPT, aujourd'hui inclus", () => {
    const { du, au } = bornesDeLaPeriode("7j", LE_11_AOUT)
    assert.equal(du, "2026-08-05")
    assert.equal(au, "2026-08-11")
    const jours = (Date.parse(au!) - Date.parse(du!)) / 86400000 + 1
    assert.equal(jours, 7)
  })

  test("30 et 90 jours comptent juste eux aussi", () => {
    for (const [periode, attendu] of [["30j", 30], ["90j", 90]] as const) {
      const { du, au } = bornesDeLaPeriode(periode, LE_11_AOUT)
      assert.equal((Date.parse(au!) - Date.parse(du!)) / 86400000 + 1, attendu, periode)
    }
  })

  test("« cette année » part du 1er janvier, pas d'il y a 365 jours", () => {
    assert.deepEqual(bornesDeLaPeriode("annee", LE_11_AOUT), { du: "2026-01-01", au: "2026-08-11" })
  })

  test("le passage de mois recule bien dans le mois précédent", () => {
    // 2 mars : sept jours en arrière tombent en février, et 2026 n'est pas
    // bissextile — le 24 février, pas le 23.
    const { du } = bornesDeLaPeriode("7j", new Date("2026-03-02T10:00:00Z"))
    assert.equal(du, "2026-02-24")
  })

  test("le passage d'année recule dans l'année précédente", () => {
    const { du, au } = bornesDeLaPeriode("30j", new Date("2026-01-10T10:00:00Z"))
    assert.equal(au, "2026-01-10")
    assert.equal(du, "2025-12-12")
  })
})
