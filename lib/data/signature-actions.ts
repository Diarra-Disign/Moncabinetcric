"use server"

import { revalidatePath } from "next/cache"
import { getSessionSupabase, getCurrentMember } from "@/lib/supabase/session"
import { SignatureService } from "@/lib/signature/service"
import type { DemandeSignature, EtatDemande, EntreeJournalSignature } from "@/lib/signature/contrat"
import type { EvenementSignature } from "@/lib/signature/statuts"
import { apparier, type EmplacementSignature } from "@/lib/ententes/emplacements"

/**
 * Les gestes du consultant sur les signatures.
 *
 * Ce module n'appelle QUE `SignatureService`. Il ne connaît aucun fournisseur,
 * et c'est ce qui permettra de passer à PandaDoc sans le toucher.
 *
 * ─── LE COURRIEL EST ENVOYÉ ICI, PAS DANS LE MOTEUR ────────────────────────
 *
 * Le moteur produit un lien ; l'envoi est une décision du CRM. Un fournisseur
 * externe enverra ses propres courriels — le jour venu, c'est cette fonction
 * qu'on adaptera, pas le moteur.
 */

export interface Resultat {
  ok: boolean
  message: string
}

async function moi() {
  const membre = await getCurrentMember()
  if (!membre) throw new Error("Session expirée. Reconnectez-vous.")
  return membre
}

async function service() {
  const membre = await moi()
  const sb = await getSessionSupabase()
  return {
    sb,
    membre,
    service: new SignatureService(sb, {
      firmId: membre.firmId,
      userId: membre.userId,
      profileId: membre.profileId,
      fullName: membre.fullName,
      email: membre.email,
    }),
  }
}

export interface DestinataireSaisi {
  role: string
  nom: string
  courriel: string
  permis?: string
  rang: number
}

/**
 * Crée une demande et l'envoie dans le même geste.
 *
 * Le brouillon existe dans le modèle — il sert à relire les signataires — mais
 * l'écran du consultant enchaîne les deux : dans la pratique, on ne prépare pas
 * une demande pour la laisser dormir. Le jour où un cabinet voudra les
 * séparer, `creerDemande` et `envoyerDemande` sont déjà distincts.
 */
export async function envoyerEnSignature(
  documentId: string,
  destinataires: DestinataireSaisi[],
  options: {
    mode?: "sequential" | "parallel"
    validiteJours?: number
    avecInitiales?: boolean
  } = {}
): Promise<Resultat & { demandeId?: string }> {
  try {
    const { sb, membre, service: svc } = await service()

    if (destinataires.length === 0) {
      return { ok: false, message: "Ajoutez au moins un signataire." }
    }

    const sansCourriel = destinataires.find((d) => !d.courriel?.trim())
    if (sansCourriel) {
      return {
        ok: false,
        message: `${sansCourriel.nom || "Un signataire"} n'a pas d'adresse courriel : ` +
          "c'est par là que part le lien de signature.",
      }
    }

    // ── UNE SEULE DEMANDE VIVANTE PAR DOCUMENT ─────────────────────────────
    // Trois clics ne doivent pas faire trois demandes. Deux demandes ouvertes
    // sur le même document feraient circuler deux liens, et la seconde
    // signature s'apposerait sur une demande que personne ne suit.
    const { data: ouverte } = await sb
      .from("signature_requests")
      .select("id, status")
      .eq("document_id", documentId)
      .in("status", ["draft", "ready", "sent", "viewed", "partially_signed"])
      .limit(1)
      .maybeSingle()

    if (ouverte) {
      return {
        ok: false,
        demandeId: String(ouverte.id),
        message: "Une demande de signature est déjà en cours sur ce document. " +
          "Utilisez « Renvoyer » pour transmettre un nouveau lien, ou annulez-la d'abord.",
      }
    }

    // ── OÙ SIGNER, QUAND LE DOCUMENT LE SAIT ───────────────────────────────
    // Un contrat engendré par le cabinet porte ses encadrés de signature,
    // mesurés à la composition. On rattache chaque signataire au sien : c'est
    // ce qui permettra d'apposer le tracé DANS le contrat plutôt que d'ajouter
    // une page de signatures à la fin.
    //
    // Un PDF téléversé n'a pas de repères : les champs naissent alors sans
    // coordonnées, et le document signé se contente de son certificat. C'est
    // le comportement d'avant, et il reste correct.
    const { data: docAncres } = await sb
      .from("documents").select("signature_anchors").eq("id", documentId).maybeSingle()

    const ancres = Array.isArray(docAncres?.signature_anchors)
      ? (docAncres.signature_anchors as EmplacementSignature[])
      : []
    const paires = apparier(destinataires, ancres)

    const champs: DemandeSignature["champs"] = []
    destinataires.forEach((d, i) => {
      const e = paires.get(d)
      champs.push({
        destinataireIndex: i,
        type: "signature",
        libelle: "Signature",
        // Le tracé se pose SUR la ligne : l'ordonnée est celle du filet, la
        // hauteur celle qu'on s'autorise au-dessus.
        //
        // ONZE POINTS, PAS DAVANTAGE. L'encadré n'offre que quatorze points
        // entre le filet de signature et la ligne de qualité imprimée
        // au-dessus — « Permis CRIC R1041776 », « Client ». Une première
        // version en autorisait vingt-six : le tracé traversait le nom. À
        // treize, il effleurait encore la qualité. Cela ne se voit ni du
        // compilateur ni d'une épreuve de texte : seulement en ouvrant le PDF.
        ...(e ? { page: e.page, x: e.signature.x, y: e.signature.y, largeur: e.signature.largeur, hauteur: 11 } : {}),
      })
      if (options.avecInitiales) {
        champs.push({ destinataireIndex: i, type: "initials", libelle: "Initiales" })
      }
      // La date est un champ à part entière : elle porte sa propre position, et
      // c'est le signataire qui la fixe en signant — pas la date du contrat.
      if (e) {
        champs.push({
          destinataireIndex: i,
          type: "date",
          libelle: "Date",
          obligatoire: false,
          page: e.page, x: e.date.x, y: e.date.y, largeur: e.date.largeur, hauteur: 12,
        })
      }
    })

    const etat = await svc.createRequest({
      documentId,
      destinataires: destinataires.map((d) => ({
        role: d.role, nom: d.nom, courriel: d.courriel,
        permis: d.permis, rang: d.rang,
      })),
      champs,
      mode: options.mode ?? "sequential",
      validiteJours: options.validiteJours ?? 30,
    })

    const envoi = await svc.sendRequest(etat.id)
    if (!envoi.ok) return { ok: false, message: envoi.message }

    // ── Les courriels ──────────────────────────────────────────────────────
    // En mode séquentiel, SEUL celui dont c'est le tour est prévenu. Écrire à
    // tout le monde ferait ouvrir un lien à quelqu'un qui verrait « ce n'est
    // pas encore à vous » — et qui n'y reviendrait pas quand ce le serait.
    const aPrevenir = etat.destinataires.filter((r) => r.sonTour && r.lien)
    const { data: docEnvoye } = await sb
      .from("documents").select("name").eq("id", documentId).maybeSingle()
    const courrier = await previenir(
      sb, membre.firmId, String(docEnvoye?.name ?? "un document"),
      aPrevenir, options.validiteJours ?? 30
    )

    revalidatePath("/[locale]/matters/[id]", "page")
    revalidatePath("/fr/signatures")
    revalidatePath("/fr/agreements")

    return {
      ok: true,
      demandeId: etat.id,
      message: `Demande envoyée. ${verdictCourriel(courrier)}`,
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

export interface Courrier {
  partis: number
  /** Ce que le fournisseur a répondu quand il a refusé. Jamais avalé. */
  erreur?: string
  /** Vrai si RESEND_API_KEY et EMAIL_FROM manquent : rien n'a été tenté. */
  nonConfigure?: boolean
}

/**
 * Traduit le sort des courriels en une phrase pour le consultant.
 *
 * L'ÉCHEC EST DIT, ET SA RAISON AVEC. Une version antérieure comptait les
 * envois réussis et jetait `r.erreur` : un refus de Resend — domaine non
 * vérifié, quota dépassé — devenait « aucun courriel n'est parti », sans que
 * personne puisse savoir pourquoi ni quoi corriger.
 */
function verdictCourriel(c: Courrier): string {
  if (c.partis > 0) {
    return `${c.partis} courriel${c.partis > 1 ? "s" : ""} parti${c.partis > 1 ? "s" : ""}.`
  }
  if (c.nonConfigure) {
    return "Aucun courriel n'est parti : l'envoi n'est pas configuré sur ce serveur. " +
      "Transmettez le lien vous-même depuis l'historique."
  }
  if (c.erreur) {
    return `Aucun courriel n'est parti — le service d'envoi a refusé : ${c.erreur}`
  }
  return "Aucun courriel n'est parti."
}

/** Écrit aux destinataires. Rend ce qui est parti, et pourquoi le reste ne l'est pas. */
async function previenir(
  sb: Awaited<ReturnType<typeof getSessionSupabase>>,
  firmId: string,
  nomDocument: string,
  destinataires: { nom: string; courriel: string; lien?: string }[],
  jours: number
): Promise<Courrier> {
  if (destinataires.length === 0) return { partis: 0 }

  const { data: firm } = await sb
    .from("firms")
    .select("name, email_sender_name, reply_to_email")
    .eq("id", firmId)
    .maybeSingle()

  const { envoyerCourriel } = await import("@/lib/email/send")
  const { courrielSignatureDemandee } = await import("@/lib/email/templates")

  let partis = 0
  let erreur: string | undefined
  let nonConfigure = false

  for (const d of destinataires) {
    if (!d.lien) continue
    const message = courrielSignatureDemandee({
      langue: "fr",
      cabinet: String(firm?.name ?? ""),
      nom: d.nom,
      document: nomDocument,
      lien: d.lien,
      jours,
    })
    const r = await envoyerCourriel({
      destinataire: d.courriel,
      sujet: message.sujet,
      html: message.html,
      texte: message.texte,
      nomExpediteur: firm?.email_sender_name ?? firm?.name ?? null,
      repondreA: firm?.reply_to_email ?? null,
    })
    if (r.envoye) partis++
    else {
      if (!r.configure) nonConfigure = true
      if (r.erreur) erreur = r.erreur
      console.error("previenir :", d.courriel, "—", r.erreur ?? "envoi non configuré")
    }
  }
  return { partis, erreur, nonConfigure }
}

/** Les demandes d'un dossier ou d'un client, du plus récent au plus ancien. */
export async function listerSignatures(
  filtre: { matterId?: string; clientId?: string }
): Promise<(EtatDemande & { documentNom: string })[]> {
  const { sb, service: svc } = await service()

  // LA CONTRAINTE EST NOMMÉE, ET IL LE FAUT. `signature_requests` pointe DEUX
  // fois vers `documents` — le document envoyé, et le document signé qui en
  // naît. Sans le nom de la clé, PostgREST refuse la jointure comme ambiguë et
  // rend `null` : l'onglet affichait « Aucune signature en cours » juste après
  // avoir annoncé « Demande envoyée ».
  let q = sb
    .from("signature_requests")
    .select("id, document_id, documents!signature_requests_document_id_fkey!inner(name, matter_id, client_id)")
    .order("requested_at", { ascending: false })
    .limit(50)

  if (filtre.matterId) q = q.eq("documents.matter_id", filtre.matterId)
  else if (filtre.clientId) q = q.eq("client_id", filtre.clientId)

  const { data, error } = await q
  // Une erreur de requête ne doit pas se déguiser en « rien à afficher ».
  if (error) console.error("listerSignatures :", error.message)
  const lignes = (data ?? []) as unknown as {
    id: string; documents: { name?: string } | null
  }[]

  const etats = await Promise.all(
    lignes.map(async (l) => {
      const etat = await svc.getStatus(String(l.id))
      return etat ? { ...etat, documentNom: String(l.documents?.name ?? "") } : null
    })
  )
  return etats.filter(Boolean) as (EtatDemande & { documentNom: string })[]
}

export async function annulerSignature(demandeId: string, motif?: string): Promise<Resultat> {
  try {
    const { sb, service: svc } = await service()

    // Le document est relevé AVANT l'annulation : après, rien dans le résultat
    // ne dit sur quelle pièce elle portait.
    const { data: avant } = await sb
      .from("signature_requests").select("document_id").eq("id", demandeId).maybeSingle()

    const r = await svc.cancelRequest(demandeId, motif)
    if (!r.ok) return r

    // LE VERROU TOMBE AVEC LA DERNIÈRE DEMANDE — quand il n'a rien à protéger.
    // Le déclencheur de `documents` conseille depuis toujours « annulez la
    // demande, puis créez une nouvelle version » ; sans cet appel, le conseil
    // était impossible à suivre et le contrat restait figé pour toujours.
    //
    // C'est la BASE qui tranche, pas cette ligne : `deverrouiller_document()`
    // refuse dès qu'une signature existe, et refuse tant qu'une autre demande
    // est encore en cours sur la même pièce. Elle rend `false` au lieu de
    // lever — une annulation réussie ne doit pas se transformer en échec
    // parce que le verrou, lui, devait rester.
    if (avant?.document_id) {
      await sb.rpc("deverrouiller_document", { p_document_id: String(avant.document_id) })
    }

    revalidatePath("/[locale]/matters/[id]", "page")
    revalidatePath("/fr/signatures")
    return r
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

export async function relancerSignature(
  demandeId: string, destinataireId?: string
): Promise<Resultat> {
  try {
    const { sb, membre, service: svc } = await service()
    const r = await svc.resendRequest(demandeId, destinataireId)
    if (!r.ok) return r

    // LE LIEN N'EXISTE EN CLAIR QU'ICI. La base n'en garde que l'empreinte :
    // si on ne l'envoie pas maintenant, il est perdu et il faudra relancer une
    // fois de plus. C'est pourquoi `relancerDemande` le remonte.
    const { data: doc } = await sb
      .from("signature_requests")
      .select("expires_at, documents!signature_requests_document_id_fkey(name)")
      .eq("id", demandeId)
      .maybeSingle()

    const jours = doc?.expires_at
      ? Math.max(1, Math.ceil((new Date(String(doc.expires_at)).getTime() - Date.now()) / 86_400_000))
      : 30
    const nomDocument = String(
      (doc as { documents?: { name?: string } } | null)?.documents?.name ?? "un document"
    )

    const courrier = await previenir(
      sb, membre.firmId, nomDocument, r.liens ?? [], jours
    )

    revalidatePath("/[locale]/matters/[id]", "page")
    revalidatePath("/fr/signatures")
    return {
      ok: true,
      message: courrier.partis > 0
        ? "Nouveau lien envoyé. Le précédent ne fonctionne plus."
        : `Nouveau lien engendré. ${verdictCourriel(courrier)}`,
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

/**
 * Le lien qui permet à l'appelant de signer lui-même.
 *
 * ─── POURQUOI UN LIEN, ET PAS UN ÉCRAN INTERNE À PART ──────────────────────
 *
 * Le consultant signe par le MÊME chemin que le client : la page publique
 * `/s/<jeton>`. Un second écran de signature, réservé aux membres, ferait
 * deux implémentations du geste le plus délicat du produit — et c'est celui
 * qu'on ouvre le moins souvent qui finirait par ne plus horodater, ou par ne
 * plus vérifier l'empreinte.
 *
 * ─── LE JETON EST NEUF À CHAQUE FOIS ───────────────────────────────────────
 *
 * Il n'existe en clair qu'un instant, à la création. Redemander à signer
 * engendre donc un jeton neuf et révoque le précédent — ce qui est aussi la
 * bonne conduite : un lien qui a pu traîner dans une boîte de courriel ne
 * doit pas rester valide indéfiniment.
 */
export async function lienPourSigner(
  demandeId: string
): Promise<Resultat & { lien?: string }> {
  try {
    const { membre, service: svc } = await service()
    const etat = await svc.getStatus(demandeId)
    if (!etat) return { ok: false, message: "Cette demande est introuvable." }

    const moiCourriel = (membre.email ?? "").trim().toLowerCase()
    const moi = etat.destinataires.find(
      (d) => d.courriel.trim().toLowerCase() === moiCourriel
    )

    // ON NE SIGNE PAS POUR AUTRUI. Le rôle ne suffit pas : dans un cabinet de
    // trois consultants, se fier à « role = consultant » laisserait n'importe
    // lequel ouvrir le lien d'un autre.
    if (!moi) {
      return { ok: false, message: "Vous n'êtes pas signataire de cette demande." }
    }
    if (moi.statut === "signed") {
      return { ok: false, message: "Vous avez déjà signé ce document." }
    }
    if (!moi.sonTour) {
      return {
        ok: false,
        message: "Ce n'est pas encore votre tour : un signataire vous précède.",
      }
    }

    const r = await svc.resendRequest(demandeId, moi.id)
    const lien = r.liens?.[0]?.lien
    if (!r.ok || !lien) {
      return { ok: false, message: r.message || "Le lien de signature n'a pas pu être engendré." }
    }

    return { ok: true, lien, message: "Ouverture de votre page de signature." }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

/** Les statuts qui autorisent le rangement : la demande est close, sans suite. */
const CLOSES = ["cancelled", "expired"]

/**
 * Consigne un geste du cabinet sur une demande.
 *
 * On passe par la fonction du moteur plutôt que par le service : archiver et
 * effacer ne sont pas des gestes de SIGNATURE, ce sont des gestes de
 * RANGEMENT. Les ajouter au contrat du fournisseur obligerait PandaDoc ou
 * DocuSign à savoir ce qu'archiver veut dire dans ce CRM.
 */
async function consigner(
  demandeId: string,
  evenement: EvenementSignature,
  details?: Record<string, unknown>
) {
  const { sb, membre } = await service()
  const { journaliser } = await import("@/lib/signature/evenements")
  await journaliser(sb, { firmId: membre.firmId, fullName: membre.fullName, email: membre.email }, {
    requestId: demandeId, evenement, details,
  })
}

/**
 * Range une demande close hors de la liste courante.
 *
 * ─── RANGER N'EST PAS DÉTRUIRE ─────────────────────────────────────────────
 *
 * Aucune ligne ne bouge, aucun fichier n'est retiré, le journal reste entier.
 * Le statut d'origine — annulée, expirée — n'est pas remplacé : c'est une
 * DATE qu'on pose, et la restauration se contente de l'effacer.
 *
 * ─── SEULEMENT CE QUI EST CLOS ─────────────────────────────────────────────
 *
 * Une demande envoyée ou partiellement signée attend quelqu'un. La ranger la
 * ferait disparaître de l'écran de celui qui doit agir, sans rien annuler :
 * le client garderait un lien valide sur un document que plus personne ne suit.
 */
export async function archiverSignature(demandeId: string): Promise<Resultat> {
  try {
    const { exigerPermission } = await import("@/lib/auth/permissions")
    const membre = await exigerPermission("signatures.manage")
    const sb = await getSessionSupabase()

    const { data: demande } = await sb
      .from("signature_requests")
      .select("id, status, archived_at")
      .eq("id", demandeId)
      .maybeSingle()

    if (!demande) return { ok: false, message: "Cette demande est introuvable." }
    if (demande.archived_at) return { ok: false, message: "Cette demande est déjà archivée." }
    if (!CLOSES.includes(String(demande.status))) {
      return {
        ok: false,
        message: "Seules les demandes annulées ou expirées s'archivent. " +
          "Celle-ci attend encore une signature : annulez-la d'abord.",
      }
    }

    // LE JOURNAL AVANT L'ÉCRITURE. `signature_event()` refuse d'écrire sur une
    // demande qu'il ne trouve pas ; l'ordre n'a pas d'importance ici, mais il
    // en aura pour la suppression, et deux ordres différents pour deux gestes
    // voisins finiraient par se confondre.
    const { data, error } = await sb
      .from("signature_requests")
      .update({ archived_at: new Date().toISOString(), archived_by: membre.profileId ?? null })
      .eq("id", demandeId)
      .is("archived_at", null)
      .select("id")

    if (error) return { ok: false, message: error.message }
    if (!data || data.length === 0) {
      return { ok: false, message: "Archivage refusé : vérifiez vos droits sur ce cabinet." }
    }

    await consigner(demandeId, "signature.request.archived")

    revalidatePath("/fr/signatures")
    revalidatePath("/[locale]/matters/[id]", "page")
    return { ok: true, message: "Demande de signature archivée." }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

/**
 * Sort une demande des archives, telle qu'elle y est entrée.
 *
 * Elle retrouve son statut d'origine parce qu'elle ne l'a jamais quitté. Une
 * demande annulée ne redevient pas active en sortant des archives — ce serait
 * rouvrir un contrat que le cabinet a clos.
 */
export async function restaurerSignature(demandeId: string): Promise<Resultat> {
  try {
    const { exigerPermission } = await import("@/lib/auth/permissions")
    await exigerPermission("signatures.manage")
    const sb = await getSessionSupabase()

    const { data, error } = await sb
      .from("signature_requests")
      .update({ archived_at: null, archived_by: null })
      .eq("id", demandeId)
      .not("archived_at", "is", null)
      .select("id, status")

    if (error) return { ok: false, message: error.message }
    if (!data || data.length === 0) {
      return { ok: false, message: "Cette demande n'est pas archivée." }
    }

    await consigner(demandeId, "signature.request.restored")

    revalidatePath("/fr/signatures")
    return {
      ok: true,
      message: `Demande restaurée. Elle reste ${data[0].status === "expired" ? "expirée" : "annulée"}.`,
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

export interface EtatSuppression {
  possible: boolean
  /** Pourquoi elle ne l'est pas, en clair. */
  motif?: string
}

/**
 * Une demande peut-elle être effacée sans perdre de preuve ?
 *
 * ─── LA QUESTION EST POSÉE À PART, ET C'EST DÉLIBÉRÉ ───────────────────────
 *
 * L'écran s'en sert pour ne pas proposer un bouton qui refusera. La
 * suppression la repose de son côté : un écran qui a raison ne dispense pas
 * le serveur de vérifier.
 *
 * ─── CE QUI INTERDIT L'EFFACEMENT ──────────────────────────────────────────
 *
 * UNE SIGNATURE DÉJÀ APPOSÉE, avant tout. `signatures.request_id` cascade
 * depuis la demande : la supprimer effacerait les signatures elles-mêmes,
 * leurs horodatages, leurs adresses d'origine — c'est-à-dire la preuve. Une
 * demande annulée après que le client a signé garde tout cela, et doit le
 * garder : elle s'archive, elle ne s'efface pas.
 */
export async function peutSupprimerSignature(demandeId: string): Promise<EtatSuppression> {
  const { sb } = await service()

  const { data: demande } = await sb
    .from("signature_requests")
    .select("id, status, signed_document_id")
    .eq("id", demandeId)
    .maybeSingle()

  if (!demande) return { possible: false, motif: "Cette demande est introuvable." }

  if (!CLOSES.includes(String(demande.status))) {
    return {
      possible: false,
      motif: "Seule une demande annulée ou expirée peut être supprimée.",
    }
  }

  if (demande.signed_document_id) {
    return {
      possible: false,
      motif: "Un document signé est né de cette demande : il ne doit pas perdre son origine.",
    }
  }

  const { count } = await sb
    .from("signatures")
    .select("id", { count: "exact", head: true })
    .eq("request_id", demandeId)

  if ((count ?? 0) > 0) {
    return {
      possible: false,
      motif: `${count} signature${(count ?? 0) > 1 ? "s ont" : " a"} déjà été apposée${(count ?? 0) > 1 ? "s" : ""} : ` +
        "la supprimer effacerait la preuve. Archivez-la.",
    }
  }

  return { possible: true }
}

/**
 * Efface définitivement une demande close qui ne prouve rien.
 *
 * ─── TROIS VERROUS, ET AUCUN N'EST DE TROP ─────────────────────────────────
 *
 *   1. La permission `signatures.purge`, réservée au propriétaire du cabinet.
 *   2. Aucune signature, aucun document signé — voir `peutSupprimerSignature`.
 *   3. Le mot SUPPRIMER, saisi à la main.
 *
 * ─── LE JOURNAL S'ÉCRIT AVANT ──────────────────────────────────────────────
 *
 * `signature_event()` refuse d'écrire sur une demande introuvable : après la
 * suppression, il serait trop tard. L'entrée survit à la ligne parce que
 * `audit_logs` ne porte pas de clé étrangère vers elle — c'est ce qui permet
 * de démontrer plus tard que la demande a existé, et qui l'a effacée.
 */
export async function supprimerSignatureDefinitivement(
  demandeId: string,
  confirmation: string
): Promise<Resultat> {
  try {
    const { exigerPermission } = await import("@/lib/auth/permissions")
    await exigerPermission("signatures.purge")

    if (confirmation.trim().toUpperCase() !== "SUPPRIMER") {
      return { ok: false, message: "Saisissez SUPPRIMER pour confirmer." }
    }

    const verdict = await peutSupprimerSignature(demandeId)
    if (!verdict.possible) return { ok: false, message: verdict.motif ?? "Suppression refusée." }

    const { sb } = await service()

    const { data: demande } = await sb
      .from("signature_requests")
      .select("status, document_id")
      .eq("id", demandeId)
      .maybeSingle()

    await consigner(demandeId, "signature.request.deleted", {
      statut: demande?.status ?? null,
      document: demande?.document_id ?? null,
    })

    const { data, error } = await sb
      .from("signature_requests")
      .delete()
      .eq("id", demandeId)
      .in("status", CLOSES)
      .select("id")

    if (error) return { ok: false, message: error.message }
    if (!data || data.length === 0) {
      return { ok: false, message: "Suppression refusée : vérifiez vos droits sur ce cabinet." }
    }

    revalidatePath("/fr/signatures")
    revalidatePath("/[locale]/matters/[id]", "page")
    // LE DOCUMENT RESTE AU DOSSIER. Seule la demande disparaît : le contrat
    // qu'on avait voulu faire signer n'a pas à s'effacer parce que l'envoi a
    // été annulé.
    return {
      ok: true,
      message: "Demande supprimée définitivement. Le document reste au dossier.",
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

export async function journalSignature(demandeId: string): Promise<EntreeJournalSignature[]> {
  const { service: svc } = await service()
  return svc.getAuditTrail(demandeId)
}

/** Les documents du dossier qui peuvent être envoyés en signature. */
export async function documentsSignables(matterId: string) {
  const sb = await getSessionSupabase()
  const { data } = await sb
    .from("documents")
    .select("id, name, category, locked_at, sha256")
    .eq("matter_id", matterId)
    .not("storage_path", "is", null)
    .is("locked_at", null)
    .order("created_at", { ascending: false })
    .limit(50)

  // Un document VERROUILLÉ est déjà parti en signature : le proposer une
  // seconde fois ferait naître une demande concurrente sur la même version.
  return (data ?? []).map((d) => ({
    id: String(d.id),
    nom: String(d.name ?? ""),
    categorie: String(d.category ?? ""),
  }))
}
