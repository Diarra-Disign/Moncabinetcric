import "server-only"

import { randomBytes, createHash } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { siteUrl } from "@/lib/site-url"
import { verrouiller } from "../versions"
import { journaliser } from "../evenements"
import type {
  FournisseurSignature, ContexteSignature, DemandeSignature,
  EtatDemande, DestinataireEtat, ResultatSignature,
  DocumentSigne, EntreeJournalSignature,
} from "../contrat"
import type {
  ModeSignature, StatutDemande, StatutDestinataire, EvenementSignature,
} from "../statuts"

/**
 * Le fournisseur de signature interne — celui de la V1.
 *
 * Il fait tourner tout le module sans aucune API externe. Il est aussi la
 * référence de ce que l'interface exige : si une méthode est difficile à
 * écrire ici, elle sera impossible chez un tiers.
 *
 * ─── CE QU'IL FAIT MIEUX QUE LE CONTRAT NE L'EXIGE ─────────────────────────
 *
 * L'empreinte du document est imposée par un déclencheur de la base, le
 * document est verrouillé à l'envoi, et une signature ne peut être apposée sur
 * un contenu modifié. Rien de cela ne figure dans l'interface, parce qu'aucun
 * fournisseur externe ne pourrait s'y engager. C'est un supplément, pas une
 * définition — et le jour d'un passage à PandaDoc, c'est ce supplément qu'on
 * échangera contre l'attestation d'un tiers.
 *
 * ─── LE JETON ──────────────────────────────────────────────────────────────
 *
 * Trente-deux octets aléatoires, rendus UNE SEULE FOIS à la création. Seule
 * son empreinte SHA-256 est conservée : la fonction qui le rendrait à chaque
 * lecture obligerait à le stocker en clair, et une fuite de la base donnerait
 * alors des liens utilisables.
 */

const jetonNeuf = () => randomBytes(32).toString("base64url")
const empreinteJeton = (jeton: string) => createHash("sha256").update(jeton).digest("hex")

/** L'adresse publique d'un lien de signature. Aucun identifiant dedans. */
const lienDe = (jeton: string) => `${siteUrl().replace(/\/+$/, "")}/s/${jeton}`

interface LigneDestinataire {
  id: string
  full_name: string
  email: string
  role: string
  rank: number
  status: string
  sent_at: string | null
  viewed_at: string | null
  signed_at: string | null
}

export class FournisseurInterne implements FournisseurSignature {
  readonly nom = "internal"

  // Voir la note de SignatureService : les propriétés de paramètre ne
  // survivent pas au retrait de types de Node.
  private readonly sb: SupabaseClient
  private readonly ctx: ContexteSignature

  constructor(sb: SupabaseClient, ctx: ContexteSignature) {
    this.sb = sb
    this.ctx = ctx
  }

  /**
   * Écrit un événement au journal.
   *
   * Délègue à `journaliser()` : un seul point d'écriture pour tous les
   * fournisseurs, plutôt qu'un appel RPC recopié dans chacun. Le jour où
   * PandaDoc écrira ses événements, il passera par la même porte.
   */
  private evenement(
    requestId: string,
    evenement: EvenementSignature,
    destinataireId?: string | null,
    details?: Record<string, unknown>
  ) {
    return journaliser(this.sb, this.ctx, { requestId, evenement, destinataireId, details })
  }

  async creerDemande(d: DemandeSignature): Promise<EtatDemande> {
    if (d.destinataires.length === 0) {
      throw new Error("Une demande de signature sans signataire n'a pas d'objet.")
    }

    const { data: doc } = await this.sb
      .from("documents")
      .select("id, sha256, storage_path, client_id")
      .eq("id", d.documentId)
      .maybeSingle()

    if (!doc) throw new Error("Ce document est introuvable.")
    if (!doc.storage_path || !doc.sha256) {
      throw new Error("Aucun fichier déposé pour ce document : il n'y a rien à signer.")
    }

    const validite = d.validiteJours ?? 30
    const expire = new Date(Date.now() + validite * 86400000).toISOString()

    const { data: demande, error } = await this.sb
      .from("signature_requests")
      .insert({
        firm_id: this.ctx.firmId,
        document_id: d.documentId,
        client_id: d.clientId ?? doc.client_id ?? null,
        // L'empreinte du document AU MOMENT de la demande. C'est elle que le
        // déclencheur comparera avant d'accepter une signature.
        document_sha256: doc.sha256,
        requested_by: this.ctx.userId ?? null,
        provider: this.nom,
        signing_mode: d.mode ?? "sequential",
        // Créée n'est pas envoyée : le brouillon existe pour qu'on puisse
        // relire les signataires avant que quoi que ce soit ne parte.
        status: "draft",
        expires_at: expire,
        note: d.note ?? null,
      })
      .select("id")
      .single()

    if (error || !demande) throw new Error(error?.message ?? "Création impossible.")

    // Les jetons sont engendrés ici et rendus une seule fois.
    const jetons = d.destinataires.map(() => jetonNeuf())

    const { error: eDest } = await this.sb.from("signature_recipients").insert(
      d.destinataires.map((r, i) => ({
        firm_id: this.ctx.firmId,
        request_id: demande.id,
        role: r.role,
        full_name: r.nom,
        email: r.courriel,
        rcic_number: r.permis ?? null,
        rank: r.rang,
        token_hash: empreinteJeton(jetons[i]),
        auth_method: r.auth ?? "email_confirm",
        expires_at: expire,
        status: "pending",
      }))
    )

    if (eDest) {
      // La demande sans ses destinataires ne vaut rien : on la retire plutôt
      // que de laisser une coquille qu'on croirait prête.
      await this.sb.from("signature_requests").delete().eq("id", demande.id)
      throw new Error(`Destinataires refusés : ${eDest.message}`)
    }

    const { data: lignes } = await this.sb
      .from("signature_recipients")
      .select("id, full_name, email, role, rank, status, sent_at, viewed_at, signed_at")
      .eq("request_id", demande.id)
      .order("rank")

    if (d.champs && d.champs.length > 0) {
      const parRang = new Map((lignes ?? []).map((l) => [Number(l.rank), String(l.id)]))
      const { error: eChamps } = await this.sb.from("signature_fields").insert(
        d.champs.map((c, i) => ({
          firm_id: this.ctx.firmId,
          request_id: demande.id,
          recipient_id: parRang.get(d.destinataires[c.destinataireIndex]?.rang ?? 1),
          kind: c.type,
          label: c.libelle ?? "",
          required: c.obligatoire !== false,
          position: i + 1,
          page: c.page ?? null,
          pos_x: c.x ?? null,
          pos_y: c.y ?? null,
          width: c.largeur ?? null,
          height: c.hauteur ?? null,
        }))
      )
      if (eChamps) console.error("creerDemande : champs non enregistrés —", eChamps.message)
    }

    await this.evenement(String(demande.id), "signature.request.created", null, {
      destinataires: d.destinataires.length,
    })

    const etat = await this.etatDemande(String(demande.id))
    if (!etat) throw new Error("Demande créée mais illisible.")

    // Les liens sont greffés ICI et nulle part ailleurs : c'est la seule fois
    // où ils existent en clair.
    return {
      ...etat,
      destinataires: etat.destinataires.map((r, i) => ({ ...r, lien: lienDe(jetons[i]) })),
    }
  }

  async envoyerDemande(requestId: string): Promise<ResultatSignature> {
    const { data: demande } = await this.sb
      .from("signature_requests")
      .select("id, status, document_id, signing_mode")
      .eq("id", requestId)
      .maybeSingle()

    if (!demande) return { ok: false, message: "Cette demande est introuvable." }
    if (!["draft", "ready"].includes(String(demande.status))) {
      return { ok: false, message: "Cette demande a déjà été envoyée." }
    }

    // LE VERROU AVANT L'ENVOI, et dans cet ordre. Verrouiller après aurait
    // laissé une fenêtre — courte, mais réelle — pendant laquelle le document
    // parti en signature restait modifiable.
    const verrouille = await verrouiller(this.sb, String(demande.document_id))
    if (!verrouille) {
      return { ok: false, message: "Le document n'a pas pu être verrouillé : envoi interrompu." }
    }

    const maintenant = new Date().toISOString()
    const { error } = await this.sb
      .from("signature_requests")
      .update({ status: "sent" })
      .eq("id", requestId)
    if (error) return { ok: false, message: error.message }

    // `sent_at` DIT « SON LIEN LUI A ÉTÉ TRANSMIS », pas « la demande est
    // partie ». En séquentiel, le second signataire ne reçoit rien tant que le
    // premier n'a pas signé : l'estampiller ici mentirait au journal — et,
    // pire, ferait croire à `prevenirProchain()` qu'il a déjà été prévenu,
    // de sorte que personne ne lui écrirait jamais.
    let cibles = this.sb
      .from("signature_recipients")
      .update({ sent_at: maintenant })
      .eq("request_id", requestId)
      .is("sent_at", null)

    if (String(demande.signing_mode ?? "sequential") !== "parallel") {
      const { data: premiers } = await this.sb
        .from("signature_recipients")
        .select("rank").eq("request_id", requestId).order("rank").limit(1)
      cibles = cibles.eq("rank", Number(premiers?.[0]?.rank ?? 1))
    }
    await cibles

    await this.evenement(requestId, "signature.request.sent")
    return { ok: true, message: "Demande envoyée." }
  }

  async etatDemande(requestId: string): Promise<EtatDemande | null> {
    const { data: d } = await this.sb
      .from("signature_requests")
      .select("id, status, signing_mode, document_id, signed_document_id, provider, provider_ref, requested_at, completed_at, expires_at")
      .eq("id", requestId)
      .maybeSingle()
    if (!d) return null

    const { data: lignes } = await this.sb
      .from("signature_recipients")
      .select("id, full_name, email, role, rank, status, sent_at, viewed_at, signed_at")
      .eq("request_id", requestId)
      .order("rank")

    const rec = (lignes ?? []) as unknown as LigneDestinataire[]
    const mode = String(d.signing_mode ?? "sequential") as ModeSignature

    return {
      id: String(d.id),
      statut: String(d.status) as StatutDemande,
      mode,
      documentId: String(d.document_id),
      // DÉSIGNÉ, pas déduit : une déduction par « la version qui remplace
      // celle-ci » se trompe dès qu'une seconde version apparaît pour une
      // autre raison.
      documentSigneId: d.signed_document_id ? String(d.signed_document_id) : null,
      creeLe: String(d.requested_at ?? ""),
      completeLe: d.completed_at ? String(d.completed_at) : null,
      expireLe: d.expires_at ? String(d.expires_at) : null,
      fournisseur: String(d.provider ?? this.nom),
      referenceExterne: d.provider_ref ? String(d.provider_ref) : null,
      destinataires: rec.map((r) => ({
        id: r.id,
        nom: r.full_name,
        courriel: r.email,
        role: r.role,
        rang: Number(r.rank),
        statut: r.status as StatutDestinataire,
        // Le tour se calcule ici comme la base le calcule : mêmes règles, deux
        // populations. Voir la note de `signature_recalculer_demande()`.
        sonTour:
          mode === "parallel" ||
          !rec.some((a) => a.rank < r.rank && a.status !== "signed" && a.status !== "declined"),
        envoyeLe: r.sent_at,
        consulteLe: r.viewed_at,
        signeLe: r.signed_at,
      })) as DestinataireEtat[],
      envoyeLe: rec.find((r) => r.sent_at)?.sent_at ?? null,
    }
  }

  async annulerDemande(requestId: string, motif?: string): Promise<ResultatSignature> {
    const { data: d } = await this.sb
      .from("signature_requests").select("status").eq("id", requestId).maybeSingle()
    if (!d) return { ok: false, message: "Cette demande est introuvable." }
    if (d.status === "completed") {
      return {
        ok: false,
        message: "Cette demande est complétée : elle ne s'annule pas. Créez une nouvelle version du document.",
      }
    }

    const maintenant = new Date().toISOString()
    const { data, error } = await this.sb
      .from("signature_requests")
      .update({
        status: "cancelled",
        cancelled_at: maintenant,
        note: motif ?? null,
      })
      .eq("id", requestId)
      .neq("status", "completed")
      .select("id")

    if (error) return { ok: false, message: error.message }
    if (!data || data.length === 0) {
      return { ok: false, message: "Aucune demande annulée." }
    }

    // LES LIENS MEURENT AVEC LA DEMANDE. Sans cette révocation, un
    // destinataire qui a gardé son courriel pourrait signer un contrat annulé.
    await this.sb
      .from("signature_recipients")
      .update({ revoked_at: maintenant })
      .eq("request_id", requestId)
      .is("revoked_at", null)

    await this.evenement(requestId, "signature.request.cancelled", null, { motif: motif ?? null })
    return { ok: true, message: "Demande annulée et liens révoqués." }
  }

  async relancerDemande(requestId: string, destinataireId?: string): Promise<ResultatSignature> {
    const { data: d } = await this.sb
      .from("signature_requests").select("status, expires_at").eq("id", requestId).maybeSingle()
    if (!d) return { ok: false, message: "Cette demande est introuvable." }
    if (!["sent", "viewed", "partially_signed"].includes(String(d.status))) {
      return { ok: false, message: "Cette demande n'attend plus de signature." }
    }

    let q = this.sb
      .from("signature_recipients")
      .select("id, full_name, email, status")
      .eq("request_id", requestId)
      .in("status", ["pending", "viewed"])
    if (destinataireId) q = q.eq("id", destinataireId)

    const { data: cibles } = await q
    if (!cibles || cibles.length === 0) {
      return { ok: false, message: "Personne n'est en attente sur cette demande." }
    }

    // UN JETON NEUF, ET L'ANCIEN MEURT. Laisser vivre les deux ferait circuler
    // deux liens pour la même signature — et le premier resterait valide bien
    // après qu'on l'ait cru remplacé.
    const liens: { nom: string; courriel: string; lien: string }[] = []
    for (const c of cibles) {
      const jeton = jetonNeuf()
      const { error } = await this.sb
        .from("signature_recipients")
        .update({ token_hash: empreinteJeton(jeton), revoked_at: null })
        .eq("id", c.id)
      if (error) return { ok: false, message: error.message }
      liens.push({
        nom: String(c.full_name ?? ""),
        courriel: String(c.email),
        lien: lienDe(jeton),
      })
    }

    await this.evenement(requestId, "signature.request.sent", destinataireId ?? null, {
      relance: true, destinataires: liens.length,
    })

    return {
      ok: true,
      // LES LIENS REMONTENT. Ce fournisseur n'envoie pas de courriel — c'est le
      // CRM qui écrit. Sans ce champ, le lien n'existerait en clair qu'ici, et
      // il faudrait redemander au consultant de le transmettre à la main.
      liens,
      message: liens.length === 1
        ? "Un nouveau lien a été engendré ; le précédent ne fonctionne plus."
        : `${liens.length} nouveaux liens ont été engendrés ; les précédents ne fonctionnent plus.`,
    }
  }

  async telechargerDocumentSigne(requestId: string): Promise<DocumentSigne | null> {
    const etat = await this.etatDemande(requestId)
    if (!etat || !etat.documentSigneId) return null

    const { data: doc } = await this.sb
      .from("documents")
      .select("name, storage_path, sha256")
      .eq("id", etat.documentSigneId)
      .maybeSingle()
    if (!doc?.storage_path) return null

    const { data: signe } = await this.sb.storage
      .from("documents")
      .createSignedUrl(String(doc.storage_path), 60)
    if (!signe?.signedUrl) return null

    const reponse = await fetch(signe.signedUrl, { cache: "no-store" })
    if (!reponse.ok) return null

    await this.evenement(requestId, "signature.document.downloaded")

    return {
      octets: new Uint8Array(await reponse.arrayBuffer()),
      nom: String(doc.name ?? "document-signe.pdf"),
      referenceIntegrite: doc.sha256 ? String(doc.sha256) : undefined,
    }
  }

  async journal(requestId: string): Promise<EntreeJournalSignature[]> {
    const { data } = await this.sb
      .from("audit_logs")
      .select("action, occurred_at, actor_name, actor_email, changes, ip_address, user_agent")
      .eq("entity_type", "signature_request")
      .eq("entity_id", requestId)
      .order("occurred_at", { ascending: true })

    return (data ?? []).map((l) => {
      const details = (l.changes as Record<string, unknown>) ?? {}
      return {
        evenement: String(l.action ?? ""),
        survenuLe: String(l.occurred_at ?? ""),
        acteur: String(l.actor_name ?? "") || String(l.actor_email ?? "") || "Système",
        destinataireId: details.recipient_id ? String(details.recipient_id) : null,
        ip: l.ip_address ? String(l.ip_address) : null,
        agent: l.user_agent ? String(l.user_agent) : null,
        details,
      }
    })
  }
}
