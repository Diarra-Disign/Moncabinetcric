/**
 * L'échéancier des paiements : le composer, l'équilibrer, le dire.
 *
 * Module PUR — ni « server-only », ni accès base. L'éditeur du brouillon
 * calcule dans le navigateur pour répondre à chaque frappe ; le serveur
 * recalcule avant d'écrire, parce qu'il reste appelable sans l'écran. Deux
 * implémentations auraient fini par accepter d'un côté ce que l'autre refuse —
 * et l'écart porterait sur des montants que le client paie.
 *
 * TROIS DÉCISIONS QUI EXPLIQUENT LA FORME DE CE FICHIER.
 *
 * 1. LE MONTANT EST TOUJOURS STOCKÉ, MÊME QUAND LE CONSULTANT A SAISI UN
 *    POURCENTAGE. Un pourcentage relu et recalculé plus tard sur des
 *    honoraires modifiés changerait un contrat déjà signé. On garde la base de
 *    saisie pour pouvoir la réafficher, mais c'est le montant qui fait foi.
 *
 * 2. TOUT EST EN CENTIMES pour la répartition. 33,33 % de 100 $ trois fois
 *    donne 99,99 $ en virgule flottante ; l'écart d'un cent se voit sur un
 *    contrat et fait douter de tout le reste.
 *
 * 3. L'ÉCART EST RENDU, PAS CORRIGÉ. Le §9 demande d'AFFICHER « montant
 *    restant à répartir », pas d'ajuster silencieusement la dernière étape :
 *    un ajustement automatique modifierait un chiffre que le consultant a
 *    écrit, et il signerait sans s'en apercevoir.
 */

export type BasePaiement = "montant" | "pourcentage"

/** Les statuts d'une étape (§28). Portés dès maintenant, exploités plus tard. */
export const STATUTS_ETAPE = [
  "a_venir", "a_facturer", "facture", "partiellement_paye", "paye", "en_retard",
] as const
export type StatutEtape = (typeof STATUTS_ETAPE)[number]

export const LIBELLE_STATUT: Record<StatutEtape, string> = {
  a_venir: "À venir",
  a_facturer: "À facturer",
  facture: "Facturé",
  partiellement_paye: "Partiellement payé",
  paye: "Payé",
  en_retard: "En retard",
}

/**
 * Les modes de paiement offerts (§11).
 *
 * Ils reprennent EXACTEMENT le vocabulaire de `payments.method`, déjà employé
 * par les reçus et le registre de fidéicommis. Une seconde liste aurait
 * produit « Interac » ici et « interac » là, et le rapprochement n'aurait plus
 * su relier un paiement à son étape.
 */
export const MODES_PAIEMENT: { valeur: string; fr: string; en: string }[] = [
  { valeur: "interac", fr: "Virement Interac", en: "Interac transfer" },
  { valeur: "bank_transfer", fr: "Virement bancaire", en: "Bank transfer" },
  { valeur: "card", fr: "Carte de crédit", en: "Credit card" },
  { valeur: "cheque", fr: "Chèque", en: "Cheque" },
  { valeur: "cash", fr: "Comptant", en: "Cash" },
  { valeur: "other", fr: "Autre", en: "Other" },
]

export const libelleMode = (valeur: string, locale = "fr"): string => {
  const m = MODES_PAIEMENT.find((x) => x.valeur === valeur)
  return m ? (locale === "en" ? m.en : m.fr) : valeur
}

export interface EtapePaiement {
  position: number
  description: string
  /** Ce qui déclenche l'exigibilité — « À la signature », « Dossier complet ». */
  declenchement?: string
  /** Mode propre à cette étape (§12). Vide : les modes du contrat s'appliquent. */
  mode?: string
  /** Ce que le consultant a SAISI : un montant, ou un pourcentage. */
  base: BasePaiement
  /** Toujours renseigné, calculé quand la base est un pourcentage. */
  montant: number
  /** Renseigné seulement quand la base est « pourcentage ». */
  pourcentage?: number
  datePrevue?: string
  note?: string
  statut?: StatutEtape
}

const cents = (v: number) => Math.round((Number(v) || 0) * 100)
const dollars = (c: number) => c / 100

/**
 * Recalcule les montants d'un échéancier à partir des honoraires.
 *
 * Une étape en POURCENTAGE voit son montant refait ; une étape en MONTANT est
 * laissée telle quelle. C'est le sens du §8 : le consultant choisit, pour
 * CHAQUE étape, laquelle des deux valeurs il tient.
 */
export function recalculer(etapes: EtapePaiement[], honoraires: number): EtapePaiement[] {
  const base = cents(honoraires)
  return etapes.map((e) =>
    e.base === "pourcentage"
      ? { ...e, montant: dollars(Math.round((base * (Number(e.pourcentage) || 0)) / 100)) }
      : { ...e, montant: Number(e.montant) || 0 }
  )
}

export interface EtatEcheancier {
  /** Somme des étapes. */
  reparti: number
  /** Honoraires moins la somme. Positif : il reste à répartir. */
  reste: number
  equilibre: boolean
  /** Vide quand l'échéancier est équilibré ou absent. */
  message: string
}

/**
 * L'état de l'échéancier, dit en français (§9).
 *
 * Un échéancier VIDE n'est pas un déséquilibre : un contrat peut prévoir un
 * paiement unique et ne rien échelonner. C'est l'échéancier COMMENCÉ mais
 * incomplet qui est un défaut — et c'est celui-là qu'on nomme.
 */
export function etatEcheancier(etapes: EtapePaiement[], honoraires: number): EtatEcheancier {
  const total = cents(honoraires)
  const somme = etapes.reduce((t, e) => t + cents(e.montant), 0)
  const reste = total - somme

  if (etapes.length === 0) {
    return { reparti: 0, reste: dollars(total), equilibre: true, message: "" }
  }
  if (reste === 0) {
    return { reparti: dollars(somme), reste: 0, equilibre: true, message: "Échéancier équilibré." }
  }

  const argent = (c: number) =>
    new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" })
      .format(dollars(Math.abs(c)))
      .replace(/[\u00A0\u202F]/g, " ")

  return {
    reparti: dollars(somme),
    reste: dollars(reste),
    equilibre: false,
    message:
      reste > 0
        ? `L'échéancier ne couvre pas la totalité des honoraires. Montant restant à répartir : ${argent(reste)}.`
        : `L'échéancier dépasse les honoraires de ${argent(reste)}.`,
  }
}

/**
 * Répartit un montant en parts égales, au cent près.
 *
 * Le reliquat est donné à la PREMIÈRE étape et non à la dernière : c'est celle
 * qu'on encaisse à la signature, donc celle dont le montant est le plus
 * souvent négocié en nombre rond. Mieux vaut 1 000,01 $ à la signature que
 * 999,99 $ au dernier versement, qu'on relira des mois plus tard sans
 * comprendre d'où vient le cent.
 */
export function repartirEnParts(honoraires: number, parts: number): number[] {
  if (parts <= 0) return []
  const total = cents(honoraires)
  const base = Math.floor(total / parts)
  const reste = total - base * parts
  return Array.from({ length: parts }, (_, i) => dollars(base + (i === 0 ? reste : 0)))
}

/**
 * Ce qui empêche d'émettre un contrat dont l'échéancier est incohérent.
 *
 * Volontairement TOLÉRANT sur la forme et STRICT sur les nombres : une étape
 * sans description est rattrapable à la lecture, une étape à zéro dollar ne
 * l'est pas — elle laisse croire à un versement qui n'existe pas.
 */
export function verifierEcheancier(
  etapes: EtapePaiement[],
  honoraires: number,
  proBono = false
): string[] {
  // Pro bono : l'absence d'échéancier est le propos du contrat (§21).
  if (proBono) return []
  if (etapes.length === 0) return []

  const manques: string[] = []
  etapes.forEach((e, i) => {
    const rang = i + 1
    if (!(e.description ?? "").trim()) {
      manques.push(`L'étape ${rang} n'a pas de description.`)
    }
    if (cents(e.montant) <= 0) {
      manques.push(`L'étape ${rang} n'a aucun montant.`)
    }
  })

  const etat = etatEcheancier(etapes, honoraires)
  if (!etat.equilibre) manques.push(etat.message)

  return manques
}
