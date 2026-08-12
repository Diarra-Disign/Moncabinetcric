import { test, describe } from "node:test"
import assert from "node:assert/strict"
import { variablesDe, substituer, verifierAvantGeneration } from "../variables"
import type { ContexteEntente } from "../variables"

/**
 * Les variables d'un contrat, et ce qui doit empêcher de le générer.
 *
 * Deux défauts que ces épreuves cherchent à rendre impossibles :
 *
 * 1. Une variable inconnue laissée telle quelle. « {{adresse_client}} »
 *    imprimé dans un contrat envoyé à un client est le pire des résultats :
 *    silencieux à la génération, visible pour lui seul.
 *
 * 2. Un contrat généré sans les informations essentielles. Le §29 demande de
 *    l'empêcher et de NOMMER ce qui manque — « informations incomplètes » ne
 *    dit pas où retourner.
 */

const CONTEXTE: ContexteEntente = {
  contractant: {
    civility: "mrs", firstName: "Awa", lastName: "Diallo",
    email: "awa@example.invalid", phone: "+1 514 555 0199",
    address: "12 rue des Érables", city: "Montréal", province: "QC",
    postalCode: "H2X 1Y4", country: "Canada",
  },
  cabinet: {
    nom: "Diarra Global Visa", consultant: "Adama Diarra", civiliteConsultant: "mr",
    permis: "R1041776",
    adresse: "88 rue Dollard-des-Ormeaux", adresseComplement: "Bureau 801",
    ville: "Gatineau", province: "Québec", codePostal: "J8X 0B9", pays: "Canada",
    courriel: "infos@dgvimmigration.com", telephone: "+1 514 555 0100",
  },
  montants: { honoraires: 4500, taxes: 673.88, total: 5173.88 },
  entente: { numero: "ENT-2026-0001", date: "2026-08-11", titre: "Entente de services" },
  locale: "fr",
}

describe("variablesDe", () => {
  test("la civilité produit une formule complète", () => {
    const v = variablesDe(CONTEXTE)
    assert.equal(v.civilite, "Madame")
    assert.equal(v.nom_complet_client, "Madame Awa Diallo")
    assert.equal(v.prenom_client, "Awa")
    assert.equal(v.nom_client, "Diallo")
  })

  test("le nom reste seul quand la civilité manque", () => {
    // « ,  Diallo » en tête d'un contrat se remarque, et c'est celui qui part
    // chez le client.
    const v = variablesDe({ ...CONTEXTE, contractant: { ...CONTEXTE.contractant, civility: null } })
    assert.equal(v.civilite, "")
    assert.equal(v.nom_complet_client, "Awa Diallo")
  })

  test("les montants sont formatés en dollars canadiens", () => {
    const v = variablesDe(CONTEXTE)
    assert.match(v.honoraires, /4 500,00/)
    assert.match(v.total, /5 173,88/)
    // Aucune espace insécable : les polices standard d'un PDF ne les couvrent
    // pas, et le moteur de facturation a déjà buté dessus.
    assert.ok(!/[  ]/.test(v.honoraires), "espace insécable dans le montant")
  })

  test("le consultant vient des paramètres, jamais retapé", () => {
    const v = variablesDe(CONTEXTE)
    assert.equal(v.nom_consultant, "Monsieur Adama Diarra")
    assert.equal(v.nom_cabinet, "Diarra Global Visa")
    assert.equal(v.permis_consultant, "R1041776")
  })

  test("l'adresse du contractant se compose sur une ligne", () => {
    // Format canadien : la province entre parenthèses, pas après une virgule.
    // « Montréal, QC H2X 1Y4 » est une habitude américaine ; Postes Canada et
    // les contrats de référence écrivent « Montréal (QC) H2X 1Y4 ».
    const v = variablesDe(CONTEXTE)
    assert.equal(v.adresse_client, "12 rue des Érables, Montréal (QC) H2X 1Y4, Canada")
  })

  test("une adresse partielle ne laisse pas de virgules orphelines", () => {
    const v = variablesDe({
      ...CONTEXTE,
      contractant: { ...CONTEXTE.contractant, city: "", province: "", postalCode: "", country: "" },
    })
    assert.equal(v.adresse_client, "12 rue des Érables")
  })
})

describe("substituer", () => {
  test("remplace ce qu'elle connaît", () => {
    const r = substituer("Entre {{nom_cabinet}} et {{nom_complet_client}}.", variablesDe(CONTEXTE))
    assert.equal(r.texte, "Entre Diarra Global Visa et Madame Awa Diallo.")
    assert.deepEqual(r.inconnues, [])
  })

  test("SIGNALE ce qu'elle ne connaît pas au lieu de le laisser passer", () => {
    const r = substituer("Le {{jour_de_la_marmotte}} à {{lieu_inconnu}}.", variablesDe(CONTEXTE))
    assert.deepEqual(r.inconnues.sort(), ["jour_de_la_marmotte", "lieu_inconnu"])
  })

  test("une variable connue mais VIDE n'est pas une inconnue", () => {
    // Un téléphone absent laisse un blanc ; c'est un renseignement manquant,
    // pas une faute de modèle. Les deux se corrigent à des endroits
    // différents, donc ils ne doivent pas se confondre.
    const v = variablesDe({ ...CONTEXTE, contractant: { ...CONTEXTE.contractant, phone: "" } })
    const r = substituer("Tél : {{telephone_client}}", v)
    assert.equal(r.texte, "Tél : ")
    assert.deepEqual(r.inconnues, [])
  })

  test("tolère les espaces dans les accolades", () => {
    const r = substituer("{{ nom_cabinet }}", variablesDe(CONTEXTE))
    assert.equal(r.texte, "Diarra Global Visa")
  })

  test("la même variable répétée est remplacée partout", () => {
    const r = substituer("{{prenom_client}} et {{prenom_client}}", variablesDe(CONTEXTE))
    assert.equal(r.texte, "Awa et Awa")
  })
})

describe("verifierAvantGeneration", () => {
  test("un contexte complet passe", () => {
    assert.equal(verifierAvantGeneration(CONTEXTE).ok, true)
  })

  test("nomme CE qui manque, pas « informations incomplètes »", () => {
    const r = verifierAvantGeneration({
      ...CONTEXTE,
      contractant: { ...CONTEXTE.contractant, email: "", address: "" },
    })
    assert.equal(r.ok, false)
    if (r.ok) return
    assert.equal(r.manquants.length, 2)
    assert.ok(r.manquants.some((m) => /courriel/i.test(m)), r.manquants.join(" | "))
    assert.ok(r.manquants.some((m) => /adresse/i.test(m)), r.manquants.join(" | "))
  })

  test("des honoraires à zéro bloquent — SAUF en pro bono", () => {
    const sansHonoraires = { ...CONTEXTE, montants: { honoraires: 0, taxes: 0, total: 0 } }
    assert.equal(verifierAvantGeneration(sansHonoraires).ok, false)
    // Pro bono, l'absence d'honoraires est le propos du contrat, pas un oubli.
    assert.equal(verifierAvantGeneration({ ...sansHonoraires, proBono: true }).ok, true)
  })

  test("le permis du consultant est exigé — c'est ce qui l'identifie", () => {
    const r = verifierAvantGeneration({ ...CONTEXTE, cabinet: { ...CONTEXTE.cabinet, permis: "" } })
    assert.equal(r.ok, false)
    if (!r.ok) assert.ok(r.manquants.some((m) => /permis/i.test(m)))
  })

  test("une variable inconnue dans le texte bloque aussi la génération", () => {
    const r = verifierAvantGeneration(CONTEXTE, ["Bonjour {{variable_fantome}}"])
    assert.equal(r.ok, false)
    if (!r.ok) assert.ok(r.manquants.some((m) => /variable_fantome/.test(m)), r.manquants.join(" | "))
  })
})

/**
 * L'ADRESSE PROFESSIONNELLE DU CONSULTANT.
 *
 * Ce que ces épreuves cherchent à prendre en défaut : un contrat qui identifie
 * le client et pas le représentant. Le cabinet ne figurait jusqu'ici que dans
 * l'en-tête du PDF, avec une adresse d'UNE ligne — pas de ville, pas de
 * province. Un contrat qui dit « domicilié au 88 rue Dollard-des-Ormeaux »
 * sans dire dans quelle ville n'identifie personne, et c'est ce document-là
 * que lit le Collège.
 */
describe("l'adresse professionnelle du consultant", () => {
  test("elle se compose au format canadien, complément compris", () => {
    const v = variablesDe(CONTEXTE)
    assert.equal(
      v.adresse_consultant_complete,
      "88 rue Dollard-des-Ormeaux, Bureau 801, Gatineau (Québec) J8X 0B9, Canada"
    )
  })

  test("adresse_cabinet rend la MÊME chose — les modèles fournis l'emploient", () => {
    // Le nom de la variable n'a pas changé : le renommer aurait cassé chaque
    // modèle déjà écrit, y compris ceux qu'un cabinet aurait personnalisés.
    const v = variablesDe(CONTEXTE)
    assert.equal(v.adresse_cabinet, v.adresse_consultant_complete)
  })

  test("un bureau non renseigné ne laisse pas de virgule orpheline", () => {
    const v = variablesDe({
      ...CONTEXTE,
      cabinet: { ...CONTEXTE.cabinet, adresseComplement: "" },
    })
    assert.equal(
      v.adresse_consultant_complete,
      "88 rue Dollard-des-Ormeaux, Gatineau (Québec) J8X 0B9, Canada"
    )
  })

  test("chaque morceau a sa variable, pour un modèle qui compose lui-même", () => {
    const v = variablesDe(CONTEXTE)
    assert.equal(v.adresse_consultant, "88 rue Dollard-des-Ormeaux")
    assert.equal(v.complement_consultant, "Bureau 801")
    assert.equal(v.ville_consultant, "Gatineau")
    assert.equal(v.province_consultant, "Québec")
    assert.equal(v.code_postal_consultant, "J8X 0B9")
    assert.equal(v.pays_consultant, "Canada")
    assert.equal(v.telephone_consultant, "+1 514 555 0100")
    assert.equal(v.courriel_consultant, "infos@dgvimmigration.com")
  })

  test("une adresse professionnelle sans ville : GÉNÉRATION REFUSÉE", () => {
    const r = verifierAvantGeneration({
      ...CONTEXTE,
      cabinet: { ...CONTEXTE.cabinet, ville: "" },
    })
    assert.equal(r.ok, false)
    if (r.ok) return
    // Le refus NOMME le morceau manquant : « adresse incomplète » n'apprend
    // pas au consultant que c'est la ville, et il rouvrira ses paramètres pour
    // chercher.
    assert.ok(r.manquants.some((m) => /la ville/.test(m)), r.manquants.join(" | "))
  })

  test("le refus mène aux PARAMÈTRES et non à la fiche du client", () => {
    const r = verifierAvantGeneration({
      ...CONTEXTE,
      cabinet: { ...CONTEXTE.cabinet, province: "" },
    })
    assert.equal(r.ok, false)
    // C'est ce drapeau qui fait apparaître « Compléter mon profil » (§5). Sans
    // lui, l'écran annonce un manque et laisse chercher où le corriger.
    if (!r.ok) assert.equal(r.profilACompleter, true)
  })

  test("un manque du CÔTÉ CLIENT ne renvoie pas vers les paramètres", () => {
    const r = verifierAvantGeneration({
      ...CONTEXTE,
      contractant: { ...CONTEXTE.contractant, email: "" },
    })
    assert.equal(r.ok, false)
    if (!r.ok) assert.notEqual(r.profilACompleter, true)
  })

  test("le scénario du cahier des charges : deux adresses, aucun mélange", () => {
    const v = variablesDe({
      ...CONTEXTE,
      cabinet: {
        nom: "DGV Immigration", consultant: "Adama Diarra", civiliteConsultant: "mr",
        permis: "R1041776",
        adresse: "123, rue Exemple", adresseComplement: "Bureau 200",
        ville: "Gatineau", province: "Québec", codePostal: "J8X 1A1", pays: "Canada",
        courriel: "infos@dgvimmigration.com", telephone: "819 555 0100",
      },
      contractant: {
        civility: "mrs", firstName: "Fatou", lastName: "Traoré",
        email: "fatou@example.ca", phone: "514 555 0123",
        address: "456, rue Exemple", addressLine2: "Appartement 4",
        city: "Montréal", province: "Québec", postalCode: "H2X 1B2", country: "Canada",
      },
      locale: "fr",
    })

    assert.equal(
      v.adresse_consultant_complete,
      "123, rue Exemple, Bureau 200, Gatineau (Québec) J8X 1A1, Canada"
    )
    assert.equal(
      v.adresse_client,
      "456, rue Exemple, Appartement 4, Montréal (Québec) H2X 1B2, Canada"
    )
    // Le contrôle qui compte : rien d'un bloc ne se retrouve dans l'autre.
    assert.ok(!v.adresse_client.includes("Gatineau"))
    assert.ok(!v.adresse_consultant_complete.includes("Montréal"))
    assert.equal(v.nom_complet_client, "Madame Fatou Traoré")
    assert.equal(v.nom_consultant, "Monsieur Adama Diarra")
  })
})
