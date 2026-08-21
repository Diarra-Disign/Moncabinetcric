import test from "node:test"
import assert from "node:assert/strict"
import { courrielRendezVous, composerMomentRendezVous } from "../templates"

const BASE = {
  nomClient: "Awa Diallo",
  nomCabinet: "Diarra Global Visa",
  motif: "Consultation initiale",
  dateLisible: "mardi 15 septembre 2026",
  heureLisible: "14 h 30",
  fuseauLisible: "heure de l’Est",
  dureeMinutes: 45,
  reponsePossible: true,
} as const

test("composerMomentRendezVous — la date ne recule pas d'un jour", () => {
  // Le piège : `new Date("2026-09-15")` place l'instant à minuit UTC, soit
  // 20 h le 14 septembre à Gatineau. Le courriel annoncerait la veille.
  const fr = composerMomentRendezVous("2026-09-15", "14:30", "fr")
  assert.ok(fr.dateLisible.includes("15"), `reçu « ${fr.dateLisible} »`)
  assert.ok(fr.dateLisible.includes("septembre"), `reçu « ${fr.dateLisible} »`)
  assert.ok(fr.dateLisible.includes("mardi"), "le jour de la semaine sert de contrôle au lecteur")
  assert.equal(fr.heureLisible, "14 h 30")
})

test("composerMomentRendezVous — le premier de l'an ne bascule pas sur l'année précédente", () => {
  const fr = composerMomentRendezVous("2027-01-01", "09:00", "fr")
  assert.ok(fr.dateLisible.includes("2027"), `reçu « ${fr.dateLisible} »`)
  assert.ok(fr.dateLisible.includes("janvier"), `reçu « ${fr.dateLisible} »`)
})

test("composerMomentRendezVous — l'anglais donne une heure de 12 h", () => {
  const en = composerMomentRendezVous("2026-09-15", "14:30", "en")
  assert.match(en.heureLisible, /2:30/, `reçu « ${en.heureLisible} »`)
  assert.match(en.heureLisible, /p\.?m\.?/i, "le méridien doit figurer")
})

test("composerMomentRendezVous — le fuseau est nommé, jamais laissé implicite", () => {
  // Un client encore à Dakar ou à Manille manque le rendez-vous si l'heure
  // est donnée sans fuseau.
  const fr = composerMomentRendezVous("2026-09-15", "14:30", "fr")
  assert.ok(fr.fuseauLisible.length > 3, `reçu « ${fr.fuseauLisible} »`)
  assert.notEqual(fr.fuseauLisible, "America/Toronto", "pas l'identifiant technique")
})

test("courrielRendezVous — porte le lien de la rencontre", () => {
  const c = courrielRendezVous({ ...BASE, langue: "fr", lienRencontre: "https://zoom.us/j/123" })
  assert.ok(c.html.includes("https://zoom.us/j/123"))
  assert.ok(c.texte.includes("https://zoom.us/j/123"), "le lien doit aussi être dans la version texte")
  assert.ok(c.html.includes("Rejoindre la rencontre"))
  assert.ok(c.sujet.includes("15 septembre 2026"))
})

test("courrielRendezVous — sans lien, le courriel part quand même", () => {
  // Un rendez-vous en personne n'a pas de lien. Ne rien envoyer laisserait le
  // client sans date.
  const c = courrielRendezVous({ ...BASE, langue: "fr" })
  assert.ok(c.html.includes("15 septembre 2026"))
  assert.ok(!c.html.includes("Rejoindre la rencontre"))
  assert.ok(c.html.includes("séparément"), "on annonce que le lieu suivra")
})

test("courrielRendezVous — le lien de réservation sert de repli pour reprogrammer", () => {
  const c = courrielRendezVous({ ...BASE, langue: "fr", lienReservation: "https://calendly.com/x/y" })
  assert.ok(c.html.includes("https://calendly.com/x/y"))
  assert.ok(c.html.includes("nouveau créneau"))
})

test("courrielRendezVous — l'anglais est complet, sans français résiduel", () => {
  const c = courrielRendezVous({ ...BASE, langue: "en", lienRencontre: "https://meet.google.com/abc" })
  assert.ok(c.sujet.startsWith("Your appointment"))
  assert.ok(c.html.includes("Join the meeting"))
  assert.ok(!/Bonjour|Rendez-vous confirmé|Durée/.test(c.html), "aucune chaîne française ne doit rester")
})

test("courrielRendezVous — le nom du client ne peut pas disloquer le courriel", () => {
  // Le nom vient d'une fiche saisie à la main : il n'est pas de confiance.
  const c = courrielRendezVous({
    ...BASE, langue: "fr",
    nomClient: '<img src=x onerror="alert(1)">',
    nomCabinet: "Cabinet & Fils <script>",
  })
  assert.ok(!c.html.includes("<img"), "la balise doit être échappée")
  assert.ok(!c.html.includes("<script>"), "la balise doit être échappée")
  assert.ok(c.html.includes("&lt;img"))
  assert.ok(c.html.includes("Cabinet &amp; Fils"))
})

test("courrielRendezVous — n'invite à répondre que si une adresse existe", () => {
  const avec = courrielRendezVous({ ...BASE, langue: "fr", reponsePossible: true })
  const sans = courrielRendezVous({ ...BASE, langue: "fr", reponsePossible: false })
  assert.ok(avec.html.includes("Répondez à ce message"))
  assert.ok(!sans.html.includes("Répondez à ce message"),
    "inviter à répondre sans adresse de réponse enverrait le client écrire dans le vide")
})

test("composerMomentRendezVous — un libellé humain ne produit jamais « NaN »", () => {
  // L'application fait circuler DEUX représentations de l'heure : « 14:30 » et
  // le libellé « 10 h 00 – 11 h 00 (60 min) ». Les confondre a failli arriver,
  // et aurait envoyé « NaN h 00 » à un client.
  for (const mauvais of ["10 h 00 – 11 h 00 (60 min)", "", "abc", "99:99", "-1:00"]) {
    const r = composerMomentRendezVous("2026-09-15", mauvais, "fr")
    assert.ok(!/NaN/.test(r.heureLisible), `« ${mauvais} » a produit « ${r.heureLisible} »`)
    assert.ok(!/NaN/.test(r.dateLisible), `« ${mauvais} » a produit « ${r.dateLisible} »`)
  }
  const en = composerMomentRendezVous("2026-09-15", "10 h 00 – 11 h 00", "en")
  assert.ok(!/NaN/.test(en.heureLisible), `reçu « ${en.heureLisible} »`)
})
