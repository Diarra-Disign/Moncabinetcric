import { test } from "node:test"
import assert from "node:assert/strict"
import { apparier, type EmplacementSignature } from "../emplacements"

/**
 * L'appariement signataire → encadré.
 *
 * CE QUE CES ÉPREUVES CHERCHENT À PRENDRE EN DÉFAUT : une signature posée dans
 * l'encadré d'autrui. Sur un contrat, faire signer le client à la place du
 * consultant est un faux — et rien, dans le PDF produit, ne le signalerait.
 */

const encadre = (role: string, nom: string, page = 0): EmplacementSignature => ({
  role, nom, page,
  boite: { x: 56, y: 100, largeur: 240, hauteur: 68 },
  signature: { x: 90, y: 114, largeur: 120 },
  date: { x: 230, y: 114, largeur: 60 },
})

test("chacun reçoit l'encadré de son rôle", () => {
  const signataires = [
    { role: "consultant", rang: 2 },
    { role: "client", rang: 1 },
  ]
  const paires = apparier(signataires, [encadre("client", "Jean"), encadre("consultant", "Adama")])

  assert.equal(paires.get(signataires[0])?.nom, "Adama")
  assert.equal(paires.get(signataires[1])?.nom, "Jean")
})

test("l'ordre des encadrés n'a pas à suivre celui des rangs", () => {
  const signataires = [{ role: "client", rang: 1 }, { role: "consultant", rang: 2 }]
  // Le consultant est dessiné en PREMIER dans le contrat, le client ensuite.
  const paires = apparier(signataires, [encadre("consultant", "Adama"), encadre("client", "Jean")])

  assert.equal(paires.get(signataires[0])?.role, "client")
  assert.equal(paires.get(signataires[1])?.role, "consultant")
})

test("deux signataires de même rôle prennent deux encadrés distincts", () => {
  const signataires = [
    { role: "co_applicant", rang: 2 },
    { role: "co_applicant", rang: 1 },
  ]
  const paires = apparier(signataires, [
    encadre("co_applicant", "Premier"),
    encadre("co_applicant", "Second"),
  ])

  // Le rang 1 sert d'abord : c'est l'ordre dans lequel le contrat les dessine.
  assert.equal(paires.get(signataires[1])?.nom, "Premier")
  assert.equal(paires.get(signataires[0])?.nom, "Second")
  assert.equal(paires.size, 2)
})

test("un rôle sans encadré n'est APPARIÉ À RIEN", () => {
  const signataires = [{ role: "client", rang: 1 }, { role: "spouse", rang: 2 }]
  const paires = apparier(signataires, [encadre("client", "Jean")])

  assert.equal(paires.get(signataires[0])?.nom, "Jean")
  // Le conjoint n'a pas d'encadré : mieux vaut aucune signature apposée qu'une
  // signature posée dans la case du client.
  assert.equal(paires.get(signataires[1]), undefined)
  assert.equal(paires.size, 1)
})

test("un encadré ne sert qu'une fois", () => {
  const signataires = [{ role: "client", rang: 1 }, { role: "client", rang: 2 }]
  const paires = apparier(signataires, [encadre("client", "Unique")])

  assert.equal(paires.size, 1)
  assert.equal(paires.get(signataires[0])?.nom, "Unique")
  assert.equal(paires.get(signataires[1]), undefined)
})

test("aucun encadré : personne n'est apparié, et rien ne lève", () => {
  const signataires = [{ role: "client", rang: 1 }]
  assert.equal(apparier(signataires, []).size, 0)
})

test("les encadrés portent la page où ils se trouvent", () => {
  const signataires = [{ role: "client", rang: 1 }]
  const paires = apparier(signataires, [encadre("client", "Jean", 7)])
  assert.equal(paires.get(signataires[0])?.page, 7)
})
