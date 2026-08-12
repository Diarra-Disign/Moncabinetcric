"use server"

import { revalidatePath } from "next/cache"
import { getSessionSupabase, getCurrentMember } from "@/lib/supabase/session"
import { chercherContractants, chargerContractant } from "./ententes"
import { ligneDePartie } from "@/lib/ententes/contractant"
import { verifierAvantGeneration, variablesDe, substituer } from "@/lib/ententes/variables"
import type { ContexteEntente } from "@/lib/ententes/variables"

export interface Resultat {
  ok: boolean
  message: string
  id?: string
}

async function moi() {
  const membre = await getCurrentMember()
  if (!membre) throw new Error("Session expirée. Reconnectez-vous.")
  return membre
}

/** Recherche d'un contractant (§4). Enveloppe l'appel serveur pour l'écran. */
export async function rechercherContractant(recherche: string) {
  return chercherContractants(recherche)
}

/** Pré-remplissage après sélection (§5). */
export async function preremplir(type: "client" | "lead", id: string) {
  return chargerContractant(type, id)
}

export interface ArticleEntente {
  code: string
  titleFr: string
  bodyFr: string
  level: string
  enabled: boolean
  position: number
}

/** Les modèles disponibles, système et du cabinet. */
export async function listerModelesEntente() {
  const sb = await getSessionSupabase()
  const { data } = await sb
    .from("agreement_templates")
    .select("id, firm_id, code, kind, title_fr, description_fr, version, is_default")
    .order("firm_id", { nullsFirst: false })
    .order("title_fr")
  return (data ?? []).map((m) => ({
    id: String(m.id),
    duCabinet: Boolean(m.firm_id),
    code: String(m.code),
    kind: String(m.kind),
    titre: String(m.title_fr),
    description: String(m.description_fr ?? ""),
    version: String(m.version ?? "1.0"),
    parDefaut: Boolean(m.is_default),
  }))
}

/** Les articles d'un modèle, dans l'ordre, prêts à cocher et à réordonner. */
export async function articlesDuModele(templateId: string): Promise<ArticleEntente[]> {
  const sb = await getSessionSupabase()
  const { data } = await sb
    .from("agreement_template_articles")
    .select("code, title_fr, body_fr, level, position, enabled")
    .eq("template_id", templateId)
    .order("position")
  return (data ?? []).map((a) => ({
    code: String(a.code),
    titleFr: String(a.title_fr),
    bodyFr: String(a.body_fr ?? ""),
    level: String(a.level ?? "free"),
    // Un article structurel arrive coché et le reste : en retirer un rendrait
    // l'entente incomplète pour un consultant réglementé.
    enabled: a.level === "structural" ? true : Boolean(a.enabled),
    position: Number(a.position ?? 0),
  }))
}

/**
 * Le prochain numéro d'entente du cabinet.
 *
 * Compté sur les ententes existantes plutôt que par une séquence : le préfixe
 * suit le cabinet, et deux cabinets doivent pouvoir porter ENT-2026-0001 sans
 * se gêner. Le conflit éventuel est rattrapé par l'index unique
 * (firm_id, reference), qui est la seule garantie réelle.
 */
async function prochaineReference(sb: Awaited<ReturnType<typeof getSessionSupabase>>, firmId: string) {
  const annee = new Date().getFullYear()
  const { count } = await sb
    .from("agreements")
    .select("id", { count: "exact", head: true })
    .eq("firm_id", firmId)
    .like("reference", `ENT-${annee}-%`)
  return `ENT-${annee}-${String((count ?? 0) + 1).padStart(4, "0")}`
}

export interface DemandeEntente {
  templateId: string
  contractantType: "client" | "lead"
  contractantId: string
  matterId?: string
  titre: string
  kind: string
  proBono: boolean
  honoraires: number
  taxes: number
  articles: ArticleEntente[]
  /** Corrections propres au contrat (§6) : elles ne réécrivent pas la fiche. */
  corrections?: Record<string, string>
}

/**
 * Crée une entente en brouillon.
 *
 * Le §29 est appliqué ICI et pas seulement à l'écran : l'action est la
 * frontière, et elle reste appelable sans lui. Un contrat auquel il manque
 * l'adresse du client ou le permis du consultant n'est pas créé — et le refus
 * NOMME ce qui manque, parce que « informations incomplètes » ne dit pas où
 * retourner.
 */
export async function creerEntente(demande: DemandeEntente): Promise<Resultat> {
  try {
    const membre = await moi()
    const sb = await getSessionSupabase()

    const source = await chargerContractant(demande.contractantType, demande.contractantId)
    if (!source) return { ok: false, message: "Ce contractant est introuvable." }

    // Les corrections du contrat s'appliquent à la copie, jamais à la fiche.
    const partie = { ...source.partie, ...(demande.corrections ?? {}) }

    const retenus = demande.articles
      .filter((a) => a.enabled)
      .sort((x, y) => x.position - y.position)

    const contexte: ContexteEntente = {
      contractant: partie,
      cabinet: source.cabinet,
      montants: {
        honoraires: demande.honoraires,
        taxes: demande.taxes,
        total: demande.honoraires + demande.taxes,
      },
      entente: {
        numero: await prochaineReference(sb, membre.firmId),
        date: new Date().toISOString().slice(0, 10),
        titre: demande.titre,
      },
      locale: "fr",
      proBono: demande.proBono,
    }

    const controle = verifierAvantGeneration(contexte, retenus.map((a) => `${a.titleFr}\n${a.bodyFr}`))
    if (!controle.ok) {
      return { ok: false, message: controle.manquants.join(" ") }
    }

    // Le texte est FIGÉ ici, substitution comprise. L'instantané ne garde pas
    // les variables mais leur résultat : le contrat doit rester lisible même
    // si la fiche change, et c'est tout l'objet du §18.
    const variables = variablesDe(contexte)
    const instantane = retenus.map((a, i) => ({
      position: i + 1,
      code: a.code,
      title_fr: substituer(a.titleFr, variables).texte,
      body_fr: substituer(a.bodyFr, variables).texte,
      level: a.level,
    }))

    const { data: creee, error } = await sb
      .from("agreements")
      .insert({
        firm_id: membre.firmId,
        client_id: demande.contractantType === "client" ? demande.contractantId : null,
        lead_id: demande.contractantType === "lead" ? demande.contractantId : null,
        matter_id: demande.matterId || null,
        template_id: demande.templateId,
        template_version: "1.0",
        reference: contexte.entente.numero,
        title: demande.titre,
        kind: demande.kind,
        status: "draft",
        articles_snapshot: instantane,
        fees_amount: demande.honoraires,
        taxes_amount: demande.taxes,
        total_amount: demande.honoraires + demande.taxes,
        is_probono: demande.proBono,
        created_by: membre.profileId,
      })
      .select("id")
      .single()

    if (error) return { ok: false, message: error.message }

    // Toutes les colonnes, même vides : PostgREST unifie le jeu de colonnes
    // d'un insert groupé, et une partie sans courriel ferait échouer l'insert
    // entier.
    const parties = [
      { ...ligneDePartie(partie, "client", 1), firm_id: membre.firmId, agreement_id: creee.id },
      {
        ...ligneDePartie(
          {
            civility: source.cabinet.civiliteConsultant,
            firstName: "", lastName: source.cabinet.consultant,
            email: source.cabinet.courriel, phone: source.cabinet.telephone,
            address: source.cabinet.adresse,
          },
          "consultant", 2
        ),
        firm_id: membre.firmId, agreement_id: creee.id,
      },
    ]
    const { error: ePartie } = await sb.from("agreement_parties").insert(parties)
    if (ePartie) {
      console.error("creerEntente : entente créée, parties non enregistrées —", ePartie.message)
    }

    revalidatePath("/fr/agreements")
    return { ok: true, message: `${contexte.entente.numero} créée en brouillon.`, id: String(creee.id) }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}
