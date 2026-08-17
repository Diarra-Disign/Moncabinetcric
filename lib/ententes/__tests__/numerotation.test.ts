import { test, describe } from "node:test"
import assert from "node:assert"
import {
  extraireNumeroTitre,
  renumeroterTitre,
  renumeroterCorps,
  renumeroterArticles,
  type ArticleNum,
} from "../numerotation.ts"

describe("Numérotation séquentielle dynamique des articles", () => {
  test("extrait le numéro d'article du titre", () => {
    assert.strictEqual(extraireNumeroTitre("ARTICLE 1 — IDENTIFICATION DES PARTIES"), 1)
    assert.strictEqual(extraireNumeroTitre("ARTICLE 4 — HONORAIRES"), 4)
    assert.strictEqual(extraireNumeroTitre("ARTICLE 13 — CONSENTEMENT"), 13)
    assert.strictEqual(extraireNumeroTitre("5. Titre sans mot article"), 5)
    assert.strictEqual(extraireNumeroTitre("Sans aucun numéro"), null)
  })

  test("renumérote le titre de l'article proprement", () => {
    assert.strictEqual(
      renumeroterTitre("ARTICLE 5 — OBLIGATIONS DU CONSULTANT RÉGLEMENTÉ", 4),
      "ARTICLE 4 — OBLIGATIONS DU CONSULTANT RÉGLEMENTÉ"
    )
    assert.strictEqual(
      renumeroterTitre("ARTICLE 13 — CONSENTEMENT ÉCLAIRÉ", 12),
      "ARTICLE 12 — CONSENTEMENT ÉCLAIRÉ"
    )
  })

  test("renumérote les sous-alinéas dans le corps de l'article", () => {
    const corpsOriginal = `5.1 Le consultant s'engage à agir avec intégrité.
5.2 Il respecte la confidentialité.
Autre phrase sans numéro.`

    const corpsRenumerote = renumeroterCorps(corpsOriginal, 5, 4)
    assert.strictEqual(
      corpsRenumerote,
      `4.1 Le consultant s'engage à agir avec intégrité.
4.2 Il respecte la confidentialité.
Autre phrase sans numéro.`
    )
  })

  test("lorsqu'on décoche l'article 4, l'article 5 devient article 4 et la suite suit la séquence", () => {
    const articles: ArticleNum[] = [
      {
        code: "art1",
        titleFr: "ARTICLE 1 — IDENTIFICATION DES PARTIES",
        bodyFr: "1.1 Le cabinet...",
        enabled: true,
      },
      {
        code: "art2",
        titleFr: "ARTICLE 2 — NATURE DU SERVICE",
        bodyFr: "2.1 Portée...",
        enabled: true,
      },
      {
        code: "art3",
        titleFr: "ARTICLE 3 — FORMAT ET DURÉE",
        bodyFr: "3.1 Format...",
        enabled: true,
      },
      {
        code: "art4",
        titleFr: "ARTICLE 4 — HONORAIRES",
        bodyFr: "4.1 Les honoraires...",
        enabled: false, // DECOCHÉ
      },
      {
        code: "art5",
        titleFr: "ARTICLE 5 — OBLIGATIONS DU CONSULTANT",
        bodyFr: "5.1 Le consultant...",
        enabled: true,
      },
      {
        code: "art6",
        titleFr: "ARTICLE 6 — OBLIGATIONS DU CLIENT",
        bodyFr: "6.1 Le client...",
        enabled: true,
      },
    ]

    const resultat = renumeroterArticles(articles)

    assert.strictEqual(resultat[0].titleFr, "ARTICLE 1 — IDENTIFICATION DES PARTIES")
    assert.strictEqual(resultat[1].titleFr, "ARTICLE 2 — NATURE DU SERVICE")
    assert.strictEqual(resultat[2].titleFr, "ARTICLE 3 — FORMAT ET DURÉE")
    // Article 4 est resté décoché
    assert.strictEqual(resultat[3].enabled, false)
    // Article 5 est maintenant renuméroté ARTICLE 4
    assert.strictEqual(resultat[4].titleFr, "ARTICLE 4 — OBLIGATIONS DU CONSULTANT")
    assert.strictEqual(resultat[4].bodyFr, "4.1 Le consultant...")
    // Article 6 est maintenant renuméroté ARTICLE 5
    assert.strictEqual(resultat[5].titleFr, "ARTICLE 5 — OBLIGATIONS DU CLIENT")
    assert.strictEqual(resultat[5].bodyFr, "5.1 Le client...")
  })
})
