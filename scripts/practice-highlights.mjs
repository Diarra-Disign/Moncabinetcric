/**
 * Dispositions d'usage fréquent en pratique CICC.
 *
 * IMPORTANT — ceci est une sélection éditoriale, pas une affirmation
 * juridique. Elle indique ce qu'un cabinet consulte le plus souvent ; elle
 * ne dit ni qu'une disposition prime sur une autre, ni que la liste est
 * exhaustive. Le corpus complet reste accessible par la recherche.
 *
 * L'ordre ci-dessous est l'ordre d'affichage par défaut : il suit le
 * déroulé d'un dossier plutôt que la numérotation, et alterne LIPR et RIPR
 * par thème — sans quoi les 218 articles de la LIPR masqueraient
 * entièrement les 400 du RIPR.
 *
 * `area` alimente les étiquettes affichées sur chaque fiche.
 */
export const PRACTICE_HIGHLIGHTS = [
  // Constitution et recevabilité de la demande
  { instrument: "lipr", no: "11", area: "Demande et recevabilité" },
  { instrument: "lipr", no: "16", area: "Demande et recevabilité" },
  { instrument: "ripr", no: "10", area: "Demande et recevabilité" },
  { instrument: "ripr", no: "11", area: "Demande et recevabilité" },
  { instrument: "ripr", no: "12", area: "Demande et recevabilité" },

  // Entrée au Canada et acquisition du statut
  { instrument: "lipr", no: "20", area: "Entrée et statut" },
  { instrument: "lipr", no: "21", area: "Entrée et statut" },
  { instrument: "lipr", no: "22", area: "Entrée et statut" },
  { instrument: "lipr", no: "29", area: "Entrée et statut" },
  { instrument: "ripr", no: "28", area: "Entrée et statut" },
  { instrument: "ripr", no: "51", area: "Entrée et statut" },

  // Obligation de résidence du résident permanent
  { instrument: "lipr", no: "28", area: "Obligation de résidence" },
  { instrument: "ripr", no: "61", area: "Obligation de résidence" },

  // Catégories de sélection — l'article 12 LIPR couvre les trois
  // (regroupement familial, immigration économique, réfugiés).
  { instrument: "lipr", no: "12", area: "Catégories de sélection" },

  // Immigration économique
  { instrument: "ripr", no: "70", area: "Immigration économique" },
  { instrument: "ripr", no: "72", area: "Immigration économique" },
  { instrument: "ripr", no: "75", area: "Immigration économique" },
  { instrument: "ripr", no: "76", area: "Immigration économique" },
  { instrument: "ripr", no: "87.1", area: "Immigration économique" },
  { instrument: "ripr", no: "87.2", area: "Immigration économique" },

  // Regroupement familial et parrainage
  { instrument: "ripr", no: "4", area: "Regroupement familial" },
  { instrument: "ripr", no: "117", area: "Regroupement familial" },
  { instrument: "ripr", no: "120", area: "Regroupement familial" },
  { instrument: "ripr", no: "125", area: "Regroupement familial" },
  { instrument: "ripr", no: "133", area: "Regroupement familial" },

  // Résidence temporaire
  { instrument: "ripr", no: "179", area: "Résidence temporaire" },
  { instrument: "ripr", no: "183", area: "Résidence temporaire" },

  // Travail
  { instrument: "lipr", no: "30", area: "Travail" },
  { instrument: "ripr", no: "186", area: "Travail" },
  { instrument: "ripr", no: "196", area: "Travail" },
  { instrument: "ripr", no: "200", area: "Travail" },
  { instrument: "ripr", no: "203", area: "Travail" },
  { instrument: "ripr", no: "205", area: "Travail" },

  // Études
  { instrument: "ripr", no: "188", area: "Études" },
  { instrument: "ripr", no: "216", area: "Études" },
  { instrument: "ripr", no: "220", area: "Études" },

  // Interdictions de territoire
  { instrument: "lipr", no: "34", area: "Interdictions de territoire" },
  { instrument: "lipr", no: "35", area: "Interdictions de territoire" },
  { instrument: "lipr", no: "36", area: "Interdictions de territoire" },
  { instrument: "lipr", no: "37", area: "Interdictions de territoire" },
  { instrument: "lipr", no: "38", area: "Interdictions de territoire" },
  { instrument: "lipr", no: "39", area: "Interdictions de territoire" },
  { instrument: "lipr", no: "40", area: "Interdictions de territoire" },
  { instrument: "lipr", no: "41", area: "Interdictions de territoire" },
  { instrument: "lipr", no: "42", area: "Interdictions de territoire" },
  { instrument: "lipr", no: "44", area: "Interdictions de territoire" },

  // Mesures discrétionnaires
  { instrument: "lipr", no: "24", area: "Mesures discrétionnaires" },
  { instrument: "lipr", no: "25", area: "Mesures discrétionnaires" },

  // Recours
  { instrument: "lipr", no: "63", area: "Recours" },
  { instrument: "lipr", no: "67", area: "Recours" },
  { instrument: "lipr", no: "72", area: "Recours" },

  // Protection
  { instrument: "lipr", no: "96", area: "Protection" },
  { instrument: "lipr", no: "97", area: "Protection" },
  { instrument: "lipr", no: "112", area: "Protection" },
]
