/**
 * Le calcul des créneaux libres d'un cabinet.
 *
 * Fonction PURE : on lui donne des plages, ce qui est déjà pris et l'instant
 * présent, elle rend une liste. Ni base, ni réseau, ni session — c'est ce qui
 * permet de l'éprouver sur les cas qui se trompent en silence, et ils sont
 * nombreux ici.
 *
 * ─── LE PIÈGE PRINCIPAL : L'HEURE D'ÉTÉ ────────────────────────────────────
 *
 * L'approche naturelle serait d'ajouter 86 400 000 millisecondes pour passer au
 * jour suivant. Elle est fausse deux fois par an : le dimanche du changement
 * d'heure ne dure pas vingt-quatre heures. Un « lundi 9 h » calculé ainsi
 * devient 8 h ou 10 h, et le client se présente avec une heure d'écart.
 *
 * On raisonne donc en DATES CIVILES — « le 7 septembre à 9 h 00 » — et on ne
 * convertit en instant absolu qu'à la fin, en demandant à `Intl` quel décalage
 * s'applique CE jour-là. C'est la seule façon correcte, et elle traverse aussi
 * les changements de règles décidés par les gouvernements.
 */

export interface Plage {
  /** 0 = dimanche, conforme à Date.getDay(). */
  weekday: number
  /** « 09:00 » */
  start: string
  /** « 17:00 » */
  end: string
}

export interface Occupation {
  debut: Date
  fin: Date
}

export interface Regles {
  dureeMinutes: number
  preavisHeures: number
  horizonJours: number
}

export interface Creneau {
  /** L'instant absolu, pour écrire en base. */
  debut: Date
  /** « 2026-09-07T14:30 » dans le fuseau du cabinet, pour l'affichage. */
  debutLocal: string
}

const FUSEAU = "America/Toronto"

/**
 * Le décalage du fuseau, en minutes, à un instant donné.
 *
 * Calculé en demandant à `Intl` de formater l'instant dans le fuseau visé,
 * puis en mesurant l'écart avec la même lecture en UTC. C'est la méthode qui
 * survit aux changements d'heure et aux réformes législatives, là où toute
 * constante écrite en dur finit par mentir.
 */
function decalageMinutes(instant: Date, fuseau: string): number {
  const lu = new Intl.DateTimeFormat("en-CA", {
    timeZone: fuseau, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(instant)
  const p = Object.fromEntries(lu.map((x) => [x.type, x.value])) as Record<string, string>
  const h = p.hour === "24" ? "00" : p.hour
  const commeUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +h, +p.minute, +p.second)
  return (commeUtc - instant.getTime()) / 60000
}

/**
 * L'instant absolu correspondant à une date civile dans le fuseau du cabinet.
 *
 * La double passe n'est pas une précaution superflue : le décalage dépend de
 * l'instant, et l'instant dépend du décalage. On estime, on mesure le décalage
 * réel à cette estimation, on corrige, puis on re-mesure — parce qu'une
 * correction peut faire franchir la frontière du changement d'heure.
 */
function instantLocal(annee: number, mois: number, jour: number, h: number, min: number): Date {
  const naif = Date.UTC(annee, mois - 1, jour, h, min, 0)
  let instant = new Date(naif - decalageMinutes(new Date(naif), FUSEAU) * 60000)
  instant = new Date(naif - decalageMinutes(instant, FUSEAU) * 60000)
  return instant
}

/** Les parties civiles d'un instant, dans le fuseau du cabinet. */
function partiesLocales(instant: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: FUSEAU, hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
    }).formatToParts(instant).map((x) => [x.type, x.value])
  ) as Record<string, string>
  return { annee: +p.year, mois: +p.month, jour: +p.day }
}

const JOURS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

/** Le jour de la semaine d'une date civile, sans passer par un fuseau. */
function jourDeLaSemaine(annee: number, mois: number, jour: number): number {
  return new Date(Date.UTC(annee, mois - 1, jour)).getUTCDay()
}

const enMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number)
  return (h || 0) * 60 + (m || 0)
}

const deuxChiffres = (n: number) => String(n).padStart(2, "0")

/**
 * Les créneaux qu'un client peut réellement réserver.
 *
 * Quatre filtres s'appliquent, et chacun répare une faute observable :
 *
 *   · le créneau tient ENTIÈREMENT dans la plage — sinon la rencontre déborde
 *     des heures que le consultant a déclarées ;
 *   · il respecte le préavis — sinon on réserve le consultant pour dans
 *     dix minutes ;
 *   · il reste dans l'horizon — sinon on prend rendez-vous dans deux ans ;
 *   · il ne CHEVAUCHE aucun rendez-vous — chevaucher, non « commencer
 *     pendant » : un rendez-vous de 90 minutes bloque trois créneaux de 30, et
 *     un créneau qui ne fait que succéder à un autre reste libre.
 */
export function creneauxLibres(opts: {
  plages: Plage[]
  occupations: Occupation[]
  regles: Regles
  maintenant: Date
}): Creneau[] {
  const { plages, occupations, regles, maintenant } = opts
  if (plages.length === 0) return []

  const duree = Math.max(1, regles.dureeMinutes)
  const plancher = maintenant.getTime() + regles.preavisHeures * 3600_000
  const plafond = maintenant.getTime() + regles.horizonJours * 86_400_000

  // Les plages rangées par jour de semaine : une lecture au lieu d'un filtre
  // par journée examinée.
  const parJour = new Map<number, Plage[]>()
  for (const p of plages) {
    const liste = parJour.get(p.weekday) ?? []
    liste.push(p)
    parJour.set(p.weekday, liste)
  }

  const creneaux: Creneau[] = []
  const depart = partiesLocales(maintenant)

  // On avance en JOURS CIVILS, jamais en millisecondes : c'est ce qui rend le
  // calcul juste au changement d'heure. `Date.UTC` gère les fins de mois, les
  // années bissextiles et la règle du siècle sans qu'on ait à y penser.
  for (let n = 0; n <= regles.horizonJours; n++) {
    const civil = new Date(Date.UTC(depart.annee, depart.mois - 1, depart.jour + n))
    const annee = civil.getUTCFullYear()
    const mois = civil.getUTCMonth() + 1
    const jour = civil.getUTCDate()

    const dossier = parJour.get(jourDeLaSemaine(annee, mois, jour))
    if (!dossier) continue

    for (const plage of dossier) {
      const debutMin = enMinutes(plage.start)
      const finMin = enMinutes(plage.end)

      // `+ duree <= finMin` et non `< finMin` : le créneau doit TENIR dans la
      // plage, pas seulement y commencer.
      for (let m = debutMin; m + duree <= finMin; m += duree) {
        const debut = instantLocal(annee, mois, jour, Math.floor(m / 60), m % 60)
        const t = debut.getTime()
        if (t < plancher || t > plafond) continue

        const fin = new Date(t + duree * 60_000)
        const pris = occupations.some(
          (o) => o.debut.getTime() < fin.getTime() && debut.getTime() < o.fin.getTime()
        )
        if (pris) continue

        creneaux.push({
          debut,
          debutLocal:
            `${annee}-${deuxChiffres(mois)}-${deuxChiffres(jour)}` +
            `T${deuxChiffres(Math.floor(m / 60))}:${deuxChiffres(m % 60)}`,
        })
      }
    }
  }

  // Les plages d'une même journée arrivent dans l'ordre où elles sont
  // déclarées, non dans l'ordre horaire : « 13 h 30-17 h » peut précéder
  // « 9 h-12 h ». Une liste de créneaux qui remonte le temps est illisible.
  creneaux.sort((a, b) => a.debut.getTime() - b.debut.getTime())
  return creneaux
}

/** Les créneaux regroupés par journée, pour l'affichage. */
export function parJournee(creneaux: Creneau[]): { jour: string; creneaux: Creneau[] }[] {
  const groupes = new Map<string, Creneau[]>()
  for (const c of creneaux) {
    const jour = c.debutLocal.slice(0, 10)
    const liste = groupes.get(jour) ?? []
    liste.push(c)
    groupes.set(jour, liste)
  }
  return [...groupes.entries()].map(([jour, liste]) => ({ jour, creneaux: liste }))
}

export { JOURS }
