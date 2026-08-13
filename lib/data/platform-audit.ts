import "server-only"

import { createClient } from "@supabase/supabase-js"

/**
 * Le journal des gestes d'exploitation.
 *
 * ─── POURQUOI CE MODULE EXISTE ─────────────────────────────────────────────
 *
 * `journaliser()` vivait dans `catalogue-actions.ts`, et n'était donc appelée
 * que par les gestes du catalogue. Résultat : modifier un prix laissait une
 * trace, mais SUSPENDRE UN CABINET n'en laissait aucune — pas plus qu'en créer
 * un ou changer son forfait. Les trois actes les plus lourds de la console
 * étaient les seuls à ne rien écrire.
 *
 * Le sortir ici n'ajoute pas une couche : cela retire une frontière qui
 * n'avait pas de raison d'être.
 *
 * ─── POURQUOI LA CLÉ DE SERVICE ────────────────────────────────────────────
 *
 * `platform_audit` n'a AUCUNE politique d'écriture — seule une lecture pour
 * l'exploitant. C'est délibéré : un journal qu'on peut corriger depuis
 * l'application ne prouve rien. Il ne s'écrit donc que d'ici, avec la clé de
 * service, et jamais depuis un écran.
 *
 * ─── LES ÉCHECS SONT VISIBLES ──────────────────────────────────────────────
 *
 * Une écriture de journal ne doit pas faire échouer le geste qu'elle relate :
 * refuser une suspension parce que le journal est indisponible laisserait
 * ouvert un cabinet qu'on voulait fermer. Mais elle ne doit pas non plus
 * échouer en silence — c'est exactement ce qui a masqué, pendant des semaines,
 * un verrou de document qui ne se posait jamais.
 */

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Configuration Supabase incomplète.")
  return createClient(url, key, { auth: { persistSession: false } })
}

export interface GesteExploitation {
  actorId: string
  actorEmail: string
  /** Verbe court et stable : « firm.suspend », « plan.update »… */
  action: string
  firmId?: string | null
  firmName?: string
  /** Écrit pour être lu SEUL, dans une liste. */
  summary: string
  details?: Record<string, unknown>
}

export async function journaliserExploitation(geste: GesteExploitation): Promise<void> {
  const { error } = await serviceClient().from("platform_audit").insert({
    actor_id: geste.actorId,
    actor_email: geste.actorEmail,
    action: geste.action,
    firm_id: geste.firmId ?? null,
    firm_name: geste.firmName ?? "",
    summary: geste.summary,
    details: geste.details ?? null,
  })

  if (error) {
    console.error(
      "platform_audit : geste NON consigné —", geste.action,
      geste.firmName ? `sur « ${geste.firmName} »` : "",
      "—", error.message
    )
  }
}
