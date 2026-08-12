import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { libelleCivilite, nomAvecCivilite, ageALaDate, CIVILITES } from "../identite"

describe("civilité", () => {
  test("un code devient le bon libellé dans les deux langues", () => {
    assert.equal(libelleCivilite("mr"), "Monsieur")
    assert.equal(libelleCivilite("mr", "en"), "Mr.")
    assert.equal(libelleCivilite("mrs"), "Madame")
    assert.equal(libelleCivilite("mrs", "en"), "Mrs.")
  })

  test("« autre » ne produit AUCUN libellé", () => {
    // Écrire « Autre Diarra » en tête d'un contrat serait pire que de n'y
    // rien mettre.
    assert.equal(libelleCivilite("other"), "")
    assert.equal(nomAvecCivilite({ civility: "other", name: "Adama Diarra" }), "Adama Diarra")
  })

  test("une civilité absente ou inconnue ne laisse pas d'espace en tête", () => {
    for (const c of [null, undefined, "", "docteur"]) {
      assert.equal(nomAvecCivilite({ civility: c, name: "Adama Diarra" }), "Adama Diarra", String(c))
    }
  })

  test("le nom se reconstitue depuis prénom et nom quand « name » manque", () => {
    assert.equal(
      nomAvecCivilite({ civility: "mrs", firstName: "Awa", lastName: "Diallo" }),
      "Madame Awa Diallo"
    )
  })

  test("les quatre codes de la base ont tous un libellé", () => {
    // La contrainte CHECK en base autorise exactement ces quatre valeurs : une
    // civilité stockable sans libellé s'afficherait comme un vide inexpliqué.
    assert.deepEqual(CIVILITES.map((c) => c.valeur), ["mr", "mrs", "mx", "other"])
  })
})

describe("âge à une date", () => {
  const NAISSANCE = "2004-08-20"

  test("l'anniversaire non encore passé ne compte pas", () => {
    // Né le 20 août 2004, au 11 août 2026 : 21 ans, pas 22. Neuf jours
    // séparent ces deux réponses, et la limite d'enfant à charge est à 22.
    assert.equal(ageALaDate(NAISSANCE, new Date("2026-08-11")), 21)
    assert.equal(ageALaDate(NAISSANCE, new Date("2026-08-20")), 22)
  })

  test("l'âge se calcule à la DATE DE DÉPÔT, pas à aujourd'hui", () => {
    // Un enfant de 21 ans au dépôt reste à charge même s'il en a 23 quand le
    // dossier est examiné. C'est pour cela que la date de référence se passe.
    assert.equal(ageALaDate(NAISSANCE, new Date("2026-01-15")), 21)
    assert.equal(ageALaDate(NAISSANCE, new Date("2028-01-15")), 23)
  })

  test("une date illisible rend null plutôt qu'un âge inventé", () => {
    assert.equal(ageALaDate("pas une date"), null)
  })
})
