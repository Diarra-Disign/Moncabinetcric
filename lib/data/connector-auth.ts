import "server-only"

import { randomBytes, createHash } from "node:crypto"
import { getServerSupabase } from "@/lib/supabase/server"

/**
 * Authentification du connecteur d'intelligence artificielle.
 *
 * Ce module est délibérément étroit. Il n'expose pas de client Supabase et
 * ne construit aucune requête : il n'appelle que trois fonctions de la
 * base, qui portent elles-mêmes le cloisonnement.
 *
 * La raison est simple. Un module qui rendrait un client général obligerait
 * chaque route à se souvenir de filtrer sur le cabinet, et il suffirait
 * d'un oubli pour ouvrir les données d'un cabinet à un autre. Ici, il n'y
 * a pas de filtre à écrire : les fonctions SQL résolvent le cabinet à
 * partir de la clé et ne rendent que ce qui lui appartient.
 *
 * Aucune de ces fonctions n'accepte d'identifiant de cabinet. Un appelant
 * ne peut donc pas en désigner un autre — il n'existe pas de paramètre par
 * lequel le demander.
 */

/** Préfixe visible d'une clé, pour la reconnaître sans la révéler. */
const PREFIXE = "cric_live_"

export interface Autorisation {
  /** Cabinet résolu à partir de la clé. Absent si la clé est refusée. */
  firmId?: string
  autorise: boolean
  /** UNAUTHORIZED · RESERVED_HUMAN_ACTION · ACTION_NOT_ALLOWED · OK */
  motif: string
}

/**
 * Vérifie la clé et l'action demandée.
 *
 * Un seul aller-retour : la base résout le cabinet, contrôle la révocation,
 * l'expiration, la suspension du cabinet, l'activation du connecteur et les
 * actes réservés. L'application ne rejoue aucun de ces contrôles — les
 * dédoubler inviterait à les faire diverger.
 */
export async function autoriserAppel(cle: string, action: string): Promise<Autorisation> {
  if (!cle) return { autorise: false, motif: "UNAUTHORIZED" }

  const { data, error } = await getServerSupabase().rpc("connector_authorize", {
    raw_key: cle,
    wanted_action: action,
  })

  if (error || !data || data.length === 0) {
    return { autorise: false, motif: "UNAUTHORIZED" }
  }

  const r = data[0] as { firm_id: string | null; allowed: boolean; reason: string }
  return {
    firmId: r.firm_id ?? undefined,
    autorise: r.allowed,
    motif: r.reason,
  }
}

/**
 * Consigne l'appel, refus compris.
 *
 * Les refus sont ce qu'on relit après coup : une clé révoquée qui continue
 * d'essayer, ou un assistant qui tente un acte réservé, se voient dans le
 * journal et nulle part ailleurs. Le cabinet imputé vient de la clé.
 */
export async function journaliserAppel(opts: {
  cle: string
  action: string
  statut: string
  resume: string
  ressourceId?: string
  ip?: string
}): Promise<void> {
  await getServerSupabase().rpc("connector_log", {
    raw_key: opts.cle,
    in_action: opts.action,
    in_status: opts.statut,
    in_summary: opts.resume,
    in_resource_id: opts.ressourceId ?? null,
    in_client_ip: opts.ip ?? null,
  })
}

/** Extrait la clé de l'en-tête Authorization. Aucune valeur par défaut. */
export function cleDeLaRequete(request: Request): string {
  const entete = request.headers.get("authorization") ?? ""
  const m = entete.match(/^Bearer\s+(.+)$/i)
  return m ? m[1].trim() : ""
}

/**
 * Adresse de l'appelant, telle que rapportée par le proxy.
 *
 * En-tête déclaratif, donc falsifiable : il sert à relire un journal, pas
 * à décider d'un accès. Aucun contrôle ne s'y appuie.
 */
export function ipDeLaRequete(request: Request): string | undefined {
  const t = request.headers.get("x-forwarded-for")
  return t ? t.split(",")[0].trim() : undefined
}

export interface CleCreee {
  /** Clé en clair. Affichée une seule fois : la base n'en garde que l'empreinte. */
  cle: string
  prefixe: string
}

/**
 * Engendre une clé et l'enregistre pour le cabinet donné.
 *
 * Le cabinet vient de la session du propriétaire qui crée la clé, jamais
 * d'un formulaire : c'est l'action serveur appelante qui le fournit après
 * avoir vérifié la qualité de propriétaire.
 */
export async function creerCle(opts: {
  firmId: string
  label: string
  creePar?: string
  jours?: number
}): Promise<{ ok: boolean; message: string; cle?: CleCreee }> {
  // 32 octets d'aléa : la recherche exhaustive est hors de portée, ce qui
  // rend l'empreinte SHA-256 suffisante côté base.
  const secret = randomBytes(32).toString("base64url")
  const cle = `${PREFIXE}${secret}`
  const empreinte = createHash("sha256").update(cle).digest("hex")

  const { error } = await getServerSupabase().from("ai_api_keys").insert({
    firm_id: opts.firmId,
    label: opts.label,
    key_prefix: cle.slice(0, 12),
    key_hash: empreinte,
    created_by: opts.creePar ?? null,
    expires_at: opts.jours ? new Date(Date.now() + opts.jours * 86400000).toISOString() : null,
  })

  if (error) return { ok: false, message: error.message }

  return {
    ok: true,
    message: "Clé créée. Elle n'est affichée qu'une seule fois.",
    cle: { cle, prefixe: cle.slice(0, 12) },
  }
}
