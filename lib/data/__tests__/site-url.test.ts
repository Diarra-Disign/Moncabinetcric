import { test, describe, afterEach } from "node:test"
import assert from "node:assert/strict"

import { siteUrl, siteDefinitif } from "../../site-url"

/**
 * L'adresse publique du site décide de deux choses irréversibles : ce qu'un
 * moteur de recherche indexe, et ce que contiennent les liens envoyés par
 * courriel. Une erreur ici ne se voit pas — elle se découvre des semaines
 * plus tard, quand le mauvais domaine est déjà référencé.
 *
 * Le défaut qui a motivé ces contrôles : « https://moncabinetcric.ca » était
 * écrit en dur dans le plan de site depuis le premier commit du dépôt, et
 * rien n'a jamais répondu à ce nom.
 */

const original = process.env.APP_URL
const originalVercel = process.env.VERCEL_PROJECT_PRODUCTION_URL

afterEach(() => {
  if (original === undefined) delete process.env.APP_URL
  else process.env.APP_URL = original
  if (originalVercel === undefined) delete process.env.VERCEL_PROJECT_PRODUCTION_URL
  else process.env.VERCEL_PROJECT_PRODUCTION_URL = originalVercel
})

describe("siteUrl", () => {
  test("retire la barre oblique finale", () => {
    process.env.APP_URL = "https://moncabinetcric.com/"
    assert.equal(siteUrl(), "https://moncabinetcric.com")
  })

  test("retire plusieurs barres obliques finales", () => {
    process.env.APP_URL = "https://moncabinetcric.com///"
    assert.equal(siteUrl(), "https://moncabinetcric.com")
  })

  test("retombe sur l'adresse locale en l'absence de configuration", () => {
    delete process.env.APP_URL
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL
    assert.equal(siteUrl(), "http://localhost:3000")
  })

  // Ce repli existe parce qu'APP_URL a réellement été supprimée. En une
  // minute, robots.txt s'est mis à répondre « Disallow: / » — le site entier
  // interdit aux moteurs — et les adresses de retour envoyées à Stripe
  // pointaient vers la machine du client. Une variable effacée par mégarde ne
  // doit pas pouvoir désindexer un site.
  describe("repli sur le domaine de production de Vercel", () => {
    test("employé quand APP_URL est absente", () => {
      delete process.env.APP_URL
      process.env.VERCEL_PROJECT_PRODUCTION_URL = "moncabinetcric.com"
      assert.equal(siteUrl(), "https://moncabinetcric.com")
      assert.equal(siteDefinitif(), true)
    })

    test("employé quand APP_URL ne contient que des espaces", () => {
      process.env.APP_URL = "  \n "
      process.env.VERCEL_PROJECT_PRODUCTION_URL = "moncabinetcric.com"
      assert.equal(siteUrl(), "https://moncabinetcric.com")
    })

    test("APP_URL garde la priorité quand elle est renseignée", () => {
      // Le repli ne doit jamais primer sur une décision explicite : un
      // domaine personnalisé posé à la main l'emporte sur celui de Vercel.
      process.env.APP_URL = "https://cabinet.example.ca"
      process.env.VERCEL_PROJECT_PRODUCTION_URL = "moncabinetcric.com"
      assert.equal(siteUrl(), "https://cabinet.example.ca")
    })
  })

  // Ces trois contrôles viennent d'une panne réelle. APP_URL avait été posée
  // sur Vercel avec un retour à la ligne final — ce qui arrive dès qu'on copie
  // une adresse depuis un éditeur. robots.txt annonçait alors « Sitemap:
  // https://moncabinetcric.com » et « /sitemap.xml » sur la ligne suivante,
  // les adresses de retour envoyées à Stripe devenaient invalides — et Stripe
  // REFUSE une session de paiement dont l'URL de succès l'est — et les liens
  // d'invitation par courriel étaient coupés en deux. Aucune des trois pannes
  // n'annonçait sa cause.
  test("retire un retour à la ligne final", () => {
    process.env.APP_URL = "https://moncabinetcric.com\n"
    assert.equal(siteUrl(), "https://moncabinetcric.com")
  })

  test("retire les espaces autour", () => {
    process.env.APP_URL = "  https://moncabinetcric.com  "
    assert.equal(siteUrl(), "https://moncabinetcric.com")
  })

  test("une valeur faite d'espaces vaut une valeur absente", () => {
    process.env.APP_URL = "   "
    assert.equal(siteUrl(), "http://localhost:3000")
  })

  test("retour à la ligne ET barre oblique finale", () => {
    process.env.APP_URL = "https://moncabinetcric.com/\n"
    assert.equal(siteUrl(), "https://moncabinetcric.com")
  })
})

describe("siteDefinitif", () => {
  test("une adresse locale n'est pas définitive", () => {
    process.env.APP_URL = "http://localhost:3000"
    assert.equal(siteDefinitif(), false)
  })

  test("une adresse d'aperçu Vercel n'est pas définitive", () => {
    process.env.APP_URL = "https://moncabinetcric.vercel.app"
    assert.equal(siteDefinitif(), false)
  })

  test("un sous-domaine d'aperçu non plus", () => {
    process.env.APP_URL = "https://moncabinetcric-git-main-xyz.vercel.app"
    assert.equal(siteDefinitif(), false)
  })

  test("le domaine du cabinet est définitif", () => {
    process.env.APP_URL = "https://moncabinetcric.com"
    assert.equal(siteDefinitif(), true)
  })

  test("un domaine contenant « vercel.app » ailleurs qu'à la fin reste définitif", () => {
    // Le contrôle porte sur le suffixe de l'hôte, jamais sur une sous-chaîne :
    // « vercel.app.moncabinetcric.com » est un domaine à nous.
    process.env.APP_URL = "https://vercel.app.moncabinetcric.com"
    assert.equal(siteDefinitif(), true)
  })

  test("le chemin n'entre pas dans la décision", () => {
    // Sans découpage sur la barre oblique, « /preview.vercel.app » ferait
    // passer le vrai domaine pour une adresse d'aperçu.
    process.env.APP_URL = "https://moncabinetcric.com/preview.vercel.app"
    assert.equal(siteDefinitif(), true)
  })

  test("un domaine inconnu est réputé définitif", () => {
    // L'oubli doit pencher du côté qui n'efface pas le référencement d'un
    // vrai site : mieux vaut indexer à tort qu'effacer à tort.
    process.env.APP_URL = "https://cabinet.example.ca"
    assert.equal(siteDefinitif(), true)
  })
})
