import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
// Les libellés vivent dans le module PUR : le formulaire de modification les
// affiche aussi, et il tourne dans le navigateur.
import { libelleChamp, type ChangementJournal, type EntreeJournal } from "./fiche-criteres"

/**
 * Le journal des modifications d'une fiche.
 *
 * AUCUNE TABLE NEUVE. `audit_logs` existait déjà, avec ce qu'il faut pour
 * faire foi : un déclencheur qui refuse UPDATE et DELETE, et un CHAÎNAGE par
 * empreintes — chaque ligne porte celle de la précédente, si bien qu'une
 * suppression au milieu se voit. Elle comptait zéro ligne : la structure était
 * là, rien ne l'écrivait.
 *
 * CE QUI EST JOURNALISÉ, ET CE QUI NE L'EST PAS. Seuls les champs RÉELLEMENT
 * MODIFIÉS entrent au journal, avec leur valeur d'avant et d'après. Consigner
 * la fiche entière à chaque enregistrement noierait le changement d'adresse
 * sous vingt champs identiques — et c'est ce changement-là qu'on viendra
 * chercher deux ans plus tard.
 *
 * Une modification qui ne change RIEN n'écrit rien : ouvrir un formulaire et
 * le refermer ne doit pas laisser de trace, sinon le journal devient un
 * compteur d'ouvertures.
 *
 * LE JOURNAL NE FAIT PAS ÉCHOUER L'ÉCRITURE. Si la trace ne part pas, la
 * modification reste enregistrée et l'échec est signalé dans les journaux du
 * serveur. L'inverse — refuser un changement d'adresse parce que sa trace n'a
 * pas pu s'écrire — punirait le consultant pour un défaut qui n'est pas le
 * sien.
 */

/**
 * Compare deux états d'une ligne et rend la liste des écarts.
 *
 * La comparaison se fait sur la valeur AFFICHÉE — chaîne vide et NULL sont la
 * même chose pour qui lit le journal, et les distinguer produirait des entrées
 * « Ville : "" → null » que personne ne peut interpréter.
 */
export function ecarts(
  avant: Record<string, unknown>,
  apres: Record<string, unknown>
): ChangementJournal[] {
  const sortie: ChangementJournal[] = []
  for (const champ of Object.keys(apres)) {
    const a = String(avant[champ] ?? "").trim()
    const b = String(apres[champ] ?? "").trim()
    if (a === b) continue
    sortie.push({ champ, libelle: libelleChamp(champ), avant: a, apres: b })
  }
  return sortie
}

export interface Acteur {
  firmId: string
  /** NULL accepté : audit_logs le refuse, et l'échec est alors journalisé
   *  plutôt que de faire échouer la modification elle-même. */
  profileId?: string | null
  fullName?: string
  email?: string
  role?: string
}

/**
 * Consigne une modification de fiche.
 *
 * `resume` est écrit pour être lu SEUL, dans une liste : « Adresse et ville
 * modifiées » se comprend sans dérouler le détail, « update » non.
 */
export async function journaliser(
  sb: SupabaseClient,
  acteur: Acteur,
  entree: {
    action: string
    entityType: "client" | "lead" | "matter" | "agreement"
    entityId: string
    matterId?: string | null
    changements: ChangementJournal[]
    resume?: string
  }
): Promise<void> {
  if (entree.changements.length === 0) return

  const noms = entree.changements.map((c) => c.libelle.toLowerCase())
  const resume =
    entree.resume ??
    `${noms.length === 1 ? "Champ modifié" : `${noms.length} champs modifiés`} : ${noms.join(", ")}`

  const { error } = await sb.from("audit_logs").insert({
    firm_id: acteur.firmId,
    actor_member_id: acteur.profileId ?? null,
    actor_email: acteur.email ?? "",
    actor_name: acteur.fullName ?? "",
    actor_role: acteur.role ?? "",
    action: entree.action,
    entity_type: entree.entityType,
    entity_id: entree.entityId,
    matter_id: entree.matterId ?? null,
    summary: resume,
    changes: entree.changements,
  })

  if (error) {
    // On ne fait pas échouer la modification : voir l'en-tête du fichier.
    console.error("journaliser :", entree.entityType, entree.entityId, "—", error.message)
  }
}

/** Le journal d'une fiche, du plus récent au plus ancien. */
export async function journalDeLaFiche(
  sb: SupabaseClient,
  entityType: string,
  entityId: string,
  limite = 50
): Promise<EntreeJournal[]> {
  const { data } = await sb
    .from("audit_logs")
    .select("id, occurred_at, action, summary, actor_name, actor_email, changes")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("occurred_at", { ascending: false })
    .limit(limite)

  return (data ?? []).map((l) => ({
    id: String(l.id),
    date: String(l.occurred_at ?? ""),
    action: String(l.action ?? ""),
    resume: String(l.summary ?? ""),
    acteur: String(l.actor_name ?? "") || String(l.actor_email ?? ""),
    changements: (l.changes as ChangementJournal[]) ?? [],
  }))
}
