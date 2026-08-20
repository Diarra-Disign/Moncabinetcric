/**
 * Traducteur bilingue d'erreurs pour la couche de données et les Server Actions.
 *
 * Évite d'exposer des messages techniques bruts Postgres/PostgREST aux utilisateurs
 * tout en conservant les messages métier explicites (ex: déclencheurs fidéicommis).
 */

export interface ErreurTechnique {
  code?: string
  message?: string
  details?: string
  hint?: string
}

const MESSAGES_FR: Record<string, string> = {
  // PostgreSQL errors
  "42501": "Vous n'avez pas l'autorisation d'effectuer cette action.",
  "23505": "Cet élément existe déjà (doublon détecté).",
  "23503": "L'élément lié est introuvable ou a été supprimé.",
  "23502": "Un ou plusieurs champs obligatoires sont manquants.",
  "23514": "Les données fournies ne respectent pas les critères de validation.",
  "22P02": "Le format d'un des identifiants ou paramètres est invalide.",

  // PostgREST errors
  "PGRST116": "L'élément demandé est introuvable.",
  "PGRST301": "Votre session a expiré. Veuillez vous reconnecter.",

  // Common fallbacks
  "network": "Erreur de communication avec le serveur. Vérifiez votre connexion.",
  "generic": "Une erreur inattendue est survenue. Veuillez réessayer.",
  "unauthorized": "Session expirée ou droits insuffisants.",
  "not_found": "Ressource introuvable.",
}

const MESSAGES_EN: Record<string, string> = {
  // PostgreSQL errors
  "42501": "You do not have permission to perform this action.",
  "23505": "This item already exists (duplicate detected).",
  "23503": "The linked item was not found or has been deleted.",
  "23502": "One or more required fields are missing.",
  "23514": "The provided data does not meet validation criteria.",
  "22P02": "The format of one of the parameters or IDs is invalid.",

  // PostgREST errors
  "PGRST116": "The requested item was not found.",
  "PGRST301": "Your session has expired. Please log in again.",

  // Common fallbacks
  "network": "Server communication error. Please check your connection.",
  "generic": "An unexpected error occurred. Please try again.",
  "unauthorized": "Session expired or insufficient permissions.",
  "not_found": "Resource not found.",
}

/**
 * Ce message a-t-il été rédigé par PostgreSQL lui-même, plutôt que par l'un
 * de nos déclencheurs ?
 *
 * PostgreSQL et PostgREST écrivent leurs erreurs dans des gabarits fixes, en
 * anglais, en citant les noms internes des tables et des contraintes. Ce sont
 * exactement les chaînes qu'on ne veut pas montrer : elles ne disent rien à
 * un consultant et exposent la structure de la base.
 *
 * Nos déclencheurs, eux, écrivent une phrase destinée à être lue. Reconnaître
 * le gabarit technique plutôt que d'essayer de reconnaître le français évite
 * l'écueil de la version précédente, qui laissait passer tout message
 * contenant un mot comme « solde » ou « invalide ».
 */
function redigeParPostgres(message: string): boolean {
  return [
    /violates (check|unique|foreign key|not-null|exclusion) constraint/i,
    /new row for relation "/i,
    /duplicate key value/i,
    /null value in column "/i,
    /insert or update on table "/i,
    /update or delete on table "/i,
    /violates row-level security policy/i,
    /permission denied for (table|schema|relation|function|sequence)/i,
    /invalid input syntax for/i,
    /value too long for type/i,
    /column .* does not exist/i,
    /relation "[^"]+" does not exist/i,
    /schema cache/i,
    /JSON object requested/i,
    /could not find the/i,
  ].some((motif) => motif.test(message))
}

export function messageErreur(
  erreur: unknown,
  locale: string = "fr"
): string {
  const isEn = locale === "en"
  const table = isEn ? MESSAGES_EN : MESSAGES_FR

  if (!erreur) {
    return table.generic
  }

  // 1. Chaîne directe
  if (typeof erreur === "string") {
    const s = erreur.trim()
    if (table[s]) return table[s]
    if (/row-level security/i.test(s)) return table["42501"]
    if (/failed to fetch|networkerror/i.test(s)) return table.network
    if (/jwt expired|session expir/i.test(s)) return table.unauthorized
    return table.generic
  }

  // 2. Objet d'erreur (PostgrestError, Error, etc.)
  if (typeof erreur === "object" && erreur !== null) {
    const err = erreur as ErreurTechnique & { name?: string; isBusinessError?: boolean }
    const code = String(err.code ?? "").trim()
    const brut = String(err.message ?? "").trim()

    // A. Erreur métier déclarée comme telle, quel que soit son code.
    if (code === "P0001" || err.isBusinessError || err.name === "BusinessError") {
      return brut || table.generic
    }

    // B. Code standard reconnu — MAIS le code ne suffit pas à décider.
    //
    // Dix-neuf déclencheurs de ce dépôt lèvent avec un code STANDARD :
    // `errcode = 'check_violation'` (23514) ou `'insufficient_privilege'`
    // (42501). Leur message, lui, est une phrase écrite pour un humain :
    //
    //     « Solde en fidéicommis débiteur interdit : le client passerait
    //       à -100.00. Un solde négatif signifie que les fonds d'un autre
    //       client seraient employés. »
    //
    // Rendre `table[code]` sur la foi du seul code remplacerait cette
    // phrase — la plus importante de l'application, celle qui empêche
    // d'employer l'argent d'un client pour un autre — par « Les données
    // fournies ne respectent pas les critères de validation. »
    //
    // Le discriminant n'est donc pas le code mais la FORME du message :
    // PostgreSQL rédige ses propres violations dans un gabarit fixe, que
    // nos déclencheurs n'emploient jamais.
    if (code && table[code]) {
      return brut && !redigeParPostgres(brut) ? brut : table[code]
    }

    // C. Détection par motif précis dans le message technique Postgres
    if (/row-level security|permission denied/i.test(brut)) {
      return table["42501"]
    }
    if (/duplicate key|unique constraint/i.test(brut)) {
      return table["23505"]
    }
    if (/foreign key|violates foreign key/i.test(brut)) {
      return table["23503"]
    }
    if (/null value in column|violates not-null/i.test(brut)) {
      return table["23502"]
    }
    if (/check constraint/i.test(brut)) {
      return table["23514"]
    }
    if (/invalid input syntax/i.test(brut)) {
      return table["22P02"]
    }
    if (/failed to fetch|network/i.test(brut)) {
      return table.network
    }
    if (/jwt expired|session expir/i.test(brut)) {
      return table.unauthorized
    }
  }

  // Tout message non explicitement reconnu retourne le message générique
  return table.generic
}
