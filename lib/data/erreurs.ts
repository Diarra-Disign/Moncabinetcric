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

export function messageErreur(
  erreur: unknown,
  locale: string = "fr"
): string {
  const isEn = locale === "en"
  const table = isEn ? MESSAGES_EN : MESSAGES_FR

  if (!erreur) {
    return table.generic
  }

  // Si c'est un code direct connu
  if (typeof erreur === "string") {
    if (table[erreur]) return table[erreur]
    if (/row-level security/i.test(erreur)) return table["42501"]
    if (/failed to fetch|networkerror/i.test(erreur)) return table.network
    if (/jwt expired|session expir/i.test(erreur)) return table.unauthorized
    return erreur
  }

  // Si c'est un objet (Error, PostgrestError ou similaire)
  if (typeof erreur === "object") {
    const err = erreur as ErreurTechnique & { name?: string }
    const code = String(err.code ?? "").trim()
    const brut = String(err.message ?? "").trim()

    // 1. Détection par code d'erreur SQL / PostgREST
    if (code && table[code]) {
      return table[code]
    }

    // 2. Détection par motif dans le message
    if (/row-level security/i.test(brut) || code === "42501") {
      return table["42501"]
    }
    if (/duplicate key|unique constraint/i.test(brut) || code === "23505") {
      return table["23505"]
    }
    if (/foreign key|violates foreign key/i.test(brut) || code === "23503") {
      return table["23503"]
    }
    if (/null value in column|violates not-null/i.test(brut) || code === "23502") {
      return table["23502"]
    }
    if (/check constraint/i.test(brut) || code === "23514") {
      return table["23514"]
    }
    if (/failed to fetch|network/i.test(brut)) {
      return table.network
    }

    // 3. Préservation des messages explicites rédigés en français par nos triggers métier
    // (ex: "Le solde passerait à -100.00$", "La période est déjà close", "Le compte est clôturé")
    if (
      brut.includes("débiteur") ||
      brut.includes("solde") ||
      brut.includes("clos") ||
      brut.includes("clôturé") ||
      brut.includes("introuvable") ||
      brut.includes("obligatoire") ||
      brut.includes("invalide")
    ) {
      return brut
    }

    // 4. Si le message commence par une chaîne technique Postgres "PostgrestError: ..." ou "error: ...",
    // on ne la fuit pas, on utilise le repli générique.
    if (
      brut.includes("syntax error") ||
      brut.includes("column \"") ||
      brut.includes("relation \"") ||
      brut.includes("schema cache") ||
      brut.includes("table '") ||
      brut.includes("SELECT") ||
      brut.includes("INSERT") ||
      brut.includes("UPDATE")
    ) {
      return table.generic
    }

    if (brut && !/^[A-Z0-9_]+$/.test(brut)) {
      return brut
    }
  }

  return table.generic
}
