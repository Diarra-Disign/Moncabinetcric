"use server"

import { z } from "zod"
import { getServerSupabase } from "@/lib/supabase/server"

/**
 * Demande de démonstration déposée depuis la page publique.
 *
 * Trois choses expliquent la forme de ce module.
 *
 * Le visiteur n'a pas de session : aucune politique RLS ne peut donc le
 * rattacher à quoi que ce soit. L'écriture passe par la clé service_role,
 * et `demo_requests` n'a volontairement aucune politique d'insertion —
 * cette action est la seule porte, ce qui rend les contrôles ci-dessous
 * incontournables plutôt que facultatifs.
 *
 * La demande ne va plus dans `leads`. Un prospect de la plateforme n'est
 * pas un prospect d'immigration : il s'adresse à l'éditeur, et le compte
 * exploitant — membre d'aucun cabinet — ne voyait rien de ce qui lui était
 * destiné.
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
  // La réponse doit repartir dans la langue de la page où la demande a été
  // remplie, pas dans celle de l'exploitant.
  langue: z.enum(["fr", "en"]).optional().default("fr"),
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

  const { error } = await getServerSupabase().from("demo_requests").insert({
    name: d.nom,
    email: d.courriel,
    company: d.cabinet || null,
    phone: d.telephone || null,
    message: d.message || null,
    locale: d.langue,
  })

  if (error) return { ok: false, erreur: error.message }
  return { ok: true }
}
