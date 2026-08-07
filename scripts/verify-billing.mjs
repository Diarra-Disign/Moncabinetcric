#!/usr/bin/env node
/**
 * Éprouve le verrou de facturation.
 *
 *   ./cric facturation
 *
 * Ce que ce script vérifie n'est pas « Stripe fonctionne » — cela, seul un
 * vrai paiement le dira. Il vérifie la seule chose qui puisse mal tourner en
 * silence : la correspondance entre l'état d'un abonnement et l'ouverture de
 * l'accès aux données.
 *
 * L'affaire se joue dans une unique fonction SQL, firm_access_open(), à
 * laquelle s'adossent les trente politiques RLS de l'application et le
 * connecteur d'intelligence artificielle. Une condition mal écrite y produit
 * l'une de deux catastrophes symétriques : des cabinets qui paient et se
 * retrouvent dehors, ou des cabinets qui ne paient plus et restent dedans.
 * Ni l'une ni l'autre ne se voit à la lecture du code.
 *
 * Les cabinets d'épreuve sont créés puis supprimés. Aucun appel à Stripe.
 */

import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { runSql } from "./apply-migration.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

/** Variables de .env.local, lues sans les afficher. */
async function env() {
  const raw = await readFile(join(ROOT, ".env.local"), "utf8").catch(() => "")
  const out = {}
  for (const ligne of raw.split("\n")) {
    const m = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }
  return out
}

let echecs = 0

/**
 * Vocabulaire courant. Un booléen ne dit pas la même chose selon ce qu'on
 * mesure : « fermé » pour un accès, « refusé » pour une invitation. Afficher
 * « ouvert » sur une invitation acceptée obligerait à traduire mentalement
 * chaque ligne du rapport.
 */
const ACCES = ["ouvert", "fermé"]
const ECRITURE = ["accepté", "refusé"]
const CONFORME = ["conforme", "non conforme"]

function verifier(intitule, obtenu, attendu, mots = ACCES) {
  const ok = obtenu === attendu
  if (!ok) echecs++
  console.log(
    `  ${ok ? "✓" : "✗"} ${intitule.padEnd(54)} ${etiquette(obtenu, mots)}` +
      (ok ? "" : `   ATTENDU ${etiquette(attendu, mots)}`)
  )
}

function etiquette(v, mots) {
  if (v === true) return mots[0]
  if (v === false) return mots[1]
  return String(v)
}

/** Première valeur de la première ligne renvoyée. */
function valeur(resultat) {
  const ligne = Array.isArray(resultat) ? resultat[0] : resultat
  return ligne ? Object.values(ligne)[0] : null
}

const PERMIS_A = "R8880001"
const PERMIS_B = "R8880002"

async function creerCabinet(permis, plan, statut = "active", echeance = null) {
  const r = await runSql(`
    insert into public.firms (name, rcic_license_number, owner_name, email, plan, status, trial_ends_at)
    values ('Cabinet de facturation ${permis}', '${permis}', 'Épreuve',
            '${permis}@example.invalid', '${plan}', '${statut}',
            ${echeance ? `'${echeance}'` : "null"})
    returning id;
  `)
  return valeur(r)
}

async function accesOuvert(firmId) {
  return valeur(await runSql(`select public.firm_access_open('${firmId}') as ouvert;`))
}

/**
 * Pose ou modifie l'abonnement du cabinet.
 *
 * `plan` est toujours fourni à l'insertion, même quand l'appelant ne le
 * change pas : la colonne est NOT NULL, et une clause ON CONFLICT ne rattrape
 * pas une insertion qui échoue avant d'entrer en conflit.
 */
async function poserAbonnement(firmId, champs) {
  const complets = { plan: "'solo'", ...champs }
  const colonnes = ["firm_id", ...Object.keys(complets)]
  const valeurs = [`'${firmId}'`, ...Object.values(complets)]
  await runSql(`
    insert into public.firm_subscriptions (${colonnes.join(", ")})
    values (${valeurs.join(", ")})
    on conflict (firm_id) do update set
      ${Object.keys(champs).map((c) => `${c} = excluded.${c}`).join(", ")};
  `)
}

/** Tente une insertion et dit seulement si elle a été acceptée. */
async function tenter(sql) {
  try {
    await runSql(sql)
    return true
  } catch {
    return false
  }
}

async function inviter(firmId) {
  return tenter(`
    insert into public.invitations (firm_id, email, cicc_role, token_hash, expires_at)
    values ('${firmId}', '${randomUUID()}@example.invalid', 'staff',
            '${randomUUID().replace(/-/g, "")}', now() + interval '7 days');
  `)
}

async function main() {
  // Un reliquat d'exécution interrompue fausserait le compte des places.
  await runSql(
    `delete from public.firms where rcic_license_number in ('${PERMIS_A}', '${PERMIS_B}');`
  )

  const a = await creerCabinet(PERMIS_A, "solo")
  const b = await creerCabinet(PERMIS_B, "cabinet")

  try {
    console.log("\nL'accès suit l'abonnement")
    verifier("plan payant, aucun abonnement", await accesOuvert(a), false)

    await poserAbonnement(a, { plan: "'solo'", status: "'active'" })
    verifier("abonnement à jour", await accesOuvert(a), true)

    await poserAbonnement(a, { status: "'trialing'" })
    verifier("période d'essai Stripe", await accesOuvert(a), true)

    await poserAbonnement(a, { status: "'past_due'", grace_until: "null" })
    verifier("prélèvement échoué, aucun délai posé", await accesOuvert(a), false)

    await poserAbonnement(a, { status: "'past_due'", grace_until: "now() + interval '5 days'" })
    verifier("prélèvement échoué, délai en cours", await accesOuvert(a), true)

    await poserAbonnement(a, { status: "'past_due'", grace_until: "now() - interval '1 day'" })
    verifier("prélèvement échoué, délai épuisé", await accesOuvert(a), false)

    await poserAbonnement(a, { status: "'canceled'", grace_until: "null" })
    verifier("abonnement résilié", await accesOuvert(a), false)

    console.log("\nCe que le paiement ne décide pas")
    await poserAbonnement(a, { status: "'active'" })
    await runSql(`update public.firms set status = 'suspended' where id = '${a}';`)
    verifier("suspendu par l'exploitant, abonnement à jour", await accesOuvert(a), false)

    await runSql(`update public.firms set status = 'active', plan = 'courtoisie' where id = '${a}';`)
    await runSql(`delete from public.firm_subscriptions where firm_id = '${a}';`)
    verifier("accès de courtoisie, aucun paiement", await accesOuvert(a), true)

    await runSql(`
      update public.firms set plan = 'trial', trial_ends_at = current_date - 1 where id = '${a}';
    `)
    verifier("essai échu", await accesOuvert(a), false)

    await runSql(`
      update public.firms set trial_ends_at = current_date + 7 where id = '${a}';
    `)
    verifier("essai en cours", await accesOuvert(a), true)

    console.log("\nLes places, refusées par la base et non par un écran")
    await runSql(`update public.firms set plan = 'solo' where id = '${a}';`)
    await poserAbonnement(a, { plan: "'solo'", status: "'active'", seats: "1" })
    verifier("Solo — 1re invitation", await inviter(a), true, ECRITURE)
    verifier("Solo — 2e invitation, la place est prise", await inviter(a), false, ECRITURE)

    await poserAbonnement(b, { plan: "'cabinet'", status: "'active'", seats: "3" })
    verifier("Cabinet Pro — 1re invitation", await inviter(b), true, ECRITURE)
    verifier("Cabinet Pro — 2e invitation", await inviter(b), true, ECRITURE)
    verifier("Cabinet Pro — 3e invitation", await inviter(b), true, ECRITURE)
    verifier("Cabinet Pro — 4e, les 3 places sont prises", await inviter(b), false, ECRITURE)

    console.log("\nLe connecteur suit le plan")
    // La clé et le connecteur sont identiques des deux côtés : seul le plan
    // du cabinet distingue les deux cas.
    const cle = `cric_live_${randomUUID().replace(/-/g, "")}`
    for (const id of [a, b]) {
      await runSql(`
        insert into public.ai_connector_settings (firm_id, enabled)
        values ('${id}', true)
        on conflict (firm_id) do update set enabled = true;
        insert into public.ai_api_keys (firm_id, label, key_prefix, key_hash)
        values ('${id}', 'Épreuve', '${cle.slice(0, 12)}',
                encode(extensions.digest('${cle}${id}', 'sha256'), 'hex'));
      `)
    }

    const parSolo = valeur(await runSql(`select public.connector_firm('${cle}${a}') as f;`))
    const parCabinet = valeur(await runSql(`select public.connector_firm('${cle}${b}') as f;`))
    verifier("plan Solo, connecteur ouvert et clé valide", parSolo !== null, false)
    verifier("plan Cabinet Pro, même configuration", parCabinet === b, true)

    console.log("\nLe webhook ne traite un événement qu'une fois")
    const evt = `evt_epreuve_${randomUUID().slice(0, 8)}`
    verifier(
      "1re livraison",
      await tenter(`insert into public.stripe_events (id, type) values ('${evt}', 'essai');`),
      true,
      ECRITURE
    )
    verifier(
      "livraison répétée",
      await tenter(`insert into public.stripe_events (id, type) values ('${evt}', 'essai');`),
      false,
      ECRITURE
    )
    await runSql(`delete from public.stripe_events where id = '${evt}';`)

    console.log("\nLe webhook refuse ce qu'il ne peut pas vérifier")
    const rendu = await epreuveHttp()
    if (rendu === null) {
      console.log("  · serveur de développement absent — épreuve HTTP passée")
    } else {
      // Sans secret de signature, la route ne peut vérifier personne : elle
      // doit répondre 503 et non 400. La nuance compte pour Stripe, qui
      // abandonne un événement sur 400 et le réessaie sur 503 — c'est ce qui
      // permet à un abonnement de se rattraper une fois la clé posée.
      const configure = Boolean((await env()).STRIPE_WEBHOOK_SECRET)
      const attendu = configure ? 400 : 503
      if (!configure) console.log("  · STRIPE_WEBHOOK_SECRET absente : 503 attendu, et non 400")
      verifier("appel sans signature", rendu.sansSignature, attendu, CONFORME)
      verifier("appel avec signature contrefaite", rendu.signatureFausse, attendu, CONFORME)
    }
  } finally {
    await runSql(
      `delete from public.firms where rcic_license_number in ('${PERMIS_A}', '${PERMIS_B}');`
    )
    console.log("\nCabinets d'épreuve supprimés.")
  }

  console.log(echecs === 0 ? "\n✓ Verrou de facturation vérifié, 0 échec." : `\n✗ ${echecs} échec(s).`)
  process.exit(echecs === 0 ? 0 : 1)
}

async function epreuveHttp() {
  const base = process.env.APP_URL || "http://localhost:3000"
  const url = `${base}/api/stripe/webhook`
  const corps = JSON.stringify({ id: "evt_faux", type: "customer.subscription.updated" })

  try {
    const sans = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: corps,
    })
    const faux = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "stripe-signature": "t=1,v1=deadbeef" },
      body: corps,
    })
    return { sansSignature: sans.status, signatureFausse: faux.status }
  } catch {
    return null
  }
}

main().catch((e) => {
  console.error("Échec :", e.message)
  process.exit(1)
})
