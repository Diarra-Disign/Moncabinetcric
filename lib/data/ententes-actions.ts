"use server"

import { revalidatePath } from "next/cache"
import { getSessionSupabase, getCurrentMember } from "@/lib/supabase/session"
import { chercherContractants, chargerContractant } from "./ententes"
import { ligneDePartie, partieDepuisCabinet } from "@/lib/ententes/contractant"
import { verifierAvantGeneration, variablesDe, substituer } from "@/lib/ententes/variables"
import type { ContexteEntente } from "@/lib/ententes/variables"
import { recalculer, verifierEcheancier, type EtapePaiement } from "@/lib/ententes/echeancier"

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

  // ── Le contenu personnalisé du brouillon ────────────────────────────────
  /** La description libre du mandat (§3, §15). */
  servicesDescription?: string
  /** Les services décomposés (§4). */
  servicesItems?: { position: number; libelle: string }[]
  /** L'échéancier (§6). Vide : le contrat ne prévoit pas d'échelonnement. */
  echeancier?: EtapePaiement[]
  /** Les modes acceptés (§11). */
  modesPaiement?: string[]
  /** Les conditions particulières (§13). */
  conditionsPaiement?: string
  /** Les frais non inclus (§14). */
  fraisNonInclus?: string
  /** Spécifique à la consultation */
  consultationDurationMinutes?: number
  consultationDateTime?: string
  consultationMode?: string
  consultationNotes?: string
}

/**
 * Le contenu personnalisé, prêt à écrire.
 *
 * Une seule fonction pour la création ET la modification d'un brouillon : deux
 * traductions auraient fini par écrire l'échéancier d'un côté et l'oublier de
 * l'autre — et le contrat serait parti sans ses étapes de paiement.
 *
 * L'échéancier est RECALCULÉ ici, sur le serveur. L'écran calcule aussi, pour
 * répondre à chaque frappe, mais c'est cette valeur-ci qui est écrite : une
 * charge fabriquée sans l'écran ne doit pas pouvoir poser des montants qui ne
 * correspondent à aucun pourcentage.
 */
function contenuPersonnalise(d: Partial<DemandeEntente>, honoraires: number) {
  const etapes = recalculer(d.echeancier ?? [], honoraires)
    .map((e, i) => ({ ...e, position: i + 1, statut: e.statut ?? "a_venir" }))

  return {
    services_description: (d.servicesDescription ?? "").trim() || null,
    services_items: (d.servicesItems ?? [])
      .map((x, i) => ({ position: i + 1, libelle: String(x.libelle ?? "").trim() }))
      .filter((x) => x.libelle),
    payment_schedule: etapes,
    payment_methods: d.modesPaiement ?? [],
    payment_conditions: (d.conditionsPaiement ?? "").trim() || null,
    excluded_fees: (d.fraisNonInclus ?? "").trim() || null,
  }
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
      consultation: {
        dureeMinutes: demande.consultationDurationMinutes,
        dateHeure: demande.consultationDateTime,
        mode: demande.consultationMode,
        notes: demande.consultationNotes,
      },
      mandat: {
        descriptionServices: demande.servicesDescription || (demande.servicesItems && demande.servicesItems.length > 0 ? demande.servicesItems.map((s, i) => `${i + 1}. ${s.libelle}`).join("\n") : undefined),
        exclusionsSpecifiques: demande.fraisNonInclus || undefined,
        echeancierDescription: demande.echeancier && demande.echeancier.length > 0
          ? demande.echeancier.map((e, i) => `${i + 1}. ${e.description || 'Étape ' + (i + 1)} : ${e.montant} $ CAD (${e.declenchement || 'À l\'échéance'})`).join("\n")
          : undefined,
      },
    }

    const controle = verifierAvantGeneration(contexte, retenus.map((a) => `${a.titleFr}\n${a.bodyFr}`))
    if (!controle.ok) {
      return { ok: false, message: controle.manquants.join(" ") }
    }

    // L'échéancier est contrôlé ICI aussi, et pas seulement à l'écran (§9) :
    // un contrat dont les versements ne totalisent pas les honoraires ferait
    // naître un litige sur le solde.
    const manquesEcheancier = verifierEcheancier(
      demande.echeancier ?? [], demande.honoraires, demande.proBono
    )
    if (manquesEcheancier.length > 0) {
      return { ok: false, message: manquesEcheancier.join(" ") }
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
        ...contenuPersonnalise(demande, demande.honoraires),
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
 * Relit un BROUILLON pour le rouvrir dans l'éditeur (§25).
 *
 * Seuls les brouillons sont rendus modifiables. Une entente émise a produit un
 * PDF, porte une empreinte et a pu être envoyée : la rouvrir « pour corriger
 * une virgule » modifierait le document sous la signature. Le §26 l'interdit,
 * et la réponse à une erreur découverte après coup est un AVENANT — que la
 * colonne `replaces_id` sait déjà porter.
 */
export async function chargerBrouillon(id: string) {
  const sb = await getSessionSupabase()
  const { data } = await sb
    .from("agreements")
    .select("id, reference, title, kind, status, is_probono, fees_amount, taxes_amount, total_amount, template_id, client_id, lead_id, articles_snapshot, services_description, services_items, payment_schedule, payment_methods, payment_conditions, excluded_fees")
    .eq("id", id)
    .maybeSingle()

  if (!data) return null
  return {
    id: String(data.id),
    reference: String(data.reference ?? ""),
    titre: String(data.title ?? ""),
    kind: String(data.kind ?? ""),
    statut: String(data.status ?? "draft"),
    modifiable: data.status === "draft",
    proBono: data.is_probono === true,
    honoraires: Number(data.fees_amount ?? 0),
    taxes: Number(data.taxes_amount ?? 0),
    templateId: data.template_id ? String(data.template_id) : "",
    contractantType: (data.client_id ? "client" : "lead") as "client" | "lead",
    contractantId: String(data.client_id ?? data.lead_id ?? ""),
    articles: (data.articles_snapshot as { code: string; title_fr: string; body_fr: string; level: string; position: number }[]) ?? [],
    servicesDescription: String(data.services_description ?? ""),
    servicesItems: (data.services_items as { position: number; libelle: string }[]) ?? [],
    echeancier: (data.payment_schedule as EtapePaiement[]) ?? [],
    modesPaiement: (data.payment_methods as string[]) ?? [],
    conditionsPaiement: String(data.payment_conditions ?? ""),
    fraisNonInclus: String(data.excluded_fees ?? ""),
  }
}

/**
 * Enregistre les modifications d'un BROUILLON (§24).
 *
 * Le consultant n'a pas à terminer un contrat en une seule séance. Ce qui est
 * réenregistré ici est le contenu personnalisé et les montants — pas le
 * contractant ni le modèle, qui définissent l'identité du document : les
 * changer reviendrait à faire un autre contrat sous le même numéro.
 *
 * LE VERROU EST EN BASE, PAS ICI. Le filtre `.eq("status", "draft")` fait que
 * l'UPDATE ne trouve AUCUNE ligne sur une entente émise — et `.select("id")`
 * transforme ce « zéro ligne » en refus explicite. Sans lui, PostgREST rendrait
 * « succès, zéro ligne » et l'écran annoncerait un enregistrement qui n'a pas
 * eu lieu. C'est exactement le défaut corrigé sur les paramètres du cabinet.
 */
export async function modifierBrouillon(
  id: string,
  demande: Partial<DemandeEntente> & { honoraires: number; taxes: number }
): Promise<Resultat> {
  try {
    await moi()
    const sb = await getSessionSupabase()

    const manques = verifierEcheancier(
      demande.echeancier ?? [], demande.honoraires, demande.proBono
    )
    if (manques.length > 0) return { ok: false, message: manques.join(" ") }

    const updates: Record<string, unknown> = {
      fees_amount: demande.honoraires,
      taxes_amount: demande.taxes,
      total_amount: demande.honoraires + demande.taxes,
      ...contenuPersonnalise(demande, demande.honoraires),
      updated_at: new Date().toISOString(),
    }

    if (demande.articles && demande.articles.length > 0) {
      updates.articles_snapshot = demande.articles
        .filter((a) => a.enabled)
        .sort((x, y) => x.position - y.position)
        .map((a, i) => ({
          position: i + 1,
          code: a.code,
          title_fr: a.titleFr,
          body_fr: a.bodyFr,
          level: a.level,
        }))
    }

    const { data, error } = await sb
      .from("agreements")
      .update(updates)
      .eq("id", id)
      .eq("status", "draft")
      .select("id")

    if (error) return { ok: false, message: error.message }
    if (!data || data.length === 0) {
      return {
        ok: false,
        message:
          "Cette entente n'est plus un brouillon : elle a été émise et son " +
          "document est figé. Créez un avenant pour la modifier.",
      }
    }

    revalidatePath("/fr/agreements")
    return { ok: true, message: "Brouillon enregistré.", id }
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
 * L'échéancier d'une entente, avec l'état réel de chaque étape (§28).
 */
export async function suiviEcheancier(id: string) {
  const sb = await getSessionSupabase()
  const { suivreEcheancier } = await import("@/lib/ententes/facturation")
  return suivreEcheancier(sb, id)
}

/**
 * Crée la facture d'une étape (§27).
 *
 * JAMAIS AUTOMATIQUE. Une facture émise porte un numéro dans une suite
 * continue, et ce numéro ne se reprend pas : une facture créée toute seule au
 * mauvais moment devrait être annulée — pas supprimée — et laisserait un trou
 * à expliquer dans le registre du cabinet.
 */
export async function facturerEtapeEntente(
  id: string,
  rang: number,
  dueOn?: string
): Promise<Resultat & { numero?: string }> {
  try {
    const membre = await moi()
    const sb = await getSessionSupabase()
    const { facturerEtape } = await import("@/lib/ententes/facturation")
    const r = await facturerEtape(sb, membre, id, rang, { dueOn })
    if (r.ok) {
      revalidatePath("/fr/agreements")
      revalidatePath("/fr/billing")
    }
    return r
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

/**
 * Ouvre la demande de signature sur l'entente émise.
 *
 * ─── LE CHEMIN EST CELUI DU MODULE, PLUS L'ANCIEN ──────────────────────────
 *
 * Cette fonction appelait `demanderSignature()`, qui insérait une ligne NUE
 * dans `signature_requests` : aucun destinataire, aucun champ, aucun jeton,
 * aucun verrou, aucun courriel. La demande existait en base et n'était
 * recevable par personne. Le client n'a jamais rien reçu, et la section « à
 * signer par vous » ne pouvait pas se remplir puisqu'aucun destinataire
 * n'avait été créé.
 *
 * Elle passe désormais par `envoyerEnSignature()`, c'est-à-dire par
 * `SignatureService` — le même chemin que l'onglet Signature d'un dossier.
 * Un seul écrivain sur la table, un seul comportement à éprouver.
 *
 * ─── LES SIGNATAIRES SONT DÉDUITS, PAS SAISIS ──────────────────────────────
 *
 * Le client vient de l'entente ; le consultant, du cabinet et du membre qui
 * agit. Faire saisir l'adresse du consultant à chaque envoi produirait tôt ou
 * tard une faute de frappe sur le signataire qui répond du dossier.
 */
export async function envoyerPourSignature(id: string, note?: string): Promise<Resultat> {
  try {
    const membre = await moi()
    const sb = await getSessionSupabase()

    const { data: entente } = await sb
      .from("agreements")
      .select("reference, title, status, document_id, client_id, lead_id")
      .eq("id", id)
      .maybeSingle()

    if (!entente) return { ok: false, message: "Cette entente est introuvable." }
    if (!entente.document_id) {
      return { ok: false, message: "Émettez d'abord l'entente : il n'y a pas encore de document à signer." }
    }

    // ── Qui signe, et dans quel ordre ──────────────────────────────────────
    const signataire = await signataireDeLEntente(sb, entente)
    if (!signataire) {
      return {
        ok: false,
        message: "Le destinataire de cette entente est introuvable : impossible de savoir à qui l'envoyer.",
      }
    }
    if (!signataire.courriel) {
      return {
        ok: false,
        message: `${signataire.nom} n'a pas d'adresse courriel. Ajoutez-la à sa fiche : ` +
          "c'est par là que part le lien de signature.",
      }
    }

    const { data: cabinet } = await sb
      .from("firms").select("rcic_license_number").eq("id", membre.firmId).maybeSingle()

    const { envoyerEnSignature } = await import("./signature-actions")
    const envoi = await envoyerEnSignature(
      String(entente.document_id),
      [
        // Le client d'abord : c'est lui qui s'engage, et le consultant
        // contresigne ce qui a été accepté.
        { role: "client", nom: signataire.nom, courriel: signataire.courriel, rang: 1 },
        {
          role: "consultant",
          nom: membre.fullName || String(cabinet?.rcic_license_number ?? "Le consultant"),
          courriel: membre.email,
          permis: cabinet?.rcic_license_number ? String(cabinet.rcic_license_number) : undefined,
          rang: 2,
        },
      ],
      { mode: "sequential" }
    )
    if (!envoi.ok) return { ok: false, message: envoi.message, id: envoi.demandeId }

    // L'entente suit son document. En cas d'échec ici, la demande existe et
    // les liens sont partis : on le dit plutôt que de prétendre le contraire.
    const { error } = await sb.from("agreements").update({ status: "sent" }).eq("id", id)
    if (error) {
      return {
        ok: true,
        id: envoi.demandeId,
        message: `${envoi.message} L'état de ${entente.reference} n'a pas pu être mis à jour : ${error.message}`,
      }
    }

    revalidatePath("/fr/agreements")
    revalidatePath("/fr/signatures")
    return {
      ok: true,
      id: envoi.demandeId,
      message: `${entente.reference} est partie en signature. ${envoi.message}`,
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

/**
 * Renvoie le lien de signature d'une entente déjà partie.
 *
 * §13 — TROIS CLICS NE FONT PAS TROIS DEMANDES. Une fois l'entente envoyée, le
 * bouton ne rouvre plus une demande : il relance celle qui existe, ce qui
 * engendre un jeton neuf et révoque le précédent.
 */
export async function relancerEntente(id: string): Promise<Resultat> {
  try {
    const sb = await getSessionSupabase()

    const { data: entente } = await sb
      .from("agreements").select("reference, document_id").eq("id", id).maybeSingle()
    if (!entente?.document_id) {
      return { ok: false, message: "Cette entente n'a pas de document à signer." }
    }

    const { data: demande } = await sb
      .from("signature_requests")
      .select("id")
      .eq("document_id", entente.document_id)
      .in("status", ["sent", "viewed", "partially_signed"])
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!demande) {
      return {
        ok: false,
        message: "Aucune demande de signature en cours sur cette entente. " +
          "Elle a peut-être été annulée, refusée ou déjà signée.",
      }
    }

    const { relancerSignature } = await import("./signature-actions")
    const r = await relancerSignature(String(demande.id))
    if (r.ok) revalidatePath("/fr/agreements")
    return { ...r, id: String(demande.id) }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

/**
 * Le signataire d'en face : le client, ou le prospect quand l'entente précède
 * la conversion.
 *
 * Une entente peut naître sur un PROSPECT — c'est même le cas courant : on
 * signe l'entente, puis le prospect devient client. Ne regarder que
 * `client_id` laisserait ces ententes sans destinataire.
 */
async function signataireDeLEntente(
  sb: Awaited<ReturnType<typeof getSessionSupabase>>,
  entente: { client_id?: string | null; lead_id?: string | null }
): Promise<{ nom: string; courriel: string } | null> {
  if (entente.client_id) {
    const { data } = await sb
      .from("clients").select("name, first_name, last_name, email")
      .eq("id", entente.client_id).maybeSingle()
    if (!data) return null
    const nom = String(data.name ?? "").trim() ||
      [data.first_name, data.last_name].filter(Boolean).join(" ").trim()
    return { nom, courriel: String(data.email ?? "").trim() }
  }

  if (entente.lead_id) {
    const { data } = await sb
      .from("leads").select("first_name, last_name, email")
      .eq("id", entente.lead_id).maybeSingle()
    if (!data) return null
    return {
      nom: [data.first_name, data.last_name].filter(Boolean).join(" ").trim(),
      courriel: String(data.email ?? "").trim(),
    }
  }

  return null
}

/**
 * Enregistre un ensemble d'articles personnalisés comme NOUVEAU MODÈLE réutilisable pour le cabinet.
 */
export async function sauvegarderModelePersonnalise({
  titre,
  description,
  kind,
  articles,
}: {
  titre: string
  description?: string
  kind: string
  articles: ArticleEntente[]
}): Promise<Resultat> {
  try {
    const m = await moi()
    const sb = await getSessionSupabase()

    const code = `custom_${kind}_${Date.now().toString(36)}`

    const { data: template, error: errTpl } = await sb
      .from("agreement_templates")
      .insert({
        firm_id: m.firmId,
        code,
        kind,
        title_fr: titre,
        title_en: titre,
        description_fr: description || "Modèle personnalisé du cabinet",
        description_en: description || "Custom firm template",
        version: "1.0",
        is_default: false,
        created_by: m.profileId,
      })
      .select("id")
      .single()

    if (errTpl) return { ok: false, message: errTpl.message }

    const articlesAInserer = articles
      .filter((a) => a.enabled)
      .map((a, idx) => ({
        firm_id: m.firmId,
        template_id: template.id,
        position: (idx + 1) * 10,
        code: a.code,
        title_fr: a.titleFr,
        title_en: a.titleFr,
        body_fr: a.bodyFr,
        body_en: a.bodyFr,
        level: "free",
        enabled: true,
        optional: false,
      }))

    if (articlesAInserer.length > 0) {
      const { error: errArt } = await sb
        .from("agreement_template_articles")
        .insert(articlesAInserer)

      if (errArt) return { ok: false, message: errArt.message }
    }

    revalidatePath("/fr/agreements")
    return { ok: true, message: `Modèle « ${titre} » enregistré avec succès.`, id: template.id }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

/**
 * Supprime un modèle personnalisé du cabinet.
 * Ne permet JAMAIS la suppression d'un modèle système officiel (firm_id IS NULL).
 */
export async function supprimerModelePersonnalise(templateId: string): Promise<Resultat> {
  try {
    const m = await moi()
    const sb = await getSessionSupabase()

    const { data: template, error: errCheck } = await sb
      .from("agreement_templates")
      .select("id, firm_id, title_fr")
      .eq("id", templateId)
      .maybeSingle()

    if (errCheck || !template) {
      return { ok: false, message: "Modèle introuvable." }
    }

    if (!template.firm_id || template.firm_id !== m.firmId) {
      return {
        ok: false,
        message: "Les modèles officiels du système ne peuvent pas être supprimés.",
      }
    }

    const { error: errDel } = await sb
      .from("agreement_templates")
      .delete()
      .eq("id", templateId)
      .eq("firm_id", m.firmId)

    if (errDel) return { ok: false, message: errDel.message }

    revalidatePath("/fr/agreements")
    return {
      ok: true,
      message: `Le modèle « ${template.title_fr} » a été supprimé avec succès.`,
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}
