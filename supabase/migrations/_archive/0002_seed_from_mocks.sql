-- =====================================================================
-- moncabinetcric — données de départ, générées depuis lib/data/mock/
-- À appliquer APRÈS 0001_init_schema.sql.
--
-- Fichier généré automatiquement : ne pas éditer à la main.
-- Idempotent : ré-exécutable sans créer de doublons (on conflict do nothing).
--
-- La colonne legacy_id conserve l'identifiant du mock (c-1, m-01, doc-101…)
-- afin que les liens entre tables soient reconstruits par jointure plutôt
-- que par des uuid codés en dur.
-- =====================================================================

begin;

-- --- Cabinet -----------------------------------------------------------
insert into public.firms (slug, name, rcic_number, rcic_name, address, phone, email, logo_letter)
values (
  'firm-boreale',
  'Cabinet Immigration Boréale Inc.',
  'R-514982',
  'Me Adama Diarra',
  'Montréal, Québec, Canada',
  '+1 (514) 000-0000',
  'adama.diarra@boreale-immigration.ca',
  'M'
)
on conflict (slug) do nothing;

-- Raccourci réutilisé plus bas.
create temporary table _firm on commit drop as
  select id from public.firms where slug = 'firm-boreale';

-- --- Membres -----------------------------------------------------------
insert into public.firm_members (firm_id, email, full_name, role)
select (select id from _firm), 'adama.diarra@boreale-immigration.ca', 'Me Adama Diarra', 'owner'
on conflict (firm_id, email) do nothing;


-- --- Clients (4) ---------------------------------------------
insert into public.clients (firm_id, legacy_id, file_number, name, first_name, last_name, email, phone, citizenship, residence, province, program, status, intake_motif, client_type, neq_number)
values ((select id from _firm), 'c-1', 'CRIC-2026-0101', 'M. A. Diarra', null, null, 'adiarra@consulting.ca', '+1 (514) 555-0101', 'Mali', 'Canada', 'Québec', 'Résidence Permanente (PEQ)', 'active', 'Diplômé universitaire du Québec, expérience de travail 12 mois.', null, null)
on conflict (firm_id, file_number) do nothing;
insert into public.clients (firm_id, legacy_id, file_number, name, first_name, last_name, email, phone, citizenship, residence, province, program, status, intake_motif, client_type, neq_number)
values ((select id from _firm), 'c-2', 'CRIC-2026-0102', 'Dr. S. Rahman', null, null, 's.rahman@medtech.ca', '+1 (514) 555-0144', 'Tunisie', 'Canada', 'Ontario', 'Entrée Express (Catégorie Santé)', 'active', 'Ingénieur biomédical avec offre d''emploi validée en Ontario.', null, null)
on conflict (firm_id, file_number) do nothing;
insert into public.clients (firm_id, legacy_id, file_number, name, first_name, last_name, email, phone, citizenship, residence, province, program, status, intake_motif, client_type, neq_number)
values ((select id from _firm), 'c-3', 'CRIC-2026-0103', 'Mme. K. Dubois', null, null, 'k.dubois@gmail.com', '+33 6 12 34 56 78', 'France', 'France', null, 'Permis d''études + CAQ', 'consultation', 'Admission à l''Université de Montréal pour la rentrée d''automne.', null, null)
on conflict (firm_id, file_number) do nothing;
insert into public.clients (firm_id, legacy_id, file_number, name, first_name, last_name, email, phone, citizenship, residence, province, program, status, intake_motif, client_type, neq_number)
values ((select id from _firm), 'c-4', 'CRIC-2026-0104', 'M. G. Bouchard (Les Industries Nordiques)', null, null, 'rh@industriesnordiques.ca', '+1 (819) 555-0192', 'Canada (Employeur)', 'Canada', 'Québec', 'EIMT - 12 Postes Agroalimentaires', 'active', 'Recrutement collectif en agroalimentaire — Outaouais.', null, null)
on conflict (firm_id, file_number) do nothing;

-- --- Dossiers (7) --------------------------------------------
insert into public.matters (firm_id, client_id, legacy_id, reference, client_name, client_type, program, category, opened_date, deadline, rcic, status, urgency_days, notes, is_priority)
values ((select id from _firm), (select id from public.clients where firm_id = (select id from _firm) and legacy_id = 'c-4'), '#DOS-35698', '#DOS-35698', 'Les Industries Nordiques Inc. (12 EIMT)', 'b2b', 'Permis de travail / EIMT', null, '18-05-26', '18-08-26', 'Me. A. Diarra', 'valid', null, null, true)
on conflict (firm_id, reference) do nothing;
insert into public.matters (firm_id, client_id, legacy_id, reference, client_name, client_type, program, category, opened_date, deadline, rcic, status, urgency_days, notes, is_priority)
values ((select id from _firm), (select id from public.clients where firm_id = (select id from _firm) and legacy_id = 'c-2'), '#DOS-35697', '#DOS-35697', 'Dr. S. Rahman', 'b2c', 'Résidence Permanente (EE)', null, '16-05-26', '16-09-26', 'Me. A. Diarra', 'valid', null, null, false)
on conflict (firm_id, reference) do nothing;
insert into public.matters (firm_id, client_id, legacy_id, reference, client_name, client_type, program, category, opened_date, deadline, rcic, status, urgency_days, notes, is_priority)
values ((select id from _firm), (select id from public.clients where firm_id = (select id from _firm) and legacy_id = 'c-4'), '#DOS-35696', '#DOS-35696', 'Santé Québec Express (8 Infirmières)', 'b2b', 'Recrutement LMIA Exemption', null, '15-05-26', '01-08-26', 'Me. S. Lavoie', 'alert', null, null, true)
on conflict (firm_id, reference) do nothing;
insert into public.matters (firm_id, client_id, legacy_id, reference, client_name, client_type, program, category, opened_date, deadline, rcic, status, urgency_days, notes, is_priority)
values ((select id from _firm), (select id from public.clients where firm_id = (select id from _firm) and legacy_id = 'c-1'), '#DOS-35695', '#DOS-35695', 'K. Tremblay', 'b2c', 'Parrainage d''Époux / Conjoint de fait', null, '12-05-26', '14-10-26', 'Me. A. Diarra', 'review', null, null, false)
on conflict (firm_id, reference) do nothing;
insert into public.matters (firm_id, client_id, legacy_id, reference, client_name, client_type, program, category, opened_date, deadline, rcic, status, urgency_days, notes, is_priority)
values ((select id from _firm), (select id from public.clients where firm_id = (select id from _firm) and legacy_id = 'c-3'), '#DOS-35694', '#DOS-35694', 'M. A. Dos Santos', 'b2c', 'Permis d''études (CAQ UdeM)', null, '10-05-26', '30-07-26', 'Me. S. Lavoie', 'pending', null, null, false)
on conflict (firm_id, reference) do nothing;
insert into public.matters (firm_id, client_id, legacy_id, reference, client_name, client_type, program, category, opened_date, deadline, rcic, status, urgency_days, notes, is_priority)
values ((select id from _firm), (select id from public.clients where firm_id = (select id from _firm) and legacy_id = 'c-4'), '#DOS-35693', '#DOS-35693', 'Construction Boréale Ltée (6 postes)', 'b2b', 'EIMT - Charpentiers', null, '08-05-26', '25-08-26', 'Me. A. Diarra', 'valid', null, null, false)
on conflict (firm_id, reference) do nothing;
insert into public.matters (firm_id, client_id, legacy_id, reference, client_name, client_type, program, category, opened_date, deadline, rcic, status, urgency_days, notes, is_priority)
values ((select id from _firm), (select id from public.clients where firm_id = (select id from _firm) and legacy_id = 'c-1'), '#DOS-35692', '#DOS-35692', 'Mme. E. Roy', 'b2c', 'Résidence Permanente (PEQ)', null, '01-05-26', '15-09-26', 'Me. S. Lavoie', 'valid', null, null, false)
on conflict (firm_id, reference) do nothing;

-- --- Prospects (6) -------------------------------------------
insert into public.leads (firm_id, legacy_id, name, first_name, last_name, company, type, visa_type, estimated_value, score, score_label, stage, last_contact, email, phone, notes, lmia_positions, source)
values ((select id from _firm), 'lead-1', 'M. G. Bouchard (RH)', null, null, 'Les Industries Nordiques Inc.', 'b2b', 'EIMT / Permis de Travail (12 postes)', 18500, 94, 'high', 'negotiation', 'Appel - il y a 1j', 'rh@industriesnordiques.ca', '+1 (819) 555-0192', 'Employeur de la région Outaouais en forte pénurie de main-d''œuvre agroalimentaire. Exonération partielle de taxes applicable.', 12, null);
insert into public.leads (firm_id, legacy_id, name, first_name, last_name, company, type, visa_type, estimated_value, score, score_label, stage, last_contact, email, phone, notes, lmia_positions, source)
values ((select id from _firm), 'lead-2', 'Dr. S. Rahman', null, null, null, 'b2c', 'Résidence Permanente (Entrée Express)', 4200, 91, 'high', 'proposal', 'Courriel - il y a 2j', 's.rahman@medtech.ca', '+1 (514) 555-0144', 'Ingénieur biomédical, TEF Canada C1 obtenu en mars. Praticabilité excellente, en attente de signature de l''entente.', null, null);
insert into public.leads (firm_id, legacy_id, name, first_name, last_name, company, type, visa_type, estimated_value, score, score_label, stage, last_contact, email, phone, notes, lmia_positions, source)
values ((select id from _firm), 'lead-3', 'Mme. C. Lavoie (Dir. Opérations)', null, null, 'Santé Québec Express', 'b2b', 'Recrutement Infirmières (8 postes - LMIA Exemption)', 14400, 88, 'high', 'signed', 'Entente signée aujourd''hui', 'clavoie@santeqc-express.ca', '+1 (418) 555-0188', 'Entente de service multipartite signée électroniquement. Prêt pour conversion au journal CICC.', 8, null);
insert into public.leads (firm_id, legacy_id, name, first_name, last_name, company, type, visa_type, estimated_value, score, score_label, stage, last_contact, email, phone, notes, lmia_positions, source)
values ((select id from _firm), 'lead-4', 'K. Tremblay', null, null, null, 'b2c', 'Parrainage d''Époux / Conjoint de fait (Québec MIFI)', 3800, 74, 'med', 'consultation', 'R-V fixé le 3 Aoû', 'k.tremblay@gmail.com', '+1 (514) 555-0122', 'Dossier solide, vérification des preuves d''union de fait à compléter lors de la consultation.', null, null);
insert into public.leads (firm_id, legacy_id, name, first_name, last_name, company, type, visa_type, estimated_value, score, score_label, stage, last_contact, email, phone, notes, lmia_positions, source)
values ((select id from _firm), 'lead-5', 'M. A. Dos Santos', null, null, null, 'b2c', 'Permis d''études (UdeM - Maîtrise)', 2500, 65, 'low', 'newLead', 'Intake soumis il y a 4h', 'a.dossantos@univ.br', '+55 (11) 98822-0199', 'Attente de preuve de capacité financière pour le CAQ. Alerte IA : passeport à vérifier.', null, null);
insert into public.leads (firm_id, legacy_id, name, first_name, last_name, company, type, visa_type, estimated_value, score, score_label, stage, last_contact, email, phone, notes, lmia_positions, source)
values ((select id from _firm), 'lead-6', 'J. Morvan (PDG)', null, null, 'Construction Boréale Ltée', 'b2b', 'EIMT - Charpentiers-Menuisiers (6 postes)', 11200, 82, 'high', 'consultation', 'Appel - il y a 3j', 'jmorvan@boreale-construction.ca', '+1 (819) 555-0176', 'Urgence de recrutement avant la saison automnale. Synchronisation Outlook confirmée pour jeudi.', 6, null);

-- --- Factures (4) ------------------------------------------
insert into public.invoices (firm_id, client_id, matter_id, legacy_id, invoice_number, client_name, service_description, amount, date, status, is_trust_account, tax_exempt)
values ((select id from _firm), (select id from public.clients where firm_id = (select id from _firm) and legacy_id = 'c-4'), (select id from public.matters where firm_id = (select id from _firm) and reference = '#DOS-35698'), 'inv-1', '#FAC-202601', 'Les Industries Nordiques Inc. (12 EIMT)', 'Mandat Entreprise B2B — Accompagnement, rédaction & dépôt de 12 demandes d''EIMT (Recrutement International)', 18500, '18-05-2026', 'trust_reconciled', true, false)
on conflict (firm_id, invoice_number) do nothing;
insert into public.invoices (firm_id, client_id, matter_id, legacy_id, invoice_number, client_name, service_description, amount, date, status, is_trust_account, tax_exempt)
values ((select id from _firm), (select id from public.clients where firm_id = (select id from _firm) and legacy_id = 'c-2'), (select id from public.matters where firm_id = (select id from _firm) and reference = '#DOS-35697'), 'inv-2', '#FAC-202602', 'Dr. S. Rahman', 'Honoraires professionnels — Accompagnement Entrée Express, Évaluation ÉDE & Dépôt d''intérêt d''immigration', 4200, '16-05-2026', 'paid', true, false)
on conflict (firm_id, invoice_number) do nothing;
insert into public.invoices (firm_id, client_id, matter_id, legacy_id, invoice_number, client_name, service_description, amount, date, status, is_trust_account, tax_exempt)
values ((select id from _firm), (select id from public.clients where firm_id = (select id from _firm) and legacy_id = 'c-4'), (select id from public.matters where firm_id = (select id from _firm) and reference = '#DOS-35696'), 'inv-3', '#FAC-202603', 'Santé Québec Express', 'Accompagnement Réglementaire CICC — Programme Santé Québec & Recrutement d''Infirmières Diplômées Hors Canada', 14400, '15-05-2026', 'pending', true, false)
on conflict (firm_id, invoice_number) do nothing;
insert into public.invoices (firm_id, client_id, matter_id, legacy_id, invoice_number, client_name, service_description, amount, date, status, is_trust_account, tax_exempt)
values ((select id from _firm), (select id from public.clients where firm_id = (select id from _firm) and legacy_id = 'c-1'), (select id from public.matters where firm_id = (select id from _firm) and reference = '#DOS-35695'), 'inv-4', '#FAC-202604', 'K. Tremblay', 'Programme de l''Expérience Québécoise (PEQ Travailleur) — Dépôt CSQ & Résidence Permanente IRCC', 3800, '12-05-2026', 'paid', false, false)
on conflict (firm_id, invoice_number) do nothing;

-- --- Documents (7) -----------------------------------------
insert into public.documents (firm_id, client_id, matter_id, legacy_id, name, type, category, uploaded_by, date, expiration, source, status, client_name, file_size, sha256, storage_path, content)
values ((select id from _firm), (select id from public.clients where firm_id = (select id from _firm) and legacy_id = 'c-1'), (select id from public.matters where firm_id = (select id from _firm) and reference = '#DOS-35695'), 'doc-101', 'Passeport_Officiel_M_Diarra.pdf', 'Pièce d''Identité', 'client_upload', 'Adama Diarra (Client)', '2026-07-28', '2031-05-14', 'Portail Client', 'valid', 'M. Adama Diarra', '3.2 MB', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'firms/firm-boreale/matters/DOS-35695/Passeport_Officiel_M_Diarra.pdf', 'PASSEPORT — PAGE D''IDENTITÉ (DONNÉES EXTRAITES)

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
Date d''expiration ........ 14 mai 2031
Autorité de délivrance ... DGPN — Bamako

--- CONTRÔLE DE CONFORMITÉ CABINET ---
Page d''identité lisible et complète .............. OUI
Concordance nom/prénoms avec le dossier #DOS-35695  CONFORME
Validité > 6 mois à la date prévue de dépôt ...... OUI
Pages de visas fournies .......................... 4 pages jointes

Aucune anomalie relevée lors de la vérification du 2026-07-28.');
insert into public.documents (firm_id, client_id, matter_id, legacy_id, name, type, category, uploaded_by, date, expiration, source, status, client_name, file_size, sha256, storage_path, content)
values ((select id from _firm), (select id from public.clients where firm_id = (select id from _firm) and legacy_id = 'c-2'), (select id from public.matters where firm_id = (select id from _firm) and reference = '#DOS-35697'), 'doc-102', 'Attestation_TEF_Canada_Dr_Rahman.pdf', 'Test de Langue (TEF)', 'client_upload', 'Dr. S. Rahman (Client)', '2026-07-20', '2028-07-19', 'Portail Client', 'valid', 'Dr. S. Rahman', '1.8 MB', '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284ddd200126d9069', 'firms/firm-boreale/matters/DOS-35697/Attestation_TEF_Canada_Dr_Rahman.pdf', 'TEST D''ÉVALUATION DE FRANÇAIS ADAPTÉ POUR LE CANADA
TEF CANADA — ATTESTATION DE RÉSULTATS

N° d''attestation ......... TEF-CA-2026-448120
Candidat ................. RAHMAN, Sayeed (Dr.)
Date de passation ........ 19 juillet 2026
Centre agréé ............. Montréal (QC)
Validité ................. 2 ans — jusqu''au 19 juillet 2028

ÉPREUVE                          SCORE       NCLC
Compréhension orale .......... 316 / 360      9
Compréhension écrite ......... 272 / 300      9
Expression orale ............. 371 / 450      8
Expression écrite ............ 358 / 450      8

NIVEAU GLOBAL RETENU ......... NCLC 8

--- ANALYSE CABINET ---
Seuil Entrée express (NCLC 7 aux 4 épreuves) ..... ATTEINT
Seuil PSTQ Québec (NCLC 7 à l''oral) ............. ATTEINT
Points estimés — 1re langue officielle .......... 124 / 136

VIGILANCE : l''attestation expire le 2028-07-19. Un dépôt
postérieur à cette date exigera de repasser l''épreuve.');
insert into public.documents (firm_id, client_id, matter_id, legacy_id, name, type, category, uploaded_by, date, expiration, source, status, client_name, file_size, sha256, storage_path, content)
values ((select id from _firm), (select id from public.clients where firm_id = (select id from _firm) and legacy_id = 'c-4'), (select id from public.matters where firm_id = (select id from _firm) and reference = '#DOS-35698'), 'doc-103', 'Entente_de_Service_CICC_SA-2026-000142.pdf', 'Contrat de Services', 'contract', 'Me Adama Diarra (RCIC)', '2026-07-25', 'N/A', 'Générateur CICC', 'valid', 'Les Industries Nordiques Inc.', '850 KB', '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08', 'firms/firm-boreale/agreements/Entente_de_Service_CICC_SA-2026-000142.pdf', 'ENTENTE DE SERVICES PROFESSIONNELS
Contrat n° SA-2026-000142

ENTRE : Cabinet Immigration Boréale Inc.
        Représenté par Me Adama Diarra
        Consultant réglementé — RCIC #R-514982
        Membre en règle du Collège des consultants en
        immigration et en citoyenneté (CICC)

ET :    Les Industries Nordiques Inc. (« le Client »)
        Dossier #DOS-35698

1. OBJET DU MANDAT
   Accompagnement complet en vue de l''obtention d''une Étude
   d''impact sur le marché du travail (EIMT), volet hauts
   salaires, incluant l''affichage de poste conforme et le
   dépôt de la demande auprès d''EDSC.

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
   Les sommes reçues d''avance sont déposées au compte en
   fidéicommis du cabinet conformément au Code de déontologie
   du CICC.

5. RÉSILIATION
   Le Client peut mettre fin au mandat en tout temps par avis
   écrit. Les honoraires sont alors facturés au prorata du
   travail effectivement accompli.

6. DÉCLARATION OBLIGATOIRE
   Le consultant ne peut garantir l''issue d''une demande. Toute
   décision relève exclusivement des autorités gouvernementales
   compétentes.

SIGNATURES
   Me Adama Diarra (RCIC #R-514982) ..... 25 juillet 2026
   Les Industries Nordiques Inc. ........ 25 juillet 2026');
insert into public.documents (firm_id, client_id, matter_id, legacy_id, name, type, category, uploaded_by, date, expiration, source, status, client_name, file_size, sha256, storage_path, content)
values ((select id from _firm), (select id from public.clients where firm_id = (select id from _firm) and legacy_id = 'c-4'), (select id from public.matters where firm_id = (select id from _firm) and reference = '#DOS-35698'), 'doc-104', 'Facture_Officielle_FAC-202601.pdf', 'Facture Honoraires & Fidéicommis', 'invoice', 'Comptabilité Cabinet', '2026-07-31', 'N/A', 'Module Facturation', 'valid', 'Les Industries Nordiques Inc.', '420 KB', '2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae', 'firms/firm-boreale/invoices/Facture_Officielle_FAC-202601.pdf', 'FACTURE

Cabinet Immigration Boréale Inc. — RCIC #R-514982
TPS 123456789 RT0001 — TVQ 1234567890 TQ0001

Facture n° ............... FAC-202601
Date d''émission .......... 2026-07-31
Échéance ................. 2026-08-30
Client ................... Les Industries Nordiques Inc.
Dossier .................. #DOS-35698

DESCRIPTION                                      MONTANT
Honoraires — mandat EIMT hauts salaires ....  4 500,00 $
Frais d''affichage de poste conforme ........    150,00 $
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
2026-07-25  Dépôt de l''acompte client ......  +2 250,00 $
2026-07-31  Transfert au compte général ....  -2 250,00 $
            (facture émise — transfert autorisé)
Solde en fidéicommis pour ce dossier .......      0,00 $

Paiement par virement Interac ou chèque à l''ordre du
cabinet. Intérêts de 1,5 % par mois sur tout solde impayé
après l''échéance.');
insert into public.documents (firm_id, client_id, matter_id, legacy_id, name, type, category, uploaded_by, date, expiration, source, status, client_name, file_size, sha256, storage_path, content)
values ((select id from _firm), (select id from public.clients where firm_id = (select id from _firm) and legacy_id = 'c-1'), (select id from public.matters where firm_id = (select id from _firm) and reference = '#DOS-35695'), 'doc-105', 'Note_Consultation_Eligibilite_PEQ.pdf', 'Note Interne Consultant', 'consultant_upload', 'Me Adama Diarra (RCIC)', '2026-07-29', 'N/A', 'Espace Consultant', 'valid', 'M. Adama Diarra', '1.2 MB', 'fcde2b2edba56bf408601fb721fe9b5c338d10ee429c7047b37b12d62e157790', 'firms/firm-boreale/matters/DOS-35695/Note_Consultation_Eligibilite_PEQ.pdf', 'NOTE DE CONSULTATION — ANALYSE D''ADMISSIBILITÉ
CONFIDENTIEL — COUVERT PAR LE SECRET PROFESSIONNEL

Dossier .............. #DOS-35695
Client ............... M. Adama Diarra
Consultant ........... Me Adama Diarra (RCIC #R-514982)
Entretien ............ 29 juillet 2026 — 45 min, visioconférence

1. PROGRAMME ÉVALUÉ
   Programme de l''expérience québécoise (PEQ),
   volet Diplômés du Québec.

2. PROFIL DU CLIENT
   - Maîtrise en génie industriel, Université Laval (2024)
   - Emploi actuel : analyste procédés, Québec, depuis 09/2024
   - Statut : permis de travail postdiplôme, expire 2027-03-31
   - Français : NCLC 9 (à confirmer par l''attestation au dossier)

3. ANALYSE
   Le diplôme québécois est admissible au volet Diplômés. La
   condition de séjour au Québec est satisfaite. Le niveau de
   français dépasse le seuil exigé de NCLC 7 à l''oral.

4. POINTS DE VIGILANCE
   - L''attestation de français au dossier expire le 2028-07-19 :
     suffisant pour un dépôt en 2026, à surveiller en cas de
     report du calendrier.
   - Vérifier l''absence d''interruption de séjour supérieure à
     six mois depuis l''obtention du diplôme.

5. RECOMMANDATION
   Déposer une demande de CSQ au titre du PEQ Diplômés avant
   l''expiration du permis de travail. Fenêtre optimale :
   septembre à novembre 2026.

6. PROCHAINES ÉTAPES
   [ ] Obtenir le relevé de notes officiel scellé
   [ ] Confirmer l''historique de séjour (entrées et sorties)
   [ ] Préparer le formulaire de demande de CSQ

Aucune garantie de résultat n''a été donnée au client. La
décision relève du ministère compétent.');
insert into public.documents (firm_id, client_id, matter_id, legacy_id, name, type, category, uploaded_by, date, expiration, source, status, client_name, file_size, sha256, storage_path, content)
values ((select id from _firm), (select id from public.clients where firm_id = (select id from _firm) and legacy_id = 'c-3'), (select id from public.matters where firm_id = (select id from _firm) and reference = '#DOS-35696'), 'doc-106', 'Formulaire_IMM5476_Recrutement_Infirmieres.pdf', 'Formulaire Officiel IRCC', 'ircc_form', 'Sophie Tremblay (Staff)', '2026-07-30', '2027-07-30', 'Générateur Formulaire', 'valid', 'Santé Québec Express', '2.1 MB', 'd4735e3a265e16eee03f59718b9b5d03019c07d8b6c51f90da3a666eec13ab35', 'firms/firm-boreale/forms/Formulaire_IMM5476_Recrutement_Infirmieres.pdf', 'IMM 5476 — RECOURS AUX SERVICES D''UN REPRÉSENTANT
USE OF A REPRESENTATIVE
Immigration, Réfugiés et Citoyenneté Canada (IRCC)

SECTION A — RENSEIGNEMENTS SUR LE DEMANDEUR
   Organisation .......... Santé Québec Express
   Dossier cabinet ....... #DOS-35696
   N° de client IRCC ..... 1122-3344
   Objet ................. EIMT — recrutement d''infirmières
                           diplômées à l''international

SECTION B — NOMINATION D''UN REPRÉSENTANT
   Nom ................... DIARRA, Adama
   Type .................. Représentant rémunéré
   Organisme de régie .... Collège des consultants en
                           immigration et en citoyenneté (CICC)
   N° de membre .......... R-514982
   Cabinet ............... Cabinet Immigration Boréale Inc.
   Courriel .............. adama.diarra@boreale-immigration.ca

SECTION C — CONSENTEMENT À LA DIVULGATION
   J''autorise IRCC à divulguer les renseignements de mon
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
À joindre au dossier avant tout envoi à IRCC.');
insert into public.documents (firm_id, client_id, matter_id, legacy_id, name, type, category, uploaded_by, date, expiration, source, status, client_name, file_size, sha256, storage_path, content)
values ((select id from _firm), (select id from public.clients where firm_id = (select id from _firm) and legacy_id = 'c-1'), (select id from public.matters where firm_id = (select id from _firm) and reference = '#DOS-35695'), 'doc-107', 'Ancien_Diplome_Master_Archived.pdf', 'Diplôme Ancien', 'client_upload', 'M. Diarra (Client)', '2025-01-10', 'N/A', 'Portail Client', 'archived', 'M. Adama Diarra', '4.5 MB', 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0', 'firms/firm-boreale/archive/Ancien_Diplome_Master_Archived.pdf', 'DIPLÔME — DOCUMENT ARCHIVÉ

Université de Bamako — Faculté des Sciences et Techniques
Diplôme de Master en génie industriel

Titulaire ................ DIARRA, Adama
Promotion ................ 2013
Mention .................. Bien
N° de parchemin .......... ML-2013-04417

--- ÉVALUATION DES DIPLÔMES D''ÉTUDES (EDE) ---
Organisme ................ World Education Services (WES)
N° de référence .......... WES-2019-772104
Équivalence canadienne ... Baccalauréat (programme de 4 ans)
Date du rapport .......... 2019-03-12
Statut du rapport ........ EXPIRÉ depuis le 2024-03-12

--- MOTIF D''ARCHIVAGE ---
Remplacé par la maîtrise québécoise obtenue à l''Université
Laval en 2024, désormais le diplôme retenu pour l''analyse
d''admissibilité (voir Note_Consultation_Eligibilite_PEQ.pdf).

Conservé au dossier au titre de la politique de rétention de
sept ans du cabinet. Ne pas utiliser au soutien d''une demande
sans obtenir au préalable un nouveau rapport EDE.');

-- --- Rendez-vous (5) ------------------------------------------
insert into public.calendar_events (firm_id, matter_id, legacy_id, title, client_name, client_initials, avatar_bg, program, type, platform, link, date, day_name, time, hour, status, trust_balance, notes)
values ((select id from _firm), (select id from public.matters where firm_id = (select id from _firm) and reference = '#DOS-35697'), 'evt-1', 'Consultation Initiale - Évaluation du Profil IRCC', 'Dr. S. Rahman', 'SR', 'bg-blue-600', 'Résidence Permanente (EE)', 'visio', 'calendly', 'https://calendly.com/me-adama-diarra/consultation-30min', '2026-07-31', '31 juil. 2026', '10 h 00 – 11 h 00 (HE)', 10, 'ready', '$3,500 CAD', 'Revue du test TEF Canada C1 et vérification de la continuité des 10 dernières années.');
insert into public.calendar_events (firm_id, matter_id, legacy_id, title, client_name, client_initials, avatar_bg, program, type, platform, link, date, day_name, time, hour, status, trust_balance, notes)
values ((select id from _firm), (select id from public.matters where firm_id = (select id from _firm) and reference = '#DOS-35698'), 'evt-2', 'Échéance Butoir IRCC : Soumission EIMT Volet Talent', 'Les Industries Nordiques', 'LN', 'bg-amber-600', 'Permis de travail / EIMT', 'deadline', null, null, '2026-07-31', '31 juil. 2026', '12 h 00 – 13 h 00 (HE)', 12, 'pending_doc', '$18,500 CAD', 'Alerte de conformité EIMT : pièces justificatives d''affichage d''emploi à valider avant 17h00.');
insert into public.calendar_events (firm_id, matter_id, legacy_id, title, client_name, client_initials, avatar_bg, program, type, platform, link, date, day_name, time, hour, status, trust_balance, notes)
values ((select id from _firm), (select id from public.matters where firm_id = (select id from _firm) and reference = '#DOS-35695'), 'evt-3', 'Rencontre de Mandat & Signature Électronique IMM 5476', 'K. Tremblay', 'KT', 'bg-emerald-600', 'Parrainage d''Époux / Conjoint de fait', 'visio', 'calendly', 'https://calendly.com/me-adama-diarra/consultation-30min', '2026-07-31', '31 juil. 2026', '14 h 00 – 15 h 00 (HE)', 14, 'ready', '$5,000 CAD', 'Signature certifiée de l''entente d''honoraires et ouverture de compte fidéicommis.');
insert into public.calendar_events (firm_id, matter_id, legacy_id, title, client_name, client_initials, avatar_bg, program, type, platform, link, date, day_name, time, hour, status, trust_balance, notes)
values ((select id from _firm), (select id from public.matters where firm_id = (select id from _firm) and reference = '#DOS-35696'), 'evt-4', 'Bilan mensuel Recrutement International B2B', 'TechCorp Canada Inc.', 'TC', 'bg-indigo-600', 'Exemption EIMT / Mobilité Francophone', 'visio', 'zoom', 'https://zoom.us/j/987654321', '2026-08-03', '3 août 2026', '11 h 00 – 12 h 00 (HE)', 11, 'ready', '$12,000 CAD', 'Point d''étape sur le dossier des 8 infirmières recrutées en France.');
insert into public.calendar_events (firm_id, matter_id, legacy_id, title, client_name, client_initials, avatar_bg, program, type, platform, link, date, day_name, time, hour, status, trust_balance, notes)
values ((select id from _firm), (select id from public.matters where firm_id = (select id from _firm) and reference = '#DOS-35700'), 'evt-5', 'Revue de Dossier & Explication Formulaire IMM 5669', 'Mme. Mariam Dubois', 'MD', 'bg-purple-600', 'Permis Études / CAQ', 'visio', 'google_meet', 'https://meet.google.com/xyz-uvwx-rst', '2026-08-05', '5 août 2026', '14 h 00 – 15 h 00 (HE)', 14, 'ready', '$2,800 CAD', 'Explication de la checklist des pièces pour le CAQ et lettre de motivation.');

-- --- Journal d'audit documentaire (8) -------------------
insert into public.audit_logs (firm_id, legacy_id, occurred_at, actor_member_id, actor_email, actor_name, actor_role, action, entity_type, entity_id, matter_id, summary, ip_address, user_agent, prev_hash, row_hash)
values ((select id from _firm), 'daud-001', '2026-08-01T14:32:11Z', 'mem-01', 'adama.diarra@boreale-immigration.ca', 'Me Adama Diarra', 'rcic', 'create', 'document', 'doc-101', null, 'Téléversement sécurisé — Passeport_Officiel_M_Diarra.pdf (3.2 MB) dans le coffre-fort chiffré AES-256', '192.168.1.42', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', '0000000000000000000000000000000000000000000000000000000000000000', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
insert into public.audit_logs (firm_id, legacy_id, occurred_at, actor_member_id, actor_email, actor_name, actor_role, action, entity_type, entity_id, matter_id, summary, ip_address, user_agent, prev_hash, row_hash)
values ((select id from _firm), 'daud-002', '2026-08-01T13:15:44Z', 'mem-02', 'sophie.tremblay@boreale-immigration.ca', 'Sophie Tremblay', 'staff', 'create', 'document', 'doc-102', null, 'Téléversement — Attestation_TEF_Canada_Dr_Rahman.pdf (1.8 MB) rattaché au dossier #DOS-35697', '192.168.1.55', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284ddd200126d9069');
insert into public.audit_logs (firm_id, legacy_id, occurred_at, actor_member_id, actor_email, actor_name, actor_role, action, entity_type, entity_id, matter_id, summary, ip_address, user_agent, prev_hash, row_hash)
values ((select id from _firm), 'daud-003', '2026-08-01T11:45:20Z', 'mem-01', 'adama.diarra@boreale-immigration.ca', 'Me Adama Diarra', 'rcic', 'download', 'document', 'doc-103', null, 'Téléchargement sécurisé — Entente_de_Service_CICC_SA-2026-000142.pdf par le titulaire RCIC #R-514982', '192.168.1.42', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284ddd200126d9069', '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08');
insert into public.audit_logs (firm_id, legacy_id, occurred_at, actor_member_id, actor_email, actor_name, actor_role, action, entity_type, entity_id, matter_id, summary, ip_address, user_agent, prev_hash, row_hash)
values ((select id from _firm), 'daud-004', '2026-07-31T16:10:30Z', 'mem-03', 'julie.roy@boreale-immigration.ca', 'Julie Roy', 'risia', 'view', 'document', 'doc-106', null, 'Consultation en lecture seule — Formulaire_IMM5476_Recrutement_Infirmieres.pdf (vérification avant soumission IRCC)', '192.168.1.60', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08', 'd4735e3a265e16eee03f59718b9b5d03019c07d8b6c51f90da3a666eec13ab35');
insert into public.audit_logs (firm_id, legacy_id, occurred_at, actor_member_id, actor_email, actor_name, actor_role, action, entity_type, entity_id, matter_id, summary, ip_address, user_agent, prev_hash, row_hash)
values ((select id from _firm), 'daud-005', '2026-07-31T10:22:15Z', 'mem-01', 'adama.diarra@boreale-immigration.ca', 'Me Adama Diarra', 'owner', 'update', 'document', 'doc-107', null, 'Archivage réglementaire — Ancien_Diplome_Master_Archived.pdf déplacé dans les archives conformément à la politique de rétention 6 ans', '192.168.1.42', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'd4735e3a265e16eee03f59718b9b5d03019c07d8b6c51f90da3a666eec13ab35', 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0');
insert into public.audit_logs (firm_id, legacy_id, occurred_at, actor_member_id, actor_email, actor_name, actor_role, action, entity_type, entity_id, matter_id, summary, ip_address, user_agent, prev_hash, row_hash)
values ((select id from _firm), 'daud-006', '2026-07-30T09:05:42Z', 'mem-01', 'adama.diarra@boreale-immigration.ca', 'Me Adama Diarra', 'rcic', 'export', 'document', 'export-batch-001', null, 'Export Audit CICC 1-Clic — Manifeste SHA-256 généré pour 7 documents (Checksum global : 4f2e8a...)', '192.168.1.42', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0', '4f2e8a1b3c5d7e9f0a2b4c6d8e0f1a3b5c7d9e1f2a4b6c8d0e2f4a6b8c0d2e4f');
insert into public.audit_logs (firm_id, legacy_id, occurred_at, actor_member_id, actor_email, actor_name, actor_role, action, entity_type, entity_id, matter_id, summary, ip_address, user_agent, prev_hash, row_hash)
values ((select id from _firm), 'daud-007', '2026-07-29T15:48:10Z', 'mem-02', 'sophie.tremblay@boreale-immigration.ca', 'Sophie Tremblay', 'staff', 'create', 'document', 'doc-105', null, 'Téléversement — Note_Consultation_Eligibilite_PEQ.pdf (1.2 MB) par le consultant pour le dossier #DOS-35695', '192.168.1.55', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', '4f2e8a1b3c5d7e9f0a2b4c6d8e0f1a3b5c7d9e1f2a4b6c8d0e2f4a6b8c0d2e4f', 'fcde2b2edba56bf408601fb721fe9b5c338d10ee429c7047b37b12d62e157790');
insert into public.audit_logs (firm_id, legacy_id, occurred_at, actor_member_id, actor_email, actor_name, actor_role, action, entity_type, entity_id, matter_id, summary, ip_address, user_agent, prev_hash, row_hash)
values ((select id from _firm), 'daud-008', '2026-07-28T11:30:00Z', 'mem-01', 'adama.diarra@boreale-immigration.ca', 'Me Adama Diarra', 'rcic', 'create', 'document', 'doc-104', null, 'Téléversement automatique — Facture_Officielle_FAC-202601.pdf (420 KB) générée par le module de facturation', '192.168.1.42', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'fcde2b2edba56bf408601fb721fe9b5c338d10ee429c7047b37b12d62e157790', '2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae');

commit;
