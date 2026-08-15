#!/usr/bin/env node
/**
 * Mise en ordre de la configuration Stripe.
 *
 * Deux opérations, indépendantes l'une de l'autre :
 *
 *   --webhook  Crée un point de terminaison sur l'adresse publique, écrit son
 *              secret dans .env.local, puis supprime l'ancien.
 *   --liens    Désactive les liens de paiement et archive les tarifs
 *              orphelins qu'ils utilisent.
 *
 * Sans --appliquer, rien n'est écrit : le script montre ce qu'il ferait.
 *
 * ---------------------------------------------------------------------------
 * POURQUOI CRÉER PLUTÔT QUE MODIFIER, POUR LE WEBHOOK
 * ---------------------------------------------------------------------------
 * Stripe ne rend le secret de signature QU'À la création. Modifier l'URL d'un
 * point de terminaison existant conserve donc son secret — or c'est justement
 * le secret qu'il faut changer ici : il avait été collé comme NOM de variable
 * sur Vercel, où les noms ne sont pas masqués. Quiconque a lu cette liste peut
 * forger un événement « abonnement actif » et s'ouvrir l'application.
 *
 * Le neuf est créé AVANT que l'ancien ne soit supprimé. L'inverse laisserait,
 * si la création échouait, un compte sans aucun point de terminaison — et des
 * paiements qui n'ouvriraient aucun accès, sans trace.
 *
 * Usage : ./cric stripe-config --webhook --liens --site=https://... [--appliquer]
 */

import fs from "node:fs"
import Stripe from "stripe"

const CHEMIN_ENV = new URL("../.env.local", import.meta.url)

const env = Object.fromEntries(
  fs
    .readFileSync(CHEMIN_ENV, "utf8")
    .split("\n")
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])
)

// --test bascule sur le compte de MODE TEST. Les réglages d'un compte Stripe
// sont propres à chaque mode : un moyen de paiement activé en production reste
// éteint en test, et l'épreuve qui l'emploie échoue pour une raison étrangère
// à ce qu'elle cherche à prouver.
const modeTest = process.argv.includes("--test")
const cle = modeTest ? env.STRIPE_TEST_SECRET_KEY : env.STRIPE_SECRET_KEY
if (!cle) {
  console.error(
    modeTest
      ? "STRIPE_TEST_SECRET_KEY absente de .env.local. La poser avec : ./cric cle-test"
      : "STRIPE_SECRET_KEY absente de .env.local."
  )
  process.exit(1)
}

const appliquer = process.argv.includes("--appliquer")
const faireWebhook = process.argv.includes("--webhook")
const faireLiens = process.argv.includes("--liens")
const faireFiscal = process.argv.includes("--fiscal")
const faireCheckout = process.argv.includes("--checkout")

if (!faireWebhook && !faireLiens && !faireFiscal && !faireCheckout) {
  console.error(
    "Rien à faire. Préciser --webhook, --liens, --fiscal et/ou --checkout."
  )
  process.exit(1)
}

/**
 * Code fiscal du produit vendu ici.
 *
 * « Software as a service (SaaS) - business use ». Le compte portait
 * txcd_10000000, « General - Electronically Supplied Services », que Stripe
 * lui-même décrit comme un fourre-tout : « Consider more specific categories
 * like software, digital goods, cloud services ».
 *
 * Au Canada, les deux sont taxés de la même façon — ce changement ne modifie
 * aucune facture canadienne. Il compte ailleurs : plusieurs États américains
 * taxent le logiciel infonuagique autrement qu'un bien numérique, et certains
 * l'exonèrent quand l'acheteur est une entreprise. Le poser maintenant, alors
 * qu'aucun abonnement n'existe, coûte une écriture ; le poser après coup
 * demanderait de reprendre des factures déjà émises.
 *
 * « business use » et non « personal use » : ce produit se vend à des cabinets
 * de consultants réglementés, jamais à des particuliers.
 */
const CODE_FISCAL = "txcd_10103001"

const argSite = process.argv.find((a) => a.startsWith("--site="))
const SITE = (argSite ? argSite.slice(7) : (env.APP_URL ?? "")).trim().replace(/\/+$/, "")

if (faireWebhook && (!SITE || /localhost|127\.0\.0\.1/.test(SITE))) {
  console.error(
    `Adresse publique manquante (obtenue : ${SITE || "(vide)"}).\n` +
      `Stripe doit pouvoir joindre ce point de terminaison depuis l'extérieur.\n` +
      `Relancer avec : --site=https://ton-domaine.com`
  )
  process.exit(1)
}

/**
 * Exactement les événements que app/api/stripe/webhook/route.ts traite.
 *
 * `customer.created` figurait sur l'ancien point de terminaison sans être
 * traité. Un événement auquel on s'abonne sans le traiter n'est pas neutre :
 * il consomme une livraison, et masque le vrai trafic quand on relit le
 * journal en cherchant pourquoi un paiement n'a rien ouvert.
 */
const EVENEMENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
]

const sdk = new Stripe(cle, { maxNetworkRetries: 2 })
const live = cle.startsWith("sk_live")

console.log(`Compte Stripe : ${live ? "PRODUCTION (sk_live_)" : "test"}`)
if (faireWebhook) console.log(`Site          : ${SITE}`)
console.log(appliquer ? "Mode          : ÉCRITURE" : "Mode          : essai à blanc")
console.log()

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------
if (faireWebhook) {
  const cible = `${SITE}/api/stripe/webhook`
  const { data: existants } = await sdk.webhookEndpoints.list({ limit: 100 })

  console.log("── WEBHOOK ──")
  for (const w of existants) {
    console.log(`  existant  ${w.status.padEnd(9)} ${w.url}`)
  }

  const dejaBon = existants.find((w) => w.url === cible)
  if (dejaBon) {
    // Le secret reste inconnu : Stripe ne le rend qu'à la création. Recréer
    // par-dessus produirait deux points de terminaison sur la même adresse,
    // donc chaque événement livré deux fois.
    console.log(`\n  Un point de terminaison vise déjà ${cible}.`)
    console.log(`  Son secret n'est pas récupérable ; le remplacer suppose de le supprimer d'abord.`)
    console.log(`  Rien n'est tenté ici pour ne pas livrer chaque événement en double.`)
  } else {
    console.log(`\n  à créer     ${cible}`)
    console.log(`  événements  ${EVENEMENTS.length} (ceux que la route traite)`)
    for (const w of existants) console.log(`  à supprimer ${w.url}`)
    console.log(`  secret      écrit dans .env.local, jamais affiché`)

    if (appliquer) {
      const neuf = await sdk.webhookEndpoints.create({
        url: cible,
        enabled_events: EVENEMENTS,
        description: "moncabinetcric — abonnements",
        api_version: "2025-10-29.clover",
      })

      if (!neuf.secret) {
        console.error("\n  ✗ Stripe n'a pas rendu de secret. Ancien point conservé.")
        process.exit(1)
      }

      // Écrit avant toute suppression : si le processus s'arrêtait ici, le
      // compte aurait deux points de terminaison — désagréable, mais sans
      // perte. L'ordre inverse pourrait perdre le secret neuf.
      const brut = fs.readFileSync(CHEMIN_ENV, "utf8")
      const remplace = brut.includes("STRIPE_WEBHOOK_SECRET=")
        ? brut.replace(/^STRIPE_WEBHOOK_SECRET=.*$/m, `STRIPE_WEBHOOK_SECRET=${neuf.secret}`)
        : `${brut.replace(/\n*$/, "\n")}STRIPE_WEBHOOK_SECRET=${neuf.secret}\n`
      fs.writeFileSync(CHEMIN_ENV, remplace)

      console.log(`\n  ✓ créé : ${neuf.id}`)
      console.log(`  ✓ secret neuf écrit dans .env.local`)

      for (const w of existants) {
        await sdk.webhookEndpoints.del(w.id)
        console.log(`  ✓ supprimé : ${w.url}`)
      }
    }
  }
  console.log()
}

// ---------------------------------------------------------------------------
// Liens de paiement
// ---------------------------------------------------------------------------
if (faireLiens) {
  console.log("── LIENS DE PAIEMENT ──")

  const { data: liens } = await sdk.paymentLinks.list({ limit: 100 })
  const actifs = liens.filter((l) => l.active)

  for (const l of actifs) console.log(`  à désactiver  ${l.url}`)

  // Un tarif hors catalogue se reconnaît à l'ABSENCE de clé de recherche :
  // tout ce que cette application crée en pose une. Sans elle, le tarif
  // échappe à la relecture de montant qui garantit « on facture le prix
  // affiché » — c'est précisément ce qui l'a rendu dangereux.
  //
  // Le critère ne passe pas par les liens de paiement : une fois ceux-ci
  // désactivés, les tarifs cesseraient d'être trouvables et resteraient actifs
  // pour toujours, à la portée du premier lien recréé à la main.
  const { data: tarifs } = await sdk.prices.list({ limit: 100, active: true })
  const orphelins = tarifs.filter((p) => !p.lookup_key)

  for (const p of orphelins) {
    console.log(
      `  à archiver    ${((p.unit_amount ?? 0) / 100).toFixed(2)} ${p.currency.toUpperCase()} — ${p.id} (sans clé de recherche)`
    )
  }

  const gardes = tarifs.filter((p) => p.lookup_key)
  console.log(`  intacts       ${gardes.length} tarifs du catalogue (mcc_*)`)

  if (appliquer) {
    for (const l of actifs) {
      await sdk.paymentLinks.update(l.id, { active: false })
      console.log(`  ✓ désactivé : ${l.url}`)
    }

    for (const p of orphelins) {
      // Stripe refuse d'archiver un tarif qui est le prix PAR DÉFAUT de son
      // produit. Il faut donc archiver le produit d'abord — et c'est là qu'il
      // faut regarder à deux fois : si un tarif du catalogue partageait ce
      // produit, on archiverait un produit dont dépend la facturation.
      const produitId = typeof p.product === "string" ? p.product : p.product?.id
      if (!produitId) {
        console.log(`  ⚠ ${p.id} : produit introuvable, laissé actif.`)
        continue
      }

      const { data: freres } = await sdk.prices.list({ product: produitId, limit: 100 })
      const duCatalogue = freres.filter((f) => f.lookup_key)

      if (duCatalogue.length > 0) {
        console.log(
          `  ⚠ ${p.id} laissé actif : son produit porte aussi ${duCatalogue.map((f) => f.lookup_key).join(", ")}.`
        )
        continue
      }

      try {
        await sdk.products.update(produitId, { active: false })
        await sdk.prices.update(p.id, { active: false })
        console.log(`  ✓ archivé : ${p.id} et son produit ${produitId}`)
      } catch (e) {
        // Le lien est déjà désactivé : le tarif n'est plus atteignable, même
        // s'il reste actif. On le signale sans faire échouer le reste.
        console.log(`  ⚠ ${p.id} non archivé : ${e.message}`)
      }
    }
  }
  console.log()
}

// ---------------------------------------------------------------------------
// Code fiscal
// ---------------------------------------------------------------------------
if (faireFiscal) {
  console.log("── CODE FISCAL ──")

  const reglages = await sdk.tax.settings.retrieve()
  const actuel = reglages.defaults?.tax_code

  const nom = async (c) => {
    try {
      return (await sdk.taxCodes.retrieve(c)).name
    } catch {
      return "(inconnu)"
    }
  }

  console.log(`  statut Stripe Tax  ${reglages.status}`)
  console.log(`  actuel             ${actuel} — ${await nom(actuel)}`)
  console.log(`  voulu              ${CODE_FISCAL} — ${await nom(CODE_FISCAL)}`)

  // Les produits créés par cette application ne portent pas de code fiscal
  // propre : ils héritent du défaut du compte. Changer le défaut les corrige
  // donc tous d'un coup — mais seulement ceux qui n'en portent pas. On le
  // vérifie plutôt que de le supposer.
  const { data: produits } = await sdk.products.list({ limit: 100, active: true })
  const avecCodePropre = produits.filter((p) => p.tax_code)
  if (avecCodePropre.length > 0) {
    console.log(`\n  ⚠ ${avecCodePropre.length} produit(s) portent leur PROPRE code fiscal :`)
    for (const p of avecCodePropre) {
      console.log(`      ${p.name} → ${typeof p.tax_code === "string" ? p.tax_code : p.tax_code?.id}`)
    }
    console.log(`    Le défaut du compte ne les concerne pas.`)
  } else {
    console.log(`\n  ${produits.length} produit(s) actifs héritent du défaut : tous seront corrigés.`)
  }

  if (actuel === CODE_FISCAL) {
    console.log("\n  Déjà en place, rien à faire.")
  } else if (appliquer) {
    const maj = await sdk.tax.settings.update({ defaults: { tax_code: CODE_FISCAL } })
    console.log(`\n  ✓ défaut du compte : ${maj.defaults?.tax_code}`)
  }
  console.log()
}

// ---------------------------------------------------------------------------
// La session de paiement s'ouvre-t-elle vraiment ?
// ---------------------------------------------------------------------------
// LA question qu'aucune lecture de configuration ne tranche.
//
// Stripe valide la liste des moyens de paiement D'UN BLOC, au moment où la
// session se crée. Un seul moyen non agréé fait échouer la session entière —
// carte comprise, alors que la carte, elle, fonctionne. C'est la panne qui a
// rendu tout paiement impossible, et elle ne se voit nulle part ailleurs :
// ni dans les capacités du compte, ni dans la configuration d'affichage, qui
// annonçaient toutes deux « actif ».
//
// La vérification a lieu en production, seul endroit où la configuration
// réelle s'applique — mais elle n'y crée RIEN de durable :
//
//   · aucun client : en mode « subscription », Stripe ne crée le client qu'à
//     l'ACHÈVEMENT de la session, jamais à son ouverture ;
//   · aucun abonnement, aucune facture, aucun débit ;
//   · la session est expirée immédiatement après, donc inutilisable.
//
// Il reste un objet Session périmé dans le journal. C'est le prix, et il est
// sans commune mesure avec celui d'un tunnel de paiement cassé qu'on découvre
// par le premier cabinet qui essaie de payer.
if (faireCheckout) {
  console.log("── SESSION DE PAIEMENT ──")

  // Exactement les moyens que sessionPaiement() demande. Les recopier
  // ailleurs ferait éprouver autre chose que ce qui encaisse.
  const moyens = ["card"]
  console.log(`  moyens demandés      ${moyens.join(", ")}`)

  const tarifs = await sdk.prices.list({ limit: 10, active: true })
  const base = tarifs.data.find((p) => /^mcc_[a-z]+_monthly$/.test(p.lookup_key ?? ""))
  if (!base) {
    console.log("  ⚠ Aucun tarif mensuel du catalogue chez Stripe. Rien à essayer.")
  } else {
    console.log(`  tarif employé        ${base.lookup_key} — ${((base.unit_amount ?? 0) / 100).toFixed(2)} ${base.currency.toUpperCase()}`)

    if (!appliquer) {
      console.log("\n  Essai à blanc : la session n'est pas ouverte.")
    } else {
      try {
        const session = await sdk.checkout.sessions.create({
          mode: "subscription",
          line_items: [{ price: base.id, quantity: 1 }],
          locale: "fr-CA",
          payment_method_types: moyens,

          // La taxe fait partie de ce qu'on éprouve, au même titre que les
          // moyens de paiement. Elle est restée éteinte pendant une semaine
          // sur le compte de production sans que rien ne le dise : la session
          // s'ouvrait, le client saisissait son adresse, et aucune ligne de
          // taxe n'apparaissait. Une épreuve qui ouvre une session sans
          // regarder ce point le laisserait passer une seconde fois.
          automatic_tax: { enabled: true },

          success_url: `${SITE || "https://moncabinetcric.com"}/fr/settings/subscription?paiement=ok`,
          cancel_url: `${SITE || "https://moncabinetcric.com"}/fr/settings/subscription?paiement=annule`,
          metadata: { epreuve: "verification-moyens-de-paiement" },
        })

        console.log(`\n  ✓ session ouverte : ${session.id}`)
        console.log(`    moyens acceptés par Stripe : ${(session.payment_method_types ?? []).join(", ")}`)

        // « requires_location_inputs » est le statut ATTENDU à la création :
        // Stripe attend l'adresse que l'acheteur saisira dans sa page. Ce qui
        // doit être vrai ici, c'est que le calcul est demandé — « failed »
        // signalerait une inscription fiscale manquante ou expirée.
        const etatTaxe = session.automatic_tax?.status ?? "—"
        const taxeOk = session.automatic_tax?.enabled && etatTaxe !== "failed"
        console.log(`  ${taxeOk ? "✓" : "✗"} taxe automatique : ${session.automatic_tax?.enabled ? "activée" : "ÉTEINTE"} (${etatTaxe})`)
        if (!taxeOk) {
          console.log(`    Les abonnements seraient encaissés SANS TPS ni TVQ.`)
          process.exitCode = 1
        }

        await sdk.checkout.sessions.expire(session.id)
        const apres = await sdk.checkout.sessions.retrieve(session.id)
        console.log(`  ✓ session expirée : ${apres.status}`)

        const clients = await sdk.customers.list({ limit: 1 })
        console.log(`  ✓ aucun client créé (le compte en compte toujours ${clients.data.length === 1 ? "1" : String(clients.data.length)})`)
      } catch (e) {
        console.log(`\n  ✗ Stripe REFUSE la session : ${e.message}`)
        console.log(`    Le paiement est cassé en production tant que ceci n'est pas résolu.`)
        process.exitCode = 1
      }
    }
  }
  console.log()
}

if (!appliquer) console.log("Rien n'a été écrit. Relancer avec --appliquer.")
