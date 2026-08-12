import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  partieDepuisClient, partieDepuisProspect, cabinetDepuisFirm,
} from "@/lib/ententes/contractant"
import type { PartieContractante, CabinetContrat } from "@/lib/ententes/variables"

/**
 * Lire un contractant, la session étant DONNÉE.
 *
 * Ce module n'importe PAS `lib/supabase/session`, et c'est tout son objet :
 * session.ts tire `next/headers`, qui n'existe pas hors d'une requête Next.
 * Tant que cette lecture vivait dans le même fichier que ses enveloppes de
 * session, aucune épreuve ne pouvait l'appeler — or c'est ici que se joue le
 * §4 : un document futur prend la fiche TELLE QU'ELLE EST au moment de sa
 * composition, jamais telle qu'elle était.
 *
 * La lecture passe par le client de SESSION qu'on lui donne, donc par Row
 * Level Security. Aucun filtre firm_id n'est écrit ici, et c'est délibéré :
 * l'écrire donnerait l'illusion que c'est LUI qui protège, et son oubli
 * ailleurs passerait inaperçu.
 */

export interface PreRemplissage {
  partie: PartieContractante
  cabinet: CabinetContrat
  /** Les proches déjà connus, pour les proposer comme parties au contrat (§8). */
  famille: { id: string; relation: string; civility: string | null; firstName: string; lastName: string }[]
}

/**
 * Le pré-remplissage, la session étant DONNÉE.
 *
 * Séparé de la version qui tire sa session, pour la même raison que
 * `modifierFiche()` et `emettre()` : c'est ici que se joue le §4 — un document
 * futur prend la fiche TELLE QU'ELLE EST au moment de sa composition — et une
 * règle qu'aucune épreuve ne peut appeler n'est vérifiée qu'en production.
 */
export async function chargerContractantAvec(
  sb: SupabaseClient,
  membre: { firmId: string; profileId?: string } | null,
  type: "client" | "lead",
  id: string
): Promise<PreRemplissage | null> {

  // Deux sélections écrites en toutes lettres plutôt qu'une chaîne assemblée :
  // l'analyseur de types de PostgREST lit le littéral, et une interpolation le
  // rend incapable de dire ce qu'il rendra.
  const { data: personne } =
    type === "client"
      ? await sb.from("clients")
          .select("civility, first_name, last_name, name, email, phone, address, city, province, postal_code, country, file_number")
          .eq("id", id).maybeSingle()
      : await sb.from("leads")
          .select("civility, first_name, last_name, name, email, phone, address, city, province, postal_code, country")
          .eq("id", id).maybeSingle()
  if (!personne) return null

  const [{ data: firm }, { data: famille }, { data: profil }] = await Promise.all([
    sb.from("firms").select("name, owner_name, rcic_license_number, address, address_line2, city, province, postal_code, country, email, phone, website")
      .eq("id", membre?.firmId ?? "").maybeSingle(),
    sb.from("family_members")
      .select("id, relation, civility, first_name, last_name")
      .eq(type === "client" ? "client_id" : "lead_id", id),
    // La civilité du consultant : il signe l'entente, et « Signé par Diarra »
    // vaut moins que « Signé par Monsieur Adama Diarra ».
    sb.from("profiles").select("civility").eq("id", membre?.profileId ?? "").maybeSingle(),
  ])

  const ligne = personne as unknown as Record<string, unknown>
  return {
    partie: type === "client" ? partieDepuisClient(ligne) : partieDepuisProspect(ligne),
    cabinet: cabinetDepuisFirm(firm ?? {}, (profil as { civility?: string } | null)?.civility ?? null),
    famille: (famille ?? []).map((m) => ({
      id: String(m.id),
      relation: String(m.relation ?? ""),
      civility: m.civility ? String(m.civility) : null,
      firstName: String(m.first_name ?? ""),
      lastName: String(m.last_name ?? ""),
    })),
  }
}
