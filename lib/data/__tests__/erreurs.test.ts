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

/**
 * Les messages de nos déclencheurs, relevés SUR LA BASE et non fabriqués.
 *
 * La série précédente n'éprouvait que des cas inventés — un code seul, ou un
 * message au gabarit anglais. Elle passait au vert pendant que le message le
 * plus important de l'application était remplacé par une phrase creuse.
 *
 * Les trois premiers cas ci-dessous sont les chaînes exactes que PostgREST
 * renvoie, avec leur code exact : nos déclencheurs lèvent avec un errcode
 * STANDARD, jamais P0001, et c'est ce qui rendait la garde inopérante.
 */
test("messageErreur — les messages de nos déclencheurs survivent", () => {
  // enforce_trust_balance — le garde-fou du fidéicommis.
  const fideicommis =
    "Solde en fidéicommis débiteur interdit : le client passerait à -100.00. " +
    "Un solde négatif signifie que les fonds d'un autre client seraient employés."
  assert.equal(messageErreur({ code: "23514", message: fideicommis }, "fr"), fideicommis)

  // enforce_seat_limit — le plafond de places.
  const sieges = "Plan limité à 1 place(s), déjà 1 occupée(s) — invitations en attente comprises."
  assert.equal(messageErreur({ code: "23514", message: sieges }, "fr"), sieges)

  // protect_firm_columns — lève avec insufficient_privilege (42501).
  const forfait = "Le forfait suit l'abonnement : il se change depuis Réglages → Abonnement."
  assert.equal(messageErreur({ code: "42501", message: forfait }, "fr"), forfait)

  // notifier — le refus de cloisonnement, lui aussi en 42501.
  const cloison = "Notification refusée : ce cabinet n'est pas le vôtre."
  assert.equal(messageErreur({ code: "42501", message: cloison }, "fr"), cloison)
})

test("messageErreur — les messages écrits par PostgreSQL restent masqués", () => {
  // Le gabarit de PostgreSQL, avec le même code que le message métier
  // ci-dessus : c'est bien la FORME, et non le code, qui départage.
  assert.equal(
    messageErreur({
      code: "23514",
      message: 'new row for relation "tasks" violates check constraint "tasks_priority_check"',
    }, "fr"),
    "Les données fournies ne respectent pas les critères de validation."
  )
  assert.equal(
    messageErreur({
      code: "23505",
      message: 'duplicate key value violates unique constraint "clients_file_number_key"',
    }, "fr"),
    "Cet élément existe déjà (doublon détecté)."
  )
  assert.equal(
    messageErreur({
      code: "42501",
      message: 'new row violates row-level security policy for table "invoices"',
    }, "en"),
    "You do not have permission to perform this action."
  )
  assert.equal(
    messageErreur({ code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" }, "fr"),
    "L'élément demandé est introuvable."
  )
  // Un code seul, sans message : rien à préserver, on rend la traduction.
  assert.equal(
    messageErreur({ code: "23502" }, "fr"),
    "Un ou plusieurs champs obligatoires sont manquants."
  )
})
