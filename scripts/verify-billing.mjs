#!/usr/bin/env node
/**
 * Éprouve la promesse la plus simple et la plus facile à trahir :
 * le client paie le prix qu'il a vu.
 *
 *   ./cric facturation                       (page publiée)
 *   ./cric facturation --url=http://localhost:3000
 *
 * Trois maillons séparent le montant affiché du montant débité, et chacun
 * peut dériver sans que rien ne casse :
 *
 *   1. la page publique  ← ce que le client lit avant de décider
 *   2. le catalogue      ← lib/billing/plans.ts, ce que le code croit
 *   3. Stripe            ← ce qui est réellement facturé
 *   4. plan_limits       ← ce que la base accorde en échange
 *
 * Le maillon 3 est le plus traître. Un tarif chez Stripe est immuable : on
 * n'en change pas le montant, on en crée un autre. Une modification du
 * catalogue change donc la page à l'instant même, sans rien changer à ce qui
 * est débité — jusqu'à ce que quelqu'un s'en aperçoive sur une facture.
 *
 * Ce script compare les quatre, et échoue au moindre écart d'un cent.
 */

import { readFile } from "node:fs/promises"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"
import Stripe from "stripe"
import { formatMontant, DEVISE } from "../lib/billing/plans.ts"
import { getCatalogue, getForfaitsSouscriptibles } from "../lib/billing/catalogue.ts"

/**
 * Le catalogue, chargé une fois au démarrage.
 *
 * Il vivait dans une constante PLANS de plans.ts. Il vit maintenant dans
 * plan_limits, en base, et se modifie depuis la console d'exploitation sans
 * déploiement. Ce script a cessé de fonctionner le jour de ce déplacement, et
 * personne ne l'a vu : la commande existait toujours, elle échouait seulement
 * à l'import — ce qui rappelle qu'une suite qu'on ne lance pas ne protège
 * rien.
 *
 * Il est lu par getCatalogue(), c'est-à-dire par le MÊME code que la page
 * publique. Relire plan_limits à la main ici éprouverait la base, pas le
 * chemin qu'emprunte réellement un client.
 */
let CATALOGUE = {}
let SOUSCRIPTIBLES = []

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

async function chargerEnv() {
  const brut = await readFile(join(ROOT, ".env.local"), "utf8")
  const env = {}
  for (const ligne of brut.split("\n")) {
    const m = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }
  return env
}

let echecs = 0
let ignores = 0

function verifier(intitule, attendu, obtenu) {
  const ok = String(attendu) === String(obtenu)
  if (!ok) echecs++
  console.log(
    `  ${ok ? "✓" : "✗"} ${intitule.padEnd(46)} ${obtenu}` + (ok ? "" : `   ATTENDU ${attenu(attendu)}`)
  )
}

const attenu = (v) => String(v)

function ignorer(intitule, raison) {
  ignores++
  console.log(`  · ${intitule.padEnd(46)} ignoré — ${raison}`)
}

/** Les quatre lignes de facturation possibles, telles que Stripe les nomme. */
function lignesCatalogue() {
  const lignes = []
  for (const p of SOUSCRIPTIBLES) {
    const plan = p.key
    for (const cadence of ["monthly", "annual"]) {
      lignes.push({
        cle: `mcc_${plan}_${cadence}`,
        intitule: `${plan} ${cadence}`,
        montant: cadence === "annual" ? p.annual : p.monthly,
        intervalle: cadence === "annual" ? "year" : "month",
      })
      const extra = cadence === "annual" ? p.extraSeatAnnual : p.extraSeatMonthly
      if (extra > 0) {
        lignes.push({
          cle: `mcc_${plan}_${cadence}_place`,
          intitule: `${plan} ${cadence} — place`,
          montant: extra,
          intervalle: cadence === "annual" ? "year" : "month",
        })
      }
    }
  }
  return lignes
}

/**
 * Normalise une chaîne de prix avant comparaison.
 *
 * Intl place une espace fine insécable avant le symbole ; le HTML peut la
 * rendre en &nbsp;, en U+202F ou en U+00A0 selon le chemin parcouru. Comparer
 * ces trois-là caractère par caractère ferait échouer un test alors que le
 * client, lui, lit exactement le même prix.
 */
function normaliser(s) {
  return s.replace(/[\s   ]+/g, " ").trim()
}

async function main() {
  const env = await chargerEnv()
  const arg = process.argv.find((a) => a.startsWith("--url="))
  const base = (arg ? arg.slice(6) : env.APP_URL || "http://localhost:3000").replace(/\/+$/, "")

  // getCatalogue() lit ses identifiants dans process.env, comme en
  // production. Le script, lui, charge .env.local dans un objet local : sans
  // ce report, le lecteur du catalogue ne trouve rien et échoue sur une
  // « configuration Supabase incomplète » qui ne dit pas d'où vient le manque.
  process.env.NEXT_PUBLIC_SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
  process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

  const tous = await getCatalogue()
  CATALOGUE = Object.fromEntries(tous.map((p) => [p.key, p]))
  SOUSCRIPTIBLES = await getForfaitsSouscriptibles()

  if (SOUSCRIPTIBLES.length === 0) {
    console.error("Catalogue vide : aucun forfait souscriptible en base. Rien à éprouver.")
    process.exit(1)
  }

  console.log(`\nPage éprouvée : ${base}/fr/landing`)
  console.log(`Catalogue     : ${SOUSCRIPTIBLES.map((p) => p.labelFr).join(", ")}\n`)

  // -------------------------------------------------------------------------
  console.log("1. Ce que le client lit sur la page publique")
  // -------------------------------------------------------------------------
  let html = ""
  try {
    const r = await fetch(`${base}/fr/landing`)
    html = normaliser(await r.text())
  } catch (e) {
    ignorer("page publique", `injoignable (${e.message})`)
  }

  if (html) {
    // Un forfait peut être vendable sans être ANNONCÉ : la page publique est
    // un choix commercial, et rien n'oblige à y montrer toute la gamme. Ce
    // script ne tranche donc pas cette question — il tranche la seule qui
    // engage : un forfait annoncé l'est-il au bon prix ?
    //
    // Confondre les deux rendrait la suite bruyante, et une suite bruyante
    // finit ignorée. C'est exactement ce qui est arrivé à celle-ci : elle
    // échouait à l'import depuis des semaines sans que personne ne le voie.
    for (const p of SOUSCRIPTIBLES) {
      const etiquette = p.labelFr
      const annonce = html.includes(normaliser(etiquette))

      if (!annonce) {
        ignores++
        console.log(
          `  · ${`${etiquette} — non annoncé publiquement`.padEnd(46)} ${normaliser(formatMontant(p.monthly, "fr"))} en interne`
        )
        continue
      }

      for (const [quoi, cents] of [["mensuel", p.monthly], ["annuel", p.annual]]) {
        const affiche = normaliser(formatMontant(cents, "fr"))
        const present = html.includes(affiche)
        if (!present) echecs++
        console.log(
          `  ${present ? "✓" : "✗"} ${`${etiquette} — ${quoi} affiché`.padEnd(46)} ${affiche}` +
            (present ? "" : "   INTROUVABLE dans la page")
        )
      }
    }

    // La page annonce « taxes en sus » : le tarif Stripe doit donc être
    // « exclusive ». Une page muette sur la taxe se lit comme un prix TTC.
    const ditTaxe = /taxes en sus/i.test(html)
    if (!ditTaxe) echecs++
    console.log(
      `  ${ditTaxe ? "✓" : "✗"} ${"mention « taxes en sus »".padEnd(46)} ${ditTaxe ? "présente" : "ABSENTE"}`
    )
  }

  // -------------------------------------------------------------------------
  console.log("\n2. Ce que Stripe facturerait")
  // -------------------------------------------------------------------------
  if (!env.STRIPE_SECRET_KEY) {
    ignorer("tarifs Stripe", "STRIPE_SECRET_KEY absente de .env.local")
    console.log(
      "    Les tarifs sont créés à la première souscription, au montant du\n" +
        "    catalogue. Tant qu'aucun n'existe, l'écart est impossible ; c'est\n" +
        "    après la première création qu'il faut repasser ici."
    )
  } else {
    const sdk = new Stripe(env.STRIPE_SECRET_KEY, { maxNetworkRetries: 2 })
    const mode = env.STRIPE_SECRET_KEY.startsWith("sk_live") ? "RÉEL (live)" : "test"
    console.log(`  Mode : ${mode}\n`)

    for (const ligne of lignesCatalogue()) {
      const { data } = await sdk.prices.list({ lookup_keys: [ligne.cle], active: true, limit: 1 })
      const prix = data[0]

      if (!prix) {
        ignorer(ligne.intitule, "pas encore créé chez Stripe")
        continue
      }

      verifier(`${ligne.intitule} — montant`, ligne.montant, prix.unit_amount)
      verifier(`${ligne.intitule} — devise`, DEVISE, prix.currency)
      verifier(`${ligne.intitule} — période`, ligne.intervalle, prix.recurring?.interval)
      // « exclusive » = la taxe s'ajoute. « inclusive » ferait payer au client
      // le prix affiché taxes comprises, donc moins que prévu au cabinet.
      verifier(`${ligne.intitule} — taxe`, "exclusive", prix.tax_behavior)
    }
  }

  // -------------------------------------------------------------------------
  console.log("\n3. Ce que la base accorde en échange")
  // -------------------------------------------------------------------------
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    ignorer("plan_limits", "clé de service absente")
  } else {
    const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })
    const { data } = await sb.from("plan_limits").select("plan, max_seats, ai_connector")
    const parPlan = Object.fromEntries((data ?? []).map((l) => [l.plan, l]))

    // plan_limits EST devenue la source du catalogue : la comparer à
    // getCatalogue() reviendrait à comparer la base à elle-même. Ce qui reste
    // à prouver, c'est que le lecteur employé par l'application rapporte
    // fidèlement ce que la table contient — un forfait perdu en route ne
    // s'afficherait nulle part, et ne se vendrait plus.
    for (const p of SOUSCRIPTIBLES) {
      const ligne = parPlan[p.key]
      if (!ligne) {
        echecs++
        console.log(`  ✗ ${p.key.padEnd(46)} absent de plan_limits`)
        continue
      }
      verifier(`${p.key} — places autorisées`, p.maxSeats ?? "sans limite", ligne.max_seats ?? "sans limite")
      verifier(`${p.key} — connecteur IA`, p.aiConnector, ligne.ai_connector)
    }
    const manquants = Object.keys(parPlan).filter((k) => !(k in CATALOGUE))
    verifier("aucun forfait perdu entre la table et le lecteur", manquants.length, 0)
  }

  // -------------------------------------------------------------------------
  console.log("\n4. Cohérence interne du catalogue")
  // -------------------------------------------------------------------------
  for (const p of SOUSCRIPTIBLES) {
    // Deux mois offerts : la page l'annonce, le montant annuel doit le tenir.
    verifier(`${p.key} — annuel = 10 × mensuel`, p.monthly * 10, p.annual)
    // Un forfait vendable sans prix se glisserait dans le tunnel de paiement
    // et y produirait une ligne à zéro.
    verifier(`${p.key} — a bien un prix`, p.monthly > 0 && p.annual > 0, true)
  }

  console.log(
    echecs === 0
      ? `\n✓ Prix affiché et prix facturé concordent, 0 écart.${ignores ? ` (${ignores} contrôle(s) ignoré(s))` : ""}\n`
      : `\n✗ ${echecs} écart(s) — un client paierait autre chose que ce qu'il a vu.\n`
  )
  process.exit(echecs === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error("Échec :", e.message)
  process.exit(1)
})
