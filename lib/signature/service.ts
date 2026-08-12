import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { FournisseurInterne } from "./providers/interne"
import type {
  FournisseurSignature, ContexteSignature, DemandeSignature,
  EtatDemande, ResultatSignature, DocumentSigne, EntreeJournalSignature,
} from "./contrat"

/**
 * Le service de signature — le SEUL point d'entrée du CRM.
 *
 * Rien d'autre dans l'application ne doit importer un fournisseur. C'est cette
 * règle, et elle seule, qui permettra de passer à PandaDoc, Dropbox Sign ou
 * DocuSign sans toucher au dossier client, aux documents ni aux ententes.
 *
 * ─── LE CHOIX DU FOURNISSEUR ───────────────────────────────────────────────
 *
 * Il vient de `SIGNATURE_PROVIDER`. Mais pour une demande DÉJÀ OUVERTE, il
 * vient de la ligne : `signature_requests.provider` retient qui l'a produite.
 * Sans cela, changer la variable d'environnement orphelinerait du jour au
 * lendemain toutes les demandes en cours — on demanderait à PandaDoc l'état
 * d'une enveloppe qu'il n'a jamais eue.
 *
 * C'est la différence entre « quel fournisseur employer maintenant » et
 * « quel fournisseur tient ce dossier ». Les deux questions n'ont pas la même
 * réponse pendant une migration, et c'est précisément le moment où l'on ne
 * veut pas se tromper.
 *
 * ─── LES CLÉS ──────────────────────────────────────────────────────────────
 *
 * Aucune clé d'API n'apparaît ici ni dans aucun fournisseur : elles seront
 * lues depuis l'environnement, comme le reste des secrets du projet. Le
 * fournisseur interne n'en a aucune, ce qui est sa meilleure qualité.
 */

export type NomFournisseur = "internal" | "pandadoc" | "dropbox_sign" | "docusign"

/** Ceux qui sont réellement construits. Les autres sont des points d'ancrage. */
export const FOURNISSEURS_DISPONIBLES: NomFournisseur[] = ["internal"]

/**
 * Le fournisseur configuré pour les NOUVELLES demandes.
 *
 * Une valeur inconnue ne fait pas échouer le produit : elle retombe sur
 * l'interne et le signale. Un cabinet ne doit pas perdre l'accès à ses
 * signatures parce qu'une variable d'environnement a été mal orthographiée.
 */
export function fournisseurConfigure(): NomFournisseur {
  const demande = (process.env.SIGNATURE_PROVIDER ?? "internal").trim().toLowerCase()
  if (FOURNISSEURS_DISPONIBLES.includes(demande as NomFournisseur)) {
    return demande as NomFournisseur
  }
  if (demande !== "internal") {
    console.warn(
      `SIGNATURE_PROVIDER="${demande}" n'est pas disponible — repli sur le fournisseur interne.`
    )
  }
  return "internal"
}

function instancier(
  nom: NomFournisseur,
  sb: SupabaseClient,
  ctx: ContexteSignature
): FournisseurSignature {
  switch (nom) {
    case "internal":
      return new FournisseurInterne(sb, ctx)
    // Les trois autres n'existent pas encore. Le `default` les couvre et dit
    // pourquoi — plutôt que de retomber silencieusement sur l'interne, ce qui
    // ferait croire à une intégration qui n'a pas eu lieu.
    default:
      throw new Error(
        `Le fournisseur « ${nom} » n'est pas encore construit. ` +
        `Fournisseurs disponibles : ${FOURNISSEURS_DISPONIBLES.join(", ")}.`
      )
  }
}

export class SignatureService {
  // Champs déclarés puis affectés, plutôt que des propriétés de paramètre :
  // « node --experimental-strip-types » — dont vivent les scripts d'épreuve —
  // ne sait pas les transformer, et le raccourci rendrait ce fichier
  // impossible à importer depuis ./cric signature. Le piège avait déjà mordu
  // sur la classe Flux du moteur PDF.
  private readonly sb: SupabaseClient
  private readonly ctx: ContexteSignature

  constructor(sb: SupabaseClient, ctx: ContexteSignature) {
    this.sb = sb
    this.ctx = ctx
  }

  /** Le fournisseur pour une demande NEUVE. */
  private pourNouvelle(): FournisseurSignature {
    return instancier(fournisseurConfigure(), this.sb, this.ctx)
  }

  /**
   * Le fournisseur qui TIENT une demande existante.
   *
   * Lu sur la ligne, jamais dans la configuration : voir l'en-tête du fichier.
   */
  private async pourExistante(requestId: string): Promise<FournisseurSignature> {
    const { data } = await this.sb
      .from("signature_requests")
      .select("provider")
      .eq("id", requestId)
      .maybeSingle()

    const nom = (String(data?.provider ?? "internal") as NomFournisseur)
    return instancier(nom, this.sb, this.ctx)
  }

  createRequest(d: DemandeSignature): Promise<EtatDemande> {
    return this.pourNouvelle().creerDemande(d)
  }

  async sendRequest(requestId: string): Promise<ResultatSignature> {
    return (await this.pourExistante(requestId)).envoyerDemande(requestId)
  }

  async getStatus(requestId: string): Promise<EtatDemande | null> {
    return (await this.pourExistante(requestId)).etatDemande(requestId)
  }

  async cancelRequest(requestId: string, motif?: string): Promise<ResultatSignature> {
    return (await this.pourExistante(requestId)).annulerDemande(requestId, motif)
  }

  async resendRequest(requestId: string, destinataireId?: string): Promise<ResultatSignature> {
    return (await this.pourExistante(requestId)).relancerDemande(requestId, destinataireId)
  }

  async getSignedDocument(requestId: string): Promise<DocumentSigne | null> {
    return (await this.pourExistante(requestId)).telechargerDocumentSigne(requestId)
  }

  async getAuditTrail(requestId: string): Promise<EntreeJournalSignature[]> {
    return (await this.pourExistante(requestId)).journal(requestId)
  }
}

/** Fabrique le service. Un seul endroit à changer si le contexte évolue. */
export function signatureService(
  sb: SupabaseClient,
  ctx: ContexteSignature
): SignatureService {
  return new SignatureService(sb, ctx)
}
