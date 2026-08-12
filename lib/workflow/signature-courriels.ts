import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Les courriels qui accompagnent une signature.
 *
 * ─── POURQUOI ICI, ET PAS DANS LE MOTEUR ───────────────────────────────────
 *
 * Même règle que `signature-reactions.ts` : le moteur produit des liens, le
 * CRM décide à qui l'on écrit. Un fournisseur tiers enverra ses propres
 * courriels — le jour venu, c'est ce fichier qu'on cessera d'appeler, et le
 * moteur ne bougera pas.
 *
 * ─── LE TROU QUE CE FICHIER BOUCHE ─────────────────────────────────────────
 *
 * En mode séquentiel, l'envoi initial n'écrit QU'AU PREMIER signataire : les
 * liens des suivants existent, mais les leur envoyer d'avance leur ferait
 * ouvrir une page qui répond « ce n'est pas encore à vous ». Personne n'y
 * revient une seconde fois.
 *
 * Restait à écrire au suivant QUAND son tour arrive. Sans cela, la chaîne
 * s'arrêtait après le premier signataire et le consultant devait transmettre
 * le lien à la main — c'est-à-dire ne jamais le faire.
 *
 * ─── AUCUN COURRIEL NE FAIT ÉCHOUER UNE SIGNATURE ──────────────────────────
 *
 * La signature est déjà en base quand ces fonctions s'exécutent. Un envoi qui
 * échoue est consigné et n'est pas relancé : le consultant voit l'état dans
 * l'onglet Signature et dispose du bouton « Relancer ».
 */

interface Cabinet {
  nom: string
  expediteur: string | null
  repondreA: string | null
}

async function cabinetEtDocument(sb: SupabaseClient, requestId: string) {
  const { data: demande } = await sb
    .from("signature_requests")
    .select("id, firm_id, document_id, signing_mode")
    .eq("id", requestId)
    .maybeSingle()
  if (!demande) return null

  const [{ data: firm }, { data: doc }] = await Promise.all([
    sb.from("firms")
      .select("name, email_sender_name, reply_to_email")
      .eq("id", demande.firm_id).maybeSingle(),
    sb.from("documents").select("name").eq("id", demande.document_id).maybeSingle(),
  ])

  const cabinet: Cabinet = {
    nom: String(firm?.name ?? ""),
    expediteur: firm?.email_sender_name ?? firm?.name ?? null,
    repondreA: firm?.reply_to_email ?? null,
  }
  return { demande, cabinet, document: String(doc?.name ?? "un document") }
}

async function expedier(
  cabinet: Cabinet,
  destinataire: string,
  message: { sujet: string; html: string; texte: string }
): Promise<boolean> {
  const { envoyerCourriel } = await import("@/lib/email/send")
  const r = await envoyerCourriel({
    destinataire,
    sujet: message.sujet,
    html: message.html,
    texte: message.texte,
    nomExpediteur: cabinet.expediteur,
    repondreA: cabinet.repondreA,
  })
  return r.envoye
}

/**
 * Écrit au signataire dont le tour vient de commencer.
 *
 * UN JETON NEUF EST ENGENDRÉ à cette occasion, par `relancerDemande`. Le lien
 * d'origine n'existe plus en clair — par construction, seule la création le
 * rend, et il n'a jamais été gardé nulle part. Reprendre un jeton neuf est
 * d'ailleurs préférable : le compte à rebours du destinataire part du moment
 * où il reçoit vraiment son courriel.
 */
export async function prevenirProchain(
  sb: SupabaseClient,
  requestId: string
): Promise<number> {
  try {
    const contexte = await cabinetEtDocument(sb, requestId)
    if (!contexte) return 0
    const { demande, cabinet, document } = contexte

    const { SignatureService } = await import("@/lib/signature/service")
    const svc = new SignatureService(sb, { firmId: String(demande.firm_id), fullName: "Système" })

    const etat = await svc.getStatus(requestId)
    if (!etat) return 0

    // CEUX DONT C'EST LE TOUR ET QUI N'ONT PAS ENCORE ÉTÉ PRÉVENUS. En mode
    // parallèle tout le monde a déjà reçu son lien à l'envoi : le filtre sur
    // `envoyeLe` évite de réécrire à toute la file à chaque signature.
    const suivants = etat.destinataires.filter(
      (d) => d.sonTour && d.statut === "pending" && !d.envoyeLe
    )
    if (suivants.length === 0) return 0

    const { courrielSignatureDemandee } = await import("@/lib/email/templates")
    const jours = etat.expireLe
      ? Math.max(1, Math.ceil((new Date(etat.expireLe).getTime() - Date.now()) / 86_400_000))
      : 30

    let partis = 0
    for (const d of suivants) {
      const relance = await svc.resendRequest(requestId, d.id)
      const lien = relance.liens?.[0]?.lien
      if (!relance.ok || !lien) {
        console.error("prevenirProchain : aucun lien pour", d.courriel, "—", relance.message)
        continue
      }
      const message = courrielSignatureDemandee({
        langue: "fr", cabinet: cabinet.nom, nom: d.nom, document, lien, jours,
      })
      if (await expedier(cabinet, d.courriel, message)) {
        partis++
        // Marqué comme prévenu : sans cela, la signature suivante lui
        // réécrirait, et il recevrait le même document deux fois.
        await sb
          .from("signature_recipients")
          .update({ sent_at: new Date().toISOString() })
          .eq("id", d.id)
      }
    }
    return partis
  } catch (e) {
    console.error("prevenirProchain :", e instanceof Error ? e.message : e)
    return 0
  }
}

/**
 * Écrit à tous ceux qui ont signé, une fois la dernière signature apposée.
 *
 * Le document N'EST PAS JOINT. Il porte des renseignements personnels, et un
 * courriel n'est pas un canal sûr — la Loi 25 impose des mesures
 * proportionnées à la sensibilité. Chacun peut en demander copie au cabinet,
 * et le consultant la remet par le portail.
 */
export async function prevenirSignatureFaite(
  sb: SupabaseClient,
  requestId: string
): Promise<number> {
  try {
    const contexte = await cabinetEtDocument(sb, requestId)
    if (!contexte) return 0
    const { cabinet, document } = contexte

    const { data: signataires } = await sb
      .from("signatures")
      .select("signer_name, signer_email")
      .eq("request_id", requestId)
      .order("signed_at")

    const { courrielSignatureFaite } = await import("@/lib/email/templates")

    // Une adresse, un courriel. Un signataire qui figure deux fois — même
    // personne, deux rôles — n'a pas à recevoir deux fois le même message.
    const vus = new Set<string>()
    let partis = 0
    for (const s of signataires ?? []) {
      const courriel = String(s.signer_email ?? "").trim().toLowerCase()
      if (!courriel || vus.has(courriel)) continue
      vus.add(courriel)

      const message = courrielSignatureFaite({
        langue: "fr",
        cabinet: cabinet.nom,
        nom: String(s.signer_name ?? ""),
        document,
      })
      if (await expedier(cabinet, courriel, message)) partis++
    }
    return partis
  } catch (e) {
    console.error("prevenirSignatureFaite :", e instanceof Error ? e.message : e)
    return 0
  }
}
