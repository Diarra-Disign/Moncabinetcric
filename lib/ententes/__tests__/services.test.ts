import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { variablesDe, substituer, verifierAvantGeneration } from "../variables"
import type { ContexteEntente } from "../variables"

/**
 * Tests unitaires et de conformité pour le Contrat de service professionnel en immigration
 * (Standard et Pro Bono) — sys_services et sys_services_probono
 *
 * Référence : Code de déontologie des titulaires de permis du CICC (DORS/2022-128),
 * article 24 (Exigences applicables au contrat de service) et Modèle officiel DGV Immigration.
 */

const CONTEXTE_SERVICE_STANDARD: ContexteEntente = {
  contractant: {
    civility: "mr",
    firstName: "Amadou",
    lastName: "Traoré",
    email: "amadou.traore@example.invalid",
    phone: "+1 514 555 0199",
    address: "1234 boulevard René-Lévesque Ouest",
    addressLine2: "Apt 4B",
    city: "Montréal",
    province: "Québec",
    postalCode: "H3G 1T7",
    country: "Canada",
    birthDate: "1988-04-12",
  },
  cabinet: {
    nom: "Cabinet Immigration Boréale Inc.",
    consultant: "Adama Diarra",
    civiliteConsultant: "mr",
    permis: "R-514982",
    adresse: "88 rue Dollard-des-Ormeaux",
    adresseComplement: "Bureau 801",
    ville: "Gatineau",
    province: "Québec",
    codePostal: "J8X 0B9",
    pays: "Canada",
    courriel: "contact@immigrationboreale.ca",
    telephone: "+1 819 555 0100",
    siteWeb: "www.immigrationboreale.ca",
  },
  montants: { honoraires: 4500, taxes: 673.88, total: 5173.88 },
  entente: {
    numero: "ENT-2026-0105",
    date: "2026-08-17",
    titre: "Contrat de service professionnel en immigration",
  },
  locale: "fr",
  mandat: {
    conseilsPreliminaires: "Évaluation du profil Entrée express — catégorie de l'expérience canadienne.",
    personnelIntervenant: "Fatou Diop (assistante juridique), Marc Tremblay (parajuriste).",
    instructionsClient: "Préparation et soumission d'une demande de résidence permanente avec conjoint de fait.",
    descriptionServices: "1. Analyse des documents d'admissibilité\n2. Rédaction des formulaires IRCC\n3. Lettre explicative et soumission\n4. Suivi jusqu'à décision finale.",
    exclusionsSpecifiques: "Traductions non assermentées et révision judiciaire devant la Cour fédérale.",
    dateFinMandat: "À la décision finale rendue par IRCC.",
    deboursPrevisibles: "Frais de traitement IRCC : 1 525 $ CAD, Biométrie : 85 $ CAD.",
    documentsSpecifiques: "Certificat de police du Mali et relevés bancaires des 6 derniers mois.",
  },
}

describe("Entente de services professionnels — Mandat Standard (sys_services)", () => {
  test("les variables obligatoires du mandat sont correctement formatées", () => {
    const v = variablesDe(CONTEXTE_SERVICE_STANDARD)
    assert.equal(v.nom_consultant, "Monsieur Adama Diarra")
    assert.equal(v.permis_consultant, "R-514982")
    assert.equal(v.nom_cabinet, "Cabinet Immigration Boréale Inc.")
    assert.equal(v.nom_complet_client, "Monsieur Amadou Traoré")
    assert.equal(v.courriel_client, "amadou.traore@example.invalid")
    assert.match(v.adresse_client, /1234 boulevard René-Lévesque Ouest/)
    assert.match(v.honoraires, /4 500,00/)
    assert.match(v.taxes, /673,88/)
    assert.match(v.total, /5 173,88/)
    assert.match(v.conseils_preliminaires, /Entrée express/)
    assert.match(v.personnel_intervenant, /Fatou Diop/)
    assert.match(v.instructions_client, /résidence permanente/)
    assert.match(v.debours_previsibles, /1 525/)
    assert.match(v.documents_specifiques, /Mali/)
  })

  test("tous les 25 articles et l'Annexe A se substituent sans aucune variable inconnue", () => {
    const variables = variablesDe(CONTEXTE_SERVICE_STANDARD)

    const clauses = [
      // Art 1 - Parties
      "Cabinet : {{nom_cabinet}}, Consultant : {{nom_consultant}} ({{permis_consultant}}), Adresse : {{adresse_cabinet}}, Courriel : {{courriel_cabinet}}, Web : {{site_cabinet}}. Client : {{nom_complet_client}}, DOB : {{date_naissance_client}}, Nationalité : {{nationalite_client}}, Passeport : {{passeport_client}}, Adresse : {{adresse_client}}, Tél : {{telephone_client}}, Courriel : {{courriel_client}}, Statut : {{statut_canada_client}}.",
      // Art 2 - Objet & Conseils
      "Conforme au Code de déontologie DORS/2022-128. Conseils préliminaires : {{conseils_preliminaires}}.",
      // Art 3 - Supervision & Intervenants
      "Supervision directe de {{nom_consultant}}. Personnel susceptible d'assister : {{personnel_intervenant}}.",
      // Art 4 - Instructions client
      "Instructions spécifiques du client : {{instructions_client}}.",
      // Art 5 - Services inclus
      "Services individualisés : {{description_services_detailles}}.",
      // Art 6 - Exclusions
      "Exclusions convenues : {{exclusions_specifiques}}.",
      // Art 7 - Durée
      "Date d'effet : {{date_contrat}}. Échéance : {{date_fin_mandat}}.",
      // Art 8 - Honoraires & Taxes
      "Honoraires : {{honoraires}}, Taxes : {{taxes}}, Total : {{total}}, Taux : {{taux_horaire}}, Heures : {{heures_estimees}}.",
      // Art 9 - Échéancier & Fidéicommis
      "Calendrier : {{echeancier_etapes}}. Avances en fidéicommis.",
      // Art 10 - Débours
      "Débours prévus : {{debours_previsibles}}.",
      // Art 11 - Remboursement
      "Sommes non acquises remboursées sous 15 jours.",
      // Art 12 - Obligations consultant
      "Compétence, diligence, information opportune par {{nom_consultant}}.",
      // Art 13 - Obligations client
      "{{nom_complet_client}} s'engage à collaborer et transmettre les pièces véridiques.",
      // Art 14 - Retard & Défaut
      "Distinction retards client vs retards administratifs.",
      // Art 15 - Garantie de résultat & Responsabilité
      "Aucune garantie de visa par {{nom_consultant}}. Assurance professionnelle CCIC.",
      // Art 16 - Confidentialité & Loi 25
      "Responsable vie privée : {{nom_consultant}} ({{courriel_cabinet}}), conservation 6 ans.",
      // Art 17 - Conflit d'intérêts
      "Déclaration d'absence de conflit d'intérêts pour {{nom_complet_client}}.",
      // Art 18 - Documents originaux
      "Restitution des documents originaux sous 30 jours.",
      // Art 19 - Résiliation
      "Résiliation écrite et état de compte.",
      // Art 20 - Langue & Portail
      "Langue : {{langue_preferee_client}}. Communications par portail client.",
      // Art 21 - Plaintes
      "Plainte interne à {{courriel_cabinet}} ou CCIC (www.college-ic.ca).",
      // Art 22 - Incapacité
      "Transfert de dossier ordonné en cas d'incapacité de {{nom_consultant}}.",
      // Art 23 - Modification
      "Avenant écrit signé obligatoire pour toute modification.",
      // Art 24 - Droit applicable & Code
      "Lois du Québec et remise du Code de déontologie.",
      // Art 25 - Consentement & Signatures
      "Consentement éclairé de {{nom_complet_client}} et de {{nom_consultant}}.",
      // Annexe A - Checklist
      "Pièces requises : {{documents_specifiques}}.",
    ]

    for (const clause of clauses) {
      const res = substituer(clause, variables)
      assert.deepEqual(res.inconnues, [], `Variable inconnue détectée dans : ${clause}`)
    }
  })

  test("la validation avant génération réussit avec toutes les informations requises", () => {
    const res = verifierAvantGeneration(CONTEXTE_SERVICE_STANDARD)
    assert.equal(res.ok, true)
  })
})

describe("Entente de services professionnels — Mandat Pro Bono (sys_services_probono)", () => {
  const CONTEXTE_SERVICE_PRO_BONO: ContexteEntente = {
    ...CONTEXTE_SERVICE_STANDARD,
    montants: { honoraires: 0, taxes: 0, total: 0 },
    proBono: true,
    entente: {
      numero: "ENT-2026-0106",
      date: "2026-08-17",
      titre: "Contrat de service professionnel en immigration — Pro Bono",
    },
  }

  test("la validation autorise un total d'honoraires à 0 $ pour un mandat pro bono", () => {
    const res = verifierAvantGeneration(CONTEXTE_SERVICE_PRO_BONO)
    assert.equal(res.ok, true)
  })

  test("la clause pro bono se substitue avec exactitude", () => {
    const variables = variablesDe(CONTEXTE_SERVICE_PRO_BONO)
    const clauseProBono = "Mandat exécuté PRO BONO par {{nom_consultant}} pour {{nom_complet_client}} avec honoraires de {{honoraires}}."
    const res = substituer(clauseProBono, variables)
    assert.equal(
      res.texte,
      "Mandat exécuté PRO BONO par Monsieur Adama Diarra pour Monsieur Amadou Traoré avec honoraires de 0,00 $."
    )
    assert.deepEqual(res.inconnues, [])
  })
})

describe("Garantie de non-régression des consultations initiales", () => {
  const CONTEXTE_CONSULTATION: ContexteEntente = {
    contractant: {
      firstName: "Claire",
      lastName: "Lemoine",
      email: "claire.lemoine@example.invalid",
      address: "500 rue Saint-Paul",
      city: "Québec",
      province: "QC",
      postalCode: "G1K 3V7",
      country: "Canada",
    },
    cabinet: {
      nom: "Cabinet Immigration Boréale Inc.",
      consultant: "Adama Diarra",
      permis: "R-514982",
      adresse: "88 rue Dollard-des-Ormeaux",
      ville: "Gatineau",
      province: "Québec",
      codePostal: "J8X 0B9",
      pays: "Canada",
      courriel: "contact@immigrationboreale.ca",
    },
    montants: { honoraires: 150, taxes: 22.46, total: 172.46 },
    entente: {
      numero: "ENT-2026-0099",
      date: "2026-08-17",
      titre: "Contrat de consultation initiale en immigration",
    },
    locale: "fr",
    consultation: {
      dureeMinutes: 60,
      mode: "visioconférence",
      notes: "Évaluation permis d'études",
    },
  }

  test("les variables de consultation continuent de fonctionner parfaitement", () => {
    const v = variablesDe(CONTEXTE_CONSULTATION)
    assert.equal(v.duree_consultation, "60 minutes")
    assert.equal(v.nom_consultant, "Adama Diarra")
    assert.match(v.honoraires, /150,00/)
    assert.equal(v.mode_consultation, "visioconférence")
  })
})
