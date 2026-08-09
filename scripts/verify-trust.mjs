#!/usr/bin/env node
/**
 * Éprouve les paiements et le registre de fidéicommis.
 *
 *   ./cric fideicommis
 *
 * Ce qui est vérifié tient en une phrase : l'argent d'un client ne peut ni
 * disparaître, ni servir à un autre.
 *
 * Les contrôles passent par de VRAIES SESSIONS d'utilisateur, jamais par la
 * clé de service. C'est la seule façon d'éprouver la RLS : avec la clé de
 * service, tout passe, et une politique absente ressemble à une politique
 * correcte.
 */

import { readFile } from "node:fs/promises"
import { randomBytes } from "node:crypto"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

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

let echecs = 0
function verifier(intitule, obtenu, attendu) {
  const ok = String(obtenu) === String(attendu)
  if (!ok) echecs++
  console.log(
    `  ${ok ? "✓" : "✗"} ${intitule.padEnd(52)} ${String(obtenu).padEnd(12)}` +
      (ok ? "" : ` ATTENDU ${attendu}`)
  )
}

async function main() {
  const env = await loadEnv()
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const commeUtilisateur = async (courriel, mdp) => {
    const c = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    })
    const { error } = await c.auth.signInWithPassword({ email: courriel, password: mdp })
    if (error) throw new Error(`Connexion ${courriel} : ${error.message}`)
    return c
  }

  const marque = Date.now()
  const mdp = "Epreuve-" + randomBytes(9).toString("base64url")
  const comptes = []
  let cabinetA, cabinetB, clientA, clientB, matterA, factureA

  try {
    // -----------------------------------------------------------------------
    // Deux cabinets : le second ne sert qu'à prouver le cloisonnement.
    // -----------------------------------------------------------------------
    // Le numéro de permis suit le format imposé : R + six chiffres.
    const creerCabinet = async (suffixe, chiffre) => {
      const { data, error } = await admin.from("firms").insert({
        name: `Cabinet fidéicommis ${suffixe} ${marque}`,
        rcic_license_number: `R9${chiffre}${String(marque).slice(-4)}`,
        owner_name: "Épreuve",
        email: `fid-${suffixe}-${marque}@example.invalid`,
        plan: "cabinet",
        status: "active",
      }).select("id").single()
      if (error) throw new Error(`Cabinet ${suffixe} : ${error.message}`)
      await admin.from("firm_subscriptions").insert({
        firm_id: data.id, plan: "cabinet", cadence: "monthly", seats: 3,
        status: "active", stripe_customer_id: `cus_fid_${suffixe}_${marque}`,
      })
      return data.id
    }
    cabinetA = await creerCabinet("a", 1)
    cabinetB = await creerCabinet("b", 2)

    const creerMembre = async (nom, firmId, role) => {
      const courriel = `${nom}-${marque}@example.invalid`
      const { data, error } = await admin.auth.admin.createUser({
        email: courriel, password: mdp, email_confirm: true,
      })
      if (error) throw new Error(`Compte ${nom} : ${error.message}`)
      const { error: e2 } = await admin.from("profiles").insert({
        firm_id: firmId, user_id: data.user.id, email: courriel,
        full_name: `${nom} d'épreuve`, cicc_role: role,
      })
      if (e2) throw new Error(`Profil ${nom} : ${e2.message}`)
      const c = { nom, userId: data.user.id, session: await commeUtilisateur(courriel, mdp) }
      comptes.push(c)
      return c
    }

    const proprio = await creerMembre("proprio", cabinetA, "owner")
    // La tenue de livres : c'est elle qui encaisse et qui vire les honoraires.
    const teneuse = await creerMembre("teneuse", cabinetA, "bookkeeper")
    // L'adjointe administrative : elle tient les dossiers, pas l'argent.
    const adjointe = await creerMembre("adjointe", cabinetA, "staff")
    const intrus = await creerMembre("intrus", cabinetB, "owner")

    const creerClient = async (firmId, nom) => {
      const { data, error } = await admin.from("clients").insert({
        firm_id: firmId, name: nom, email: `${nom.toLowerCase().replace(/\W/g, "")}-${marque}@example.invalid`,
        file_number: `DOS-${String(marque).slice(-6)}-${nom.slice(0, 2).toUpperCase()}`,
        program: "express_entry", status: "active", client_type: "individual",
      }).select("id").single()
      if (error) throw new Error(`Client ${nom} : ${error.message}`)
      return data.id
    }
    clientA = await creerClient(cabinetA, "Tremblay")
    clientB = await creerClient(cabinetB, "Autre")

    const { data: m, error: em } = await admin.from("matters").insert({
      firm_id: cabinetA, client_id: clientA, reference: `M-${marque}`,
      client_name: "Tremblay", program: "express_entry", category: "pr",
      rcic: "Épreuve", status: "pending", client_type: "b2c",
    }).select("id").single()
    if (em) throw new Error(`Dossier : ${em.message}`)
    matterA = m.id

    // -----------------------------------------------------------------------
    console.log("Scénario 1 du brief — facture 1 000 $, paiement 500 $ en fidéicommis")
    // -----------------------------------------------------------------------
    const { data: f, error: ef } = await proprio.session.from("invoices").insert({
      firm_id: cabinetA, client_id: clientA, matter_id: matterA,
      invoice_number: `FA-${marque}`, client_name: "Tremblay",
      service_description: "Honoraires — résidence permanente",
      amount: 1000.0, date: new Date().toISOString().slice(0, 10),
      due_on: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      status: "issued",
    }).select("id").single()
    verifier("la facture se crée", ef ? ef.message : "ok", "ok")
    factureA = f?.id

    const { error: ep } = await proprio.session.from("payments").insert({
      firm_id: cabinetA, client_id: clientA, matter_id: matterA, invoice_id: factureA,
      amount: 500.0, paid_on: new Date().toISOString().slice(0, 10),
      method: "interac", reference: `TX-${marque}`,
      destination: "trust", recorded_by: null,
    })
    verifier("le paiement s'enregistre", ep ? ep.message : "ok", "ok")

    const solde = async (cid) => {
      const { data } = await admin.rpc("client_trust_balance", { c_id: cid })
      return Number(data).toFixed(2)
    }
    verifier("500 $ figurent au fidéicommis du client", await solde(clientA), "500.00")

    const { data: ecritures } = await admin
      .from("trust_ledger").select("entry_type, amount").eq("client_id", clientA)
    verifier("une écriture de dépôt, et une seule", ecritures?.length, 1)
    verifier("elle est bien un dépôt", ecritures?.[0]?.entry_type, "deposit")

    const { data: statut } = await admin.rpc("invoice_status", { i_id: factureA })
    verifier("la facture devient « partiellement payée »", statut, "partial")

    // -----------------------------------------------------------------------
    console.log("\nLa ventilation comptable ne mélange jamais les deux")
    // -----------------------------------------------------------------------
    await proprio.session.from("payments").insert({
      firm_id: cabinetA, client_id: clientA, matter_id: matterA, invoice_id: factureA,
      amount: 300.0, paid_on: new Date().toISOString().slice(0, 10),
      method: "card", destination: "business",
    })

    const totalPar = async (dest) => {
      const { data } = await admin.from("payments").select("amount")
        .eq("firm_id", cabinetA).eq("destination", dest)
      return data.reduce((t, r) => t + Number(r.amount), 0).toFixed(2)
    }
    verifier("total reçu en fidéicommis", await totalPar("trust"), "500.00")
    verifier("total reçu au compte d'entreprise", await totalPar("business"), "300.00")
    verifier("le solde du fidéicommis n'a pas bougé", await solde(clientA), "500.00")

    const { data: st2 } = await admin.rpc("invoice_status", { i_id: factureA })
    verifier("facture réglée à 800 $ sur 1 000 : toujours partielle", st2, "partial")

    // -----------------------------------------------------------------------
    console.log("\nLa règle cardinale : jamais de solde débiteur")
    // -----------------------------------------------------------------------
    const { error: eTrop } = await proprio.session.from("trust_ledger").insert({
      firm_id: cabinetA, client_id: clientA, entry_type: "transfer_to_business",
      amount: 700.0, memo: "tentative au-delà du solde",
    })
    verifier("virer plus que le solde est refusé", eTrop ? "refusé" : "ACCEPTÉ", "refusé")
    verifier("le solde est intact", await solde(clientA), "500.00")

    const { error: eOk } = await proprio.session.from("trust_ledger").insert({
      firm_id: cabinetA, client_id: clientA, invoice_id: factureA,
      entry_type: "transfer_to_business", amount: 200.0,
      memo: "honoraires gagnés",
    })
    verifier("virer dans la limite du solde est accepté", eOk ? eOk.message : "ok", "ok")
    verifier("le solde descend à 300 $", await solde(clientA), "300.00")

    // -----------------------------------------------------------------------
    console.log("\nSéparation des tâches : qui touche à l'argent")
    // -----------------------------------------------------------------------
    // Le premier jet de ce contrôle attendait qu'une adjointe puisse encaisser.
    // La base a refusé, et elle avait raison : `invoices.write` n'est accordée
    // qu'au propriétaire, au consultant réglementé et à la tenue de livres.
    // C'est une séparation des tâches délibérée, et elle vaut mieux que
    // l'inverse — la personne qui classe les pièces d'un dossier n'a pas à
    // pouvoir déclarer qu'un client a payé.
    const { error: eEnc } = await teneuse.session.from("payments").insert({
      firm_id: cabinetA, client_id: clientA, amount: 50.0,
      paid_on: new Date().toISOString().slice(0, 10),
      method: "cash", destination: "trust",
    })
    verifier("la tenue de livres peut encaisser", eEnc ? eEnc.message : "ok", "ok")

    const { error: eEncAdj } = await adjointe.session.from("payments").insert({
      firm_id: cabinetA, client_id: clientA, amount: 50.0,
      paid_on: new Date().toISOString().slice(0, 10),
      method: "cash", destination: "trust",
    })
    verifier("l'adjointe ne peut pas encaisser", eEncAdj ? "refusé" : "ACCEPTÉ", "refusé")

    const { error: eSortie } = await adjointe.session.from("trust_ledger").insert({
      firm_id: cabinetA, client_id: clientA, entry_type: "refund_to_client", amount: 10.0,
    })
    verifier("ni sortir de fonds du fidéicommis", eSortie ? "refusé" : "ACCEPTÉ", "refusé")

    // Le cabinet peut toujours déléguer nommément, sans changer de rôle :
    // c'est ce que permettent les permissions par membre.
    await admin.from("profile_permissions").insert({
      profile_id: (await admin.from("profiles").select("id").eq("user_id", adjointe.userId).single()).data.id,
      permission: "invoices.write", granted: true,
    })
    const { error: eDelegue } = await adjointe.session.from("payments").insert({
      firm_id: cabinetA, client_id: clientA, amount: 25.0,
      paid_on: new Date().toISOString().slice(0, 10),
      method: "cash", destination: "business",
    })
    verifier("déléguée nommément, elle encaisse", eDelegue ? eDelegue.message : "ok", "ok")

    // -----------------------------------------------------------------------
    console.log("\nCloisonnement entre cabinets")
    // -----------------------------------------------------------------------
    const { data: vus } = await intrus.session.from("payments").select("id")
    verifier("un autre cabinet ne voit aucun paiement", vus?.length ?? 0, 0)

    const { data: vuesL } = await intrus.session.from("trust_ledger").select("id")
    verifier("ni aucune écriture de fidéicommis", vuesL?.length ?? 0, 0)

    const { error: eVol } = await intrus.session.from("payments").insert({
      firm_id: cabinetA, client_id: clientA, amount: 1.0,
      paid_on: new Date().toISOString().slice(0, 10),
      method: "cash", destination: "business",
    })
    verifier("il ne peut pas écrire chez le voisin", eVol ? "refusé" : "ACCEPTÉ", "refusé")

    // -----------------------------------------------------------------------
    console.log("\nUn paiement enregistré ne se réécrit pas")
    // -----------------------------------------------------------------------
    const { data: unPaiement } = await admin.from("payments")
      .select("id").eq("client_id", clientA).eq("destination", "trust").limit(1).single()

    const { error: eMod } = await proprio.session.from("payments")
      .update({ amount: 9999.0 }).eq("id", unPaiement.id)
    verifier("modifier le montant est refusé", eMod ? "refusé" : "ACCEPTÉ", "refusé")

    const { error: eDest } = await proprio.session.from("payments")
      .update({ destination: "business" }).eq("id", unPaiement.id)
    verifier("changer la destination est refusé", eDest ? "refusé" : "ACCEPTÉ", "refusé")

    // -----------------------------------------------------------------------
    console.log("\nLa facture se solde")
    // -----------------------------------------------------------------------
    await proprio.session.from("payments").insert({
      firm_id: cabinetA, client_id: clientA, invoice_id: factureA, amount: 200.0,
      paid_on: new Date().toISOString().slice(0, 10),
      method: "bank_transfer", destination: "business",
    })
    const { data: st3 } = await admin.rpc("invoice_status", { i_id: factureA })
    verifier("1 000 $ encaissés : la facture est payée", st3, "paid")

    // Une facture annulée le reste, quoi qu'on encaisse.
    await proprio.session.from("invoices").update({ status: "cancelled" }).eq("id", factureA)
    const { data: st4 } = await admin.rpc("invoice_status", { i_id: factureA })
    verifier("une facture annulée reste annulée", st4, "cancelled")
  } finally {
    // Le registre référence les paiements : on descend dans l'ordre inverse.
    if (clientA) await admin.from("trust_ledger").delete().eq("client_id", clientA)
    if (clientA) await admin.from("payments").delete().eq("client_id", clientA)
    for (const id of [cabinetA, cabinetB]) if (id) await admin.from("firms").delete().eq("id", id)
    for (const c of comptes) await admin.auth.admin.deleteUser(c.userId).catch(() => {})
    console.log("\nCabinets, clients et comptes d'épreuve supprimés.")
  }

  console.log(
    echecs === 0
      ? "\n✓ Paiements et fidéicommis vérifiés, 0 échec."
      : `\n✗ ${echecs} échec(s).`
  )
  process.exit(echecs === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error("\nÉchec :", e.message)
  process.exit(1)
})
