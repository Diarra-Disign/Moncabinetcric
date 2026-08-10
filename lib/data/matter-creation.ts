"use server"

import { revalidatePath } from "next/cache"
import { getSessionSupabase, getCurrentMember } from "@/lib/supabase/session"

/**
 * Ouvrir un dossier depuis la fiche d'un client.
 *
 * Le profil client porte ce qui est permanent — identité, coordonnées,
 * nationalité ; le dossier porte ce qui appartient à UN mandat. Les deux
 * restent distincts, et cette action ne fait que recopier dans le second ce
 * que le premier sait déjà, pour éviter la double saisie.
 *
 * Ce qu'elle ne fait PAS elle-même : garnir le dossier de ses pièces exigées
 * et de ses échéances. seed_matter_requirements() et seed_matter_deadlines()
 * s'en chargent en base, au moment de l'insertion. Les rappeler ici
 * produirait une seconde règle, appliquée seulement aux dossiers ouverts par
 * cet écran.
 */

export interface Resultat {
  ok: boolean
  message: string
  /** La référence engendrée, pour emmener l'utilisateur sur le dossier. */
  reference?: string
}

/**
 * Le programme visé, déduit du service quand l'utilisateur n'en choisit pas.
 *
 * Le programme gouverne les pièces exigées : c'est programme_modele() qui
 * décide de la liste. Le laisser vide donnerait un dossier sans exigences,
 * c'est-à-dire un dossier qu'aucun contrôle de complétude ne pourrait
 * bloquer — exactement ce que le verrou de complétude sert à empêcher.
 */
const PROGRAMME_PAR_SERVICE: Record<string, string> = {
  "Permis d'études": "Permis d'études",
  "Permis de travail": "Permis de travail",
  "Visa visiteur": "Visa de visiteur",
  "Super Visa": "Visa de visiteur",
  Parrainage: "Parrainage",
  "Résidence permanente": "Résidence Permanente (EE)",
  "Entrée express": "Résidence Permanente (EE)",
  EIMT: "EIMT",
}

const CATEGORIE_PAR_SERVICE: Record<string, string> = {
  "Permis d'études": "study",
  "Permis de travail": "work",
  "Visa visiteur": "visitor",
  "Super Visa": "visitor",
  Parrainage: "family",
  "Résidence permanente": "pr",
  "Entrée express": "pr",
  EIMT: "work",
}

export async function creerDossierPourClient(formData: FormData): Promise<Resultat> {
  try {
    const membre = await getCurrentMember()
    if (!membre) return { ok: false, message: "Session expirée. Reconnectez-vous." }
    const sb = await getSessionSupabase()

    const clientId = String(formData.get("clientId") ?? "").trim()
    const service = String(formData.get("serviceType") ?? "").trim()
    const programmeSaisi = String(formData.get("program") ?? "").trim()
    const referenceSaisie = String(formData.get("reference") ?? "").trim()
    const ouvertLe = String(formData.get("openedDate") ?? "").trim()
    const echeance = String(formData.get("deadline") ?? "").trim()
    const rcic = String(formData.get("rcic") ?? "").trim()
    const agentId = String(formData.get("agentId") ?? "").trim()
    const statut = String(formData.get("status") ?? "pending").trim()
    const priorite = String(formData.get("priority") ?? "normal").trim()
    const notes = String(formData.get("notes") ?? "").trim()
    const description = String(formData.get("description") ?? "").trim()
    const locale = String(formData.get("locale") ?? "fr")

    if (!clientId) return { ok: false, message: "Client introuvable." }
    if (!service) return { ok: false, message: "Choisissez un type de dossier." }

    // Le client est relu en base : reprendre les valeurs transmises par le
    // formulaire reviendrait à laisser le navigateur décider de l'identité du
    // titulaire du mandat.
    const { data: client } = await sb
      .from("clients")
      .select("id, name, client_type, program")
      .eq("id", clientId)
      .maybeSingle()
    if (!client) return { ok: false, message: "Ce client est introuvable." }

    const programme = programmeSaisi || PROGRAMME_PAR_SERVICE[service] || String(client.program ?? "") || service

    let reference = referenceSaisie
    if (!reference) {
      const { data, error } = await sb.rpc("next_matter_reference", { p_firm_id: membre.firmId })
      if (error) return { ok: false, message: `Numérotation impossible : ${error.message}` }
      reference = String(data)
    }

    const { error } = await sb.from("matters").insert({
      firm_id: membre.firmId,
      client_id: client.id,
      reference,
      client_name: client.name,
      // Les deux tables ne parlent pas la même langue : un client est
      // « individual » ou « company », un dossier « b2c » ou « b2b ».
      // Recopier l'un dans l'autre faisait échouer la contrainte — et le
      // refus venait de la base, pas de l'écran, ce qui est la bonne place.
      client_type: client.client_type === "company" || client.client_type === "employer" ? "b2b" : "b2c",
      service_type: service,
      program: programme,
      category: CATEGORIE_PAR_SERVICE[service] ?? null,
      opened_date: ouvertLe || new Date().toISOString().slice(0, 10),
      deadline: echeance || null,
      rcic: rcic || membre.fullName || membre.email,
      agent_id: agentId || null,
      status: statut,
      priority: priorite,
      is_priority: priorite === "critical" || priorite === "high",
      notes,
      description,
    })

    if (error) {
      // La référence est unique par cabinet : deux ouvertures simultanées se
      // disputent le même numéro, et c'est la base qui tranche. On le dit
      // plutôt que de laisser un code technique à l'écran.
      if (error.code === "23505") {
        return { ok: false, message: "Ce numéro de dossier existe déjà. Réessayez : un nouveau sera calculé." }
      }
      return { ok: false, message: error.message }
    }

    revalidatePath(`/${locale}/matters`)
    revalidatePath(`/${locale}/clients`)

    return { ok: true, reference, message: `Dossier ${reference} ouvert pour ${client.name}.` }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}
