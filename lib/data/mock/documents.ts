import { DocumentRecord, FolderRecord } from "../types"

export const MOCK_FOLDERS: FolderRecord[] = [
  { title: "Fournis par le Client", files: 24, size: "180 MB" },
  { title: "Téléchargés par le Consultant", files: 18, size: "95 MB" },
  { title: "Contrats de Services CICC", files: 12, size: "45 MB" },
  { title: "Factures & Reçus Fidéicommis", files: 15, size: "38 MB" },
  { title: "Formulaires Officiels IRCC/MIFI", files: 10, size: "62 MB" }
]

export const MOCK_DOCUMENTS: DocumentRecord[] = [
  {
    id: "doc-101",
    name: "Passeport_Officiel_M_Diarra.pdf",
    type: "Pièce d'Identité",
    category: "client_upload",
    uploadedBy: "Adama Diarra (Client)",
    date: "2026-07-28",
    expiration: "2031-05-14",
    source: "Portail Client",
    status: "valid",
    matterId: "#DOS-35695",
    clientId: "c-1",
    clientName: "M. Adama Diarra",
    fileSize: "3.2 MB",
    sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    storagePath: "firms/firm-demo/matters/DOS-35695/Passeport_Officiel_M_Diarra.pdf",
    content: `PASSEPORT — PAGE D'IDENTITÉ (DONNÉES EXTRAITES)

Type de document ......... Passeport ordinaire
Pays émetteur ............ Mali (MLI)
N° de passeport .......... AA1234567

Nom ...................... DIARRA
Prénoms .................. Adama
Nationalité .............. Malienne
Date de naissance ........ 14 mai 1988
Sexe ..................... M
Lieu de naissance ........ Bamako, Mali
Date de délivrance ....... 15 mai 2021
Date d'expiration ........ 14 mai 2031
Autorité de délivrance ... DGPN — Bamako

--- CONTRÔLE DE CONFORMITÉ CABINET ---
Page d'identité lisible et complète .............. OUI
Concordance nom/prénoms avec le dossier #DOS-35695  CONFORME
Validité > 6 mois à la date prévue de dépôt ...... OUI
Pages de visas fournies .......................... 4 pages jointes

Aucune anomalie relevée lors de la vérification du 2026-07-28.`
  },
  {
    id: "doc-102",
    name: "Attestation_TEF_Canada_Dr_Rahman.pdf",
    type: "Test de Langue (TEF)",
    category: "client_upload",
    uploadedBy: "Dr. S. Rahman (Client)",
    date: "2026-07-20",
    expiration: "2028-07-19",
    source: "Portail Client",
    status: "valid",
    matterId: "#DOS-35697",
    clientId: "c-2",
    clientName: "Dr. S. Rahman",
    fileSize: "1.8 MB",
    sha256: "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284ddd200126d9069",
    storagePath: "firms/firm-demo/matters/DOS-35697/Attestation_TEF_Canada_Dr_Rahman.pdf",
    content: `TEST D'ÉVALUATION DE FRANÇAIS ADAPTÉ POUR LE CANADA
TEF CANADA — ATTESTATION DE RÉSULTATS

N° d'attestation ......... TEF-CA-2026-448120
Candidat ................. RAHMAN, Sayeed (Dr.)
Date de passation ........ 19 juillet 2026
Centre agréé ............. Montréal (QC)
Validité ................. 2 ans — jusqu'au 19 juillet 2028

ÉPREUVE                          SCORE       NCLC
Compréhension orale .......... 316 / 360      9
Compréhension écrite ......... 272 / 300      9
Expression orale ............. 371 / 450      8
Expression écrite ............ 358 / 450      8

NIVEAU GLOBAL RETENU ......... NCLC 8

--- ANALYSE CABINET ---
Seuil Entrée express (NCLC 7 aux 4 épreuves) ..... ATTEINT
Seuil PSTQ Québec (NCLC 7 à l'oral) ............. ATTEINT
Points estimés — 1re langue officielle .......... 124 / 136

VIGILANCE : l'attestation expire le 2028-07-19. Un dépôt
postérieur à cette date exigera de repasser l'épreuve.`
  },
  {
    id: "doc-103",
    name: "Entente_de_Service_CICC_SA-2026-000142.pdf",
    type: "Contrat de Services",
    category: "contract",
    uploadedBy: "Me Adama Diarra (RCIC)",
    date: "2026-07-25",
    expiration: "N/A",
    source: "Générateur CICC",
    status: "valid",
    matterId: "#DOS-35698",
    clientId: "c-4",
    clientName: "Les Industries Nordiques Inc.",
    fileSize: "850 KB",
    sha256: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    storagePath: "firms/firm-demo/agreements/Entente_de_Service_CICC_SA-2026-000142.pdf",
    content: `ENTENTE DE SERVICES PROFESSIONNELS
Contrat n° SA-2026-000142

ENTRE : Cabinet de démonstration
        Représenté par Me Adama Diarra
        Consultant réglementé — RCIC #R000000
        Membre en règle du Collège des consultants en
        immigration et en citoyenneté (CICC)

ET :    Les Industries Nordiques Inc. (« le Client »)
        Dossier #DOS-35698

1. OBJET DU MANDAT
   Accompagnement complet en vue de l'obtention d'une Étude
   d'impact sur le marché du travail (EIMT), volet hauts
   salaires, incluant l'affichage de poste conforme et le
   dépôt de la demande auprès d'EDSC.

2. HONORAIRES PROFESSIONNELS
   Honoraires forfaitaires ............. 4 500,00 $ CAD
   TPS (5 %) ..........................    225,00 $ CAD
   TVQ (9,975 %) ......................    448,88 $ CAD
   TOTAL ..............................  5 173,88 $ CAD

3. DÉBOURSÉS ET FRAIS GOUVERNEMENTAUX
   Frais EIMT de 1 000 $ par poste, payables directement à
   EDSC. Ces frais ne constituent pas des honoraires, ne sont
   pas remboursables et ne sont pas inclus au forfait.

4. MODALITÉS DE PAIEMENT
   50 % à la signature, solde exigible au dépôt de la demande.
   Les sommes reçues d'avance sont déposées au compte en
   fidéicommis du cabinet conformément au Code de déontologie
   du CICC.

5. RÉSILIATION
   Le Client peut mettre fin au mandat en tout temps par avis
   écrit. Les honoraires sont alors facturés au prorata du
   travail effectivement accompli.

6. DÉCLARATION OBLIGATOIRE
   Le consultant ne peut garantir l'issue d'une demande. Toute
   décision relève exclusivement des autorités gouvernementales
   compétentes.

SIGNATURES
   Me Adama Diarra (RCIC #R000000) ..... 25 juillet 2026
   Les Industries Nordiques Inc. ........ 25 juillet 2026`
  },
  {
    id: "doc-104",
    name: "Facture_Officielle_FAC-202601.pdf",
    type: "Facture Honoraires & Fidéicommis",
    category: "invoice",
    uploadedBy: "Comptabilité Cabinet",
    date: "2026-07-31",
    expiration: "N/A",
    source: "Module Facturation",
    status: "valid",
    matterId: "#DOS-35698",
    clientId: "c-4",
    clientName: "Les Industries Nordiques Inc.",
    fileSize: "420 KB",
    sha256: "2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae",
    storagePath: "firms/firm-demo/invoices/Facture_Officielle_FAC-202601.pdf",
    content: `FACTURE

Cabinet de démonstration — RCIC #R000000
TPS 123456789 RT0001 — TVQ 1234567890 TQ0001

Facture n° ............... FAC-202601
Date d'émission .......... 2026-07-31
Échéance ................. 2026-08-30
Client ................... Les Industries Nordiques Inc.
Dossier .................. #DOS-35698

DESCRIPTION                                      MONTANT
Honoraires — mandat EIMT hauts salaires ....  4 500,00 $
Frais d'affichage de poste conforme ........    150,00 $
                                             -----------
Sous-total .................................  4 650,00 $
TPS (5 %) ..................................    232,50 $
TVQ (9,975 %) ..............................    463,84 $
                                             -----------
TOTAL ......................................  5 346,34 $
Moins acompte encaissé en fidéicommis ...... -2 250,00 $
                                             -----------
SOLDE DÛ ...................................  3 096,34 $

MOUVEMENTS DU COMPTE EN FIDÉICOMMIS
2026-07-25  Dépôt de l'acompte client ......  +2 250,00 $
2026-07-31  Transfert au compte général ....  -2 250,00 $
            (facture émise — transfert autorisé)
Solde en fidéicommis pour ce dossier .......      0,00 $

Paiement par virement Interac ou chèque à l'ordre du
cabinet. Intérêts de 1,5 % par mois sur tout solde impayé
après l'échéance.`
  },
  {
    id: "doc-105",
    name: "Note_Consultation_Eligibilite_PEQ.pdf",
    type: "Note Interne Consultant",
    category: "consultant_upload",
    uploadedBy: "Me Adama Diarra (RCIC)",
    date: "2026-07-29",
    expiration: "N/A",
    source: "Espace Consultant",
    status: "valid",
    matterId: "#DOS-35695",
    clientId: "c-1",
    clientName: "M. Adama Diarra",
    fileSize: "1.2 MB",
    sha256: "fcde2b2edba56bf408601fb721fe9b5c338d10ee429c7047b37b12d62e157790",
    storagePath: "firms/firm-demo/matters/DOS-35695/Note_Consultation_Eligibilite_PEQ.pdf",
    content: `NOTE DE CONSULTATION — ANALYSE D'ADMISSIBILITÉ
CONFIDENTIEL — COUVERT PAR LE SECRET PROFESSIONNEL

Dossier .............. #DOS-35695
Client ............... M. Adama Diarra
Consultant ........... Me Adama Diarra (RCIC #R000000)
Entretien ............ 29 juillet 2026 — 45 min, visioconférence

1. PROGRAMME ÉVALUÉ
   Programme de l'expérience québécoise (PEQ),
   volet Diplômés du Québec.

2. PROFIL DU CLIENT
   - Maîtrise en génie industriel, Université Laval (2024)
   - Emploi actuel : analyste procédés, Québec, depuis 09/2024
   - Statut : permis de travail postdiplôme, expire 2027-03-31
   - Français : NCLC 9 (à confirmer par l'attestation au dossier)

3. ANALYSE
   Le diplôme québécois est admissible au volet Diplômés. La
   condition de séjour au Québec est satisfaite. Le niveau de
   français dépasse le seuil exigé de NCLC 7 à l'oral.

4. POINTS DE VIGILANCE
   - L'attestation de français au dossier expire le 2028-07-19 :
     suffisant pour un dépôt en 2026, à surveiller en cas de
     report du calendrier.
   - Vérifier l'absence d'interruption de séjour supérieure à
     six mois depuis l'obtention du diplôme.

5. RECOMMANDATION
   Déposer une demande de CSQ au titre du PEQ Diplômés avant
   l'expiration du permis de travail. Fenêtre optimale :
   septembre à novembre 2026.

6. PROCHAINES ÉTAPES
   [ ] Obtenir le relevé de notes officiel scellé
   [ ] Confirmer l'historique de séjour (entrées et sorties)
   [ ] Préparer le formulaire de demande de CSQ

Aucune garantie de résultat n'a été donnée au client. La
décision relève du ministère compétent.`
  },
  {
    id: "doc-106",
    name: "Formulaire_IMM5476_Recrutement_Infirmieres.pdf",
    type: "Formulaire Officiel IRCC",
    category: "ircc_form",
    uploadedBy: "Sophie Tremblay (Staff)",
    date: "2026-07-30",
    expiration: "2027-07-30",
    source: "Générateur Formulaire",
    status: "valid",
    matterId: "#DOS-35696",
    clientId: "c-3",
    clientName: "Santé Québec Express",
    fileSize: "2.1 MB",
    sha256: "d4735e3a265e16eee03f59718b9b5d03019c07d8b6c51f90da3a666eec13ab35",
    storagePath: "firms/firm-demo/forms/Formulaire_IMM5476_Recrutement_Infirmieres.pdf",
    content: `IMM 5476 — RECOURS AUX SERVICES D'UN REPRÉSENTANT
USE OF A REPRESENTATIVE
Immigration, Réfugiés et Citoyenneté Canada (IRCC)

SECTION A — RENSEIGNEMENTS SUR LE DEMANDEUR
   Organisation .......... Santé Québec Express
   Dossier cabinet ....... #DOS-35696
   N° de client IRCC ..... 1122-3344
   Objet ................. EIMT — recrutement d'infirmières
                           diplômées à l'international

SECTION B — NOMINATION D'UN REPRÉSENTANT
   Nom ................... DIARRA, Adama
   Type .................. Représentant rémunéré
   Organisme de régie .... Collège des consultants en
                           immigration et en citoyenneté (CICC)
   N° de membre .......... R000000
   Cabinet ............... Cabinet de démonstration
   Courriel .............. adama.diarra@demo-immigration.ca

SECTION C — CONSENTEMENT À LA DIVULGATION
   J'autorise IRCC à divulguer les renseignements de mon
   dossier au représentant nommé à la section B.
   Réponse ............... OUI

SECTION D — SIGNATURES
   Demandeur ............. Santé Québec Express (mandataire)
   Date .................. 2026-07-30
   Représentant .......... Adama Diarra
   Date .................. 2026-07-30

--- CONTRÔLE CABINET ---
Généré depuis le module Formulaires — version 09-2025.
Champs obligatoires remplis ............... 14 / 14
À joindre au dossier avant tout envoi à IRCC.`
  },
  {
    id: "doc-107",
    name: "Ancien_Diplome_Master_Archived.pdf",
    type: "Diplôme Ancien",
    category: "client_upload",
    uploadedBy: "M. Diarra (Client)",
    date: "2025-01-10",
    expiration: "N/A",
    source: "Portail Client",
    status: "archived",
    matterId: "#DOS-35695",
    clientId: "c-1",
    clientName: "M. Adama Diarra",
    fileSize: "4.5 MB",
    sha256: "a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0",
    storagePath: "firms/firm-demo/archive/Ancien_Diplome_Master_Archived.pdf",
    content: `DIPLÔME — DOCUMENT ARCHIVÉ

Université de Bamako — Faculté des Sciences et Techniques
Diplôme de Master en génie industriel

Titulaire ................ DIARRA, Adama
Promotion ................ 2013
Mention .................. Bien
N° de parchemin .......... ML-2013-04417

--- ÉVALUATION DES DIPLÔMES D'ÉTUDES (EDE) ---
Organisme ................ World Education Services (WES)
N° de référence .......... WES-2019-772104
Équivalence canadienne ... Baccalauréat (programme de 4 ans)
Date du rapport .......... 2019-03-12
Statut du rapport ........ EXPIRÉ depuis le 2024-03-12

--- MOTIF D'ARCHIVAGE ---
Remplacé par la maîtrise québécoise obtenue à l'Université
Laval en 2024, désormais le diplôme retenu pour l'analyse
d'admissibilité (voir Note_Consultation_Eligibilite_PEQ.pdf).

Conservé au dossier au titre de la politique de rétention de
sept ans du cabinet. Ne pas utiliser au soutien d'une demande
sans obtenir au préalable un nouveau rapport EDE.`
  }
]
