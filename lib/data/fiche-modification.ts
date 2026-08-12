import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { ecarts, journaliser } from "./journal"
import type { ChampsFiche } from "./fiche-criteres"

/**
 * La modification d'une fiche, séparée de la session.
 *
 * Elle vivait dans un module « use server » : tout y passait par
 * `getCurrentMember()`, donc rien n'y était appelable hors d'une requête HTTP.
 * C'est pourtant ICI que se joue la garantie la plus lourde du produit — un
 * contrat signé ne doit pas changer quand le client déménage — et une garantie
 * qu'aucune épreuve ne peut appeler finit par n'être vérifiée qu'en production.
 *
 * Même geste que `emettre()` pour les ententes, même raison.
 *
 * Le client Supabase et le membre sont DONNÉS. Le client porte la session,
 * donc RLS : une fiche d'un autre cabinet n'est pas trouvée, et l'écriture
 * n'est pas refusée par ce module mais par la base.
 */

export interface MembreModificateur {
  firmId: string
  profileId?: string | null
  userId?: string
  fullName?: string
  email?: string
  role?: string
}

export interface Resultat {
  ok: boolean
  message: string
}

/**
 * Les colonnes que chaque table accepte réellement.
 *
 * Écrit en toutes lettres plutôt que déduit : envoyer `program` à `leads`
 * ferait échouer l'écriture entière avec un message que le consultant ne peut
 * pas interpréter, et le formulaire partagé du §8 envoie naturellement les
 * champs des deux.
 */
const COLONNES: Record<"client" | "lead", (keyof ChampsFiche)[]> = {
  client: [
    "civility", "first_name", "last_name", "legal_name", "birth_date",
    "email", "email_secondary", "phone", "phone_secondary",
    "address", "address_line2", "city", "province", "postal_code", "country",
    "program", "citizenship", "residence", "intake_motif", "neq_number",
    "client_type",
  ],
  lead: [
    "civility", "first_name", "last_name", "legal_name", "birth_date",
    "email", "email_secondary", "phone", "phone_secondary",
    "address", "address_line2", "city", "province", "postal_code", "country",
    "company", "visa_type", "source", "contact_intent", "notes",
    "type", "estimated_value", "score_label", "lmia_positions",
  ],
}

const NOM_TABLE = { client: "clients", lead: "leads" } as const

/**
 * Applique les modifications et les consigne.
 *
 * L'état d'AVANT est relu juste avant l'écriture, et pas transmis par l'écran.
 * Une valeur d'avant fournie par le navigateur serait celle qu'il avait au
 * chargement du formulaire : si un confrère a modifié la fiche entre-temps, le
 * journal consignerait un changement qui n'a jamais eu lieu.
 */
export async function modifierFiche(
  sb: SupabaseClient,
  membre: MembreModificateur,
  type: "client" | "lead",
  id: string,
  champs: ChampsFiche
): Promise<Resultat> {
  try {
    const table = NOM_TABLE[type]

    const permis = COLONNES[type]
    const charge: Record<string, unknown> = {}
    for (const [cle, valeur] of Object.entries(champs)) {
      if (!permis.includes(cle as keyof ChampsFiche)) continue
      if (valeur === undefined) continue
      // Une chaîne vide vaut « pas renseigné » : la ranger en NULL est ce qui
      // permet à lignesAdresse() de sauter la ligne au lieu d'en imprimer une
      // vide sur le contrat.
      charge[cle] = typeof valeur === "string" && valeur.trim() === "" ? null : valeur
    }

    // Le nom d'affichage suit le prénom et le nom : il est lu par la recherche,
    // les listes et les documents. Le laisser figé afficherait l'ancien nom
    // partout après un mariage ou une correction d'état civil.
    if (charge.first_name !== undefined || charge.last_name !== undefined) {
      const { data: actuel } = await sb
        .from(table).select("first_name, last_name").eq("id", id).maybeSingle()
      const prenom = String(charge.first_name ?? actuel?.first_name ?? "").trim()
      const nom = String(charge.last_name ?? actuel?.last_name ?? "").trim()
      const complet = [prenom, nom].filter(Boolean).join(" ")
      if (complet) charge.name = complet
    }

    if (Object.keys(charge).length === 0) {
      return { ok: false, message: "Aucune modification à enregistrer." }
    }

    const { data: avant } = await sb
      .from(table).select("*").eq("id", id).maybeSingle()
    if (!avant) return { ok: false, message: "Cette fiche est introuvable." }

    const { error } = await sb.from(table).update(charge).eq("id", id)
    if (error) return { ok: false, message: error.message }

    const changements = ecarts(avant as Record<string, unknown>, charge)
    await journaliser(sb, {
      firmId: membre.firmId,
      profileId: membre.profileId ?? undefined,
      fullName: membre.fullName,
      email: membre.email,
      role: membre.role,
    }, {
      action: type === "client" ? "client.update" : "lead.update",
      entityType: type,
      entityId: id,
      changements,
    })

    if (changements.length === 0) return { ok: true, message: "Aucun changement." }
    return {
      ok: true,
      message: changements.length === 1
        ? `${changements[0].libelle} mis à jour.`
        : `${changements.length} renseignements mis à jour.`,
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}
