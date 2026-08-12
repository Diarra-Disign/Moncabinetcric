"use server"

import { revalidatePath } from "next/cache"
import { getSessionSupabase, getCurrentMember } from "@/lib/supabase/session"
import { chercherContractants, chargerContractant } from "./ententes"
import { ligneDePartie, partieDepuisCabinet } from "@/lib/ententes/contractant"
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

export interface EntenteListee {
  id: string
  reference: string
  titre: string
  statut: string
  proBono: boolean
  total: number
  date: string
  contractant: string
  /** Le PDF, une fois émis. Absent, l'entente est encore un brouillon. */
  documentId: string | null
}

/**
 * Les ententes du cabinet, les vraies.
 *
 * L'écran affichait jusqu'ici `getAgreements()`, qui rend un tableau VIDE dès
 * que la source est Supabase — la liste était donc peuplée par des données de
 * démonstration en développement et désespérément vide en production. Ce
 * lecteur-ci passe par le client de session, donc par RLS.
 */
export async function listerEntentes(limite = 100): Promise<EntenteListee[]> {
  const sb = await getSessionSupabase()
  const { data } = await sb
    .from("agreements")
    // Un LITTÉRAL, jamais une chaîne assemblée : l'analyseur de types de
    // PostgREST lit le texte de la sélection, et une concaténation le rend
    // incapable de dire ce qu'il rendra. Le piège avait déjà mordu dans
    // ententes.ts.
    .select("id, reference, title, status, is_probono, total_amount, issued_at, created_at, document_id, clients(name), leads(name)")
    .order("created_at", { ascending: false })
    .limit(limite)

  return (data ?? []).map((e) => {
    const client = e.clients as unknown as { name?: string } | null
    const prospect = e.leads as unknown as { name?: string } | null
    return {
      id: String(e.id),
      reference: String(e.reference ?? ""),
      titre: String(e.title ?? ""),
      statut: String(e.status ?? "draft"),
      proBono: e.is_probono === true,
      total: Number(e.total_amount ?? 0),
      date: String(e.issued_at ?? e.created_at ?? "").slice(0, 10),
      contractant: client?.name ?? prospect?.name ?? "",
      documentId: e.document_id ? String(e.document_id) : null,
    }
  })
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
    // Le consultant est recopié EN ENTIER — adresse complète et permis compris.
    // Sa copie ne retenait que la première ligne de son adresse : un contrat
    // relu deux ans plus tard n'aurait jamais retrouvé sa ville, et son permis
    // aurait été relu sur le cabinet, donc réécrit s'il changeait.
    const parties = [
      { ...ligneDePartie(partie, "client", 1), firm_id: membre.firmId, agreement_id: creee.id },
      {
        ...ligneDePartie(partieDepuisCabinet(source.cabinet), "consultant", 2),
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

/**
 * Émet l'entente : le PDF est composé, CLASSÉ au dossier, puis désigné.
 *
 * UN CONTRAT EST UN DOCUMENT, et c'est toute l'architecture de cette étape. La
 * chaîne de signature du produit s'accroche à `documents` — `signature_requests`
 * porte un `document_id` et une empreinte. Créer au contrat sa propre chaîne
 * aurait dupliqué ce qui existe, et donné deux façons de répondre à
 * « ce fichier est-il encore celui qui a été signé ? ».
 *
 * L'ordre importe. La FICHE d'abord, le FICHIER ensuite : `deposerFichier()` a
 * besoin de l'identifiant du document pour le ranger, et un fichier déposé sans
 * fiche serait un objet du stockage que rien ne référence. Si le dépôt échoue,
 * la fiche est retirée — un document qui s'affiche au dossier et ne s'ouvre
 * jamais est pire que pas de document.
 *
 * L'empreinte n'est pas calculée ici : `deposerFichier()` la calcule sur les
 * octets réellement déposés. C'est elle qui rendra la signature opposable, et
 * une empreinte calculée sur autre chose que le fichier déposé n'atteste rien.
 */
export async function emettreEntente(id: string): Promise<Resultat> {
  try {
    const membre = await moi()
    const sb = await getSessionSupabase()

    const { emettre } = await import("@/lib/ententes/emission")
    const resultat = await emettre(sb, membre, id)

    if (resultat.ok) {
      revalidatePath("/fr/agreements")
      revalidatePath("/[locale]/matters/[id]", "page")
    }
    return { ok: resultat.ok, message: resultat.message, id: resultat.documentId }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

/**
 * Ouvre la demande de signature sur l'entente émise.
 *
 * AUCUNE TABLE NEUVE : `demanderSignature()` fige l'empreinte du fichier et
 * refusera plus tard toute signature apposée sur un contenu différent. Le §25
 * était déjà satisfait par le produit — il fallait seulement lui donner un
 * document à signer.
 */
export async function envoyerPourSignature(id: string, note?: string): Promise<Resultat> {
  try {
    const sb = await getSessionSupabase()

    const { data: entente } = await sb
      .from("agreements")
      .select("reference, status, document_id")
      .eq("id", id)
      .maybeSingle()

    if (!entente) return { ok: false, message: "Cette entente est introuvable." }
    if (!entente.document_id) {
      return { ok: false, message: "Émettez d'abord l'entente : il n'y a pas encore de document à signer." }
    }

    const { demanderSignature } = await import("./signatures")
    const demande = await demanderSignature(String(entente.document_id), note)
    if (!demande.ok) return { ok: false, message: demande.erreur ?? "Demande refusée." }

    const { error } = await sb.from("agreements").update({ status: "sent" }).eq("id", id)
    if (error) return { ok: false, message: error.message }

    revalidatePath("/fr/agreements")
    return { ok: true, message: `${entente.reference} est en attente de signature.`, id: demande.requestId }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}
