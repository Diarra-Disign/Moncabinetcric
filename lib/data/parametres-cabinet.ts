import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { valider } from "./fiche-criteres"

/**
 * L'identité du cabinet : l'écrire, et savoir qu'elle a été écrite.
 *
 * ─── LA CAUSE DU DÉFAUT ────────────────────────────────────────────────────
 *
 * `updateFirmSettings()` faisait ceci :
 *
 *     const { error } = await sb.from("firms").update(payload).eq("id", firmId)
 *     if (error) fail(...)
 *     return true
 *
 * Et la politique RLS de la table dit ceci :
 *
 *     firms_owner_update  USING (id = current_firm_id() AND is_firm_owner())
 *
 * Un membre qui n'est pas PROPRIÉTAIRE — un consultant collaborateur, un
 * assistant — voit donc son UPDATE ne trouver AUCUNE ligne à modifier. Et
 * PostgREST ne rend alors AUCUNE ERREUR : « succès, zéro ligne » est un
 * succès. L'action concluait `return true`, l'écran affichait « Paramètres
 * enregistrés avec succès », et rien n'avait été écrit.
 *
 * Le même silence frappait toute écriture refusée par une contrainte de
 * visibilité : essayer d'écrire chez un autre cabinet réussissait sans effet.
 *
 * ─── CE QUI LE RENDAIT INVISIBLE ───────────────────────────────────────────
 *
 * L'écran gardait une COPIE dans localStorage et la réappliquait par-dessus
 * les données du serveur au chargement. Sept champs seulement y figuraient :
 * nom, permis, consultant, rue, téléphone, courriel, logo. Après
 * rechargement, ces sept-là « persistaient » — depuis le navigateur — tandis
 * que la ville, la province, le code postal et le numéro de bureau, absents
 * de la copie, disparaissaient. D'où le symptôme : une partie de la fiche
 * semble tenir, l'autre s'efface.
 *
 * Cette copie est supprimée. Le §16 le demande, et elle ne rendait aucun
 * service : elle transformait une panne d'écriture en illusion de succès.
 *
 * ─── CE MODULE ─────────────────────────────────────────────────────────────
 *
 * Séparé de la session pour la même raison que `modifierFiche()` et
 * `emettre()` : ce qu'aucune épreuve ne peut appeler n'est vérifié qu'en
 * production. C'est précisément ce qui s'est produit ici.
 */

export interface IdentiteCabinet {
  name?: string
  rcicNumber?: string
  rcicName?: string
  address?: string
  addressLine2?: string
  city?: string
  province?: string
  postalCode?: string
  country?: string
  phone?: string
  email?: string
  website?: string
  logoUrl?: string
  replyToEmail?: string
  emailSenderName?: string
  taxGstNumber?: string
  taxQstNumber?: string
  taxGstRate?: number
  taxQstRate?: number
  invoicePrefix?: string
  paymentTerms?: string
}

export interface ResultatParametres {
  ok: boolean
  message: string
}

/**
 * Les colonnes, et la façon dont chaque champ y arrive.
 *
 * Une TABLE plutôt qu'une suite de `if` : la correspondance entre le nom du
 * formulaire et le nom de la colonne est exactement l'endroit où un champ se
 * perd en silence — `addressLine2` d'un côté, `address_line2` de l'autre, et
 * personne ne s'en aperçoit avant de recharger la page.
 *
 * `vide` dit ce qu'une chaîne vide signifie pour cette colonne : `null` pour
 * un renseignement facultatif — c'est ce que `lignesAdresse()` attend pour
 * sauter la ligne au lieu d'en imprimer une vide sur le contrat — et `""`
 * pour les colonnes que la base déclare NOT NULL.
 */
const COLONNES: { champ: keyof IdentiteCabinet; colonne: string; vide: "null" | "chaine" }[] = [
  { champ: "name", colonne: "name", vide: "chaine" },
  { champ: "rcicNumber", colonne: "rcic_license_number", vide: "chaine" },
  { champ: "rcicName", colonne: "owner_name", vide: "chaine" },
  { champ: "address", colonne: "address", vide: "null" },
  { champ: "addressLine2", colonne: "address_line2", vide: "null" },
  { champ: "city", colonne: "city", vide: "null" },
  { champ: "province", colonne: "province", vide: "null" },
  { champ: "postalCode", colonne: "postal_code", vide: "null" },
  { champ: "country", colonne: "country", vide: "null" },
  { champ: "phone", colonne: "phone", vide: "null" },
  { champ: "email", colonne: "email", vide: "null" },
  { champ: "website", colonne: "website", vide: "null" },
  { champ: "logoUrl", colonne: "logo_url", vide: "null" },
  { champ: "replyToEmail", colonne: "reply_to_email", vide: "null" },
  { champ: "emailSenderName", colonne: "email_sender_name", vide: "null" },
  { champ: "taxGstNumber", colonne: "tax_gst_number", vide: "null" },
  { champ: "taxQstNumber", colonne: "tax_qst_number", vide: "null" },
  { champ: "invoicePrefix", colonne: "invoice_prefix", vide: "null" },
  { champ: "paymentTerms", colonne: "payment_terms", vide: "null" },
]

/**
 * La validation, raisonnable (§22).
 *
 * Elle réutilise celle des fiches — même module, mêmes règles. Un cabinet peut
 * exercer depuis l'étranger : un code postal non canadien n'est pas refusé,
 * sans quoi il faudrait en inventer un, et c'est celui-là qui s'imprimerait
 * sur le contrat.
 */
function controler(identite: IdentiteCabinet): string[] {
  const manques: string[] = []
  for (const [champ, cle] of [
    ["email", "email"], ["replyToEmail", "email"], ["phone", "phone"],
    ["postalCode", "postal_code"],
  ] as const) {
    const valeur = identite[champ as keyof IdentiteCabinet]
    if (typeof valeur !== "string" || !valeur.trim()) continue
    const m = valider(cle as "email" | "phone" | "postal_code", valeur)
    if (m) manques.push(m)
  }
  return manques
}

export async function updateFirmSettingsAvec(
  sb: SupabaseClient,
  firmId: string,
  identite: IdentiteCabinet
): Promise<ResultatParametres> {
  try {
    const manques = controler(identite)
    if (manques.length > 0) return { ok: false, message: manques.join(" ") }

    const charge: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const { champ, colonne, vide } of COLONNES) {
      const valeur = identite[champ]
      // `undefined` veut dire « champ non transmis » et laisse la colonne
      // intacte. C'est le §23 : modifier le seul téléphone ne doit pas vider
      // l'adresse. Une chaîne VIDE, elle, est une demande explicite d'effacer.
      if (valeur === undefined) continue
      const texte = String(valeur).trim()
      charge[colonne] = texte === "" ? (vide === "null" ? null : "") : texte
    }

    // Les taux arrivent en POURCENTAGE depuis l'écran — c'est ainsi qu'un
    // comptable les énonce — et se rangent en fraction, qui est ce que le
    // calcul multiplie.
    if (identite.taxGstRate !== undefined) charge.tax_gst_rate = identite.taxGstRate / 100
    if (identite.taxQstRate !== undefined) charge.tax_qst_rate = identite.taxQstRate / 100

    if (Object.keys(charge).length <= 1) {
      return { ok: false, message: "Aucun changement à enregistrer." }
    }

    // ── LE POINT DE LA CORRECTION ──────────────────────────────────────────
    // `.select("id")` force PostgREST à rendre les lignes RÉELLEMENT touchées.
    // Sans lui, une écriture refusée par RLS revenait « sans erreur » et
    // passait pour un succès. Un tableau vide est désormais un ÉCHEC, et il
    // est nommé.
    const { data, error } = await sb
      .from("firms")
      .update(charge)
      .eq("id", firmId)
      .select("id")

    if (error) return { ok: false, message: error.message }

    if (!data || data.length === 0) {
      return {
        ok: false,
        message:
          "Enregistrement refusé : seul le propriétaire du cabinet peut modifier " +
          "son identité. Demandez-lui d'effectuer la modification.",
      }
    }

    return { ok: true, message: "Paramètres enregistrés." }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}
