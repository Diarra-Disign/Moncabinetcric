import { test, describe } from "node:test"
import assert from "node:assert/strict"

import { repartirSieges, prixDuRole, cleTarifSiege, montantTotal } from "../../billing/seats"
import type { Plan } from "../../billing/plans"

/**
 * Ces contrôles portent sur ce que des cabinets réels paieront chaque mois.
 *
 * Ils existent parce que la vérification par l'usage est ici hors de portée :
 * la seule façon de constater qu'une facture est juste serait de facturer
 * quelqu'un. Le calcul est donc pur, et éprouvé ici — pas chez le client.
 */

const CABINET: Plan = {
  key: "cabinet",
  labelFr: "Cabinet Pro",
  labelEn: "Firm Pro",
  taglineFr: "",
  taglineEn: "",
  rank: 30,
  purchasable: true,
  monthly: 7900,
  annual: 79000,
  extraSeatMonthly: 2500,
  extraSeatAnnual: 25000,
  seatsIncluded: 3,
  maxSeats: null,
  aiConnector: true,
}

const GRILLE = {
  rcic: { monthly: 2500, annual: 25000 },
  risia: { monthly: 1500, annual: 15000 },
  staff: { monthly: 1500, annual: 15000 },
  bookkeeper: { monthly: 1500, annual: 15000 },
  readonly: { monthly: 500, annual: 5000 },
}

describe("prixDuRole", () => {
  test("prend le tarif du rôle quand il est déclaré", () => {
    assert.equal(prixDuRole(CABINET, "staff", "monthly", GRILLE), 1500)
  })

  test("retombe sur le tarif générique du forfait pour un rôle inconnu", () => {
    // Un rôle ajouté plus tard doit être facturé, pas offert : un oubli qui
    // coûte au cabinet se réclame, un oubli qui coûte à l'éditeur ne se voit
    // jamais.
    assert.equal(prixDuRole(CABINET, "notaire", "monthly", GRILLE), 2500)
  })

  test("suit la cadence", () => {
    assert.equal(prixDuRole(CABINET, "staff", "annual", GRILLE), 15000)
  })
})

describe("repartirSieges", () => {
  test("un cabinet dans son forfait ne paie aucun supplément", () => {
    const r = repartirSieges({
      plan: CABINET,
      comptes: { owner: 1, rcic: 1, staff: 1 },
      cadence: "monthly",
      grille: GRILLE,
    })
    assert.equal(r.occupees, 3)
    assert.equal(r.comprises, 3)
    assert.equal(r.supplement, 0)
    assert.deepEqual(r.lignes, [])
  })

  test("les places comprises absorbent les rôles les plus chers", () => {
    // Deux consultants à 25 $, deux adjointes à 15 $, trois places comprises.
    // Absorber les plus chères laisse UNE adjointe à facturer, soit 15 $ —
    // et non un consultant à 25 $. Dix dollars par mois séparent les deux
    // lectures de « trois places comprises ».
    const r = repartirSieges({
      plan: CABINET,
      comptes: { rcic: 2, staff: 2 },
      cadence: "monthly",
      grille: GRILLE,
    })
    assert.equal(r.occupees, 4)
    assert.equal(r.comprises, 3)
    assert.deepEqual(r.lignes, [{ ciccRole: "staff", quantite: 1, unitaire: 1500 }])
    assert.equal(r.supplement, 1500)
  })

  test("plusieurs rôles supplémentaires se regroupent par ligne", () => {
    const r = repartirSieges({
      plan: CABINET,
      comptes: { owner: 1, rcic: 2, staff: 3 },
      cadence: "monthly",
      grille: GRILLE,
    })
    // 6 places, 3 comprises. Les plus chères d'abord : owner et rcic partagent
    // le tarif générique par défaut (2500), donc trois places à 2500 sont
    // absorbées, et il reste trois adjointes.
    assert.equal(r.occupees, 6)
    assert.deepEqual(r.lignes, [{ ciccRole: "staff", quantite: 3, unitaire: 1500 }])
    assert.equal(r.supplement, 4500)
  })

  test("un cabinet en dessous de son forfait n'a rien à facturer", () => {
    const r = repartirSieges({
      plan: CABINET,
      comptes: { owner: 1 },
      cadence: "monthly",
      grille: GRILLE,
    })
    assert.equal(r.comprises, 1)
    assert.equal(r.supplement, 0)
  })

  test("aucune place du tout", () => {
    const r = repartirSieges({ plan: CABINET, comptes: {}, cadence: "monthly", grille: GRILLE })
    assert.equal(r.occupees, 0)
    assert.equal(r.supplement, 0)
    assert.deepEqual(r.lignes, [])
  })

  test("la répartition est stable d'une exécution à l'autre", () => {
    // Une répartition instable enverrait à Stripe des modifications qui n'en
    // sont pas — et chacune déclenche une proratisation, donc une ligne sur la
    // facture du client.
    const comptes = { staff: 2, rcic: 2, bookkeeper: 2 }
    const a = repartirSieges({ plan: CABINET, comptes, cadence: "monthly", grille: GRILLE })
    const b = repartirSieges({ plan: CABINET, comptes, cadence: "monthly", grille: GRILLE })
    assert.deepEqual(a.lignes, b.lignes)
  })

  test("la cadence annuelle emploie les tarifs annuels", () => {
    const r = repartirSieges({
      plan: CABINET,
      comptes: { rcic: 3, staff: 1 },
      cadence: "annual",
      grille: GRILLE,
    })
    assert.deepEqual(r.lignes, [{ ciccRole: "staff", quantite: 1, unitaire: 15000 }])
  })

  test("un forfait sans place comprise facture tout", () => {
    const solo: Plan = { ...CABINET, key: "solo", seatsIncluded: 0, extraSeatMonthly: 2500 }
    const r = repartirSieges({
      plan: solo,
      comptes: { owner: 1 },
      cadence: "monthly",
      grille: GRILLE,
    })
    assert.equal(r.comprises, 0)
    assert.equal(r.supplement, 2500)
  })
})

describe("montantTotal", () => {
  test("additionne la base et le supplément", () => {
    const r = repartirSieges({
      plan: CABINET,
      comptes: { rcic: 2, staff: 2 },
      cadence: "monthly",
      grille: GRILLE,
    })
    assert.equal(montantTotal(CABINET, r, "monthly"), 7900 + 1500)
  })
})

describe("cleTarifSiege", () => {
  test("le rôle entre dans la clé", () => {
    // Sans lui, deux tarifs de montants différents se disputeraient la même
    // clé de recherche, et Stripe n'en garde qu'un par clé.
    assert.notEqual(
      cleTarifSiege("cabinet", "rcic", "monthly"),
      cleTarifSiege("cabinet", "staff", "monthly")
    )
    assert.equal(cleTarifSiege("cabinet", "staff", "monthly"), "mcc_cabinet_monthly_place_staff")
  })
})
