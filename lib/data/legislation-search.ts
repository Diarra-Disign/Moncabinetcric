import type { LegislationProvision } from "./types"

/**
 * Recherche dans la base légale.
 *
 * Un consultant tape une citation telle qu'il l'écrirait dans un mémoire :
 * « Art. 24 LIPR », « art 200 ripr », « L.38(1) ». La recherche initiale
 * comparait la requête entière à chaque champ, si bien que toute forme
 * citationnelle échouait — seul le numéro nu fonctionnait, et l'instrument
 * n'était pas indexé du tout.
 *
 * On découpe donc la requête en jetons, on écarte les mots de structure
 * citationnelle, et on exige que **tous** les jetons restants soient
 * présents. « Art. 24 LIPR » devient ainsi { "24", "lipr" }, deux
 * contraintes qui se cumulent au lieu de s'annuler.
 */

/**
 * Mots de structure d'une citation, sans valeur discriminante.
 * Volontairement restreint : on n'écarte que le vocabulaire de repérage,
 * jamais un terme de fond comme « loi », « permis » ou « interdiction »,
 * qui doit rester recherchable.
 */
const CITATION_NOISE = new Set([
  "art",
  "arts",
  "article",
  "articles",
  "s",
  "sec",
  "section",
  "sections",
  "para",
  "paragraphe",
  "paragraphs",
  "paragraph",
  "al",
  "alinea",
  "alineas",
])

/** Minuscules et suppression des diacritiques : « dépôt » trouve « depot ». */
export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

export function tokenizeQuery(query: string): string[] {
  return normalizeText(query)
    .split(/[\s,;/]+/)
    .map((token) => token.replace(/^[.\-–—()[\]]+|[.\-–—()[\]]+$/g, ""))
    .filter((token) => token.length > 0 && !CITATION_NOISE.has(token))
}

/** Champs indexés d'une disposition, concaténés et normalisés. */
function haystackOf(provision: LegislationProvision): string {
  return normalizeText(
    [
      provision.instrument,
      provision.provisionNo,
      provision.headingFr,
      provision.headingEn,
      provision.bodyFr,
      provision.bodyEn,
      provision.hierarchyPath ?? "",
      (provision.tags ?? []).join(" "),
    ].join(" | ")
  )
}

export function provisionMatches(provision: LegislationProvision, tokens: string[]): boolean {
  if (tokens.length === 0) return true
  const haystack = haystackOf(provision)
  return tokens.every((token) => haystack.includes(token))
}

/**
 * Priorité d'une disposition pour une requête donnée : plus le score est
 * bas, plus le résultat remonte.
 *
 * Sans ce classement, chercher « Art. 22 » plaçait l'article 20 en tête,
 * parce que son texte renvoie au paragraphe 22.1(1). Une correspondance
 * sur le numéro de la disposition elle-même doit primer sur une simple
 * mention dans le corps d'un autre article.
 */
export function relevanceRank(provision: LegislationProvision, tokens: string[]): number {
  const no = normalizeText(provision.provisionNo)
  const numeric = tokens.filter((t) => /^[0-9]/.test(t))
  if (numeric.length === 0) return 2

  // « 22 » doit viser 22(1), pas 122(1) ni une mention de 22.1 ailleurs.
  if (numeric.some((t) => no === t || no.startsWith(`${t}(`))) return 0
  if (numeric.some((t) => no.startsWith(t))) return 1
  return 2
}

export function searchProvisions(
  provisions: LegislationProvision[],
  query: string,
  instrumentFilter: string = "all"
): LegislationProvision[] {
  const tokens = tokenizeQuery(query)
  const matched = provisions.filter((provision) => {
    if (instrumentFilter !== "all" && provision.instrument !== instrumentFilter) return false
    return provisionMatches(provision, tokens)
  })

  if (tokens.length === 0) return matched

  // Tri stable : à pertinence égale, l'ordre d'origine est conservé.
  return matched
    .map((provision, index) => ({ provision, index, rank: relevanceRank(provision, tokens) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.provision)
}
