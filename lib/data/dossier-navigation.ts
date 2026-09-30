import type { Matter } from "./types"

/**
 * OÙ MÈNE LE CLIC SUR UN CLIENT.
 *
 * ─── CE QUI SE PASSAIT AVANT ───────────────────────────────────────────────
 *
 * La liste des clients cherchait le premier dossier portant l'identifiant du
 * client et, faute de correspondance, poussait vers `/matters` — la liste
 * générale des dossiers. Cette liste sélectionne d'office son premier
 * dossier : le consultant croyait ouvrir le dossier de son client et lisait
 * celui d'un autre, sans que rien ne le signale.
 *
 * Le repli n'était pas un cas limite : sur les données réelles, quatre
 * clients sur sept n'ont aucun dossier rattaché.
 *
 * ─── LA RÈGLE ──────────────────────────────────────────────────────────────
 *
 * L'identifiant du client voyage TOUJOURS jusqu'à la destination. Un dossier
 * n'est ouvert directement que lorsqu'il n'y a aucune ambiguïté — un seul
 * dossier rattaché. Sinon, c'est la liste des dossiers DE CE CLIENT qui
 * s'affiche : aucun, ou plusieurs à départager, mais jamais celui d'un tiers.
 *
 * La fonction est pure et vit dans la couche de données parce que c'est elle
 * qui connaît la forme d'un `Matter` ; la liste des clients ne fait que
 * l'appliquer.
 */
export type DestinationDossier =
  /** Un seul dossier rattaché : on l'ouvre. `reference` est sans dièse. */
  | { type: "dossier"; reference: string }
  /** Aucun dossier, ou plusieurs : la liste filtrée sur ce client. */
  | { type: "dossiers-du-client"; clientId: string }

/** Les dossiers rattachés à ce client, dans l'ordre reçu. */
export function dossiersDuClient(clientId: string, dossiers: readonly Matter[]): Matter[] {
  // Un dossier sans client (`clientId` absent) n'appartient à personne : il ne
  // doit jamais être capté par une comparaison laxiste.
  return dossiers.filter((d) => Boolean(d.clientId) && d.clientId === clientId)
}

export function destinationPourClient(
  clientId: string,
  dossiers: readonly Matter[]
): DestinationDossier {
  const rattaches = dossiersDuClient(clientId, dossiers)
  if (rattaches.length === 1) {
    return { type: "dossier", reference: referenceNue(rattaches[0].id) }
  }
  return { type: "dossiers-du-client", clientId }
}

/**
 * L'adresse correspondante.
 *
 * `/matters?client=…` plutôt qu'un segment de chemin : la liste des dossiers
 * existe déjà à `/matters`, et un paramètre la restreint sans créer de route
 * parallèle. Comme il est dans l'URL, il survit à une actualisation et à un
 * accès direct.
 */
export function cheminDestination(destination: DestinationDossier): string {
  if (destination.type === "dossier") return `/matters/${destination.reference}`
  return `/matters?client=${encodeURIComponent(destination.clientId)}`
}

/** « #DOS-35695 » et « DOS-35695 » désignent le même dossier dans les URL. */
export function referenceNue(reference: string): string {
  return reference.replace("#", "")
}
