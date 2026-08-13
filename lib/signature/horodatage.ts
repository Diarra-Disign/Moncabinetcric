/**
 * Les dates et heures de signature, dans le fuseau qui compte.
 *
 * ─── POURQUOI PAS UN DÉCALAGE FIXE ─────────────────────────────────────────
 *
 * UTC−5 est juste quatre mois par an. Le reste du temps, l'Est canadien est à
 * UTC−4 : une signature apposée le 12 août à 22 h 14 s'imprimerait « 21 h 14 »
 * sur le certificat. Sur une pièce censée faire preuve de l'instant d'un
 * consentement, une heure fausse est pire qu'une heure absente.
 *
 * `Intl` connaît la règle de bascule et la fait évoluer avec les données de
 * fuseau du système. On lui donne le nom IANA et on le laisse trancher.
 *
 * ─── CE MODULE EST PUR ─────────────────────────────────────────────────────
 *
 * Aucun accès à la base, aucune dépendance au serveur : il s'éprouve seul, et
 * c'est nécessaire — une erreur de fuseau ne se voit pas à l'œil sur un PDF.
 */

export const FUSEAU = "America/Toronto"

/** Le libellé du fuseau tel qu'il s'imprime sur une pièce. */
export const FUSEAU_LISIBLE = "Heure de l'Est (America/Toronto)"

const valide = (v: string): Date | null => {
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * « 12 août 2026 » — la date seule, pour le bloc de signature du contrat.
 *
 * Elle est calculée DANS le fuseau : une signature apposée à 20 h 30 le 12 août
 * à Montréal est enregistrée le 13 août en temps universel. Sans conversion, le
 * contrat porterait le lendemain de la date où le client a signé.
 */
export function dateSignature(valeur: string, langue: "fr" | "en" = "fr"): string {
  const d = valide(valeur)
  if (!d) return ""
  return new Intl.DateTimeFormat(langue === "en" ? "en-CA" : "fr-CA", {
    timeZone: FUSEAU, day: "numeric", month: "long", year: "numeric",
  }).format(d)
}

/**
 * Heures et minutes dans le fuseau, en deux chiffres chacune.
 *
 * `fr-CA` rend « 22 h 14 » MÊME avec `hour12: false` : la typographie de
 * l'heure est une propriété de la locale, que ce drapeau ne gouverne pas — il
 * ne choisit qu'entre douze et vingt-quatre heures. Le certificat portait donc
 * une graphie que la fonction voisine `horodatage()` n'employait pas, sur la
 * même pièce et pour le même instant.
 *
 * Les deux fonctions assemblent désormais l'heure à partir des mêmes parties,
 * et la seule graphie possible est « 22:14 ».
 */
function partiesHeure(d: Date): { heure: string; minute: string; seconde: string } {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSEAU,
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(d)
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? ""
  return {
    // `hourCycle` h23 rend « 24 » à minuit sur certaines plateformes.
    heure: v("hour") === "24" ? "00" : v("hour"),
    minute: v("minute"),
    seconde: v("second"),
  }
}

/** « 22:14 » — l'heure seule, pour le certificat. */
export function heureSignature(valeur: string): string {
  const d = valide(valeur)
  if (!d) return ""
  const { heure, minute } = partiesHeure(d)
  return `${heure}:${minute}`
}

/**
 * « 2026-08-12 22:14:03 » — l'horodatage complet du journal.
 *
 * Format ISO pour la date, parce qu'une pièce lue par un tiers — IRCC, un
 * confrère, un tribunal — ne doit pas laisser hésiter entre le jour et le mois.
 */
export function horodatage(valeur: string): string {
  const d = valide(valeur)
  if (!d) return valeur
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSEAU, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(d)
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? ""
  const { heure, minute, seconde } = partiesHeure(d)
  return `${v("year")}-${v("month")}-${v("day")} ${heure}:${minute}:${seconde}`
}

/** L'abréviation en vigueur à cette date : EST l'hiver, EDT l'été. */
export function abreviationFuseau(valeur: string): string {
  const d = valide(valeur)
  if (!d) return ""
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSEAU, timeZoneName: "short",
  }).formatToParts(d)
  return p.find((x) => x.type === "timeZoneName")?.value ?? ""
}
