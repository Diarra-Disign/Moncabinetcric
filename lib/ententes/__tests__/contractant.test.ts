import { test, describe } from "node:test"
import assert from "node:assert/strict"
import {
  partieDepuisClient, partieDepuisProspect, cabinetDepuisFirm, ligneDePartie,
} from "../contractant"
import { variablesDe, verifierAvantGeneration } from "../variables"

describe("pré-remplissage depuis une fiche", () => {
  test("un client complet remplit toute la partie", () => {
    const p = partieDepuisClient({
      civility: "mrs", first_name: "Awa", last_name: "Diallo",
      email: "awa@example.invalid", phone: "+1 514 555 0199",
      address: "12 rue des Érables", city: "Montréal", province: "QC",
      postal_code: "H2X 1Y4", country: "Canada",
    })
    assert.equal(p.civility, "mrs")
    assert.equal(p.firstName, "Awa")
    assert.equal(p.lastName, "Diallo")
    assert.equal(p.postalCode, "H2X 1Y4")
  })

  test("un prospect ancien n'a qu'un nom complet — il est séparé", () => {
    // Le dernier mot est le nom de famille : « Awa Diallo » donne bien
    // Awa / Diallo, et « Marie Claire Dupont » donne Marie Claire / Dupont.
    const p = partieDepuisProspect({ name: "Awa Diallo" })
    assert.equal(p.firstName, "Awa")
    assert.equal(p.lastName, "Diallo")

    const compose = partieDepuisProspect({ name: "Marie Claire Dupont" })
    assert.equal(compose.firstName, "Marie Claire")
    assert.equal(compose.lastName, "Dupont")
  })

  test("un nom d'un seul mot devient le NOM, pas le prénom", () => {
    // « Cher Monsieur  » est pire que « Cher Monsieur Diallo ».
    const p = partieDepuisProspect({ name: "Diallo" })
    assert.equal(p.lastName, "Diallo")
    assert.equal(p.firstName, "")
  })

  test("prénom et nom renseignés l'emportent sur le nom complet", () => {
    const p = partieDepuisClient({ name: "N'IMPORTE QUOI", first_name: "Awa", last_name: "Diallo" })
    assert.equal(p.firstName, "Awa")
    assert.equal(p.lastName, "Diallo")
  })

  test("les blancs sont nettoyés, pas recopiés", () => {
    const p = partieDepuisClient({ first_name: "  Awa  ", email: "  awa@x.ca " })
    assert.equal(p.firstName, "Awa")
    assert.equal(p.email, "awa@x.ca")
  })

  test("les champs absents deviennent des chaînes vides, jamais « undefined »", () => {
    // « Tél : undefined » sur un contrat est le genre de détail qui se voit.
    const p = partieDepuisProspect({ name: "Awa Diallo" })
    for (const [cle, v] of Object.entries(p)) {
      if (cle === "civility" || cle === "birthDate") continue
      assert.equal(typeof v, "string", cle)
      assert.ok(!/undefined|null/.test(String(v)), `${cle} = ${v}`)
    }
  })
})

describe("le cabinet vient des Paramètres", () => {
  test("nom, consultant et permis sont repris tels quels", () => {
    const c = cabinetDepuisFirm({
      name: "Diarra Global Visa", owner_name: "Adama Diarra",
      rcic_license_number: "R1041776", address: "500 Place d'Armes",
      email: "infos@dgv.ca", phone: "+1 514 555 0100", website: "dgv.ca",
    }, "mr")
    assert.equal(c.permis, "R1041776")
    assert.equal(variablesDe({
      contractant: {}, cabinet: c,
      montants: { honoraires: 1, taxes: 0, total: 1 },
      entente: { numero: "X", date: "2026-08-11", titre: "T" }, locale: "fr",
    }).nom_consultant, "Monsieur Adama Diarra")
  })

  test("un cabinet sans permis bloque la génération", () => {
    const c = cabinetDepuisFirm({ name: "Cabinet", owner_name: "Qui" })
    const r = verifierAvantGeneration({
      contractant: { firstName: "A", lastName: "B", email: "a@b.ca", address: "1 rue" },
      cabinet: c, montants: { honoraires: 100, taxes: 0, total: 100 },
      entente: { numero: "X", date: "2026-08-11", titre: "T" }, locale: "fr",
    })
    assert.equal(r.ok, false)
    if (!r.ok) assert.ok(r.manquants.some((m) => /permis/i.test(m)))
  })
})

describe("ligneDePartie", () => {
  test("rend TOUTES les colonnes, même vides", () => {
    // PostgREST unifie le jeu de colonnes d'un insert groupé : une ligne qui
    // en omet une reçoit NULL au lieu de sa valeur par défaut, et l'insert
    // entier échoue. C'est le piège qu'a attrapé ./cric ententes.
    const ligne = ligneDePartie({ firstName: "Ibrahim", lastName: "Diallo" }, "spouse", 2)
    for (const colonne of ["role", "civility", "first_name", "last_name", "legal_name",
      "email", "phone", "address", "city", "province", "postal_code", "country",
      "birth_date", "signing_order"]) {
      assert.ok(colonne in ligne, `colonne absente : ${colonne}`)
    }
    assert.equal(ligne.email, "")
    assert.equal(ligne.signing_order, 2)
  })

  test("deux parties produisent le MÊME jeu de colonnes", () => {
    const a = ligneDePartie({ firstName: "Awa", email: "awa@x.ca" }, "client")
    const b = ligneDePartie({ firstName: "Ibrahim" }, "spouse", 2)
    assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort())
  })
})
