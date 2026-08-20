"use server"

import { revalidatePath } from "next/cache"
import { getSessionSupabase, getCurrentMember } from "@/lib/supabase/session"
import { messageErreur } from "@/lib/data/erreurs"

export interface Resultat { ok: boolean; message: string; id?: string }

async function moi() {
  const membre = await getCurrentMember()
  if (!membre) throw new Error("Session expirée. Reconnectez-vous.")
  return membre
}

/**
 * Traduit un refus de la base en phrase lisible.
 *
 * Le refus qui compte le plus passe par ici : le déclencheur
 * enforce_trust_balance interdit tout solde débiteur, et son message dit de
 * COMBIEN le client passerait en négatif. Le remplacer par un « erreur
 * inattendue » ferait perdre l'information la plus utile de tout le module.
 */
function lisible(e: { message?: string; code?: string }, locale = "fr"): string {
  if (e?.code === "23505") {
    return locale === "en"
      ? "A reconciliation already exists for this period."
      : "Un rapprochement existe déjà pour cette période."
  }
  return messageErreur(e, locale)
}

const nombre = (v: FormDataEntryValue | null) =>
  Number(String(v ?? "").replace(",", ".").replace(/\s/g, ""))

// ---------------------------------------------------------------------------
// Le registre
// ---------------------------------------------------------------------------

/**
 * Enregistre un mouvement du compte en fidéicommis.
 *
 * Les quatre types existaient dans le schéma depuis le début, mais seul le
 * virement d'honoraires avait un chemin depuis l'interface, et le dépôt était
 * produit automatiquement par un paiement. Le DÉBOURS payé pour le compte d'un
 * client et le REMBOURSEMENT n'en avaient aucun : ils sortaient du compte en
 * banque sans laisser d'écriture, et le registre dérivait du relevé.
 *
 * Le rattachement à un client est obligatoire — c'est le §F23 du cahier des
 * charges, et c'est surtout ce qui rend un solde par client calculable. Un
 * mouvement orphelin rendrait la ventilation fausse sans que rien ne le dise.
 */
export async function enregistrerMouvementFideicommis(formData: FormData): Promise<Resultat> {
  try {
    const membre = await moi()
    const sb = await getSessionSupabase()

    const type = String(formData.get("type") ?? "")
    if (!["deposit", "withdrawal", "refund_to_client", "transfer_to_business"].includes(type)) {
      return { ok: false, message: "Type de mouvement inconnu." }
    }

    const clientId = String(formData.get("clientId") ?? "")
    if (!clientId) return { ok: false, message: "Choisissez le client concerné : un mouvement sans client rendrait la ventilation fausse." }

    const montant = nombre(formData.get("montant"))
    if (!Number.isFinite(montant) || montant <= 0) {
      return { ok: false, message: "Le montant doit être supérieur à zéro." }
    }

    const { data, error } = await sb.from("trust_ledger").insert({
      firm_id: membre.firmId,
      client_id: clientId,
      matter_id: String(formData.get("matterId") ?? "") || null,
      entry_type: type,
      amount: montant,
      occurred_on: String(formData.get("date") ?? "") || new Date().toISOString().slice(0, 10),
      memo: String(formData.get("memo") ?? "") || null,
      recorded_by: membre.profileId,
    }).select("id").single()

    if (error) return { ok: false, message: lisible(error) }

    revalidatePath(`/${String(formData.get("locale") ?? "fr")}/fideicommis`)
    return { ok: true, message: "Mouvement enregistré au registre.", id: String(data.id) }
  } catch (e) {
    return { ok: false, message: messageErreur(e) }
  }
}

// ---------------------------------------------------------------------------
// Le rapprochement
// ---------------------------------------------------------------------------

/**
 * Ouvre — ou met à jour — le rapprochement d'une période.
 *
 * Le solde du registre est FIGÉ à l'enregistrement, et c'est le point du
 * module. Recalculé à l'ouverture du document six mois plus tard, il aurait
 * intégré les écritures postérieures : l'état montrerait alors un écart qui
 * n'existait pas, ou masquerait celui qui existait. Un rapprochement est un
 * constat daté.
 */
export async function enregistrerRapprochement(formData: FormData): Promise<Resultat> {
  try {
    const membre = await moi()
    const sb = await getSessionSupabase()

    const periode = String(formData.get("periodeFin") ?? "")
    if (!/^\d{4}-\d{2}-\d{2}$/.test(periode)) {
      return { ok: false, message: "Indiquez la date de fin de période, telle qu'elle figure sur le relevé." }
    }

    const soldeBancaire = nombre(formData.get("soldeBancaire"))
    if (!Number.isFinite(soldeBancaire)) {
      return { ok: false, message: "Saisissez le solde du relevé bancaire." }
    }

    // Le solde ET la ventilation sont figés ensemble. Figer l'un sans l'autre
    // produisait sur l'état imprimé deux totaux incompatibles : le solde du mois
    // arrêté, et une ventilation relue après coup.
    const [{ data: solde }, { data: ventil }] = await Promise.all([
      sb.rpc("firm_trust_balance", { f_id: membre.firmId }),
      sb.rpc("firm_trust_by_client", { f_id: membre.firmId }),
    ])
    const ventilation = ((ventil ?? []) as Record<string, unknown>[])
      .map((v) => ({ nom: String(v.client_name ?? ""), solde: Number(v.balance ?? 0) }))

    let ecarts: { libelle: string; montant: number }[] = []
    try {
      const brut = JSON.parse(String(formData.get("ecarts") ?? "[]"))
      if (Array.isArray(brut)) {
        ecarts = brut
          .map((e) => ({ libelle: String(e?.libelle ?? "").trim(), montant: Number(e?.montant) }))
          .filter((e) => e.libelle && Number.isFinite(e.montant) && e.montant !== 0)
      }
    } catch {
      return { ok: false, message: "Les éléments de rapprochement sont illisibles." }
    }

    const id = String(formData.get("id") ?? "")
    const ligne = {
      firm_id: membre.firmId,
      period_end: periode,
      bank_balance: soldeBancaire,
      ledger_balance: Number(solde ?? 0),
      explanations: ecarts,
      client_breakdown: ventilation,
      notes: String(formData.get("notes") ?? "") || null,
    }

    const { data, error } = id
      ? await sb.from("trust_reconciliations").update(ligne).eq("id", id).select("id").single()
      : await sb.from("trust_reconciliations").insert({ ...ligne, created_by: membre.profileId }).select("id").single()

    if (error) return { ok: false, message: lisible(error) }

    revalidatePath(`/${String(formData.get("locale") ?? "fr")}/fideicommis`)
    return { ok: true, message: "Rapprochement enregistré.", id: String(data.id) }
  } catch (e) {
    return { ok: false, message: messageErreur(e) }
  }
}

/**
 * Arrête définitivement un rapprochement.
 *
 * Le refus d'arrêter un état dont l'écart n'est PAS entièrement expliqué est
 * délibéré : un rapprochement conservé avec un écart inexpliqué n'atteste
 * rien, et donne à l'inspection exactement la question qu'on voulait éviter.
 * Ce n'est pas une contrainte technique — la base l'accepterait — c'est le
 * sens même du document.
 */
export async function cloreRapprochement(formData: FormData): Promise<Resultat> {
  try {
    const membre = await moi()
    const sb = await getSessionSupabase()
    const id = String(formData.get("id") ?? "")

    const { data: r } = await sb
      .from("trust_reconciliations")
      .select("bank_balance, ledger_balance, explanations, status")
      .eq("id", id)
      .maybeSingle()

    if (!r) return { ok: false, message: "Rapprochement introuvable." }
    if (r.status === "closed") return { ok: false, message: "Ce rapprochement est déjà clos." }

    const ecarts = (r.explanations as { montant: number }[]) ?? []
    const explique = ecarts.reduce((t, e) => t + Number(e.montant ?? 0), 0)
    const residuel = Math.round((Number(r.bank_balance) + explique - Number(r.ledger_balance)) * 100) / 100

    if (residuel !== 0) {
      const signe = residuel > 0 ? "de plus" : "de moins"
      return {
        ok: false,
        message:
          `Il reste ${Math.abs(residuel).toFixed(2)} $ ${signe} au relevé que le registre n'explique pas. ` +
          "Ajoutez l'élément qui en rend compte — chèque en circulation, dépôt en transit, frais bancaires — avant d'arrêter la période.",
      }
    }

    const { error } = await sb
      .from("trust_reconciliations")
      .update({ status: "closed", closed_at: new Date().toISOString(), closed_by: membre.profileId })
      .eq("id", id)

    if (error) return { ok: false, message: lisible(error) }

    revalidatePath(`/${String(formData.get("locale") ?? "fr")}/fideicommis`)
    return { ok: true, message: "Rapprochement arrêté. Il ne peut plus être modifié." }
  } catch (e) {
    return { ok: false, message: messageErreur(e) }
  }
}

/** Un brouillon se jette ; un état clos ne se jette pas — la base l'interdit. */
export async function supprimerRapprochement(formData: FormData): Promise<Resultat> {
  try {
    await moi()
    const sb = await getSessionSupabase()
    const { error } = await sb.from("trust_reconciliations").delete().eq("id", String(formData.get("id") ?? ""))
    if (error) return { ok: false, message: lisible(error) }
    revalidatePath(`/${String(formData.get("locale") ?? "fr")}/fideicommis`)
    return { ok: true, message: "Brouillon supprimé." }
  } catch (e) {
    return { ok: false, message: messageErreur(e) }
  }
}
