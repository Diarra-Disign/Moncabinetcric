import "server-only"

import { getSessionSupabase } from "@/lib/supabase/session"
import { isSupabaseSource } from "./source"
import { getMatters } from "./queries"
import {
  bornesDeLaPeriode,
  type CritèresDossiersRecents,
  type PageDossiersRecents,
} from "./dossiers-recents-criteres"

/**
 * Les dossiers récents du tableau de bord.
 *
 * La section existait déjà à l'écran ; elle bouclait sur un tableau vide écrit
 * en dur et n'a donc jamais rien affiché, pour aucun cabinet. Ce fichier lui
 * donne sa source — et fait le filtrage EN BASE, par firm_recent_matters().
 *
 * Pourquoi pas en mémoire : le brief demande que la recherche reste rapide
 * « même lorsque le cabinet possède un grand nombre de dossiers ». Charger
 * tous les dossiers pour en garder huit tient tant que le cabinet est jeune,
 * et cesse de tenir le jour où il ne l'est plus — c'est-à-dire le jour où
 * personne ne surveille.
 */

export async function listerDossiersRecents(
  criteres: CritèresDossiersRecents = {}
): Promise<PageDossiersRecents> {
  const champDate = criteres.champDate ?? "updated_at"
  const tri = criteres.tri ?? "date_desc"
  const limite = criteres.limite ?? 8
  const recherche = (criteres.recherche ?? "").trim()

  // Une période personnalisée l'emporte sur le raccourci : c'est la saisie la
  // plus explicite des deux.
  const bornes =
    criteres.du || criteres.au
      ? { du: criteres.du || null, au: criteres.au || null }
      : bornesDeLaPeriode(criteres.periode ?? "tout")

  if (!isSupabaseSource()) {
    // En mémoire, on rend les dossiers de démonstration sans filtrer : la
    // fonction SQL n'existe pas là, et simuler son comportement produirait
    // deux implémentations qui divergeraient en silence.
    const tous = await getMatters()
    return {
      dossiers: tous.slice(0, limite).map((m) => ({
        id: m.id,
        reference: m.id,
        clientName: m.clientName,
        program: m.program,
        category: m.category ?? null,
        status: m.status,
        openedDate: m.openedDate ?? null,
        deadline: m.deadline ?? null,
        createdAt: m.openedDate ?? "",
        updatedAt: m.openedDate ?? "",
      })),
      total: tous.length,
    }
  }

  const sb = await getSessionSupabase()
  const { data, error } = await sb.rpc("firm_recent_matters", {
    p_champ_date: champDate,
    p_du: bornes.du,
    p_au: bornes.au,
    p_recherche: recherche || null,
    p_tri: tri,
    p_limite: limite,
    p_decalage: 0,
  })

  // Un tableau de bord ne doit pas tomber parce qu'une de ses sections a
  // échoué. On rend vide, et l'écran affiche son état vide — qui dit « aucun
  // dossier », ce qui est alors la seule chose qu'on sache honnêtement.
  if (error) {
    console.error("listerDossiersRecents :", error.message)
    return { dossiers: [], total: 0 }
  }

  const lignes = (data ?? []) as Record<string, unknown>[]
  return {
    dossiers: lignes.map((r) => ({
      id: String(r.id),
      reference: String(r.reference ?? ""),
      clientName: String(r.client_name ?? ""),
      program: String(r.program ?? ""),
      category: r.category ? String(r.category) : null,
      status: String(r.status ?? ""),
      openedDate: r.opened_date ? String(r.opened_date) : null,
      deadline: r.deadline ? String(r.deadline) : null,
      createdAt: String(r.created_at ?? ""),
      updatedAt: String(r.updated_at ?? ""),
    })),
    total: lignes.length ? Number(lignes[0].total ?? lignes.length) : 0,
  }
}
