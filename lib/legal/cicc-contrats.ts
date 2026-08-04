/**
 * Exigences du Collège en matière de contrats.
 *
 * Source unique : Code de déontologie des consultants en immigration et en
 * citoyenneté, DORS/2022-128, articles 23 à 26.
 * Texte consolidé consulté le 2026-08-04 :
 * https://laws.justice.gc.ca/fra/reglements/DORS-2022-128/TexteComplet.html
 *
 * Le champ `texte` reproduit la version française officielle, mot pour mot.
 * Il n'est ni résumé ni reformulé : c'est ce qui permet de vérifier qu'un
 * gabarit couvre bien ce que le règlement exige. Les libellés `labelFr` et
 * `labelEn` sont, eux, de simples intitulés d'affichage rédigés pour cette
 * application — `labelEn` n'est PAS la version anglaise officielle du
 * règlement, qui se trouve à l'adresse ci-dessus sous « SOR/2022-128 ».
 *
 * Ce module ne dit pas si un contrat est conforme. Il dit ce que le Code
 * énumère, et permet de constater ce qui manque. La conformité relève du
 * titulaire de permis et, le cas échéant, de son conseiller juridique.
 */

export const SOURCE_CODE_CICC = {
  reference: "DORS/2022-128",
  titre: "Code de déontologie des consultants en immigration et en citoyenneté",
  url: "https://laws.justice.gc.ca/fra/reglements/DORS-2022-128/TexteComplet.html",
  consulteLe: "2026-08-04",
} as const

/** Les deux contrats prévus par le Code. Ce ne sont pas deux options : ce sont deux moments. */
export type TypeContratCicc = "consultation" | "services"

/**
 * D'où vient l'élément une fois le contrat produit.
 *
 * - `cabinet`   : connu du profil du cabinet (nom, permis, coordonnées).
 * - `client`    : recueilli auprès du client.
 * - `mandat`    : dépend du mandat en cours (services, honoraires, délais).
 * - `redaction` : une clause à rédiger ou à confirmer par le titulaire.
 */
export type OrigineElement = "cabinet" | "client" | "mandat" | "redaction"

export interface ElementContrat {
  /** Renvoi précis, ex. « 24(3)i) ». */
  ref: string
  labelFr: string
  labelEn: string
  /** Reproduction mot pour mot de la version française officielle. */
  texte: string
  origine: OrigineElement
}

export interface ExigencesContrat {
  type: TypeContratCicc
  /** Article du Code qui institue le contrat. */
  article: string
  titreFr: string
  titreEn: string
  /** Ce que le Code impose AVANT de conclure ou de fournir. */
  declencheurFr: string
  declencheurEn: string
  elements: ElementContrat[]
  /** Obligations qui accompagnent le contrat sans figurer dans son contenu. */
  obligationsAnnexes: { ref: string; texte: string }[]
}

/* ------------------------------------------------------------------ */
/* Article 23 — Contrat de consultation                                */
/* ------------------------------------------------------------------ */

export const CONTRAT_CONSULTATION: ExigencesContrat = {
  type: "consultation",
  article: "23",
  titreFr: "Contrat de consultation",
  titreEn: "Consultation contract",
  declencheurFr:
    "Avant de tenir une consultation initiale avec un client potentiel concernant la prestation de services de consultation en immigration ou en citoyenneté, le titulaire de permis conclut un contrat de consultation avec celui-ci par écrit.",
  declencheurEn:
    "Required in writing before holding an initial consultation with a prospective client.",
  elements: [
    {
      ref: "23(2)a)",
      labelFr: "Identification du titulaire de permis",
      labelEn: "Licensee identification",
      texte:
        "les nom, numéro d’inscription, adresse, numéro de téléphone et adresse électronique du titulaire de permis",
      origine: "cabinet",
    },
    {
      ref: "23(2)b)",
      labelFr: "Identification du client potentiel",
      labelEn: "Prospective client identification",
      texte:
        "le nom du client potentiel et ses coordonnées, y compris, le cas échéant, ses adresse, numéro de téléphone et adresse électronique",
      origine: "client",
    },
    {
      ref: "23(2)c)",
      labelFr: "Honoraires de la consultation, ou mention pro bono",
      labelEn: "Consultation fee, or pro bono statement",
      texte:
        "les honoraires pour la consultation ou, si elle est offerte pro bono, un énoncé à cet égard",
      origine: "mandat",
    },
    {
      ref: "23(2)d)",
      labelFr: "Rôle du Collège",
      labelEn: "Role of the College",
      texte:
        "une courte description du rôle du Collège en tant qu’organisme de réglementation du titulaire de permis",
      origine: "redaction",
    },
    {
      ref: "23(2)e)",
      labelFr: "Objet et portée de la consultation",
      labelEn: "Purpose and scope of the consultation",
      texte: "une description de l’objet et de la portée de la consultation",
      origine: "mandat",
    },
  ],
  obligationsAnnexes: [
    {
      ref: "23(3)",
      texte:
        "Le titulaire de permis conserve une copie signée du contrat de consultation pour ses dossiers et en fournit une au client.",
    },
  ],
}

/* ------------------------------------------------------------------ */
/* Article 24 — Contrat de services                                    */
/* ------------------------------------------------------------------ */

export const CONTRAT_SERVICES: ExigencesContrat = {
  type: "services",
  article: "24",
  titreFr: "Contrat de services",
  titreEn: "Service agreement",
  declencheurFr:
    "Le titulaire de permis conclut un contrat de services par écrit avec le client avant de fournir tout service de consultation en immigration ou en citoyenneté ou, s’il y a eu une consultation initiale, avant de fournir tout service de consultation en immigration ou en citoyenneté additionnel.",
  declencheurEn:
    "Required in writing before providing any immigration or citizenship consulting service.",
  elements: [
    {
      ref: "24(3)a)",
      labelFr: "Identification du titulaire de permis",
      labelEn: "Licensee identification",
      texte:
        "les nom, numéro d’inscription, adresse, numéro de téléphone et adresse électronique du titulaire de permis",
      origine: "cabinet",
    },
    {
      ref: "24(3)b)",
      labelFr: "Identification du client (nom, adresses, téléphones, courriels)",
      labelEn: "Client identification",
      texte:
        "les renseignements visés aux sous-alinéas (2)a)(i) à (iii) : son nom complet; son adresse résidentielle et, le cas échéant, ses numéro de téléphone personnel et adresse électronique; le cas échéant, ses adresse, numéro de téléphone et adresse électronique au travail",
      origine: "client",
    },
    {
      ref: "24(3)c)",
      labelFr: "Résumé des conseils préliminaires donnés",
      labelEn: "Summary of preliminary advice given",
      texte: "un résumé de tout conseil préliminaire que le titulaire de permis a donné au client",
      origine: "mandat",
    },
    {
      ref: "24(3)d)",
      labelFr: "Engagement de qualité et de supervision",
      labelEn: "Quality and supervision undertaking",
      texte:
        "un énoncé portant que le titulaire de permis veillera à fournir des services de consultation en immigration ou en citoyenneté de qualité et à superviser adéquatement le travail de quiconque l’assiste dans la prestation de ces services",
      origine: "redaction",
    },
    {
      ref: "24(3)e)",
      labelFr: "Personnes susceptibles d’assister le titulaire",
      labelEn: "Persons who may assist the licensee",
      texte:
        "le nom des personnes susceptibles de prêter assistance au titulaire de permis dans la prestation de services de consultation en immigration ou en citoyenneté",
      origine: "cabinet",
    },
    {
      ref: "24(3)f)",
      labelFr: "Instructions du client",
      labelEn: "Client instructions",
      texte: "les instructions du client",
      origine: "client",
    },
    {
      ref: "24(3)g)",
      labelFr: "Liste détaillée des services (nature et portée)",
      labelEn: "Detailed list of services",
      texte:
        "une liste détaillée des services à fournir qui précise leur nature et leur portée en fonction des besoins du client",
      origine: "mandat",
    },
    {
      ref: "24(3)h)",
      labelFr: "Délais estimés de prestation",
      labelEn: "Estimated timelines",
      texte: "les délais estimés pour la prestation des services",
      origine: "mandat",
    },
    {
      ref: "24(3)i)",
      labelFr: "Estimation des honoraires, ou mention pro bono",
      labelEn: "Fee estimate, or pro bono statement",
      texte:
        "une estimation des honoraires — y compris le taux horaire et le nombre d’heures prévues — ou une somme fixe convenue ou encore, si les services sont fournis pro bono, un énoncé à cet égard",
      origine: "mandat",
    },
    {
      ref: "24(3)j)",
      labelFr: "Estimation des débours prévus",
      labelEn: "Estimated disbursements",
      texte: "une estimation des débours prévus",
      origine: "mandat",
    },
    {
      ref: "24(3)k)",
      labelFr: "Taxes applicables (TPS/TVH ou autres)",
      labelEn: "Applicable taxes",
      texte:
        "la taxe sur les produits et services ou de la taxe de vente harmonisée ou de toute autre taxe ou tout autre prélèvement à appliquer",
      origine: "mandat",
    },
    {
      ref: "24(3)l)",
      labelFr: "Modalités de paiement, intérêts sur impayés",
      labelEn: "Payment terms and interest on unpaid amounts",
      texte:
        "les modalités de paiement des honoraires et des débours, y compris les intérêts courus sur toute somme impayée",
      origine: "redaction",
    },
    {
      ref: "24(3)m)",
      labelFr: "Paiements anticipés et politique de remboursement",
      labelEn: "Advance payments and refund policy",
      texte:
        "tout paiement anticipé à effectuer par le client et la politique de remboursement du titulaire de permis",
      origine: "redaction",
    },
    {
      ref: "24(3)n)",
      labelFr: "Coûts supplémentaires possibles",
      labelEn: "Possible additional costs",
      texte: "une explication des coûts supplémentaires que le client peut être tenu de payer",
      origine: "redaction",
    },
    {
      ref: "24(3)o)",
      labelFr: "Conflits d’intérêts, réels ou possibles",
      labelEn: "Actual or potential conflicts of interest",
      texte:
        "le cas échéant, une description de tout conflit d’intérêts ou possibilité de conflit d’intérêts concernant le client",
      origine: "redaction",
    },
    {
      ref: "24(3)p)",
      labelFr: "Restitution des documents originaux",
      labelEn: "Return of original documents",
      texte:
        "un énoncé indiquant que tout document original que le client fournit au titulaire de permis lui sera rendu dès que la fin pour laquelle le titulaire de permis en a pris possession est atteinte",
      origine: "redaction",
    },
    {
      ref: "24(3)q)",
      labelFr: "Obligation de confidentialité et ses modalités",
      labelEn: "Confidentiality obligation and how it is met",
      texte:
        "un énoncé indiquant que le titulaire de permis a une obligation de confidentialité sous le régime du présent code et une description de la façon dont le titulaire de permis respectera la confidentialité des renseignements et des documents du client",
      origine: "redaction",
    },
    {
      ref: "24(3)r)",
      labelFr: "Procédure de traitement des plaintes du cabinet",
      labelEn: "Firm's complaint-handling procedure",
      texte: "la procédure du titulaire de permis concernant le traitement des plaintes",
      origine: "redaction",
    },
    {
      ref: "24(3)s)",
      labelFr: "Langue officielle de prestation des services",
      labelEn: "Official language of service",
      texte: "la langue officielle du Canada dans laquelle les services seront fournis",
      origine: "mandat",
    },
    {
      ref: "24(3)t)",
      labelFr: "Engagement d’informer sur l’état du dossier",
      labelEn: "Undertaking to provide status updates",
      texte:
        "un énoncé indiquant que le titulaire de permis fournira au client en temps opportun des renseignements relatifs à l’état de son dossier",
      origine: "redaction",
    },
    {
      ref: "24(3)u)",
      labelFr: "Recours à un interprète ou à un traducteur au besoin",
      labelEn: "Use of an interpreter or translator if needed",
      texte:
        "un énoncé indiquant que le titulaire de permis obtiendra de l’aide au besoin, notamment en retenant les services d’un interprète ou d’un traducteur",
      origine: "redaction",
    },
    {
      ref: "24(3)v)",
      labelFr: "Rôle du Collège et son processus de plaintes",
      labelEn: "Role of the College and its complaints process",
      texte:
        "une description du rôle du Collège en tant qu’organisme de réglementation du titulaire de permis et une explication du processus de traitement des plaintes du Collège",
      origine: "redaction",
    },
    {
      ref: "24(3)w)",
      labelFr: "Pouvoir du Collège d’exiger la production de documents",
      labelEn: "College's power to require documents",
      texte:
        "une explication qui précise que le Collège peut exiger la production de documents conformément à la Loi et aux règlements et règlements administratifs pris en vertu de celle-ci",
      origine: "redaction",
    },
    {
      ref: "24(3)x)",
      labelFr: "Remise d’un exemplaire du Code au client",
      labelEn: "Copy of the Code given to the client",
      texte: "un énoncé indiquant qu’un exemplaire du présent code a été remis au client",
      origine: "redaction",
    },
    {
      ref: "24(3)y)",
      labelFr: "Sort du dossier en cas d’incapacité du titulaire",
      labelEn: "What happens to the file if the licensee is incapacitated",
      texte:
        "une explication de ce qu’il advient du dossier du client si le titulaire de permis est frappé d’incapacité ou n’est plus en mesure de fournir les services convenus",
      origine: "redaction",
    },
    {
      ref: "24(3)z)",
      labelFr: "Toute autre modalité convenue",
      labelEn: "Any other agreed terms",
      texte: "toute autre modalité convenue",
      origine: "redaction",
    },
  ],
  obligationsAnnexes: [
    {
      ref: "24(2)a)",
      texte:
        "Avant de conclure le contrat, le titulaire confirme le nom complet du client, son adresse résidentielle et, le cas échéant, ses téléphone et courriel personnels ainsi que ses coordonnées au travail, en les corroborant lorsque possible.",
    },
    {
      ref: "24(2)b)",
      texte: "Il fournit au client une ébauche du contrat de services.",
    },
    {
      ref: "24(2)c)",
      texte:
        "Il vérifie si le client a conclu un contrat de service avec un autre représentant autorisé (art. 91 LIPR ou art. 21.1 Loi sur la citoyenneté) et, le cas échéant, confirme que ce contrat a pris fin ou obtient des instructions claires du client sur la portée du contrat de services.",
    },
    {
      ref: "24(4)",
      texte:
        "Le titulaire de permis conserve une copie signée du contrat de services pour ses dossiers et en fournit une au client.",
    },
    {
      ref: "24(5)",
      texte:
        "Toute modification apportée au contrat de services fait l’objet d’un accord écrit entre le client et le titulaire de permis.",
    },
    {
      ref: "31(3)",
      texte:
        "Si les honoraires ou débours dépassent l’estimation du contrat, le titulaire en informe le client et obtient son consentement écrit.",
    },
  ],
}

export const EXIGENCES_CONTRATS: Record<TypeContratCicc, ExigencesContrat> = {
  consultation: CONTRAT_CONSULTATION,
  services: CONTRAT_SERVICES,
}

/**
 * Cas où les articles 23 et 24 ne s'appliquent pas ou peuvent être levés.
 * Affiché pour éviter qu'un titulaire salarié croie l'obligation universelle.
 */
export const EXCEPTIONS_CONTRATS = [
  {
    ref: "25",
    texte:
      "Les articles 23 et 24 ne s’appliquent pas au titulaire de permis salarié d’un établissement offrant de la formation à des étudiants étrangers, ou d’une organisation qui représente un tel établissement, aux conditions prévues à cet article.",
  },
  {
    ref: "26",
    texte:
      "Le Collège peut exempter de l’application des articles 23 et 24 le titulaire salarié d’une autre organisation, aux conditions prévues à cet article.",
  },
] as const

/**
 * Éléments manquants d'un contrat, d'après les champs effectivement remplis.
 *
 * Renvoie ce qui n'est pas couvert. Ne renvoie jamais « conforme » : l'absence
 * de manque constatable n'établit pas la conformité, elle établit seulement
 * que rien ne manque parmi ce que cette application sait vérifier.
 */
export function elementsManquants(
  type: TypeContratCicc,
  couverts: ReadonlySet<string>
): ElementContrat[] {
  return EXIGENCES_CONTRATS[type].elements.filter((e) => !couverts.has(e.ref))
}
