/**
 * Les services que vend un cabinet.
 *
 * Ce fichier n'est PAS un module « use server », et c'est la raison de son
 * existence. Next.js n'autorise un module serveur à n'exporter que des
 * fonctions asynchrones : une constante y est transformée en mandataire
 * d'action, et le navigateur reçoit alors un objet sur lequel .map n'existe
 * pas. L'erreur ne se voit qu'à l'exécution, dans la console du client.
 */
export const TYPES_DE_DOSSIER = [
  "Consultation",
  "Permis d'études",
  "Permis de travail",
  "Visa visiteur",
  "Super Visa",
  "Parrainage",
  "Résidence permanente",
  "Entrée express",
  "EIMT",
  "Autre",
] as const
