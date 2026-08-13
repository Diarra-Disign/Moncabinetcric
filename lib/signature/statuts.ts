/**
 * Le vocabulaire de la signature électronique.
 *
 * Module PUR — ni « server-only », ni « use server », aucun accès base. La
 * page publique de signature tourne dans le navigateur d'une personne qui n'a
 * pas de compte ; elle a besoin des mêmes libellés et des mêmes types de champ
 * que le serveur. C'est la raison qui a déjà fait sortir `variables.ts`,
 * `echeancier.ts` et `fiche-criteres.ts` de leurs modules d'actions.
 *
 * DES CONSTANTES, PAS DES CHAÎNES DISPERSÉES. Le cahier des charges le demande
 * au §15, et l'ancienne implémentation montre pourquoi : la table portait
 * quatre statuts dont trois n'ont jamais été écrits, parce que rien ne reliait
 * le vocabulaire de la base à celui du code.
 */

// ---------------------------------------------------------------------------
// L'état d'une demande
// ---------------------------------------------------------------------------

export const STATUTS_DEMANDE = [
  "draft", "ready", "sent", "viewed",
  "partially_signed", "completed", "declined", "cancelled", "expired",
] as const
export type StatutDemande = (typeof STATUTS_DEMANDE)[number]

/**
 * Ce que chaque état veut dire, du point de vue du consultant.
 *
 * « Envoyée » et « Consultée » sont distingués parce que la conduite à tenir
 * diffère : dans un cas on relance parce que le courriel s'est peut-être perdu,
 * dans l'autre parce que la personne hésite.
 */
export const LIBELLE_DEMANDE: Record<StatutDemande, string> = {
  draft: "Brouillon",
  ready: "Prête à envoyer",
  sent: "Envoyée",
  viewed: "Consultée",
  partially_signed: "Partiellement signée",
  completed: "Signée",
  declined: "Refusée",
  cancelled: "Annulée",
  expired: "Expirée",
}

/** Les états où la demande vit encore et attend quelque chose de quelqu'un. */
export const DEMANDE_EN_COURS: StatutDemande[] = [
  "sent", "viewed", "partially_signed",
]

/** Les états définitifs : plus rien ne bougera sans une nouvelle demande. */
export const DEMANDE_CLOSE: StatutDemande[] = [
  "completed", "declined", "cancelled", "expired",
]

export const estClose = (s: string): boolean =>
  DEMANDE_CLOSE.includes(s as StatutDemande)

// ---------------------------------------------------------------------------
// L'état d'un destinataire
// ---------------------------------------------------------------------------

export const STATUTS_DESTINATAIRE = [
  "pending", "viewed", "signed", "declined", "expired",
] as const
export type StatutDestinataire = (typeof STATUTS_DESTINATAIRE)[number]

export const LIBELLE_DESTINATAIRE: Record<StatutDestinataire, string> = {
  pending: "En attente",
  viewed: "A consulté",
  signed: "A signé",
  declined: "A refusé",
  expired: "Lien expiré",
}

// ---------------------------------------------------------------------------
// Les rôles
// ---------------------------------------------------------------------------

/**
 * Le MÊME vocabulaire que `agreement_parties`.
 *
 * Une seconde liste aurait produit « consultant » ici et « rcic » là, et le
 * jour où l'on préremplit les destinataires depuis les parties d'une entente,
 * il aurait fallu une table de correspondance — puis l'oublier une fois.
 */
export const ROLES_SIGNATAIRE = [
  { valeur: "client", fr: "Client", en: "Client" },
  { valeur: "spouse", fr: "Conjoint", en: "Spouse" },
  { valeur: "co_applicant", fr: "Codemandeur", en: "Co-applicant" },
  { valeur: "parent", fr: "Parent", en: "Parent" },
  { valeur: "representative", fr: "Représentant", en: "Representative" },
  { valeur: "consultant", fr: "Consultant", en: "Consultant" },
  { valeur: "witness", fr: "Témoin", en: "Witness" },
  { valeur: "other", fr: "Autre", en: "Other" },
] as const

export const libelleRole = (valeur: string, locale = "fr"): string => {
  const r = ROLES_SIGNATAIRE.find((x) => x.valeur === valeur)
  return r ? (locale === "en" ? r.en : r.fr) : valeur
}

// ---------------------------------------------------------------------------
// Les champs
// ---------------------------------------------------------------------------

export const TYPES_CHAMP = [
  "signature", "initials", "full_name", "date", "checkbox", "text",
] as const
export type TypeChamp = (typeof TYPES_CHAMP)[number]

export const LIBELLE_CHAMP: Record<TypeChamp, string> = {
  signature: "Signature",
  initials: "Initiales",
  full_name: "Nom en toutes lettres",
  date: "Date",
  checkbox: "Case à cocher",
  text: "Texte libre",
}

// ---------------------------------------------------------------------------
// L'ordre et l'authentification
// ---------------------------------------------------------------------------

export type ModeSignature = "sequential" | "parallel"

export const LIBELLE_MODE: Record<ModeSignature, string> = {
  sequential: "Chacun son tour",
  parallel: "Tous en même temps",
}

export type MethodeAuth = "link_only" | "email_confirm" | "email_otp" | "sms_otp"

/**
 * Les méthodes réellement offertes en V1.
 *
 * Les deux autres — code à usage unique par courriel ou par SMS — sont portées
 * par la contrainte de la base pour qu'elles s'ajoutent sans migration, mais
 * les offrir à l'écran avant de les avoir construites reviendrait à promettre
 * une sécurité qui n'existe pas.
 */
export const METHODES_AUTH_V1: MethodeAuth[] = ["link_only", "email_confirm"]

export const LIBELLE_AUTH: Record<MethodeAuth, string> = {
  link_only: "Lien secret seulement",
  email_confirm: "Lien secret et confirmation du courriel",
  email_otp: "Code à usage unique par courriel",
  sms_otp: "Code à usage unique par SMS",
}

// ---------------------------------------------------------------------------
// Les événements (§9 et §17)
// ---------------------------------------------------------------------------

/**
 * Les treize événements du journal.
 *
 * Ils servent DEUX usages qu'il ne faut pas confondre : la traçabilité
 * réglementaire — ce qui s'est passé, écrit dans un journal immuable — et le
 * déclenchement de la suite du CRM. Le module de signature émet ; il ne décide
 * de rien de ce qui suit.
 */
export const EVENEMENTS = [
  "signature.document.created",
  "signature.request.created",
  "signature.request.sent",
  "signature.email.sent",
  "signature.document.opened",
  "signature.document.viewed",
  "signature.started",
  "signature.signed",
  "signature.completed",
  "signature.declined",
  "signature.request.cancelled",
  "signature.request.expired",
  "signature.document.downloaded",
  // Rangement et effacement. Ils ne décrivent pas la vie de la signature mais
  // ce que le cabinet en fait ensuite — et c'est précisément pour cela qu'ils
  // doivent être consignés : ce sont les seuls gestes qui font disparaître
  // une demande d'un écran.
  "signature.request.archived",
  "signature.request.restored",
  "signature.request.deleted",
] as const
export type EvenementSignature = (typeof EVENEMENTS)[number]

/** Le résumé lisible d'un événement, pour le journal et l'historique. */
export const LIBELLE_EVENEMENT: Record<EvenementSignature, string> = {
  "signature.document.created": "Document créé",
  "signature.request.created": "Demande de signature créée",
  "signature.request.sent": "Demande envoyée",
  "signature.email.sent": "Courriel envoyé",
  "signature.document.opened": "Lien ouvert",
  "signature.document.viewed": "Document consulté",
  "signature.started": "Signature commencée",
  "signature.signed": "Signature apposée",
  "signature.completed": "Document complété",
  "signature.declined": "Document refusé",
  "signature.request.cancelled": "Demande annulée",
  "signature.request.expired": "Demande expirée",
  "signature.document.downloaded": "Document téléchargé",
  "signature.request.archived": "Demande archivée",
  "signature.request.restored": "Demande restaurée",
  "signature.request.deleted": "Demande supprimée définitivement",
}

// ---------------------------------------------------------------------------
// Règles pures
// ---------------------------------------------------------------------------

export interface DestinataireEtat {
  rank: number
  status: string
}

/**
 * L'état d'une demande, DÉDUIT de celui de ses destinataires.
 *
 * Le même principe que l'échéancier des paiements : on stocke le fait — qui a
 * signé, qui a refusé — et on calcule l'état. Recopier « complété » dans la
 * demande créerait une seconde vérité qui dériverait à la première signature
 * enregistrée par un autre chemin.
 *
 * UN SEUL REFUS SUFFIT À TOUT ARRÊTER. Ce n'est pas une sévérité gratuite : un
 * contrat que l'une des parties refuse n'est pas « partiellement signé », il
 * n'existe pas. Continuer à réclamer les signatures suivantes ferait signer
 * des gens sur un document mort.
 */
export function statutDeduit(
  destinataires: DestinataireEtat[],
  statutActuel: StatutDemande
): StatutDemande {
  // Un état définitif posé par le cabinet ne se recalcule pas.
  if (statutActuel === "cancelled" || statutActuel === "expired") return statutActuel
  if (destinataires.length === 0) return statutActuel

  if (destinataires.some((d) => d.status === "declined")) return "declined"
  if (destinataires.every((d) => d.status === "signed")) return "completed"
  if (destinataires.some((d) => d.status === "signed")) return "partially_signed"
  if (destinataires.some((d) => d.status === "viewed")) return "viewed"

  return statutActuel === "draft" || statutActuel === "ready" ? statutActuel : "sent"
}

/**
 * Est-ce au tour de ce destinataire ?
 *
 * En mode parallèle, toujours. En séquentiel, seulement si personne d'un rang
 * inférieur n'est encore attendu. La base applique la même règle dans
 * `resolve_signature_token()` — celle-ci sert à l'afficher, celle-là à la
 * faire respecter.
 */
export function sonTour(
  destinataires: DestinataireEtat[],
  rang: number,
  mode: ModeSignature
): boolean {
  if (mode === "parallel") return true
  return !destinataires.some(
    (d) => d.rank < rang && d.status !== "signed" && d.status !== "declined"
  )
}

/**
 * Le nom du fichier signé (§11).
 *
 * Assaini pour un système de fichiers : les accents sont conservés — le nom
 * s'affiche, il n'entre pas dans un chemin — mais tout ce qui pourrait couper
 * un chemin est retiré.
 */
export function nomDocumentSigne(titre: string, signataire: string): string {
  const propre = (v: string) =>
    v.trim().replace(/[/\\:*?"<>|]+/g, "").replace(/\s+/g, "_").slice(0, 60)
  const base = propre(titre) || "Document"
  const qui = propre(signataire)
  return qui ? `${base}_SIGNE_${qui}.pdf` : `${base}_SIGNE.pdf`
}
