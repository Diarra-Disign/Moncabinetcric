import test from "node:test"
import assert from "node:assert/strict"
import { courrielOffreAbonnement } from "../templates"

const BASE = {
  langue: "fr" as const,
  cabinet: "Diarra Global Visa",
  forfait: "Cabinet Pro",
  prix: "79 $",
  cadence: "monthly" as const,
  lien: "https://moncabinetcric.com/fr/bienvenue?jeton=abc",
  nouveauCompte: true,
  jours: 7,
  reponsePossible: true,
}

test("courrielOffreAbonnement — le forfait, le prix et le lien figurent dans les deux versions", () => {
  const c = courrielOffreAbonnement(BASE)
  for (const corps of [c.html, c.texte]) {
    assert.ok(corps.includes("Cabinet Pro"))
    assert.ok(corps.includes("79 $"))
    assert.ok(corps.includes(BASE.lien))
  }
})

test("courrielOffreAbonnement — un nom de cabinet piégé ne disloque pas le HTML", () => {
  const c = courrielOffreAbonnement({ ...BASE, cabinet: `Immigration <b>&</b> "Fils"` })
  assert.ok(!c.html.includes("<b>&</b>"), "la balise du nom ne doit pas survivre")
  assert.ok(c.html.includes("&lt;b&gt;&amp;&lt;/b&gt;"))
  // Le sujet n'est pas du HTML : y échapper afficherait « &amp; » au client.
  assert.ok(c.sujet.includes(`Immigration <b>&</b> "Fils"`))
})

test("courrielOffreAbonnement — un nouveau compte apprend que le lien expire ; un compte existant, non", () => {
  const nouveau = courrielOffreAbonnement(BASE)
  assert.ok(nouveau.texte.includes("7 jours"))
  assert.ok(/mot de passe/i.test(nouveau.texte))

  const existant = courrielOffreAbonnement({ ...BASE, nouveauCompte: false })
  assert.ok(!existant.texte.includes("7 jours"))
  assert.ok(!/mot de passe/i.test(existant.texte))
})

test("courrielOffreAbonnement — la périodicité annuelle est dite, et l'anglais existe", () => {
  const annuel = courrielOffreAbonnement({ ...BASE, cadence: "annual", prix: "790 $" })
  assert.ok(/par année/.test(annuel.texte))

  const en = courrielOffreAbonnement({ ...BASE, langue: "en", prix: "$79" })
  assert.ok(/per month/.test(en.texte))
  assert.ok(en.sujet.includes("Diarra Global Visa"))
})
