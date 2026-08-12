import type {
  StatutDemande, StatutDestinataire, TypeChamp,
  ModeSignature, MethodeAuth, EvenementSignature,
} from "./statuts"

/**
 * Le contrat que tout fournisseur de signature doit honorer.
 *
 * Module PUR — que des types. Il ne connaît ni la base, ni le réseau, ni le
 * fournisseur interne. C'est ce qui permet au reste du CRM de dépendre de ce
 * fichier sans dépendre d'une implémentation.
 *
 * ─── LA LIMITE À CONNAÎTRE, ET ELLE EST IMPORTANTE ─────────────────────────
 *
 * La plus forte garantie du fournisseur interne — l'empreinte du document
 * imposée par un déclencheur de la base, et le refus de signer un document
 * modifié depuis l'envoi — N'EST PAS PORTABLE. Chez un fournisseur externe,
 * l'empreinte du document signé est calculée par lui, sur son document ; aucun
 * déclencheur local ne peut s'y substituer.
 *
 * Cette interface est donc dessinée sur ce que TOUT fournisseur peut honorer.
 * Le fournisseur interne DÉPASSE le contrat au lieu de le définir. Le jour d'un
 * passage à un tiers, le CRM ne changera pas — mais on troquera une garantie
 * technique locale contre l'attestation d'un tiers. C'est un échange, pas une
 * équivalence, et il doit se décider les yeux ouverts.
 *
 * Conséquence concrète sur la forme de l'interface : aucune méthode ne prend ni
 * ne rend d'empreinte en paramètre obligatoire. L'intégrité se lit dans le
 * journal (`journal()`) et dans ce que rend `telechargerDocumentSigne()`, sous
 * une forme que chaque fournisseur remplit à sa manière.
 */

// ---------------------------------------------------------------------------
// Ce qu'on demande
// ---------------------------------------------------------------------------

export interface DestinataireDemande {
  role: string
  nom: string
  courriel: string
  /** Numéro de permis, pour le consultant. Ce qui atteste son autorité. */
  permis?: string
  /** Rang de signature. Égal pour tous en mode parallèle. */
  rang: number
  auth?: MethodeAuth
}

export interface ChampDemande {
  destinataireIndex: number
  type: TypeChamp
  libelle?: string
  obligatoire?: boolean
  /** Placement facultatif. Absent, le champ est présenté à côté du document. */
  page?: number
  x?: number
  y?: number
  largeur?: number
  hauteur?: number
}

export interface DemandeSignature {
  /** Le document à faire signer. Il porte déjà son fichier et son empreinte. */
  documentId: string
  clientId?: string | null
  destinataires: DestinataireDemande[]
  champs?: ChampDemande[]
  mode?: ModeSignature
  /** Jours de validité du lien. Le fournisseur décide de son défaut. */
  validiteJours?: number
  note?: string
}

// ---------------------------------------------------------------------------
// Ce qu'on obtient
// ---------------------------------------------------------------------------

export interface DestinataireEtat {
  id: string
  nom: string
  courriel: string
  role: string
  rang: number
  statut: StatutDestinataire
  /** Vrai quand c'est à cette personne d'agir maintenant. */
  sonTour: boolean
  envoyeLe?: string | null
  consulteLe?: string | null
  signeLe?: string | null
  /**
   * Le lien de signature, rendu UNE SEULE FOIS à la création.
   *
   * Il ne peut pas être relu : seule son empreinte est conservée. Un
   * fournisseur qui le rendrait à chaque lecture stockerait donc un secret en
   * clair — et c'est précisément ce qu'on refuse.
   */
  lien?: string
}

export interface EtatDemande {
  id: string
  statut: StatutDemande
  mode: ModeSignature
  documentId: string
  /** Le document signé, une fois complété. Une ligne de `documents` de plus. */
  documentSigneId?: string | null
  destinataires: DestinataireEtat[]
  creeLe: string
  envoyeLe?: string | null
  completeLe?: string | null
  expireLe?: string | null
  /** Le fournisseur qui tient cette demande. */
  fournisseur: string
  /** Sa référence chez lui, quand il en a une. */
  referenceExterne?: string | null
}

export interface EntreeJournalSignature {
  evenement: EvenementSignature | string
  survenuLe: string
  /** Qui — un membre, un destinataire, ou le système. */
  acteur: string
  destinataireId?: string | null
  ip?: string | null
  agent?: string | null
  /** Ce que le fournisseur veut ajouter, sans forme imposée. */
  details?: Record<string, unknown>
}

export interface ResultatSignature {
  ok: boolean
  message: string
}

export interface DocumentSigne {
  octets: Uint8Array
  nom: string
  /**
   * La référence d'intégrité du fournisseur. Empreinte SHA-256 pour le
   * fournisseur interne ; identifiant de scellement ou de certificat chez un
   * tiers. Sa FORME n'est pas imposée, seulement son existence.
   */
  referenceIntegrite?: string
}

// ---------------------------------------------------------------------------
// L'interface
// ---------------------------------------------------------------------------

export interface FournisseurSignature {
  /** Le nom sous lequel les demandes qu'il produit seront conservées. */
  readonly nom: string

  creerDemande(demande: DemandeSignature): Promise<EtatDemande>
  envoyerDemande(requestId: string): Promise<ResultatSignature>
  etatDemande(requestId: string): Promise<EtatDemande | null>
  annulerDemande(requestId: string, motif?: string): Promise<ResultatSignature>
  /** Renvoie le lien. Le précédent est révoqué — sinon deux liens vivraient. */
  relancerDemande(requestId: string, destinataireId?: string): Promise<ResultatSignature>
  telechargerDocumentSigne(requestId: string): Promise<DocumentSigne | null>
  journal(requestId: string): Promise<EntreeJournalSignature[]>
}

/**
 * Le contexte passé au fournisseur.
 *
 * Le client Supabase et le cabinet sont DONNÉS, jamais tirés d'une session par
 * le fournisseur lui-même. C'est la règle déjà appliquée à `emettre()`, à
 * `modifierFiche()` et à `facturerEtape()` : ce qu'aucune épreuve ne peut
 * appeler n'est vérifié qu'en production, et ce module est le dernier endroit
 * où l'on veut découvrir un défaut en production.
 */
export interface ContexteSignature {
  firmId: string
  userId?: string
  profileId?: string | null
  fullName?: string
  email?: string
  /** L'adresse d'origine et l'agent, quand la requête en fournit. */
  ip?: string | null
  agent?: string | null
}
