import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { journaliser } from "./journal"
import { validerFiche, libelleChamp, type ChampsFiche } from "./fiche-criteres"
import type { MembreModificateur } from "./fiche-modification"

/**
 * Créer une fiche client ou prospect.
 *
 * ELLE PARTAGE TOUT AVEC LA MODIFICATION, sauf le verbe. Mêmes champs, même
 * validation, même journal — c'est le §17, et la raison n'est pas l'économie :
 * deux chemins séparés ont déjà divergé une fois dans ce produit. La création
 * acceptait une adresse, la modification n'existait pas ; puis la modification
 * a gagné le nom légal et la date de naissance que la création ignorait
 * encore. Un même formulaire à deux modes rend cette dérive impossible.
 *
 * Séparée de la session pour la même raison que `modifierFiche()` : un module
 * « use server » n'est appelable que depuis une requête HTTP, et ce qui ne peut
 * pas être appelé par une épreuve n'est vérifié qu'en production.
 */

export interface ResultatCreation {
  ok: boolean
  message: string
  id?: string
  /** Le numéro de dossier attribué, pour un client. */
  reference?: string
}

/**
 * Le numéro de dossier d'un nouveau client.
 *
 * Calculé EN BASE par `next_client_file_number()`, jamais dans le navigateur.
 * L'écran des clients le composait à partir de la longueur de sa propre liste
 * — `CRIC-2026-0${100 + clients.length + 1}` — ce qui donne le même numéro à
 * deux consultants qui créent une fiche en même temps, et un numéro faux dès
 * qu'un filtre est actif. La conversion prospect → client employait déjà la
 * fonction ; la création directe ne la connaissait pas.
 */
async function prochainNumero(sb: SupabaseClient, firmId: string): Promise<string> {
  const { data, error } = await sb.rpc("next_client_file_number", { p_firm_id: firmId })
  if (error || !data) throw new Error(`Numérotation impossible : ${error?.message ?? "sans réponse"}`)
  return String(data)
}

/** Ce que la fiche affiche comme nom, pour une personne comme pour une société. */
function nomAffiche(champs: ChampsFiche): string {
  const personne = [champs.first_name, champs.last_name]
    .map((v) => (v ?? "").trim()).filter(Boolean).join(" ")
  const societe = (champs.company ?? "").trim()
  // Une société avec son représentant : « Boréale Inc. (Awa Diallo) ». Sans le
  // représentant, la seule raison sociale — appeler « (Représentant RH) » une
  // personne dont on n'a pas le nom écrivait une fiction dans la base.
  if (societe) return personne ? `${societe} (${personne})` : societe
  return personne
}

export async function creerFiche(
  sb: SupabaseClient,
  membre: MembreModificateur,
  type: "client" | "lead",
  champs: ChampsFiche
): Promise<ResultatCreation> {
  try {
    // LA VALIDATION EST ICI AUSSI, et pas seulement à l'écran. L'action reste
    // appelable sans lui, et une fiche sans nom ni courriel ne se retrouve ni
    // ne se joint.
    const erreurs = validerFiche(champs)
    const premiers = Object.entries(erreurs)
    if (premiers.length > 0) {
      return {
        ok: false,
        message: premiers.map(([champ, m]) => `${libelleChamp(champ)} : ${m}`).join(" "),
      }
    }

    const nom = nomAffiche(champs)
    if (!nom) return { ok: false, message: "Un nom est nécessaire pour créer la fiche." }

    const vide = (v: unknown) => {
      const s = typeof v === "string" ? v.trim() : v
      return s === "" || s === undefined ? null : s
    }

    const commun = {
      firm_id: membre.firmId,
      name: nom,
      civility: vide(champs.civility),
      first_name: vide(champs.first_name),
      last_name: vide(champs.last_name),
      legal_name: vide(champs.legal_name),
      birth_date: vide(champs.birth_date),
      email: (champs.email ?? "").trim(),
      email_secondary: vide(champs.email_secondary),
      phone: (champs.phone ?? "").trim(),
      phone_secondary: vide(champs.phone_secondary),
      address: vide(champs.address),
      address_line2: vide(champs.address_line2),
      city: vide(champs.city),
      province: vide(champs.province),
      postal_code: vide(champs.postal_code),
      country: vide(champs.country),
    }

    if (type === "lead") {
      const b2b = champs.type === "b2b"
      const { data, error } = await sb
        .from("leads")
        .insert({
          ...commun,
          legacy_id: `lead-${Date.now()}`,
          company: b2b ? vide(champs.company) : null,
          type: b2b ? "b2b" : "b2c",
          visa_type: (champs.visa_type ?? "").trim(),
          estimated_value: Number(champs.estimated_value ?? 0),
          score_label: champs.score_label || "med",
          // Le score chiffré suit l'étiquette : deux champs pour une seule
          // idée, mais c'est le tri du pipeline qui lit le nombre.
          score: { high: 90, med: 72, low: 55 }[String(champs.score_label || "med")] ?? 72,
          stage: "newLead",
          // Colonne « date » en base : une phrase d'affichage y faisait échouer
          // l'enregistrement entier.
          last_contact: new Date().toISOString().slice(0, 10),
          notes: (champs.notes ?? "").trim(),
          lmia_positions: b2b ? Number(champs.lmia_positions ?? 1) : null,
          source: vide(champs.source),
          contact_intent: vide(champs.contact_intent),
        })
        .select("id")
        .single()

      if (error || !data) return { ok: false, message: error?.message ?? "Création impossible." }

      await journaliser(sb, membre, {
        action: "lead.create",
        entityType: "lead",
        entityId: String(data.id),
        changements: [{ champ: "name", libelle: "Fiche", avant: "", apres: nom }],
        resume: `Prospect créé : ${nom}`,
      })
      return { ok: true, message: `Prospect « ${nom} » créé.`, id: String(data.id) }
    }

    const employeur = champs.client_type === "employer"
    const fileNumber = await prochainNumero(sb, membre.firmId)

    const { data, error } = await sb
      .from("clients")
      .insert({
        ...commun,
        legacy_id: `c-${Date.now()}`,
        file_number: fileNumber,
        citizenship: (champs.citizenship ?? "").trim() || (employeur ? "Canada (Employeur)" : ""),
        residence: (champs.residence ?? "").trim(),
        program: (champs.program ?? "").trim(),
        status: "active",
        intake_motif: (champs.intake_motif ?? "").trim(),
        client_type: employeur ? "employer" : "individual",
        neq_number: employeur ? vide(champs.neq_number) : null,
      })
      .select("id")
      .single()

    if (error || !data) return { ok: false, message: error?.message ?? "Création impossible." }

    await journaliser(sb, membre, {
      action: "client.create",
      entityType: "client",
      entityId: String(data.id),
      changements: [{ champ: "file_number", libelle: "Dossier", avant: "", apres: fileNumber }],
      resume: `Client créé : ${nom} — dossier ${fileNumber}`,
    })

    return {
      ok: true,
      message: `Client « ${nom} » créé sous le dossier ${fileNumber}.`,
      id: String(data.id),
      reference: fileNumber,
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}
