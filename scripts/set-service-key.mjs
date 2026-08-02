#!/usr/bin/env node
/**
 * Remplace SUPABASE_SERVICE_ROLE_KEY dans .env.local.
 *
 *   node scripts/set-service-key.mjs
 *
 * La saisie est masquée : la clé n'apparaît ni à l'écran, ni dans
 * l'historique du shell, ni dans la liste des processus.
 *
 * Elle est validée AVANT écriture — c'est tout l'intérêt : coller la clé
 * publique à la place de la secrète est l'erreur la plus fréquente, et
 * elle ne se voit qu'au moment où quelque chose échoue, bien plus tard.
 */

import { createInterface } from "node:readline/promises"
import { stdin, stdout } from "node:process"
import { readFile, writeFile, copyFile } from "node:fs/promises"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const ENV = join(ROOT, ".env.local")

/** Rôle porté par une clé, ou null si le format est inconnu. */
function roleOf(key) {
  if (key.startsWith("sb_secret_")) return "service_role"
  if (key.startsWith("sb_publishable_")) return "anon"
  try {
    const part = key.split(".")[1]
    const json = Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
    return JSON.parse(json).role ?? null
  } catch {
    return null
  }
}

async function askHidden(question) {
  const rl = createInterface({ input: stdin, output: stdout, terminal: true })
  stdout.write(question)
  const onData = () => {
    stdout.write("[2K[200D" + question + "*".repeat(rl.line.length))
  }
  stdin.on("data", onData)
  const answer = await rl.question("")
  stdin.off("data", onData)
  rl.close()
  stdout.write("\n")
  return answer.trim()
}

async function main() {
  const original = await readFile(ENV, "utf8")

  const key = await askHidden("Clé secrète Supabase (saisie masquée) : ")
  if (!key) throw new Error("Aucune clé saisie.")

  const role = roleOf(key)

  if (role === "anon") {
    throw new Error(
      "Cette clé est la clé PUBLIQUE (rôle anon). Il faut la clé secrète :\n" +
        "  Tableau de bord → Settings → API Keys → ligne service_role / sb_secret_…"
    )
  }
  if (role !== "service_role") {
    throw new Error(
      `Clé non reconnue (rôle détecté : ${role ?? "illisible"}). Attendu : service_role ou sb_secret_…`
    )
  }

  // Sauvegarde avant modification : ce fichier n'est pas versionné.
  const backup = `${ENV}.bak-${new Date().toISOString().replace(/[:.]/g, "-")}`
  await copyFile(ENV, backup)

  const line = `SUPABASE_SERVICE_ROLE_KEY=${key}`
  const updated = /^SUPABASE_SERVICE_ROLE_KEY=.*$/m.test(original)
    ? original.replace(/^SUPABASE_SERVICE_ROLE_KEY=.*$/m, line)
    : `${original.replace(/\n*$/, "")}\n${line}\n`

  await writeFile(ENV, updated, { encoding: "utf8", mode: 0o600 })

  console.log("\n✓ Clé de service enregistrée (rôle service_role vérifié).")
  console.log(`  Sauvegarde : ${backup.replace(ROOT + "/", "")}`)
  console.log("\nÉtape suivante :  node scripts/verify-auth.mjs")
}

main().catch((err) => {
  console.error("\nÉchec :", err.message)
  process.exit(1)
})
