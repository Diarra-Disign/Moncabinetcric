import test from "node:test"
import assert from "node:assert/strict"
import { creneauxLibres, type Plage, type Occupation } from "../creneaux"

const LUNDI_9_17: Plage[] = [{ weekday: 1, start: "09:00", end: "17:00" }]
const REGLES = { dureeMinutes: 60, preavisHeures: 24, horizonJours: 14 }

/** 2026-09-07 est un lundi. Repère de tous les cas ci-dessous. */
const LUNDI = "2026-09-07"
const MAINTENANT = new Date("2026-09-01T12:00:00Z") // mardi 1er, 8 h à Gatineau

test("une plage 9 h-17 h en créneaux d'une heure en donne huit", () => {
  const c = creneauxLibres({ plages: LUNDI_9_17, occupations: [], regles: REGLES, maintenant: MAINTENANT })
  const duLundi = c.filter((x) => x.debutLocal.startsWith(LUNDI))
  assert.equal(duLundi.length, 8, duLundi.map((x) => x.debutLocal).join(" "))
  assert.equal(duLundi[0].debutLocal, `${LUNDI}T09:00`)
  assert.equal(duLundi[7].debutLocal, `${LUNDI}T16:00`)
})

test("une plage 13 h 30-17 h en créneaux de 30 min en donne sept", () => {
  const c = creneauxLibres({
    plages: [{ weekday: 1, start: "13:30", end: "17:00" }],
    occupations: [], regles: { ...REGLES, dureeMinutes: 30 }, maintenant: MAINTENANT,
  })
  const duLundi = c.filter((x) => x.debutLocal.startsWith(LUNDI))
  assert.equal(duLundi.length, 7, duLundi.map((x) => x.debutLocal).join(" "))
  assert.equal(duLundi[0].debutLocal, `${LUNDI}T13:30`)
  assert.equal(duLundi[6].debutLocal, `${LUNDI}T16:30`)
})

test("un créneau qui déborderait de la plage n'est pas offert", () => {
  // 9 h-10 h 30 avec des créneaux d'une heure : un seul tient. Offrir 10 h
  // ferait déborder la rencontre de trente minutes hors des heures déclarées.
  const c = creneauxLibres({
    plages: [{ weekday: 1, start: "09:00", end: "10:30" }],
    occupations: [], regles: REGLES, maintenant: MAINTENANT,
  })
  const duLundi = c.filter((x) => x.debutLocal.startsWith(LUNDI))
  assert.equal(duLundi.length, 1)
  assert.equal(duLundi[0].debutLocal, `${LUNDI}T09:00`)
})

test("un rendez-vous de 90 minutes en bloque trois de 30", () => {
  const occupations: Occupation[] = [
    { debut: new Date(`${LUNDI}T14:00:00-04:00`), fin: new Date(`${LUNDI}T15:30:00-04:00`) },
  ]
  const c = creneauxLibres({
    plages: LUNDI_9_17, occupations,
    regles: { ...REGLES, dureeMinutes: 30 }, maintenant: MAINTENANT,
  })
  const heures = c.filter((x) => x.debutLocal.startsWith(LUNDI)).map((x) => x.debutLocal.slice(11))
  for (const bloquee of ["14:00", "14:30", "15:00"]) {
    assert.ok(!heures.includes(bloquee), `${bloquee} ne devrait pas être offert`)
  }
  assert.ok(heures.includes("13:30"), "13 h 30 reste libre")
  assert.ok(heures.includes("15:30"), "15 h 30 est libre dès la fin du rendez-vous")
})

test("un créneau qui ne fait que toucher un rendez-vous reste libre", () => {
  // 14 h-15 h occupé : le créneau 15 h-16 h ne chevauche pas, il succède.
  // Une comparaison à la main se trompe presque toujours sur cette borne.
  const occupations: Occupation[] = [
    { debut: new Date(`${LUNDI}T14:00:00-04:00`), fin: new Date(`${LUNDI}T15:00:00-04:00`) },
  ]
  const c = creneauxLibres({ plages: LUNDI_9_17, occupations, regles: REGLES, maintenant: MAINTENANT })
  const heures = c.filter((x) => x.debutLocal.startsWith(LUNDI)).map((x) => x.debutLocal.slice(11))
  assert.ok(heures.includes("15:00"), "15 h doit rester offert")
  assert.ok(!heures.includes("14:00"))
})

test("le préavis se compte depuis maintenant, dans le fuseau du cabinet", () => {
  // Vendredi 4 septembre 2026, 14 h à Gatineau. Avec 24 h de préavis, rien
  // avant samedi 14 h. Le vendredi entier doit donc disparaître.
  const vendrediApresMidi = new Date("2026-09-04T18:00:00Z")
  const c = creneauxLibres({
    plages: [{ weekday: 5, start: "09:00", end: "17:00" }], // vendredi
    occupations: [], regles: REGLES, maintenant: vendrediApresMidi,
  })
  assert.ok(!c.some((x) => x.debutLocal.startsWith("2026-09-04")),
    "aucun créneau du jour même ne doit subsister")
  assert.ok(c.some((x) => x.debutLocal.startsWith("2026-09-11")),
    "le vendredi suivant reste offert")
})

test("l'horizon borne la liste", () => {
  const c = creneauxLibres({
    plages: LUNDI_9_17, occupations: [],
    regles: { ...REGLES, horizonJours: 7 }, maintenant: MAINTENANT,
  })
  // Du 1er au 8 septembre : un seul lundi, le 7.
  const jours = [...new Set(c.map((x) => x.debutLocal.slice(0, 10)))]
  assert.deepEqual(jours, [LUNDI], `reçu ${jours.join(", ")}`)
})

test("le passage à l'heure d'hiver ne décale ni ne duplique un créneau", () => {
  // Le 1er novembre 2026, l'heure recule à 2 h. Un dimanche 9 h reste 9 h :
  // l'arithmétique naïve en millisecondes le placerait à 8 h ou le doublerait.
  const octobre = new Date("2026-10-20T12:00:00Z")
  const c = creneauxLibres({
    plages: [{ weekday: 0, start: "09:00", end: "12:00" }], // dimanche
    occupations: [], regles: { ...REGLES, horizonJours: 21 }, maintenant: octobre,
  })
  const duChangement = c.filter((x) => x.debutLocal.startsWith("2026-11-01"))
  assert.equal(duChangement.length, 3, duChangement.map((x) => x.debutLocal).join(" "))
  assert.equal(duChangement[0].debutLocal, "2026-11-01T09:00")
  // Aucun doublon : chaque instant absolu doit être unique.
  const instants = c.map((x) => x.debut.getTime())
  assert.equal(new Set(instants).size, instants.length, "aucun créneau ne doit apparaître deux fois")
})

test("sans plage déclarée, aucun créneau", () => {
  const c = creneauxLibres({ plages: [], occupations: [], regles: REGLES, maintenant: MAINTENANT })
  assert.equal(c.length, 0)
})

test("les créneaux sont rendus en ordre chronologique", () => {
  const c = creneauxLibres({
    plages: [
      { weekday: 1, start: "13:30", end: "17:00" },
      { weekday: 1, start: "09:00", end: "12:00" },
    ],
    occupations: [], regles: REGLES, maintenant: MAINTENANT,
  })
  const instants = c.map((x) => x.debut.getTime())
  assert.deepEqual(instants, [...instants].sort((a, b) => a - b), "l'ordre doit être croissant")
})

test("slugDepuis — une raison sociale devient une adresse lisible", async () => {
  const { slugDepuis } = await import("../slug")
  // Coupé à 40 caractères, et le tiret de coupe est retiré : une adresse ne
  // doit jamais finir par un tiret.
  assert.equal(
    slugDepuis("Diarra Global Visa & Immigration Services Inc."),
    "diarra-global-visa-immigration-services"
  )
  // Les accents sont ramenés à leur lettre, non supprimés : « Édouard » ne
  // doit pas devenir « douard ».
  assert.equal(slugDepuis("Île-du-Prince-Édouard"), "ile-du-prince-edouard")
  assert.equal(slugDepuis("Cabinet Côté & Frères"), "cabinet-cote-freres")
  // Une raison sociale sans lettre latine ne peut pas produire d'adresse : le
  // cabinet en saisira une lui-même.
  assert.equal(slugDepuis("——"), "")
  assert.ok(!slugDepuis("Cabinet Test ").endsWith("-"), "aucun tiret en fin d'adresse")
})
