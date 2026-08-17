import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const env = Object.fromEntries(
  [...readFileSync(join(ROOT, ".env.local"), "utf8").matchAll(/^([A-Z0-9_]+)=(.*)$/gm)]
    .map((m) => [m[1], m[2].trim()])
)

const url = env.NEXT_PUBLIC_SUPABASE_URL
const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

async function main() {
  console.log("Applying consultation template articles update...")

  // 1. Get consultation template IDs
  const { data: templates, error: eTpl } = await admin
    .from("agreement_templates")
    .select("id, code")
    .is("firm_id", null)
    .in("code", ["sys_consultation", "sys_consultation_probono"])

  if (eTpl) {
    console.error("Error fetching templates:", eTpl)
    process.exit(1)
  }

  const consultationId = templates.find((t) => t.code === "sys_consultation")?.id
  const probonoId = templates.find((t) => t.code === "sys_consultation_probono")?.id

  console.log("Found templates:", { consultationId, probonoId })

  if (!consultationId || !probonoId) {
    console.error("Missing template IDs")
    process.exit(1)
  }

  // 2. Delete existing articles
  const { error: eDel } = await admin
    .from("agreement_template_articles")
    .delete()
    .in("template_id", [consultationId, probonoId])

  if (eDel) {
    console.error("Error deleting old articles:", eDel)
    process.exit(1)
  }

  // 3. Update template metadata
  await admin
    .from("agreement_templates")
    .update({
      title_fr: "Contrat de consultation initiale en immigration",
      title_en: "Initial Immigration Consultation Agreement",
      description_fr: "Conformément au Code de déontologie CCIC / Règlement sur le contrat de service / Guide d’élaboration.",
      description_en: "In accordance with CICC Code of Conduct / Service Agreement Regulations / Development Guide.",
      version: "2.0",
    })
    .eq("id", consultationId)

  await admin
    .from("agreement_templates")
    .update({
      title_fr: "Contrat de consultation initiale en immigration — Pro Bono",
      title_en: "Initial Immigration Consultation Agreement — Pro Bono",
      description_fr: "Consultation initiale offerte pro bono (gratuite), conforme au Code de déontologie CCIC.",
      description_en: "Initial consultation provided pro bono (free of charge), compliant with CICC regulations.",
      version: "2.0",
    })
    .eq("id", probonoId)

  // 4. Define the 13 articles
  const commonArticles = [
    {
      position: 10,
      code: "art1_parties",
      title_fr: "ARTICLE 1 — IDENTIFICATION DES PARTIES",
      title_en: "ARTICLE 1 — IDENTIFICATION OF PARTIES",
      body_fr: `1.1 LE CONSULTANT EN IMMIGRATION RÉGLEMENTÉ / The Regulated Immigration Consultant
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

Ci-après collectivement désignés les « Parties ». / Hereinafter collectively referred to as the "Parties".`,
      level: "structural",
      optional: false,
    },
    {
      position: 20,
      code: "art2_portee",
      title_fr: "ARTICLE 2 — NATURE ET PORTÉE DU SERVICE",
      title_en: "ARTICLE 2 — NATURE AND SCOPE OF SERVICE",
      body_fr: `2.1 Le présent contrat porte exclusivement sur une CONSULTATION INITIALE en immigration canadienne, telle que définie dans le Guide d’élaboration du contrat de service du CCIC. Ce contrat ne constitue pas un mandat de représentation complet.

2.2 La consultation initiale comprend les services suivants :
☑ SERVICE INCLUS DANS LA CONSULTATION INITIALE :
• Évaluation de l’admissibilité générale au Canada / Assessment of general Canadian immigration eligibility : Examen du profil et des options disponibles selon la situation du/de la client(e)
• Examen des voies d’immigration applicables / Review of applicable immigration pathways : Entrée express, parrainage, permis de travail/étude, protection des réfugiés, etc.
• Analyse des documents existants / Review of existing documents : Vérification préliminaire des documents fournis lors de la consultation
• Information générale sur les procédures IRCC / General IRCC procedure overview : Délais de traitement, exigences générales, frais gouvernementaux estimatifs
• Conseils sur les prochaines étapes à suivre / Advice on next steps : Recommandations non contraignantes sur la marche à suivre
• Réponses aux questions spécifiques du/de la client(e) / Answers to client's specific questions

2.3 LIMITES IMPORTANTES / Important Limitations :
La présente consultation initiale NE COMPREND PAS les services suivants, lesquels font l’objet d’un contrat de service distinct :
• La préparation ou le dépôt de toute demande auprès d’IRCC ou de la CISR ;
• La représentation du/de la client(e) devant les autorités gouvernementales ;
• L’examen ou la rédaction de documents juridiques ou formulaires officiels ;
• Le suivi d’un dossier d’immigration en cours ;
• Tout conseil juridique — le consultant n’est pas un avocat.`,
      level: "structural",
      optional: false,
    },
    {
      position: 30,
      code: "art3_duree_format",
      title_fr: "ARTICLE 3 — FORMAT, DATE ET DURÉE DE LA CONSULTATION",
      title_en: "ARTICLE 3 — FORMAT, DATE AND DURATION OF CONSULTATION",
      body_fr: `3.1 Format de la consultation / Consultation Format :
• En personne / In-Person — {{adresse_cabinet}}
• Par vidéoconférence / Video Conference (Zoom, Teams, Google Meet)
• Par téléphone / By Telephone
• Par courriel / By Email (échange écrit / written exchange)

3.2 Détails de la consultation / Consultation Details :
Date et heure / Date & Time : {{date_consultation}} {{heure_consultation}}
Durée prévue / Expected Duration : {{duree_consultation}}
Plateforme (si virtuel) / Platform (if virtual) : {{mode_consultation}}
Lien de réunion / Meeting Link : -

3.3 La durée de la consultation est limitée au temps indiqué ci-dessus. Toute prolongation significative peut faire l’objet d’une facturation additionnelle, avec l’accord préalable écrit du/de la client(e), conformément au Guide d’élaboration du CCIC.`,
      level: "structural",
      optional: false,
    },
    {
      position: 50,
      code: "art5_obligations_consultant",
      title_fr: "ARTICLE 5 — OBLIGATIONS DU CONSULTANT RÉGLEMENTÉ",
      title_en: "ARTICLE 5 — OBLIGATIONS OF THE REGULATED CONSULTANT",
      body_fr: `Conformément au Code de déontologie du CCIC (notamment les articles 4, 8, 9, 12, 13 et 28), le consultant s’engage à :
• Agir avec compétence, honnêteté, intégrité et dans le meilleur intérêt du/de la client(e) ;
• Communiquer les informations de manière claire et compréhensible, en tenant compte des barrières linguistiques ;
• Maintenir la confidentialité de tous les renseignements et documents obtenus lors de la consultation ;
• Informer le/la client(e) de toutes ses options d’immigration de façon complète et impartiale ;
• Ne pas fournir de fausses informations ou garantir un résultat d’immigration ;
• Aviser immédiatement le/la client(e) de tout conflit d’intérêts réel, potentiel ou apparent ;
• Remettre au/à la client(e) un exemplaire signé du présent contrat avant ou au début de la consultation ;
• Conserver un dossier de la consultation pendant au moins six (6) ans conformément aux exigences du CCIC ;
• Respecter les obligations en matière de protection des données personnelles (LPRPDE/Loi 25) ;
• Ne pas exercer de pression ni solliciter de manière abusive le/la client(e) pour des services supplémentaires.`,
      level: "structural",
      optional: false,
    },
    {
      position: 60,
      code: "art6_obligations_client",
      title_fr: "ARTICLE 6 — OBLIGATIONS DU/DE LA CLIENT(E)",
      title_en: "ARTICLE 6 — OBLIGATIONS OF THE CLIENT",
      body_fr: `Le/la client(e) s’engage à :
• Fournir des informations exactes, complètes et véridiques avant et pendant la consultation ;
• Informer le consultant de tout changement de situation susceptible d’affecter les conseils donnés ;
• Poser ses questions en temps opportun pour permettre une consultation efficace ;
• Honorer le rendez-vous ou aviser le cabinet au moins 48 heures à l’avance en cas d’empêchement ;
• Comprendre que les conseils fournis lors de la consultation initiale sont basés sur les informations communiquées et peuvent être modifiés si des éléments supplémentaires sont divulgués ultérieurement ;
• Reconnaître que la consultation initiale ne crée pas un mandat de représentation et qu’un contrat de service distinct devra être signé pour toute demande d’immigration.`,
      level: "structural",
      optional: false,
    },
    {
      position: 70,
      code: "art7_confidentialite",
      title_fr: "ARTICLE 7 — CONFIDENTIALITÉ ET PROTECTION DES RENSEIGNEMENTS PERSONNELS",
      title_en: "ARTICLE 7 — CONFIDENTIALITY AND PRIVACY PROTECTION",
      body_fr: `7.1 Conformément à la Loi sur la protection des renseignements personnels et les documents électroniques (LPRPDE) et à la Loi 25 du Québec, le Cabinet traite tous les renseignements personnels du/de la client(e) de manière strictement confidentielle.
7.2 Les renseignements collectés lors de la consultation ne seront utilisés qu’aux fins de la prestation du service convenu et ne seront divulgués à aucun tiers sans le consentement écrit préalable du/de la client(e), sauf obligation légale.
7.3 Le/la client(e) consent à la collecte et au traitement de ses données personnelles aux fins de la présente consultation. Ce consentement est révocable en tout temps, sous réserve des obligations légales applicables.`,
      level: "structural",
      optional: false,
    },
    {
      position: 80,
      code: "art8_avertissements",
      title_fr: "ARTICLE 8 — AVERTISSEMENTS IMPORTANTS ET LIMITATIONS",
      title_en: "ARTICLE 8 — IMPORTANT WARNINGS AND LIMITATIONS",
      body_fr: `⚠ AVERTISSEMENTS / WARNINGS :
• Le consultant réglementé en immigration canadienne N’EST PAS un avocat ou notaire et ne peut pas fournir de conseils juridiques. Pour toute question juridique, consultez un avocat spécialisé en droit de l’immigration.
• Aucun résultat d’immigration ne peut être garanti. Les décisions finales appartiennent exclusivement aux autorités gouvernementales (IRCC, CISR, ASFC).
• Les informations et conseils fournis lors de la consultation initiale sont valables au moment de la consultation. Les lois et politiques d’immigration changent fréquemment et peuvent affecter votre dossier.
• La consultation initiale ne crée pas de relation avocat-client et les informations partagées ne bénéficient pas du secret professionnel de l’avocat.
• La délégation illégale de pouvoirs à un tiers non autorisé est une infraction à la Loi sur l’immigration et la protection des réfugiés (LIPR).`,
      level: "structural",
      optional: false,
    },
    {
      position: 90,
      code: "art9_conflit_interets",
      title_fr: "ARTICLE 9 — DÉCLARATION DE CONFLIT D’INTÉRÊTS",
      title_en: "ARTICLE 9 — DECLARATION OF CONFLICT OF INTEREST",
      body_fr: `9.1 À la date de signature du présent contrat, le consultant déclare n’avoir aucun conflit d’intérêts réel, potentiel ou apparent dans ce dossier.
9.2 Le cas échéant, le consultant informera immédiatement le/la client(e) de tout conflit survenant après la signature du présent contrat.
☑ Aucun conflit d’intérêts identifié / No conflict of interest identified`,
      level: "structural",
      optional: false,
    },
    {
      position: 100,
      code: "art10_plaintes",
      title_fr: "ARTICLE 10 — PROCÉDURE DE PLAINTES ET RECOURS",
      title_en: "ARTICLE 10 — COMPLAINTS AND DISPUTE RESOLUTION",
      body_fr: `10.1 Toute plainte concernant les services du Cabinet doit être soumise par écrit à : {{courriel_cabinet}}. Le Cabinet s’engage à accuser réception dans les 5 jours ouvrables et à répondre dans les 30 jours.
10.2 Si la plainte n’est pas résolue à la satisfaction du/de la client(e), ce dernier/cette dernière peut soumettre une plainte formelle auprès du CCIC (Collège des consultants en immigration et en citoyenneté) :
• Site Web : www.college-ic.ca
• Formulaire de plainte disponible sur le portail du CCIC
• Téléphone : 1-877-836-7543`,
      level: "structural",
      optional: false,
    },
    {
      position: 110,
      code: "art11_notes",
      title_fr: "ARTICLE 11 — NOTES ET RÉSUMÉ DE CONSULTATION",
      title_en: "ARTICLE 11 — CONSULTATION NOTES AND SUMMARY",
      body_fr: `Conformément à l’article 18 du Règlement sur le contrat de service, le consultant est tenu de tenir des notes de consultation. Le résumé suivant sera complété à la fin de la consultation :
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

{{notes_consultation}}`,
      level: "free",
      optional: false,
    },
    {
      position: 120,
      code: "art12_dispositions",
      title_fr: "ARTICLE 12 — DISPOSITIONS GÉNÉRALES",
      title_en: "ARTICLE 12 — GENERAL PROVISIONS",
      body_fr: `1. Le présent contrat est régi par les lois de la province de Québec et les lois fédérales canadiennes applicables.
2. Toute modification au présent contrat doit faire l’objet d’un avenant écrit signé par les deux Parties.
3. Si une disposition du présent contrat est déclarée invalide ou inapplicable, les autres dispositions demeurent pleinement en vigueur.
4. Le présent contrat constitue l’intégralité de l’accord entre les Parties concernant la consultation initiale et remplace tout accord verbal antérieur.
5. En cas de divergence entre la version française et la version anglaise, la version française prévaut.`,
      level: "structural",
      optional: false,
    },
    {
      position: 130,
      code: "art13_consentement",
      title_fr: "ARTICLE 13 — CONSENTEMENT ÉCLAIRÉ ET ACCUSÉ DE RÉCEPTION",
      title_en: "ARTICLE 13 — INFORMED CONSENT AND ACKNOWLEDGEMENT",
      body_fr: `Le/la client(e) reconnaît expressément :
• Avoir lu et compris l’intégralité du présent contrat de consultation initiale ;
• Que ce contrat constitue un service de consultation limité, et NON un mandat de représentation complet ;
• Que la consultation initiale n’implique pas le dépôt de demandes d’immigration ;
• Que les honoraires convenus sont exigibles même si les conseils donnés ne correspondent pas à ses attentes ;
• Avoir eu l’opportunité de poser des questions avant de signer ;
• Avoir reçu une copie signée du présent contrat.`,
      level: "structural",
      optional: false,
    },
  ]

  // Article 4 for Standard
  const art4Standard = {
    position: 40,
    code: "art4_honoraires",
    title_fr: "ARTICLE 4 — HONORAIRES ET CONDITIONS DE PAIEMENT",
    title_en: "ARTICLE 4 — FEES AND PAYMENT TERMS",
    body_fr: `4.1 Honoraires de consultation / Consultation Fees :
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
• Le Cabinet peut annuler sans frais en cas de force majeure ou de conflit d’intérêts / The Firm may cancel without charge in case of force majeure or conflict of interest`,
    level: "structural",
    optional: false,
  }

  // Article 4 for Pro Bono
  const art4ProBono = {
    position: 40,
    code: "art4_honoraires",
    title_fr: "ARTICLE 4 — HONORAIRES ET CONDITIONS DE PAIEMENT (PRO BONO)",
    title_en: "ARTICLE 4 — PRO BONO FEES AND PAYMENT TERMS",
    body_fr: `4.1 Consultation initiale PRO BONO (gratuite / free of charge) : 0,00 $ CAD
TOTAL DÛ / TOTAL DUE : 0,00 $

4.2 La présente consultation est offerte à titre gracieux par le Cabinet dans le cadre de ses engagements d'accès à la justice et d'assistance pro bono.

4.3 Politique d’annulation : En cas d'empêchement, les Parties conviennent de s'aviser dans un délai raisonnable afin de reprogrammer la séance.`,
    level: "structural",
    optional: false,
  }

  // Insert articles for standard consultation
  for (const art of [...commonArticles, art4Standard]) {
    const { error } = await admin.from("agreement_template_articles").insert({
      template_id: consultationId,
      firm_id: null,
      ...art,
    })
    if (error) console.error("Error inserting standard art:", art.code, error)
  }

  // Insert articles for pro bono consultation
  for (const art of [...commonArticles, art4ProBono]) {
    const { error } = await admin.from("agreement_template_articles").insert({
      template_id: probonoId,
      firm_id: null,
      ...art,
    })
    if (error) console.error("Error inserting probono art:", art.code, error)
  }

  console.log("Successfully updated all articles in database!")
}

main().catch(console.error)
