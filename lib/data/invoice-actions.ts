"use server"

import { revalidatePath } from "next/cache"
import { getSessionSupabase, getCurrentMember } from "@/lib/supabase/session"

/**
 * Créer une facture depuis un dossier.
 *
 * Client → Dossier → Facture : les deux premiers sont déjà connus quand on
 * arrive ici, et l'action ne les redemande pas. Elle relit le dossier en base
 * plutôt que de croire ce que le formulaire lui transmet — sans quoi le
 * navigateur déciderait à qui l'on facture.
 *
 * Elle n'écrit AUCUN total. Le sous-total, les taxes et le montant se
 * déduisent des lignes et des taux du cabinet : invoice_totals() les calcule,
 * et un déclencheur reporte le total dans invoices.amount. Poser un total ici
 * en produirait un second, qui finirait par contredire le détail.
 */

export interface LigneFacture {
  description: string
  quantite: number
  prixUnitaire: number
  taxable: boolean
}

export interface Resultat {
  ok: boolean
  message: string
  numero?: string
}

export async function creerFacture(formData: FormData): Promise<Resultat> {
  try {
    const membre = await getCurrentMember()
    if (!membre) return { ok: false, message: "Session expirée. Reconnectez-vous." }
    const sb = await getSessionSupabase()

    const matterId = String(formData.get("matterId") ?? "").trim()
    const date = String(formData.get("date") ?? "").trim() || new Date().toISOString().slice(0, 10)
    const dueOn = String(formData.get("dueOn") ?? "").trim()
    const notes = String(formData.get("notes") ?? "").trim()
    const locale = String(formData.get("locale") ?? "fr")

    let lignes: LigneFacture[] = []
    try {
      lignes = JSON.parse(String(formData.get("lignes") ?? "[]"))
    } catch {
      return { ok: false, message: "Les lignes de la facture sont illisibles." }
    }

    const retenues = lignes.filter((l) => l.description.trim() && Number(l.prixUnitaire) > 0)
    if (retenues.length === 0) {
      return { ok: false, message: "Ajoutez au moins une ligne avec une description et un montant." }
    }

    const { data: dossier } = await sb
      .from("matters")
      .select("id, client_id, client_name, reference")
      .eq("id", matterId)
      .maybeSingle()
    if (!dossier) return { ok: false, message: "Dossier introuvable." }
    if (!dossier.client_id) {
      // Une facture sans client n'a pas de destinataire : mieux vaut le dire
      // ici que de laisser la clé étrangère refuser en langage technique.
      return { ok: false, message: "Rattachez ce dossier à un client avant de facturer." }
    }

    const { data: numero, error: eNum } = await sb.rpc("next_invoice_number", { p_firm_id: membre.firmId })
    if (eNum) return { ok: false, message: `Numérotation impossible : ${eNum.message}` }

    const { data: facture, error } = await sb
      .from("invoices")
      .insert({
        firm_id: membre.firmId,
        client_id: dossier.client_id,
        matter_id: dossier.id,
        invoice_number: String(numero),
        client_name: dossier.client_name,
        // Zéro à l'insertion : le déclencheur le remplacera dès la première
        // ligne. L'écrire ici reviendrait à deviner ce que la base sait.
        amount: 0,
        date,
        due_on: dueOn || null,
        status: "draft",
        service_description: notes || retenues[0].description,
      })
      .select("id")
      .single()

    if (error) {
      if (error.code === "23505") {
        return { ok: false, message: "Ce numéro de facture existe déjà. Réessayez : un nouveau sera calculé." }
      }
      return { ok: false, message: error.message }
    }

    const { error: eLignes } = await sb.from("invoice_lines").insert(
      retenues.map((l, i) => ({
        firm_id: membre.firmId,
        invoice_id: facture.id,
        description: l.description.trim(),
        quantity: Number(l.quantite) || 1,
        unit_price: Number(l.prixUnitaire),
        taxable: l.taxable !== false,
        position: i + 1,
      }))
    )

    if (eLignes) {
      // La facture existe déjà mais n'a aucune ligne : la laisser ainsi
      // donnerait une pièce à zéro dollar qu'on croirait valide. On la retire.
      await sb.from("invoices").delete().eq("id", facture.id)
      return { ok: false, message: `Lignes refusées : ${eLignes.message}` }
    }

    revalidatePath(`/${locale}/matters`)
    revalidatePath(`/${locale}/billing`)

    return { ok: true, numero: String(numero), message: `Facture ${numero} créée.` }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

/** Émet une facture : elle cesse d'être un brouillon et part au client. */
export async function emettreFacture(formData: FormData): Promise<Resultat> {
  try {
    const membre = await getCurrentMember()
    if (!membre) return { ok: false, message: "Session expirée." }
    const sb = await getSessionSupabase()
    const id = String(formData.get("id") ?? "")
    const locale = String(formData.get("locale") ?? "fr")

    const { error } = await sb.from("invoices").update({ status: "issued" }).eq("id", id)
    if (error) return { ok: false, message: error.message }

    revalidatePath(`/${locale}/matters`)
    return { ok: true, message: "Facture émise." }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}
