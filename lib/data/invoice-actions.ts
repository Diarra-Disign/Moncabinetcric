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

/**
 * Traduit les refus de la base en phrases lisibles.
 *
 * Les messages levés par les déclencheurs sont déjà écrits pour être lus :
 * ils sont repris tels quels. Les réécrire ici en produirait une seconde
 * version, qui finirait par dire autre chose que la règle.
 */
function lisible(e: { message?: string; code?: string } | null): string {
  const brut = e?.message ?? "Erreur inattendue."
  if (e?.code === "42501" || /row-level security/i.test(brut)) {
    return "Vous n'avez pas le droit d'effectuer cette action."
  }
  return brut
}

/** Remplace les lignes d'un brouillon. La base refuse si la facture est émise. */
export async function modifierFacture(formData: FormData): Promise<Resultat> {
  try {
    const membre = await getCurrentMember()
    if (!membre) return { ok: false, message: "Session expirée." }
    const sb = await getSessionSupabase()

    const id = String(formData.get("id") ?? "")
    const dueOn = String(formData.get("dueOn") ?? "").trim()
    const notes = String(formData.get("notes") ?? "").trim()
    const locale = String(formData.get("locale") ?? "fr")

    let lignes: LigneFacture[] = []
    try {
      lignes = JSON.parse(String(formData.get("lignes") ?? "[]"))
    } catch {
      return { ok: false, message: "Les lignes sont illisibles." }
    }
    const retenues = lignes.filter((l) => l.description.trim() && Number(l.prixUnitaire) > 0)
    if (retenues.length === 0) return { ok: false, message: "Une facture doit porter au moins une ligne." }

    // Les anciennes lignes partent d'abord : les remplacer une à une laisserait
    // un état intermédiaire où le total ne correspond à rien.
    const { error: eSup } = await sb.from("invoice_lines").delete().eq("invoice_id", id)
    if (eSup) return { ok: false, message: lisible(eSup) }

    const { error: eIns } = await sb.from("invoice_lines").insert(
      retenues.map((l, i) => ({
        firm_id: membre.firmId,
        invoice_id: id,
        description: l.description.trim(),
        quantity: Number(l.quantite) || 1,
        unit_price: Number(l.prixUnitaire),
        taxable: l.taxable !== false,
        position: i + 1,
      }))
    )
    if (eIns) return { ok: false, message: lisible(eIns) }

    const { error } = await sb
      .from("invoices")
      .update({ due_on: dueOn || null, service_description: notes || retenues[0].description })
      .eq("id", id)
    if (error) return { ok: false, message: lisible(error) }

    revalidatePath(`/${locale}/matters`)
    return { ok: true, message: "Facture modifiée." }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

/** Supprime un brouillon. La base refuse dès que la facture est émise. */
export async function supprimerFacture(formData: FormData): Promise<Resultat> {
  try {
    const sb = await getSessionSupabase()
    const id = String(formData.get("id") ?? "")
    const locale = String(formData.get("locale") ?? "fr")

    const { error } = await sb.from("invoices").delete().eq("id", id)
    if (error) return { ok: false, message: lisible(error) }

    revalidatePath(`/${locale}/matters`)
    return { ok: true, message: "Brouillon supprimé." }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

/**
 * Annule une facture émise.
 *
 * Elle n'est pas effacée : son numéro reste pris et la trace demeure. Une
 * suite de numéros trouée est le premier signe qu'une comptabilité a été
 * retouchée — c'est précisément ce qu'un vérificateur cherche.
 */
export async function annulerFacture(formData: FormData): Promise<Resultat> {
  try {
    const sb = await getSessionSupabase()
    const id = String(formData.get("id") ?? "")
    const motif = String(formData.get("motif") ?? "").trim()
    const locale = String(formData.get("locale") ?? "fr")

    const { data: regle } = await sb.rpc("invoice_paid_amount", { i_id: id })
    if (Number(regle ?? 0) > 0) {
      return {
        ok: false,
        message: "Cette facture a reçu un paiement : remboursez-le avant de l'annuler, sinon l'encaissement n'aurait plus de pièce.",
      }
    }

    const { data: avant } = await sb.from("invoices").select("service_description").eq("id", id).maybeSingle()
    const note = [String((avant as { service_description?: string } | null)?.service_description ?? ""), motif ? `Annulée : ${motif}` : "Annulée."]
      .filter(Boolean)
      .join(" — ")

    const { error } = await sb.from("invoices").update({ status: "cancelled", service_description: note }).eq("id", id)
    if (error) return { ok: false, message: lisible(error) }

    revalidatePath(`/${locale}/matters`)
    return { ok: true, message: "Facture annulée. Son numéro reste dans la suite." }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

/**
 * Envoie la facture au client, PDF joint.
 *
 * Le document part par le même chemin que celui qu'affiche « Voir le PDF » —
 * pdfDeFacture() est appelée par les deux. Composer une seconde fois ici
 * ferait courir le risque que le client reçoive une pièce différente de celle
 * que le consultant a sous les yeux.
 *
 * Un brouillon est ÉMIS au passage : envoyer une facture, c'est l'émettre.
 * Laisser partir un document marqué « brouillon » puis lui donner un autre
 * numéro serait le meilleur moyen de faire payer deux fois — ou pas du tout.
 */
export async function envoyerFactureAuClient(formData: FormData): Promise<Resultat> {
  try {
    const membre = await getCurrentMember()
    if (!membre) return { ok: false, message: "Session expirée." }
    const sb = await getSessionSupabase()
    const id = String(formData.get("id") ?? "")
    const locale = String(formData.get("locale") ?? "fr")

    const { pdfDeFacture } = await import("@/lib/invoices/document")
    const { envoyerCourriel } = await import("@/lib/email/send")
    const { identiteCourriel } = await import("./questionnaires")

    if (String(formData.get("emettre") ?? "") === "1") {
      const { error } = await sb.from("invoices").update({ status: "issued" }).eq("id", id)
      if (error) return { ok: false, message: lisible(error) }
    }

    const doc = await pdfDeFacture(sb, id)
    if (!doc) return { ok: false, message: "Facture introuvable." }
    if (!doc.clientCourriel) {
      return { ok: false, message: "Ce client n'a pas d'adresse courriel. Ajoutez-la sur sa fiche, ou téléchargez le PDF et transmettez-le vous-même." }
    }

    const identite = await identiteCourriel()
    const montant = new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(doc.total)
    const echeance = doc.echeance ? `<p style="font-size:14px"><strong>À régler avant le ${doc.echeance}.</strong></p>` : ""

    const envoi = await envoyerCourriel({
      destinataire: doc.clientCourriel,
      nomExpediteur: identite.nomExpediteur,
      repondreA: identite.repondreA,
      sujet: `Facture ${doc.numero} — ${identite.nom}`,
      texte:
        `Bonjour ${doc.clientNom},\n\nVeuillez trouver ci-joint la facture ${doc.numero} ` +
        `d'un montant de ${montant}${doc.echeance ? `, à régler avant le ${doc.echeance}` : ""}.\n\n` +
        `${identite.nom}`,
      html: `
        <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
          <p style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:4px">${identite.nom}</p>
          <h1 style="font-size:20px;margin:0 0 16px">Facture ${doc.numero}</h1>
          <p style="font-size:15px;line-height:1.6">Bonjour ${doc.clientNom},</p>
          <p style="font-size:15px;line-height:1.6">
            Veuillez trouver ci-joint la facture <strong>${doc.numero}</strong> d'un montant de
            <strong>${montant}</strong>${doc.dossierReference ? `, pour le dossier ${doc.dossierReference}` : ""}.
          </p>
          ${echeance}
          <p style="font-size:12px;color:#64748b;margin-top:28px">${identite.nom} — ${identite.repondreA ?? ""}</p>
        </div>`,
      pieces: [{ nom: `${doc.numero}.pdf`, contenu: doc.octets }],
    })

    if (!envoi.configure) return { ok: false, message: "L'envoi de courriel n'est pas configuré." }
    if (!envoi.envoye) return { ok: false, message: `La facture n'est pas partie : ${envoi.erreur ?? "erreur inconnue"}.` }

    revalidatePath(`/${locale}/matters`)
    return { ok: true, message: `Facture ${doc.numero} envoyée à ${doc.clientCourriel}.` }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}

/**
 * Les lignes d'une facture, pour les rouvrir à la modification.
 *
 * Elles ne voyagent pas avec la fiche du dossier : la liste des factures n'en
 * a pas besoin, et les y joindre alourdirait chaque chargement de dossier pour
 * un écran qu'on ouvre rarement.
 */
export async function lignesDeFacture(id: string): Promise<LigneFacture[]> {
  const sb = await getSessionSupabase()
  const { data } = await sb
    .from("invoice_lines")
    .select("description, quantity, unit_price, taxable, position")
    .eq("invoice_id", id)
    .order("position")

  return (data ?? []).map((l) => ({
    description: String(l.description),
    quantite: Number(l.quantity),
    prixUnitaire: Number(l.unit_price),
    taxable: l.taxable !== false,
  }))
}

/**
 * Envoie le reçu d'un paiement au client, PDF joint.
 *
 * Décalque de envoyerFactureAuClient, à une différence près qui change le ton
 * du message : une facture RÉCLAME, un reçu ATTESTE. Le courriel ne demande
 * donc rien et n'annonce aucune échéance — il confirme un encaissement, et
 * c'est tout ce que le client doit y lire.
 *
 * Rien n'est écrit en base : réémettre un reçu ne modifie pas le paiement, et
 * le même reçu peut donc être renvoyé autant de fois qu'un client l'égare.
 */
export async function envoyerRecuAuClient(formData: FormData): Promise<Resultat> {
  try {
    const membre = await getCurrentMember()
    if (!membre) return { ok: false, message: "Session expirée." }
    const sb = await getSessionSupabase()
    const id = String(formData.get("id") ?? "")
    const locale = String(formData.get("locale") ?? "fr")

    const { pdfDeRecu } = await import("@/lib/invoices/document")
    const { envoyerCourriel } = await import("@/lib/email/send")
    const { identiteCourriel } = await import("./questionnaires")

    const doc = await pdfDeRecu(sb, id)
    if (!doc) return { ok: false, message: "Paiement introuvable." }
    if (!doc.clientCourriel) {
      return {
        ok: false,
        message:
          "Ce client n'a pas d'adresse courriel. Ajoutez-la sur sa fiche, ou téléchargez le PDF et transmettez-le vous-même.",
      }
    }

    const identite = await identiteCourriel()
    const montant = new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }).format(doc.montant)

    // La mention fidéicommis n'est pas décorative : elle dit au client que son
    // argent est dans un compte séparé et qu'aucun honoraire n'en sera prélevé
    // sans facture. La taire dans le courriel alors que le PDF la porte
    // laisserait croire à un simple encaissement.
    const fiducie = doc.enFideicommis
      ? `<p style="font-size:14px;line-height:1.6">Cette somme est déposée dans le compte en fidéicommis du cabinet. Aucun honoraire n'en sera prélevé sans l'émission préalable d'une facture.</p>`
      : ""

    const envoi = await envoyerCourriel({
      destinataire: doc.clientCourriel,
      nomExpediteur: identite.nomExpediteur,
      repondreA: identite.repondreA,
      sujet: `Reçu ${doc.numero} — ${identite.nom}`,
      texte:
        `Bonjour ${doc.clientNom},\n\nNous accusons réception de votre paiement de ${montant}` +
        `${doc.factureNumero ? ` pour la facture ${doc.factureNumero}` : ""}, le ${doc.date}.\n\n` +
        `Le reçu est joint à ce message.\n\n${identite.nom}`,
      html: `
        <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
          <p style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:4px">${identite.nom}</p>
          <h1 style="font-size:20px;margin:0 0 16px">Reçu ${doc.numero}</h1>
          <p style="font-size:15px;line-height:1.6">Bonjour ${doc.clientNom},</p>
          <p style="font-size:15px;line-height:1.6">
            Nous accusons réception de votre paiement de <strong>${montant}</strong>
            ${doc.factureNumero ? `pour la facture <strong>${doc.factureNumero}</strong>` : ""}
            ${doc.dossierReference ? `, dossier ${doc.dossierReference}` : ""}, le ${doc.date}.
          </p>
          ${fiducie}
          <p style="font-size:15px;line-height:1.6">Le reçu officiel est joint à ce message.</p>
          <p style="font-size:12px;color:#64748b;margin-top:28px">${identite.nom} — ${identite.repondreA ?? ""}</p>
        </div>`,
      pieces: [{ nom: `${doc.numero}.pdf`, contenu: doc.octets }],
    })

    if (!envoi.configure) return { ok: false, message: "L'envoi de courriel n'est pas configuré." }
    if (!envoi.envoye) return { ok: false, message: `Le reçu n'est pas parti : ${envoi.erreur ?? "erreur inconnue"}.` }

    revalidatePath(`/${locale}/matters`)
    return { ok: true, message: `Reçu ${doc.numero} envoyé à ${doc.clientCourriel}.` }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}
