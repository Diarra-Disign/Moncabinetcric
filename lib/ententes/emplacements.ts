/**
 * Où signer sur le contrat.
 *
 * ─── LE GÉNÉRATEUR SAIT, LUI SEUL ──────────────────────────────────────────
 *
 * Le contrat dessine déjà un encadré par signataire, avec le nom imprimé, une
 * ligne pour la signature et une ligne pour la date. Personne d'autre ne sait
 * où ces encadrés tombent : la page dépend de la longueur des articles, et
 * l'ordonnée du contenu qui précède.
 *
 * Ce module donne la forme dans laquelle le générateur RESTITUE ces positions,
 * pour qu'on puisse plus tard y apposer une signature — au lieu d'en inventer
 * de nouvelles à la fin du document.
 *
 * ─── LE REPÈRE EST CELUI DU PDF ────────────────────────────────────────────
 *
 * Origine en bas à gauche, ordonnée croissant vers le haut, unité le point
 * typographique. C'est celui de pdf-lib, et le convertir ici ne ferait que
 * déplacer le risque d'erreur.
 *
 * ─── CE MODULE EST PUR ─────────────────────────────────────────────────────
 *
 * Des nombres et des chaînes. Il s'importe aussi bien du générateur de contrat
 * que du composeur du document signé, sans traîner ni base ni serveur.
 */

/** Un segment de ligne à remplir : son départ, sa longueur, sa hauteur de base. */
export interface LigneAPourvoir {
  x: number
  y: number
  largeur: number
}

export interface EmplacementSignature {
  /** Le rôle attendu dans cet encadré : « client », « consultant »… */
  role: string
  /** Le nom déjà imprimé dans l'encadré. Sert à rattacher le bon signataire. */
  nom: string
  /** Le permis imprimé, quand l'encadré est celui d'un consultant réglementé. */
  permis?: string
  /** Index de la page, à partir de 0. */
  page: number
  /** L'encadré lui-même, pour situer et pour vérifier qu'on reste dedans. */
  boite: { x: number; y: number; largeur: number; hauteur: number }
  /** La ligne où poser le tracé. */
  signature: LigneAPourvoir
  /** La ligne où écrire la date. */
  date: LigneAPourvoir
}

/**
 * Rattache chaque signataire à son encadré.
 *
 * ─── LE RÔLE D'ABORD, LE RANG ENSUITE ──────────────────────────────────────
 *
 * On apparie par rôle, parce que c'est ce que l'encadré annonce : « Pour le
 * client », « Pour le consultant ». Si deux encadrés portent le même rôle —
 * deux codemandeurs, par exemple — on prend le premier encore libre, dans
 * l'ordre des rangs.
 *
 * QUAND LE RÔLE NE CORRESPOND À RIEN, ON N'APPOSE PAS. Poser une signature
 * dans l'encadré d'autrui serait un faux : mieux vaut un contrat sans tracé,
 * accompagné d'un certificat qui prouve la signature, qu'un contrat où le
 * client semble avoir signé à la place du consultant.
 */
export function apparier<T extends { role: string; rang: number }>(
  signataires: T[],
  emplacements: EmplacementSignature[]
): Map<T, EmplacementSignature> {
  const paires = new Map<T, EmplacementSignature>()
  const libres = [...emplacements]

  for (const s of [...signataires].sort((a, b) => a.rang - b.rang)) {
    const i = libres.findIndex((e) => e.role === s.role)
    if (i === -1) continue
    paires.set(s, libres[i])
    libres.splice(i, 1)
  }

  return paires
}
