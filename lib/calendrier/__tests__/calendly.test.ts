import test from "node:test"
import assert from "node:assert/strict"
import {
  apparierClient,
  convertirEvenement,
  statutDepuisCalendly,
  type EvenementCalendly,
  type ParticipantCalendly,
} from "../calendly"

const EVENEMENT: EvenementCalendly = {
  uri: "https://api.calendly.com/scheduled_events/AAAA-BBBB",
  name: "Consultation initiale",
  status: "active",
  start_time: "2026-09-15T18:30:00.000000Z",
  end_time: "2026-09-15T19:15:00.000000Z",
  location: { type: "zoom", join_url: "https://zoom.us/j/123456789" },
}

const PARTICIPANT: ParticipantCalendly = {
  name: "Awa Diallo",
  email: "awa.diallo@example.ca",
  timezone: "America/Toronto",
  questions_and_answers: [],
}

test("statutDepuisCalendly — traduit les deux états", () => {
  assert.equal(statutDepuisCalendly("active"), "confirmed")
  assert.equal(statutDepuisCalendly("canceled"), "cancelled")
  // Un état inconnu ne doit pas passer pour une confirmation : Calendly
  // pourrait en ajouter un, et confirmer par défaut afficherait un rendez-vous
  // qui n'a peut-être pas lieu.
  assert.equal(statutDepuisCalendly("something_new"), "cancelled")
})

test("apparierClient — retrouve la fiche par le courriel", () => {
  const fiches = [
    { id: "c1", email: "Awa.Diallo@Example.CA", name: "Awa Diallo" },
    { id: "c2", email: "jean@example.ca", name: "Jean Tremblay" },
  ]
  // La casse ne doit pas décider : Calendly rend ce que le client a tapé.
  assert.equal(apparierClient(fiches, "awa.diallo@example.ca")?.id, "c1")
  assert.equal(apparierClient(fiches, "  JEAN@EXAMPLE.CA  ")?.id, "c2")
  assert.equal(apparierClient(fiches, "inconnu@example.ca"), null)
  // Une fiche sans courriel ne doit jamais apparier une chaîne vide, sans quoi
  // tout inconnu s'accrocherait au premier client sans adresse.
  assert.equal(apparierClient([{ id: "c3", email: "", name: "Sans courriel" }], ""), null)
  assert.equal(apparierClient([{ id: "c3", email: null, name: "Sans" }], "x@y.ca"), null)
})

test("convertirEvenement — produit une ligne de calendrier complète", () => {
  const l = convertirEvenement(EVENEMENT, PARTICIPANT, null, "America/Toronto")

  assert.equal(l.external_id, "AAAA-BBBB", "l'identifiant est le dernier segment de l'URI")
  assert.equal(l.source, "calendly")
  assert.equal(l.title, "Consultation initiale")
  assert.equal(l.client_name, "Awa Diallo")
  assert.equal(l.client_id, null)
  assert.equal(l.status, "confirmed")
  assert.equal(l.platform, "zoom")
  assert.equal(l.link, "https://zoom.us/j/123456789")
  assert.equal(l.duration_minutes, 45)
  // 18:30 UTC un 15 septembre, c'est 14:30 à Gatineau — et le MÊME jour.
  // Convertir en UTC afficherait 18:30, soit quatre heures de décalage sur
  // une pièce qu'on lit pour savoir quand recevoir quelqu'un.
  assert.equal(l.date, "2026-09-15")
  assert.equal(l.time, "14:30")
  assert.equal(l.hour, 14)
  assert.ok(l.notes?.includes("awa.diallo@example.ca"), "le courriel reste consultable")
})

test("convertirEvenement — accroche la fiche quand elle existe", () => {
  const l = convertirEvenement(EVENEMENT, PARTICIPANT, { id: "c1", name: "Awa Diallo" }, "America/Toronto")
  assert.equal(l.client_id, "c1")
  assert.equal(l.client_name, "Awa Diallo")
})

test("convertirEvenement — un rendez-vous de fin de soirée ne change pas de jour", () => {
  // 2026-09-16T02:00Z, c'est le 15 septembre à 22:00 à Gatineau. Une
  // conversion naïve daterait ce rendez-vous du 16 et le consultant le
  // chercherait le mauvais jour.
  const tard = { ...EVENEMENT, start_time: "2026-09-16T02:00:00.000000Z", end_time: "2026-09-16T03:00:00.000000Z" }
  const l = convertirEvenement(tard, PARTICIPANT, null, "America/Toronto")
  assert.equal(l.date, "2026-09-15")
  assert.equal(l.time, "22:00")
  assert.equal(l.hour, 22)
})

test("convertirEvenement — survit à un événement incomplet", () => {
  // Calendly peut rendre un événement sans lieu, et un participant sans nom.
  // La relève ne doit pas tomber pour autant : un rendez-vous sans lien reste
  // un rendez-vous.
  const nu: EvenementCalendly = { ...EVENEMENT, name: "", location: undefined }
  const anonyme: ParticipantCalendly = { ...PARTICIPANT, name: "" }
  const l = convertirEvenement(nu, anonyme, null, "America/Toronto")
  assert.equal(l.platform, null)
  assert.equal(l.link, null)
  assert.ok(l.title.length > 0, "un titre de repli est fourni")
  assert.ok(l.client_name.length > 0, "le courriel sert de nom à défaut")
})
