-- ============================================================================
-- Refonte ciblée des modèles de consultation initiale (Standard et Pro Bono)
-- Structurée fidèlement d'après le modèle officiel fourni (Articles 1 à 13)
-- ============================================================================
--
-- Conforme au Code de déontologie des titulaires de permis du CICC / CCIC
-- (DORS/2022-128), Règlement sur le contrat de service et Guide d'élaboration.
--
-- NE TOUCHE EN AUCUN CAS aux modèles de mandat de service :
--   - sys_services (Entente de services professionnels)
--   - sys_services_probono (Entente de services professionnels — pro bono)
-- ============================================================================

begin;

-- 1. Nettoyer les anciens articles UNIQUEMENT pour les modèles de consultation
delete from public.agreement_template_articles
where template_id in (
  select id from public.agreement_templates
  where firm_id is null and code in ('sys_consultation', 'sys_consultation_probono')
);

-- 2. Mettre à jour les métadonnées des modèles de consultation
update public.agreement_templates
set title_fr = 'Contrat de consultation initiale en immigration',
    title_en = 'Initial Immigration Consultation Agreement',
    description_fr = 'Conformément au Code de déontologie CCIC / Règlement sur le contrat de service / Guide d’élaboration.',
    description_en = 'In accordance with CICC Code of Conduct / Service Agreement Regulations / Development Guide.',
    version = '2.0',
    updated_at = now()
where firm_id is null and code = 'sys_consultation';

update public.agreement_templates
set title_fr = 'Contrat de consultation initiale en immigration — Pro Bono',
    title_en = 'Initial Immigration Consultation Agreement — Pro Bono',
    description_fr = 'Consultation initiale offerte pro bono (gratuite), conforme au Code de déontologie CCIC.',
    description_en = 'Initial consultation provided pro bono (free of charge), compliant with CICC regulations.',
    version = '2.0',
    updated_at = now()
where firm_id is null and code = 'sys_consultation_probono';

-- 3. Insérer les articles communs (1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13) pour sys_consultation et sys_consultation_probono
insert into public.agreement_template_articles
  (firm_id, template_id, position, code, title_fr, title_en, body_fr, body_en, level, optional)
select null, t.id, a.position, a.code, a.title_fr, a.title_en, a.body_fr, a.body_en, a.level, a.optional
from public.agreement_templates t
cross join (values
  (10, 'art1_parties', 'ARTICLE 1 — IDENTIFICATION DES PARTIES', 'ARTICLE 1 — IDENTIFICATION OF PARTIES',
   '1.1 LE CONSULTANT EN IMMIGRATION RÉGLEMENTÉ / The Regulated Immigration Consultant
Cabinet : {{nom_cabinet}}
Consultant réglementé : {{nom_consultant}}
N° de permis CRIC : {{permis_consultant}}
Organisme de réglementation : CCIC / CICC — www.college-ic.ca
Adresse : {{adresse_cabinet}}
Téléphone : {{telephone_cabinet}}
Courriel : {{courriel_cabinet}}
Site Web : {{site_cabinet}}

1.2 LE/LA CLIENT(E) / The Client
Nom complet / Full Name : {{nom_complet_client}}
Date de naissance / DOB : {{date_naissance_client}}
Nationalité / Nationality : {{nationalite_client}}
Statut actuel au Canada / Current Status : {{statut_canada_client}}
Adresse complète / Full Address : {{adresse_client}}
Téléphone / Phone : {{telephone_client}}
Courriel / Email : {{courriel_client}}
N° passeport / Passport No. : {{passeport_client}}
Langue préférée / Preferred Language : {{langue_preferee_client}}

Ci-après collectivement désignés les « Parties ». / Hereinafter collectively referred to as the "Parties".',
   '1.1 THE REGULATED IMMIGRATION CONSULTANT:
Firm: {{nom_cabinet}}
Licensed Consultant: {{nom_consultant}}
RCIC Licence No.: {{permis_consultant}}
Regulatory Body: CICC / CCIC — www.college-ic.ca
Address: {{adresse_cabinet}}
Phone: {{telephone_cabinet}}
Email: {{courriel_cabinet}}
Website: {{site_cabinet}}

1.2 THE CLIENT:
Full Name: {{nom_complet_client}}
Date of Birth: {{date_naissance_client}}
Nationality: {{nationalite_client}}
Current Status in Canada: {{statut_canada_client}}
Full Address: {{adresse_client}}
Phone: {{telephone_client}}
Email: {{courriel_client}}
Passport No.: {{passeport_client}}
Preferred Language: {{langue_preferee_client}}

Hereinafter collectively referred to as the "Parties".',
   'structural', false),

  (20, 'art2_portee', 'ARTICLE 2 — NATURE ET PORTÉE DU SERVICE', 'ARTICLE 2 — NATURE AND SCOPE OF SERVICE',
   '2.1 Le présent contrat porte exclusivement sur une CONSULTATION INITIALE en immigration canadienne, telle que définie dans le Guide d’élaboration du contrat de service du CCIC. Ce contrat ne constitue pas un mandat de représentation complet.

2.2 La consultation initiale comprend les services suivants :
☑ SERVICE INCLUS DANS LA CONSULTATION INITIALE :
• Évaluation de l’admissibilité générale au Canada / Assessment of general Canadian immigration eligibility : Examen du profil et des options disponibles selon la situation du/de la client(e)
• Examen des voies d’immigration applicables / Review of applicable immigration pathways : Entrée express, parrainage, permis de travail/étude, protection des réfugiés, etc.
• Analyse des documents existants / Review of existing documents : Vérification préliminaire des documents fournis lors de la consultation
• Information générale sur les procédures IRCC / General IRCC procedure overview : Délais de traitement, exigences générales, frais gouvernementaux estimatifs
• Conseils sur les prochaines étapes à suivre / Advice on next steps : Recommandations non contraignantes sur la marche à suivre
• Réponses aux questions spécifiques du/de la client(e) / Answers to client''s specific questions

2.3 LIMITES IMPORTANTES / Important Limitations :
La présente consultation initiale NE COMPREND PAS les services suivants, lesquels font l’objet d’un contrat de service distinct :
• La préparation ou le dépôt de toute demande auprès d’IRCC ou de la CISR ;
• La représentation du/de la client(e) devant les autorités gouvernementales ;
• L’examen ou la rédaction de documents juridiques ou formulaires officiels ;
• Le suivi d’un dossier d’immigration en cours ;
• Tout conseil juridique — le consultant n’est pas un avocat.',
   '2.1 This agreement pertains exclusively to an INITIAL CONSULTATION in Canadian immigration, as defined in the CICC Service Agreement Development Guide. This agreement does not constitute a full representation retainer.

2.2 The initial consultation includes the following services:
☑ SERVICE INCLUDED IN THE INITIAL CONSULTATION:
• Assessment of general Canadian immigration eligibility: Review of profile and available options according to client''s situation;
• Review of applicable immigration pathways: Express Entry, family sponsorship, work/study permits, refugee protection, etc.;
• Review of existing documents: Preliminary review of documents provided during consultation;
• General IRCC procedure overview: Processing times, general requirements, estimated government fees;
• Advice on next steps: Non-binding recommendations on the way forward;
• Answers to client''s specific questions.

2.3 IMPORTANT LIMITATIONS:
This initial consultation DOES NOT INCLUDE the following services, which are subject to a separate service agreement:
• The preparation or submission of any application to IRCC or the IRB;
• The representation of the client before government authorities;
• Review or drafting of legal documents or official forms;
• Follow-up of a pending immigration file;
• Any legal advice — the consultant is not an attorney.',
   'structural', false),

  (30, 'art3_duree_format', 'ARTICLE 3 — FORMAT, DATE ET DURÉE DE LA CONSULTATION', 'ARTICLE 3 — FORMAT, DATE AND DURATION OF CONSULTATION',
   '3.1 Format de la consultation / Consultation Format :
• En personne / In-Person — {{adresse_cabinet}}
• Par vidéoconférence / Video Conference (Zoom, Teams, Google Meet)
• Par téléphone / By Telephone
• Par courriel / By Email (échange écrit / written exchange)

3.2 Détails de la consultation / Consultation Details :
Date et heure / Date & Time : {{date_consultation}} {{heure_consultation}}
Durée prévue / Expected Duration : {{duree_consultation}}
Plateforme (si virtuel) / Platform (if virtual) : {{mode_consultation}}
Lien de réunion / Meeting Link : -

3.3 La durée de la consultation est limitée au temps indiqué ci-dessus. Toute prolongation significative peut faire l’objet d’une facturation additionnelle, avec l’accord préalable écrit du/de la client(e), conformément au Guide d’élaboration du CCIC.',
   '3.1 Consultation Format:
• In-Person — {{adresse_cabinet}}
• By Video Conference (Zoom, Teams, Google Meet)
• By Telephone
• By Email (written exchange)

3.2 Consultation Details:
Date & Time: {{date_consultation}} {{heure_consultation}}
Expected Duration: {{duree_consultation}}
Platform (if virtual): {{mode_consultation}}
Meeting Link: -

3.3 The consultation is limited to the scheduled duration indicated above. Any significant extension may be subject to additional billing, with the client''s prior written agreement, in accordance with CICC guidelines.',
   'structural', false),

  (50, 'art5_obligations_consultant', 'ARTICLE 5 — OBLIGATIONS DU CONSULTANT RÉGLEMENTÉ', 'ARTICLE 5 — OBLIGATIONS OF THE REGULATED CONSULTANT',
   'Conformément au Code de déontologie du CCIC (notamment les articles 4, 8, 9, 12, 13 et 28), le consultant s’engage à :
• Agir avec compétence, honnêteté, intégrité et dans le meilleur intérêt du/de la client(e) ;
• Communiquer les informations de manière claire et compréhensible, en tenant compte des barrières linguistiques ;
• Maintenir la confidentialité de tous les renseignements et documents obtenus lors de la consultation ;
• Informer le/la client(e) de toutes ses options d’immigration de façon complète et impartiale ;
• Ne pas fournir de fausses informations ou garantir un résultat d’immigration ;
• Aviser immédiatement le/la client(e) de tout conflit d’intérêts réel, potentiel ou apparent ;
• Remettre au/à la client(e) un exemplaire signé du présent contrat avant ou au début de la consultation ;
• Conserver un dossier de la consultation pendant au moins six (6) ans conformément aux exigences du CCIC ;
• Respecter les obligations en matière de protection des données personnelles (LPRPDE/Loi 25) ;
• Ne pas exercer de pression ni solliciter de manière abusive le/la client(e) pour des services supplémentaires.',
   'In accordance with the CICC Code of Professional Conduct (including sections 4, 8, 9, 12, 13, and 28), the consultant undertakes to:
• Act with competence, honesty, integrity, and in the best interests of the client;
• Communicate information clearly and comprehensibly, considering language barriers;
• Maintain confidentiality of all information and documents obtained during the consultation;
• Inform the client of all immigration options fully and impartially;
• Refrain from providing false information or guaranteeing any immigration outcome;
• Immediately notify the client of any actual, potential, or apparent conflict of interest;
• Provide the client with a signed copy of this agreement prior to or at the start of consultation;
• Maintain a file of the consultation for at least six (6) years pursuant to CICC requirements;
• Comply with personal data protection obligations (PIPEDA/Law 25);
• Refrain from applying pressure or abusively soliciting the client for additional services.',
   'structural', false),

  (60, 'art6_obligations_client', 'ARTICLE 6 — OBLIGATIONS DU/DE LA CLIENT(E)', 'ARTICLE 6 — OBLIGATIONS OF THE CLIENT',
   'Le/la client(e) s’engage à :
• Fournir des informations exactes, complètes et véridiques avant et pendant la consultation ;
• Informer le consultant de tout changement de situation susceptible d’affecter les conseils donnés ;
• Poser ses questions en temps opportun pour permettre une consultation efficace ;
• Honorer le rendez-vous ou aviser le cabinet au moins 48 heures à l’avance en cas d’empêchement ;
• Comprendre que les conseils fournis lors de la consultation initiale sont basés sur les informations communiquées et peuvent être modifiés si des éléments supplémentaires sont divulgués ultérieurement ;
• Reconnaître que la consultation initiale ne crée pas un mandat de représentation et qu’un contrat de service distinct devra être signé pour toute demande d’immigration.',
   'The client undertakes to:
• Provide accurate, complete, and truthful information before and during the consultation;
• Inform the consultant of any change in situation likely to affect the advice given;
• Ask questions in a timely manner to facilitate an effective consultation;
• Honor the appointment or notify the firm at least 48 hours in advance in case of impediment;
• Understand that advice provided during the initial consultation is based on disclosed facts and may vary if further information is shared;
• Acknowledge that the initial consultation does not create a representation retainer and that a separate service agreement must be executed for any immigration application.',
   'structural', false),

  (70, 'art7_confidentialite', 'ARTICLE 7 — CONFIDENTIALITÉ ET PROTECTION DES RENSEIGNEMENTS PERSONNELS', 'ARTICLE 7 — CONFIDENTIALITY AND PRIVACY PROTECTION',
   '7.1 Conformément à la Loi sur la protection des renseignements personnels et les documents électroniques (LPRPDE) et à la Loi 25 du Québec, le Cabinet traite tous les renseignements personnels du/de la client(e) de manière strictement confidentielle.
7.2 Les renseignements collectés lors de la consultation ne seront utilisés qu’aux fins de la prestation du service convenu et ne seront divulgués à aucun tiers sans le consentement écrit préalable du/de la client(e), sauf obligation légale.
7.3 Le/la client(e) consent à la collecte et au traitement de ses données personnelles aux fins de la présente consultation. Ce consentement est révocable en tout temps, sous réserve des obligations légales applicables.',
   '7.1 In accordance with PIPEDA and Quebec Law 25, the Firm treats all personal information strictly confidentially.
7.2 Information collected during consultation will only be used for delivering the agreed service and will not be disclosed to any third party without prior written consent, except where required by law.
7.3 The client consents to the collection and processing of personal data for this consultation. This consent may be revoked at any time, subject to applicable legal obligations.',
   'structural', false),

  (80, 'art8_avertissements', 'ARTICLE 8 — AVERTISSEMENTS IMPORTANTS ET LIMITATIONS', 'ARTICLE 8 — IMPORTANT WARNINGS AND LIMITATIONS',
   '⚠ AVERTISSEMENTS / WARNINGS :
• Le consultant réglementé en immigration canadienne N’EST PAS un avocat ou notaire et ne peut pas fournir de conseils juridiques. Pour toute question juridique, consultez un avocat spécialisé en droit de l’immigration.
• Aucun résultat d’immigration ne peut être garanti. Les décisions finales appartiennent exclusivement aux autorités gouvernementales (IRCC, CISR, ASFC).
• Les informations et conseils fournis lors de la consultation initiale sont valables au moment de la consultation. Les lois et politiques d’immigration changent fréquemment et peuvent affecter votre dossier.
• La consultation initiale ne crée pas de relation avocat-client et les informations partagées ne bénéficient pas du secret professionnel de l’avocat.
• La délégation illégale de pouvoirs à un tiers non autorisé est une infraction à la Loi sur l’immigration et la protection des réfugiés (LIPR).',
   '⚠ WARNINGS:
• The Regulated Canadian Immigration Consultant IS NOT a lawyer or notary and cannot provide legal advice. For any legal matters, consult a specialized immigration lawyer.
• No immigration result can be guaranteed. Final decisions rest exclusively with government authorities (IRCC, IRB, CBSA).
• Information and advice given during the initial consultation are valid as of the date of consultation. Immigration laws change frequently.
• The initial consultation does not create a solicitor-client relationship.
• Unauthorized delegation of authority is an offence under the Immigration and Refugee Protection Act (IRPA).',
   'structural', false),

  (90, 'art9_conflit_interets', 'ARTICLE 9 — DÉCLARATION DE CONFLIT D’INTÉRÊTS', 'ARTICLE 9 — DECLARATION OF CONFLICT OF INTEREST',
   '9.1 À la date de signature du présent contrat, le consultant déclare n’avoir aucun conflit d’intérêts réel, potentiel ou apparent dans ce dossier.
9.2 Le cas échéant, le consultant informera immédiatement le/la client(e) de tout conflit survenant après la signature du présent contrat.
☑ Aucun conflit d’intérêts identifié / No conflict of interest identified',
   '9.1 As of the date of signing, the consultant declares having no actual, potential, or apparent conflict of interest in this file.
9.2 Where applicable, the consultant will promptly inform the client of any conflict arising after the execution of this agreement.
☑ No conflict of interest identified',
   'structural', false),

  (100, 'art10_plaintes', 'ARTICLE 10 — PROCÉDURE DE PLAINTES ET RECOURS', 'ARTICLE 10 — COMPLAINTS AND DISPUTE RESOLUTION',
   '10.1 Toute plainte concernant les services du Cabinet doit être soumise par écrit à : {{courriel_cabinet}}. Le Cabinet s’engage à accuser réception dans les 5 jours ouvrables et à répondre dans les 30 jours.
10.2 Si la plainte n’est pas résolue à la satisfaction du/de la client(e), ce dernier/cette dernière peut soumettre une plainte formelle auprès du CCIC (Collège des consultants en immigration et en citoyenneté) :
• Site Web : www.college-ic.ca
• Formulaire de plainte disponible sur le portail du CCIC
• Téléphone : 1-877-836-7543',
   '10.1 Any complaint regarding the Firm''s services must be submitted in writing to: {{courriel_cabinet}}. The Firm commits to acknowledge receipt within 5 business days and reply within 30 days.
10.2 If the complaint is not resolved to the client''s satisfaction, they may file a formal complaint with the CICC (College of Immigration and Citizenship Consultants):
• Website: www.college-ic.ca
• Complaint form available on the CICC portal
• Phone: 1-877-836-7543',
   'structural', false),

  (110, 'art11_notes', 'ARTICLE 11 — NOTES ET RÉSUMÉ DE CONSULTATION', 'ARTICLE 11 — CONSULTATION NOTES AND SUMMARY',
   'Conformément à l’article 18 du Règlement sur le contrat de service, le consultant est tenu de tenir des notes de consultation. Le résumé suivant sera complété à la fin de la consultation :
Situation d’immigration actuelle : _______________________________________________________
Objectif principal du/de la client(e) : _______________________________________________________
Voie(s) d’immigration discutée(s) : _______________________________________________________
Points clés abordés : _______________________________________________________
Documents examinés : _______________________________________________________
Recommandations formulées : _______________________________________________________
Prochaines étapes suggérées : _______________________________________________________
Suivi requis? / Follow-up required? ☐ Oui/Yes ☐ Non/No
Date de suivi proposée : _______________________________________________________
Références fournies (organismes, avocats, etc.) : _______________________________________________________

{{notes_consultation}}',
   'Pursuant to section 18 of the Service Agreement Regulations, the consultant is required to maintain consultation notes. The summary will be completed upon conclusion of the consultation:
Current immigration status: _______________________________________________________
Primary client objective: _______________________________________________________
Immigration pathway(s) discussed: _______________________________________________________
Key points addressed: _______________________________________________________
Documents reviewed: _______________________________________________________
Recommendations provided: _______________________________________________________
Suggested next steps: _______________________________________________________
Follow-up required? ☐ Yes ☐ No
Proposed follow-up date: _______________________________________________________
Referrals provided: _______________________________________________________

{{notes_consultation}}',
   'free', false),

  (120, 'art12_dispositions', 'ARTICLE 12 — DISPOSITIONS GÉNÉRALES', 'ARTICLE 12 — GENERAL PROVISIONS',
   '1. Le présent contrat est régi par les lois de la province de Québec et les lois fédérales canadiennes applicables.
2. Toute modification au présent contrat doit faire l’objet d’un avenant écrit signé par les deux Parties.
3. Si une disposition du présent contrat est déclarée invalide ou inapplicable, les autres dispositions demeurent pleinement en vigueur.
4. Le présent contrat constitue l’intégralité de l’accord entre les Parties concernant la consultation initiale et remplace tout accord verbal antérieur.
5. En cas de divergence entre la version française et la version anglaise, la version française prévaut.',
   '1. This agreement is governed by the laws of the Province of Quebec and applicable Canadian federal laws.
2. Any amendment to this agreement must be in writing and signed by both Parties.
3. If any provision of this agreement is declared invalid, the remaining provisions remain in full force.
4. This agreement constitutes the entire understanding between the Parties regarding the initial consultation and supersedes all prior verbal understandings.
5. In case of discrepancy between language versions, the French version shall prevail.',
   'structural', false),

  (130, 'art13_consentement', 'ARTICLE 13 — CONSENTEMENT ÉCLAIRÉ ET ACCUSÉ DE RÉCEPTION', 'ARTICLE 13 — INFORMED CONSENT AND ACKNOWLEDGEMENT',
   'Le/la client(e) reconnaît expressément :
• Avoir lu et compris l’intégralité du présent contrat de consultation initiale ;
• Que ce contrat constitue un service de consultation limité, et NON un mandat de représentation complet ;
• Que la consultation initiale n’implique pas le dépôt de demandes d’immigration ;
• Que les honoraires convenus sont exigibles même si les conseils donnés ne correspondent pas à ses attentes ;
• Avoir eu l’opportunité de poser des questions avant de signer ;
• Avoir reçu une copie signée du présent contrat.',
   'The client expressly acknowledges:
• Having read and understood this entire initial consultation agreement;
• That this agreement constitutes a limited consultation service, and NOT a full representation retainer;
• That the initial consultation does not involve filing immigration applications;
• That agreed fees remain payable even if advice provided does not match expectations;
• Having had the opportunity to ask questions before signing;
• Having received a signed copy of this agreement.',
   'structural', false)
) as a(position, code, title_fr, title_en, body_fr, body_en, level, optional)
where t.firm_id is null
  and t.code in ('sys_consultation', 'sys_consultation_probono');

-- 4. Article 4 — Honoraires et conditions de paiement pour consultation standard (sys_consultation)
insert into public.agreement_template_articles
  (firm_id, template_id, position, code, title_fr, title_en, body_fr, body_en, level, optional)
select null, t.id, 40, 'art4_honoraires',
  'ARTICLE 4 — HONORAIRES ET CONDITIONS DE PAIEMENT', 'ARTICLE 4 — FEES AND PAYMENT TERMS',
  '4.1 Honoraires de consultation / Consultation Fees :
☑ TYPE DE CONSULTATION : Consultation initiale ({{duree_consultation}})
Honoraires (CAD) : {{honoraires}}
Taxes : {{taxes}}
TOTAL DÛ / TOTAL DUE : {{total}}

4.2 Les honoraires sont payables à la fin de la consultation, sauf entente contraire écrite.
4.3 Mode de paiement / Payment Method : Virement Interac, Chèque certifié, Carte de crédit / débit, Autre

4.4 Politique d’annulation / Cancellation Policy :
• Annulation 48 h ou plus à l’avance : aucuns frais / Cancellation 48h+ in advance: no charge
• Annulation entre 24 h et 48 h : 50 % des honoraires retenus / 24-48h notice: 50% retention
• Annulation moins de 24 h ou non-présentation : 100 % des honoraires retenus / Less than 24h or no-show: 100% retention
• Le Cabinet peut annuler sans frais en cas de force majeure ou de conflit d’intérêts / The Firm may cancel without charge in case of force majeure or conflict of interest',
  '4.1 Consultation Fees:
☑ TYPE OF CONSULTATION: Initial consultation ({{duree_consultation}})
Fees (CAD): {{honoraires}}
Taxes: {{taxes}}
TOTAL DUE: {{total}}

4.2 Fees are payable at the end of the consultation, unless otherwise agreed in writing.
4.3 Payment Method: Interac e-Transfer, Certified cheque, Credit / debit card, Other

4.4 Cancellation Policy:
• Cancellation 48h+ in advance: no charge
• Cancellation between 24h and 48h: 50% retention
• Cancellation less than 24h or no-show: 100% retention
• The Firm may cancel without charge in case of force majeure or conflict of interest',
  'structural', false
from public.agreement_templates t
where t.firm_id is null and t.code = 'sys_consultation';

-- 5. Article 4 — Clause Pro Bono pour consultation pro bono (sys_consultation_probono)
insert into public.agreement_template_articles
  (firm_id, template_id, position, code, title_fr, title_en, body_fr, body_en, level, optional)
select null, t.id, 40, 'art4_honoraires',
  'ARTICLE 4 — HONORAIRES ET CONDITIONS DE PAIEMENT (PRO BONO)', 'ARTICLE 4 — PRO BONO FEES AND PAYMENT TERMS',
  '4.1 Consultation initiale PRO BONO (gratuite / free of charge) : 0,00 $ CAD
TOTAL DÛ / TOTAL DUE : 0,00 $

4.2 La présente consultation est offerte à titre gracieux par le Cabinet dans le cadre de ses engagements d''accès à la justice et d''assistance pro bono.

4.3 Politique d’annulation : En cas d''empêchement, les Parties conviennent de s''aviser dans un délai raisonnable afin de reprogrammer la séance.',
  '4.1 Initial Consultation PRO BONO (free of charge): $0.00 CAD
TOTAL DUE: $0.00

4.2 This consultation is provided on a complimentary pro bono basis by the Firm.

4.3 Cancellation Policy: In case of impediment, the Parties agree to notify each other within reasonable notice to reschedule.',
  'structural', false
from public.agreement_templates t
where t.firm_id is null and t.code = 'sys_consultation_probono';

commit;
