import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { abonnementCouvre, effetOctroi } from "../plans"

/**
 * La règle qui dit ce que produira l'octroi d'un plan depuis la console.
 *
 * Elle est éprouvée à part parce qu'elle DOIT rester le miroir exact de deux
 * fonctions SQL — `firm_access_open()` et `firm_effective_plan()`. Le jour où
 * l'une des deux change en base sans que celle-ci suive, la console annoncera
 * un effet qui ne se produit pas, et personne ne s'en apercevra : le message
 * est rassurant, et l'exploitant ne revérifie pas ce qu'on lui a confirmé.
 *
 * Le cas qui a motivé tout ceci : un cabinet au forfait « solo » dont
 * l'abonnement est résilié. La console ne proposait alors AUCUN bouton — il
 * fallait un terminal pour rouvrir l'accès.
 */
describe("abonnementCouvre", () => {
  test("actif et en essai donnent des droits", () => {
    assert.equal(abonnementCouvre("active", ""), true)
    assert.equal(abonnementCouvre("trialing", ""), true)
  })

  test("résilié n'en donne aucun, même avec un délai de grâce encore ouvert", () => {
    const demain = new Date(Date.now() + 86400000).toISOString()
    assert.equal(abonnementCouvre("canceled", demain), false)
  })

  test("l'impayé est couvert tant que le délai de grâce court", () => {
    const demain = new Date(Date.now() + 86400000).toISOString()
    const hier = new Date(Date.now() - 86400000).toISOString()
    assert.equal(abonnementCouvre("past_due", demain), true)
    assert.equal(abonnementCouvre("past_due", hier), false)
    assert.equal(abonnementCouvre("unpaid", demain), true)
  })

  test("un impayé sans délai de grâce n'est pas couvert", () => {
    assert.equal(abonnementCouvre("past_due", ""), false)
  })

  test("une date illisible ne vaut pas une autorisation", () => {
    assert.equal(abonnementCouvre("past_due", "bientôt"), false)
  })

  test("l'absence d'abonnement ne donne rien", () => {
    assert.equal(abonnementCouvre("", ""), false)
  })
})

describe("effetOctroi", () => {
  const base = { statutCabinet: "active", statutAbonnement: "", graceJusqua: "" }

  test("le cas qui a tout déclenché : forfait payant, abonnement résilié → l'octroi rouvre", () => {
    assert.equal(effetOctroi({ ...base, statutAbonnement: "canceled" }), "rouvre")
  })

  test("un cabinet qui paie encore : l'octroi n'aurait aucun effet sur ses droits", () => {
    assert.equal(effetOctroi({ ...base, statutAbonnement: "active" }), "abonnement-prime")
  })

  test("la suspension est souveraine, y compris sur un cabinet à jour", () => {
    assert.equal(
      effetOctroi({ statutCabinet: "suspended", statutAbonnement: "active", graceJusqua: "" }),
      "suspendu"
    )
  })

  test("la suspension prime aussi sur un abonnement résilié", () => {
    assert.equal(
      effetOctroi({ statutCabinet: "suspended", statutAbonnement: "canceled", graceJusqua: "" }),
      "suspendu"
    )
  })

  test("aucun abonnement du tout — un cabinet créé à la main — l'octroi rouvre", () => {
    assert.equal(effetOctroi(base), "rouvre")
  })

  test("un impayé hors délai de grâce se comporte comme une résiliation", () => {
    const hier = new Date(Date.now() - 86400000).toISOString()
    assert.equal(
      effetOctroi({ ...base, statutAbonnement: "past_due", graceJusqua: hier }),
      "rouvre"
    )
  })
})
