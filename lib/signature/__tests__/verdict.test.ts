import { test } from "node:test"
import assert from "node:assert/strict"
import { verdictCourriel, courrielAAvertir } from "@/lib/signature/verdict"

/**
 * Ce que ces épreuves cherchent à prendre en défaut.
 *
 * Cette phrase est LE SEUL ENDROIT où le consultant apprend si son client a
 * reçu son lien de signature. La base ne le dit pas — `sent_at` était même
 * écrit avant l'envoi, et sans condition. Le journal ne le disait pas non plus.
 * Il a fallu interroger le tableau de bord d'un fournisseur tiers pour répondre
 * à la question « mon client a-t-il reçu son contrat ? ».
 *
 * DEUX FAÇONS DE MENTIR SONT ÉPROUVÉES ICI :
 *
 * 1. Taire la raison. Une version antérieure comptait les succès et jetait
 *    l'erreur du fournisseur : « aucun courriel n'est parti », sans jamais dire
 *    que le domaine n'était pas vérifié ou le quota dépassé. Le consultant
 *    n'avait rien à corriger, faute de savoir quoi.
 * 2. Se déguiser en succès. Le message était concaténé après « Demande
 *    envoyée. », dans un bandeau vert, sur un écran qui se rechargeait aussitôt
 *    — l'échec avait la forme exacte d'une réussite, et durait une seconde.
 *
 * `courrielAAvertir()` existe pour la seconde : c'est lui qui retient le
 * rechargement. Un envoi partiellement réussi n'avertit pas — quelqu'un a bien
 * reçu son lien — mais zéro courriel parti, si.
 */

test("verdictCourriel : un envoi réussi se compte, au singulier", () => {
  assert.equal(verdictCourriel({ partis: 1 }), "1 courriel parti.")
})

test("verdictCourriel : plusieurs envois s'accordent au pluriel", () => {
  assert.equal(verdictCourriel({ partis: 3 }), "3 courriels partis.")
})

test("verdictCourriel : un envoi non configuré dit quoi faire à la place", () => {
  const phrase = verdictCourriel({ partis: 0, nonConfigure: true })

  assert.match(phrase, /n'est pas configuré/)
  // La consigne compte autant que le diagnostic : le consultant doit pouvoir
  // sauver son dossier sans attendre qu'on répare le serveur.
  assert.match(phrase, /[Tt]ransmettez le lien vous-même/)
})

test("verdictCourriel : un refus du fournisseur cite sa raison mot pour mot", () => {
  const phrase = verdictCourriel({
    partis: 0,
    erreur: "Resend 403 : The domain is not verified.",
  })

  assert.match(phrase, /Aucun courriel n'est parti/)
  assert.match(phrase, /The domain is not verified\./)
})

test("verdictCourriel : le refus prime sur le silence", () => {
  // Sans erreur ni indication de configuration, il reste une phrase honnête
  // plutôt qu'une phrase vide.
  assert.equal(verdictCourriel({ partis: 0 }), "Aucun courriel n'est parti.")
})

test("courrielAAvertir : zéro courriel parti retient l'écran", () => {
  assert.equal(courrielAAvertir({ partis: 0 }), true)
  assert.equal(courrielAAvertir({ partis: 0, nonConfigure: true }), true)
  assert.equal(courrielAAvertir({ partis: 0, erreur: "Resend 429" }), true)
})

test("courrielAAvertir : dès qu'un courriel est parti, l'écran suit son cours", () => {
  assert.equal(courrielAAvertir({ partis: 1 }), false)
  assert.equal(courrielAAvertir({ partis: 2 }), false)
})
