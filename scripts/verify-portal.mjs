#!/usr/bin/env node
/**
 * Éprouve le portail client : dépôt de pièces et validation.
 *
 *   ./cric portail-client
 *
 * C'est la première fois qu'une personne EXTÉRIEURE au cabinet écrit dans
 * cette base. Les contrôles portent donc moins sur ce que le client peut faire
 * que sur ce qu'il ne peut PAS faire, y compris en envoyant exprès de
 * mauvaises valeurs.
 *
 * Deux clients de deux cabinets différents sont montés : le cloisonnement ne
 * se prouve qu'en essayant de le franchir.
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
    `  ${ok ? "✓" : "✗"} ${intitule.padEnd(52)} ${String(obtenu).padEnd(16)}` +
      (ok ? "" : ` ATTENDU ${attendu}`)
  )
}

async function main() {
  const env = await loadEnv()
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

  const session = async (courriel, mdp) => {
    const c = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
    const { error } = await c.auth.signInWithPassword({ email: courriel, password: mdp })
    if (error) throw new Error(`Connexion ${courriel} : ${error.message}`)
    return c
  }

  const marque = Date.now()
  const mdp = "Epreuve-" + randomBytes(9).toString("base64url")
  const users = []
  let cabA, cabB, cliA, cliB, dossierA, dossierB, exigenceA

  try {
    const creerCabinet = async (n) => {
      const { data, error } = await admin.from("firms").insert({
        name: `Cabinet portail ${n} ${marque}`,
        rcic_license_number: `R6${n}${String(marque).slice(-4)}`,
        owner_name: "Épreuve", email: `pc-${n}-${marque}@example.invalid`,
        plan: "cabinet", status: "active",
      }).select("id").single()
      if (error) throw new Error(`Cabinet : ${error.message}`)
      await admin.from("firm_subscriptions").insert({
        firm_id: data.id, plan: "cabinet", cadence: "monthly", seats: 3,
        status: "active", stripe_customer_id: `cus_pc_${n}_${marque}`,
      })
      return data.id
    }
    cabA = await creerCabinet(1)
    cabB = await creerCabinet(2)

    const creerConsultant = async (nom, firmId) => {
      const courriel = `${nom}-${marque}@example.invalid`
      const { data } = await admin.auth.admin.createUser({
        email: courriel, password: mdp, email_confirm: true,
      })
      const { data: p } = await admin.from("profiles").insert({
        firm_id: firmId, user_id: data.user.id, email: courriel,
        full_name: `${nom} d'épreuve`, cicc_role: "rcic",
      }).select("id").single()
      users.push(data.user.id)
      return { userId: data.user.id, profileId: p.id, s: await session(courriel, mdp) }
    }

    const creerClientPortail = async (nom, firmId) => {
      const courriel = `${nom}-${marque}@example.invalid`
      const { data: cl } = await admin.from("clients").insert({
        firm_id: firmId, name: nom, email: courriel,
        file_number: `DOS-${String(marque).slice(-6)}-${nom.slice(0, 2)}`,
        program: "Express Entry", status: "active", client_type: "individual",
      }).select("id").single()
      const { data: u } = await admin.auth.admin.createUser({
        email: courriel, password: mdp, email_confirm: true,
      })
      await admin.from("client_users").insert({
        user_id: u.user.id, client_id: cl.id, firm_id: firmId, email: courriel,
      })
      const { data: m } = await admin.from("matters").insert({
        firm_id: firmId, client_id: cl.id, reference: `M-${marque}-${nom.slice(0, 2)}`,
        client_name: nom, program: "Express Entry", category: "pr",
        rcic: "Épreuve", status: "pending", client_type: "b2c",
      }).select("id").single()
      users.push(u.user.id)
      return { clientId: cl.id, matterId: m.id, s: await session(courriel, mdp) }
    }

    const consultant = await creerConsultant("consultant", cabA)
    const clientA = await creerClientPortail("Tremblay", cabA)
    const clientB = await creerClientPortail("Autre", cabB)
    cliA = clientA.clientId; cliB = clientB.clientId
    dossierA = clientA.matterId; dossierB = clientB.matterId

    const { data: exig } = await admin.from("matter_requirements")
      .select("id, code").eq("matter_id", dossierA).eq("code", "PASSPORT").single()
    exigenceA = exig.id
    // Une pièce exigée appartenant à l'AUTRE client : c'est elle que le
    // dépôt tentera d'usurper. Le premier jet passait celle du client
    // lui-même — le contrôle échouait parce qu'il était faux, pas le système.
    const { data: exigB } = await admin.from("matter_requirements")
      .select("id").eq("matter_id", dossierB).eq("code", "PASSPORT").single()
    const exigenceAutrui = exigB.id

    // -----------------------------------------------------------------------
    console.log("Scénario 6 du brief — le client téléverse son passeport")
    // -----------------------------------------------------------------------
    const { data: depose, error: eDep } = await clientA.s.from("documents").insert({
      // Le client envoie exprès des valeurs qu'il ne devrait pas choisir.
      firm_id: cabB, client_id: cliB, matter_id: dossierB,
      requirement_id: exigenceAutrui,
      name: "Passeport.pdf", type: "Passeport",
      category: "consultant_upload", status: "valid",
      uploaded_by: "Le consultant lui-même", source: "interne",
    }).select("id, firm_id, client_id, category, status, uploaded_by, source, matter_id, requirement_id").single()

    verifier("le dépôt est accepté", eDep ? eDep.message : "ok", "ok")
    verifier("le cabinet est celui du client, pas celui envoyé", depose?.firm_id, cabA)
    verifier("le client est celui de la session", depose?.client_id, cliA)
    verifier("la catégorie est forcée", depose?.category, "client_upload")
    verifier("le statut est « à vérifier »", depose?.status, "pending_review")
    verifier("le déposant est le client, pas ce qu'il prétend", depose?.uploaded_by, "Tremblay")
    verifier("la provenance est le portail", depose?.source, "portail client")
    verifier("le dossier emprunté est effacé", depose?.matter_id, null)
    verifier("la pièce exigée d'un AUTRE CLIENT est effacée", depose?.requirement_id, null)

    // Un dépôt correct, cette fois, rattaché à sa propre pièce exigée.
    const { data: bon } = await clientA.s.from("documents").insert({
      name: "Passeport-correct.pdf", type: "Passeport",
      matter_id: dossierA, requirement_id: exigenceA,
      client_id: cliA, firm_id: cabA, category: "client_upload",
    }).select("id").single()

    const exigence = async () => {
      const { data } = await admin.rpc("matter_requirements_view", { m_id: dossierA })
      return data.find((r) => r.code === "PASSPORT")
    }
    const apres = await exigence()
    verifier("la pièce exigée passe à « reçue »", apres.status, "received")
    verifier("l'origine est bien « client »", apres.received_from, "client")
    verifier("elle n'est PAS vérifiée pour autant", apres.verified_at, null)

    // -----------------------------------------------------------------------
    console.log("\nLe consultant voit le dépôt immédiatement")
    // -----------------------------------------------------------------------
    const { data: vusParCabinet } = await consultant.s.from("documents")
      .select("id, status, uploaded_by").eq("client_id", cliA)
    verifier("les deux pièces sont au dossier", vusParCabinet?.length, 2)
    verifier("elles attendent d'être vérifiées",
      vusParCabinet?.every((d) => d.status === "pending_review"), true)

    // -----------------------------------------------------------------------
    console.log("\nRemplacer une pièce déjà vérifiée annule sa vérification")
    // -----------------------------------------------------------------------
    await consultant.s.from("matter_requirements")
      .update({ verified_at: new Date().toISOString(), verified_by: consultant.profileId })
      .eq("id", exigenceA)
    verifier("le consultant a vérifié la pièce", (await exigence()).status, "verified")

    await clientA.s.from("documents").insert({
      name: "Passeport-v2.pdf", type: "Passeport",
      matter_id: dossierA, requirement_id: exigenceA, client_id: cliA, firm_id: cabA,
      category: "client_upload",
    })
    const remplacee = await exigence()
    verifier("un nouveau dépôt remet la vérification à zéro", remplacee.verified_at, null)
    verifier("et la pièce redevient « reçue »", remplacee.status, "received")

    // -----------------------------------------------------------------------
    console.log("\nScénario 7 du brief — demander la validation au client")
    // -----------------------------------------------------------------------
    const { data: demande, error: eDem } = await consultant.s.from("document_reviews").insert({
      firm_id: cabA, client_id: cliA, document_id: bon.id, matter_id: dossierA,
      kind: "validation", message: "Merci de confirmer que les informations sont exactes.",
    }).select("id, status").single()
    verifier("la demande se crée", eDem ? eDem.message : "ok", "ok")
    verifier("elle est en attente", demande?.status, "pending")

    const { data: vueClient } = await clientA.s.from("document_reviews").select("id, message, status")
    verifier("le client la voit", vueClient?.length, 1)
    verifier("avec le message du consultant",
      vueClient?.[0]?.message, "Merci de confirmer que les informations sont exactes.")

    // Il tente d'abord de réécrire ce qui ne lui appartient pas.
    const { error: eTriche } = await clientA.s.from("document_reviews")
      .update({ status: "confirmed", kind: "signature" }).eq("id", demande.id)
    verifier("il ne peut pas changer la nature de la demande", eTriche ? "refusé" : "ACCEPTÉ", "refusé")

    // Puis de signaler une erreur sans dire laquelle.
    const { error: eMuet } = await clientA.s.from("document_reviews")
      .update({ status: "error_reported" }).eq("id", demande.id)
    verifier("un signalement sans commentaire est refusé", eMuet ? "refusé" : "ACCEPTÉ", "refusé")

    // Enfin, il répond correctement.
    const { error: eRep } = await clientA.s.from("document_reviews")
      .update({ status: "confirmed" }).eq("id", demande.id)
    verifier("il confirme", eRep ? eRep.message : "ok", "ok")

    const { data: repondue } = await admin.from("document_reviews")
      .select("status, responded_at").eq("id", demande.id).single()
    verifier("la date de réponse est posée d'office", repondue.responded_at !== null, true)

    const { error: eDeuxFois } = await clientA.s.from("document_reviews")
      .update({ status: "error_reported", client_comment: "finalement non" }).eq("id", demande.id)
    verifier("il ne peut pas répondre deux fois", eDeuxFois ? "refusé" : "ACCEPTÉ", "refusé")

    // Une confirmation du client ne vaut pas vérification par le cabinet.
    verifier("confirmer ne vaut PAS vérifier", (await exigence()).verified_at, null)

    // -----------------------------------------------------------------------
    console.log("\nUn signalement d'erreur renvoie la pièce à corriger")
    // -----------------------------------------------------------------------
    const { data: d2 } = await admin.from("documents")
      .select("id").eq("requirement_id", exigenceA).order("created_at", { ascending: false }).limit(1).single()
    const { data: dem2 } = await consultant.s.from("document_reviews").insert({
      firm_id: cabA, client_id: cliA, document_id: d2.id, matter_id: dossierA,
    }).select("id").single()

    await clientA.s.from("document_reviews")
      .update({ status: "error_reported", client_comment: "Ce n'est pas mon nom de famille." })
      .eq("id", dem2.id)

    const corrigee = await exigence()
    verifier("la pièce passe à « à corriger »", corrigee.status, "to_correct")
    verifier("le motif du client est repris", corrigee.rejection_reason, "Ce n'est pas mon nom de famille.")

    // -----------------------------------------------------------------------
    console.log("\nCe qu'un client ne peut jamais faire")
    // -----------------------------------------------------------------------
    const { data: autres } = await clientB.s.from("documents").select("id")
    verifier("le client B ne voit rien du client A", autres?.length ?? 0, 0)

    const { data: revuesB } = await clientB.s.from("document_reviews").select("id")
    verifier("ni aucune de ses demandes", revuesB?.length ?? 0, 0)

    const { error: eVerif } = await clientA.s.from("matter_requirements")
      .update({ verified_at: new Date().toISOString() }).eq("id", exigenceA)
    verifier("un client ne peut pas se vérifier lui-même",
      (await exigence()).verified_at, null)

    const { data: notesInternes } = await clientA.s.from("payments").select("id")
    verifier("ni voir la comptabilité du cabinet", notesInternes?.length ?? 0, 0)

    const { data: parLaVue } = await clientA.s.from("portal_requirements").select("code, status")
    verifier("il voit ses pièces attendues par la vue", parLaVue?.length > 0, true)
    verifier("la vue ne porte aucune note interne",
      Object.keys(parLaVue?.[0] ?? {}).some((k) => k === "notes" || k === "verified_by"), false)
  } finally {
    for (const id of [cabA, cabB]) if (id) await admin.from("firms").delete().eq("id", id)
    for (const u of users) await admin.auth.admin.deleteUser(u).catch(() => {})
    console.log("\nCabinets, clients et comptes d'épreuve supprimés.")
  }

  console.log(echecs === 0 ? "\n✓ Portail client vérifié, 0 échec." : `\n✗ ${echecs} échec(s).`)
  process.exit(echecs === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error("\nÉchec :", e.message)
  process.exit(1)
})
