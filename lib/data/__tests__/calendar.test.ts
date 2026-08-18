import { describe, it } from "node:test"
import assert from "node:assert/strict"
import type { CalendarEvent } from "../types"

function detecterConflit(
  nouveau: { date: string; startH: number; startM: number; dureeMin: number },
  existants: CalendarEvent[]
): CalendarEvent | null {
  const curStartMin = nouveau.startH * 60 + nouveau.startM
  const curEndMin = curStartMin + nouveau.dureeMin

  for (const evt of existants) {
    if (evt.date !== nouveau.date || evt.status === "cancelled") continue
    const evtStartMin = (evt.hour ?? 9) * 60
    const evtEndMin = evtStartMin + (evt.durationMinutes ?? 60)

    if (curStartMin < evtEndMin && curEndMin > evtStartMin) {
      return evt
    }
  }
  return null
}

describe("Moteur de calendrier & Détection de conflits", () => {
  const events: CalendarEvent[] = [
    {
      id: "evt-1",
      title: "Consultation Initiale",
      clientName: "Dr. S. Rahman",
      date: "2026-08-18",
      hour: 10,
      durationMinutes: 60,
      type: "consultation",
      status: "confirmed",
    },
    {
      id: "evt-2",
      title: "Suivi Dossier",
      clientName: "Marie Dubois",
      date: "2026-08-18",
      hour: 14,
      durationMinutes: 30,
      type: "followup",
      status: "confirmed",
    },
    {
      id: "evt-3",
      title: "Rendez-vous annulé",
      clientName: "Jean Tremblay",
      date: "2026-08-18",
      hour: 16,
      durationMinutes: 60,
      type: "consultation",
      status: "cancelled",
    },
  ]

  it("détecte un chevauchement exact d'horaire", () => {
    const conflit = detecterConflit(
      { date: "2026-08-18", startH: 10, startM: 0, dureeMin: 60 },
      events
    )
    assert.ok(conflit)
    assert.equal(conflit?.id, "evt-1")
  })

  it("détecte un chevauchement partiel (début pendant un rdv existant)", () => {
    const conflit = detecterConflit(
      { date: "2026-08-18", startH: 10, startM: 30, dureeMin: 45 },
      events
    )
    assert.ok(conflit)
    assert.equal(conflit?.id, "evt-1")
  })

  it("autorise un créneau immédiatement contigu sans chevauchement", () => {
    const sansConflit = detecterConflit(
      { date: "2026-08-18", startH: 11, startM: 0, dureeMin: 60 },
      events
    )
    assert.equal(sansConflit, null)
  })

  it("ignore les rendez-vous annulés pour la détection de conflit", () => {
    const sansConflit = detecterConflit(
      { date: "2026-08-18", startH: 16, startM: 0, dureeMin: 60 },
      events
    )
    assert.equal(sansConflit, null)
  })

  it("autorise un créneau identique sur une autre date", () => {
    const sansConflit = detecterConflit(
      { date: "2026-08-19", startH: 10, startM: 0, dureeMin: 60 },
      events
    )
    assert.equal(sansConflit, null)
  })
})
