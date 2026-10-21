import { test, describe } from "node:test"
import assert from "node:assert/strict"
import {
  abonnementCouvre,
  abonnementVivant,
  effetOctroi,
  etatCommercial,
  modeOuverture,
  peutReglerAbonnementFerme,
  raisonAccesFerme,
  tarifPublic,
  type Plan,
} from "../plans"

/**
 * La règle qui dit ce que produira l'octroi d'un plan depuis la console.
 *
 * Elle est éprouvée à part parce qu'elle DOIT rester le miroir exact de deux
 * fonctions SQL — `firm_access_open()` et `firm_effective_plan()`. Le jour où
 * l'une des deux change en base sans que celle-ci suive, la console annoncera
 * un effet qui ne se produit pas, et personne ne s'en apercevra : le message
 * est rassurant, et l'exploitant ne revérifie pas ce qu'on lui a confirmé.
 *
 * Le cas qui a motivé tout ceci : un cabinet au forfait « solo » dont
 * l'abonnement est résilié. La console ne proposait alors AUCUN bouton — il
 * fallait un terminal pour rouvrir l'accès.
 */
describe("abonnementCouvre", () => {
  test("actif et en essai donnent des droits", () => {
    assert.equal(abonnementCouvre("active", ""), true)
    assert.equal(abonnementCouvre("trialing", ""), true)
  })

  test("résilié n'en donne aucun, même avec un délai de grâce encore ouvert", () => {
    const demain = new Date(Date.now() + 86400000).toISOString()
    assert.equal(abonnementCouvre("canceled", demain), false)
  })

  test("l'impayé est couvert tant que le délai de grâce court", () => {
    const demain = new Date(Date.now() + 86400000).toISOString()
    const hier = new Date(Date.now() - 86400000).toISOString()
    assert.equal(abonnementCouvre("past_due", demain), true)
    assert.equal(abonnementCouvre("past_due", hier), false)
    assert.equal(abonnementCouvre("unpaid", demain), true)
  })

  test("un impayé sans délai de grâce n'est pas couvert", () => {
    assert.equal(abonnementCouvre("past_due", ""), false)
  })

  test("une date illisible ne vaut pas une autorisation", () => {
    assert.equal(abonnementCouvre("past_due", "bientôt"), false)
  })

  test("l'absence d'abonnement ne donne rien", () => {
    assert.equal(abonnementCouvre("", ""), false)
  })
})

describe("effetOctroi", () => {
  const base = { statutCabinet: "active", statutAbonnement: "", graceJusqua: "" }

  test("le cas qui a tout déclenché : forfait payant, abonnement résilié → l'octroi rouvre", () => {
    assert.equal(effetOctroi({ ...base, statutAbonnement: "canceled" }), "rouvre")
  })

  test("un cabinet qui paie encore : l'octroi n'aurait aucun effet sur ses droits", () => {
    assert.equal(effetOctroi({ ...base, statutAbonnement: "active" }), "abonnement-prime")
  })

  test("la suspension est souveraine, y compris sur un cabinet à jour", () => {
    assert.equal(
      effetOctroi({ statutCabinet: "suspended", statutAbonnement: "active", graceJusqua: "" }),
      "suspendu"
    )
  })

  test("la suspension prime aussi sur un abonnement résilié", () => {
    assert.equal(
      effetOctroi({ statutCabinet: "suspended", statutAbonnement: "canceled", graceJusqua: "" }),
      "suspendu"
    )
  })

  test("aucun abonnement du tout — un cabinet créé à la main — l'octroi rouvre", () => {
    assert.equal(effetOctroi(base), "rouvre")
  })

  test("un impayé hors délai de grâce se comporte comme une résiliation", () => {
    const hier = new Date(Date.now() - 86400000).toISOString()
    assert.equal(
      effetOctroi({ ...base, statutAbonnement: "past_due", graceJusqua: hier }),
      "rouvre"
    )
  })
})

/**
 * La raison affichée à quelqu'un qui ne peut plus entrer.
 *
 * Ces épreuves défendent une distinction que l'écran ne faisait pas : un
 * abonnement terminé n'est PAS une suspension. Le consultant lisait « l'accès
 * de ce cabinet a été fermé, contactez l'exploitant » alors qu'il lui
 * suffisait de reprendre un abonnement — proposé quelques centimètres plus
 * bas, et qu'il ne voyait pas.
 *
 * `ouvert` est vérifié aussi, et pour une raison précise : il signale un
 * désaccord entre cette fonction et `firm_access_open()`. S'il apparaît alors
 * que l'écran s'affiche, c'est l'une des deux qui a dérivé.
 */
describe("raisonAccesFerme", () => {
  const base = {
    statutCabinet: "active",
    plan: "solo",
    finEssai: "",
    statutAbonnement: "",
    graceJusqua: "",
  }
  const jour = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)

  test("le cas qui a motivé la correction : forfait payant, abonnement résilié", () => {
    assert.equal(
      raisonAccesFerme({ ...base, statutAbonnement: "canceled" }),
      "abonnement-termine"
    )
  })

  test("la suspension prime sur tout, y compris un abonnement actif", () => {
    assert.equal(
      raisonAccesFerme({ ...base, statutCabinet: "suspended", statutAbonnement: "active" }),
      "suspendu"
    )
  })

  test("un essai échu hier est échu ; celui qui finit aujourd'hui court encore", () => {
    assert.equal(raisonAccesFerme({ ...base, plan: "trial", finEssai: jour(-1) }), "essai-echu")
    assert.equal(raisonAccesFerme({ ...base, plan: "trial", finEssai: jour(0) }), "ouvert")
    assert.equal(raisonAccesFerme({ ...base, plan: "trial", finEssai: jour(30) }), "ouvert")
  })

  test("un impayé hors délai de grâce se distingue d'une résiliation", () => {
    assert.equal(
      raisonAccesFerme({ ...base, statutAbonnement: "past_due", graceJusqua: jour(-1) }),
      "paiement-en-souffrance"
    )
    assert.equal(
      raisonAccesFerme({ ...base, statutAbonnement: "unpaid", graceJusqua: "" }),
      "paiement-en-souffrance"
    )
  })

  test("un impayé DANS son délai de grâce n'est pas fermé du tout", () => {
    assert.equal(
      raisonAccesFerme({ ...base, statutAbonnement: "past_due", graceJusqua: jour(3) }),
      "ouvert"
    )
  })

  test("la courtoisie ouvre par elle-même, sans essai ni abonnement", () => {
    assert.equal(raisonAccesFerme({ ...base, plan: "courtoisie" }), "ouvert")
  })

  test("un abonnement actif sur un forfait payant n'est pas fermé", () => {
    assert.equal(raisonAccesFerme({ ...base, statutAbonnement: "active" }), "ouvert")
  })

  test("un forfait payant sans aucun abonnement se lit comme terminé", () => {
    assert.equal(raisonAccesFerme(base), "abonnement-termine")
  })

  test("un nouveau client à qui l'on a proposé un forfait n'a rien « terminé » : il doit souscrire", () => {
    assert.equal(
      raisonAccesFerme({ ...base, plan: "cabinet", statutAbonnement: "incomplete" }),
      "souscription-attendue"
    )
  })

  test("une offre en attente ne referme pas un essai qui court encore", () => {
    assert.equal(
      raisonAccesFerme({ ...base, plan: "trial", finEssai: jour(5), statutAbonnement: "incomplete" }),
      "ouvert"
    )
  })
})

const forfaitDe = (surcharge: Partial<Plan> = {}): Plan => ({
  key: "cabinet", labelFr: "Cabinet Pro", labelEn: "Firm Pro", taglineFr: "", taglineEn: "",
  rank: 30, purchasable: true, monthly: 7900, annual: 79000, extraSeatMonthly: 2500,
  extraSeatAnnual: 25000, seatsIncluded: 3, maxSeats: null, aiConnector: true,
  ...surcharge,
})

/**
 * Comment la console peut ouvrir un cabinet sur un forfait donné.
 *
 * La règle protège deux promesses à la fois : un forfait payant ne s'accorde
 * jamais d'un clic, et un forfait dont le prix n'est pas arrêté ne part jamais
 * dans un lien de souscription.
 */
describe("modeOuverture", () => {
  test("l'essai et la courtoisie s'accordent, quoi que dise le catalogue", () => {
    assert.equal(modeOuverture(forfaitDe({ key: "trial", purchasable: false, monthly: null, annual: null })), "accorde")
    assert.equal(modeOuverture(forfaitDe({ key: "courtoisie", purchasable: true })), "accorde")
  })

  test("un forfait souscriptible et chiffré se propose par lien", () => {
    assert.equal(modeOuverture(forfaitDe()), "lien")
    assert.equal(modeOuverture(forfaitDe({ key: "solo", monthly: 4900, annual: 49000 })), "lien")
  })

  test("un forfait négocié, sans souscription en ligne, est à configurer", () => {
    assert.equal(
      modeOuverture(forfaitDe({ key: "enterprise", purchasable: false, monthly: null, annual: null })),
      "a-configurer"
    )
  })

  test("un prix manquant ou nul suffit à retirer le lien", () => {
    assert.equal(modeOuverture(forfaitDe({ monthly: null })), "a-configurer")
    assert.equal(modeOuverture(forfaitDe({ annual: 0 })), "a-configurer")
  })
})

/**
 * Le statut commercial affiché par la console.
 *
 * Il se DÉDUIT de ce que Stripe a écrit et de ce que l'exploitant a décidé ;
 * il n'est stocké nulle part. Une colonne « statut » de plus serait une
 * troisième vérité à tenir d'accord avec les deux autres.
 */
describe("etatCommercial", () => {
  const jour = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)
  const base = {
    statutCabinet: "active",
    plan: "cabinet",
    finEssai: "",
    statutAbonnement: "",
    abonnementStripe: false,
    resiliationDemandee: false,
  }

  test("la suspension prime, même sur un abonnement à jour", () => {
    assert.equal(
      etatCommercial({ ...base, statutCabinet: "suspended", statutAbonnement: "active", abonnementStripe: true }),
      "suspendu"
    )
  })

  test("la courtoisie se lit comme telle", () => {
    assert.equal(etatCommercial({ ...base, plan: "courtoisie" }), "courtoisie")
  })

  test("actif seulement quand Stripe le dit, et la résiliation prévue se voit", () => {
    const actif = { ...base, statutAbonnement: "active", abonnementStripe: true }
    assert.equal(etatCommercial(actif), "actif")
    assert.equal(etatCommercial({ ...actif, resiliationDemandee: true }), "resiliation-prevue")
  })

  test("un paiement refusé se signale, délai de grâce ou non", () => {
    assert.equal(
      etatCommercial({ ...base, statutAbonnement: "past_due", abonnementStripe: true }),
      "paiement-echoue"
    )
    assert.equal(etatCommercial({ ...base, statutAbonnement: "unpaid", abonnementStripe: true }), "paiement-echoue")
  })

  test("l'essai court ou est échu, offre en attente ou non", () => {
    assert.equal(etatCommercial({ ...base, plan: "trial", finEssai: jour(10) }), "essai")
    assert.equal(etatCommercial({ ...base, plan: "trial", finEssai: jour(-1) }), "essai-echu")
    assert.equal(
      etatCommercial({ ...base, plan: "trial", finEssai: jour(10), statutAbonnement: "incomplete" }),
      "essai"
    )
  })

  test("une offre jamais réglée attend la souscription ; un paiement entamé chez Stripe attend le paiement", () => {
    assert.equal(etatCommercial({ ...base, statutAbonnement: "incomplete" }), "attente-souscription")
    assert.equal(
      etatCommercial({ ...base, statutAbonnement: "incomplete", abonnementStripe: true }),
      "attente-paiement"
    )
  })

  test("un abonnement que Stripe n'a pas confirmé n'est jamais présenté comme actif", () => {
    for (const statut of ["incomplete", "incomplete_expired", "canceled", "paused", ""]) {
      assert.notEqual(etatCommercial({ ...base, statutAbonnement: statut, abonnementStripe: true }), "actif", statut)
    }
  })

  test("résilié, expiré ou en pause", () => {
    assert.equal(etatCommercial({ ...base, statutAbonnement: "canceled", abonnementStripe: true }), "annule")
    assert.equal(etatCommercial({ ...base, statutAbonnement: "incomplete_expired", abonnementStripe: true }), "annule")
    assert.equal(etatCommercial({ ...base, statutAbonnement: "paused", abonnementStripe: true }), "en-pause")
  })

  test("un forfait payant sans aucune ligne d'abonnement", () => {
    assert.equal(etatCommercial(base), "sans-abonnement")
  })
})

/**
 * Quand une offre peut-elle prendre la place d'un abonnement Stripe ?
 *
 * Seulement quand il est terminé. Écrire une offre sur un abonnement vivant
 * fermerait l'accès d'un cabinet qui paie : la ligne repasserait en
 * « incomplete », que firm_access_open() ignore.
 */
/**
 * Qui peut payer quand l'accès est fermé ?
 *
 * member_can('firm.billing') ne reconnaît le propriétaire que d'un cabinet
 * OUVERT : l'écran de paiement greffé sur l'écran de refus menait donc à un
 * refus de permission — essai échu, impayé, nouveau client. Cette règle
 * prend le relais, et seulement quand l'accès est fermé.
 */
describe("peutReglerAbonnementFerme", () => {
  const base = { role: "owner", statutMembre: "active", statutCabinet: "active" }

  test("le propriétaire actif d'un cabinet non suspendu peut payer", () => {
    assert.equal(peutReglerAbonnementFerme(base), true)
  })

  test("un autre rôle ne le peut pas, la permission étant réservée au propriétaire", () => {
    for (const role of ["rcic", "risia", "staff", "bookkeeper", "readonly"]) {
      assert.equal(peutReglerAbonnementFerme({ ...base, role }), false, role)
    }
  })

  test("un propriétaire suspendu ou révoqué ne le peut pas", () => {
    assert.equal(peutReglerAbonnementFerme({ ...base, statutMembre: "suspended" }), false)
    assert.equal(peutReglerAbonnementFerme({ ...base, statutMembre: "revoked" }), false)
  })

  test("un cabinet suspendu par l'exploitant ne paie pas : le paiement ne le rouvrirait pas", () => {
    assert.equal(peutReglerAbonnementFerme({ ...base, statutCabinet: "suspended" }), false)
    assert.equal(peutReglerAbonnementFerme({ ...base, statutCabinet: "" }), false)
  })
})

describe("abonnementVivant", () => {
  test("ce qui court encore, impayé compris, appartient au cabinet et au webhook", () => {
    for (const statut of ["active", "trialing", "past_due", "unpaid", "paused"]) {
      assert.equal(abonnementVivant(statut), true, statut)
    }
  })

  test("un abonnement terminé, ou une simple offre, peut céder la place", () => {
    for (const statut of ["canceled", "incomplete_expired", "incomplete", ""]) {
      assert.equal(abonnementVivant(statut), false, statut)
    }
  })
})

/**
 * Le tarif que la page publique a le droit d'annoncer.
 *
 * Le défaut qui a motivé ce test : quand le catalogue ne répondait pas, la
 * grille tarifaire retombait sur un forfait vide et affichait « 0 $ par mois »,
 * « ou 0 $ par année », « puis 0 $ par mois et par membre ». Un prix nul sur
 * une page de vente n'est pas une absence d'information, c'est une information
 * fausse.
 */
describe("tarifPublic", () => {
  const forfait = (surcharge: Partial<Plan> = {}): Plan => ({
    key: "cabinet", labelFr: "", labelEn: "", taglineFr: "", taglineEn: "", rank: 1,
    purchasable: true, monthly: 7900, annual: 79000, extraSeatMonthly: 1900,
    extraSeatAnnual: 19000, seatsIncluded: 3, maxSeats: null, aiConnector: false,
    ...surcharge,
  })

  test("un forfait absent du catalogue n'a pas de tarif public", () => {
    assert.equal(tarifPublic(undefined), null)
  })

  test("un prix mensuel ou annuel manquant retire le tarif entier", () => {
    assert.equal(tarifPublic(forfait({ monthly: null })), null)
    assert.equal(tarifPublic(forfait({ annual: null })), null)
  })

  test("un prix nul n'est jamais annoncé", () => {
    assert.equal(tarifPublic(forfait({ monthly: 0 })), null)
    assert.equal(tarifPublic(forfait({ annual: 0 })), null)
  })

  test("un forfait complet donne ses trois montants", () => {
    assert.deepEqual(tarifPublic(forfait()), {
      mensuel: 7900,
      annuel: 79000,
      placeSupplementaire: 1900,
    })
  })

  test("une place supplémentaire sans prix est tue, sans retirer le tarif", () => {
    assert.deepEqual(tarifPublic(forfait({ extraSeatMonthly: 0 })), {
      mensuel: 7900,
      annuel: 79000,
      placeSupplementaire: null,
    })
  })
})
