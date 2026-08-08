#!/usr/bin/env node
/**
 * Éprouve le cloisonnement du connecteur d'intelligence artificielle.
 *
 *   ./cric connecteur          (serveur de développement démarré)
 *
 * Crée deux cabinets jetables avec une clé chacun, tente de franchir la
 * cloison par tous les chemins connus, puis les supprime. Chaque cas
 * attendu est comparé au résultat obtenu : le script échoue si l'un d'eux
 * diverge, y compris — surtout — si un refus devient une acceptation.
 *
 * Il existe parce que la version précédente du connecteur n'authentifiait
 * personne : la clé était lue, tronquée, et servait uniquement à écrire
 * dans un journal. Une régression de cette nature ne se voit pas à la
 * lecture du code, seulement en frappant à la porte.
 */

import { readFile } from "node:fs/promises"
import { randomBytes, createHash } from "node:crypto"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const BASE = process.env.APP_URL || "http://localhost:3000"
const API = `${BASE}/api/v1/connector/agreements`

async function loadEnv() {
  const raw = await readFile(join(ROOT, ".env.local"), "utf8")
  const env = {}
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }
  return env
}

let echecs = 0

async function appel(cle, url = API, methode = "GET") {
  const r = await fetch(url, {
    method: methode,
    headers: {
      ...(cle ? { Authorization: `Bearer ${cle}` } : {}),
      "Content-Type": "application/json",
    },
    ...(methode === "POST" ? { body: JSON.stringify({ clientName: "Essai" }) } : {}),
  })
  const j = await r.json().catch(() => ({}))
  return { statut: r.status, code: j.error?.code ?? (j.success ? "OK" : "?") }
}

function verifier(intitule, obtenu, attenduStatut, attenduCode) {
  const ok = obtenu.statut === attenduStatut && obtenu.code === attenduCode
  if (!ok) echecs++
  console.log(
    `  ${ok ? "✓" : "✗"} ${intitule.padEnd(42)} ${obtenu.statut} ${obtenu.code}` +
      (ok ? "" : `   ATTENDU ${attenduStatut} ${attenduCode}`)
  )
}

async function main() {
  const env = await loadEnv()
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const cabinets = {}
  for (const [nom, permis] of [["A", "R7770001"], ["B", "R7770002"]]) {
    const { data, error } = await sb
      .from("firms")
      .insert({
        name: `Cabinet d'épreuve ${nom}`,
        rcic_license_number: permis,
        owner_name: "Épreuve",
        email: `${permis}@example.invalid`,
        plan: "cabinet",
        status: "active",
      })
      .select("id")
      .single()
    if (error) throw new Error(`Création du cabinet ${nom} : ${error.message}`)

    // Le connecteur exige un plan qui le comprenne ET un accès ouvert. Depuis
    // la facturation, « cabinet » sans abonnement est un plan payant impayé :
    // l'accès est fermé, et le connecteur avec lui. C'est bien ce qu'on veut
    // — le cabinet d'épreuve doit donc être un cabinet qui paie.
    await sb.from("firm_subscriptions").insert({
      firm_id: data.id,
      plan: "cabinet",
      status: "active",
      seats: 3,
    })

    await sb.from("ai_connector_settings").insert({ firm_id: data.id })
    const cle = "cric_live_" + randomBytes(32).toString("base64url")
    await sb.from("ai_api_keys").insert({
      firm_id: data.id,
      label: `Clé d'épreuve ${nom}`,
      key_prefix: cle.slice(0, 12),
      key_hash: createHash("sha256").update(cle).digest("hex"),
    })
    cabinets[nom] = { id: data.id, cle }
  }

  try {
    console.log("\nConnecteur fermé — l'état par défaut")
    verifier("aucune clé", await appel(null), 401, "UNAUTHORIZED")
    verifier("clé inventée", await appel("cric_live_inexistante"), 401, "UNAUTHORIZED")
    verifier("clé authentique, connecteur fermé", await appel(cabinets.A.cle), 401, "UNAUTHORIZED")

    console.log("\nA ouvre son connecteur")
    await sb.from("ai_connector_settings").update({ enabled: true }).eq("firm_id", cabinets.A.id)
    verifier("clé de A", await appel(cabinets.A.cle), 200, "OK")
    verifier("clé de B, dont le connecteur est fermé", await appel(cabinets.B.cle), 401, "UNAUTHORIZED")
    verifier("aucune clé", await appel(null), 401, "UNAUTHORIZED")

    console.log("\nActes réservés à un consultant réglementé")
    for (const acte of ["finalize", "send", "sign", "cancel"]) {
      verifier(acte, await appel(cabinets.A.cle, `${API}/SA-1/${acte}`, "POST"), 403, "RESERVED_HUMAN_ACTION")
    }

    // Le connecteur est un avantage du forfait Cabinet Pro. Rien n'empêche
    // l'exploitant d'écrire « cabinet » dans firms.plan depuis sa console —
    // et c'est précisément ce qui, avant firm_effective_plan(), ouvrait le
    // connecteur à un cabinet abonné au forfait Solo. Stripe continuait de
    // prélever 49 $. Le cas est ici parce qu'aucune relecture de code ne
    // l'aurait rattrapé : les deux colonnes portaient chacune un plan
    // plausible.
    console.log("\nLe connecteur suit le plan payé, pas le plan accordé")

    // A est accordé « cabinet » dans firms.plan et le reste tout du long : on
    // ne fait varier que ce qu'il PAIE. C'est exactement la divergence que la
    // console d'exploitation pouvait produire d'un clic.
    const changerAbonnement = async (champs) => {
      const { error } = await sb
        .from("firm_subscriptions")
        .update(champs)
        .eq("firm_id", cabinets.A.id)
      // Une écriture d'épreuve qui échoue en silence ferait passer le cas
      // suivant pour une réussite : l'état testé ne serait pas celui décrit.
      if (error) throw new Error(`Abonnement d'épreuve : ${error.message}`)
    }

    await changerAbonnement({ plan: "solo", seats: 1 })
    verifier("accordé « cabinet », abonné « solo »", await appel(cabinets.A.cle), 401, "UNAUTHORIZED")

    await changerAbonnement({ plan: "cabinet", seats: 3 })
    verifier("abonnement porté à « cabinet »", await appel(cabinets.A.cle), 200, "OK")

    // Un plan payant sans abonnement est un plan impayé : firm_access_open()
    // referme tout, connecteur compris. Ce cas garde cet invariant, qui est
    // ce qui empêche d'obtenir un forfait en l'écrivant simplement dans
    // firms.plan depuis la console.
    await sb.from("firm_subscriptions").delete().eq("firm_id", cabinets.A.id)
    verifier("plan payant, aucun abonnement", await appel(cabinets.A.cle), 401, "UNAUTHORIZED")

    await sb
      .from("firm_subscriptions")
      .insert({ firm_id: cabinets.A.id, plan: "cabinet", status: "active", seats: 3 })

    // L'exception accordée par l'exploitant doit primer sur le forfait, sinon
    // le bouton « activer pour ce cabinet » de la console ne ferait rien et
    // l'exploitant croirait l'avoir actionné. Elle doit aussi primer dans
    // l'autre sens : retirer une fonctionnalité que le forfait comprend.
    console.log("\nExceptions accordées par l'exploitant")
    await changerAbonnement({ plan: "solo", seats: 1 })
    verifier("forfait Solo, sans exception", await appel(cabinets.A.cle), 401, "UNAUTHORIZED")

    await sb.from("firm_feature_overrides").insert({
      firm_id: cabinets.A.id,
      feature: "ai_connector",
      enabled: true,
      reason: "Épreuve automatisée",
    })
    verifier("Solo + exception ouvrante", await appel(cabinets.A.cle), 200, "OK")

    // Une faveur sans échéance devient un droit acquis que personne ne pense
    // à retirer : celle-ci est datée, et sa date est respectée.
    await sb
      .from("firm_feature_overrides")
      .update({ expires_at: new Date(Date.now() - 3600000).toISOString() })
      .eq("firm_id", cabinets.A.id)
    verifier("exception échue", await appel(cabinets.A.cle), 401, "UNAUTHORIZED")

    await sb.from("firm_feature_overrides").delete().eq("firm_id", cabinets.A.id)
    await changerAbonnement({ plan: "cabinet", seats: 3 })
    await sb.from("firm_feature_overrides").insert({
      firm_id: cabinets.A.id,
      feature: "ai_connector",
      enabled: false,
      reason: "Épreuve automatisée — retrait",
    })
    verifier("Cabinet Pro + exception fermante", await appel(cabinets.A.cle), 401, "UNAUTHORIZED")
    await sb.from("firm_feature_overrides").delete().eq("firm_id", cabinets.A.id)

    console.log("\nRévocation et suspension")
    await sb.from("ai_api_keys").update({ revoked_at: new Date().toISOString() }).eq("firm_id", cabinets.A.id)
    verifier("clé révoquée", await appel(cabinets.A.cle), 401, "UNAUTHORIZED")

    await sb.from("ai_api_keys").update({ revoked_at: null }).eq("firm_id", cabinets.A.id)
    await sb.from("firms").update({ status: "suspended" }).eq("id", cabinets.A.id)
    verifier("cabinet suspendu", await appel(cabinets.A.cle), 401, "UNAUTHORIZED")

    console.log("\nImputation des traces")
    const ids = Object.values(cabinets).map((c) => c.id)
    for (const [nom, c] of Object.entries(cabinets)) {
      const { count } = await sb
        .from("ai_connector_logs")
        .select("*", { count: "exact", head: true })
        .eq("firm_id", c.id)
      console.log(`  · cabinet ${nom} : ${count} entrée(s)`)
    }
    const { count: ailleurs } = await sb
      .from("ai_connector_logs")
      .select("*", { count: "exact", head: true })
      .not("firm_id", "in", `(${ids.join(",")})`)
    const ok = ailleurs === 0
    if (!ok) echecs++
    console.log(`  ${ok ? "✓" : "✗"} aucune trace imputée à un autre cabinet (${ailleurs})`)
  } finally {
    for (const c of Object.values(cabinets)) await sb.from("firms").delete().eq("id", c.id)
    console.log("\nCabinets d'épreuve supprimés.")
  }

  console.log(echecs === 0 ? "\n✓ Cloisonnement vérifié, 0 échec." : `\n✗ ${echecs} échec(s).`)
  process.exit(echecs === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error("Échec :", e.message)
  process.exit(1)
})
