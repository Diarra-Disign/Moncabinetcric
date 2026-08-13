#!/usr/bin/env node
/**
 * Éprouve les demandes de places.
 *
 *   ./cric sieges
 *
 * Le cas qui compte n'est pas « la demande s'enregistre-t-elle » — c'est
 * « un cabinet peut-il s'accorder des places tout seul ». La séparation est
 * portée par la RLS : insertion contrainte à status='pending' et
 * granted_seats=0, aucune politique d'UPDATE ouverte au cabinet. Ces règles se
 * lisent bien mais ne se vérifient qu'en essayant, avec une vraie session.
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
    `  ${ok ? "✓" : "✗"} ${intitule.padEnd(52)} ${String(obtenu).padEnd(10)}` +
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
  let cabinetId
  let demandeId

  try {
    // Un cabinet SOLO : une place, donc saturé dès son propriétaire.
    const { data: cabinet, error: e1 } = await admin
      .from("firms")
      .insert({
        name: `Cabinet d'épreuve places ${marque}`,
        rcic_license_number: `R666${String(marque).slice(-4)}`,
        owner_name: "Épreuve",
        email: `places-${marque}@example.invalid`,
        plan: "solo",
        status: "active",
      })
      .select("id")
      .single()
    if (e1) throw new Error(`Cabinet : ${e1.message}`)
    cabinetId = cabinet.id

    // Un abonnement solo actif, sinon firm_access_open() referme tout.
    await admin.from("firm_subscriptions").insert({
      firm_id: cabinetId,
      plan: "solo",
      cadence: "monthly",
      seats: 1,
      status: "active",
      stripe_customer_id: `cus_places_${marque}`,
    })

    const creerCompte = async (nom, role, estAdminPlateforme = false) => {
      const courriel = `${nom}-${marque}@example.invalid`
      const { data, error } = await admin.auth.admin.createUser({
        email: courriel,
        password: mdp,
        email_confirm: true,
      })
      if (error) throw new Error(`Compte ${nom} : ${error.message}`)
      if (estAdminPlateforme) {
        await admin.from("platform_admins").insert({
          user_id: data.user.id,
          email: courriel,
          full_name: "Exploitant d'épreuve",
        })
      } else {
        const { error: e2 } = await admin.from("profiles").insert({
          firm_id: cabinetId,
          user_id: data.user.id,
          email: courriel,
          full_name: `${nom} d'épreuve`,
          cicc_role: role,
        })
        if (e2) throw new Error(`Profil ${nom} : ${e2.message}`)
      }
      const c = { nom, courriel, userId: data.user.id, session: await commeUtilisateur(courriel, mdp) }
      comptes.push(c)
      return c
    }

    const proprio = await creerCompte("proprio", "owner")
    const exploitant = await creerCompte("exploitant", null, true)

    const places = async () => {
      const { data: occ } = await admin.rpc("firm_seats_taken", { f_id: cabinetId })
      const { data: lim } = await admin.rpc("firm_seat_limit", { f_id: cabinetId })
      return `${occ}/${lim}`
    }

    // ---------------------------------------------------------------------
    console.log("\nUn cabinet Solo saturé")
    verifier("places", await places(), "1/1")

    // Le déclencheur enforce_seat_limit refuse, quel que soit le chemin.
    const { error: eInvite } = await proprio.session.from("invitations").insert({
      firm_id: cabinetId,
      email: `refuse-${marque}@example.invalid`,
      cicc_role: "staff",
      token_hash: randomBytes(32).toString("hex"),
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    })
    verifier("inviter une deuxième personne", eInvite ? "refusé" : "ACCEPTÉ", "refusé")

    // ---------------------------------------------------------------------
    console.log("\nLa demande")
    const { error: eDemande } = await proprio.session.from("seat_requests").insert({
      firm_id: cabinetId,
      requested_by: proprio.userId,
      requester_name: "Propriétaire d'épreuve",
      seats: 2,
      justification: "Épreuve automatisée",
      status: "pending",
      granted_seats: 0,
    })
    verifier("le propriétaire dépose une demande", eDemande ? eDemande.message : "ok", "ok")

    // Une seule demande vivante à la fois : l'index partiel l'impose.
    const { error: eDouble } = await proprio.session.from("seat_requests").insert({
      firm_id: cabinetId,
      seats: 1,
      status: "pending",
      granted_seats: 0,
    })
    verifier("une deuxième demande en attente", eDouble ? "refusé" : "ACCEPTÉ", "refusé")

    const { data: d } = await admin
      .from("seat_requests")
      .select("id")
      .eq("firm_id", cabinetId)
      .single()
    demandeId = d.id

    // ---------------------------------------------------------------------
    console.log("\nCe qu'un cabinet ne peut pas faire")
    // S'accorder les places soi-même est la seule chose qui compte vraiment ici.
    await proprio.session
      .from("seat_requests")
      .update({ status: "approved", granted_seats: 5 })
      .eq("id", demandeId)
    const { data: apresTentative } = await admin
      .from("seat_requests")
      .select("status, granted_seats")
      .eq("id", demandeId)
      .single()
    verifier("s'accorder les places", apresTentative.status, "pending")
    verifier("écrire granted_seats", apresTentative.granted_seats, 0)

    // Se donner des places directement sur firms est fermé de longue date :
    // firms_owner_update n'ouvre que le cabinet courant, et extra_seats n'y
    // échappe pas.
    const { error: eSieges } = await proprio.session
      .from("firms")
      .update({ extra_seats: 9 })
      .eq("id", cabinetId)
    verifier("le refus est explicite", eSieges ? "refusé" : "ACCEPTÉ", "refusé")

    // Le propriétaire garde en revanche la main sur l'identité de son cabinet.
    const { error: eTel } = await proprio.session
      .from("firms")
      .update({ phone: "555-0100" })
      .eq("id", cabinetId)
    verifier("mais corrige toujours son téléphone", eTel ? eTel.message : "ok", "ok")

    const { data: cab } = await admin
      .from("firms")
      .select("extra_seats")
      .eq("id", cabinetId)
      .single()
    verifier("s'ajouter des places directement", cab.extra_seats, 0)

    // ---------------------------------------------------------------------
    console.log("\nL'exploitant accorde")
    const { error: eRep } = await exploitant.session
      .from("seat_requests")
      .update({
        status: "approved",
        granted_seats: 2,
        handled_by: exploitant.userId,
        handled_at: new Date().toISOString(),
      })
      .eq("id", demandeId)
    verifier("l'exploitant répond", eRep ? eRep.message : "ok", "ok")

    await exploitant.session.from("firms").update({ extra_seats: 2 }).eq("id", cabinetId)
    verifier("le plafond monte", await places(), "1/3")

    // ---------------------------------------------------------------------
    console.log("\nLe cabinet peut enfin inviter")
    const { error: eInvite2 } = await proprio.session.from("invitations").insert({
      firm_id: cabinetId,
      email: `accepte-${marque}@example.invalid`,
      cicc_role: "staff",
      token_hash: randomBytes(32).toString("hex"),
      expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    })
    verifier("inviter après octroi", eInvite2 ? eInvite2.message : "ok", "ok")
    // L'invitation en attente occupe une place : le refus doit arriver au
    // moment de l'invitation, pas au moment le plus désagréable — à
    // l'acceptation.
    verifier("l'invitation occupe une place", await places(), "2/3")
  } finally {
    if (cabinetId) await admin.rpc("purger_cabinet_epreuve", { p_firm_id: cabinetId })
    for (const c of comptes) {
      await admin.from("platform_admins").delete().eq("user_id", c.userId)
      await admin.auth.admin.deleteUser(c.userId).catch(() => {})
    }
    console.log("\nCabinet et comptes d'épreuve supprimés.")
  }

  console.log(echecs === 0 ? "\n✓ Demandes de places vérifiées, 0 échec." : `\n✗ ${echecs} échec(s).`)
  process.exit(echecs === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error("Échec :", e.message)
  process.exit(1)
})
