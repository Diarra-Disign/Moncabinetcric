/**
 * Numérotation dynamique des articles d'entente.
 *
 * Lorsqu'un consultant coche ou décoche des clauses d'un contrat,
 * la numérotation des articles actifs (« ARTICLE 1 », « ARTICLE 2 », etc.)
 * et de leurs alinéas internes (« 1.1 », « 1.2 », etc.) doit rester continue
 * et séquentielle sans saut de numéro.
 */

export interface ArticleNum {
  code: string
  titleFr: string
  bodyFr: string
  level?: string
  enabled: boolean
  position?: number
}

/**
 * Extrait le numéro d'article présent dans le titre (ex: "ARTICLE 5 — ..." -> 5, "5. ..." -> 5).
 */
export function extraireNumeroTitre(titre: string): number | null {
  const matchArt = titre.match(/^ARTICLE\s+(\d+)/i)
  if (matchArt) return parseInt(matchArt[1], 10)

  const matchNum = titre.match(/^(\d+)[\.\)]\s+/)
  if (matchNum) return parseInt(matchNum[1], 10)

  return null
}

/**
 * Réécrit le titre de l'article avec son nouveau numéro séquentiel.
 */
export function renumeroterTitre(titre: string, nouveauNumero: number): string {
  if (/^ARTICLE\s+\d+\s*—/i.test(titre)) {
    return titre.replace(/^ARTICLE\s+\d+\s*—/i, `ARTICLE ${nouveauNumero} —`)
  }
  if (/^ARTICLE\s+\d+[\s\.:]/i.test(titre)) {
    return titre.replace(/^ARTICLE\s+\d+/i, `ARTICLE ${nouveauNumero}`)
  }
  if (/^\d+[\.\)]\s+/.test(titre)) {
    return titre.replace(/^\d+[\.\)]\s+/, `${nouveauNumero}. `)
  }
  return `ARTICLE ${nouveauNumero} — ${titre}`
}

/**
 * Met à jour les sous-alinéas dans le corps (ex: "5.1", "5.2" -> "4.1", "4.2").
 */
export function renumeroterCorps(
  corps: string,
  ancienNumero: number | null,
  nouveauNumero: number
): string {
  if (!ancienNumero || ancienNumero === nouveauNumero) return corps

  // Remplace les alinéas en début de ligne ou après saut de ligne (ex: "5.1 ...", "5.2 ...")
  const regexLigne = new RegExp(`(^|\\n)(${ancienNumero})\\.(\\d+)`, "g")
  return corps.replace(regexLigne, `$1${nouveauNumero}.$3`)
}

/**
 * Calcule les articles avec leurs titres et corps rééchelonnés selon l'état `enabled`.
 */
export function renumeroterArticles<T extends ArticleNum>(articles: T[]): T[] {
  let compteurActif = 0

  return articles.map((art) => {
    const ancienNum = extraireNumeroTitre(art.titleFr)

    if (!art.enabled) {
      return {
        ...art,
      }
    }

    compteurActif += 1
    const nouveauNum = compteurActif
    const nouveauTitre = renumeroterTitre(art.titleFr, nouveauNum)
    const nouveauCorps = renumeroterCorps(art.bodyFr, ancienNum, nouveauNum)

    return {
      ...art,
      position: nouveauNum * 10,
      titleFr: nouveauTitre,
      bodyFr: nouveauCorps,
    }
  })
}
