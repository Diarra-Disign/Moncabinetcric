#!/usr/bin/env node
/**
 * Éprouve la présentation du fidéicommis dans les offres de la page publique.
 *
 *   ./cric offres
 *   ./cric offres --url=https://moncabinetcric.vercel.app
 *
 * Une page de vente est vérifiable comme le reste, et elle mérite de l'être
 * davantage : elle est lue par des gens qui ne peuvent pas ouvrir le produit
 * pour vérifier ce qu'elle promet. Deux risques distincts sont contrôlés ici.
 *
 * LE PREMIER : QUE LA MENTION N'APPARAISSE PAS. Elle vit dans un fichier de
 * traduction et transite par une clé nommée à la main. Une clé mal orthographiée
 * ne casse rien — next-intl rend le nom de la clé, ou rien du tout — et
 * personne ne s'en aperçoit avant qu'un client demande pourquoi la ligne
 * manque en anglais.
 *
 * LE SECOND, PLUS GRAVE : QU'ELLE PROMETTE CE QUI N'EXISTE PAS. Le texte est
 * confronté à une liste de mots interdits — intégration bancaire, conformité
 * garantie, certification, automatisation. Aucun de ces mots ne décrit ce que
 * le module fait aujourd'hui, et les écrire sur une page publique engagerait
 * un consultant réglementé auprès de ses propres clients.
 *
 * L'affichage est mesuré à trois largeurs, parce qu'un avantage plus long que
 * les quatre autres est exactement celui qui déborde en téléphone.
 */
import { readFileSync, readdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

const magasin = join(ROOT, "node_modules/.pnpm")
const dossierPw = readdirSync(magasin).find((d) => /^playwright@/.test(d))
const { chromium } = await import(join(magasin, dossierPw, "node_modules/playwright/index.mjs"))

const arg = process.argv.find((a) => a.startsWith("--url="))
const BASE = (arg ? arg.slice(6) : "http://localhost:3000").replace(/\/+$/, "")

let echecs = 0
const ok = (b, quoi, detail = "") => {
  console.log(`${b ? "  ✓" : "  ✗"} ${quoi}${detail ? ` — ${detail}` : ""}`)
  if (!b) echecs++
}

// Les libellés attendus sont LUS dans les fichiers de traduction, jamais
// recopiés ici : un contrôle qui porte sa propre copie du texte continue de
// passer après qu'on a modifié le produit.
const messages = (l) => JSON.parse(readFileSync(join(ROOT, `messages/${l}.json`), "utf8"))

/**
 * Ce qu'une page publique n'a pas le droit de dire du module tel qu'il est.
 *
 * Ces mots ne sont pas interdits en soi : ils décrivent des choses qui
 * n'existent pas ici. Le module tient un registre et un rapprochement saisis
 * à la main ; il ne parle à aucune banque, ne certifie rien et n'automatise
 * aucune écriture. Le jour où l'un de ces chemins sera construit, on retirera
 * le mot de cette liste — pas avant.
 */
const INTERDITS = [
  "intégration bancaire", "connexion bancaire", "synchronisation bancaire",
  "bank integration", "bank sync",
  "conformité garantie", "garantie de conformité", "guaranteed compliance",
  "certifié", "certification", "certified",
  "automatique", "automatisé", "automated", "automatic",
]

const LARGEURS = [
  { nom: "téléphone", w: 390, h: 844 },
  { nom: "tablette", w: 820, h: 1180 },
  { nom: "ordinateur", w: 1440, h: 900 },
]

const navigateur = await chromium.launch()

for (const langue of ["fr", "en"]) {
  const attendu = messages(langue).Landing.pricing.solo.f5
  console.log(`\n${langue.toUpperCase()} — « ${attendu} »`)

  // 1. Le libellé existe et ne promet rien d'inexistant.
  ok(Boolean(attendu && attendu.trim()), "la clé de traduction porte un texte")
  const fautif = INTERDITS.find((m) => attendu.toLowerCase().includes(m))
  ok(!fautif, "aucune promesse que le module ne tient pas", fautif ? `interdit : « ${fautif} »` : "")

  for (const { nom, w, h } of LARGEURS) {
    const page = await navigateur.newPage({ viewport: { width: w, height: h } })
    await page.goto(`${BASE}/${langue}/landing`, { waitUntil: "domcontentloaded" })

    const ligne = page.locator("#pricing li", { hasText: attendu }).first()
    await ligne.waitFor({ state: "visible", timeout: 60_000 }).catch(() => {})

    const visible = await ligne.isVisible().catch(() => false)
    ok(visible, `${nom} — la ligne est visible dans la section Offres`)

    if (visible) {
      // 2. Elle est dans la carte du forfait d'entrée, d'où les autres
      //    l'héritent par leur « … plus : ». Si elle migrait vers une carte
      //    supérieure, la page dirait que Solo en est privé — ce qui est faux.
      const carte = ligne.locator("xpath=ancestor::div[contains(@class,'rounded-3xl')][1]")
      const titre = (await carte.locator("h3").first().textContent().catch(() => "")) ?? ""
      ok(
        titre.trim() === messages(langue).Landing.pricing.solo.name,
        `${nom} — elle est dans la carte du forfait d'entrée`,
        `carte : « ${titre.trim()} »`
      )

      // 3. Rien n'est coupé. Le texte doit tenir dans sa case, coche comprise.
      const debord = await ligne.evaluate((el) => {
        const span = el.querySelector("span")
        return {
          texte: span.scrollWidth > span.clientWidth + 1,
          hauteur: el.scrollHeight > el.clientHeight + 1,
        }
      })
      ok(!debord.texte, `${nom} — le texte n'est pas tronqué en largeur`)
      ok(!debord.hauteur, `${nom} — le texte n'est pas rogné en hauteur`)

      // 4. La coche s'aligne sur la PREMIÈRE ligne du texte. Un avantage qui
      //    passe sur deux lignes centrerait sa coche entre les deux, à côté
      //    de rien — le défaut exact que cette ligne, la plus longue des
      //    cinq, est la première à révéler.
      const aligne = await ligne.evaluate((el) => {
        const coche = el.querySelector("svg").getBoundingClientRect()
        const texte = el.querySelector("span").getBoundingClientRect()
        const centreCoche = coche.top + coche.height / 2
        // La première ligne de texte fait au plus 28 px de haut ici.
        return centreCoche < texte.top + 28
      })
      ok(aligne, `${nom} — la coche est alignée sur la première ligne`)
    }

    // 5. La page entière ne défile pas latéralement.
    const deborde = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1
    )
    ok(!deborde, `${nom} — la page ne défile pas latéralement`)

    await page.close()
  }
}

// 6. Les quatre cartes rendent toujours leurs avantages. Le passage de
//    quatre <li> écrits en dur à une boucle est exactement le genre de
//    remaniement qui vide une liste sans que rien ne signale l'erreur.
console.log("\nLes quatre cartes ont gardé leurs avantages")
{
  const page = await navigateur.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(`${BASE}/fr/landing`, { waitUntil: "domcontentloaded" })
  await page.locator("#pricing").waitFor({ state: "visible", timeout: 60_000 })

  const p = messages("fr").Landing.pricing
  for (const [cle, minimum] of [["solo", 5], ["cabinet", 4], ["business", 4], ["enterprise", 4]]) {
    const carte = page.locator("#pricing h3", { hasText: p[cle].name }).first()
      .locator("xpath=ancestor::div[contains(@class,'rounded-3xl')][1]")
    const n = await carte.locator("li").count()
    ok(n === minimum, `${p[cle].name} : ${minimum} avantages`, `trouvé ${n}`)
  }
  await page.close()
}

await navigateur.close()

console.log(`\n${echecs === 0 ? "✓ Tout est conforme." : `✗ ${echecs} échec(s).`}`)
process.exit(echecs === 0 ? 0 : 1)
