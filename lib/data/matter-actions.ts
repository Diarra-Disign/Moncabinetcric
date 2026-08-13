"use server"

import { revalidatePath } from "next/cache"
import { getSessionSupabase, getCurrentMember } from "@/lib/supabase/session"

/**
 * Actions du dossier client.
 *
 * Aucune ne réimplémente une règle : les refus viennent de la base — le solde
 * de fidéicommis qui ne peut pas devenir débiteur, le dossier incomplet qui ne
 * peut pas être déclaré prêt, la pièce d'un autre client qu'on ne peut pas
 * modifier. Ces actions se contentent de transmettre et de TRADUIRE l'erreur.
 *
 * C'est délibéré. Une règle réécrite ici serait une seconde règle, appliquée
 * seulement à ce qui passe par cet écran — et la première finirait par en
 * différer.
 */

export interface Resultat {
  ok: boolean
  message: string
}

/** Le profil du membre courant, requis pour signer une action. */
async function moi() {
  const membre = await getCurrentMember()
  if (!membre) throw new Error("Session expirée. Reconnectez-vous.")
  return membre
}

/**
 * Traduit une erreur Postgres en phrase lisible.
 *
 * Les messages levés par les déclencheurs sont déjà écrits pour être lus —
 * c'est pourquoi ils sont repris tels quels. Les codes techniques, eux, ne
 * disent rien à personne.
 */
function lisible(e: { message?: string; code?: string } | null): string {
  const brut = e?.message ?? "Erreur inattendue."
  if (e?.code === "42501" || /row-level security/i.test(brut)) {
    return "Vous n'avez pas le droit d'effectuer cette action."
  }
  if (e?.code === "23505") return "Cet élément existe déjà."
  return brut
}

// ---------------------------------------------------------------------------
// Pièces exigées
// ---------------------------------------------------------------------------

/** Marque une pièce reçue, sans la déclarer vérifiée. */
export async function marquerRecue(formData: FormData): Promise<Resultat> {
  try {
    const membre = await moi()
    const sb = await getSessionSupabase()
    const id = String(formData.get("id") ?? "")

    const { error } = await sb.from("matter_requirements").update({
      received_at: new Date().toISOString(),
      received_by: membre.profileId,
      received_from: "firm",
      rejected_at: null,
      rejection_reason: null,
    }).eq("id", id)

    if (error) return { ok: false, message: lisible(error) }
    revalidatePath("/[locale]/matters/[id]", "page")
    return { ok: true, message: "Pièce marquée reçue. Elle reste à vérifier." }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

/**
 * Vérifie une pièce.
 *
 * Refusé si elle n'a pas été reçue. Vérifier ce qu'on n'a pas vu est
 * exactement ce que la distinction reçu/vérifié sert à empêcher, et la garde
 * doit être ici parce que la base, elle, ne connaît pas l'ordre des gestes.
 */
export async function marquerVerifiee(formData: FormData): Promise<Resultat> {
  try {
    const membre = await moi()
    const sb = await getSessionSupabase()
    const id = String(formData.get("id") ?? "")

    const { data: piece } = await sb
      .from("matter_requirements").select("received_at, label_fr").eq("id", id).maybeSingle()

    if (!piece) return { ok: false, message: "Pièce introuvable." }
    if (!piece.received_at) {
      return {
        ok: false,
        message: `« ${piece.label_fr} » n'a pas encore été reçue. On ne vérifie pas une pièce qu'on n'a pas.`,
      }
    }

    const { error } = await sb.from("matter_requirements").update({
      verified_at: new Date().toISOString(),
      verified_by: membre.profileId,
      rejected_at: null,
      rejection_reason: null,
    }).eq("id", id)

    if (error) return { ok: false, message: lisible(error) }
    revalidatePath("/[locale]/matters/[id]", "page")
    return { ok: true, message: "Pièce vérifiée." }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

/** Renvoie une pièce à corriger, avec un motif — sans motif, on refuse. */
export async function renvoyerACorriger(formData: FormData): Promise<Resultat> {
  try {
    const membre = await moi()
    const sb = await getSessionSupabase()
    const id = String(formData.get("id") ?? "")
    const motif = String(formData.get("motif") ?? "").trim()

    if (!motif) {
      return { ok: false, message: "Un renvoi doit dire ce qui ne va pas, sinon le client ne peut pas corriger." }
    }

    const { error } = await sb.from("matter_requirements").update({
      rejected_at: new Date().toISOString(),
      rejected_by: membre.profileId,
      rejection_reason: motif,
      verified_at: null,
      verified_by: null,
    }).eq("id", id)

    if (error) return { ok: false, message: lisible(error) }
    revalidatePath("/[locale]/matters/[id]", "page")
    return { ok: true, message: "Pièce renvoyée à corriger." }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

// ---------------------------------------------------------------------------
// Le dossier
// ---------------------------------------------------------------------------

/**
 * Déclare un dossier complet ou prêt à soumettre.
 *
 * Le refus vient du déclencheur en base, avec le détail des pièces
 * bloquantes. Rien n'est revérifié ici : deux vérifications finiraient par
 * diverger, et c'est celle de l'écran qu'on croirait.
 */
export async function declarerDossier(formData: FormData): Promise<Resultat> {
  try {
    await moi()
    const sb = await getSessionSupabase()
    const id = String(formData.get("id") ?? "")
    const statut = String(formData.get("statut") ?? "")

    if (!["complete", "ready_to_submit"].includes(statut)) {
      return { ok: false, message: "Statut inattendu." }
    }

    const { error } = await sb.from("matters").update({ status: statut }).eq("id", id)
    if (error) return { ok: false, message: lisible(error) }

    revalidatePath("/[locale]/matters/[id]", "page")
    return {
      ok: true,
      message: statut === "complete" ? "Dossier déclaré complet." : "Dossier prêt à être soumis.",
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

// ---------------------------------------------------------------------------
// Paiements
// ---------------------------------------------------------------------------

/**
 * Enregistre un encaissement.
 *
 * La destination est obligatoire et sans valeur par défaut, ici comme en base.
 * Un défaut la rendrait facultative dans les faits, et c'est « entreprise »
 * qu'on choisirait — donc l'erreur la plus grave.
 */
export async function enregistrerPaiement(formData: FormData): Promise<Resultat> {
  try {
    const membre = await moi()
    const sb = await getSessionSupabase()

    const montant = Number(String(formData.get("montant") ?? "").replace(",", "."))
    const destination = String(formData.get("destination") ?? "")

    if (!Number.isFinite(montant) || montant <= 0) {
      return { ok: false, message: "Le montant doit être supérieur à zéro." }
    }
    if (!["trust", "business"].includes(destination)) {
      return { ok: false, message: "Indiquez où les fonds ont été déposés : fidéicommis ou compte de l'entreprise." }
    }

    const { error } = await sb.from("payments").insert({
      firm_id: membre.firmId,
      client_id: String(formData.get("clientId") ?? ""),
      matter_id: String(formData.get("matterId") ?? "") || null,
      invoice_id: String(formData.get("invoiceId") ?? "") || null,
      amount: montant,
      paid_on: String(formData.get("date") ?? "") || new Date().toISOString().slice(0, 10),
      method: String(formData.get("methode") ?? "other"),
      reference: String(formData.get("reference") ?? "") || null,
      destination,
      recorded_by: membre.profileId,
      notes: String(formData.get("notes") ?? "") || null,
    })

    if (error) return { ok: false, message: lisible(error) }
    revalidatePath("/[locale]/matters/[id]", "page")
    return {
      ok: true,
      message:
        destination === "trust"
          ? `${montant.toFixed(2)} $ enregistrés au compte en fidéicommis.`
          : `${montant.toFixed(2)} $ enregistrés au compte de l'entreprise.`,
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

/** Vire des honoraires gagnés du fidéicommis vers le compte de l'entreprise. */
export async function virerHonoraires(formData: FormData): Promise<Resultat> {
  try {
    const membre = await moi()
    const sb = await getSessionSupabase()

    const montant = Number(String(formData.get("montant") ?? "").replace(",", "."))
    if (!Number.isFinite(montant) || montant <= 0) {
      return { ok: false, message: "Le montant doit être supérieur à zéro." }
    }

    const { error } = await sb.from("trust_ledger").insert({
      firm_id: membre.firmId,
      client_id: String(formData.get("clientId") ?? ""),
      matter_id: String(formData.get("matterId") ?? "") || null,
      invoice_id: String(formData.get("invoiceId") ?? "") || null,
      entry_type: "transfer_to_business",
      amount: montant,
      memo: String(formData.get("memo") ?? "Honoraires gagnés") || null,
      recorded_by: membre.profileId,
    })

    // Le refus le plus important passe par ici : le déclencheur en base
    // interdit un solde débiteur, et son message dit de combien.
    if (error) return { ok: false, message: lisible(error) }
    revalidatePath("/[locale]/matters/[id]", "page")
    return { ok: true, message: `${montant.toFixed(2)} $ virés au compte de l'entreprise.` }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

// ---------------------------------------------------------------------------
// Échéances
// ---------------------------------------------------------------------------

export async function ajouterEcheance(formData: FormData): Promise<Resultat> {
  try {
    const membre = await moi()
    const sb = await getSessionSupabase()

    const titre = String(formData.get("titre") ?? "").trim()
    const date = String(formData.get("date") ?? "")
    if (!titre) return { ok: false, message: "Une échéance sans titre ne rappelle rien." }
    if (!date) return { ok: false, message: "Une échéance sans date n'échoit jamais." }

    const { error } = await sb.from("matter_deadlines").insert({
      firm_id: membre.firmId,
      matter_id: String(formData.get("matterId") ?? ""),
      title: titre,
      description: String(formData.get("description") ?? "") || null,
      due_on: date,
      priority: String(formData.get("priorite") ?? "normal"),
      assignee_id: String(formData.get("responsable") ?? "") || null,
      created_by: membre.profileId,
    })

    if (error) return { ok: false, message: lisible(error) }
    revalidatePath("/[locale]/matters/[id]", "page")
    return { ok: true, message: "Échéance ajoutée." }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

export async function changerEtatEcheance(formData: FormData): Promise<Resultat> {
  try {
    const membre = await moi()
    const sb = await getSessionSupabase()
    const statut = String(formData.get("statut") ?? "")

    if (!["todo", "in_progress", "done", "cancelled"].includes(statut)) {
      return { ok: false, message: "État inattendu." }
    }

    const { error } = await sb.from("matter_deadlines")
      .update({ status: statut, completed_by: statut === "done" ? membre.profileId : null })
      .eq("id", String(formData.get("id") ?? ""))

    if (error) return { ok: false, message: lisible(error) }
    revalidatePath("/[locale]/matters/[id]", "page")
    return { ok: true, message: "Échéance mise à jour." }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

// ---------------------------------------------------------------------------
// Formulaires
// ---------------------------------------------------------------------------

/** Ouvre un exemplaire de formulaire, ou en ouvre une nouvelle version. */
export async function ouvrirFormulaire(formData: FormData): Promise<Resultat> {
  try {
    await moi()
    const sb = await getSessionSupabase()

    const { error } = await sb.rpc("open_matter_form", {
      p_matter: String(formData.get("matterId") ?? ""),
      p_code: String(formData.get("code") ?? ""),
    })

    if (error) return { ok: false, message: lisible(error) }
    revalidatePath("/[locale]/matters/[id]", "page")
    return { ok: true, message: "Exemplaire ouvert, pré-rempli depuis le dossier." }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

// ---------------------------------------------------------------------------
// Portail client
// ---------------------------------------------------------------------------

/** Demande au client de confirmer un ou plusieurs documents. */
export async function demanderValidation(formData: FormData): Promise<Resultat> {
  try {
    const membre = await moi()
    const sb = await getSessionSupabase()

    const documents = formData.getAll("documentId").map(String).filter(Boolean)
    if (documents.length === 0) {
      return { ok: false, message: "Choisissez au moins un document." }
    }

    const lignes = documents.map((documentId) => ({
      firm_id: membre.firmId,
      client_id: String(formData.get("clientId") ?? ""),
      matter_id: String(formData.get("matterId") ?? "") || null,
      document_id: documentId,
      kind: String(formData.get("nature") ?? "validation"),
      message: String(formData.get("message") ?? "") || null,
      requested_by: membre.profileId,
    }))

    const { error } = await sb.from("document_reviews").insert(lignes)

    // Une demande déjà en cours sur le même document est refusée par un index
    // partiel : deux demandes vivantes laisseraient le client répondre à
    // l'une et le cabinet lire l'autre.
    if (error) {
      return {
        ok: false,
        message:
          error.code === "23505"
            ? "Une demande est déjà en attente sur ce document."
            : lisible(error),
      }
    }

    revalidatePath("/[locale]/matters/[id]", "page")
    return {
      ok: true,
      message: `${documents.length} document(s) envoyé(s) au client pour validation.`,
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

// ---------------------------------------------------------------------------
// Rattacher un client au dossier
// ---------------------------------------------------------------------------

/**
 * Relie un dossier à un client du cabinet.
 *
 * Ce geste n'existait nulle part, et son absence rendait invisible tout ce qui
 * dépend d'un client : les paiements, le fidéicommis, le portail. Un dossier
 * réel ouvert sans client — cas constaté en base — affichait donc un écran
 * amputé sans qu'aucun bouton ne permette d'y remédier.
 */
export async function rattacherClient(formData: FormData): Promise<Resultat> {
  try {
    await moi()
    const sb = await getSessionSupabase()

    const matterId = String(formData.get("matterId") ?? "")
    const clientId = String(formData.get("clientId") ?? "")
    if (!clientId) return { ok: false, message: "Choisissez un client." }

    // La RLS borne déjà les deux au cabinet de la session : un identifiant
    // emprunté ne trouve simplement aucune ligne.
    const { data: client } = await sb
      .from("clients").select("id, name").eq("id", clientId).maybeSingle()
    if (!client) return { ok: false, message: "Client introuvable dans ce cabinet." }

    const { error } = await sb
      .from("matters")
      .update({ client_id: clientId, client_name: client.name })
      .eq("id", matterId)

    if (error) return { ok: false, message: lisible(error) }
    revalidatePath("/[locale]/matters/[id]", "page")
    return { ok: true, message: `Dossier rattaché à ${client.name}. Les paiements et le portail sont maintenant accessibles.` }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

/**
 * Ouvre l'accès au portail pour le client du dossier.
 *
 * Enveloppe ouvrirAccesPortail(), qui existait déjà mais n'était atteignable
 * que par une icône de clé sans libellé, dans une ligne du tableau des
 * clients. Une fonction qu'on ne trouve pas n'existe pas.
 *
 * Le mot de passe temporaire est RENVOYÉ, jamais envoyé par courriel depuis
 * ici : il se transmet de vive voix ou par un canal que le cabinet choisit.
 */
export async function inviterClientAuPortail(formData: FormData): Promise<Resultat> {
  try {
    const { ouvrirAccesPortail } = await import("./portal-access")
    const r = await ouvrirAccesPortail(formData)

    if (!r.ok) return { ok: false, message: r.message }
    revalidatePath("/[locale]/matters/[id]", "page")

    return {
      ok: true,
      message: r.motDePasse
        ? `Accès ouvert. Mot de passe temporaire : ${r.motDePasse}\n` +
          `À transmettre au client. Il devra le changer à sa première connexion.`
        : r.message,
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

// ---------------------------------------------------------------------------
// Formulaires téléversés par le consultant
// ---------------------------------------------------------------------------

/**
 * Dépose au dossier un formulaire choisi par le consultant.
 *
 * ---------------------------------------------------------------------------
 * POURQUOI CE CHEMIN PLUTÔT QUE LE PRÉ-REMPLISSAGE AUTOMATIQUE
 * ---------------------------------------------------------------------------
 * Le pré-remplissage supposait d'intégrer chaque formulaire officiel un par
 * un : stocker le PDF vierge, relever ses champs, établir la correspondance,
 * et refaire ce travail à chaque révision d'IRCC. Il ne vaut que pour les
 * formulaires ainsi préparés — l'IMM 5476 aujourd'hui, et rien d'autre.
 *
 * Un consultant a besoin de déposer N'IMPORTE QUEL formulaire au dossier, y
 * compris ceux qu'aucun éditeur n'a prévus : un formulaire provincial, une
 * annexe, un document d'un consulat. Ce chemin-là ne demande aucune
 * préparation et fonctionne dès le premier jour.
 *
 * Les deux coexistent : celui-ci accepte tout, l'autre pré-remplit ce qui a
 * été préparé.
 */
export async function deposerFormulaire(formData: FormData): Promise<Resultat> {
  try {
    const membre = await moi()
    const sb = await getSessionSupabase()

    const fichier = formData.get("fichier")
    if (!(fichier instanceof File) || fichier.size === 0) {
      return { ok: false, message: "Choisissez un fichier." }
    }

    const matterId = String(formData.get("matterId") ?? "")
    const clientId = String(formData.get("clientId") ?? "") || null
    const nom = String(formData.get("nom") ?? "").trim() || fichier.name

    // La ligne d'abord, le fichier ensuite : deposerFichier() a besoin de
    // l'identifiant du document pour ranger le fichier, et un fichier déposé
    // sans ligne serait un objet dans le stockage que rien ne référence.
    const { data: doc, error } = await sb.from("documents").insert({
      firm_id: membre.firmId,
      client_id: clientId,
      matter_id: matterId,
      name: nom,
      type: String(formData.get("type") ?? "Formulaire"),
      category: "ircc_form",
      uploaded_by: membre.fullName || membre.email,
      uploaded_by_user_id: membre.userId,
      source: "cabinet",
      status: "pending_review",
      mime_type: fichier.type || null,
      size_bytes: fichier.size,
    }).select("id").single()

    if (error || !doc) return { ok: false, message: lisible(error) }

    const { deposerFichier } = await import("./storage")
    const depot = await deposerFichier(doc.id as string, clientId ?? membre.firmId, fichier)

    if (!depot.ok) {
      // La ligne est retirée : un document qui existe sans son fichier
      // s'afficherait au dossier et ne s'ouvrirait jamais.
      await sb.from("documents").delete().eq("id", doc.id)
      return { ok: false, message: depot.erreur ?? "Dépôt impossible." }
    }

    revalidatePath("/[locale]/matters/[id]", "page")
    return { ok: true, message: `« ${nom} » déposé au dossier.` }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

/**
 * Dépose une pièce qui n'entre dans aucune catégorie prévue.
 *
 * ─── LA MÊME INFRASTRUCTURE, RIEN DE PARALLÈLE ─────────────────────────────
 *
 * Même table, même compartiment de stockage, mêmes politiques, mêmes gestes de
 * consultation et de retrait que toute autre pièce du dossier. Seule la
 * catégorie change. Un second système de fichiers pour les pièces « diverses »
 * finirait par diverger sur les droits — et ce sont justement ces pièces-là
 * qu'on oublierait de protéger.
 *
 * ─── LE NOM EST OBLIGATOIRE, ET C'EST TOUT L'INTÉRÊT ───────────────────────
 *
 * La catégorie est générique par dessein ; le nom ne l'est pas. Sans nom
 * imposé, la section deviendrait une pile de « Autre document » que personne
 * ne saurait distinguer six mois plus tard. Le nom du fichier ne fait pas
 * l'affaire : « scan0042.pdf » n'apprend rien.
 *
 * ─── STATUT « valid », PAS « pending_review » ──────────────────────────────
 *
 * La file de vérification existe pour ce que le CLIENT dépose par le portail.
 * Une pièce que le consultant range lui-même n'a pas à attendre qu'il
 * l'approuve. C'est déjà la règle appliquée à l'émission d'une entente.
 */
export async function deposerAutreDocument(formData: FormData): Promise<Resultat> {
  try {
    const membre = await moi()
    const sb = await getSessionSupabase()

    const fichier = formData.get("fichier")
    if (!(fichier instanceof File) || fichier.size === 0) {
      return { ok: false, message: "Choisissez un fichier." }
    }

    const nom = String(formData.get("nom") ?? "").trim()
    if (!nom) {
      return {
        ok: false,
        message: "Donnez un nom à ce document : c'est lui qui permettra de le retrouver.",
      }
    }

    const matterId = String(formData.get("matterId") ?? "")
    const clientId = String(formData.get("clientId") ?? "") || null
    const description = String(formData.get("description") ?? "").trim() || null
    const dateDocument = String(formData.get("dateDocument") ?? "").trim() || null
    const provenance = String(formData.get("provenance") ?? "").trim()

    // La ligne d'abord, le fichier ensuite : deposerFichier() a besoin de
    // l'identifiant du document pour ranger le fichier, et un fichier déposé
    // sans ligne serait un objet dans le stockage que rien ne référence.
    const { data: doc, error } = await sb.from("documents").insert({
      firm_id: membre.firmId,
      client_id: clientId,
      matter_id: matterId,
      name: nom,
      description,
      // `type` reste une ÉTIQUETTE, distincte de la description : c'est elle
      // qui servira au tri le jour où la liste s'allongera.
      type: provenance || "Autre document",
      category: "other",
      date: dateDocument,
      uploaded_by: membre.fullName || membre.email,
      uploaded_by_user_id: membre.userId,
      source: "cabinet",
      status: "valid",
      mime_type: fichier.type || null,
      size_bytes: fichier.size,
    }).select("id").single()

    if (error || !doc) return { ok: false, message: lisible(error) }

    const { deposerFichier } = await import("./storage")
    const depot = await deposerFichier(doc.id as string, clientId ?? membre.firmId, fichier)

    if (!depot.ok) {
      // La ligne est retirée : un document qui existe sans son fichier
      // s'afficherait au dossier et ne s'ouvrirait jamais.
      await sb.from("documents").delete().eq("id", doc.id)
      return { ok: false, message: depot.erreur ?? "Dépôt impossible." }
    }

    revalidatePath("/[locale]/matters/[id]", "page")
    return { ok: true, message: `« ${nom} » rangé au dossier.` }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

// ---------------------------------------------------------------------------
// Pièces : téléverser, consulter, retirer
// ---------------------------------------------------------------------------

/**
 * Dépose un fichier POUR une pièce exigée.
 *
 * Le rattachement à l'exigence est fait par le déclencheur en base
 * (link_upload_to_requirement) : c'est lui qui marque la pièce reçue, note la
 * provenance et REMET LA VÉRIFICATION À ZÉRO. Le faire ici en plus donnerait
 * deux endroits où cette règle vit, et l'un des deux finirait par diverger —
 * le portail client passe par le même déclencheur.
 */
export async function deposerPourExigence(formData: FormData): Promise<Resultat> {
  try {
    const membre = await moi()
    const sb = await getSessionSupabase()

    const fichier = formData.get("fichier")
    if (!(fichier instanceof File) || fichier.size === 0) {
      return { ok: false, message: "Choisissez un fichier." }
    }

    const exigenceId = String(formData.get("exigenceId") ?? "")
    const matterId = String(formData.get("matterId") ?? "")
    const clientId = String(formData.get("clientId") ?? "") || null

    const { data: exigence } = await sb
      .from("matter_requirements").select("label_fr").eq("id", exigenceId).maybeSingle()
    if (!exigence) return { ok: false, message: "Pièce exigée introuvable." }

    const { data: doc, error } = await sb.from("documents").insert({
      firm_id: membre.firmId,
      client_id: clientId,
      matter_id: matterId,
      requirement_id: exigenceId,
      name: fichier.name,
      type: exigence.label_fr,
      category: "consultant_upload",
      uploaded_by: membre.fullName || membre.email,
      uploaded_by_user_id: membre.userId,
      source: "cabinet",
      status: "pending_review",
      mime_type: fichier.type || null,
      size_bytes: fichier.size,
    }).select("id").single()

    if (error || !doc) return { ok: false, message: lisible(error) }

    const { deposerFichier } = await import("./storage")
    const depot = await deposerFichier(doc.id as string, clientId ?? membre.firmId, fichier)

    if (!depot.ok) {
      await sb.from("documents").delete().eq("id", doc.id)
      return { ok: false, message: depot.erreur ?? "Dépôt impossible." }
    }

    revalidatePath("/[locale]/matters/[id]", "page")
    return {
      ok: true,
      message: `« ${fichier.name} » déposé. La pièce est reçue et reste à vérifier.`,
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

/**
 * Adresse d'aperçu d'un document, valable une heure.
 *
 * Signée et temporaire : le compartiment de stockage reste fermé. Un lien
 * permanent circulerait par courriel bien après que l'accès aurait dû être
 * retiré.
 */
export async function apercuDocument(formData: FormData): Promise<Resultat & { url?: string }> {
  try {
    await moi()
    const sb = await getSessionSupabase()
    const id = String(formData.get("documentId") ?? "")

    const { data: doc } = await sb
      .from("documents").select("storage_path, name").eq("id", id).maybeSingle()

    if (!doc?.storage_path) {
      return { ok: false, message: "Aucun fichier rattaché à ce document." }
    }

    const { lienTelechargement } = await import("./storage")
    const lien = await lienTelechargement(doc.storage_path as string)
    if (!lien.url) return { ok: false, message: lien.erreur ?? "Aperçu indisponible." }

    return { ok: true, message: `Ouverture de « ${doc.name} »…`, url: lien.url }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

/**
 * Retire un document déposé par erreur.
 *
 * La pièce exigée retourne à « non reçue » : réception ET vérification sont
 * effacées. Laisser la réception après avoir retiré le fichier produirait une
 * pièce marquée reçue que plus aucun document ne justifie — exactement le
 * genre d'écart qu'on ne découvre qu'en cherchant la pièce au moment de
 * soumettre.
 */
export async function retirerDocument(formData: FormData): Promise<Resultat> {
  try {
    await moi()
    const sb = await getSessionSupabase()
    const id = String(formData.get("documentId") ?? "")

    const { data: doc } = await sb
      .from("documents").select("id, name, requirement_id").eq("id", id).maybeSingle()
    if (!doc) return { ok: false, message: "Document introuvable." }

    if (doc.requirement_id) {
      const { error: eMaj } = await sb.from("matter_requirements").update({
        document_id: null,
        received_at: null, received_by: null, received_from: null,
        verified_at: null, verified_by: null,
      }).eq("id", doc.requirement_id)
      if (eMaj) return { ok: false, message: lisible(eMaj) }
    }

    const { error } = await sb.from("documents").delete().eq("id", id)
    if (error) return { ok: false, message: lisible(error) }

    revalidatePath("/[locale]/matters/[id]", "page")
    return {
      ok: true,
      message: doc.requirement_id
        ? `« ${doc.name} » retiré. La pièce redevient non reçue.`
        : `« ${doc.name} » retiré.`,
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}
