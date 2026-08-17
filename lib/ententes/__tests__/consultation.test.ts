import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { variablesDe, substituer, verifierAvantGeneration } from "../variables"
import type { ContexteEntente } from "../variables"

/**
 * Tests unitaires et de conformité pour l'Entente de consultation initiale (Standard et Pro Bono)
 * Référence : Code de déontologie des titulaires de permis du CICC (DORS/2022-128), art. 23 & 24
 * et Modèle officiel de contrat de consultation initiale en immigration.
 */

const CONTEXTE_CONSULTATION: ContexteEntente = {
  contractant: {
    civility: "mr",
    firstName: "Jean",
    lastName: "Dupont",
    email: "jean.dupont@example.invalid",
    phone: "+1 514 555 0123",
    address: "456 rue Sainte-Catherine",
    city: "Montréal",
    province: "QC",
    postalCode: "H3B 1A6",
    country: "Canada",
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
  },
  montants: { honoraires: 150, taxes: 22.46, total: 172.46 },
  entente: {
    numero: "ENT-2026-0042",
    date: "2026-08-17",
    titre: "Entente de consultation initiale",
  },
  locale: "fr",
  consultation: {
    dureeMinutes: 60,
    dateHeure: "2026-08-20T14:00:00",
    mode: "visioconférence (Google Meet)",
    notes: "Évaluation préliminaire du profil Entrée express et permis de travail",
  },
}

describe("Entente de consultation initiale — Variables et substitution", () => {
  test("les variables de consultation sont correctement formatées", () => {
    const v = variablesDe(CONTEXTE_CONSULTATION)
    assert.equal(v.duree_consultation, "60 minutes")
    assert.equal(v.nom_consultant, "Monsieur Adama Diarra")
    assert.equal(v.permis_consultant, "R-514982")
    assert.equal(v.nom_complet_client, "Monsieur Jean Dupont")
    assert.match(v.honoraires, /150,00/)
    assert.match(v.total, /172,46/)
  })

  test("une durée personnalisée (ex: 45 min, 90 min) est respectée", () => {
    const ctx45: ContexteEntente = {
      ...CONTEXTE_CONSULTATION,
      consultation: { ...CONTEXTE_CONSULTATION.consultation, dureeMinutes: 45 },
    }
    const v = variablesDe(ctx45)
    assert.equal(v.duree_consultation, "45 minutes")
  })

  test("les 14 articles du modèle officiel se substituent sans variable inconnue", () => {
    const variables = variablesDe(CONTEXTE_CONSULTATION)

    const clauses = [
      // 0. Avis important
      "Ce contrat de consultation initiale est distinct d'un contrat de service complet et est régi par le Code de déontologie du CICC. Consultant : {{nom_consultant}}.",
      // 1. Identification
      "Cabinet : {{nom_cabinet}}, Consultant : {{nom_consultant}} (CRIC {{permis_consultant}}). Client : {{nom_complet_client}}, Adresse : {{adresse_client}}.",
      // 2. Nature et portée
      "Le présent contrat porte exclusivement sur une CONSULTATION INITIALE en immigration canadienne.",
      // 3. Format, date et durée
      "Durée convenue : {{duree_consultation}}. Date et heure : {{date_consultation}} {{heure_consultation}}. Mode : {{mode_consultation}}.",
      // 4. Honoraires et paiement
      "Honoraires : {{honoraires}}, taxes : {{taxes}}, total : {{total}}.",
      // 5. Obligations du consultant
      "Conformément au Code de déontologie CICC, {{nom_consultant}} s'engage à agir avec intégrité.",
      // 6. Obligations du client
      "{{nom_complet_client}} s'engage à fournir des renseignements véridiques.",
      // 7. Confidentialité et renseignements personnels
      "Conformément à la Loi 25 et LPRPDE, {{nom_consultant}} est responsable de la protection ({{courriel_cabinet}}).",
      // 8. Avertissements et limitations
      "Le consultant en immigration N'EST PAS un avocat. Aucun résultat ne peut être garanti.",
      // 9. Conflit d'intérêts
      "Le consultant déclare n'avoir aucun conflit d'intérêts réel, potentiel ou apparent.",
      // 10. Plaintes et recours
      "Toute plainte écrite est transmise à {{courriel_cabinet}} ou au Collège (CICC) sur www.college-ic.ca.",
      // 11. Notes de consultation
      "Notes et résumé : {{notes_consultation}}.",
      // 12. Dispositions générales et futur mandat (Art. 24)
      "Tout mandat de représentation subséquent exige un contrat de services distinct.",
      // 13. Consentement éclairé
      "{{nom_complet_client}} reconnaît avoir lu l'intégralité du contrat de consultation initiale.",
    ]

    for (const clause of clauses) {
      const res = substituer(clause, variables)
      assert.deepEqual(res.inconnues, [], `Variable inconnue trouvée dans : ${clause}`)
    }
  })

  test("le consultant peut personnaliser le texte d'un article dans le brouillon", () => {
    const variables = variablesDe(CONTEXTE_CONSULTATION)
    const clauseModifiee = "Clause personnalisée par {{nom_consultant}} pour le dossier de {{nom_complet_client}} avec honoraire de {{honoraires}}."
    const res = substituer(clauseModifiee, variables)
    assert.equal(res.texte, "Clause personnalisée par Monsieur Adama Diarra pour le dossier de Monsieur Jean Dupont avec honoraire de 150,00 $.")
    assert.deepEqual(res.inconnues, [])
  })
})

describe("Entente de consultation initiale — Pro Bono", () => {
  const CONTEXTE_PRO_BONO: ContexteEntente = {
    ...CONTEXTE_CONSULTATION,
    montants: { honoraires: 0, taxes: 0, total: 0 },
    proBono: true,
    entente: {
      numero: "ENT-2026-0043",
      date: "2026-08-17",
      titre: "Entente de consultation initiale — pro bono",
    },
  }

  test("la validation autorise des honoraires à 0 $ en mode pro bono", () => {
    const res = verifierAvantGeneration(CONTEXTE_PRO_BONO)
    assert.equal(res.ok, true)
  })

  test("la clause pro bono se substitue correctement", () => {
    const variables = variablesDe(CONTEXTE_PRO_BONO)
    const clause = "La présente consultation est offerte PRO BONO par {{nom_consultant}} pour {{nom_complet_client}}."
    const res = substituer(clause, variables)
    assert.equal(res.texte, "La présente consultation est offerte PRO BONO par Monsieur Adama Diarra pour Monsieur Jean Dupont.")
    assert.deepEqual(res.inconnues, [])
  })
})

describe("Non-régression des mandats de services", () => {
  const CONTEXTE_SERVICE: ContexteEntente = {
    ...CONTEXTE_CONSULTATION,
    montants: { honoraires: 4500, taxes: 673.88, total: 5173.88 },
    consultation: undefined, // Mandat régulier sans bloc consultation
    entente: {
      numero: "ENT-2026-0001",
      date: "2026-08-17",
      titre: "Entente de services professionnels en immigration",
    },
  }

  test("le contexte de mandat régulier fonctionne sans régression", () => {
    const v = variablesDe(CONTEXTE_SERVICE)
    assert.equal(v.nom_consultant, "Monsieur Adama Diarra")
    assert.match(v.honoraires, /4 500,00/)
    assert.match(v.total, /5 173,88/)
    assert.equal(v.duree_consultation, "60 minutes")
  })
})
