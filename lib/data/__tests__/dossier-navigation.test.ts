import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { destinationPourClient, cheminDestination } from "../dossier-navigation"
import type { Matter } from "../types"

/**
 * Où mène le clic sur un client, dans la liste des clients.
 *
 * ─── L'INCIDENT ────────────────────────────────────────────────────────────
 *
 * Le clic cherchait le PREMIER dossier dont le client correspondait, et se
 * repliait sur la liste générale `/matters` quand il n'en trouvait aucun. Or
 * cette liste ouvre d'office le panneau de son premier dossier : le
 * consultant croyait avoir ouvert le dossier de son client et lisait celui
 * d'un autre. Sur les données réelles, quatre clients sur sept n'ont aucun
 * dossier rattaché — ce n'était donc pas un cas limite.
 *
 * La règle porte maintenant l'identifiant du client dans les deux cas, et ne
 * choisit un dossier à la place de l'utilisateur que s'il n'y en a qu'un.
 */

const dossier = (reference: string, clientId: string | undefined): Matter =>
  ({
    id: reference,
    clientId,
    clientName: "",
    program: "",
    openedDate: "",
    deadline: "",
    rcic: "",
    status: "valid",
  }) as Matter

describe("destinationPourClient", () => {
  test("un client avec un seul dossier ouvre ce dossier", () => {
    const dossiers = [dossier("#DOS-35695", "c-1"), dossier("#DOS-35696", "c-2")]
    assert.deepEqual(destinationPourClient("c-2", dossiers), {
      type: "dossier",
      reference: "DOS-35696",
    })
  })

  test("un client sans dossier ne renvoie JAMAIS vers le dossier d'un autre", () => {
    const dossiers = [dossier("#DOS-35695", "c-1"), dossier("#DOS-35696", "c-2")]
    assert.deepEqual(destinationPourClient("c-9", dossiers), {
      type: "dossiers-du-client",
      clientId: "c-9",
    })
  })

  test("un client avec plusieurs dossiers les fait choisir, sans en présumer un", () => {
    const dossiers = [
      dossier("#DOS-1", "c-4"),
      dossier("#DOS-2", "c-4"),
      dossier("#DOS-3", "c-1"),
    ]
    assert.deepEqual(destinationPourClient("c-4", dossiers), {
      type: "dossiers-du-client",
      clientId: "c-4",
    })
  })

  test("un dossier sans client rattaché n'est attribué à personne", () => {
    const dossiers = [dossier("#DOS-35660", undefined), dossier("#DOS-35661", "c-1")]
    assert.deepEqual(destinationPourClient("c-2", dossiers), {
      type: "dossiers-du-client",
      clientId: "c-2",
    })
    assert.deepEqual(destinationPourClient("c-1", dossiers), {
      type: "dossier",
      reference: "DOS-35661",
    })
  })

  test("une liste de dossiers vide reste sur le client", () => {
    assert.deepEqual(destinationPourClient("c-1", []), {
      type: "dossiers-du-client",
      clientId: "c-1",
    })
  })
})

describe("cheminDestination", () => {
  test("le dossier est adressé par sa référence, sans dièse", () => {
    assert.equal(
      cheminDestination({ type: "dossier", reference: "DOS-35696" }),
      "/matters/DOS-35696"
    )
  })

  test("les dossiers d'un client sont adressés par l'identifiant du client", () => {
    assert.equal(
      cheminDestination({ type: "dossiers-du-client", clientId: "c-4" }),
      "/matters?client=c-4"
    )
  })

  test("un identifiant à caractères spéciaux reste lisible par la route", () => {
    assert.equal(
      cheminDestination({ type: "dossiers-du-client", clientId: "c/1 &2" }),
      "/matters?client=c%2F1%20%262"
    )
  })
})
