/**
 * Le catalogue des services du cabinet — une seule liste pour tout le logiciel.
 *
 * POURQUOI CE FICHIER EXISTE. Il y avait DEUX listes, et elles ne disaient pas
 * la même chose. Le pipeline proposait « Résidence Permanente (Entrée
 * Express) » ; la fenêtre « Nouvelle Fiche Client » proposait « Résidence
 * Permanente (PEQ / Entrée Express) », quatre choix contre quatorze. Le même
 * service était donc enregistré sous deux chaînes différentes selon l'écran
 * qui avait créé la fiche — et rien ne les rapprochait ensuite.
 *
 * Ce n'est pas un défaut d'affichage : le nom du programme sert à retrouver la
 * liste de pièces à réclamer au client. Deux orthographes, deux listes de
 * pièces, pour un même mandat.
 *
 * Les valeurs retenues sont celles du pipeline : elles étaient les plus
 * complètes, et surtout ce sont elles qui sont DÉJÀ EN BASE. Changer les
 * libellés du pipeline aurait renommé des prospects existants.
 *
 * defaultPrice sert au pipeline pour proposer une valeur estimée. Il n'est pas
 * un tarif facturé — celui-là vit dans les Paramètres du cabinet.
 */

export const PROGRAM_GROUPS = [
  {
    label: "Information & Renseignements",
    options: [
      { value: "Renseignements Généraux Cabinet", label: "Renseignements Généraux sur le Cabinet", defaultPrice: 0 },
      { value: "Consultation Initiale d'Évaluation", label: "Consultation Initiale d'Évaluation (Payante)", defaultPrice: 150 },
      { value: "Analyse de Refus & Conseils IRCC", label: "Analyse d'un Refus IRCC & Recommandations", defaultPrice: 500 },
    ]
  },
  {
    label: "Résidence Permanente (IRCC / MIFI)",
    options: [
      { value: "Résidence Permanente (Entrée Express)", label: "Entrée Express (FSW / CEC / FST)", defaultPrice: 4500 },
      { value: "PEQ - Expérience Québécoise", label: "PEQ - Programme de l'Expérience Québécoise", defaultPrice: 4200 },
      { value: "PRTQ - Travailleurs Qualifiés Québec", label: "PRTQ - Travailleurs Qualifiés Québec (MIFI)", defaultPrice: 4200 },
      { value: "Parrainage d'Époux / Conjoint / Famille", label: "Parrainage Familial (Conjoint / Enfants)", defaultPrice: 3800 },
      { value: "Programme Régional / PNP", label: "Programme des Candidats des Provinces (PCP/PNP)", defaultPrice: 4800 },
    ]
  },
  {
    label: "Résidence Temporaire (Visas & Permis)",
    options: [
      { value: "Permis d'Études & CAQ", label: "Permis d'Études & CAQ Québec", defaultPrice: 2500 },
      { value: "EIMT / Permis de Travail (LMIA)", label: "EIMT & Permis de Travail (LMIA)", defaultPrice: 4500 },
      { value: "Visa de Visiteur / AVE / Super Visa", label: "Visa de Visiteur / AVE / Super Visa Parents", defaultPrice: 1800 },
      { value: "Prolongation de Statut / Rétablissement", label: "Prolongation de Statut ou Rétablissement", defaultPrice: 1500 },
    ]
  },
  {
    label: "Services aux Employeurs (B2B)",
    options: [
      { value: "EIMT - Recrutement International", label: "EIMT Volet Haute-Basse Rémunération", defaultPrice: 6500 },
      { value: "Conformité Employeur IRCC", label: "Audit de Conformité Employeur & Inspection IRCC", defaultPrice: 3500 },
    ]
  }
]
