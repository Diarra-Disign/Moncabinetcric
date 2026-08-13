#!/usr/bin/env node
/**
 * Éprouve l'identité visuelle servie par le site.
 *
 *   ./cric marque
 *   ./cric marque --url=https://moncabinetcric.vercel.app
 *
 * ─── LA PANNE QUE CE CONTRÔLE ATTRAPE ──────────────────────────────────────
 *
 * Une icône se déclare dans les métadonnées et se dépose dans `public/`. Ce
 * sont deux gestes distincts, et rien ne les relie : renommer un fichier,
 * déplacer un dossier ou oublier un dépôt laisse une balise qui pointe vers
 * rien. Le navigateur ne dit rien — il affiche l'icône par défaut, ou aucune.
 * Sur un aperçu de partage, l'image manquante ne se voit qu'au moment où
 * quelqu'un partage le lien, c'est-à-dire trop tard.
 *
 * Chaque adresse déclarée dans l'en-tête est donc RÉELLEMENT demandée.
 *
 * On vérifie aussi qu'aucun reste de squelette ne subsiste : `create-next-app`
 * laisse cinq images dans `public/`, dont le logo de Vercel.
 */
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const arg = process.argv.find((a) => a.startsWith("--url="))
const BASE = (arg ? arg.slice(6) : "http://localhost:3000").replace(/\/+$/, "")

let echecs = 0
const v = (intitule, obtenu, attendu) => {
  const ok = String(obtenu) === String(attendu)
  if (!ok) echecs++
  console.log(`  ${ok ? "✓" : "✗"} ${intitule.padEnd(52)} ${String(obtenu).slice(0, 34)}` +
    (ok ? "" : `   ATTENDU ${attendu}`))
}

const html = await (await fetch(`${BASE}/fr`, { cache: "no-store" })).text()

// ── 1. LES BALISES SONT LÀ ────────────────────────────────────────────────
console.log("\nL'en-tête déclare la marque")
const balises = [...html.matchAll(/<link[^>]+rel="([^"]*(?:icon|manifest)[^"]*)"[^>]*href="([^"]+)"/g)]
  .map((m) => ({ rel: m[1], href: m[2] }))

v("un favicon est déclaré", balises.some((b) => b.rel.includes("icon")), true)
v("une icône Apple est déclarée", balises.some((b) => b.rel === "apple-touch-icon"), true)
v("un manifeste est déclaré", balises.some((b) => b.rel === "manifest"), true)

const meta = (motif) => (html.match(motif)?.[1] ?? "")
const ogImage = meta(/<meta property="og:image" content="([^"]+)"/)
const twImage = meta(/<meta name="twitter:image" content="([^"]+)"/)
v("une image Open Graph est déclarée", Boolean(ogImage), true)
v("elle est ABSOLUE, comme l'exigent les réseaux", ogImage.startsWith("http"), true)
v("une image Twitter est déclarée", Boolean(twImage), true)

// ── 2. RIEN N'EST DÉCLARÉ EN L'AIR ────────────────────────────────────────
// Le contrôle qui compte : une balise peut être parfaite et pointer vers 404.
console.log("\nChaque ressource déclarée répond vraiment")
const adresses = [
  ...new Set([...balises.map((b) => b.href), ogImage, twImage].filter(Boolean)),
]
for (const adresse of adresses) {
  const url = adresse.startsWith("http") ? adresse : `${BASE}${adresse}`
  const r = await fetch(url, { cache: "no-store" }).catch(() => null)
  const type = r?.headers.get("content-type") ?? ""
  const bon = Boolean(r?.ok) && /image\/|manifest|json/.test(type)
  v(adresse.replace(/\?.*$/, "").slice(0, 46), bon ? "servie" : `${r?.status ?? "réseau"} ${type}`, "servie")
}

// ── 3. LE MANIFESTE DIT LE NOM DU PRODUIT ─────────────────────────────────
console.log("\nLe manifeste porte le nom du cabinet")
const man = await (await fetch(`${BASE}/manifest.webmanifest`, { cache: "no-store" })).json()
v("un nom est défini", Boolean(man.name), true)
v("aucune valeur par défaut de Next",
  /next|create next app|vercel/i.test(`${man.name} ${man.short_name}`), false)
v("la couleur de thème est celle de la marque", man.theme_color, "#2563EB")
v("l'application s'ouvre sur la racine publique", man.start_url, "/")
v("au moins une icône de 512 px",
  (man.icons ?? []).some((i) => String(i.sizes).includes("512")), true)

// ── 4. AUCUN RESTE DE SQUELETTE ───────────────────────────────────────────
// Ces cinq fichiers arrivent avec `create-next-app`, logo de Vercel compris.
// Ils n'étaient référencés nulle part — mais un fichier présent finit par être
// utilisé par quelqu'un qui le croit voulu.
console.log("\nLes restes de create-next-app ont disparu")
for (const nom of ["file.svg", "globe.svg", "next.svg", "vercel.svg", "window.svg"]) {
  let present = true
  try { readFileSync(join(ROOT, "public", nom)) } catch { present = false }
  v(`public/${nom} absent du dépôt`, present, false)
}
v("aucune mention de Vercel dans l'en-tête servi", /vercel/i.test(html), false)

console.log(echecs === 0
  ? "\n✓ La marque est celle du cabinet, et tout ce qui est déclaré répond, 0 échec."
  : `\n✗ ${echecs} échec(s).`)
process.exit(echecs === 0 ? 0 : 1)
