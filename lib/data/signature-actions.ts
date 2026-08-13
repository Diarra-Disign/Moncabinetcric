"use server"

import { revalidatePath } from "next/cache"
import { getSessionSupabase, getCurrentMember } from "@/lib/supabase/session"
import { SignatureService } from "@/lib/signature/service"
import type { DemandeSignature, EtatDemande, EntreeJournalSignature } from "@/lib/signature/contrat"

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

    // Chaque signataire reçoit au minimum une signature et une date. Les
    // champs sont créés ici plutôt que laissés au moteur : c'est une décision
    // du cabinet, et elle changera quand l'écran de placement existera.
    const champs: DemandeSignature["champs"] = []
    destinataires.forEach((_, i) => {
      champs.push({ destinataireIndex: i, type: "signature", libelle: "Signature" })
      if (options.avecInitiales) {
        champs.push({ destinataireIndex: i, type: "initials", libelle: "Initiales" })
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
    const { service: svc } = await service()
    const r = await svc.cancelRequest(demandeId, motif)
    if (r.ok) revalidatePath("/[locale]/matters/[id]", "page")
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
