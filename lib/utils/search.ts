/**
 * Recherche sur des personnes.
 *
 * Deux exigences que la comparaison naïve ne satisfait pas.
 *
 * Les accents : dans une clientèle d'immigration, les noms en portent
 * beaucoup et sont souvent saisis sans. « Genevieve » doit trouver
 * « Geneviève », et « Nguyen » trouver « Nguyễn ».
 *
 * Les numéros de téléphone : « 438 921-2020 », « 4389212020 » et
 * « (438) 921-2020 » désignent la même ligne. On compare donc aussi les
 * suites de chiffres, séparateurs retirés.
 */

/** Minuscules, sans diacritiques. */
export function normalizeSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

/** Ne conserve que les chiffres : sert à comparer des numéros. */
function digitsOnly(value: string): string {
  return value.replace(/\D+/g, "")
}

/**
 * Vrai si la requête correspond à l'un des champs fournis.
 *
 * Les champs vides ou absents sont ignorés, ce qui évite qu'une fiche
 * incomplète devienne introuvable.
 */
export function matchesPerson(query: string, fields: (string | undefined | null)[]): boolean {
  const q = normalizeSearch(query.trim())
  if (q === "") return true

  const presents = fields.filter((f): f is string => typeof f === "string" && f.trim() !== "")

  if (presents.some((f) => normalizeSearch(f).includes(q))) return true

  // Comparaison numérique : utile dès que la requête contient des chiffres.
  const qDigits = digitsOnly(q)
  if (qDigits.length >= 3) {
    return presents.some((f) => {
      const d = digitsOnly(f)
      return d.length >= 3 && d.includes(qDigits)
    })
  }

  return false
}
