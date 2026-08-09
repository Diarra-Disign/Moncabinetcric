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

const cle = env.STRIPE_SECRET_KEY
if (!cle) {
  console.error("STRIPE_SECRET_KEY absente de .env.local.")
  process.exit(1)
}

const appliquer = process.argv.includes("--appliquer")
const faireWebhook = process.argv.includes("--webhook")
const faireLiens = process.argv.includes("--liens")

if (!faireWebhook && !faireLiens) {
  console.error("Rien à faire. Préciser --webhook et/ou --liens.")
  process.exit(1)
}

const argSite = process.argv.find((a) => a.startsWith("--site="))
const SITE = (argSite ? argSite.slice(7) : (env.APP_URL ?? "")).replace(/\/+$/, "")

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

if (!appliquer) console.log("Rien n'a été écrit. Relancer avec --appliquer.")
