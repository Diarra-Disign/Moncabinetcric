import { test, describe } from "node:test"
import assert from "node:assert/strict"
import {
  recalculer, etatEcheancier, repartirEnParts, verifierEcheancier,
  libelleMode, type EtapePaiement,
} from "@/lib/ententes/echeancier"

/**
 * Ce que ces épreuves cherchent à prendre en défaut.
 *
 * UN CENT PERDU. 33,33 % de 100 $ répété trois fois donne 99,99 $ en virgule
 * flottante. Sur un contrat, ce cent manquant fait douter de tous les autres
 * chiffres — et c'est le consultant qui devra l'expliquer au client.
 *
 * UN ÉCART CORRIGÉ EN SILENCE. Le §9 demande d'AFFICHER ce qui reste à
 * répartir, pas d'ajuster la dernière étape : un ajustement automatique
 * modifierait un chiffre que le consultant a écrit, et il signerait sans
 * s'en apercevoir.
 */

const etape = (p: number, montant: number): EtapePaiement => ({
  position: p, description: `Étape ${p}`, base: "montant", montant,
})

describe("recalculer", () => {
  test("une étape en POURCENTAGE suit les honoraires", () => {
    const e: EtapePaiement[] = [
      { position: 1, description: "Signature", base: "pourcentage", pourcentage: 20, montant: 0 },
      { position: 2, description: "Dépôt", base: "pourcentage", pourcentage: 80, montant: 0 },
    ]
    const r = recalculer(e, 5000)
    assert.equal(r[0].montant, 1000)
    assert.equal(r[1].montant, 4000)
  })

  test("une étape en MONTANT n'est PAS recalculée", () => {
    // C'est le sens du §8 : le consultant choisit, pour chaque étape, laquelle
    // des deux valeurs il tient. Recalculer un montant fixe le lui reprendrait.
    const r = recalculer([etape(1, 1500)], 5000)
    assert.equal(r[0].montant, 1500)
  })

  test("les deux bases cohabitent dans le même échéancier", () => {
    const e: EtapePaiement[] = [
      etape(1, 1000),
      { position: 2, description: "Solde", base: "pourcentage", pourcentage: 50, montant: 0 },
    ]
    const r = recalculer(e, 4000)
    assert.equal(r[0].montant, 1000)
    assert.equal(r[1].montant, 2000)
  })

  test("un tiers trois fois ne perd pas de cent à l'arrondi", () => {
    const e: EtapePaiement[] = [33.34, 33.33, 33.33].map((p, i) => ({
      position: i + 1, description: `E${i}`, base: "pourcentage" as const, pourcentage: p, montant: 0,
    }))
    const r = recalculer(e, 100)
    assert.equal(r.reduce((t, x) => t + x.montant, 0), 100)
  })
})

describe("etatEcheancier", () => {
  test("la somme égale aux honoraires est équilibrée", () => {
    const etat = etatEcheancier([etape(1, 1000), etape(2, 1500), etape(3, 2500)], 5000)
    assert.equal(etat.equilibre, true)
    assert.equal(etat.reste, 0)
    assert.match(etat.message, /équilibré/)
  })

  test("un manque est NOMMÉ, avec le montant restant", () => {
    const etat = etatEcheancier([etape(1, 1000), etape(2, 3500)], 5000)
    assert.equal(etat.equilibre, false)
    assert.equal(etat.reste, 500)
    assert.match(etat.message, /500,00 \$/)
    assert.match(etat.message, /restant à répartir/)
  })

  test("un dépassement est signalé distinctement", () => {
    const etat = etatEcheancier([etape(1, 6000)], 5000)
    assert.equal(etat.equilibre, false)
    assert.match(etat.message, /dépasse/)
  })

  test("un échéancier VIDE n'est pas un déséquilibre", () => {
    // Un contrat peut prévoir un paiement unique et ne rien échelonner.
    const etat = etatEcheancier([], 5000)
    assert.equal(etat.equilibre, true)
    assert.equal(etat.message, "")
  })

  test("les centimes ne dérivent pas", () => {
    const etat = etatEcheancier([etape(1, 33.33), etape(2, 33.33), etape(3, 33.34)], 100)
    assert.equal(etat.equilibre, true)
  })
})

describe("repartirEnParts", () => {
  test("une division exacte donne des parts égales", () => {
    assert.deepEqual(repartirEnParts(4000, 4), [1000, 1000, 1000, 1000])
  })

  test("le reliquat va à la PREMIÈRE étape", () => {
    // Mieux vaut 1 000,01 $ à la signature que 999,99 $ au dernier versement,
    // qu'on relira des mois plus tard sans comprendre d'où vient le cent.
    const parts = repartirEnParts(100, 3)
    assert.deepEqual(parts, [33.34, 33.33, 33.33])
    assert.equal(parts.reduce((t, p) => t + p, 0).toFixed(2), "100.00")
  })

  test("zéro part ne rend rien plutôt que de diviser par zéro", () => {
    assert.deepEqual(repartirEnParts(1000, 0), [])
  })
})

describe("verifierEcheancier", () => {
  test("un échéancier équilibré passe", () => {
    assert.deepEqual(verifierEcheancier([etape(1, 2000), etape(2, 3000)], 5000), [])
  })

  test("une étape à zéro dollar est refusée", () => {
    // Elle laisse croire à un versement qui n'existe pas.
    const m = verifierEcheancier([etape(1, 5000), etape(2, 0)], 5000)
    assert.ok(m.some((x) => /étape 2 n'a aucun montant/i.test(x)))
  })

  test("une étape sans description est signalée", () => {
    const m = verifierEcheancier(
      [{ position: 1, description: "  ", base: "montant", montant: 5000 }], 5000
    )
    assert.ok(m.some((x) => /description/i.test(x)))
  })

  test("un déséquilibre empêche l'émission", () => {
    const m = verifierEcheancier([etape(1, 1000)], 5000)
    assert.ok(m.some((x) => /restant à répartir/.test(x)))
  })

  test("PRO BONO : aucun échéancier n'est exigé (§21)", () => {
    // L'absence d'honoraires est le propos du contrat, pas un oubli.
    assert.deepEqual(verifierEcheancier([], 0, true), [])
    assert.deepEqual(verifierEcheancier([etape(1, 0)], 0, true), [])
  })

  test("sans échéancier, rien n'est reproché", () => {
    assert.deepEqual(verifierEcheancier([], 5000), [])
  })
})

describe("les modes de paiement", () => {
  test("ils reprennent le vocabulaire des paiements existants", () => {
    // Une seconde liste aurait produit « Interac » ici et « interac » là, et
    // le rapprochement n'aurait plus su relier un paiement à son étape.
    assert.equal(libelleMode("interac"), "Virement Interac")
    assert.equal(libelleMode("bank_transfer"), "Virement bancaire")
    assert.equal(libelleMode("cheque", "en"), "Cheque")
  })

  test("un mode inconnu se rend tel quel plutôt que de disparaître", () => {
    assert.equal(libelleMode("crypto"), "crypto")
  })
})
