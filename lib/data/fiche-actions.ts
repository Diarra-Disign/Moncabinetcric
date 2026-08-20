"use server"

import { revalidatePath } from "next/cache"
import { getSessionSupabase, getCurrentMember } from "@/lib/supabase/session"
import { journalDeLaFiche } from "./journal"
import type { ChampsFiche, EntreeJournal } from "./fiche-criteres"
import { messageErreur } from "@/lib/data/erreurs"

/**
 * Modifier une fiche client ou prospect.
 *
 * UNE SEULE ACTION POUR LES DEUX, et c'est le §8 : le même formulaire s'ouvre
 * depuis Clients, depuis Prospects et depuis le dossier. Trois actions
 * séparées auraient fini par appliquer trois règles différentes — celle qui
 * journalise, celle qui ne journalise pas, et celle qui oublie le code postal.
 *
 * CE QUE CETTE ACTION NE FAIT PAS, et qui compte autant : elle ne touche à
 * AUCUN document déjà produit. Le §5 l'exige, et l'architecture le garantit
 * déjà — `agreement_parties` porte la copie figée du contrat, `documents`
 * porte le PDF et son empreinte. Modifier une fiche ne peut pas atteindre ces
 * lignes-là, parce que rien ici ne les lit. La garantie n'est donc pas une
 * précaution à tenir : elle est la conséquence de l'endroit où vivent les
 * données.
 *
 * Les documents FUTURS, eux, lisent la fiche à chaque composition — c'est le
 * §4, et il ne demande aucun code : `chargerContractant()` lit `clients` et
 * `leads` au moment où l'on crée l'entente, jamais avant.
 */

export interface Resultat {
  ok: boolean
  message: string
}

async function moi() {
  const membre = await getCurrentMember()
  if (!membre) throw new Error("Session expirée. Reconnectez-vous.")
  return membre
}

/**
 * Applique les modifications et les consigne.
 *
 * Enveloppe mince : la logique vit dans `fiche-modification.ts`, hors du module
 * « use server », pour rester appelable depuis une épreuve. C'est là que se
 * joue la garantie du §5, et une garantie qu'aucun contrôle ne peut appeler
 * n'est vérifiée qu'en production.
 */
export async function modifierFiche(
  type: "client" | "lead",
  id: string,
  champs: ChampsFiche
): Promise<Resultat> {
  try {
    const membre = await moi()
    const sb = await getSessionSupabase()

    const { modifierFiche: appliquer } = await import("./fiche-modification")
    const r = await appliquer(sb, {
      firmId: membre.firmId,
      profileId: membre.profileId,
      userId: membre.userId,
      fullName: membre.fullName,
      email: membre.email,
      role: membre.ciccRole,
    }, type, id, champs)

    if (r.ok) {
      revalidatePath("/fr/clients")
      revalidatePath("/fr/pipeline")
      revalidatePath("/[locale]/matters/[id]", "page")
    }
    return r
  } catch (e) {
    return { ok: false, message: messageErreur(e) }
  }
}

/**
 * Crée une fiche. Enveloppe mince, même motif que la modification.
 */
export async function creerFiche(
  type: "client" | "lead",
  champs: ChampsFiche
): Promise<Resultat & { id?: string; reference?: string }> {
  try {
    const membre = await moi()
    const sb = await getSessionSupabase()

    const { creerFiche: appliquer } = await import("./fiche-creation")
    const r = await appliquer(sb, {
      firmId: membre.firmId,
      profileId: membre.profileId,
      userId: membre.userId,
      fullName: membre.fullName,
      email: membre.email,
      role: membre.ciccRole,
    }, type, champs)

    if (r.ok) {
      revalidatePath("/fr/clients")
      revalidatePath("/fr/pipeline")
    }
    return r
  } catch (e) {
    return { ok: false, message: messageErreur(e) }
  }
}

/** La fiche telle qu'elle est en base, pour ouvrir le formulaire dessus. */
export async function chargerFiche(
  type: "client" | "lead",
  id: string
): Promise<ChampsFiche & { name?: string } | null> {
  const sb = await getSessionSupabase()
  const { data } =
    type === "client"
      ? await sb.from("clients")
          .select("name, civility, first_name, last_name, legal_name, birth_date, email, email_secondary, phone, phone_secondary, address, address_line2, city, province, postal_code, country, program, citizenship, residence, intake_motif, neq_number")
          .eq("id", id).maybeSingle()
      : await sb.from("leads")
          .select("name, civility, first_name, last_name, legal_name, birth_date, email, email_secondary, phone, phone_secondary, address, address_line2, city, province, postal_code, country, company, visa_type, source, contact_intent, notes")
          .eq("id", id).maybeSingle()

  return (data as (ChampsFiche & { name?: string }) | null) ?? null
}

/** Le journal d'une fiche (§6), du plus récent au plus ancien. */
export async function journalFiche(
  type: "client" | "lead",
  id: string
): Promise<EntreeJournal[]> {
  const sb = await getSessionSupabase()
  return journalDeLaFiche(sb, type, id)
}
