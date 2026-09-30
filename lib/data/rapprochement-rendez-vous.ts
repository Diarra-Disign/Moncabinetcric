import type { CalendarEvent, ClientRecord, Lead, Matter } from "./types"
import { dossiersDuClient } from "./dossier-navigation"

/**
 * À QUI, ET À QUEL DOSSIER, SE RATTACHE UN RENDEZ-VOUS.
 *
 * ─── CE QUI SE FAISAIT ─────────────────────────────────────────────────────
 *
 * L'écran du calendrier rapprochait par le NOM avant l'identifiant :
 * `clients.find((c) => c.name === event.clientName || c.id === event.clientId)`.
 * Deux clients homonymes — fréquent — et le rendez-vous s'attachait au
 * premier des deux. Le bouton « compte rendu » ouvrait alors le dossier de
 * quelqu'un d'autre, sans que rien ne le signale.
 *
 * ─── LA RÈGLE ──────────────────────────────────────────────────────────────
 *
 * L'identifiant fait foi. Le nom ne sert qu'aux rendez-vous qui n'en portent
 * pas — les anciens, ceux relevés chez Calendly — et seulement si une seule
 * personne porte ce nom. Dans le doute, on ne rattache rien : un écran qui
 * dit « aucun dossier lié » est honnête ; un écran qui ouvre le mauvais
 * dossier ne l'est pas.
 */

/** Le client du rendez-vous, ou `undefined` si le rattachement est douteux. */
export function clientDuRendezVous(
  event: Pick<CalendarEvent, "clientId" | "clientName">,
  clients: readonly ClientRecord[]
): ClientRecord | undefined {
  if (event.clientId) {
    // Un identifiant inconnu ne se rabat PAS sur le nom : le rendez-vous
    // désigne quelqu'un que cette liste ne contient pas, et lui attribuer un
    // homonyme reviendrait à inventer un rattachement.
    return clients.find((c) => c.id === event.clientId)
  }
  return parNomUnique(clients, event.clientName)
}

/** Le prospect du rendez-vous, selon la même règle. */
export function prospectDuRendezVous(
  event: Pick<CalendarEvent, "leadId" | "clientName">,
  leads: readonly Lead[]
): Lead | undefined {
  if (event.leadId) return leads.find((l) => l.id === event.leadId)
  return parNomUnique(leads, event.clientName)
}

/**
 * Le dossier du rendez-vous.
 *
 * La référence portée par le rendez-vous d'abord. À défaut, le dossier du
 * client — mais seulement s'il n'en a qu'un : en choisir un parmi plusieurs
 * serait décider à la place de l'utilisateur.
 */
export function dossierDuRendezVous(
  event: Pick<CalendarEvent, "matterId">,
  dossiers: readonly Matter[],
  client: ClientRecord | undefined
): Matter | undefined {
  if (event.matterId) {
    const parReference = dossiers.find((m) => m.id === event.matterId)
    if (parReference) return parReference
  }
  if (!client) return undefined
  const rattaches = dossiersDuClient(client.id, dossiers)
  return rattaches.length === 1 ? rattaches[0] : undefined
}

function parNomUnique<T extends { name: string }>(
  elements: readonly T[],
  nom: string | undefined
): T | undefined {
  if (!nom) return undefined
  const homonymes = elements.filter((e) => e.name === nom)
  return homonymes.length === 1 ? homonymes[0] : undefined
}
