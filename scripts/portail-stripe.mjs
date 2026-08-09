#!/usr/bin/env node
/**
 * Configuration du portail client Stripe.
 *
 * Le portail est la page hébergée où un cabinet change sa carte, passe au
 * prélèvement bancaire, télécharge ses factures et résilie. Stripe exige
 * qu'une configuration existe AVANT toute session : sans elle,
 * billingPortal.sessions.create() lève, et le bouton « Gérer » de l'écran
 * Abonnement échoue sans que rien n'explique pourquoi.
 *
 * ---------------------------------------------------------------------------
 * CE QUE CE SCRIPT N'ACTIVE PAS, ET POURQUOI
 * ---------------------------------------------------------------------------
 * `subscription_update` — le changement de forfait depuis le portail — reste
 * FERMÉ. L'application le gère déjà, en calculant les places par rôle et en
 * les posant dans la même écriture. Deux chemins concurrents vers la même
 * décision produiraient deux vérités : celle du portail ignorerait la
 * tarification par place, et le cabinet paierait un montant qu'aucun écran
 * d'ici n'affiche.
 *
 * Idempotent : relancé, il met à jour la configuration existante plutôt que
 * d'en empiler une seconde. Stripe applique la configuration par défaut, et
 * en avoir deux rendrait indéterminé ce que voit le client.
 *
 * Usage : ./cric portail [--appliquer]
 *   Sans --appliquer, il montre ce qu'il ferait sans rien écrire.
 */

import fs from "node:fs"
import Stripe from "stripe"

const env = Object.fromEntries(
  fs
    .readFileSync(new URL("../.env.local", import.meta.url), "utf8")
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
const live = cle.startsWith("sk_live")

// Le site vient de --site, sinon d'APP_URL. En local, APP_URL vaut
// http://localhost:3000 : Stripe refuse ces adresses pour une politique de
// confidentialité, et le portail renverrait le cabinet vers une machine qui
// n'est pas la sienne. On s'arrête plutôt que de poser une adresse morte.
const argSite = process.argv.find((a) => a.startsWith("--site="))
const SITE = (argSite ? argSite.slice(7) : (env.APP_URL ?? "")).trim().replace(/\/+$/, "")

if (!SITE || /localhost|127\.0\.0\.1/.test(SITE)) {
  console.error(
    `Adresse publique manquante (obtenue : ${SITE || "(vide)"}).\n` +
      `Le portail renvoie le cabinet vers cette adresse et Stripe y lit tes pages légales.\n` +
      `Relancer avec : ./cric portail --site=https://ton-domaine.com`
  )
  process.exit(1)
}

const CONFIG = {
  business_profile: {
    // Exigées par Stripe pour un portail en production. Vérifiées à 200 avant
    // d'être posées : une adresse morte ferait échouer la création, et le
    // message de Stripe ne dit pas laquelle des deux est en cause.
    privacy_policy_url: `${SITE}/fr/confidentialite`,
    terms_of_service_url: `${SITE}/fr/conditions`,
  },
  default_return_url: `${SITE}/fr/settings/subscription`,
  features: {
    // Le cœur du portail : remplacer une carte expirée, ou passer de la carte
    // au prélèvement bancaire, sans qu'aucune coordonnée bancaire ne transite
    // par cette application — qui contient par ailleurs des dossiers
    // d'immigration.
    payment_method_update: { enabled: true },

    // Obligation comptable du cabinet, et première raison pour laquelle il
    // reviendra sur cette page.
    invoice_history: { enabled: true },

    // L'adresse et le numéro de taxe sont nécessaires dès que Stripe Tax
    // calcule la TPS et la TVQ : c'est la province de facturation qui décide
    // du taux.
    customer_update: {
      enabled: true,
      allowed_updates: ["address", "email", "phone", "name", "tax_id"],
    },

    // Résilier sans écrire à personne. La fin de période, et non l'instant :
    // le cabinet a payé le mois, il le garde — et ses dossiers d'immigration
    // ont des échéances au calendrier.
    subscription_cancel: {
      enabled: true,
      mode: "at_period_end",
      cancellation_reason: {
        enabled: true,
        options: ["too_expensive", "missing_features", "switched_service", "unused", "other"],
      },
    },

    // Volontairement fermé — voir l'en-tête.
    subscription_update: { enabled: false },
  },
}

const sdk = new Stripe(cle, { maxNetworkRetries: 2 })

console.log(`Compte Stripe : ${live ? "PRODUCTION (sk_live_)" : "test"}`)
console.log(`Site          : ${SITE}`)
console.log()

const existantes = await sdk.billingPortal.configurations.list({ limit: 100 })
const defaut = existantes.data.find((c) => c.is_default) ?? existantes.data[0]

console.log(`Configurations existantes : ${existantes.data.length}`)
console.log()
console.log("Ce qui sera " + (defaut ? "mis à jour" : "créé") + " :")
console.log("  · moyen de paiement modifiable      oui")
console.log("  · historique des factures           oui")
console.log("  · adresse et numéro de taxe         oui")
console.log("  · résiliation                       oui, à la fin de la période payée")
console.log("  · changement de forfait             NON — l'application s'en charge")
console.log(`  · retour vers                       ${CONFIG.default_return_url}`)
console.log()

if (!appliquer) {
  console.log("Rien n'a été écrit. Relancer avec --appliquer pour appliquer.")
  process.exit(0)
}

const resultat = defaut
  ? await sdk.billingPortal.configurations.update(defaut.id, CONFIG)
  : await sdk.billingPortal.configurations.create(CONFIG)

console.log(`✓ Configuration ${defaut ? "mise à jour" : "créée"} : ${resultat.id}`)
console.log(`  active : ${resultat.active} · par défaut : ${resultat.is_default}`)
