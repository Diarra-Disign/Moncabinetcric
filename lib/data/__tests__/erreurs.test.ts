import test from "node:test"
import assert from "node:assert/strict"
import { messageErreur } from "../erreurs"

test("messageErreur — gestion bilingue des erreurs PostgreSQL", () => {
  // RLS
  assert.equal(
    messageErreur({ code: "42501" }, "fr"),
    "Vous n'avez pas l'autorisation d'effectuer cette action."
  )
  assert.equal(
    messageErreur({ code: "42501" }, "en"),
    "You do not have permission to perform this action."
  )
  assert.equal(
    messageErreur({ message: "new row violates row-level security policy" }, "fr"),
    "Vous n'avez pas l'autorisation d'effectuer cette action."
  )

  // Doublons (23505)
  assert.equal(
    messageErreur({ code: "23505" }, "fr"),
    "Cet élément existe déjà (doublon détecté)."
  )
  assert.equal(
    messageErreur({ code: "23505" }, "en"),
    "This item already exists (duplicate detected)."
  )

  // Clé étrangère (23503)
  assert.equal(
    messageErreur({ code: "23503" }, "fr"),
    "L'élément lié est introuvable ou a été supprimé."
  )

  // Not null (23502)
  assert.equal(
    messageErreur({ code: "23502" }, "fr"),
    "Un ou plusieurs champs obligatoires sont manquants."
  )

  // PostgREST 116
  assert.equal(
    messageErreur({ code: "PGRST116" }, "fr"),
    "L'élément demandé est introuvable."
  )

  // Messages métier explicites des déclencheurs (code P0001) préservés
  assert.equal(
    messageErreur({ code: "P0001", message: "Solde débiteur de 150.00 CAD interdit" }, "fr"),
    "Solde débiteur de 150.00 CAD interdit"
  )

  // Erreur technique Postgres masquée
  assert.equal(
    messageErreur({ message: "syntax error at or near 'SELECT'" }, "fr"),
    "Une erreur inattendue est survenue. Veuillez réessayer."
  )
  assert.equal(
    messageErreur({ message: "syntax error at or near 'SELECT'" }, "en"),
    "An unexpected error occurred. Please try again."
  )
})
