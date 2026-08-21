/**
 * La relève des rendez-vous chez Calendly.
 *
 * ─── POURQUOI ON DEMANDE, AU LIEU D'ÊTRE PRÉVENU ───────────────────────────
 *
 * La voie normale serait un webhook. Elle est fermée : les webhooks Calendly
 * exigent un abonnement payant, et le cabinet est au forfait gratuit. Mais la
 * documentation de Calendly dit deux fois, en deux pages, que l'API de LECTURE
 * reste ouverte à tous les forfaits — seuls trois points d'accès sont réservés
 * à Enterprise, et lister les rendez-vous n'en fait pas partie.
 *
 * Ce module interroge donc, au lieu d'attendre.
 *
 * ─── CE FICHIER NE TOUCHE NI À LA BASE NI À LA SESSION ─────────────────────
 *
 * Les trois fonctions du haut sont pures : on leur donne un événement, un
 * participant et une liste de fiches, elles rendent une ligne. Elles s'éprouvent
 * sans réseau ni base — et c'est là que vivent les décisions qui se trompent
 * silencieusement, à commencer par le fuseau horaire.
 */

export interface EvenementCalendly {
  uri: string
  name?: string
  status: string
  start_time: string
  end_time: string
  location?: { type?: string; join_url?: string; location?: string } | null
}

export interface ParticipantCalendly {
  name?: string
  email: string
  timezone?: string
  questions_and_answers?: { question: string; answer: string }[]
}

export interface FicheClient {
  id: string
  name: string
  email?: string | null
}

export interface LigneCalendrier {
  source: "calendly"
  external_id: string
  title: string
  client_id: string | null
  client_name: string
  status: "confirmed" | "cancelled"
  platform: string | null
  link: string | null
  date: string
  time: string
  hour: number
  duration_minutes: number
  notes: string | null
  type: string
}

/**
 * Ce que devient un état Calendly chez nous.
 *
 * Un état inconnu compte pour ANNULÉ, non pour confirmé. Calendly peut en
 * ajouter un demain ; confirmer par défaut afficherait au consultant un
 * rendez-vous qui n'a peut-être plus lieu, et c'est la faute qui coûte cher —
 * on se déplace pour rien, ou on laisse un client devant une porte fermée.
 */
export function statutDepuisCalendly(etat: string): "confirmed" | "cancelled" {
  return etat === "active" ? "confirmed" : "cancelled"
}

/**
 * La fiche client correspondant à ce courriel, s'il y en a une.
 *
 * Comparaison en minuscules et sans espaces de bord : Calendly rend l'adresse
 * telle que le client l'a tapée, majuscules comprises.
 *
 * Le garde-fou qui compte est `if (!cible) return null` : sans lui, un
 * participant sans courriel apparierait la première fiche dépourvue d'adresse,
 * et le rendez-vous d'un inconnu s'accrocherait au dossier de quelqu'un
 * d'autre.
 */
export function apparierClient(fiches: FicheClient[], courriel: string): FicheClient | null {
  const cible = (courriel ?? "").trim().toLowerCase()
  if (!cible) return null
  return fiches.find((f) => (f.email ?? "").trim().toLowerCase() === cible) ?? null
}

/**
 * Les parties d'un instant, lues DANS LE FUSEAU DU CABINET.
 *
 * Calendly rend ses horaires en UTC. À Gatineau, un rendez-vous de 22 h le
 * 15 septembre s'écrit « 2026-09-16T02:00Z » : la date UTC est celle du
 * LENDEMAIN. Prendre les composantes UTC daterait ce rendez-vous du 16, et le
 * consultant le chercherait le mauvais jour.
 *
 * `Intl.DateTimeFormat` fait la conversion correctement, y compris à travers
 * les changements d'heure — que l'arithmétique à la main manque toujours.
 */
function partiesLocales(iso: string, fuseau: string) {
  const parties = new Intl.DateTimeFormat("en-CA", {
    timeZone: fuseau,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(iso))

  const p = Object.fromEntries(parties.map((x) => [x.type, x.value])) as Record<string, string>
  // `hour12: false` peut rendre « 24 » pour minuit selon la plateforme.
  const heure = p.hour === "24" ? "00" : p.hour
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    time: `${heure}:${p.minute}`,
    hour: Number(heure),
  }
}

/** Le dernier segment de l'URI Calendly — son identifiant stable. */
function identifiant(uri: string): string {
  return (uri ?? "").split("/").filter(Boolean).pop() ?? uri
}

/**
 * Un événement Calendly, converti en ligne de `calendar_events`.
 *
 * Chaque repli existe pour un cas observable : Calendly rend des événements
 * sans lieu, et des participants qui n'ont pas donné leur nom. Un rendez-vous
 * sans lien reste un rendez-vous — la relève ne doit pas s'interrompre pour si
 * peu, sinon un seul événement mal formé ferait manquer tous les suivants.
 */
export function convertirEvenement(
  evenement: EvenementCalendly,
  participant: ParticipantCalendly,
  fiche: { id: string; name: string } | null,
  fuseau: string
): LigneCalendrier {
  const { date, time, hour } = partiesLocales(evenement.start_time, fuseau)

  const debut = new Date(evenement.start_time).getTime()
  const fin = new Date(evenement.end_time).getTime()
  const minutes = Number.isFinite(debut) && Number.isFinite(fin) && fin > debut
    ? Math.round((fin - debut) / 60000)
    : 60

  const courriel = (participant.email ?? "").trim()
  const nom = (participant.name ?? "").trim() || courriel || "Sans nom"

  return {
    source: "calendly",
    external_id: identifiant(evenement.uri),
    title: (evenement.name ?? "").trim() || "Rendez-vous",
    client_id: fiche?.id ?? null,
    client_name: fiche?.name ?? nom,
    status: statutDepuisCalendly(evenement.status),
    platform: evenement.location?.type?.trim() || null,
    link: evenement.location?.join_url?.trim() || null,
    date,
    time,
    hour,
    duration_minutes: minutes,
    // Le courriel reste consultable : c'est par lui que le consultant
    // rattachera lui-même le rendez-vous à une fiche s'il décide d'en créer une.
    notes: courriel ? `Réservé sur Calendly — ${courriel}` : "Réservé sur Calendly",
    type: "consultation",
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Le client d'API. À partir d'ici, il y a du réseau.
// ───────────────────────────────────────────────────────────────────────────

const RACINE = "https://api.calendly.com"

export interface ReponseCalendly<T> {
  ok: boolean
  donnees?: T
  erreur?: string
}

/**
 * Un appel à Calendly.
 *
 * L'erreur est RETOURNÉE, jamais levée. Ce module est appelé au chargement du
 * calendrier : une exception y ferait échouer la page entière parce qu'un
 * service tiers est en panne. Le calendrier doit s'ouvrir sur les données déjà
 * en base, quoi qu'il arrive chez Calendly.
 */
async function appeler<T>(chemin: string, jeton: string): Promise<ReponseCalendly<T>> {
  try {
    const reponse = await fetch(`${RACINE}${chemin}`, {
      headers: { Authorization: `Bearer ${jeton}`, "Content-Type": "application/json" },
      // Une relève ne doit jamais retenir une page. Au-delà de dix secondes,
      // on abandonne et on réessaiera à la prochaine ouverture.
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    })

    if (reponse.status === 401 || reponse.status === 403) {
      return { ok: false, erreur: "Jeton Calendly refusé. Il a peut-être été révoqué ou expiré." }
    }
    if (reponse.status === 429) {
      return { ok: false, erreur: "Calendly limite temporairement les appels. Réessayez dans quelques minutes." }
    }
    if (!reponse.ok) {
      return { ok: false, erreur: `Calendly a répondu ${reponse.status}.` }
    }

    return { ok: true, donnees: (await reponse.json()) as T }
  } catch (e) {
    const nom = e instanceof Error ? e.name : ""
    if (nom === "TimeoutError" || nom === "AbortError") {
      return { ok: false, erreur: "Calendly n'a pas répondu à temps." }
    }
    return { ok: false, erreur: "Impossible de joindre Calendly." }
  }
}

/**
 * L'URI du compte, et la preuve que le jeton fonctionne.
 *
 * Appelée AVANT d'enregistrer un jeton : un jeton refusé n'est jamais écrit en
 * base. Sans ce contrôle, une faute de copier-coller s'enregistrerait sans
 * bruit et le calendrier cesserait de se remplir sans que personne ne sache
 * pourquoi.
 */
export async function resoudreCompte(jeton: string): Promise<ReponseCalendly<string>> {
  const r = await appeler<{ resource?: { uri?: string } }>("/users/me", jeton)
  if (!r.ok) return { ok: false, erreur: r.erreur }
  const uri = r.donnees?.resource?.uri
  if (!uri) return { ok: false, erreur: "Réponse Calendly inattendue : compte introuvable." }
  return { ok: true, donnees: uri }
}

/**
 * Les rendez-vous d'hier à dans quatre-vingt-dix jours.
 *
 * Hier, et non aujourd'hui : un rendez-vous annulé ce matin doit encore être
 * relevé pour que son annulation se propage. Quatre-vingt-dix jours suffisent à
 * une pratique d'immigration et bornent la réponse — sans borne, un compte
 * ancien renverrait des milliers d'événements à chaque ouverture du calendrier.
 */
export async function listerRendezVous(
  jeton: string,
  uriCompte: string
): Promise<ReponseCalendly<EvenementCalendly[]>> {
  const jour = 86_400_000
  const min = new Date(Date.now() - jour).toISOString()
  const max = new Date(Date.now() + 90 * jour).toISOString()
  const q = new URLSearchParams({ user: uriCompte, min_start_time: min, max_start_time: max, count: "100" })

  const r = await appeler<{ collection?: EvenementCalendly[] }>(`/scheduled_events?${q}`, jeton)
  if (!r.ok) return { ok: false, erreur: r.erreur }
  return { ok: true, donnees: r.donnees?.collection ?? [] }
}

/** Le premier participant d'un rendez-vous — celui qui a réservé. */
export async function premierParticipant(
  jeton: string,
  uriEvenement: string
): Promise<ReponseCalendly<ParticipantCalendly | null>> {
  const r = await appeler<{ collection?: ParticipantCalendly[] }>(
    `/scheduled_events/${identifiant(uriEvenement)}/invitees?count=1`,
    jeton
  )
  if (!r.ok) return { ok: false, erreur: r.erreur }
  return { ok: true, donnees: r.donnees?.collection?.[0] ?? null }
}
