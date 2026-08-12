-- ============================================================================
-- Les quatre modèles d'entente fournis avec le logiciel
-- ============================================================================
--
-- ⚠️ CE TEXTE EST UNE BASE DE RÉDACTION, PAS UN MODÈLE VALIDÉ.
--
-- Aucun de ces articles n'est un formulaire officiel du Collège. Le §1 du
-- brief demandait expressément de ne pas le prétendre — et le code actuel s'en
-- écartait déjà en annonçant « ententes de service RÉGLEMENTÉES CICC », ce que
-- cette migration ne reprend pas.
--
-- Trois articles appellent une relecture par un juriste avant de servir de
-- modèle du cabinet : fidéicommis, protection des renseignements personnels,
-- et absence de garantie de résultat. Ils sont marqués « structural » — non
-- pas parce qu'ils seraient validés, mais parce qu'en retirer un rendrait
-- l'entente incomplète pour un consultant réglementé.
--
-- LES VARIABLES PLUTÔT QUE DES NOMS. Le texte n'écrit ni « Adama Diarra » ni
-- « Diarra Global Visa » : il emploie {{nom_consultant}}, {{nom_cabinet}},
-- {{honoraires}}. Un modèle système sert TOUS les cabinets ; y inscrire un nom
-- le rendrait faux pour tous les autres.
--
-- CE QUI A ÉTÉ VÉRIFIÉ AVANT D'ÊTRE ÉCRIT, plutôt que supposé :
--
--   • L'hébergement. Le projet Supabase de l'application est en ca-central-1,
--     donc AU CANADA — constaté par l'API de gestion, pas déduit. La clause ne
--     promet donc pas un hébergement canadien « en général » : elle dit ce qui
--     est.
--   • La durée de conservation. Six ans après la fin du mandat, confirmé par
--     le cabinet. La compétence conformite-vie-privee-canada interdit de
--     décrire une pratique de conservation non confirmée — un chiffre inventé
--     aurait l'apparence d'une décision prise.
--   • Le responsable de la protection des renseignements personnels. La Loi 25
--     exige sa désignation ; à défaut de délégation écrite, c'est la personne
--     ayant la plus haute autorité. La clause emploie donc {{nom_consultant}}.
--
-- CE QUI RESTE À FAIRE HORS DE CE FICHIER, et que je signale sans le régler :
-- Stripe, Resend et Vercel traitent des renseignements personnels HORS du
-- Québec. L'article 17 de la Loi 25 exige une évaluation des facteurs relatifs
-- à la vie privée pour ces transferts. Ce n'est pas une clause de contrat,
-- c'est un document interne du cabinet.
-- ============================================================================

begin;

-- Idempotence : on repart des modèles système de ce lot plutôt que d'en
-- accumuler des versions successives à chaque application.
delete from public.agreement_templates
 where firm_id is null and code in ('sys_consultation', 'sys_consultation_probono',
                                    'sys_services', 'sys_services_probono');

insert into public.agreement_templates (firm_id, code, kind, title_fr, title_en, description_fr, description_en, version)
values
  (null, 'sys_consultation', 'consultation',
   'Entente de consultation initiale',
   'Initial consultation agreement',
   'Consultation d''évaluation ponctuelle, facturée au tarif du cabinet.',
   'One-time assessment consultation, billed at the firm''s rate.', '1.0'),
  (null, 'sys_consultation_probono', 'consultation_probono',
   'Entente de consultation initiale — pro bono',
   'Initial consultation agreement — pro bono',
   'Consultation d''évaluation fournie sans honoraires.',
   'Assessment consultation provided without fees.', '1.0'),
  (null, 'sys_services', 'services',
   'Entente de services professionnels en immigration',
   'Professional immigration services agreement',
   'Mandat de représentation devant les autorités canadiennes d''immigration.',
   'Mandate to represent before Canadian immigration authorities.', '1.0'),
  (null, 'sys_services_probono', 'services_probono',
   'Entente de services professionnels en immigration — pro bono',
   'Professional immigration services agreement — pro bono',
   'Mandat de représentation fourni sans honoraires.',
   'Representation mandate provided without fees.', '1.0');

-- ---------------------------------------------------------------------------
-- Les articles communs aux quatre modèles
-- ---------------------------------------------------------------------------
insert into public.agreement_template_articles
  (firm_id, template_id, position, code, title_fr, title_en, body_fr, body_en, level, optional)
select null, t.id, a.position, a.code, a.title_fr, a.title_en, a.body_fr, a.body_en, a.level, a.optional
from public.agreement_templates t
cross join (values
  (10, 'objet', 'Objet du mandat', 'Scope of the mandate',
   'La présente entente est conclue entre {{nom_cabinet}}, représenté par {{nom_consultant}}, consultant réglementé en immigration canadienne portant le permis n° {{permis_consultant}}, et {{nom_complet_client}}, demeurant au {{adresse_client}}.

Le mandat porte exclusivement sur les services décrits à l''article « Services inclus ». Aucune prestation qui n''y est pas mentionnée n''est couverte par la présente entente.',
   'This agreement is entered into between {{nom_cabinet}}, represented by {{nom_consultant}}, a regulated Canadian immigration consultant holding licence no. {{permis_consultant}}, and {{nom_complet_client}}, residing at {{adresse_client}}.

The mandate covers exclusively the services described under "Included services". Any service not mentioned there falls outside this agreement.',
   'structural', false),

  (60, 'obligations_client', 'Obligations du client', 'Client obligations',
   'Le client s''engage à fournir des renseignements exacts et complets, à transmettre les documents demandés dans les délais indiqués, et à informer sans délai le cabinet de tout changement à sa situation — notamment un changement d''adresse, d''état matrimonial, de composition familiale ou de statut au Canada.

Un renseignement inexact transmis aux autorités peut entraîner le refus de la demande, et dans certains cas une conclusion d''interdiction de territoire pour fausses déclarations. Cette conséquence relève du client.',
   'The client undertakes to provide accurate and complete information, to submit requested documents within the stated deadlines, and to promptly inform the firm of any change in circumstances — in particular a change of address, marital status, family composition or status in Canada.

Inaccurate information submitted to the authorities may result in refusal of the application, and in some cases a finding of inadmissibility for misrepresentation. This consequence rests with the client.',
   'free', false),

  (70, 'obligations_consultant', 'Obligations du consultant', 'Consultant obligations',
   'Le consultant s''engage à agir avec compétence, diligence et loyauté, à tenir le client informé de l''évolution de son dossier, à répondre à ses demandes dans un délai raisonnable, et à n''intervenir que dans les limites de son permis.

Le consultant informe le client de tout élément susceptible d''affecter l''issue de sa demande dès qu''il en a connaissance.',
   'The consultant undertakes to act with competence, diligence and loyalty, to keep the client informed of the progress of their file, to respond to their requests within a reasonable time, and to act only within the limits of their licence.

The consultant informs the client of any element likely to affect the outcome of their application as soon as they become aware of it.',
   'structural', false),

  (80, 'no_garantie', 'Absence de garantie de résultat', 'No guarantee of outcome',
   'La décision d''accueillir ou de refuser une demande appartient exclusivement aux autorités compétentes. Le consultant ne peut ni garantir un résultat, ni garantir un délai de traitement, ni influencer la décision rendue.

Les honoraires rémunèrent les services professionnels rendus. Ils ne sont pas conditionnels à l''issue de la demande et ne constituent pas un dépôt remboursable en cas de refus.',
   'The decision to grant or refuse an application rests exclusively with the competent authorities. The consultant can neither guarantee an outcome, nor guarantee a processing time, nor influence the decision rendered.

Fees compensate the professional services rendered. They are not contingent on the outcome of the application and do not constitute a deposit refundable upon refusal.',
   'structural', false),

  (90, 'communication', 'Communications', 'Communications',
   'Les communications se font par courriel à {{courriel_client}}, par téléphone au {{telephone_client}}, ou par le portail client sécurisé du cabinet.

Le client reconnaît que le courriel n''est pas un moyen de communication chiffré de bout en bout et accepte son usage pour les échanges courants. Les pièces sensibles transitent par le portail.',
   'Communications take place by email at {{courriel_client}}, by telephone at {{telephone_client}}, or through the firm''s secure client portal.

The client acknowledges that email is not an end-to-end encrypted channel and accepts its use for routine exchanges. Sensitive documents are transmitted through the portal.',
   'free', true),

  (100, 'confidentialite', 'Confidentialité', 'Confidentiality',
   'Le consultant est tenu au secret professionnel à l''égard de tout renseignement obtenu dans le cadre du mandat. Cette obligation survit à la fin de l''entente.

Le consultant ne divulgue aucun renseignement sans le consentement du client, sauf lorsque la loi l''y oblige ou l''y autorise expressément.',
   'The consultant is bound by professional secrecy with respect to any information obtained in the course of the mandate. This obligation survives the end of the agreement.

The consultant discloses no information without the client''s consent, except where required or expressly authorized by law.',
   'structural', false),

  (110, 'renseignements_personnels', 'Protection des renseignements personnels', 'Protection of personal information',
   'Le cabinet recueille les renseignements personnels nécessaires à l''exécution du mandat : identité, coordonnées, composition familiale, antécédents de voyage, situation professionnelle et scolaire, et tout document exigé par les autorités.

RESPONSABLE. {{nom_consultant}} est responsable de la protection des renseignements personnels au sein du cabinet. Toute demande d''accès, de rectification ou de retrait du consentement se fait à {{courriel_cabinet}}.

FINS. Ces renseignements servent exclusivement à préparer et à soutenir la demande d''immigration, à communiquer avec le client, et à satisfaire aux obligations de tenue de dossiers du consultant.

HÉBERGEMENT. Les dossiers sont hébergés au Canada. Certains prestataires du cabinet — traitement des paiements, envoi de courriels, hébergement applicatif — peuvent traiter des renseignements à l''extérieur du Québec ; le cabinet encadre ces traitements par contrat.

CONSERVATION. Les renseignements sont conservés six ans après la fin du mandat, puis détruits de façon sécuritaire.

DROITS. Le client peut consulter ses renseignements, les faire corriger, retirer son consentement, ou en demander la communication dans un format technologique structuré. Il peut adresser une plainte à la Commission d''accès à l''information du Québec ou au Commissariat à la protection de la vie privée du Canada.',
   'The firm collects the personal information necessary to carry out the mandate: identity, contact details, family composition, travel history, employment and educational background, and any document required by the authorities.

OFFICER. {{nom_consultant}} is responsible for the protection of personal information within the firm. Any request for access, correction or withdrawal of consent is made to {{courriel_cabinet}}.

PURPOSES. This information is used solely to prepare and support the immigration application, to communicate with the client, and to meet the consultant''s record-keeping obligations.

HOSTING. Files are hosted in Canada. Certain service providers — payment processing, email delivery, application hosting — may process information outside Quebec; the firm governs such processing by contract.

RETENTION. Information is retained for six years after the end of the mandate, then securely destroyed.

RIGHTS. The client may access their information, have it corrected, withdraw consent, or request it in a structured technological format. They may file a complaint with the Commission d''accès à l''information du Québec or the Office of the Privacy Commissioner of Canada.',
   'structural', false),

  (120, 'duree_resiliation', 'Durée et fin du mandat', 'Term and termination',
   'Le mandat prend effet à la signature et se termine à la décision finale des autorités sur la demande visée, ou à la résiliation par l''une des parties.

Le client peut mettre fin au mandat en tout temps, par écrit. Le consultant peut y mettre fin pour un motif sérieux — notamment la perte du lien de confiance, le défaut de collaboration, le défaut de paiement, ou une demande de poser un geste contraire à ses obligations professionnelles — en donnant un préavis écrit raisonnable.

À la fin du mandat, les honoraires correspondant aux services déjà rendus demeurent dus, et les sommes non gagnées détenues pour le compte du client lui sont remises.',
   'The mandate takes effect upon signature and ends upon the authorities'' final decision on the application concerned, or upon termination by either party.

The client may end the mandate at any time, in writing. The consultant may end it for serious cause — including loss of the relationship of trust, failure to cooperate, non-payment, or a request to act contrary to their professional obligations — upon reasonable written notice.

Upon termination, fees for services already rendered remain payable, and any unearned funds held on the client''s behalf are returned to them.',
   'structural', false),

  (130, 'plaintes', 'Recours et plaintes', 'Recourse and complaints',
   'Le client insatisfait est invité à en faire part au cabinet en premier lieu, afin que la situation puisse être examinée.

Il peut en tout temps déposer une plainte auprès du Collège des consultants en immigration et en citoyenneté, l''organisme qui encadre la profession, selon la procédure publiée par celui-ci.',
   'A dissatisfied client is invited to raise the matter with the firm first, so that the situation may be reviewed.

They may at any time file a complaint with the College of Immigration and Citizenship Consultants, the body that regulates the profession, in accordance with the procedure it publishes.',
   'structural', false),

  (140, 'modification', 'Modification de l''entente', 'Amendment',
   'Toute modification à la présente entente — portée du mandat, honoraires, échéancier, parties — doit faire l''objet d''un écrit signé par les deux parties.

Aucune modification verbale n''a d''effet.',
   'Any amendment to this agreement — scope of the mandate, fees, payment schedule, parties — must be made in writing and signed by both parties.

No verbal amendment has effect.',
   'free', false),

  (150, 'loi_applicable', 'Loi applicable', 'Governing law',
   'La présente entente est régie par les lois applicables dans la province où le cabinet exerce, et par les règles professionnelles du Collège des consultants en immigration et en citoyenneté.',
   'This agreement is governed by the laws applicable in the province where the firm practises, and by the professional rules of the College of Immigration and Citizenship Consultants.',
   'free', false)
) as a(position, code, title_fr, title_en, body_fr, body_en, level, optional)
where t.firm_id is null
  and t.code in ('sys_consultation', 'sys_consultation_probono', 'sys_services', 'sys_services_probono');

-- ---------------------------------------------------------------------------
-- Ce qui distingue une consultation d'un mandat de représentation
-- ---------------------------------------------------------------------------
insert into public.agreement_template_articles
  (firm_id, template_id, position, code, title_fr, title_en, body_fr, body_en, level, optional)
select null, t.id, 20, 'services',
  'Services inclus', 'Included services',
  'La consultation porte sur l''évaluation de l''admissibilité du client aux programmes d''immigration canadiens, l''examen des options qui s''offrent à lui, et les recommandations qui en découlent.

Elle ne comprend ni la préparation ni le dépôt d''une demande. Toute suite donnée fera l''objet d''une entente distincte.',
  'The consultation covers the assessment of the client''s eligibility for Canadian immigration programs, a review of the options available, and the resulting recommendations.

It includes neither the preparation nor the filing of an application. Any follow-up will be the subject of a separate agreement.',
  'free', false
from public.agreement_templates t
where t.firm_id is null and t.code in ('sys_consultation', 'sys_consultation_probono');

insert into public.agreement_template_articles
  (firm_id, template_id, position, code, title_fr, title_en, body_fr, body_en, level, optional)
select null, t.id, 20, 'services',
  'Services inclus', 'Included services',
  'Le cabinet prépare la demande visée, réunit et vérifie les pièces exigées, rédige les formulaires et les lettres d''accompagnement, dépose la demande auprès des autorités compétentes, assure le suivi du dossier, et répond aux demandes de renseignements des autorités jusqu''à la décision finale.

Sont exclus, sauf mention écrite contraire : la représentation devant un tribunal administratif ou judiciaire, la préparation d''une demande distincte pour un membre de la famille non nommé aux présentes, et les démarches liées à un refus antérieur non divulgué au moment de la signature.',
  'The firm prepares the application concerned, gathers and verifies the required documents, drafts the forms and cover letters, files the application with the competent authorities, follows up on the file, and responds to the authorities'' requests for information until the final decision.

Excluded, unless otherwise agreed in writing: representation before an administrative or judicial tribunal, preparation of a separate application for a family member not named herein, and steps related to a prior refusal not disclosed at the time of signature.',
  'free', false
from public.agreement_templates t
where t.firm_id is null and t.code in ('sys_services', 'sys_services_probono');

-- ---------------------------------------------------------------------------
-- Les honoraires — et le pro bono, qui n'est pas « zéro dollar »
-- ---------------------------------------------------------------------------
insert into public.agreement_template_articles
  (firm_id, template_id, position, code, title_fr, title_en, body_fr, body_en, level, optional)
select null, t.id, 30, 'honoraires',
  'Honoraires', 'Fees',
  'Les honoraires professionnels s''élèvent à {{honoraires}}, auxquels s''ajoutent les taxes applicables de {{taxes}}, pour un total de {{total}}.

Ce montant rémunère les services professionnels décrits aux présentes. Il ne comprend pas les frais exigés par les autorités — frais de demande, droits de résidence permanente, biométrie, examens médicaux, traductions, évaluations de diplômes — qui demeurent à la charge du client et sont payés directement aux organismes concernés.',
  'Professional fees amount to {{honoraires}}, plus applicable taxes of {{taxes}}, for a total of {{total}}.

This amount compensates the professional services described herein. It does not include fees charged by the authorities — application fees, right of permanent residence fees, biometrics, medical examinations, translations, credential assessments — which remain the client''s responsibility and are paid directly to the organizations concerned.',
  'free', false
from public.agreement_templates t
where t.firm_id is null and t.code in ('sys_consultation', 'sys_services');

insert into public.agreement_template_articles
  (firm_id, template_id, position, code, title_fr, title_en, body_fr, body_en, level, optional)
select null, t.id, 30, 'honoraires',
  'Nature pro bono du mandat', 'Pro bono nature of the mandate',
  'Le présent mandat est fourni PRO BONO. Aucun honoraire professionnel n''est exigé du client, ni maintenant ni à l''issue de la demande.

Cette gratuité ne réduit ni les obligations professionnelles du consultant, ni les droits du client : le mandat est exécuté avec la même compétence et la même diligence qu''un mandat rémunéré, et le client dispose des mêmes recours.

Demeurent à la charge du client les frais exigés par les autorités — frais de demande, droits de résidence permanente, biométrie, examens médicaux, traductions, évaluations de diplômes — qui sont payés directement aux organismes concernés et ne transitent pas par le cabinet.',
  'This mandate is provided PRO BONO. No professional fees are charged to the client, either now or upon the outcome of the application.

This gratuity reduces neither the consultant''s professional obligations nor the client''s rights: the mandate is carried out with the same competence and diligence as a paid mandate, and the client has the same recourse.

Fees charged by the authorities remain the client''s responsibility — application fees, right of permanent residence fees, biometrics, medical examinations, translations, credential assessments — paid directly to the organizations concerned and not passing through the firm.',
  'structural', false
from public.agreement_templates t
where t.firm_id is null and t.code in ('sys_consultation_probono', 'sys_services_probono');

-- ---------------------------------------------------------------------------
-- Fidéicommis et échéancier : uniquement là où de l'argent circule
-- ---------------------------------------------------------------------------
insert into public.agreement_template_articles
  (firm_id, template_id, position, code, title_fr, title_en, body_fr, body_en, level, optional)
select null, t.id, a.position, a.code, a.title_fr, a.title_en, a.body_fr, a.body_en, a.level, a.optional
from public.agreement_templates t
cross join (values
  (40, 'echeancier', 'Modalités et échéancier de paiement', 'Payment terms and schedule',
   'Les honoraires sont payables selon l''échéancier convenu entre les parties et annexé aux présentes.

À défaut d''échéancier annexé, la totalité des honoraires est exigible à la signature.',
   'Fees are payable according to the schedule agreed between the parties and appended hereto.

Failing an appended schedule, the full amount of the fees is due upon signature.',
   'free', true),
  (50, 'fideicommis', 'Sommes détenues en fidéicommis', 'Funds held in trust',
   'Les sommes reçues du client avant que les services correspondants n''aient été rendus sont déposées dans le compte en fidéicommis du cabinet, distinct de son compte d''exploitation.

Elles n''en sont retirées qu''au fur et à mesure que les services sont rendus, ou pour acquitter des frais exigés par les autorités pour le compte du client. Le client peut demander en tout temps un état des sommes détenues pour son compte.',
   'Funds received from the client before the corresponding services have been rendered are deposited in the firm''s trust account, separate from its operating account.

They are withdrawn only as services are rendered, or to pay fees charged by the authorities on the client''s behalf. The client may at any time request a statement of the funds held on their behalf.',
   'structural', false)
) as a(position, code, title_fr, title_en, body_fr, body_en, level, optional)
where t.firm_id is null and t.code in ('sys_consultation', 'sys_services');

commit;
