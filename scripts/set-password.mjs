#!/usr/bin/env node
/**
 * Pose ou change le mot de passe d'un compte existant.
 *
 *   ./cric motdepasse --email=infos@dgvimmigration.com
 *
 * Utile parce que les comptes créés par setup-accounts.mjs n'en ont pas :
 * ils ne peuvent se connecter que par lien magique, plafonné à quelques
 * courriels par heure. Un mot de passe rend la connexion immédiate et
 * indépendante de la boîte de réception.
 *
 * La saisie est masquée. Le mot de passe n'apparaît ni à l'écran, ni dans
 * l'historique du shell, ni dans la liste des processus.
 */

import { createInterface } from "node:readline/promises"
import { stdin, stdout } from "node:process"
import { readFile } from "node:fs/promises"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createClient } from "@supabase/supabase-js"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const MIN = 12

const valueOf = (n) => {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${n}=`))
  return hit ? hit.slice(n.length + 3).trim() : undefined
}

async function loadEnv() {
  const raw = await readFile(join(ROOT, ".env.local"), "utf8")
  const env = {}
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }
  return env
}

async function askHidden(question) {
  const rl = createInterface({ input: stdin, output: stdout, terminal: true })
  stdout.write(question)
  const mask = () => stdout.write("[2K[200D" + question + "*".repeat(rl.line.length))
  stdin.on("data", mask)
  const answer = await rl.question("")
  stdin.off("data", mask)
  rl.close()
  stdout.write("\n")
  return answer
}

async function main() {
  const env = await loadEnv()
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const email = valueOf("email")
  const { data: list } = await admin.auth.admin.listUsers()
  const users = list?.users ?? []

  if (!email) {
    console.log("\nComptes existants :\n")
    for (const u of users) console.log(`  ${u.email}`)
    console.log("\nUsage : ./cric motdepasse --email=<courriel>")
    return
  }

  const user = users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  if (!user) throw new Error(`Aucun compte pour ${email}.`)

  const pass = await askHidden(`Nouveau mot de passe pour ${email} (saisie masquée) : `)
  if (pass.length < MIN) throw new Error(`Trop court : ${MIN} caractères minimum.`)

  const confirm = await askHidden("Confirmer : ")
  if (pass !== confirm) throw new Error("Les deux saisies diffèrent.")

  const { error } = await admin.auth.admin.updateUserById(user.id, { password: pass })
  if (error) throw new Error(`Échec : ${error.message}`)

  console.log(`\n✓ Mot de passe posé pour ${email}.`)
  console.log("  Connexion : http://localhost:3000/fr/connexion — onglet « Mot de passe »")
}

main().catch((err) => {
  console.error("\nÉchec :", err.message)
  process.exit(1)
})
