#!/usr/bin/env node
/**
 * Éprouve la facturation par place, contre un vrai compte Stripe en mode test.
 *
 *   ./cric facturation-sieges
 *
 * ---------------------------------------------------------------------------
 * CE QUE CETTE SUITE AJOUTE AUX TESTS UNITAIRES
 * ---------------------------------------------------------------------------
 * repartirSieges() est déjà éprouvée par treize contrôles unitaires. Ce qui ne
 * l'était pas, c'est le BRAS : la réconciliation qui traduit une répartition en
 * lignes d'abonnement chez Stripe. Elle a été écrite et relue, jamais exécutée
 * — parce que l'unique clé disponible était celle de production, et qu'on ne
 * vérifie pas une facturation en facturant quelqu'un.
 *
 * Trois choses ne se voient QUE là :
 *
 *   1. Les identifiants de tarif. Un rôle mal traduit en clé de recherche
 *      produit une ligne au mauvais prix, et le calcul reste juste.
 *   2. Le nombre d'écritures. Une réconciliation qui réécrit une ligne
 *      identique ajoute une PRORATISATION à chaque passage. Le montant reste
 *      bon, la facture devient illisible.
 *   3. Le changement de forfait. Les lignes de l'ancien forfait doivent
 *      disparaître et les nouvelles apparaître dans la MÊME écriture.
 *
 * ---------------------------------------------------------------------------
 * POURQUOI LE VRAI CODE, ET NON UNE COPIE
 * ---------------------------------------------------------------------------
 * Le script importe lib/billing/seat-sync.ts et lib/billing/stripe.ts tels
 * qu'ils tournent en production, via le résolveur de scripts/_resolveur.mjs.
 * Une copie réécrite pour le test finirait par diverger de l'original, et
 * c'est alors la copie qu'on éprouverait.
 *
 * La clé de test est posée dans STRIPE_SECRET_KEY avant tout import : c'est la
 * variable que lit le code de production. Rien d'autre n'est modifié.
 */

import { readFile } from "node:fs/promises"
import { randomBytes } from "node:crypto"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"
import Stripe from "stripe"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

async function loadEnv() {
  const raw = await readFile(join(ROOT, ".env.local"), "utf8")
  const env = {}
  for (const l of raw.split("\n")) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }
  return env
}

const env = await loadEnv()

// ---------------------------------------------------------------------------
// Le garde-fou qui compte
// ---------------------------------------------------------------------------
// Cette suite CRÉE des abonnements, change des forfaits et ajuste des places.
// Exécutée contre le compte de production, elle facturerait de vrais cabinets.
// Le refus est donc catégorique, et porte sur la clé elle-même plutôt que sur
// une intention déclarée quelque part.
const CLE = env.STRIPE_TEST_SECRET_KEY
if (!CLE) {
  console.error(
    "STRIPE_TEST_SECRET_KEY absente de .env.local.\n" + "  La poser avec :  ./cric cle-test"
  )
  process.exit(1)
}
if (!CLE.startsWith("sk_test_")) {
  console.error(
    "STRIPE_TEST_SECRET_KEY ne commence pas par sk_test_.\n" +
      "  Cette suite crée des abonnements : elle ne s'exécutera pas hors du mode test."
  )
  process.exit(1)
}

// Le code de production lit STRIPE_SECRET_KEY. On la remplace ici, et
// seulement ici — le fichier .env.local n'est pas touché.
process.env.STRIPE_SECRET_KEY = CLE
process.env.NEXT_PUBLIC_SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
// La taxe et le prélèvement bancaire n'ont pas d'inscription en mode test :
// les demander ferait échouer des appels pour une raison étrangère à ce qu'on
// cherche à prouver.
delete process.env.STRIPE_AUTOMATIC_TAX
delete process.env.STRIPE_ACSS_DEBIT

const { calculerLignesPlaces, synchroniserSiegesStripe } = await import(
  "../lib/billing/seat-sync.ts"
)
const { changerForfait } = await import("../lib/billing/stripe.ts")
const { getPlan, invaliderCatalogue } = await import("../lib/billing/catalogue.ts")
const { repartirSieges } = await import("../lib/billing/seats.ts")

const sdk = new Stripe(CLE, { maxNetworkRetries: 2 })
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

let echecs = 0
function verifier(intitule, obtenu, attendu) {
  const ok = String(obtenu) === String(attendu)
  if (!ok) echecs++
  console.log(
    `  ${ok ? "✓" : "✗"} ${intitule.padEnd(50)} ${String(obtenu).padEnd(14)}` +
      (ok ? "" : ` ATTENDU ${attendu}`)
  )
}

const cents = (n) => (n / 100).toFixed(2) + " $"

/** Les lignes de places de l'abonnement, résumées « rôle×quantité@prix ». */
async function lignesStripe(subId) {
  const sub = await sdk.subscriptions.retrieve(subId)
  return sub.items.data
    .filter((i) => (i.price?.lookup_key ?? "").includes("_place"))
    .map((i) => ({
      role: (i.price?.lookup_key ?? "").split("_place_")[1] ?? "?",
      quantite: i.quantity ?? 0,
      unitaire: i.price?.unit_amount ?? 0,
    }))
    .sort((a, b) => a.role.localeCompare(b.role))
}

const resume = (lignes) =>
  lignes.length === 0 ? "(aucune)" : lignes.map((l) => `${l.role}×${l.quantite}`).join(" ")

/** Total mensuel réellement porté par l'abonnement, base comprise. */
async function totalStripe(subId) {
  const sub = await sdk.subscriptions.retrieve(subId)
  return sub.items.data.reduce((t, i) => t + (i.price?.unit_amount ?? 0) * (i.quantity ?? 0), 0)
}

async function main() {
  const marque = Date.now()
  const mdp = "Epreuve-" + randomBytes(9).toString("base64url")
  const comptes = []
  let cabinetId
  let customerId
  let subId

  console.log("Facturation par place — compte Stripe en MODE TEST\n")

  try {
    // -----------------------------------------------------------------------
    // Le cabinet
    // -----------------------------------------------------------------------
    const { data: cabinet, error: e1 } = await admin
      .from("firms")
      .insert({
        name: `Cabinet d'épreuve facturation ${marque}`,
        rcic_license_number: `R777${String(marque).slice(-4)}`,
        owner_name: "Épreuve",
        email: `facturation-${marque}@example.invalid`,
        plan: "cabinet",
        status: "active",
      })
      .select("id")
      .single()
    if (e1) throw new Error(`Cabinet : ${e1.message}`)
    cabinetId = cabinet.id

    const creerMembre = async (nom, role) => {
      const courriel = `${nom}-${marque}@example.invalid`
      const { data, error } = await admin.auth.admin.createUser({
        email: courriel,
        password: mdp,
        email_confirm: true,
      })
      if (error) throw new Error(`Compte ${nom} : ${error.message}`)
      const { error: e2 } = await admin.from("profiles").insert({
        firm_id: cabinetId,
        user_id: data.user.id,
        email: courriel,
        full_name: `${nom} d'épreuve`,
        cicc_role: role,
      })
      if (e2) throw new Error(`Profil ${nom} : ${e2.message}`)
      const c = { nom, userId: data.user.id, courriel }
      comptes.push(c)
      return c
    }

    // Un cabinet à quatre places, sous un forfait qui en comprend trois.
    // Deux rôles à 25 $ et deux à 15 $ : c'est la configuration où le choix
    // « les places comprises absorbent les plus chères » se voit.
    await creerMembre("proprio", "owner")
    const consultant = await creerMembre("consultant", "rcic")
    await creerMembre("adjointe1", "staff")
    await creerMembre("adjointe2", "staff")

    invaliderCatalogue()
    const cabinetPro = await getPlan("cabinet")
    if (!cabinetPro) throw new Error("Forfait « cabinet » absent du catalogue.")

    // -----------------------------------------------------------------------
    // L'abonnement Stripe, en mode test
    // -----------------------------------------------------------------------
    const client = await sdk.customers.create({
      name: `Cabinet d'épreuve ${marque}`,
      email: `facturation-${marque}@example.invalid`,
      metadata: { firm_id: cabinetId },
      payment_method: "pm_card_visa",
      invoice_settings: { default_payment_method: "pm_card_visa" },
    })
    customerId = client.id

    // Le tarif de base porte la même clé de recherche qu'en production, et le
    // montant vient du catalogue en base — jamais d'une constante recopiée
    // ici, sinon l'épreuve validerait sa propre copie.
    const cleBase = "mcc_cabinet_monthly"
    const existant = await sdk.prices.list({ lookup_keys: [cleBase], active: true, limit: 1 })
    const prixBase =
      existant.data[0]?.unit_amount === cabinetPro.monthly
        ? existant.data[0]
        : await sdk.prices.create({
            lookup_key: cleBase,
            ...(existant.data[0] ? { transfer_lookup_key: true } : {}),
            currency: "cad",
            unit_amount: cabinetPro.monthly,
            recurring: { interval: "month" },
            product_data: { name: "moncabinetcric — Cabinet Pro (épreuve)" },
          })

    const sub = await sdk.subscriptions.create({
      customer: customerId,
      items: [{ price: prixBase.id, quantity: 1 }],
      metadata: { firm_id: cabinetId, plan: "cabinet", cadence: "monthly" },
    })
    subId = sub.id

    await admin.from("firm_subscriptions").insert({
      firm_id: cabinetId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subId,
      plan: "cabinet",
      cadence: "monthly",
      seats: 3,
      status: "active",
    })

    console.log("Montage")
    verifier("abonnement créé chez Stripe", sub.status, "active")
    verifier("tarif de base au montant du catalogue", prixBase.unit_amount, cabinetPro.monthly)

    // -----------------------------------------------------------------------
    console.log("\n1. Quatre places, trois comprises")
    // -----------------------------------------------------------------------
    // owner et rcic partagent le tarif générique (25 $), les adjointes 15 $.
    // Les trois places comprises absorbent les plus chères : il doit rester
    // UNE adjointe à 15 $, et non un consultant à 25 $. Dix dollars par mois
    // séparent les deux lectures de « trois places comprises ».
    let r = await synchroniserSiegesStripe(cabinetId)
    verifier("la synchronisation s'applique", r.applicable, true)
    verifier("elle a modifié l'abonnement", r.modifie, true)

    let lignes = await lignesStripe(subId)
    verifier("lignes facturées", resume(lignes), "staff×1")
    verifier("prix unitaire de la place", cents(lignes[0]?.unitaire ?? 0), "15.00 $")
    verifier("total mensuel", cents(await totalStripe(subId)), cents(cabinetPro.monthly + 1500))

    // -----------------------------------------------------------------------
    console.log("\n2. Relancer sans rien changer")
    // -----------------------------------------------------------------------
    // Le contrôle le plus important de la suite. Une réécriture inutile
    // déclenche chez Stripe une proratisation, donc une ligne sur la facture
    // du cabinet. Un cabinet qui corrige une adresse ne doit pas recevoir un
    // ajustement de quelques cents pour autant.
    r = await synchroniserSiegesStripe(cabinetId)
    verifier("aucune écriture", r.modifie, false)
    verifier("lignes inchangées", resume(await lignesStripe(subId)), "staff×1")

    // -----------------------------------------------------------------------
    console.log("\n3. Une invitation en attente occupe une place")
    // -----------------------------------------------------------------------
    const { error: eInv } = await admin.from("invitations").insert({
      firm_id: cabinetId,
      email: `invitee-${marque}@example.invalid`,
      cicc_role: "staff",
      token_hash: randomBytes(32).toString("hex"),
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    })
    if (eInv) throw new Error(`Invitation : ${eInv.message}`)

    r = await synchroniserSiegesStripe(cabinetId)
    verifier("la place est facturée dès l'invitation", resume(await lignesStripe(subId)), "staff×2")
    verifier("total mensuel", cents(await totalStripe(subId)), cents(cabinetPro.monthly + 3000))

    // -----------------------------------------------------------------------
    console.log("\n4. Invitation révoquée")
    // -----------------------------------------------------------------------
    await admin
      .from("invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("firm_id", cabinetId)

    await synchroniserSiegesStripe(cabinetId)
    verifier("la place cesse d'être facturée", resume(await lignesStripe(subId)), "staff×1")

    // -----------------------------------------------------------------------
    console.log("\n5. Un membre suspendu")
    // -----------------------------------------------------------------------
    // Suspendre libère une place : le cabinet ne paie pas pour un accès fermé.
    await admin.from("profiles").update({ status: "suspended" }).eq("user_id", consultant.userId)

    await synchroniserSiegesStripe(cabinetId)
    verifier("plus aucune place supplémentaire", resume(await lignesStripe(subId)), "(aucune)")
    verifier("total revenu au forfait seul", cents(await totalStripe(subId)), cents(cabinetPro.monthly))

    await admin.from("profiles").update({ status: "active" }).eq("user_id", consultant.userId)
    await synchroniserSiegesStripe(cabinetId)
    verifier("réactivé, la place revient", resume(await lignesStripe(subId)), "staff×1")

    // -----------------------------------------------------------------------
    console.log("\n6. Changement de forfait vers Business")
    // -----------------------------------------------------------------------
    // Business comprend huit places : les quatre occupées y entrent toutes, et
    // les lignes de l'ancien forfait doivent disparaître dans la MÊME écriture.
    // Deux écritures produiraient deux proratisations pour une seule décision.
    const business = await getPlan("business")
    if (!business) throw new Error("Forfait « business » absent du catalogue.")

    const { lignes: voulues, occupees } = await calculerLignesPlaces({
      firmId: cabinetId,
      plan: business,
      cadence: "monthly",
    })
    verifier("places occupées", occupees, 4)
    verifier("aucune place à facturer sous Business", voulues.length, 0)

    const avant = (await sdk.subscriptions.retrieve(subId)).items.data.length
    const modifie = await changerForfait({
      subscriptionId: subId,
      plan: business,
      cadence: "monthly",
      firmId: cabinetId,
      lignesPlaces: voulues,
    })

    verifier("abonnement toujours actif", modifie.status, "active")
    verifier("lignes de l'ancien forfait retirées", resume(await lignesStripe(subId)), "(aucune)")
    verifier("total au tarif Business", cents(await totalStripe(subId)), cents(business.monthly))
    verifier("le forfait est inscrit en métadonnée", modifie.metadata?.plan, "business")
    console.log(`     (l'abonnement portait ${avant} ligne(s), il en porte ${modifie.items.data.length})`)

    // -----------------------------------------------------------------------
    console.log("\n7. Le calcul et Stripe disent la même chose")
    // -----------------------------------------------------------------------
    // Sous Business, on ajoute assez de monde pour dépasser les huit places
    // comprises, et on compare la répartition PURE au contenu réel de
    // l'abonnement. C'est le rapprochement final : le calcul éprouvé par les
    // tests unitaires, et ce que Stripe facture vraiment.
    await admin.from("firm_subscriptions").update({ plan: "business" }).eq("firm_id", cabinetId)
    for (let i = 0; i < 6; i++) await creerMembre(`renfort${i}`, "staff")

    await synchroniserSiegesStripe(cabinetId)

    const { data: comptesRoles } = await admin.rpc("firm_seat_counts", { f_id: cabinetId })
    const { data: grilleBrute } = await admin
      .from("plan_seat_prices")
      .select("plan, cicc_role, monthly_cents, annual_cents")

    const comptesParRole = {}
    for (const c of comptesRoles ?? []) comptesParRole[c.cicc_role] = c.n
    const grille = {}
    for (const g of grilleBrute ?? []) {
      if (g.plan !== "business") continue
      grille[g.cicc_role] = { monthly: g.monthly_cents, annual: g.annual_cents }
    }

    const attendu = repartirSieges({
      plan: business,
      comptes: comptesParRole,
      cadence: "monthly",
      grille,
    })
    const reel = await lignesStripe(subId)

    verifier(
      "répartition calculée = lignes chez Stripe",
      resume(reel),
      attendu.lignes.map((l) => `${l.ciccRole}×${l.quantite}`).join(" ") || "(aucune)"
    )
    verifier(
      "montant total",
      cents(await totalStripe(subId)),
      cents(business.monthly + attendu.supplement)
    )
  } finally {
    // -----------------------------------------------------------------------
    // Démontage
    // -----------------------------------------------------------------------
    if (subId) await sdk.subscriptions.cancel(subId).catch(() => {})
    if (customerId) await sdk.customers.del(customerId).catch(() => {})
    if (cabinetId) await admin.from("firms").delete().eq("id", cabinetId)
    for (const c of comptes) await admin.auth.admin.deleteUser(c.userId).catch(() => {})
    console.log("\nCabinet, comptes et abonnement d'épreuve supprimés.")
  }

  console.log(
    echecs === 0
      ? "\n✓ Facturation par place vérifiée contre Stripe, 0 échec."
      : `\n✗ ${echecs} échec(s).`
  )
  process.exit(echecs === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error("\nÉchec :", e.message)
  process.exit(1)
})
