/**
 * LES DEUX IDENTIFIANTS D'UN CLIENT.
 *
 * ─── L'INCIDENT ────────────────────────────────────────────────────────────
 *
 * `toClient()` expose `legacy_id || id` : l'identifiant hérité de l'import
 * quand il existe, l'identifiant technique sinon. Toute l'application, tous
 * ses liens et toutes ses URL manipulent donc l'une OU l'autre forme, selon
 * l'âge du client.
 *
 * Or plusieurs lectures ne filtraient que sur `legacy_id`. Les clients créés
 * dans l'application — qui n'ont pas d'identifiant hérité — étaient donc
 * introuvables : la fonction renvoyait « rien » au lieu de « pas trouvé »,
 * et les écrans en tiraient des conclusions fausses. C'est ainsi qu'un clic
 * sur un client ouvrait le dossier d'un autre : le client n'étant pas
 * reconnu, la page affichait la liste entière et en sélectionnait le premier.
 *
 * ─── POURQUOI CE N'EST PAS UN SIMPLE `.or()` ───────────────────────────────
 *
 * `clients.id` est de type uuid. Lui comparer un identifiant hérité
 * (« c-1786926682284 ») fait échouer la requête entière :
 * « invalid input syntax for type uuid ». La comparaison sur la colonne
 * technique n'est donc ajoutée QUE lorsque la valeur est un uuid.
 *
 * C'est aussi ce qui rend l'expression sûre : elle n'est construite qu'à
 * partir d'une valeur qui a passé le motif uuid, donc sans virgule ni
 * parenthèse qui pourrait déformer le filtre. Dans le cas contraire,
 * l'appelant utilise `.eq()`, où la valeur est transmise telle quelle.
 */

const MOTIF_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** L'identifiant est-il celui de la colonne technique `clients.id` ? */
export function estIdentifiantTechnique(id: string): boolean {
  return MOTIF_UUID.test(id)
}

/**
 * L'expression `or` qui reconnaît le client par l'une ou l'autre colonne, ou
 * `null` quand seule la colonne héritée peut être interrogée.
 */
export function expressionIdentifiantClient(id: string): string | null {
  if (!estIdentifiantTechnique(id)) return null
  return `legacy_id.eq.${id},id.eq.${id}`
}
