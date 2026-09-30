import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { clientDuRendezVous, dossierDuRendezVous } from "../rapprochement-rendez-vous"
import type { CalendarEvent, ClientRecord, Matter } from "../types"

/**
 * À qui et à quel dossier se rattache un rendez-vous.
 *
 * ─── CE QUI SE FAISAIT ─────────────────────────────────────────────────────
 *
 * `clients.find((c) => c.name === event.clientName || c.id === event.clientId)`
 * — le NOM d'abord, l'identifiant ensuite. Deux clients homonymes, et le
 * rendez-vous s'attachait au premier des deux ; le bouton « compte rendu »
 * ouvrait alors le dossier de quelqu'un d'autre. Même famille de défaut que
 * le clic sur un client, par comparaison de texte cette fois.
 *
 * L'identifiant fait foi. Le nom ne sert qu'aux rendez-vous anciens, qui n'en
 * portent aucun — et seulement si personne d'autre ne porte ce nom.
 */

const client = (id: string, name: string): ClientRecord => ({ id, name } as ClientRecord)
const dossier = (reference: string, clientId?: string): Matter =>
  ({ id: reference, clientId } as Matter)
const rendezVous = (champs: Partial<CalendarEvent>): CalendarEvent =>
  ({ id: "e-1", clientName: "", ...champs }) as CalendarEvent

describe("clientDuRendezVous", () => {
  const clients = [client("c-1", "Marie Tremblay"), client("c-2", "Marie Tremblay"), client("c-3", "Éric Sanou")]

  test("l'identifiant l'emporte sur le nom", () => {
    const trouve = clientDuRendezVous(rendezVous({ clientId: "c-2", clientName: "Marie Tremblay" }), clients)
    assert.equal(trouve?.id, "c-2")
  })

  test("deux homonymes sans identifiant : aucun n'est choisi au hasard", () => {
    assert.equal(clientDuRendezVous(rendezVous({ clientName: "Marie Tremblay" }), clients), undefined)
  })

  test("un nom unique suffit quand le rendez-vous ne porte pas d'identifiant", () => {
    assert.equal(clientDuRendezVous(rendezVous({ clientName: "Éric Sanou" }), clients)?.id, "c-3")
  })

  test("un identifiant inconnu ne se rabat PAS sur le nom", () => {
    // Le rendez-vous désigne quelqu'un que cette liste ne contient pas :
    // se rabattre sur le nom reviendrait à inventer un rattachement.
    assert.equal(
      clientDuRendezVous(rendezVous({ clientId: "c-99", clientName: "Éric Sanou" }), clients),
      undefined
    )
  })
})

describe("dossierDuRendezVous", () => {
  const dossiers = [dossier("#DOS-1", "c-1"), dossier("#DOS-2", "c-2"), dossier("#DOS-3", "c-2")]

  test("la référence portée par le rendez-vous fait foi", () => {
    const trouve = dossierDuRendezVous(rendezVous({ matterId: "#DOS-2" }), dossiers, client("c-1", "X"))
    assert.equal(trouve?.id, "#DOS-2")
  })

  test("sans référence, le dossier unique du client est retenu", () => {
    assert.equal(dossierDuRendezVous(rendezVous({}), dossiers, client("c-1", "X"))?.id, "#DOS-1")
  })

  test("un client à plusieurs dossiers n'en désigne aucun", () => {
    assert.equal(dossierDuRendezVous(rendezVous({}), dossiers, client("c-2", "X")), undefined)
  })

  test("sans client ni référence, rien n'est rattaché", () => {
    assert.equal(dossierDuRendezVous(rendezVous({}), dossiers, undefined), undefined)
  })

  test("un client sans dossier n'en reçoit pas un d'office", () => {
    assert.equal(dossierDuRendezVous(rendezVous({}), dossiers, client("c-9", "X")), undefined)
  })
})
