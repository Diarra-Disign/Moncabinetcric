/**
 * Ce qu'une épreuve doit vérifier AVANT de conclure quoi que ce soit.
 *
 * Le 11 août, ./cric fiche a annoncé « le serveur répond 404 — la fiche est
 * cassée ». La fiche allait bien. .env.local portait DATA_SOURCE=mock : le
 * serveur servait les données factices, le dossier que l'épreuve venait de
 * créer dans la vraie base lui était invisible, et la page rendait donc un
 * notFound() parfaitement correct.
 *
 * Le contrôle n'avait pas tort sur le FAIT — la page répondait bien 404. Il
 * avait tort sur la CONCLUSION, et c'est la seule chose qu'on lise. J'ai
 * rapporté une panne inexistante, et il a fallu remonter jusqu'à une variable
 * d'environnement pour m'en apercevoir.
 *
 * D'où le code de sortie. `1` veut dire « le produit a échoué ». `2` veut dire
 * « je n'ai pas pu juger ». Les confondre est exactement ce qui s'est passé.
 */
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

/** La racine du dépôt, depuis scripts/lib/. */
export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")

/** Lit .env.local — la même analyse que les scripts recopiaient un à un. */
export function chargerEnv() {
  return Object.fromEntries(
    [...readFileSync(join(ROOT, ".env.local"), "utf8").matchAll(/^([A-Z0-9_]+)=(.*)$/gm)]
      .map((m) => [m[1], m[2].trim()])
  )
}

/**
 * Refuse de commencer si l'application ne lit pas la vraie base.
 *
 * À n'appeler que depuis les épreuves qui ÉCRIVENT en base puis relisent à
 * travers le navigateur. Celles qui interrogent la base directement — RLS,
 * contraintes, déclencheurs — ne passent pas par l'application et n'ont donc
 * rien à faire de sa source de données.
 */
export function exigerSupabase(env = chargerEnv()) {
  if (env.DATA_SOURCE === "supabase") return env

  const source = env.DATA_SOURCE ? `DATA_SOURCE=${env.DATA_SOURCE}` : "DATA_SOURCE absent (défaut : mock)"
  console.error(
    `\n✗ Épreuve impossible : ${source} dans .env.local.\n` +
    `\n  Ce contrôle crée des lignes dans la vraie base, puis les cherche à\n` +
    `  l'écran. Sur les données factices elles n'y seront jamais — et ce ne\n` +
    `  serait pas le produit qui aurait tort.\n` +
    `\n  Corriger : DATA_SOURCE=supabase dans .env.local, puis relancer le\n` +
    `  serveur de développement pour qu'il relise le fichier.\n`
  )
  // 2, et non 1 : rien n'a été jugé.
  process.exit(2)
}
