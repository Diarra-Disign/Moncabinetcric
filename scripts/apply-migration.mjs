#!/usr/bin/env node
/**
 * Applique un fichier de migration via l'API de gestion Supabase.
 *
 *   ./cric migration supabase/migrations/2026....sql
 *
 * Pourquoi ce script existe : un premier essai maison s'était contenté de
 * lire le code HTTP et avait annoncé « 201 Created » sur une migration qui
 * échouait en réalité. Rien n'avait été créé, et je m'en suis aperçu
 * seulement en interrogeant le catalogue.
 *
 * Ici, le corps de la réponse est inspecté et une erreur Postgres fait
 * échouer la commande, même si le statut paraît favorable.
 */

import { readFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

async function credentials() {
  const path = join(homedir(), ".gemini", "config", "mcp_config.json")
  const cfg = JSON.parse(await readFile(path, "utf8"))
  const sb = (cfg.mcpServers ?? cfg.servers ?? {}).supabase
  if (!sb) throw new Error("Entrée « supabase » absente de mcp_config.json.")

  const token = (sb.headers?.Authorization ?? "").replace(/^Bearer\s+/i, "").trim()
  const ref = (sb.serverUrl ?? "").match(/project_ref=([a-z0-9]+)/)?.[1]
  if (!token) throw new Error("Jeton d'API de gestion introuvable.")
  if (!ref) throw new Error("project_ref introuvable dans l'URL du serveur MCP.")
  return { token, ref }
}

export async function runSql(sql) {
  const { token, ref } = await credentials()
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  })

  const texte = await res.text()
  let corps
  try {
    corps = JSON.parse(texte)
  } catch {
    corps = texte
  }

  // Le statut ne suffit pas : une erreur Postgres peut accompagner un code
  // favorable. On inspecte donc le corps.
  const message = corps && typeof corps === "object" && !Array.isArray(corps) ? corps.message : null
  if (!res.ok || (typeof message === "string" && /ERROR|error/i.test(message))) {
    throw new Error(`HTTP ${res.status} — ${message ?? texte.slice(0, 400)}`)
  }

  return corps
}

async function main() {
  const fichier = process.argv[2]
  if (!fichier) {
    console.error("Usage : ./cric migration <chemin/vers/migration.sql>")
    process.exit(1)
  }

  const chemin = fichier.startsWith("/") ? fichier : join(ROOT, fichier)
  const sql = await readFile(chemin, "utf8")
  console.log(`Application de ${fichier} — ${sql.length} caractères.`)

  await runSql(sql)
  console.log("✓ Migration appliquée sans erreur Postgres.")
  console.log("  Vérifier les objets créés : ./cric verifier")
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error("\nÉchec :", err.message)
    process.exit(1)
  })
}
