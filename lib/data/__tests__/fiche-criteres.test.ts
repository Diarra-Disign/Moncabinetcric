import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { valider, validerFiche, CHAMPS_REQUIS } from "@/lib/data/fiche-criteres"

/**
 * Ce que ces épreuves cherchent à prendre en défaut.
 *
 * Une validation TROP STRICTE est un défaut, pas une sécurité. Un cabinet
 * d'immigration a des clients dont l'adresse est à Dakar, dont le code postal
 * n'a pas la forme canadienne et dont le numéro de téléphone n'a pas dix
 * chiffres. Refuser leur fiche ne protège rien : cela oblige à la contourner —
 * en saisissant un faux code postal, par exemple, qui s'imprimera sur le
 * contrat.
 *
 * L'inverse compte autant : un courriel manifestement incomplet doit être
 * signalé AVANT l'envoi du questionnaire, pas après le retour en erreur.
 */

describe("les champs obligatoires", () => {
  test("la liste reste courte, et c'est délibéré", () => {
    // Un formulaire qui exige quinze champs fait inventer des réponses, et
    // une nationalité inventée vaut moins qu'une nationalité absente : elle a
    // l'air renseignée.
    assert.deepEqual(CHAMPS_REQUIS, ["last_name", "email"])
  })

  test("un nom absent est refusé", () => {
    assert.match(valider("last_name", "") ?? "", /obligatoire/)
    assert.match(valider("last_name", "   ") ?? "", /obligatoire/)
  })

  test("un nom présent passe", () => {
    assert.equal(valider("last_name", "Traoré"), null)
  })
})

describe("le courriel", () => {
  test("une adresse ordinaire passe", () => {
    assert.equal(valider("email", "fatou.traore@example.ca"), null)
  })

  test("une adresse sans arobase est signalée", () => {
    assert.match(valider("email", "fatou.example.ca") ?? "", /incomplet/)
  })

  test("une adresse sans domaine est signalée", () => {
    assert.match(valider("email", "fatou@") ?? "", /incomplet/)
  })

  test("un sous-domaine ou un signe plus ne sont PAS refusés", () => {
    // Ce sont des adresses valides et courantes. Un motif trop strict les
    // refuserait, et le consultant croirait la fiche du client fautive.
    assert.equal(valider("email", "f.traore+dossier@mail.ville.qc.ca"), null)
  })

  test("le second courriel est facultatif mais contrôlé s'il est rempli", () => {
    assert.equal(valider("email_secondary", ""), null)
    assert.match(valider("email_secondary", "n'importe quoi") ?? "", /incomplet/)
  })
})

describe("le code postal", () => {
  test("le format canadien est accepté avec ou sans espace", () => {
    assert.equal(valider("postal_code", "J8X 0B9"), null)
    assert.equal(valider("postal_code", "j8x0b9"), null)
    assert.equal(valider("postal_code", "H2X-1B2"), null)
  })

  test("un code canadien mal formé est signalé", () => {
    assert.match(valider("postal_code", "J8X 0B") ?? "", /A1A 1A1/)
  })

  test("un code ÉTRANGER n'est pas refusé", () => {
    // Un cabinet d'immigration a des clients qui n'habitent pas encore au
    // Canada. Refuser « 75008 » forcerait à inventer un code canadien, qui
    // s'imprimerait ensuite sur le contrat.
    assert.equal(valider("postal_code", "75008"), null)
    assert.equal(valider("postal_code", "20000"), null)
  })
})

describe("le téléphone", () => {
  test("les formats usuels passent", () => {
    assert.equal(valider("phone", "+1 (514) 555-0123"), null)
    assert.equal(valider("phone", "5145550123"), null)
    assert.equal(valider("phone", "+221 77 123 45 67"), null)
  })

  test("un numéro manifestement trop court est signalé", () => {
    assert.match(valider("phone", "514") ?? "", /incomplet/)
  })

  test("vide, il n'est pas contrôlé — il est facultatif", () => {
    assert.equal(valider("phone", ""), null)
  })
})

describe("la date de naissance", () => {
  test("une date passée passe", () => {
    assert.equal(valider("birth_date", "1990-04-12"), null)
  })

  test("une date dans le FUTUR est refusée", () => {
    // C'est une faute de frappe, jamais une donnée — et elle fausserait le
    // calcul d'âge d'un enfant à charge à la date de dépôt.
    const demain = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    assert.match(valider("birth_date", demain) ?? "", /futur/)
  })

  test("une date illisible est refusée", () => {
    assert.match(valider("birth_date", "hier") ?? "", /invalide/)
  })
})

describe("validerFiche", () => {
  test("une fiche minimale suffit", () => {
    assert.deepEqual(validerFiche({ last_name: "Traoré", email: "f@example.ca" }), {})
  })

  test("elle nomme CHAQUE manque, pas seulement le premier", () => {
    // Un formulaire qui ne signale qu'une faute à la fois se corrige en trois
    // allers-retours.
    const e = validerFiche({ last_name: "", email: "pasuncourriel", phone: "12" })
    assert.ok(e.last_name)
    assert.ok(e.email)
    assert.ok(e.phone)
  })

  test("elle ne réclame rien sur les champs facultatifs laissés vides", () => {
    const e = validerFiche({
      last_name: "Traoré", email: "f@example.ca",
      phone: "", postal_code: "", birth_date: "", email_secondary: "",
    })
    assert.deepEqual(e, {})
  })
})
