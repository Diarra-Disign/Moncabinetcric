import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { bornesDuMois } from "../bornes-mois.js"

/**
 * Les bornes d'un mois.
 *
 * Trois lignes de code, et le seul endroit du registre mensuel où une erreur
 * ne se verrait pas : un mois qui commence un jour trop tôt déplace des
 * écritures d'un mois à l'autre, les soldes d'ouverture et de clôture restent
 * cohérents entre eux, et l'état paraît juste tout en étant faux.
 */
describe("bornesDuMois", () => {
  test("un mois de 31 jours", () => {
    assert.deepEqual(bornesDuMois("2026-05"), { debut: "2026-05-01", fin: "2026-05-31" })
  })

  test("un mois de 30 jours", () => {
    assert.deepEqual(bornesDuMois("2026-06"), { debut: "2026-06-01", fin: "2026-06-30" })
  })

  test("février d'une année ordinaire", () => {
    assert.deepEqual(bornesDuMois("2026-02"), { debut: "2026-02-01", fin: "2026-02-28" })
  })

  test("février d'une année bissextile", () => {
    assert.deepEqual(bornesDuMois("2028-02"), { debut: "2028-02-01", fin: "2028-02-29" })
  })

  test("2100 n'est PAS bissextile — la règle des siècles", () => {
    // Divisible par 4 mais pas par 400. Une implémentation qui teste
    // seulement « % 4 » se trompe ici, et nulle part ailleurs avant.
    assert.equal(bornesDuMois("2100-02").fin, "2100-02-28")
  })

  test("2000 était bissextile — divisible par 400", () => {
    assert.equal(bornesDuMois("2000-02").fin, "2000-02-29")
  })

  test("décembre ne déborde pas sur l'année suivante", () => {
    assert.deepEqual(bornesDuMois("2026-12"), { debut: "2026-12-01", fin: "2026-12-31" })
  })

  test("janvier, le mois où l'index de mois vaut zéro", () => {
    assert.deepEqual(bornesDuMois("2026-01"), { debut: "2026-01-01", fin: "2026-01-31" })
  })

  test("le jour est toujours sur deux chiffres", () => {
    // Une borne « 2026-06-3 » serait refusée par Postgres, ou pire, acceptée
    // et interprétée autrement.
    for (const m of ["2026-01", "2026-02", "2026-04", "2026-09"]) {
      assert.match(bornesDuMois(m).fin, /^\d{4}-\d{2}-\d{2}$/)
    }
  })

  test("le calcul est en UTC, pas dans le fuseau de la machine", () => {
    // À Montréal, `new Date("2026-05-01")` recule au 30 avril. Le registre de
    // mai commencerait alors un jour trop tôt, et récupérerait la dernière
    // écriture d'avril.
    const ancien = process.env.TZ
    process.env.TZ = "America/Montreal"
    assert.deepEqual(bornesDuMois("2026-05"), { debut: "2026-05-01", fin: "2026-05-31" })
    process.env.TZ = "Pacific/Kiritimati" // UTC+14, l'autre extrême
    assert.deepEqual(bornesDuMois("2026-05"), { debut: "2026-05-01", fin: "2026-05-31" })
    process.env.TZ = ancien
  })
})
