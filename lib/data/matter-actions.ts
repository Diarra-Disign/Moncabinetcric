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
