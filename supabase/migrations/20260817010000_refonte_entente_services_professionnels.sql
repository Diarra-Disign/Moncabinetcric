-- ============================================================================
-- Refonte approfondie des modèles d'entente de services professionnels
-- (Standard et Pro Bono) — sys_services et sys_services_probono
-- ============================================================================
--
-- Conforme :
--   - Au Code de déontologie des titulaires de permis du CICC / CCIC (DORS/2022-128),
--     notamment l'article 24 (Exigences applicables au contrat de service) ;
--   - À la Loi sur le Collège des consultants en immigration et en citoyenneté ;
--   - Au Règlement sur le contrat de service des titulaires de permis ;
--   - Au Guide d'élaboration du contrat de service professionnel ;
--   - À la Loi sur la protection des renseignements personnels (LPRPDE) et Loi 25 (QC).
--
-- NE MODIFIE EN AUCUN CAS :
--   - sys_consultation (Contrat de consultation initiale)
--   - sys_consultation_probono (Contrat de consultation initiale — Pro Bono)
--   - Tout autre modèle personnalisé existant
-- ============================================================================

begin;

-- 1. Nettoyer les anciens articles UNIQUEMENT pour les modèles de services professionnels
delete from public.agreement_template_articles
where template_id in (
  select id from public.agreement_templates
  where firm_id is null and code in ('sys_services', 'sys_services_probono')
);

-- 2. Mettre à jour les métadonnées des modèles de services
update public.agreement_templates
set title_fr = 'Contrat de service professionnel en immigration',
    title_en = 'Professional Immigration Services Agreement',
    description_fr = 'Mandat complet de représentation devant les autorités d’immigration, conforme au Code de déontologie CCIC (Art. 24).',
    description_en = 'Comprehensive representation retainer before immigration authorities, compliant with CICC Code of Conduct (Sec. 24).',
    version = '2.0',
    updated_at = now()
where firm_id is null and code = 'sys_services';

update public.agreement_templates
set title_fr = 'Contrat de service professionnel en immigration — Pro Bono',
    title_en = 'Professional Immigration Services Agreement — Pro Bono',
    description_fr = 'Mandat complet de représentation fourni pro bono (sans honoraires professionnels), conforme au Code CCIC (Art. 24).',
    description_en = 'Representation retainer provided pro bono (free of professional fees), compliant with CICC Code (Sec. 24).',
    version = '2.0',
    updated_at = now()
where firm_id is null and code = 'sys_services_probono';

-- 3. Insérer les articles communs (1 à 7, 10, 12 à 25, et Annexe A) pour sys_services et sys_services_probono
insert into public.agreement_template_articles
  (firm_id, template_id, position, code, title_fr, title_en, body_fr, body_en, level, optional)
select null, t.id, a.position, a.code, a.title_fr, a.title_en, a.body_fr, a.body_en, a.level, a.optional
from public.agreement_templates t
cross join (values
  (10, 'art1_parties', 'ARTICLE 1 — IDENTIFICATION DES PARTIES', 'ARTICLE 1 — IDENTIFICATION OF PARTIES',
   '1.1 LE CONSULTANT RÉGLEMENTÉ EN IMMIGRATION CANADIENNE (CRIC) / The Regulated Canadian Immigration Consultant
Cabinet : {{nom_cabinet}}
Consultant(e) titulaire : {{nom_consultant}}
N° de permis CRIC : {{permis_consultant}}
Organisme de réglementation : Collège des consultants en immigration et en citoyenneté (CCIC / CICC) — www.college-ic.ca
Adresse professionnelle : {{adresse_cabinet}}
Téléphone : {{telephone_cabinet}}
Courriel : {{courriel_cabinet}}
Site Web : {{site_cabinet}}

1.2 LE/LA CLIENT(E) / The Client
Nom complet / Full Name : {{nom_complet_client}}
Date de naissance / Date of Birth : {{date_naissance_client}}
Nationalité / Nationality : {{nationalite_client}}
N° de passeport / Passport No. : {{passeport_client}}
Adresse de résidence / Residential Address : {{adresse_client}}
Téléphone / Phone : {{telephone_client}}
Courriel / Email : {{courriel_client}}
Statut actuel au Canada / Current Status : {{statut_canada_client}}

Ci-après collectivement désignés les « Parties » ou individuellement une « Partie ».',
   '1.1 THE REGULATED CANADIAN IMMIGRATION CONSULTANT (RCIC):
Firm: {{nom_cabinet}}
Lead Consultant: {{nom_consultant}}
RCIC Licence No.: {{permis_consultant}}
Regulatory Body: College of Immigration and Citizenship Consultants (CICC / CCIC) — www.college-ic.ca
Business Address: {{adresse_cabinet}}
Phone: {{telephone_cabinet}}
Email: {{courriel_cabinet}}
Website: {{site_cabinet}}

1.2 THE CLIENT:
Full Name: {{nom_complet_client}}
Date of Birth: {{date_naissance_client}}
Nationality: {{nationalite_client}}
Passport No.: {{passeport_client}}
Residential Address: {{adresse_client}}
Phone: {{telephone_client}}
Email: {{courriel_client}}
Current Status in Canada: {{statut_canada_client}}

Hereinafter collectively referred to as the "Parties" or individually as a "Party".',
   'structural', false),

  (20, 'art2_objet_conseils', 'ARTICLE 2 — OBJET DU CONTRAT ET CONSEILS PRÉLIMINAIRES', 'ARTICLE 2 — PURPOSE OF AGREEMENT AND PRELIMINARY ADVICE',
   '2.1 Le présent contrat a pour objet de définir les termes, conditions et modalités selon lesquels le Cabinet et le Consultant fournissent au/à la Client(e) des services professionnels de conseil et de représentation en immigration canadienne, conformément :
• Au Code de déontologie des titulaires de permis du Collège des consultants en immigration et en citoyenneté (DORS/2022-128) ;
• À la Loi sur le Collège des consultants en immigration et en citoyenneté ;
• Au Règlement régissant le contrat de service et au Guide d’élaboration du contrat de service professionnel.

2.2 CONSEILS PRÉLIMINAIRES (Art. 24(c) du Code) :
Préalablement à la conclusion du présent contrat, le Consultant a formulé au/à la Client(e) les observations et conseils préliminaires suivants relatifs à son admissibilité et aux options procédurales :
{{conseils_preliminaires}}',
   '2.1 The purpose of this agreement is to set forth the terms, conditions, and standards under which the Firm and the Consultant deliver professional Canadian immigration consulting and representation services to the Client, pursuant to:
• The Code of Professional Conduct for College of Immigration and Citizenship Consultants Licensees (SOR/2022-128);
• The College of Immigration and Citizenship Consultants Act;
• The Service Agreement Regulations and Professional Service Agreement Development Guide.

2.2 PRELIMINARY ADVICE (Section 24(c) of the Code):
Prior to the execution of this agreement, the Consultant provided the following preliminary assessments and guidance to the Client regarding eligibility and procedural options:
{{conseils_preliminaires}}',
   'structural', false),

  (30, 'art3_supervision_intervenants', 'ARTICLE 3 — SUPERVISION DE LA QUALITÉ ET PERSONNEL D’ASSISTANCE', 'ARTICLE 3 — QUALITY SUPERVISION AND ASSISTING PERSONNEL',
   '3.1 DÉCLARATION DE SUPERVISION (Art. 24(d) du Code) :
Le Consultant titulaire conserve l’entière responsabilité professionnelle, déontologique et juridique de la prestation de services. Tous les travaux de préparation, de recherche, de saisie ou de traitement administratif délégués à des employés, commis, stagiaires ou assistants sont réalisés sous la supervision directe, continue et rigoureuse du Consultant titulaire de permis.

3.2 PERSONNES SUSCEPTIBLES D’INTERVENIR (Art. 24(e) du Code) :
Les personnes suivantes, dûment qualifiées et membres du personnel du Cabinet, sont susceptibles d’assister le Consultant dans l’exécution des actes administratifs du dossier :
{{personnel_intervenant}}',
   '3.1 SUPERVISION STATEMENT (Section 24(d) of the Code):
The licensed Consultant maintains sole and full professional, ethical, and legal accountability for the delivery of services. Any preparation, research, data entry, or clerical tasks delegated to employees, law clerks, interns, or administrative assistants are performed under the direct, continuous, and diligent supervision of the licensed Consultant.

3.2 ASSISTING PERSONNEL (Section 24(e) of the Code):
The following qualified staff members of the Firm may assist the Consultant in administrative matters pertaining to this file:
{{personnel_intervenant}}',
   'structural', false),

  (40, 'art4_instructions_client', 'ARTICLE 4 — INSTRUCTIONS DU CLIENT ET STRATÉGIE CONVENUE', 'ARTICLE 4 — CLIENT INSTRUCTIONS AND AGREED STRATEGY',
   '4.1 Conformément à l’article 24(f) du Code, les services sont exécutés conformément aux instructions spécifiques communiquées par le/la Client(e) :
{{instructions_client}}

4.2 Le/la Client(e) confirme que les objectifs indiqués ci-dessus correspondent à sa volonté libre et éclairée, et s’engage à informer immédiatement le Consultant de toute modification apportée à ses instructions.',
   '4.1 Pursuant to section 24(f) of the Code, services are performed in accordance with the specific instructions communicated by the Client:
{{instructions_client}}

4.2 The Client confirms that the objectives stated above reflect their informed and voluntary intent, and undertakes to promptly inform the Consultant of any modification to these instructions.',
   'structural', false),

  (50, 'art5_services_inclus', 'ARTICLE 5 — SERVICES PROFESSIONNELS RETENUS ET NATURE DU MANDAT', 'ARTICLE 5 — RETAINED PROFESSIONAL SERVICES AND NATURE OF MANDATE',
   '5.1 Le Cabinet s’engage à fournir une prestation individualisée, adaptée aux besoins du/de la Client(e), comprenant les services suivants (Art. 24(g) du Code) :
{{description_services_detailles}}

5.2 Sauf stipulation expresse contraire, les services incluent :
• L’analyse rigoureuse du profil, des faits et des pièces justificatives ;
• La stratégie réglementaire et la détermination de la catégorie d’immigration appropriée ;
• La préparation, la vérification et l’assemblage des formulaires officiels requis ;
• La rédaction des mémoires explicatifs, observations juridico-factuelles ou lettres d’accompagnement ;
• La soumission de la demande auprès des autorités compétentes (IRCC, MIFI/Ministères provinciaux, CISR, EDSC) ;
• La représentation officielle à titre de mandataire autorisé et la transmission de l’avis de représentation (formulaire IMM 5476 ou équivalent) ;
• Le suivi de l’état d’avancement et la communication officielle avec les autorités compétentes ;
• La réception des correspondances ministérielles et la transmission diligente des mises à jour au/à la Client(e).',
   '5.1 The Firm undertakes to provide tailored professional services adapted to the Client''s specific requirements, including (Section 24(g) of the Code):
{{description_services_detailles}}

5.2 Unless expressly stipulated otherwise in writing, services include:
• Comprehensive evaluation of client profile, supporting evidence, and factual background;
• Regulatory strategy and determination of appropriate immigration program stream;
• Drafting, verification, and preparation of mandatory statutory application forms;
• Drafting of legal submissions, explanatory representations, and cover letters;
• Lodging of complete application package with relevant authorities (IRCC, Provincial Nominee Programs/MIFI, IRB, ESDC);
• Official representation as designated representative and filing of Form IMM 5476 or provincial equivalent;
• Active file monitoring and official correspondence with government authorities;
• Receipt of official ministerial updates and prompt transmission of developments to the Client.',
   'structural', false),

  (60, 'art6_services_exclus', 'ARTICLE 6 — SERVICES NON INCLUS ET EXCLUSIONS DU MANDAT', 'ARTICLE 6 — EXCLUDED SERVICES AND MANDATE LIMITS',
   '6.1 Sont expressément EXCLUS de la portée du présent contrat et nécessiteront une entente distincte :
• Les frais gouvernementaux exigibles par les ministères et organismes publics (frais de traitement, biométrie, droits de résidence permanente) ;
• Les frais de tiers : traductions certifiées, examens médicaux désignés, tests linguistiques certifiés (IELTS, TEF, TCF), évaluations comparatives des diplômes (ECA/WES) ;
• La préparation ou le dépôt de toute demande distincte pour un membre de la famille non nommément inclus au présent mandat ;
• Les procédures contentieuses subséquentes : demande de contrôle judiciaire devant la Cour fédérale du Canada, révision ou appel devant la Section d’appel de l’immigration (SAI) ou la Section d’appel des réfugiés (SAR), sauf mandat expressément souscrit à cet effet ;
• La reprise ou réintroduction d’une nouvelle demande à la suite d’un refus définitif rendu par les autorités ;
• Le traitement d’allégations ou motifs d’interdiction de territoire (fausses déclarations antérieures, criminalité, sécurité, motifs financiers ou médicaux) qui n’avaient pas été divulgués par écrit avant la signature du contrat ;
• Toute consultation relevant du droit général, du droit pénal, fiscal ou corporatif — le Consultant n’étant pas un avocat.

6.2 Exclusions spécifiques convenues :
{{exclusions_specifiques}}',
   '6.1 The following are expressly EXCLUDED from the scope of this agreement and require a separate retainer:
• Official government processing fees, biometrics fees, and Right of Permanent Residence Fees (RPRF);
• Third-party disbursements: certified translations, designated medical examinations, approved language proficiency tests, and educational credential assessments (ECA);
• Preparation or submission of separate applications for family members not expressly designated herein;
• Subsequent contentious proceedings: Application for Leave and Judicial Review before the Federal Court of Canada, appeals before the Immigration Appeal Division (IAD) or Refugee Appeal Division (RAD), unless expressly retained;
• Re-application or submission of a new petition following a final administrative refusal;
• Handling of inadmissibility matters (prior misrepresentation, criminality, security, financial, or medical inadmissibility) not disclosed in writing prior to signing;
• Legal advice outside immigration consulting — the Consultant is not an attorney.

6.2 Specifically agreed exclusions:
{{exclusions_specifiques}}',
   'structural', false),

  (70, 'art7_duree_mandat', 'ARTICLE 7 — DURÉE DU MANDAT ET PRISE D’EFFET', 'ARTICLE 7 — DURATION OF MANDATE AND COMMENCEMENT',
   '7.1 Le présent contrat entre en vigueur à la date de sa signature par les deux Parties.
7.2 Le mandat demeure en vigueur jusqu’à la survenance du premier des événements suivants :
• L’accomplissement intégral des services prévus à l’Article 5 ;
• La notification de la décision finale rendue par l’autorité gouvernementale compétente sur la demande visée ;
• La date d’échéance convenue, le cas échéant : {{date_fin_mandat}} ;
• La résiliation anticipée par l’une des Parties conformément à l’Article 19.

7.3 La durée du contrat est strictement proportionnée à la portée réelle des services retenus.',
   '7.1 This agreement enters into force on the date of execution by both Parties.
7.2 The mandate remains valid until the occurrence of the earliest of the following events:
• Full completion of all professional services defined in Article 5;
• Notification of the final statutory decision rendered by the relevant immigration authority on the retained application;
• The agreed target expiry date, where applicable: {{date_fin_mandat}};
• Early termination by either Party in accordance with Article 19.

7.3 The term is strictly proportionate to the actual scope of retained services.',
   'structural', false),

  (100, 'art10_debours_tiers', 'ARTICLE 10 — DÉBOURS ET FRAIS DE TIERS', 'ARTICLE 10 — DISBURSEMENTS AND THIRD-PARTY EXPENSES',
   '10.1 Conformément à l’article 24(i) du Code, le contrat fournit une estimation des débours prévus et des coûts additionnels susceptibles d’être exigés.
10.2 Les débours comprennent notamment les frais gouvernementaux (IRCC, ministères provinciaux), les frais de messagerie sécurisée, de copie certifiée, d’interprétation, de télécommunication internationale ou de services techniques spécialisés.
10.3 Ces débours sont à la charge exclusive du/de la Client(e). Lorsqu’ils sont avancés par le Cabinet pour le compte du client, ils sont facturés au coût réel sans majoration occulte, sur présentation des reçus justificatifs officiels.

Estimation des débours prévus :
{{debours_previsibles}}',
   '10.1 Pursuant to section 24(i) of the Code, an estimate of expected disbursements and additional costs is provided.
10.2 Disbursements include government statutory processing fees, courier charges, certified copies, translation, interpretation, and specialized technical expenses.
10.3 All disbursements remain the sole financial responsibility of the Client. When disbursed by the Firm on the Client''s behalf, they are billed at actual cost without hidden surcharges, supported by official vouchers.

Estimated disbursements:
{{debours_previsibles}}',
   'structural', false),

  (120, 'art12_obligations_consultant', 'ARTICLE 12 — OBLIGATIONS DU CABINET ET DU CONSULTANT TITULAIRE', 'ARTICLE 12 — OBLIGATIONS OF THE FIRM AND LICENSED CONSULTANT',
   'Le Cabinet et le Consultant s’engagent expressément à :
• Agir avec compétence, honnêteté, diligence et intégrité, dans le respect absolu du Code de déontologie du CCIC ;
• Fournir au/à la Client(e) une information opportune, claire et régulière sur l’évolution et l’état d’avancement de son dossier ;
• Consacrer le temps et le soin professionnel requis pour optimiser la qualité et la conformité des démarches entreprises ;
• Respecter rigoureusement les règles de confidentialité et de protection des données personnelles ;
• Superviser de façon continue l’ensemble des collaborateurs et assistants intervenant sur le dossier ;
• Aviser immédiatement le/la Client(e) de toute circonstance imprévue, évolution législative majeure ou demande de documents émise par les autorités ;
• Ne pas solliciter de rémunération additionnelle non convenue au contrat sans avenant écrit préalable.',
   'The Firm and the licensed Consultant undertake to:
• Act with competence, honesty, diligence, and integrity in strict adherence to the CICC Code of Professional Conduct;
• Provide the Client with timely, clear, and regular updates regarding file progress and case milestones;
• Dedicate requisite professional skill and attention to maximize application quality and regulatory compliance;
• Strictly preserve confidentiality and comply with applicable personal data protection laws;
• Exercise continuous and effective supervision over all assisting staff;
• Promptly inform the Client of any unforeseen developments, regulatory revisions, or formal requests for evidence issued by immigration authorities;
• Refrain from demanding additional compensation not stipulated in the agreement without a prior written amendment.',
   'structural', false),

  (130, 'art13_obligations_client', 'ARTICLE 13 — OBLIGATIONS DU/DE LA CLIENT(E)', 'ARTICLE 13 — CLIENT OBLIGATIONS',
   'Le/la Client(e) s’engage expressément à :
• Communiquer des renseignements complets, exacts et véridiques, et déclarer l’intégralité de ses antécédents personnels, migratoires, judiciaires et médicaux ;
• Fournir avec diligence l’ensemble des pièces justificatives, formulaires et traductions demandés dans les délais impartis ;
• Informer sans délai le Cabinet de toute modification survenant dans sa situation personnelle ou familiale (adresse, coordonnées, statut d’emploi, mariage, naissance, arrestation, refus de visa étranger) ;
• Ne pas communiquer directement avec les autorités d’immigration (IRCC, CISR, ministères) sans concertation préalable avec le Consultant, afin d’éviter toute confusion procédurale ;
• Respecter scrupuleusement l’échéancier des paiements convenu ;
• Examiner et valider attentivement les formulaires et déclarations avant soumission officielle ;
• Conserver un double complet de toutes les pièces et formulaires transmis au Cabinet.',
   'The Client expressly undertakes to:
• Provide complete, accurate, and truthful information, disclosing all relevant personal, immigration, criminal, and medical history;
• Diligently deliver all requested supporting documentation, completed questionnaires, and translations within stipulated timeframes;
• Promptly notify the Firm of any material change in personal or family status (contact information, marital status, employment, birth, arrest, or foreign visa refusals);
• Refrain from directly contacting immigration authorities without prior coordination with the Consultant, to prevent procedural inconsistencies;
• Strictly abide by the agreed payment schedule;
• Carefully review and confirm the accuracy of all declarations and application forms prior to official lodging;
• Retain a personal copy of all records and documents provided to the Firm.',
   'structural', false),

  (140, 'art14_retard_defaut', 'ARTICLE 14 — DÉFAUT OU RETARD DU CLIENT ET DÉLAIS ADMINISTRATIFS', 'ARTICLE 14 — CLIENT DELAY, DEFAULT AND ADMINISTRATIVE PROCESSING TIMES',
   '14.1 DISTINCTION DES RETARDS :
Les Parties reconnaissent expressément la distinction fondamentale entre :
a) Les délais de traitement administratif et décisions discrétionnaires relevant exclusivement des autorités gouvernementales (IRCC, CISR, EDSC), pour lesquels le Cabinet ne peut encourir aucune responsabilité ;
b) Les retards imputables au/à la Client(e) découlant d’une omission de transmettre les documents requis, d’une absence de réponse aux communications du Cabinet, ou d’un défaut de paiement.

14.2 En cas d’omission ou de carence du/de la Client(e) risquant de compromettre un délai de rigueur fixé par les autorités, le Cabinet transmettra un rappel formel par écrit. Le Cabinet ne saurait être tenu responsable du rejet ou du désistement d’une demande imputable au défaut de collaboration du client.',
   '14.1 DISTINCTION OF DELAYS:
The Parties expressly distinguish between:
a) Administrative processing timelines and discretionary decision-making belonging exclusively to government bodies (IRCC, IRB, ESDC), for which the Firm bears no liability;
b) Delays attributable to the Client resulting from failure to submit required documents, absence of response to communications, or payment default.

14.2 In the event of Client default jeopardizing statutory deadlines, the Firm will issue a formal written reminder. The Firm shall not be held liable for any refusal or application deemed abandoned resulting from Client non-collaboration.',
   'structural', false),

  (150, 'art15_absence_garantie_responsabilite', 'ARTICLE 15 — ABSENCE DE GARANTIE DE RÉSULTAT ET RESPONSABILITÉ', 'ARTICLE 15 — NO GUARANTEE OF OUTCOME AND PROFESSIONAL RESPONSIBILITY',
   '15.1 SOUVERAINETÉ DÉCISIONNELLE DES AUTORITÉS :
Le Cabinet et le Consultant ne garantissent et ne peuvent en aucun cas garantir l’obtention d’un visa, d’un permis, du statut de résident permanent, de la citoyenneté ou l’approbation de toute demande d’immigration. La décision finale d’accueillir ou de refuser une demande relève souverainement et exclusivement des agents désignés par les autorités gouvernementales compétentes (IRCC, CISR, ASFC).

15.2 Les honoraires professionnels rétribuent l’expertise, le temps et le travail juridique et technique d’analyse, de préparation et de représentation. Ils ne sont en aucun cas conditionnels à l’obtention d’un résultat favorable.

15.3 RESPONSABILITÉ PROFESSIONNELLE :
Le Consultant assume l’entière responsabilité de la qualité de ses conseils et de l’exécution professionnelle de son mandat, et maintient à cet effet une assurance responsabilité professionnelle obligatoire conforme aux exigences du Collège (CCIC). La présente clause ne saurait être interprétée comme une exonération illicite de la responsabilité professionnelle du titulaire de permis pour faute commise dans l’exercice de ses fonctions.',
   '15.1 SOVEREIGN DISCRETION OF AUTHORITIES:
The Firm and Consultant do not and cannot guarantee the issuance of a visa, study/work permit, permanent residence status, citizenship, or approval of any immigration petition. Final adjudication rests exclusively within the sovereign authority of designated immigration officers (IRCC, IRB, CBSA).

15.2 Professional fees compensate expert consulting, document preparation, and official representation. Fees are strictly non-contingent upon outcome.

15.3 PROFESSIONAL RESPONSIBILITY:
The Consultant maintains full professional accountability for services rendered and holds mandatory professional errors and omissions liability insurance in compliance with CICC standards. This clause shall not be construed as an unlawful waiver of professional liability for errors or omissions committed in the performance of duties.',
   'structural', false),

  (160, 'art16_confidentialite_loi25', 'ARTICLE 16 — CONFIDENTIALITÉ ET RENSEIGNEMENTS PERSONNELS', 'ARTICLE 16 — CONFIDENTIALITY AND PERSONAL INFORMATION PROTECTION',
   '16.1 SECRET PROFESSIONNEL :
Le Consultant et l’ensemble des collaborateurs du Cabinet sont tenus à une stricte obligation de secret professionnel et de confidentialité relative à tous les renseignements et pièces recueillis dans le cadre du mandat. Cette obligation subsiste indéfiniment après la clôture du dossier.

16.2 CONFORMITÉ LPRPDE ET LOI 25 DU QUÉBEC :
Le Cabinet applique des mesures de sécurité rigoureuses pour protéger les renseignements personnels contre la perte, le vol ou l’accès non autorisé.
• Responsable de la protection des renseignements personnels : {{nom_consultant}} (joignable à {{courriel_cabinet}}).
• Finalités exclusives : Évaluation, préparation et soutien de la demande d’immigration, communications officielles, et respect des obligations réglementaires de tenue de dossiers.
• Hébergement sécurisé : Données hébergées en région canadienne sécurisée. Les prestataires techniques spécialisés (traitement de paiement sécurisé, portail client) respectent des engagements stricts de protection.
• Conservation et destruction : Conservation obligatoire de six (6) ans après la clôture du mandat conformément aux règles du CCIC, suivie d’une destruction sécurisée.

16.3 Le/la Client(e) consent expressément à la collecte, à l’utilisation et à la communication de ses renseignements personnels aux autorités gouvernementales compétentes aux seules fins de l’exécution du mandat.',
   '16.1 PROFESSIONAL CONFIDENTIALITY:
The Consultant and Firm personnel are bound by strict professional confidentiality regarding all information and documents obtained throughout the retainer. This obligation survives termination of the mandate.

16.2 PIPEDA AND QUEBEC LAW 25 COMPLIANCE:
The Firm implements robust technical and administrative safeguards to protect personal data against loss, unauthorized access, or disclosure.
• Privacy Officer: {{nom_consultant}} (reachable at {{courriel_cabinet}}).
• Exclusive Purposes: Assessment, preparation, and support of immigration applications, official correspondence, and regulatory record-keeping compliance.
• Secure Canadian Hosting: Data hosted in Canadian cloud facilities. Technical sub-processors adhere to stringent security standards.
• Retention: Mandatory six (6) year retention following file closure pursuant to CICC regulations, followed by secure destruction.

16.3 The Client consents to the collection, use, and disclosure of personal data to relevant immigration authorities solely for mandate execution.',
   'structural', false),

  (170, 'art17_conflit_interets', 'ARTICLE 17 — DÉCLARATION SUR LES CONFLITS D’INTÉRÊTS', 'ARTICLE 17 — CONFLICT OF INTEREST DECLARATION',
   '17.1 Conformément à l’article 24(s) et aux articles 28 et suivants du Code de déontologie, le Consultant a le devoir d’identifier et de divulguer tout conflit d’intérêts réel, potentiel ou apparent.
17.2 Le Consultant déclare expressément qu’à la date de conclusion du présent contrat, il n’existe aucun conflit d’intérêts susceptible d’altérer son indépendance, son jugement professionnel ou sa loyauté envers le/la Client(e).
17.3 Dans l’éventualité où une situation de conflit d’intérêts surviendrait au cours du mandat (notamment en cas de représentation conjointe employeur/travailleur ou parrain/parrainé), le Consultant en avisera immédiatement les Parties par écrit et appliquera les mesures déontologiques prescrites, pouvant inclure l’obtention d’un consentement éclairé écrit ou le désistement du dossier.',
   '17.1 Pursuant to section 24(s) and sections 28 et seq. of the Code of Professional Conduct, the Consultant must identify and disclose any actual, potential, or perceived conflict of interest.
17.2 The Consultant declares that as of the date of execution, no conflict of interest exists that would impair professional independence, judgment, or loyalty to the Client.
17.3 Should a conflict arise during the mandate (notably in dual-representation contexts such as employer/foreign national or sponsor/sponsored person), the Consultant will immediately notify the Parties in writing and implement required regulatory measures, including written informed consent or withdrawal.',
   'structural', false),

  (180, 'art18_documents_originaux', 'ARTICLE 18 — GESTION ET RESTITUTION DES DOCUMENTS ORIGINAUX', 'ARTICLE 18 — MANAGEMENT AND RETURN OF ORIGINAL DOCUMENTS',
   '18.1 Conformément à l’article 24(t) du Code de déontologie, le Cabinet veille à la conservation sécuritaire de tout document original confié par le/la Client(e).
18.2 Le Cabinet s’engage à restituer l’ensemble des documents originaux appartenant au/à la Client(e) dès que leur objet a été atteint dans le cadre de la procédure, ou au plus tard dans un délai de trente (30) jours suivant la conclusion ou la résiliation du présent contrat.
18.3 Le Cabinet conserve une copie numérisée intégrale du dossier à des fins de conformité et de vérification réglementaire.',
   '18.1 Pursuant to section 24(t) of the Code of Conduct, the Firm ensures secure safekeeping of any original documents entrusted by the Client.
18.2 The Firm undertakes to return all original documents belonging to the Client once their purpose has been served, or within thirty (30) days following the conclusion or termination of this agreement.
18.3 The Firm retains a full electronic copy of the file for regulatory compliance and audit purposes.',
   'structural', false),

  (190, 'art19_resiliation', 'ARTICLE 19 — RÉSILIATION DU CONTRAT ET FIN DU MANDAT', 'ARTICLE 19 — TERMINATION OF AGREEMENT AND MANDATE DISCHARGE',
   '19.1 RÉSILIATION PAR LE/LA CLIENT(E) :
Le/la Client(e) peut mettre fin au présent contrat en tout temps, pour tout motif, en transmettant un avis écrit au Cabinet.

19.2 RÉSILIATION PAR LE CONSULTANT (Art. 24(l) du Code) :
Le Consultant ne peut résilier le contrat que pour un motif sérieux et légitime (notamment : perte irréversible du lien de confiance, refus persistant de collaborer ou de fournir les documents requis, non-paiement des honoraires exigibles, demande du client d’accomplir un acte illégal ou trompeur). La résiliation par le Consultant est subordonnée à la transmission d’un préavis écrit raisonnable et ne doit pas être exercée de manière à causer un préjudice injustifié au client.

19.3 EFFETS FINANCIERS ET CLÔTURE :
En cas de résiliation :
• Les honoraires afférents aux prestations professionnelles déjà accomplies demeurent acquis au Cabinet ;
• Les avances non gagnées détenues en fidéicommis sont restituées au client conformément à l’Article 11 ;
• Les débours légitimement engagés pour le compte du client demeurent à sa charge ;
• Un état de compte détaillé et les documents originaux sont remis au client dans les quinze (15) à trente (30) jours.',
   '19.1 TERMINATION BY THE CLIENT:
The Client may terminate this agreement at any time and for any reason upon delivering written notice to the Firm.

19.2 TERMINATION BY THE CONSULTANT (Section 24(l) of the Code):
The Consultant may terminate this agreement only for serious and legitimate cause (including: irremediable breakdown of trust, persistent failure to cooperate or provide documents, failure to pay matured fees, or client request to perform an unlawful or deceptive act). Termination by the Consultant requires reasonable written notice and must not unduly prejudice the Client.

19.3 FINANCIAL SETTLEMENT AND CLOSURE:
Upon termination:
• Fees for professional services already performed remain earned and payable;
• Unearned advance funds held in trust are refunded pursuant to Article 11;
• Disbursements legitimately incurred on behalf of the Client remain due;
• A detailed accounting statement and original documents are delivered to the Client within fifteen (15) to thirty (30) days.',
   'structural', false),

  (200, 'art20_langue_communications', 'ARTICLE 20 — LANGUE OFFICIELLE DES SERVICES ET COMMUNICATIONS', 'ARTICLE 20 — OFFICIAL LANGUAGE OF SERVICES AND COMMUNICATIONS',
   '20.1 LANGUE OFFICIELLE (Art. 24(m) du Code) :
Les services professionnels et les échanges officiels relatifs au présent contrat sont fournis dans la langue officielle suivante convenue entre les Parties :
☑ Français / French
☐ Anglais / English

20.2 MOYENS DE COMMUNICATION ET PORTAIL CLIENT SÉCURISÉ :
Les communications régulières et la transmission de documents sensibles s’effectuent prioritairement via le portail client sécurisé du Cabinet, ainsi que par courriel, téléphone ou visioconférence. Le/la Client(e) est invité(e) à consulter régulièrement son portail pour prendre connaissance des requêtes et notifications.',
   '20.1 OFFICIAL LANGUAGE (Section 24(m) of the Code):
Professional services and formal communications under this agreement shall be conducted in the agreed official language:
☑ French / Français
☐ English / Anglais

20.2 COMMUNICATION METHODS AND SECURE CLIENT PORTAL:
Routine communications and sensitive document exchange take place primarily through the Firm''s secure client portal, as well as via email, telephone, or video conference. The Client is encouraged to access the portal regularly to view updates and document requests.',
   'structural', false),

  (210, 'art21_plaintes_cicc', 'ARTICLE 21 — PROCÉDURE DE TRAITEMENT DES PLAINTES ET RÔLE DU CCIC', 'ARTICLE 21 — COMPLAINTS RESOLUTION AND ROLE OF THE CICC',
   '21.1 PROCÉDURE INTERNE DU CABINET (Art. 24(o) du Code) :
En cas de préoccupation ou d’insatisfaction, le/la Client(e) est invité(e) à formuler sa réclamation par écrit auprès du Cabinet à l’adresse : {{courriel_cabinet}}. Le Cabinet s’engage à accuser réception de toute plainte dans un délai de cinq (5) jours ouvrables et à y apporter une réponse motivée dans un délai maximal de trente (30) jours.

21.2 RÔLE DU COLLÈGE DES CONSULTANTS EN IMMIGRATION ET EN CITOYENNETÉ (CCIC / CICC) :
Le Collège est l’organisme de réglementation fédéral institué par la loi pour régir la profession de consultant en immigration, protéger le public et faire respecter les normes de compétence et d’éthique.
Si un différend ne peut être résolu à l’amiable, le/la Client(e) a le droit de déposer une plainte auprès du Collège :
• Site officiel : www.college-ic.ca
• Téléphone : 1-877-836-7543
• Adresse : College of Immigration and Citizenship Consultants, 5500 North Service Rd, Suite 1002, Burlington, ON L7L 6W6.',
   '21.1 INTERNAL COMPLAINT PROCEDURE (Section 24(o) of the Code):
In case of dissatisfaction or concern, the Client is invited to submit a written complaint to the Firm at: {{courriel_cabinet}}. The Firm commits to acknowledge receipt within five (5) business days and provide a substantiated written response within thirty (30) days.

21.2 REGULATORY ROLE OF THE COLLEGE (CICC / CCIC):
The College is the federal regulatory body mandated by statute to regulate Canadian immigration consultants, protect the public, and enforce strict professional and ethical standards.
If a dispute cannot be resolved amicably, the Client has the right to file a formal complaint with the College:
• Official Website: www.college-ic.ca
• Phone: 1-877-836-7543
• Address: College of Immigration and Citizenship Consultants, 5500 North Service Rd, Suite 1002, Burlington, ON L7L 6W6.',
   'structural', false),

  (220, 'art22_incapacite_consultant', 'ARTICLE 22 — DISPOSITION EN CAS D’INCAPACITÉ OU DE CESSATION DU CONSULTANT', 'ARTICLE 22 — CONTINGENCY FOR CONSULTANT INCAPACITY OR CESSATION OF PRACTICE',
   '22.1 Conformément à l’article 24(p) du Code de déontologie, dans l’éventualité où le Consultant titulaire deviendrait temporairement ou définitivement incapable d’exercer ses fonctions professionnelles (en raison de maladie, décès, invalidité ou cessation d’activité), le dossier sera pris en charge de façon ordonnée afin de prévenir tout préjudice au/à la Client(e).
22.2 Le Cabinet ou le représentant désigné veillera soit :
a) Au transfert immédiat du dossier à un autre consultant réglementé titulaire de permis (CRIC) ou avocat autorisé, avec le consentement préalable du client ;
b) À la restitution intégrale du dossier, des pièces et du solde des fonds en fidéicommis au client s’il préfère désigner son propre représentant.',
   '22.1 Pursuant to section 24(p) of the Code of Conduct, should the licensed Consultant become temporarily or permanently incapacitated or cease practice (due to illness, death, disability, or retirement), the file shall be handled orderly to prevent prejudice to the Client.
22.2 The Firm or designated contingency custodian will ensure either:
a) The prompt transfer of the file to another licensed RCIC or authorized legal practitioner, with the Client''s informed consent;
b) The immediate delivery of all file materials, original documents, and unearned trust balances to the Client if they choose to designate a representative of their choice.',
   'structural', false),

  (230, 'art23_modifications_avenants', 'ARTICLE 23 — MODIFICATION DU CONTRAT PAR AVENANT ÉCRIT', 'ARTICLE 23 — AMENDMENT BY WRITTEN SUPPLEMENTARY AGREEMENT',
   '23.1 Conformément à l’article 24(n) du Code de déontologie, toute modification apportée au présent contrat (portée des services, honoraires, échéancier, intervenants ou modalités) doit obligatoirement faire l’objet d’un avenant écrit dument accepté et signé par les deux Parties.
23.2 Aucune modification, renonciation ou entente verbale ne produit d’effet juridique entre les Parties.',
   '23.1 Pursuant to section 24(n) of the Code of Conduct, any modification to this agreement (scope of services, fees, payment schedule, personnel, or terms) must be executed by way of a formal written amendment signed and accepted by both Parties.
23.2 No verbal agreement or informal waiver shall have any binding legal effect.',
   'structural', false),

  (240, 'art24_droit_code_deontologie', 'ARTICLE 24 — DROIT APPLICABLE ET REMISE DU CODE DE DÉONTOLOGIE', 'ARTICLE 24 — GOVERNING LAW AND CODE OF CONDUCT ACKNOWLEDGEMENT',
   '24.1 DROIT APPLICABLE (Art. 24(r) du Code) :
Le présent contrat est régi et interprété conformément aux lois en vigueur dans la province où le Cabinet a son principal établissement d’exercice (Québec), ainsi qu’aux lois fédérales canadiennes et aux règlements du CCIC applicables.

24.2 REMISE DU CODE DE DÉONTOLOGIE (Art. 24(q) du Code) :
Le/la Client(e) reconnaît expressément avoir reçu une copie ou un accès direct électronique au Code de déontologie des titulaires de permis du CCIC (disponible sur www.college-ic.ca).',
   '24.1 GOVERNING LAW (Section 24(r) of the Code):
This agreement is governed by and construed in accordance with the laws of the province in Canada where the Firm maintains its primary place of business (Quebec), and applicable Canadian federal statutes and CICC regulations.

24.2 CODE OF CONDUCT ACKNOWLEDGEMENT (Section 24(q) of the Code):
The Client expressly acknowledges having received a copy of or direct electronic access to the CICC Code of Professional Conduct for Licensees (accessible at www.college-ic.ca).',
   'structural', false),

  (250, 'art25_consentement_reconnaissance', 'ARTICLE 25 — CONSENTEMENT ÉCLAIRÉ, RECONNAISSANCE ET SIGNATURES', 'ARTICLE 25 — INFORMED CONSENT, ACKNOWLEDGEMENT AND SIGNATURES',
   'Le/la Client(e) déclare et reconnaît expressément :
• Avoir lu, examiné et compris l’intégralité des clauses du présent contrat et de son Annexe A ;
• Avoir eu l’occasion de poser toutes les questions utiles et d’obtenir des explications complètes préalablement à la signature ;
• Avoir été informé(e) que le Consultant réglementé en immigration N’EST PAS un avocat et dispense des services représentatifs et administratifs ;
• Comprendre que l’obtention d’un statut ou visa d’immigration ne peut être garantie par le Consultant ;
• Avoir reçu un exemplaire électronique ou papier du présent contrat dûment signé par les Parties.

En foi de quoi, les Parties ont paraphé et signé le présent contrat à la date convenue.',
   'The Client expressly acknowledges and declares:
• Having read, examined, and understood all clauses of this agreement and Appendix A;
• Having had ample opportunity to ask clarifying questions and receive full explanations prior to signing;
• Having been informed that the Regulated Canadian Immigration Consultant IS NOT an attorney and provides representative and administrative services;
• Understanding that no outcome or visa issuance can be guaranteed;
• Having received a duly executed copy of this agreement signed by the Parties.

In witness whereof, the Parties have executed this agreement as of the date indicated.',
   'structural', false),

  (260, 'art26_annexe_documents', 'ANNEXE A — LISTE DES DOCUMENTS REQUIS ET ENGAGEMENT DU CLIENT', 'APPENDIX A — REQUIRED DOCUMENTS CHECKLIST AND CLIENT UNDERTAKING',
   'Le/la Client(e) s’engage à fournir au Cabinet dans les meilleurs délais les pièces requises applicables à sa demande :
☑ Document de voyage / Passeport valide (toutes les pages)
☑ Photos d’identité conformes aux spécifications officielles IRCC
☑ Acte de naissance certifié et pièces d’état civil
☑ Certificat de mariage, divorce ou union de fait (le cas échéant)
☑ Diplômes, certificats académiques et relevés de notes complets
☑ Rapport d’évaluation des diplômes d’études (ECA/WES/ICAS) si applicable
☑ Attestations et lettres d’expérience professionnelle (sur en-tête d’employeur)
☑ Résultats officiels des tests de compétences linguistiques (IELTS / TEF / TCF / PTE)
☑ Preuves de fonds suffisants et relevés bancaires officiels (des 3 à 6 derniers mois)
☑ Certificats de police / Extraits de casier judiciaire des pays de résidence
☑ Rapport d’examen médical aux fins de l’immigration (si requis)
☑ Formulaires d’autorisation de représentation (IMM 5476) remplis et signés
☑ Autres pièces spécifiques demandées par le Consultant : {{documents_specifiques}}',
   'The Client undertakes to provide the Firm promptly with all requisite supporting records for the application:
☑ Valid passport/travel document (all pages)
☑ Official identity photographs complying with IRCC specifications
☑ Certified birth certificates and civil status documents
☑ Marriage, divorce, or common-law certificates (where applicable)
☑ Diplomas, academic degrees, and complete transcripts
☑ Educational Credential Assessment (ECA) report if applicable
☑ Employment reference letters and proof of work experience
☑ Official language proficiency test reports (IELTS / TEF / TCF / PTE)
☑ Proof of financial support and official bank statements (past 3-6 months)
☑ Police clearance certificates for all countries of residence
☑ Immigration medical examination reports (if required)
☑ Official Use of Representative forms (IMM 5476) duly signed
☑ Other specific records requested by the Consultant: {{documents_specifiques}}',
   'free', false)
) as a(position, code, title_fr, title_en, body_fr, body_en, level, optional)
where t.firm_id is null
  and t.code in ('sys_services', 'sys_services_probono');

-- 4. Article 8 — Honoraires professionnels pour mandat standard (sys_services)
insert into public.agreement_template_articles
  (firm_id, template_id, position, code, title_fr, title_en, body_fr, body_en, level, optional)
select null, t.id, 80, 'art8_honoraires',
  'ARTICLE 8 — HONORAIRES PROFESSIONNELS ET TAXES APPLICABLES', 'ARTICLE 8 — PROFESSIONAL FEES AND APPLICABLE TAXES',
  '8.1 Les honoraires professionnels exigibles pour l’accomplissement des services décrits à l’Article 5 sont établis en dollars canadiens (CAD) comme suit (Art. 24(h) du Code) :
Honoraires professionnels : {{honoraires}}
Taxes applicables (TPS / TVQ / TVH) : {{taxes}}
TOTAL DES HONORAIRES : {{total}}

8.2 MODALITÉ DE TARIFICATION :
☑ Forfait global convenu pour la totalité des services décrits ;
☐ Tarif horaire convenu au taux de {{taux_horaire}} pour un nombre d’heures estimé à {{heures_estimees}} ;
☐ Honoraires par jalons ou étapes de procédure.

8.3 Les honoraires rémunèrent exclusivement les services professionnels du Cabinet. Les taxes sont calculées selon les lois fiscales en vigueur au moment de l’émission de la facture.',
  '8.1 Professional fees for services described in Article 5 are established in Canadian dollars (CAD) as follows (Section 24(h) of the Code):
Professional fees: {{honoraires}}
Applicable taxes (GST / QST / HST): {{taxes}}
TOTAL FEES: {{total}}

8.2 FEE STRUCTURE:
☑ Agreed fixed flat fee for all retained services;
☐ Hourly rate agreed at {{taux_horaire}} for an estimated volume of {{heures_estimees}} hours;
☐ Milestone-based fee structure.

8.3 Fees compensate exclusively professional services rendered by the Firm. Taxes apply in accordance with statutory tax laws.',
  'structural', false
from public.agreement_templates t
where t.firm_id is null and t.code = 'sys_services';

-- 5. Article 8 — Mention Pro Bono pour mandat pro bono (sys_services_probono)
insert into public.agreement_template_articles
  (firm_id, template_id, position, code, title_fr, title_en, body_fr, body_en, level, optional)
select null, t.id, 80, 'art8_honoraires',
  'ARTICLE 8 — NATURE PRO BONO DU MANDAT ET ABSENCE D’HONORAIRES', 'ARTICLE 8 — PRO BONO NATURE OF MANDATE AND ABSENCE OF FEES',
  '8.1 Conformément à l’article 24(h) du Code de déontologie, le présent mandat est fourni entièrement à titre PRO BONO (gracieux).
Honoraires professionnels exigibles : 0,00 $ CAD
Total des honoraires : 0,00 $ CAD

8.2 Cette gratuité ne diminue en rien les obligations de compétence, de diligence, de loyauté et de secret professionnel du Consultant, ni les droits et recours du/de la Client(e).

8.3 Seuls les débours réels et frais de tiers (frais gouvernementaux, traductions, biométrie) demeurent à la charge exclusive du/de la Client(e) conformément aux Articles 6 et 10.',
  '8.1 Pursuant to section 24(h) of the Code of Professional Conduct, this mandate is delivered entirely PRO BONO (complimentary).
Professional fees due: $0.00 CAD
Total fees: $0.00 CAD

8.2 This pro bono arrangement in no way diminishes the Consultant''s professional obligations of competence, diligence, and ethical standards, nor the Client''s rights and remedies.

8.3 Only actual third-party disbursements and statutory government processing fees remain payable by the Client pursuant to Articles 6 and 10.',
  'structural', false
from public.agreement_templates t
where t.firm_id is null and t.code = 'sys_services_probono';

-- 6. Article 9 — Échéancier et Fidéicommis pour mandat standard (sys_services)
insert into public.agreement_template_articles
  (firm_id, template_id, position, code, title_fr, title_en, body_fr, body_en, level, optional)
select null, t.id, 90, 'art9_echeancier_fideicommis',
  'ARTICLE 9 — ÉCHÉANCIER DE PAIEMENT ET SOMMES EN FIDÉICOMMIS', 'ARTICLE 9 — PAYMENT SCHEDULE AND TRUST ACCOUNTING',
  '9.1 CALENDRIER DES PAIEMENTS (Art. 24(j) du Code) :
Les honoraires professionnels sont payables selon les étapes convenues suivantes :
{{echeancier_etapes}}

9.2 COMPTE EN FIDÉICOMMIS / COMPTE CLIENT (Art. 13 du Règlement) :
Toute avance reçue du/de la Client(e) avant l’accomplissement des services correspondants est obligatoirement déposée dans le compte en fidéicommis du Cabinet, distinct du compte d’exploitation.
Les fonds ne sont virés au compte général du Cabinet qu’au fur et à mesure que les étapes de travail correspondantes sont complétées et facturées. Le/la Client(e) a le droit de demander en tout temps un relevé des sommes détenues en fiducie pour son compte.

9.3 MODES DE PAIEMENT ACCEPTÉS :
Virement électronique (Interac e-Transfer), chèque certifié, carte de crédit / débit ou autre mode préalablement convenu.',
  '9.1 PAYMENT SCHEDULE (Section 24(j) of the Code):
Professional fees are payable according to the agreed milestones below:
{{echeancier_etapes}}

9.2 CLIENT TRUST ACCOUNTING (Section 13 of Regulations):
Any advance payment received prior to service delivery is deposited into the Firm''s dedicated Client Trust Account, strictly segregated from the operating account.
Funds are transferred to the operating account only upon completion and billing of corresponding milestones. The Client may request a trust statement at any time.

9.3 ACCEPTED PAYMENT METHODS:
Interac e-Transfer, certified cheque, credit / debit card, or other agreed methods.',
  'structural', false
from public.agreement_templates t
where t.firm_id is null and t.code = 'sys_services';

-- 7. Article 9 — Échéancier pour mandat pro bono (sys_services_probono)
insert into public.agreement_template_articles
  (firm_id, template_id, position, code, title_fr, title_en, body_fr, body_en, level, optional)
select null, t.id, 90, 'art9_echeancier_fideicommis',
  'ARTICLE 9 — MODALITÉS DE GESTION DES DÉBOURS EN MODE PRO BONO', 'ARTICLE 9 — DISBURSEMENTS MANAGEMENT IN PRO BONO MANDATE',
  '9.1 Aucun honoraire professionnel ni calendrier de paiement d’honoraires ne s’applique au présent contrat.
9.2 Lorsque des avances sur débours sont exceptionnellement confiées au Cabinet pour acquitter des frais gouvernementaux ou de tiers pour le compte du client, ces sommes sont déposées dans le compte en fidéicommis du Cabinet et consacrées exclusivement au paiement des frais visés avec remise des reçus officiels.',
  '9.1 No professional fee schedule applies to this pro bono agreement.
9.2 Where funds are deposited to cover official third-party disbursements on behalf of the Client, such funds are maintained in the Firm''s Client Trust Account and utilized strictly for documented expenses with vouchers.',
  'structural', false
from public.agreement_templates t
where t.firm_id is null and t.code = 'sys_services_probono';

-- 8. Article 11 — Politique de remboursement pour mandat standard (sys_services)
insert into public.agreement_template_articles
  (firm_id, template_id, position, code, title_fr, title_en, body_fr, body_en, level, optional)
select null, t.id, 110, 'art11_remboursement',
  'ARTICLE 11 — POLITIQUE DE REMBOURSEMENT ET AVANCES NON ACQUISES', 'ARTICLE 11 — REFUND POLICY AND UNEARNED TRUST BALANCES',
  '11.1 Conformément à l’article 24(k) du Code de déontologie, le Cabinet applique une politique de remboursement transparente et équitable.
11.2 EN CAS DE RÉSILIATION OU DE FIN ANTICIPÉE :
• Sommes acquises : Les honoraires correspondant aux travaux professionnels et services déjà exécutés sont acquis au Cabinet et ne sont pas remboursables ;
• Sommes non acquises : Les avances détenues en fidéicommis pour des étapes de travail non encore entamées sont intégralement remboursées au/à la Client(e) ;
• Débours engagés : Les frais de tiers et débours déjà déboursés pour le compte du client (frais de gouvernement, traductions) ne sont pas remboursables ;
• État de compte : Le Cabinet remet un état de compte détaillé et rembourse le solde net dû dans un délai maximal de quinze (15) jours suivant la résiliation.

11.3 Aucune clause du contrat ne saurait priver le client de son droit au remboursement des sommes non gagnées.',
  '11.1 Pursuant to section 24(k) of the Code of Conduct, the Firm maintains a fair and transparent refund policy.
11.2 UPON TERMINATION OR EARLY MANDATE DISCHARGE:
• Earned fees: Fees corresponding to work performed remain earned and non-refundable;
• Unearned advances: Advance funds held in trust for unperformed milestones are refunded in full to the Client;
• Incurred disbursements: Third-party and government disbursements already paid are non-refundable;
• Accounting: The Firm renders a detailed statement and issues any net refund within fifteen (15) days of termination.

11.3 No contractual provision shall deprive the Client of their right to recover unearned advances.',
  'structural', false
from public.agreement_templates t
where t.firm_id is null and t.code = 'sys_services';

-- 9. Article 11 — Politique de remboursement pour mandat pro bono (sys_services_probono)
insert into public.agreement_template_articles
  (firm_id, template_id, position, code, title_fr, title_en, body_fr, body_en, level, optional)
select null, t.id, 110, 'art11_remboursement',
  'ARTICLE 11 — TRAITEMENT DES AVANCES SUR DÉBOURS EN MODE PRO BONO', 'ARTICLE 11 — DISBURSEMENT ADVANCES TREATMENT IN PRO BONO',
  '11.1 Les services professionnels étant fournis sans contrepartie financière, aucun remboursement d’honoraires n’a lieu de s’appliquer.
11.2 En cas d’interruption du mandat, toute somme avancée par le client pour des débours non encore engagés lui est promptement restituée dans un délai de quinze (15) jours avec reddition de compte.',
  '11.1 As professional services are delivered pro bono, no fee refund mechanism is applicable.
11.2 In case of termination, any advance funds delivered for uncommitted disbursements are refunded within fifteen (15) days with an accounting voucher.',
  'structural', false
from public.agreement_templates t
where t.firm_id is null and t.code = 'sys_services_probono';

commit;
