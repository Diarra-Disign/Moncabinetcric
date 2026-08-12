import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { statutEtape, type EtapePaiement, type StatutEtape } from "./echeancier"

/**
 * Du contrat à la facture : facturer une étape de l'échéancier (§27, §28).
 *
 * ─── CE QUE CE MODULE NE FAIT PAS ──────────────────────────────────────────
 *
 * Il ne facture RIEN automatiquement. Le §27 est explicite, et il a raison :
 * une facture émise porte un numéro dans une suite continue, et ce numéro ne
 * se reprend pas. Une facture créée toute seule au mauvais moment devrait être
 * annulée — pas supprimée — et laisserait un trou expliqué dans le registre du
 * cabinet. C'est le consultant qui décide, étape par étape.
 *
 * Il ne RECOPIE PAS le statut. `invoice_status()` calcule déjà l'état réel à
 * partir des paiements encaissés. L'étape porte seulement le LIEN vers sa
 * facture ; « payé », « partiellement payé », « en retard » se déduisent.
 * Recopier créerait une seconde vérité qui dériverait au premier encaissement
 * saisi ailleurs — le contrat dirait « payé » et le registre « il reste 500 $ ».
 *
 * ─── CE QU'IL GARANTIT ─────────────────────────────────────────────────────
 *
 * Une étape ne se facture qu'UNE fois. L'index unique
 * `invoices_une_facture_par_etape` le tient en base : deux clics sur « Créer
 * la facture » ne peuvent pas produire deux factures pour le même versement.
 * Ce module donne le message ; la base donne la garantie.
 */

export interface ResultatFacturation {
  ok: boolean
  message: string
  factureId?: string
  numero?: string
}

/** Une étape enrichie de ce que sa facture en dit. */
export interface EtapeSuivie extends EtapePaiement {
  statutCalcule: StatutEtape
  factureId?: string
  factureNumero?: string
  /** Ce qui a été encaissé sur cette étape. */
  regle: number
  /** Vrai quand la facture peut encore être créée. */
  facturable: boolean
}

/**
 * L'échéancier d'une entente, avec l'état réel de chaque étape.
 *
 * UNE SEULE REQUÊTE pour toutes les factures du contrat, puis un appariement
 * en mémoire. Une requête par étape aurait multiplié les allers-retours pour
 * un contrat en huit versements — et l'écran attend cette réponse.
 */
export async function suivreEcheancier(
  sb: SupabaseClient,
  agreementId: string
): Promise<{ etapes: EtapeSuivie[]; statut: string } | null> {
  const { data: entente } = await sb
    .from("agreements")
    .select("id, status, payment_schedule, matter_id, client_id")
    .eq("id", agreementId)
    .maybeSingle()
  if (!entente) return null

  const etapes = (entente.payment_schedule as EtapePaiement[]) ?? []
  if (etapes.length === 0) return { etapes: [], statut: String(entente.status ?? "draft") }

  const { data: factures } = await sb
    .from("invoices")
    .select("id, invoice_number, agreement_step, status, amount")
    .eq("agreement_id", agreementId)

  // Le statut RÉEL et le montant encaissé viennent des fonctions de la base :
  // les recalculer ici aurait produit une seconde arithmétique, et c'est celle
  // de la facturation qui fait foi.
  const etats = await Promise.all(
    (factures ?? []).map(async (f) => {
      const [{ data: statut }, { data: regle }] = await Promise.all([
        sb.rpc("invoice_status", { i_id: f.id }),
        sb.rpc("invoice_paid_amount", { i_id: f.id }),
      ])
      return {
        rang: Number(f.agreement_step ?? 0),
        id: String(f.id),
        numero: String(f.invoice_number ?? ""),
        statut: String(statut ?? f.status ?? ""),
        regle: Number(regle ?? 0),
      }
    })
  )

  return {
    statut: String(entente.status ?? "draft"),
    etapes: etapes.map((e, i) => {
      const rang = Number(e.position ?? i + 1)
      const f = etats.find((x) => x.rang === rang && x.statut !== "cancelled")
      return {
        ...e,
        position: rang,
        statutCalcule: statutEtape(e, f?.statut),
        factureId: f?.id,
        factureNumero: f?.numero,
        regle: f?.regle ?? 0,
        // Un brouillon ne se facture pas : le contrat n'est pas encore émis,
        // et facturer un engagement qui peut encore changer ferait naître un
        // litige sur le montant.
        facturable: !f && entente.status !== "draft" && entente.status !== "cancelled",
      }
    }),
  }
}

/**
 * Crée la facture d'une étape (§27).
 *
 * Le rattachement au DOSSIER est cherché, pas exigé. Une entente peut précéder
 * l'ouverture du dossier — c'est même le cas ordinaire, puisqu'on signe avant
 * de travailler. La facture se rattache alors au seul client, et `matter_id`
 * reste vide : le refuser obligerait à ouvrir un dossier pour encaisser un
 * acompte, ce qui inverse l'ordre réel des choses.
 */
export async function facturerEtape(
  sb: SupabaseClient,
  membre: { firmId: string },
  agreementId: string,
  rang: number,
  options: { dueOn?: string } = {}
): Promise<ResultatFacturation> {
  try {
    const { data: entente } = await sb
      .from("agreements")
      .select("id, reference, title, status, is_probono, payment_schedule, client_id, matter_id")
      .eq("id", agreementId)
      .maybeSingle()

    if (!entente) return { ok: false, message: "Cette entente est introuvable." }
    if (entente.status === "draft") {
      return {
        ok: false,
        message: "Émettez l'entente avant de facturer : un brouillon peut encore changer de montant.",
      }
    }
    if (!entente.client_id) {
      // Une facture sans client n'a pas de destinataire. Le dire ici vaut
      // mieux que de laisser la clé étrangère refuser en langage technique.
      return {
        ok: false,
        message: "Cette entente vise un prospect. Convertissez-le en client avant de facturer.",
      }
    }

    const etapes = (entente.payment_schedule as EtapePaiement[]) ?? []
    const etape = etapes.find((e, i) => Number(e.position ?? i + 1) === rang)
    if (!etape) return { ok: false, message: `L'étape ${rang} n'existe pas dans cet échéancier.` }
    if (Number(etape.montant) <= 0) {
      return { ok: false, message: `L'étape ${rang} n'a aucun montant à facturer.` }
    }

    const { data: numero, error: eNum } = await sb.rpc("next_invoice_number", {
      p_firm_id: membre.firmId,
    })
    if (eNum) return { ok: false, message: `Numérotation impossible : ${eNum.message}` }

    const { data: client } = await sb
      .from("clients").select("name").eq("id", entente.client_id).maybeSingle()

    const { data: facture, error } = await sb
      .from("invoices")
      .insert({
        firm_id: membre.firmId,
        client_id: entente.client_id,
        matter_id: entente.matter_id ?? null,
        agreement_id: agreementId,
        agreement_step: rang,
        invoice_number: String(numero),
        client_name: String(client?.name ?? ""),
        // Zéro à l'insertion : le déclencheur `sync_invoice_amount` le
        // remplacera dès la première ligne. L'écrire ici reviendrait à deviner
        // ce que la base sait — et à risquer un montant qui ne correspond pas
        // aux lignes.
        amount: 0,
        date: new Date().toISOString().slice(0, 10),
        due_on: options.dueOn || null,
        status: "draft",
        // L'INTENTION DU CONTRAT SUIT LA FACTURE. Une étape déclarée en
        // fidéicommis produit une facture marquée comme telle, et le reçu
        // portera la mention de l'article 13 sans que personne n'ait à y
        // penser au moment d'encaisser.
        //
        // Elle ne DÉCIDE pas la destination du paiement : celle-ci est choisie
        // à l'encaissement, sans valeur par défaut, ici comme en base. Un
        // virement peut arriver sur le mauvais compte, et le registre doit
        // dire ce qui s'est passé, pas ce qui était prévu.
        is_trust_account: etape.fideicommis === true,
        service_description: `${entente.reference} — ${etape.description}`,
      })
      .select("id")
      .single()

    if (error) {
      // L'index unique a parlé : l'étape est déjà facturée. Le message le dit
      // en français plutôt que de rendre « duplicate key value violates… ».
      if (error.code === "23505") {
        return {
          ok: false,
          message: `L'étape ${rang} a déjà sa facture. Annulez-la avant d'en créer une autre.`,
        }
      }
      return { ok: false, message: error.message }
    }

    const { error: eLigne } = await sb.from("invoice_lines").insert({
      firm_id: membre.firmId,
      invoice_id: facture.id,
      description: `${etape.description}${etape.declenchement ? ` — ${etape.declenchement}` : ""}`,
      quantity: 1,
      unit_price: Number(etape.montant),
      // Pro bono : le mandat est sans contrepartie, mais un débours refacturé
      // reste taxable. On suit le contrat plutôt que de décider ici.
      taxable: !entente.is_probono,
      position: 1,
    })

    if (eLigne) {
      // La facture existe mais n'a aucune ligne : la laisser ainsi donnerait
      // une pièce à zéro dollar qu'on croirait valide.
      await sb.from("invoices").delete().eq("id", facture.id)
      return { ok: false, message: `Ligne refusée : ${eLigne.message}` }
    }

    return {
      ok: true,
      message: `Facture ${numero} créée pour l'étape ${rang} — ${etape.description}.`,
      factureId: String(facture.id),
      numero: String(numero),
    }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inattendue." }
  }
}
