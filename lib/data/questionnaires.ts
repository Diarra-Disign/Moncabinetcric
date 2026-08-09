import "server-only"

import { getSessionSupabase, getCurrentMember } from "@/lib/supabase/session"
import { toQuestionnaire, toQuestionnaireTemplate } from "./supabase/mappers"
import type { ClientQuestionnaire, QuestionnaireTemplateRecord } from "./types"

/**
 * Une ligne Postgres telle qu'elle revient.
 *
 * supabase-js n'infère la forme du résultat que depuis un littéral de
 * sélection. Nos sélections viennent de constantes partagées — pour que la
 * liste des colonnes n'existe qu'à un seul endroit — et l'inférence retombe
 * alors sur un type d'erreur. La conversion est donc explicite ici, une fois,
 * plutôt que dispersée en `as any` sur chaque appel.
 */
type Ligne = Record<string, unknown>

/**
 * Lectures de la bibliothèque de questionnaires.
 *
 * Toutes passent par le client de session : c'est la base qui décide de ce
 * qui est visible. Aucune ne filtre par cabinet dans le code — le filtre
 * existe, mais comme seconde ligne, jamais comme seule barrière.
 */

const CHAMPS_MODELE =
  "id, firm_id, slug, title_fr, title_en, description_fr, description_en, " +
  "sections, message_fr, message_en, is_default_preconsultation, active, updated_at"

const CHAMPS_ENVOI =
  "*, clients(legacy_id, name, email), leads(legacy_id, name, email), matters(reference)"

/**
 * La bibliothèque : modèles système et modèles du cabinet, ensemble.
 *
 * Le nombre d'utilisations est COMPTÉ, pas tenu à jour dans une colonne. Un
 * compteur incrémenté à chaque envoi se serait désynchronisé au premier
 * questionnaire supprimé, et rien ne l'aurait signalé — on aurait lu « utilisé
 * 37 fois » à côté de 31 envois réels, sans savoir lequel des deux croire.
 */
export async function listerModeles(): Promise<QuestionnaireTemplateRecord[]> {
  const sb = await getSessionSupabase()

  const [{ data: modeles }, { data: envois }] = await Promise.all([
    sb.from("questionnaire_templates").select(CHAMPS_MODELE).eq("active", true).order("title_fr"),
    sb.from("client_questionnaires").select("template_id"),
  ])

  const usages = new Map<string, number>()
  for (const e of envois ?? []) {
    const id = (e as { template_id: string | null }).template_id
    if (id) usages.set(id, (usages.get(id) ?? 0) + 1)
  }

  return ((modeles ?? []) as unknown as Ligne[]).map((m) =>
    toQuestionnaireTemplate({ ...m, usage_count: usages.get(String(m.id)) ?? 0 })
  )
}

export async function modeleParId(id: string): Promise<QuestionnaireTemplateRecord | null> {
  const sb = await getSessionSupabase()
  const { data } = await sb.from("questionnaire_templates").select(CHAMPS_MODELE).eq("id", id).maybeSingle()
  return data ? toQuestionnaireTemplate(data as unknown as Ligne) : null
}

/**
 * Le questionnaire proposé d'emblée depuis une fiche prospect (§23).
 *
 * Celui du cabinet l'emporte sur celui du système : un cabinet qui a défini
 * le sien a dit ce qu'il voulait voir proposé.
 */
export async function modelePreconsultationParDefaut(): Promise<QuestionnaireTemplateRecord | null> {
  const sb = await getSessionSupabase()
  const { data } = await sb
    .from("questionnaire_templates")
    .select(CHAMPS_MODELE)
    .eq("is_default_preconsultation", true)
    .eq("active", true)
    .order("firm_id", { ascending: false, nullsFirst: false })
    .limit(1)
  const m = ((data ?? []) as unknown as Ligne[])[0]
  return m ? toQuestionnaireTemplate(m) : null
}

/** Tous les envois du cabinet, du plus récent au plus ancien. */
export async function listerEnvois(): Promise<ClientQuestionnaire[]> {
  const sb = await getSessionSupabase()
  const { data } = await sb
    .from("client_questionnaires")
    .select(CHAMPS_ENVOI)
    .order("created_at", { ascending: false })
  return ((data ?? []) as unknown as Ligne[]).map(toQuestionnaire)
}

export async function envoiParId(id: string): Promise<ClientQuestionnaire | null> {
  const sb = await getSessionSupabase()
  const { data } = await sb.from("client_questionnaires").select(CHAMPS_ENVOI).eq("id", id).maybeSingle()
  return data ? toQuestionnaire(data as unknown as Ligne) : null
}

export async function envoisDuClient(clientUuid: string): Promise<ClientQuestionnaire[]> {
  const sb = await getSessionSupabase()
  const { data } = await sb
    .from("client_questionnaires")
    .select(CHAMPS_ENVOI)
    .eq("client_id", clientUuid)
    .order("created_at", { ascending: false })
  return ((data ?? []) as unknown as Ligne[]).map(toQuestionnaire)
}

export async function envoisDuProspect(leadUuid: string): Promise<ClientQuestionnaire[]> {
  const sb = await getSessionSupabase()
  const { data } = await sb
    .from("client_questionnaires")
    .select(CHAMPS_ENVOI)
    .eq("lead_id", leadUuid)
    .order("created_at", { ascending: false })
  return ((data ?? []) as unknown as Ligne[]).map(toQuestionnaire)
}

export interface Destinataire {
  /** L'uuid, celui qu'attend la base — pas le legacy_id affiché ailleurs. */
  id: string
  type: "client" | "lead"
  nom: string
  courriel: string
  telephone: string
  /** Référence du dossier, quand il y en a un. */
  dossier?: string
}

/**
 * Les personnes à qui l'on peut envoyer un questionnaire.
 *
 * Un prospect déjà converti en client n'apparaît pas : lui écrire en tant que
 * prospect rattacherait ses réponses à une fiche que plus personne ne
 * consulte.
 */
export async function listerDestinataires(): Promise<Destinataire[]> {
  const sb = await getSessionSupabase()

  const [{ data: clients }, { data: prospects }] = await Promise.all([
    sb.from("clients").select("id, name, email, phone, file_number").order("name"),
    sb.from("leads").select("id, name, email, phone, converted_client_id").order("name"),
  ])

  const cs: Destinataire[] = (clients ?? []).map((c) => ({
    id: String(c.id),
    type: "client" as const,
    nom: String(c.name ?? ""),
    courriel: String(c.email ?? ""),
    telephone: String(c.phone ?? ""),
    dossier: c.file_number ? String(c.file_number) : undefined,
  }))

  const ps: Destinataire[] = (prospects ?? [])
    .filter((p) => !p.converted_client_id)
    .map((p) => ({
      id: String(p.id),
      type: "lead" as const,
      nom: String(p.name ?? ""),
      courriel: String(p.email ?? ""),
      telephone: String(p.phone ?? ""),
    }))

  return [...cs, ...ps]
}

/** Le cabinet du membre connecté, pour signer les courriels. */
export async function cabinetCourant(): Promise<{ id: string; nom: string; courriel: string; telephone: string }> {
  const membre = await getCurrentMember()
  if (!membre) throw new Error("Session expirée.")
  const sb = await getSessionSupabase()
  const { data } = await sb.from("firms").select("id, name, email, phone").eq("id", membre.firmId).maybeSingle()
  return {
    id: membre.firmId,
    nom: String(data?.name ?? membre.firmName ?? ""),
    courriel: String(data?.email ?? ""),
    telephone: String(data?.phone ?? ""),
  }
}
