/**
 * Résolveur de modules pour les scripts d'épreuve.
 *
 * Il existe pour une raison précise : permettre aux suites de vérification
 * d'importer le VRAI code de production, et non une copie réécrite pour les
 * besoins du test. Une copie finit toujours par diverger de l'original, et
 * c'est alors la copie qu'on éprouve.
 *
 * Trois obstacles séparaient Node du code de lib/ :
 *
 *   1. `import "server-only"` — ce paquet lève délibérément hors d'un
 *      composant serveur React. C'est une garde utile en production : elle
 *      empêche une clé secrète de se retrouver dans un paquet envoyé au
 *      navigateur. Elle n'a aucun sens dans un script en ligne de commande,
 *      qui est par nature du serveur. Il est donc remplacé par un module vide
 *      — jamais désactivé dans l'application elle-même.
 *
 *   2. Les imports relatifs sans extension (`./stripe`). TypeScript les
 *      accepte, Node en mode ESM les refuse. Le résolveur essaie les
 *      extensions dans l'ordre où le projet les emploie.
 *
 *   3. L'alias `@/`, qui désigne la racine du projet dans tsconfig.json et que
 *      Node ignore.
 *
 * Aucun de ces trois n'altère le comportement du code éprouvé : ils portent
 * sur la façon dont les fichiers sont TROUVÉS, pas sur ce qu'ils font.
 */

import { existsSync } from "node:fs"
import { fileURLToPath, pathToFileURL } from "node:url"
import { dirname, join, resolve as resoudreChemin } from "node:path"

const RACINE = resoudreChemin(dirname(fileURLToPath(import.meta.url)), "..")
const VIDE = pathToFileURL(join(RACINE, "scripts", "_vide.mjs")).href

/** Extensions essayées pour un import sans extension, dans l'ordre du projet. */
const EXTENSIONS = [".ts", ".tsx", ".mjs", ".js"]

function premierExistant(base) {
  for (const ext of EXTENSIONS) {
    if (existsSync(base + ext)) return base + ext
  }
  // Un dossier peut porter un index.
  for (const ext of EXTENSIONS) {
    const index = join(base, "index" + ext)
    if (existsSync(index)) return index
  }
  return null
}

export async function resolve(specifier, context, next) {
  if (specifier === "server-only") {
    return { url: VIDE, format: "module", shortCircuit: true }
  }

  // Alias @/ → racine du projet, comme dans tsconfig.json.
  if (specifier.startsWith("@/")) {
    const cible = premierExistant(join(RACINE, specifier.slice(2)))
    if (cible) return { url: pathToFileURL(cible).href, shortCircuit: true }
  }

  // Relatif sans extension : Node refuse, TypeScript accepte.
  if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) {
    const depuis = context.parentURL ? dirname(fileURLToPath(context.parentURL)) : RACINE
    const cible = premierExistant(resoudreChemin(depuis, specifier))
    if (cible) return { url: pathToFileURL(cible).href, shortCircuit: true }
  }

  return next(specifier, context)
}
