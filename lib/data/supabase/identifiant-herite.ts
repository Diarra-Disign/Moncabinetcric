/**
 * LES DEUX IDENTIFIANTS D'UN ENREGISTREMENT.
 *
 * Six entités exposent `legacy_id || id` : clients, prospects, factures,
 * documents, rendez-vous, journaux. L'identifiant hérité vient du modèle de
 * démonstration (« c-1786926682284 », « lead-1 ») ; l'identifiant technique
 * est la clé primaire uuid. L'interface manipule donc l'une OU l'autre forme,
 * selon l'âge de la ligne — et presque plus rien n'a d'identifiant hérité
 * aujourd'hui.
 *
 * ─── L'INCIDENT ────────────────────────────────────────────────────────────
 *
 * Plusieurs lectures ne filtraient que sur `legacy_id`. Les lignes créées
 * dans l'application étaient donc introuvables : la fonction renvoyait
 * « rien » au lieu de « pas trouvé », et les écrans en tiraient des
 * conclusions fausses. C'est ainsi qu'un clic sur un client ouvrait le
 * dossier d'un autre : le client n'étant pas reconnu, la page affichait la
 * liste entière et en sélectionnait le premier dossier.
 *
 * ─── POURQUOI CE N'EST PAS UN SIMPLE `or` SUR LES DEUX COLONNES ────────────
 *
 * `id` est de type uuid. Postgres doit convertir le littéral pour évaluer
 * `id = '...'`, et cette conversion échoue AVANT que le OR ne puisse
 * court-circuiter : la requête entière est rejetée — « invalid input syntax
 * for type uuid » — alors que la ligne existe sous son identifiant hérité.
 * La colonne technique n'est donc interrogée que si la valeur en a la forme.
 *
 * C'est aussi ce qui rend l'expression sûre : elle n'est construite qu'à
 * partir d'une valeur qui a passé le motif uuid, donc sans virgule ni
 * parenthèse qui pourrait déformer le filtre. Sinon, l'appelant utilise
 * `.eq()`, où la valeur est transmise telle quelle.
 *
 * ─── UN SEUL ENDROIT ───────────────────────────────────────────────────────
 *
 * Cette règle existait en double : une copie ici pour les lectures, une autre
 * dans `writes.ts` pour les écritures. Deux copies d'une même règle finissent
 * par diverger, et c'est précisément la divergence qui a produit le bug.
 */

const MOTIF_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** L'identifiant est-il celui de la colonne technique `id` ? */
export function estIdentifiantTechnique(id: string): boolean {
  return MOTIF_UUID.test(id)
}

/**
 * L'expression `or` qui reconnaît la ligne par l'une ou l'autre colonne, ou
 * `null` quand seule la colonne héritée peut être interrogée.
 */
export function expressionIdentifiantHerite(id: string): string | null {
  if (!estIdentifiantTechnique(id)) return null
  return `legacy_id.eq.${id},id.eq.${id}`
}
