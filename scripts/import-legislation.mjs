#!/usr/bin/env node
/**
 * Importateur de la LIPR et du RIPR depuis les textes consolidés officiels
 * de laws-lois.justice.gc.ca.
 *
 *   node scripts/import-legislation.mjs            # utilise le cache local
 *   node scripts/import-legislation.mjs --refresh  # retélécharge les sources
 *
 * Produit lib/data/legislation/provisions.json : un enregistrement par
 * article, bilingue, avec la date de consolidation réelle publiée par
 * Justice Canada.
 *
 * Aucun texte n'est écrit à la main : tout provient du HTML officiel. Une
 * disposition qui n'est pas dans la source n'apparaît pas dans la sortie.
 */

import { mkdir, readFile, writeFile, access } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { PRACTICE_HIGHLIGHTS } from "./practice-highlights.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const CACHE = join(ROOT, ".cache", "legislation")
const OUT = join(ROOT, "lib", "data", "legislation", "provisions.json")

const SOURCES = [
  { instrument: "lipr", lang: "fra", url: "https://laws-lois.justice.gc.ca/fra/lois/i-2.5/TexteComplet.html" },
  { instrument: "lipr", lang: "eng", url: "https://laws-lois.justice.gc.ca/eng/acts/i-2.5/FullText.html" },
  { instrument: "ripr", lang: "fra", url: "https://laws-lois.justice.gc.ca/fra/reglements/DORS-2002-227/TexteComplet.html" },
  { instrument: "ripr", lang: "eng", url: "https://laws-lois.justice.gc.ca/eng/regulations/SOR-2002-227/FullText.html" },
]

/**
 * Périmètre : « cœur de pratique + protection des réfugiés ».
 *
 * Exprimé en exclusions nommées plutôt qu'en inclusions — on voit ainsi
 * d'un coup d'œil ce qui est écarté et pourquoi, et un pan de texte ne
 * peut pas disparaître par simple oubli. Bornes incluses.
 *
 * Pour élargir le périmètre : commenter une ligne et relancer le script.
 */
const EXCLUSIONS = {
  lipr: [
    { from: 1, to: 1, why: "Titre abrégé" },
    { from: 4, to: 9.99, why: "Mise en application et concertation intergouvernementale" },
    { from: 151, to: 186.09, why: "Composition et procédure de la CISR" },
    { from: 187, to: Infinity, why: "Dispositions transitoires et modifications corrélatives" },
  ],
  ripr: [
    { from: 223, to: 293.99, why: "Renvoi, détention, saisie, transport et prêts" },
    { from: 304, to: 315.99, why: "Échange de renseignements entre pays" },
    { from: 316, to: Infinity, why: "Dispositions transitoires, abrogation et entrée en vigueur" },
  ],
}

function isExcluded(instrument, no) {
  return EXCLUSIONS[instrument].find((r) => no >= r.from && no <= r.to)
}

/** "87.1" -> 87.1 ; sert au tri et aux bornes de périmètre. */
function numeric(label) {
  const m = label.match(/^(\d+)(?:\.(\d+))?/)
  if (!m) return Number.NaN
  return Number.parseFloat(m[2] ? `${m[1]}.${m[2]}` : m[1])
}

function stripTags(fragment) {
  return fragment
    .replace(/<span class="wb-invisible">.*?<\/span>/gs, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Reconstruit la hiérarchie officielle (partie / section / sous-section)
 * à partir de la table des matières, plutôt que de l'inventer.
 *
 * Renvoie une fonction qui, pour un numéro d'article, donne le chemin
 * applicable en remontant les niveaux de titre.
 */
function buildHierarchy(html) {
  const re =
    /<span class='sectionRange'>([0-9]+(?:\.[0-9]+)?)\s*-\s*<\/span>.*?<span class="HTitleText([1-3])">(.*?)<\/span>/gs
  const marks = [...html.matchAll(re)]
    .map((m) => ({ from: numeric(m[1]), level: Number(m[2]), title: stripTags(m[3]) }))
    .filter((m) => !Number.isNaN(m.from) && m.title)
    .sort((a, b) => a.from - b.from || a.level - b.level)

  return (no) => {
    const current = {}
    for (const mark of marks) {
      if (mark.from > no) break
      current[mark.level] = mark.title
      // Un titre de niveau supérieur invalide les niveaux plus fins.
      for (const deeper of [2, 3]) if (deeper > mark.level) delete current[deeper]
    }
    const path = [1, 2, 3].map((l) => current[l]).filter(Boolean)
    return path.join(" / ")
  }
}

function consolidationDate(html) {
  const m =
    html.match(/(?:jour au|current to)[^0-9]{0,60}(\d{4}-\d{2}-\d{2})/i) ||
    html.match(/(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : null
}

/**
 * Découpe un texte complet en articles.
 *
 * Chaque article commence à son ancre `sectionLabel`. Le titre est la
 * dernière note marginale qui précède l'ancre ; le corps rassemble les
 * paragraphes jusqu'à l'ancre suivante, la note historique marquant la fin
 * des dispositions.
 */
function parseProvisions(html) {
  const anchorRe = /<a class="sectionLabel" id="s-([0-9]+(?:\.[0-9]+)?)"/g
  const anchors = [...html.matchAll(anchorRe)].map((m) => {
    // L'ancre est imbriquée DANS le <p> qui porte le texte. Partir de
    // l'ancre couperait la balise ouvrante, et le premier paragraphe de
    // chaque article serait perdu — silencieusement pour les articles à
    // plusieurs paragraphes, totalement pour ceux qui n'en ont qu'un.
    const pStart = html.lastIndexOf('<p class="', m.index)
    return { label: m[1], index: m.index, start: pStart >= 0 ? pStart : m.index }
  })
  const provisions = new Map()

  anchors.forEach((anchor, i) => {
    const next = anchors[i + 1]
    const chunk = html.slice(anchor.start, next ? next.start : html.length)
    const bodyZone = chunk.split('<div class="HistoricalNote"')[0]

    // Titre : dernière note marginale avant le début du paragraphe.
    const before = html.slice(Math.max(0, anchor.start - 2500), anchor.start)
    const notes = [...before.matchAll(/<p class="MarginalNote"[^>]*>(.*?)<\/p>/gs)]
    const heading = notes.length ? stripTags(notes[notes.length - 1][1]) : ""

    const parts = []
    // La classe peut porter des modificateurs : "Section amending",
    // "Section transitional". Les ignorer perdrait l'article entier.
    const blockRe =
      /<p class="(MarginalNote|Section|Subsection|Paragraph|Definition)(?:\s[^"]*)?"[^>]*>(.*?)<\/p>/gs
    for (const m of bodyZone.matchAll(blockRe)) {
      const text = stripTags(m[2])
      if (!text) continue
      parts.push(m[1] === "MarginalNote" ? `[${text}]` : text)
    }

    const body = parts.join(" ").trim()
    // Un article déjà vu (renvois internes) ne doit pas écraser le premier.
    if (body && !provisions.has(anchor.label)) {
      provisions.set(anchor.label, { label: anchor.label, heading, body })
    }
  })

  return provisions
}

async function loadSource({ instrument, lang, url }, refresh) {
  const file = join(CACHE, `${instrument}.${lang}.html`)
  if (!refresh) {
    try {
      await access(file)
      return readFile(file, "utf8")
    } catch {
      /* absent du cache : on télécharge */
    }
  }
  process.stdout.write(`  téléchargement ${instrument}/${lang}… `)
  const res = await fetch(url, { headers: { "User-Agent": "moncabinetcric-importer" } })
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`)
  const html = await res.text()
  await mkdir(CACHE, { recursive: true })
  await writeFile(file, html, "utf8")
  console.log(`${(html.length / 1024).toFixed(0)} Ko`)
  return html
}

async function main() {
  const refresh = process.argv.includes("--refresh")
  console.log("Import LIPR / RIPR depuis laws-lois.justice.gc.ca\n")

  const byInstrument = {}
  const dates = {}
  const hierarchies = {}

  for (const source of SOURCES) {
    const html = await loadSource(source, refresh)
    const date = consolidationDate(html)
    dates[`${source.instrument}.${source.lang}`] = date
    byInstrument[source.instrument] ??= {}
    byInstrument[source.instrument][source.lang] = parseProvisions(html)
    if (source.lang === "fra") hierarchies[source.instrument] = buildHierarchy(html)
  }

  const records = []
  const report = {}

  for (const instrument of ["lipr", "ripr"]) {
    const fr = byInstrument[instrument].fra
    const en = byInstrument[instrument].eng
    const date = dates[`${instrument}.fra`] || dates[`${instrument}.eng`]
    const pathOf = hierarchies[instrument]

    const stats = { total: fr.size, retenus: 0, exclus: 0, sansAnglais: 0, abroges: 0 }

    for (const [label, provFr] of fr) {
      const no = numeric(label)
      if (Number.isNaN(no)) continue

      if (/\[Abrog|\[Repealed/i.test(provFr.heading) || /^\[Abrog|^\[Repealed/i.test(provFr.body)) {
        stats.abroges++
        continue
      }
      if (isExcluded(instrument, no)) {
        stats.exclus++
        continue
      }

      const provEn = en.get(label)
      if (!provEn) stats.sansAnglais++

      const highlight = PRACTICE_HIGHLIGHTS.find(
        (h) => h.instrument === instrument && h.no === label
      )

      records.push({
        id: `${instrument}-${label}`,
        instrument,
        provisionNo: label,
        hierarchyPath: pathOf(no),
        headingFr: provFr.heading,
        headingEn: provEn?.heading ?? provFr.heading,
        bodyFr: provFr.body,
        bodyEn: provEn?.body ?? "",
        consolidatedOn: date,
        sourceUrl:
          instrument === "lipr"
            ? `https://laws-lois.justice.gc.ca/fra/lois/i-2.5/section-${label}.html`
            : `https://laws-lois.justice.gc.ca/fra/reglements/DORS-2002-227/section-${label}.html`,
        tags: highlight ? [highlight.area] : [],
        frequentlyUsed: Boolean(highlight),
      })
      stats.retenus++
    }
    report[instrument] = { ...stats, consolidatedOn: date }
  }

  // Garde-fou : le corps d'un article doit commencer par son propre numéro.
  // C'est la signature d'un découpage correct — un décalage d'une balise
  // tronque le premier paragraphe sans rien casser de visible.
  const tronques = records.filter((r) => {
    const debut = r.bodyFr.slice(0, 24).replace(/\s+/g, " ")
    return !debut.startsWith(r.provisionNo)
  })
  if (tronques.length > 0) {
    console.error(`\n  ÉCHEC : ${tronques.length} article(s) ne commencent pas par leur numéro,`)
    console.error("  signe que le premier paragraphe a été coupé. Exemples :")
    for (const r of tronques.slice(0, 5)) {
      console.error(`    ${r.id} → « ${r.bodyFr.slice(0, 70)}… »`)
    }
    process.exit(1)
  }

  const sansAnglais = records.filter((r) => !r.bodyEn)
  if (sansAnglais.length > 0) {
    console.error(`\n  ÉCHEC : ${sansAnglais.length} article(s) sans version anglaise.`)
    process.exit(1)
  }

  // Ordre par défaut : les dispositions d'usage fréquent d'abord, dans
  // l'ordre thématique de la liste, puis le reste par instrument et numéro.
  // Sans cela les 218 articles de la LIPR précèdent les 400 du RIPR, et une
  // première page de 25 n'affiche jamais le moindre article du règlement.
  const rank = new Map(
    PRACTICE_HIGHLIGHTS.map((h, i) => [`${h.instrument}-${h.no}`, i])
  )
  records.sort((a, b) => {
    const ra = rank.get(a.id) ?? Number.MAX_SAFE_INTEGER
    const rb = rank.get(b.id) ?? Number.MAX_SAFE_INTEGER
    if (ra !== rb) return ra - rb
    return a.instrument === b.instrument
      ? numeric(a.provisionNo) - numeric(b.provisionNo)
      : a.instrument.localeCompare(b.instrument)
  })

  // Une entrée de la sélection qui ne trouve pas sa disposition signale une
  // faute de frappe ou un article sorti du périmètre : il faut le savoir.
  const orphelins = PRACTICE_HIGHLIGHTS.filter(
    (h) => !records.some((r) => r.id === `${h.instrument}-${h.no}`)
  )
  if (orphelins.length > 0) {
    console.error(`\n  ÉCHEC : ${orphelins.length} entrée(s) d'usage fréquent sans disposition correspondante :`)
    for (const o of orphelins) console.error(`    ${o.instrument} ${o.no} (${o.area})`)
    process.exit(1)
  }

  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, `${JSON.stringify(records, null, 1)}\n`, "utf8")

  console.log("\n--- Résultat ---")
  for (const [instrument, s] of Object.entries(report)) {
    console.log(
      `  ${instrument.toUpperCase()} : ${s.retenus} retenus / ${s.total} articles ` +
        `(${s.exclus} hors périmètre, ${s.abroges} abrogés, ${s.sansAnglais} sans version anglaise) ` +
        `— consolidé au ${s.consolidatedOn}`
    )
  }
  for (const [instrument, ranges] of Object.entries(EXCLUSIONS)) {
    for (const r of ranges) {
      console.log(`    exclu ${instrument} ${r.from}–${r.to === Infinity ? "fin" : r.to} : ${r.why}`)
    }
  }
  const kb = (JSON.stringify(records).length / 1024).toFixed(0)
  console.log(`\n  ${records.length} dispositions écrites dans ${OUT.replace(ROOT + "/", "")} (${kb} Ko)`)
}

main().catch((err) => {
  console.error("Échec de l'import :", err.message)
  process.exit(1)
})
