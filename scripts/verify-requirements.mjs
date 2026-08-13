#!/usr/bin/env node
/**
 * Éprouve les pièces exigées d'un dossier.
 *
 *   ./cric documents
 *
 * Ce qui est vérifié : « reçu » n'est pas « vérifié », et un dossier dont une
 * pièce obligatoire manque ne peut pas être déclaré prêt — quoi qu'en dise
 * l'interface, puisque le refus vient de la base.
 *
 * Un contrôle porte sur une DUPLICATION assumée : la correspondance
 * programme → liste de pièces existe en TypeScript et en SQL. Elle est
 * comparée ici sur une série de noms de programmes réels. Une duplication
 * contrôlée vaut mieux qu'une dépendance qui n'existe pas.
 */

import { readFile } from "node:fs/promises"
import { randomBytes } from "node:crypto"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"
import { runSql } from "./apply-migration.mjs"

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

/**
 * La correspondance TypeScript, relue depuis le fichier source.
 *
 * Le module ne s'importe pas tel quel — il tire un type de ./types sans
 * `import type`, ce que le dépouillement de types de Node refuse. On rejoue
 * donc la règle, telle qu'elle est écrite dans generateChecklistForProgram().
 */
function modeleTypeScript(nom) {
  const n = nom.toLowerCase()
  if (n.includes("super")) return "prog-super-visa"
  if (n.includes("visa") || n.includes("visiteur") || n.includes("trv")) return "prog-tr-visa"
  if (n.includes("ee") || n.includes("express")) return "prog-ee"
  if (n.includes("peq") || n.includes("québec") || n.includes("quebec")) return "prog-peq"
  if (n.includes("lmia") || n.includes("eimt") || n.includes("travail") || n.includes("work")) return "prog-lmia"
  if (n.includes("étude") || n.includes("study") || n.includes("caq")) return "prog-study"
  if (n.includes("parrainage") || n.includes("sponsorship") || n.includes("spousal")) return "prog-sponsorship"
  return "prog-ee"
}

let echecs = 0
function verifier(intitule, obtenu, attendu) {
  const ok = String(obtenu) === String(attendu)
  if (!ok) echecs++
  console.log(
    `  ${ok ? "✓" : "✗"} ${intitule.padEnd(52)} ${String(obtenu).padEnd(14)}` +
      (ok ? "" : ` ATTENDU ${attendu}`)
  )
}

async function main() {
  const env = await loadEnv()
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

  const commeUtilisateur = async (courriel, mdp) => {
    const c = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
    const { error } = await c.auth.signInWithPassword({ email: courriel, password: mdp })
    if (error) throw new Error(`Connexion ${courriel} : ${error.message}`)
    return c
  }

  const marque = Date.now()
  const mdp = "Epreuve-" + randomBytes(9).toString("base64url")
  const comptes = []
  let cabinetA, cabinetB, clientA, dossier

  try {
    // -----------------------------------------------------------------------
    console.log("Les deux appariements programme → pièces concordent")
    // -----------------------------------------------------------------------
    const noms = [
      "Résidence Permanente (EE)", "Express Entry", "PEQ", "Résidence Permanente (PEQ)",
      "Visa de Visiteur (TRV)", "Super Visa", "Permis de travail (EIMT)", "Work permit",
      "Permis d'études (CAQ)", "Parrainage conjoint", "Spousal sponsorship",
      "Programme inconnu", "",
    ]
    let ecarts = 0
    for (const nom of noms) {
      const [{ programme_modele: sql }] = await runSql(
        `select public.programme_modele('${nom.replace(/'/g, "''")}') as programme_modele;`
      )
      const ts = modeleTypeScript(nom)
      if (sql !== ts) {
        ecarts++
        console.log(`     ✗ « ${nom} » — SQL: ${sql} · TS: ${ts}`)
      }
    }
    verifier(`${noms.length} noms de programmes comparés`, ecarts, 0)

    // -----------------------------------------------------------------------
    // Le décor
    // -----------------------------------------------------------------------
    const creerCabinet = async (chiffre) => {
      const { data, error } = await admin.from("firms").insert({
        name: `Cabinet pièces ${chiffre} ${marque}`,
        rcic_license_number: `R8${chiffre}${String(marque).slice(-4)}`,
        owner_name: "Épreuve", email: `pieces-${chiffre}-${marque}@example.invalid`,
        plan: "cabinet", status: "active",
      }).select("id").single()
      if (error) throw new Error(`Cabinet : ${error.message}`)
      await admin.from("firm_subscriptions").insert({
        firm_id: data.id, plan: "cabinet", cadence: "monthly", seats: 3,
        status: "active", stripe_customer_id: `cus_pieces_${chiffre}_${marque}`,
      })
      return data.id
    }
    cabinetA = await creerCabinet(1)
    cabinetB = await creerCabinet(2)

    const creerMembre = async (nom, firmId, role) => {
      const courriel = `${nom}-${marque}@example.invalid`
      const { data, error } = await admin.auth.admin.createUser({
        email: courriel, password: mdp, email_confirm: true,
      })
      if (error) throw new Error(`Compte ${nom} : ${error.message}`)
      await admin.from("profiles").insert({
        firm_id: firmId, user_id: data.user.id, email: courriel,
        full_name: `${nom} d'épreuve`, cicc_role: role,
      })
      const c = { nom, userId: data.user.id, session: await commeUtilisateur(courriel, mdp) }
      comptes.push(c)
      return c
    }
    const consultant = await creerMembre("consultant", cabinetA, "rcic")
    const intrus = await creerMembre("intrus", cabinetB, "owner")

    const { data: cl } = await admin.from("clients").insert({
      firm_id: cabinetA, name: "Tremblay", email: `tremblay-${marque}@example.invalid`,
      file_number: `DOS-${String(marque).slice(-6)}`, program: "Express Entry",
      status: "active", client_type: "individual",
    }).select("id").single()
    clientA = cl.id

    // -----------------------------------------------------------------------
    console.log("\nUn dossier neuf reçoit ses exigences")
    // -----------------------------------------------------------------------
    const { data: m, error: em } = await admin.from("matters").insert({
      firm_id: cabinetA, client_id: clientA, reference: `M-${marque}`,
      client_name: "Tremblay", program: "Résidence Permanente (EE)", category: "pr",
      rcic: "Épreuve", status: "pending", client_type: "b2c",
    }).select("id").single()
    if (em) throw new Error(`Dossier : ${em.message}`)
    dossier = m.id

    const exigences = async () => {
      const { data } = await admin.rpc("matter_requirements_view", { m_id: dossier })
      return data ?? []
    }
    const liste = await exigences()
    verifier("les pièces du programme sont posées", liste.length, 7)
    verifier("toutes commencent à « manquant »", liste.every((r) => r.status === "missing"), true)

    const bloquantes = async () => {
      const { data } = await admin.rpc("matter_blocking_requirements", { m_id: dossier })
      return data ?? []
    }
    verifier("les 7 bloquent la validation", (await bloquantes()).length, 7)

    // -----------------------------------------------------------------------
    console.log("\nRéception et vérification sont deux faits distincts")
    // -----------------------------------------------------------------------
    const majPiece = async (code, champs) =>
      consultant.session.from("matter_requirements").update(champs)
        .eq("matter_id", dossier).eq("code", code)

    const maintenant = new Date().toISOString()
    await majPiece("PASSPORT", { received_at: maintenant, received_from: "client" })

    const passeport = (await exigences()).find((r) => r.code === "PASSPORT")
    verifier("reçu, mais pas encore vérifié", passeport.status, "received")
    verifier("l'origine du dépôt est conservée", passeport.received_from, "client")
    verifier("il bloque toujours la validation", (await bloquantes()).some((b) => b.code === "PASSPORT"), true)

    await majPiece("PASSPORT", { verified_at: maintenant })
    verifier("vérifié : il ne bloque plus", (await bloquantes()).some((b) => b.code === "PASSPORT"), false)

    // -----------------------------------------------------------------------
    console.log("\nScénario 4 du brief — un dossier incomplet est refusé")
    // -----------------------------------------------------------------------
    // On vérifie tout sauf deux pièces, comme dans l'énoncé.
    const codes = liste.map((r) => r.code)
    for (const code of codes.slice(1, codes.length - 2)) {
      await majPiece(code, { received_at: maintenant, received_from: "firm", verified_at: maintenant })
    }
    // L'avant-dernière est reçue mais NON vérifiée — le cas que le brief cite.
    await majPiece(codes[codes.length - 2], { received_at: maintenant, received_from: "client" })

    const reste = await bloquantes()
    verifier("2 pièces bloquent encore", reste.length, 2)
    verifier("l'une est reçue mais non vérifiée", reste.some((b) => b.status === "received"), true)
    verifier("l'autre est manquante", reste.some((b) => b.status === "missing"), true)

    const { error: eComplet } = await consultant.session.from("matters")
      .update({ status: "complete" }).eq("id", dossier)
    verifier("marquer « complet » est REFUSÉ", eComplet ? "refusé" : "ACCEPTÉ", "refusé")
    verifier("le refus nomme le nombre", /2 document\(s\)/.test(eComplet?.message ?? ""), true)

    const { data: apres } = await admin.from("matters").select("status").eq("id", dossier).single()
    verifier("le dossier est resté en l'état", apres.status, "pending")

    // On complète les deux dernières.
    await majPiece(codes[codes.length - 2], { verified_at: maintenant })
    await majPiece(codes[codes.length - 1], {
      received_at: maintenant, received_from: "firm", verified_at: maintenant,
    })
    verifier("plus aucune pièce bloquante", (await bloquantes()).length, 0)

    const { error: eOk } = await consultant.session.from("matters")
      .update({ status: "complete" }).eq("id", dossier)
    verifier("le dossier peut enfin être déclaré complet", eOk ? eOk.message : "ok", "ok")

    // -----------------------------------------------------------------------
    console.log("\nUne pièce expirée cesse d'être valide, sans qu'on y touche")
    // -----------------------------------------------------------------------
    await majPiece("PASSPORT", { expires_on: "2020-01-01" })
    const perime = (await exigences()).find((r) => r.code === "PASSPORT")
    verifier("le statut bascule à « expiré »", perime.status, "expired")
    verifier("et la pièce redevient bloquante", (await bloquantes()).some((b) => b.code === "PASSPORT"), true)

    // -----------------------------------------------------------------------
    console.log("\nUne pièce refusée retourne au client")
    // -----------------------------------------------------------------------
    await majPiece("PASSPORT", {
      expires_on: null, rejected_at: new Date(Date.now() + 1000).toISOString(),
      rejection_reason: "Page de la photo illisible",
    })
    const refuse = (await exigences()).find((r) => r.code === "PASSPORT")
    verifier("le statut devient « à corriger »", refuse.status, "to_correct")
    verifier("le motif est conservé", refuse.rejection_reason, "Page de la photo illisible")

    // -----------------------------------------------------------------------
    console.log("\nCloisonnement")
    // -----------------------------------------------------------------------
    const { data: vues } = await intrus.session.from("matter_requirements").select("id")
    verifier("un autre cabinet ne voit aucune exigence", vues?.length ?? 0, 0)

    // Une politique RLS d'UPDATE ne lève pas : elle ne trouve simplement
    // aucune ligne à modifier. Comparer l'erreur à elle-même passerait
    // toujours — c'est l'ÉTAT DE LA DONNÉE qu'il faut regarder.
    const avant = (await exigences()).find((r) => r.code === "PASSPORT").status
    await intrus.session.from("matter_requirements")
      .update({ verified_at: maintenant, rejected_at: null }).eq("matter_id", dossier)
    const apresIntrusion = (await exigences()).find((r) => r.code === "PASSPORT").status
    verifier("ni n'a pu en modifier une", apresIntrusion, avant)
  } finally {
    for (const id of [cabinetA, cabinetB]) if (id) await admin.rpc("purger_cabinet_epreuve", { p_firm_id: id })
    for (const c of comptes) await admin.auth.admin.deleteUser(c.userId).catch(() => {})
    console.log("\nCabinets, dossiers et comptes d'épreuve supprimés.")
  }

  console.log(
    echecs === 0 ? "\n✓ Pièces exigées vérifiées, 0 échec." : `\n✗ ${echecs} échec(s).`
  )
  process.exit(echecs === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error("\nÉchec :", e.message)
  process.exit(1)
})
