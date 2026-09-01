/**
 * Le sort des courriels d'une demande de signature, dit en une phrase.
 *
 * ─── POURQUOI CE MODULE EXISTE À PART ──────────────────────────────────────
 *
 * Ces quinze lignes vivaient dans `lib/data/signature-actions.ts`, qui porte
 * « use server ». Tout ce qu'un tel fichier exporte doit être une fonction
 * asynchrone : la règle ne pouvait donc pas en sortir, et ne pouvait pas être
 * éprouvée. Elle décide pourtant de la seule phrase qui dit au consultant si
 * son client a reçu son lien — autant dire qu'elle mérite des épreuves.
 *
 * Règle pure ici, action serveur là : c'est l'organisation que le PRD §3
 * prescrit, et c'est ce qui la rend testable sans base ni réseau.
 */

export interface Courrier {
  partis: number
  /** Ce que le fournisseur a répondu quand il a refusé. Jamais avalé. */
  erreur?: string
  /** Vrai si RESEND_API_KEY et EMAIL_FROM manquent : rien n'a été tenté. */
  nonConfigure?: boolean
}

/**
 * Traduit le sort des courriels en une phrase pour le consultant.
 *
 * L'ÉCHEC EST DIT, ET SA RAISON AVEC. Une version antérieure comptait les
 * envois réussis et jetait `r.erreur` : un refus de Resend — domaine non
 * vérifié, quota dépassé — devenait « aucun courriel n'est parti », sans que
 * personne puisse savoir pourquoi ni quoi corriger.
 */
export function verdictCourriel(c: Courrier): string {
  if (c.partis > 0) {
    return `${c.partis} courriel${c.partis > 1 ? "s" : ""} parti${c.partis > 1 ? "s" : ""}.`
  }
  if (c.nonConfigure) {
    return "Aucun courriel n'est parti : l'envoi n'est pas configuré sur ce serveur. " +
      "Transmettez le lien vous-même depuis l'historique."
  }
  if (c.erreur) {
    return `Aucun courriel n'est parti — le service d'envoi a refusé : ${c.erreur}`
  }
  return "Aucun courriel n'est parti."
}

/**
 * Faut-il arrêter l'écran sur ce résultat ?
 *
 * La demande part même si aucun courriel ne sort : les jetons sont valides et
 * le consultant peut transmettre les liens lui-même. C'est donc un SUCCÈS — et
 * c'est exactement ce qui rendait l'échec invisible, la liste des ententes
 * rechargeant la page dès que le résultat est bon, ce qui effaçait le message
 * avant qu'on ait pu le lire.
 */
export function courrielAAvertir(c: Courrier): boolean {
  return c.partis === 0
}
