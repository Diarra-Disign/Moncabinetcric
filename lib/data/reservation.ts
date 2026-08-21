import "server-only"

import { createClient } from "@supabase/supabase-js"
import { creneauxLibres, type Plage, type Occupation, type Creneau } from "@/lib/reservation/creneaux"

/**
 * La page publique de réservation, côté serveur.
 *
 * ─── POURQUOI LA CLÉ ANONYME, ET NON CELLE DE SERVICE ──────────────────────
 *
 * Ce chemin n'a pas de session : le visiteur est un inconnu. On pourrait être
 * tenté d'employer la clé de service « puisque c'est le serveur qui lit » —
 * ce serait une faute. La clé de service passe outre la RLS ; si une requête
 * était un jour élargie par mégarde, elle rendrait tout.
 *
 * On emploie donc la clé PUBLIQUE, et l'on ne peut appeler que les quatre
 * fonctions à qui l'exécution a été explicitement accordée. Ces fonctions ne
 * rendent que le strict nécessaire : `creneaux_pris` ne livre que des instants,
 * jamais un nom de client ni un motif.
 */
function clientPublic() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  )
}

export interface CabinetPublic {
  firmId: string
  nom: string
  logoUrl: string
  salle: string
  dureeMinutes: number
  preavisHeures: number
  horizonJours: number
}

export async function getCabinetPublic(slug: string): Promise<CabinetPublic | null> {
  const { data, error } = await clientPublic().rpc("cabinet_public", { p_slug: slug })
  if (error || !data || (data as unknown[]).length === 0) return null
  const r = (data as Record<string, unknown>[])[0]
  return {
    firmId: String(r.firm_id),
    nom: String(r.nom ?? ""),
    logoUrl: String(r.logo_url ?? ""),
    salle: String(r.salle ?? ""),
    dureeMinutes: Number(r.slot_minutes ?? 30),
    preavisHeures: Number(r.lead_hours ?? 24),
    horizonJours: Number(r.horizon_days ?? 30),
  }
}

/**
 * Les créneaux offerts par un cabinet.
 *
 * Le calcul se fait ICI, au serveur, et non dans le navigateur : la liste
 * envoyée au visiteur ne contient que des créneaux LIBRES. Calculer au
 * navigateur aurait obligé à lui transmettre les instants occupés — donc à
 * dévoiler le rythme de travail du cabinet, et à qui sait lire, le nombre de
 * ses rendez-vous.
 */
export async function getCreneaux(slug: string): Promise<Creneau[]> {
  const cabinet = await getCabinetPublic(slug)
  if (!cabinet) return []

  const sb = clientPublic()
  const maintenant = new Date()
  const du = maintenant.toISOString().slice(0, 10)
  const au = new Date(maintenant.getTime() + (cabinet.horizonJours + 2) * 86_400_000)
    .toISOString().slice(0, 10)

  const [plagesRes, prisRes] = await Promise.all([
    sb.rpc("plages_publiques", { p_slug: slug }),
    sb.rpc("creneaux_pris", { p_slug: slug, p_du: du, p_au: au }),
  ])

  const plages: Plage[] = ((plagesRes.data ?? []) as Record<string, unknown>[]).map((p) => ({
    weekday: Number(p.weekday),
    start: String(p.start_time ?? "").slice(0, 5),
    end: String(p.end_time ?? "").slice(0, 5),
  }))

  const occupations: Occupation[] = ((prisRes.data ?? []) as Record<string, unknown>[]).map((o) => ({
    debut: new Date(String(o.debut)),
    fin: new Date(String(o.fin)),
  }))

  return creneauxLibres({
    plages,
    occupations,
    regles: {
      dureeMinutes: cabinet.dureeMinutes,
      preavisHeures: cabinet.preavisHeures,
      horizonJours: cabinet.horizonJours,
    },
    maintenant,
  })
}

export interface ResultatReservation {
  ok: boolean
  message: string
}

/**
 * Réserve un créneau.
 *
 * Toute la vérification vit dans `reserver_creneau()`, en base : bornes,
 * appartenance à une plage déclarée, et surtout le verrou qui empêche deux
 * clics simultanés de produire deux rendez-vous superposés. Refaire ces
 * contrôles ici ne servirait à rien — cette fonction est appelable sans passer
 * par l'écran.
 *
 * Les messages de la base sont rédigés pour être montrés tels quels ; ils
 * portent le code P0001 ou un code standard, et `messageErreur()` les laisse
 * passer depuis le 2026-08-19.
 */
export async function reserverCreneau(opts: {
  slug: string
  debutIso: string
  nom: string
  courriel: string
  telephone?: string
  motif?: string
}): Promise<ResultatReservation> {
  const { data, error } = await clientPublic().rpc("reserver_creneau", {
    p_slug: opts.slug,
    p_debut: opts.debutIso,
    p_nom: opts.nom,
    p_courriel: opts.courriel,
    p_telephone: opts.telephone ?? null,
    p_motif: opts.motif ?? null,
  })

  if (error) {
    const { messageErreur } = await import("@/lib/data/erreurs")
    return { ok: false, message: messageErreur(error) }
  }
  if (!data) return { ok: false, message: "La réservation n'a pas abouti." }

  return { ok: true, message: "Votre rendez-vous est confirmé." }
}
