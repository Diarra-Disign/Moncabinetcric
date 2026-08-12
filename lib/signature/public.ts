import "server-only"

import { createHash } from "node:crypto"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * Le chemin public de signature — celui du destinataire sans compte.
 *
 * ─── POURQUOI LE RÔLE DE SERVICE ───────────────────────────────────────────
 *
 * Le signataire n'a AUCUNE session : c'est tout l'objet du lien. Aucune
 * politique RLS ne peut donc l'autoriser, puisqu'elles reposent toutes sur
 * current_firm_id() ou current_client_id().
 *
 * Ce module emploie le rôle de service, mais il ne l'emploie QUE pour appeler
 * quatre fonctions de la base — résoudre, consulter, signer, refuser — dont
 * chacune vérifie le jeton elle-même. C'est le jeton qui autorise, jamais
 * l'appelant. Aucune requête directe sur une table n'est faite ici, et c'est
 * la règle à ne pas relâcher : le jour où quelqu'un écrira
 * `sb.from("clients").select()` dans ce fichier, tout le cloisonnement tombe.
 *
 * ─── LE JETON NE SORT JAMAIS D'ICI ─────────────────────────────────────────
 *
 * Il arrive par l'adresse, il est haché immédiatement, et seule son empreinte
 * descend vers la base. Il n'est ni journalisé, ni renvoyé au navigateur, ni
 * placé dans un message d'erreur.
 */

let cache: SupabaseClient | null = null

function service(): SupabaseClient {
  if (cache) return cache
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const cle = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !cle) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont nécessaires " +
      "au chemin public de signature."
    )
  }
  cache = createClient(url, cle, { auth: { persistSession: false } })
  return cache
}

const empreinte = (jeton: string) => createHash("sha256").update(jeton).digest("hex")

export interface VueSignature {
  destinataireId: string
  demandeId: string
  documentId: string
  documentNom: string
  cabinetNom: string
  nom: string
  courriel: string
  role: string
  methodeAuth: string
  statutDestinataire: string
  statutDemande: string
  mode: string
  expireLe: string | null
  sonTour: boolean
}

export interface ChampASaisir {
  id: string
  type: string
  libelle: string
  obligatoire: boolean
  valeur: string | null
  position: number
}

/**
 * Ce que le porteur d'un jeton a le droit de voir.
 *
 * Rend `null` pour TOUTES les raisons de refus confondues — jeton inconnu,
 * expiré, révoqué, demande close. Distinguer les cas apprendrait à un
 * visiteur curieux quels jetons existent.
 */
export async function vueParJeton(jeton: string): Promise<VueSignature | null> {
  const { data } = await service().rpc("resolve_signature_token", {
    p_token_hash: empreinte(jeton),
  })
  const l = (data ?? [])[0]
  if (!l) return null

  return {
    destinataireId: String(l.recipient_id),
    demandeId: String(l.request_id),
    documentId: String(l.document_id),
    documentNom: String(l.document_name ?? ""),
    cabinetNom: String(l.firm_name ?? ""),
    nom: String(l.full_name ?? ""),
    courriel: String(l.email ?? ""),
    role: String(l.role ?? ""),
    methodeAuth: String(l.auth_method ?? "email_confirm"),
    statutDestinataire: String(l.recipient_status ?? ""),
    statutDemande: String(l.request_status ?? ""),
    mode: String(l.signing_mode ?? "sequential"),
    expireLe: l.expires_at ? String(l.expires_at) : null,
    sonTour: l.son_tour === true,
  }
}

/** Les champs que CE destinataire doit remplir. */
export async function champsParJeton(jeton: string): Promise<ChampASaisir[]> {
  const vue = await vueParJeton(jeton)
  if (!vue) return []

  const { data } = await service()
    .from("signature_fields")
    .select("id, kind, label, required, value, position")
    .eq("recipient_id", vue.destinataireId)
    .order("position")

  return (data ?? []).map((c) => ({
    id: String(c.id),
    type: String(c.kind),
    libelle: String(c.label ?? ""),
    obligatoire: c.required !== false,
    valeur: c.value ? String(c.value) : null,
    position: Number(c.position ?? 0),
  }))
}

/**
 * L'adresse du fichier à lire, valable une heure.
 *
 * Le fichier n'est JAMAIS servi directement : le compartiment reste fermé, et
 * l'adresse expire. Un lien permanent circulerait par courriel bien après que
 * l'accès aurait dû être retiré.
 */
export async function lienDocument(jeton: string): Promise<string | null> {
  const vue = await vueParJeton(jeton)
  if (!vue) return null

  const sb = service()
  const { data: doc } = await sb
    .from("documents").select("storage_path").eq("id", vue.documentId).maybeSingle()
  if (!doc?.storage_path) return null

  const { data } = await sb.storage
    .from("documents").createSignedUrl(String(doc.storage_path), 3600)
  return data?.signedUrl ?? null
}

export async function marquerConsultation(
  jeton: string, ip?: string | null, agent?: string | null
): Promise<void> {
  await service().rpc("consulter_par_jeton", {
    p_token_hash: empreinte(jeton), p_ip: ip ?? null, p_agent: agent ?? null,
  })
}

export interface ResultatPublic {
  ok: boolean
  message: string
  complete?: boolean
}

export async function signerParJeton(
  jeton: string,
  courriel: string,
  trace: string | null,
  champs: { id: string; valeur: string }[],
  ip?: string | null,
  agent?: string | null
): Promise<ResultatPublic> {
  const { data, error } = await service().rpc("signer_par_jeton", {
    p_token_hash: empreinte(jeton),
    p_courriel: courriel,
    p_trace: trace,
    p_champs: champs,
    p_ip: ip ?? null,
    p_agent: agent ?? null,
  })

  if (error) {
    // Le message de Postgres n'est pas montré au signataire : il nommerait des
    // tables et des contraintes. On garde le sien pour le journal du serveur.
    console.error("signer_par_jeton :", error.message)
    return { ok: false, message: "La signature n'a pas pu être enregistrée. Réessayez." }
  }

  const r = (data ?? {}) as { ok?: boolean; message?: string; complete?: boolean }
  return {
    ok: r.ok === true,
    message: r.message ?? (r.ok ? "Signature enregistrée." : "Signature refusée."),
    complete: r.complete === true,
  }
}

export async function refuserParJeton(
  jeton: string, motif?: string, ip?: string | null, agent?: string | null
): Promise<ResultatPublic> {
  const { data, error } = await service().rpc("refuser_par_jeton", {
    p_token_hash: empreinte(jeton),
    p_motif: motif ?? null,
    p_ip: ip ?? null,
    p_agent: agent ?? null,
  })
  if (error) {
    console.error("refuser_par_jeton :", error.message)
    return { ok: false, message: "Le refus n'a pas pu être enregistré. Réessayez." }
  }
  const r = (data ?? {}) as { ok?: boolean; message?: string }
  return { ok: r.ok === true, message: r.message ?? "Refus enregistré." }
}
