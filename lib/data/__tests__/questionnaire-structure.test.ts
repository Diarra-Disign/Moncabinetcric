import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { verifierSections } from "../questionnaire-structure"

/**
 * La garde qui protège les réponses d'un client.
 *
 * Le cas central est celui des clés en double. La réponse est rangée sous la
 * `key` de sa question : deux questions qui partagent une clé écrasent leurs
 * réponses l'une l'autre, et à l'écran cela ressemble à un client qui a sauté
 * une question. Personne ne remarque une réponse manquante sur un formulaire
 * de quarante ; on la découvre quand IRCC la réclame.
 */

const champ = (over: Record<string, unknown> = {}) => ({
  key: "prenom", labelFr: "Prénom", labelEn: "First name",
  type: "text", required: true, ...over,
})
const section = (fields: unknown[], over: Record<string, unknown> = {}) => ({
  id: "s1", titleFr: "Vous", titleEn: "You", fields, ...over,
})

describe("verifierSections", () => {
  test("accepte un questionnaire ordinaire", () => {
    const r = verifierSections([section([champ(), champ({ key: "nom", labelFr: "Nom" })])])
    assert.equal(r.ok, true)
  })

  test("accepte un questionnaire vide — on peut créer avant de rédiger", () => {
    assert.equal(verifierSections([]).ok, true)
  })

  test("REFUSE deux questions de même clé, et nomme les deux", () => {
    const r = verifierSections([
      section([champ({ labelFr: "Prénom" }), champ({ labelFr: "Prénom usuel" })]),
    ])
    assert.equal(r.ok, false)
    if (r.ok) return
    // Savoir qu'il y a un doublon sans savoir lequel oblige à tout relire.
    assert.match(r.message, /Prénom/)
    assert.match(r.message, /Prénom usuel/)
  })

  test("le doublon est détecté ENTRE deux sections, pas seulement dans une", () => {
    const r = verifierSections([
      section([champ()], { id: "s1" }),
      section([champ()], { id: "s2", titleFr: "Vos études" }),
    ])
    assert.equal(r.ok, false)
  })

  test("refuse une question sans identifiant", () => {
    const r = verifierSections([section([champ({ key: "  " })])])
    assert.equal(r.ok, false)
    if (!r.ok) assert.match(r.message, /identifiant/)
  })

  test("refuse un type que le formulaire public ne sait pas rendre", () => {
    // « checkbox » existe dans l'union TypeScript mais n'a aucune branche de
    // rendu : il s'afficherait en zone de texte libre.
    const r = verifierSections([section([champ({ type: "checkbox" })])])
    assert.equal(r.ok, false)
    if (!r.ok) assert.match(r.message, /checkbox/)
  })

  test("refuse un choix sans option — une liste vide ne se répond pas", () => {
    for (const type of ["select", "radio"]) {
      const r = verifierSections([section([champ({ type, options: [] })])])
      assert.equal(r.ok, false, type)
    }
  })

  test("accepte un choix pourvu d'options", () => {
    const r = verifierSections([section([champ({
      type: "radio",
      options: [{ value: "oui", labelFr: "Oui", labelEn: "Yes" }],
    })])])
    assert.equal(r.ok, true)
  })

  test("refuse une section sans titre", () => {
    const r = verifierSections([section([champ()], { titleFr: "   " })])
    assert.equal(r.ok, false)
  })

  test("laisse passer un repeater — l'éditeur ne le compose pas, il le conserve", () => {
    const r = verifierSections([section([{
      key: "emplois", labelFr: "Emplois", labelEn: "Jobs", type: "repeater", required: false,
      fields: [champ({ key: "employeur", labelFr: "Employeur" })],
    }])])
    assert.equal(r.ok, true)
  })

  test("refuse ce qui n'est pas une liste de sections", () => {
    for (const brut of [null, "sections", 42, { fields: [] }]) {
      assert.equal(verifierSections(brut).ok, false)
    }
  })
})
