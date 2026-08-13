#!/usr/bin/env node
/**
 * Éprouve les permissions.
 *
 *   ./cric permissions
 *
 * La migration 20260808160000 remplace le moteur de can_write(), can_delete()
 * et can_bill() sans toucher aux vingt politiques RLS qui les appellent. Un
 * changement de cette nature ne se relit pas : il se frappe. Chaque cas emploie
 * donc la clé ANONYME et une vraie session — c'est la RLS qu'on interroge.
 *
 * Le premier objectif n'est pas de vérifier les nouvelles possibilités, mais
 * qu'AUCUN droit n'a changé pour les rôles existants. Une bascule de mécanisme
 * qui modifie aussi les droits rend impossible de savoir lequel des deux a
 * causé un refus.
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
  const ok = obtenu === attendu
  if (!ok) echecs++
  console.log(
    `  ${ok ? "✓" : "✗"} ${intitule.padEnd(56)} ${String(obtenu).padEnd(8)}` +
      (ok ? "" : ` ATTENDU ${attendu}`)
  )
}

async function main() {
  const env = await loadEnv()
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const commeUtilisateur = async (courriel, motDePasse) => {
    const c = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    })
    const { error } = await c.auth.signInWithPassword({ email: courriel, password: motDePasse })
    if (error) throw new Error(`Connexion ${courriel} : ${error.message}`)
    return c
  }

  const marque = Date.now()
  const motDePasse = "Epreuve-" + randomBytes(9).toString("base64url")
  const comptes = []
  let cabinetId
  let clientId

  try {
    const { data: cabinet, error: e1 } = await admin
      .from("firms")
      .insert({
        name: `Cabinet d'épreuve permissions ${marque}`,
        rcic_license_number: `R777${String(marque).slice(-4)}`,
        owner_name: "Épreuve",
        email: `perm-${marque}@example.invalid`,
        plan: "courtoisie",
        status: "active",
      })
      .select("id")
      .single()
    if (e1) throw new Error(`Cabinet : ${e1.message}`)
    cabinetId = cabinet.id

    for (const role of ["owner", "rcic", "risia", "staff", "bookkeeper", "readonly"]) {
      const courriel = `${role}-${marque}@example.invalid`
      const { data, error } = await admin.auth.admin.createUser({
        email: courriel,
        password: motDePasse,
        email_confirm: true,
      })
      if (error) throw new Error(`Compte ${role} : ${error.message}`)
      const { data: profil, error: e2 } = await admin
        .from("profiles")
        .insert({
          firm_id: cabinetId,
          user_id: data.user.id,
          email: courriel,
          full_name: `${role} d'épreuve`,
          cicc_role: role,
        })
        .select("id")
        .single()
      if (e2) throw new Error(`Profil ${role} : ${e2.message}`)
      comptes.push({ role, courriel, userId: data.user.id, profilId: profil.id, session: null })
    }

    for (const c of comptes) c.session = await commeUtilisateur(c.courriel, motDePasse)

    // Une fiche client sur laquelle éprouver l'écriture et la suppression.
    const { data: client, error: eClient } = await admin
      .from("clients")
      .insert({
        firm_id: cabinetId,
        name: "Client d'épreuve",
        file_number: `EP-${marque}`,
        program: "Épreuve",
        email: `client-${marque}@example.invalid`,
      })
      .select("id")
      .single()
    if (eClient) throw new Error(`Client d'épreuve : ${eClient.message}`)
    clientId = client.id

    const peut = async (session, permission) => {
      const { data } = await session.rpc("member_can", { permission_key: permission })
      return Boolean(data)
    }

    // ---------------------------------------------------------------------
    console.log("\nLes droits historiques sont-ils inchangés ?")
    // can_write : owner, rcic, risia, staff — et personne d'autre.
    for (const c of comptes) {
      const attendu = ["owner", "rcic", "risia", "staff"].includes(c.role)
      verifier(`${c.role} — records.write`, await peut(c.session, "records.write"), attendu)
    }
    // can_delete : owner, rcic.
    for (const c of comptes) {
      const attendu = ["owner", "rcic"].includes(c.role)
      verifier(`${c.role} — records.delete`, await peut(c.session, "records.delete"), attendu)
    }
    // can_bill : owner, rcic, bookkeeper.
    for (const c of comptes) {
      const attendu = ["owner", "rcic", "bookkeeper"].includes(c.role)
      verifier(`${c.role} — invoices.write`, await peut(c.session, "invoices.write"), attendu)
    }

    // ---------------------------------------------------------------------
    console.log("\nLa RLS suit-elle réellement ? (écriture d'une fiche client)")
    for (const c of comptes) {
      const attendu = ["owner", "rcic", "risia", "staff"].includes(c.role)
      const { error } = await c.session
        .from("clients")
        .update({ province: c.role })
        .eq("id", clientId)
      // Une politique RLS ne renvoie pas d'erreur sur un UPDATE refusé : elle
      // ne trouve simplement aucune ligne. On relit donc pour savoir.
      const { data: apres } = await admin.from("clients").select("province").eq("id", clientId).single()
      const passe = !error && apres.province === c.role
      verifier(`${c.role} — modifie la fiche`, passe, attendu)
    }

    // ---------------------------------------------------------------------
    console.log("\nCe que personne d'autre que le propriétaire ne peut faire")
    for (const c of comptes) {
      const attendu = c.role === "owner"
      verifier(`${c.role} — firm.billing`, await peut(c.session, "firm.billing"), attendu)
      verifier(`${c.role} — firm.members`, await peut(c.session, "firm.members"), attendu)
    }

    // ---------------------------------------------------------------------
    console.log("\nAjustement individuel : la facturation confiée à l'adjointe")
    const adjointe = comptes.find((c) => c.role === "staff")
    const proprio = comptes.find((c) => c.role === "owner")

    const { error: eOctroi } = await proprio.session.from("profile_permissions").insert({
      profile_id: adjointe.profilId,
      permission: "invoices.write",
      granted: true,
      granted_by: proprio.userId,
    })
    verifier("le propriétaire pose l'ajustement", eOctroi ? eOctroi.message : "ok", "ok")
    verifier("l'adjointe facture désormais", await peut(adjointe.session, "invoices.write"), true)
    // L'ajustement est chirurgical : il n'entraîne rien d'autre.
    verifier("mais ne supprime toujours pas", await peut(adjointe.session, "records.delete"), false)

    console.log("\nRetrait ciblé sans rétrogradation")
    const consultant = comptes.find((c) => c.role === "rcic")
    await proprio.session.from("profile_permissions").insert({
      profile_id: consultant.profilId,
      permission: "records.delete",
      granted: false,
      granted_by: proprio.userId,
    })
    verifier("le consultant ne supprime plus", await peut(consultant.session, "records.delete"), false)
    verifier("mais écrit toujours", await peut(consultant.session, "records.write"), true)

    // ---------------------------------------------------------------------
    console.log("\nCe qui ne se délègue pas")
    // Une permission réservée reste au propriétaire quoi qu'on écrive : sans
    // ce refus, le premier ajustement venu ouvrirait l'abonnement du cabinet.
    await admin.from("profile_permissions").insert({
      profile_id: adjointe.profilId,
      permission: "firm.billing",
      granted: true,
    })
    verifier("firm.billing accordée de force à l'adjointe", await peut(adjointe.session, "firm.billing"), false)

    console.log("\nCe qu'un membre ne peut pas s'accorder à lui-même")
    const { error: eSoi } = await consultant.session.from("profile_permissions").insert({
      profile_id: consultant.profilId,
      permission: "firm.members",
      granted: true,
    })
    verifier("s'ajouter une permission", eSoi ? "refusé" : "ACCEPTÉ", "refusé")

    const { error: eAutrui } = await consultant.session.from("profile_permissions").insert({
      profile_id: adjointe.profilId,
      permission: "records.delete",
      granted: true,
    })
    verifier("en accorder une à un collègue", eAutrui ? "refusé" : "ACCEPTÉ", "refusé")

    console.log("\nUn membre suspendu ne porte plus rien")
    await admin.from("profiles").update({ status: "suspended" }).eq("id", consultant.profilId)
    verifier("records.write d'un suspendu", await peut(consultant.session, "records.write"), false)
    verifier("le propriétaire n'est pas affecté", await peut(proprio.session, "records.write"), true)
  } finally {
    if (clientId) await admin.from("clients").delete().eq("id", clientId)
    if (cabinetId) await admin.rpc("purger_cabinet_epreuve", { p_firm_id: cabinetId })
    for (const c of comptes) await admin.auth.admin.deleteUser(c.userId).catch(() => {})
    console.log("\nCabinet et comptes d'épreuve supprimés.")
  }

  console.log(echecs === 0 ? "\n✓ Permissions vérifiées, 0 échec." : `\n✗ ${echecs} échec(s).`)
  process.exit(echecs === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error("Échec :", e.message)
  process.exit(1)
})
