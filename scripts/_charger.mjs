/**
 * Installe le résolveur. Employé via : node --import ./scripts/_charger.mjs
 */
import { register } from "node:module"
register("./_resolveur.mjs", import.meta.url)
