"use server"

import { z } from "zod"
import { getServerSupabase } from "@/lib/supabase/server"

/**
 * Demande de démonstration déposée depuis la page publique.
 *
 * Trois choses expliquent la forme de ce module.
 *
 * Le visiteur n'a pas de session : aucune politique RLS ne peut donc le
 * rattacher à un cabinet. L'écriture passe par la clé service_role, et le
 * cabinet destinataire est résolu ici, jamais transmis par le formulaire —
 * un firm_id qui viendrait du navigateur permettrait de déposer un
 * prospect dans le pipeline de n'importe quel cabinet abonné.
 *
 * Le destinataire est le cabinet exploitant de la plateforme, celui que
 * marque `is_platform_operator`. Une demande de démonstration s'adresse à
 * l'éditeur, pas à un cabinet client.
 *
 * Le formulaire est ouvert à tous : tout ce qui en vient est traité comme
 * hostile jusqu'à validation, et borné en longueur avant d'atteindre la
 * base.
 */

const Demande = z.object({
  nom: z.string().trim().min(2, "Nom trop court.").max(120),
  courriel: z.string().trim().toLowerCase().email("Courriel invalide.").max(180),
  cabinet: z.string().trim().max(160).optional().default(""),
  telephone: z.string().trim().max(40).optional().default(""),
  message: z.string().trim().max(2000).optional().default(""),
  // Champ leurre : invisible à l'écran, donc vide chez un humain. Ce n'est
  // pas une protection sérieuse contre un robot déterminé, seulement le
  // filtre le moins coûteux contre le remplissage automatique courant.
  site: z.string().max(0).optional().default(""),
})

export interface ResultatDemande {
  ok: boolean
  erreur?: string
}

export async function enregistrerDemandeDemo(
  brut: Record<string, unknown>
): Promise<ResultatDemande> {
  const analyse = Demande.safeParse(brut)
  if (!analyse.success) {
    return { ok: false, erreur: analyse.error.issues[0]?.message ?? "Formulaire invalide." }
  }
  const d = analyse.data

  // Le leurre est rempli : on répond comme si tout allait bien, sans rien
  // écrire. Annoncer le rejet apprendrait au robot à le contourner.
  if (d.site) return { ok: true }

  const supabase = getServerSupabase()

  const { data: exploitant, error: erreurExploitant } = await supabase
    .from("firms")
    .select("id")
    .eq("is_platform_operator", true)
    .maybeSingle()

  if (erreurExploitant || !exploitant) {
    // Sans cabinet exploitant, la demande n'a pas de destinataire. Mieux
    // vaut le dire que de la perdre en silence.
    return {
      ok: false,
      erreur: "Aucun cabinet exploitant n'est configuré. La demande n'a pas pu être enregistrée.",
    }
  }

  const notes = [
    d.cabinet && `Cabinet : ${d.cabinet}`,
    d.message && `Message : ${d.message}`,
  ]
    .filter(Boolean)
    .join("\n")

  const { error } = await supabase.from("leads").insert({
    firm_id: exploitant.id,
    legacy_id: `demo-${Date.now()}`,
    name: d.nom,
    company: d.cabinet || null,
    // Un cabinet qui demande une démonstration est un prospect
    // professionnel, et l'objet n'est pas une demande de visa : la colonne
    // le dit plutôt que d'emprunter un type de visa qui fausserait les
    // statistiques du pipeline.
    type: "b2b",
    visa_type: "Démonstration de la plateforme",
    score_label: "med",
    stage: "newLead",
    email: d.courriel,
    phone: d.telephone,
    notes,
    source: "landing_demo",
  })

  if (error) return { ok: false, erreur: error.message }
  return { ok: true }
}
