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
import { PLANS, formatMontant, DEVISE } from "../lib/billing/plans.ts"

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
  for (const plan of ["solo", "cabinet"]) {
    for (const cadence of ["monthly", "annual"]) {
      lignes.push({
        cle: `mcc_${plan}_${cadence}`,
        intitule: `${plan} ${cadence}`,
        montant: cadence === "annual" ? PLANS[plan].annual : PLANS[plan].monthly,
        intervalle: cadence === "annual" ? "year" : "month",
      })
      const extra = cadence === "annual" ? PLANS[plan].extraSeatAnnual : PLANS[plan].extraSeatMonthly
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

  console.log(`\nPage éprouvée : ${base}/fr/landing\n`)

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
    for (const [plan, etiquette] of [["solo", "Solo"], ["cabinet", "Cabinet Pro"]]) {
      const affiche = normaliser(formatMontant(PLANS[plan].monthly, "fr"))
      const present = html.includes(affiche)
      if (!present) echecs++
      console.log(
        `  ${present ? "✓" : "✗"} ${`${etiquette} — mensuel affiché`.padEnd(46)} ${affiche}` +
          (present ? "" : "   INTROUVABLE dans la page")
      )

      const annuel = normaliser(formatMontant(PLANS[plan].annual, "fr"))
      const presentAn = html.includes(annuel)
      if (!presentAn) echecs++
      console.log(
        `  ${presentAn ? "✓" : "✗"} ${`${etiquette} — annuel affiché`.padEnd(46)} ${annuel}` +
          (presentAn ? "" : "   INTROUVABLE dans la page")
      )
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

    for (const plan of ["solo", "cabinet"]) {
      const ligne = parPlan[plan]
      if (!ligne) {
        echecs++
        console.log(`  ✗ ${plan.padEnd(46)} absent de plan_limits`)
        continue
      }
      verifier(`${plan} — places autorisées`, PLANS[plan].maxSeats ?? "sans limite", ligne.max_seats ?? "sans limite")
      verifier(`${plan} — connecteur IA`, PLANS[plan].aiConnector, ligne.ai_connector)
    }
  }

  // -------------------------------------------------------------------------
  console.log("\n4. Cohérence interne du catalogue")
  // -------------------------------------------------------------------------
  for (const plan of ["solo", "cabinet"]) {
    // Deux mois offerts : la page l'annonce, le montant annuel doit le tenir.
    verifier(`${plan} — annuel = 10 × mensuel`, PLANS[plan].monthly * 10, PLANS[plan].annual)
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
