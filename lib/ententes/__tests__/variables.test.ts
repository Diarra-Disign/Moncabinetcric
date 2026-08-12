import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { variablesDe, substituer, verifierAvantGeneration } from "../variables"
import type { ContexteEntente } from "../variables"

/**
 * Les variables d'un contrat, et ce qui doit empêcher de le générer.
 *
 * Deux défauts que ces épreuves cherchent à rendre impossibles :
 *
 * 1. Une variable inconnue laissée telle quelle. « {{adresse_client}} »
 *    imprimé dans un contrat envoyé à un client est le pire des résultats :
 *    silencieux à la génération, visible pour lui seul.
 *
 * 2. Un contrat généré sans les informations essentielles. Le §29 demande de
 *    l'empêcher et de NOMMER ce qui manque — « informations incomplètes » ne
 *    dit pas où retourner.
 */

const CONTEXTE: ContexteEntente = {
  contractant: {
    civility: "mrs", firstName: "Awa", lastName: "Diallo",
    email: "awa@example.invalid", phone: "+1 514 555 0199",
    address: "12 rue des Érables", city: "Montréal", province: "QC",
    postalCode: "H2X 1Y4", country: "Canada",
  },
  cabinet: {
    nom: "Diarra Global Visa", consultant: "Adama Diarra", civiliteConsultant: "mr",
    permis: "R1041776", adresse: "500 Place d'Armes, Montréal",
    courriel: "infos@dgvimmigration.com", telephone: "+1 514 555 0100",
  },
  montants: { honoraires: 4500, taxes: 673.88, total: 5173.88 },
  entente: { numero: "ENT-2026-0001", date: "2026-08-11", titre: "Entente de services" },
  locale: "fr",
}

describe("variablesDe", () => {
  test("la civilité produit une formule complète", () => {
    const v = variablesDe(CONTEXTE)
    assert.equal(v.civilite, "Madame")
    assert.equal(v.nom_complet_client, "Madame Awa Diallo")
    assert.equal(v.prenom_client, "Awa")
    assert.equal(v.nom_client, "Diallo")
  })

  test("le nom reste seul quand la civilité manque", () => {
    // « ,  Diallo » en tête d'un contrat se remarque, et c'est celui qui part
    // chez le client.
    const v = variablesDe({ ...CONTEXTE, contractant: { ...CONTEXTE.contractant, civility: null } })
    assert.equal(v.civilite, "")
    assert.equal(v.nom_complet_client, "Awa Diallo")
  })

  test("les montants sont formatés en dollars canadiens", () => {
    const v = variablesDe(CONTEXTE)
    assert.match(v.honoraires, /4 500,00/)
    assert.match(v.total, /5 173,88/)
    // Aucune espace insécable : les polices standard d'un PDF ne les couvrent
    // pas, et le moteur de facturation a déjà buté dessus.
    assert.ok(!/[  ]/.test(v.honoraires), "espace insécable dans le montant")
  })

  test("le consultant vient des paramètres, jamais retapé", () => {
    const v = variablesDe(CONTEXTE)
    assert.equal(v.nom_consultant, "Monsieur Adama Diarra")
    assert.equal(v.nom_cabinet, "Diarra Global Visa")
    assert.equal(v.permis_consultant, "R1041776")
  })

  test("l'adresse du contractant se compose sur une ligne", () => {
    const v = variablesDe(CONTEXTE)
    assert.equal(v.adresse_client, "12 rue des Érables, Montréal, QC H2X 1Y4, Canada")
  })

  test("une adresse partielle ne laisse pas de virgules orphelines", () => {
    const v = variablesDe({
      ...CONTEXTE,
      contractant: { ...CONTEXTE.contractant, city: "", province: "", postalCode: "", country: "" },
    })
    assert.equal(v.adresse_client, "12 rue des Érables")
  })
})

describe("substituer", () => {
  test("remplace ce qu'elle connaît", () => {
    const r = substituer("Entre {{nom_cabinet}} et {{nom_complet_client}}.", variablesDe(CONTEXTE))
    assert.equal(r.texte, "Entre Diarra Global Visa et Madame Awa Diallo.")
    assert.deepEqual(r.inconnues, [])
  })

  test("SIGNALE ce qu'elle ne connaît pas au lieu de le laisser passer", () => {
    const r = substituer("Le {{jour_de_la_marmotte}} à {{lieu_inconnu}}.", variablesDe(CONTEXTE))
    assert.deepEqual(r.inconnues.sort(), ["jour_de_la_marmotte", "lieu_inconnu"])
  })

  test("une variable connue mais VIDE n'est pas une inconnue", () => {
    // Un téléphone absent laisse un blanc ; c'est un renseignement manquant,
    // pas une faute de modèle. Les deux se corrigent à des endroits
    // différents, donc ils ne doivent pas se confondre.
    const v = variablesDe({ ...CONTEXTE, contractant: { ...CONTEXTE.contractant, phone: "" } })
    const r = substituer("Tél : {{telephone_client}}", v)
    assert.equal(r.texte, "Tél : ")
    assert.deepEqual(r.inconnues, [])
  })

  test("tolère les espaces dans les accolades", () => {
    const r = substituer("{{ nom_cabinet }}", variablesDe(CONTEXTE))
    assert.equal(r.texte, "Diarra Global Visa")
  })

  test("la même variable répétée est remplacée partout", () => {
    const r = substituer("{{prenom_client}} et {{prenom_client}}", variablesDe(CONTEXTE))
    assert.equal(r.texte, "Awa et Awa")
  })
})

describe("verifierAvantGeneration", () => {
  test("un contexte complet passe", () => {
    assert.equal(verifierAvantGeneration(CONTEXTE).ok, true)
  })

  test("nomme CE qui manque, pas « informations incomplètes »", () => {
    const r = verifierAvantGeneration({
      ...CONTEXTE,
      contractant: { ...CONTEXTE.contractant, email: "", address: "" },
    })
    assert.equal(r.ok, false)
    if (r.ok) return
    assert.equal(r.manquants.length, 2)
    assert.ok(r.manquants.some((m) => /courriel/i.test(m)), r.manquants.join(" | "))
    assert.ok(r.manquants.some((m) => /adresse/i.test(m)), r.manquants.join(" | "))
  })

  test("des honoraires à zéro bloquent — SAUF en pro bono", () => {
    const sansHonoraires = { ...CONTEXTE, montants: { honoraires: 0, taxes: 0, total: 0 } }
    assert.equal(verifierAvantGeneration(sansHonoraires).ok, false)
    // Pro bono, l'absence d'honoraires est le propos du contrat, pas un oubli.
    assert.equal(verifierAvantGeneration({ ...sansHonoraires, proBono: true }).ok, true)
  })

  test("le permis du consultant est exigé — c'est ce qui l'identifie", () => {
    const r = verifierAvantGeneration({ ...CONTEXTE, cabinet: { ...CONTEXTE.cabinet, permis: "" } })
    assert.equal(r.ok, false)
    if (!r.ok) assert.ok(r.manquants.some((m) => /permis/i.test(m)))
  })

  test("une variable inconnue dans le texte bloque aussi la génération", () => {
    const r = verifierAvantGeneration(CONTEXTE, ["Bonjour {{variable_fantome}}"])
    assert.equal(r.ok, false)
    if (!r.ok) assert.ok(r.manquants.some((m) => /variable_fantome/.test(m)), r.manquants.join(" | "))
  })
})
