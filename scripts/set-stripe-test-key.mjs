#!/usr/bin/env node
/**
 * Enregistre STRIPE_TEST_SECRET_KEY dans .env.local.
 *
 *   ./cric cle-test
 *
 * La saisie est masquée : la clé n'apparaît ni à l'écran, ni dans l'historique
 * du shell, ni dans la liste des processus, ni dans une conversation.
 *
 * ---------------------------------------------------------------------------
 * POURQUOI CE SCRIPT PLUTÔT QU'UNE LIGNE À COLLER
 * ---------------------------------------------------------------------------
 * Trois tentatives ont échoué avant qu'il n'existe, et pour trois raisons
 * différentes : le fichier n'était pas enregistré, puis la ligne est allée
 * dans un fichier voisin, puis le presse-papiers contenait la COMMANDE au lieu
 * de la clé. Aucune de ces erreurs ne se signale — le fichier accepte
 * n'importe quel texte, et l'échec apparaît beaucoup plus loin.
 *
 * Ici, la clé est validée AVANT d'être écrite. Une clé publiable, une clé de
 * production, un morceau de commande collé par erreur : chacune est refusée
 * avec la raison, et le fichier n'est pas touché.
 *
 * Le refus de la clé LIVE est le contrôle qui compte le plus. Cette clé sert à
 * des épreuves qui créent des abonnements, changent des forfaits et facturent
 * des places. Exécutées contre le compte de production, elles factureraient de
 * vrais cabinets.
 */

import { createInterface } from "node:readline/promises"
import { stdin, stdout } from "node:process"
import { readFile, writeFile, copyFile } from "node:fs/promises"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const ENV = join(ROOT, ".env.local")
const NOM = "STRIPE_TEST_SECRET_KEY"

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

/** Ce que la saisie semble être, pour pouvoir refuser avec la raison. */
function nature(v) {
  if (v.startsWith("sk_test_")) return "ok"
  if (v.startsWith("rk_test_")) return "restreinte"
  if (v.startsWith("pk_test_") || v.startsWith("pk_live_")) return "publiable"
  if (v.startsWith("sk_live_")) return "production"
  if (v.startsWith("whsec_")) return "webhook"
  return "inconnue"
}

const REFUS = {
  publiable:
    "C'est la clé PUBLIABLE (pk_…), qui ne peut rien créer.\n" +
    "  La secrète est masquée : dashboard.stripe.com/test/apikeys → « Reveal test key ».",
  production:
    "C'est la clé de PRODUCTION (sk_live_…). Refusée délibérément.\n" +
    "  Ces épreuves créent des abonnements et facturent des places : contre le\n" +
    "  compte de production, elles factureraient de vrais cabinets.",
  restreinte:
    "C'est une clé RESTREINTE (rk_test_…). Elle peut convenir, mais ses\n" +
    "  permissions sont inconnues d'ici, et une épreuve qui échoue faute de droit\n" +
    "  ressemble à une épreuve qui échoue faute de code.\n" +
    "  Prendre la clé secrète standard : sk_test_…",
  webhook:
    "C'est un secret de WEBHOOK (whsec_…), pas une clé d'API.\n" +
    "  Il va dans STRIPE_WEBHOOK_SECRET.",
  inconnue:
    "Format non reconnu. Attendu : sk_test_…\n" +
    "  Si tu viens de coller une commande ou un chemin de fichier, recommence :\n" +
    "  c'est la clé elle-même qu'il faut, copiée depuis Stripe.",
}

async function main() {
  console.log("Clé secrète Stripe en MODE TEST.")
  console.log("  https://dashboard.stripe.com/test/apikeys → « Reveal test key »")
  console.log("  Elle commence par sk_test_ et ne peut déplacer aucun argent réel.\n")

  const original = await readFile(ENV, "utf8")
  const cle = await askHidden("Clé (saisie masquée) : ")
  if (!cle) throw new Error("Aucune clé saisie.")

  const quoi = nature(cle)
  if (quoi !== "ok") throw new Error(REFUS[quoi])

  // Une clé Stripe fait une centaine de caractères. En dessous de 40, c'est un
  // fragment — une copie interrompue, un « Reveal » à moitié déclenché.
  if (cle.length < 40) {
    throw new Error(
      `Clé trop courte (${cle.length} caractères). La copie a probablement été tronquée.`
    )
  }

  // Sauvegarde avant modification : ce fichier n'est pas versionné, et il
  // porte aussi la clé de production.
  const backup = `${ENV}.bak-${new Date().toISOString().replace(/[:.]/g, "-")}`
  await copyFile(ENV, backup)

  const ligne = `${NOM}=${cle}`
  const maj = new RegExp(`^${NOM}=.*$`, "m").test(original)
    ? original.replace(new RegExp(`^${NOM}=.*$`, "m"), ligne)
    : `${original.replace(/\n*$/, "")}\n${ligne}\n`

  await writeFile(ENV, maj, { encoding: "utf8", mode: 0o600 })

  console.log("\n✓ Clé de test enregistrée, format vérifié.")
  console.log(`  Sauvegarde : ${backup.replace(ROOT + "/", "")}`)
  console.log("\nÉtape suivante :  ./cric facturation-sieges")
}

main().catch((err) => {
  console.error("\nRefusé :", err.message)
  console.error("\n.env.local n'a pas été modifié.")
  process.exit(1)
})
