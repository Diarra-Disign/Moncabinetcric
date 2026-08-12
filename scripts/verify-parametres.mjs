#!/usr/bin/env node
/**
 * Éprouve l'enregistrement de l'identité du cabinet, contre la vraie base.
 *
 * CE QUE CE SCRIPT CHERCHE À PRENDRE EN DÉFAUT, dans l'ordre :
 *
 * 1. LA SAUVEGARDE QUI NE SAUVEGARDE PAS. La politique RLS `firms_owner_update`
 *    exige `is_firm_owner()`. Un membre qui n'est pas propriétaire voit son
 *    UPDATE toucher ZÉRO ligne — et PostgREST ne rend AUCUNE erreur. L'action
 *    concluait donc au succès sur une écriture qui n'avait rien écrit.
 *
 * 2. LA PERTE DE DONNÉES PAR CHARGE PARTIELLE. Modifier le seul téléphone ne
 *    doit pas vider l'adresse.
 *
 * 3. LE CLOISONNEMENT. Un cabinet ne modifie pas l'identité d'un autre, et ne
 *    la lit pas non plus.
 *
 * 4. LA CHAÎNE COMPLÈTE. Ce qui est enregistré doit être ce que le générateur
 *    de contrats relit — pas une seconde copie.
 */
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { randomBytes } from "node:crypto"
import { createClient } from "@supabase/supabase-js"
import { readdirSync } from "node:fs"
import { exigerSupabase } from "./lib/environnement.mjs"
import { updateFirmSettingsAvec } from "../lib/data/parametres-cabinet.ts"
import { chargerContractantAvec } from "../lib/data/contractant-lecture.ts"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const env = Object.fromEntries(
  [...readFileSync(join(ROOT, ".env.local"), "utf8").matchAll(/^([A-Z0-9_]+)=(.*)$/gm)]
    .map((m) => [m[1], m[2].trim()])
)
exigerSupabase(env)

const url = env.NEXT_PUBLIC_SUPABASE_URL
const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const session = async (courriel, mdp) => {
  const c = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  const { error } = await c.auth.signInWithPassword({ email: courriel, password: mdp })
  if (error) throw new Error(`Connexion ${courriel} : ${error.message}`)
  return c
}

let echecs = 0
const verifier = (intitule, obtenu, attendu) => {
  const ok = String(obtenu) === String(attendu)
  if (!ok) echecs++
  console.log(`  ${ok ? "✓" : "✗"} ${intitule.padEnd(52)} ${String(obtenu).slice(0, 40)}` +
    (ok ? "" : `   ATTENDU ${attendu}`))
}

const marque = Date.now()
const mdp = "Epreuve-" + randomBytes(9).toString("base64url")
let cabinetA, cabinetB, userProprio, userMembre, userB, navigateur

const nouveauCabinet = async (suffixe, role = "owner") => {
  const courriel = `par-${suffixe}-${marque}@example.invalid`
  const { data: cab, error: e1 } = await admin.from("firms").insert({
    name: `Cabinet ${suffixe} ${marque}`,
    rcic_license_number: `R7${suffixe}${String(marque).slice(-5)}`,
    owner_name: "Épreuve", email: courriel, plan: "cabinet", status: "active",
  }).select("id").single()
  if (e1) throw new Error(`Cabinet ${suffixe} : ${e1.message}`)

  const { data: u, error: e2 } = await admin.auth.admin.createUser({
    email: courriel, password: mdp, email_confirm: true,
  })
  if (e2) throw new Error(`Compte ${suffixe} : ${e2.message}`)

  await admin.from("profiles").insert({
    firm_id: cab.id, user_id: u.user.id, email: courriel,
    full_name: `Membre ${suffixe}`, cicc_role: role, status: "active",
  })
  await admin.from("firm_subscriptions").insert({
    firm_id: cab.id, plan: "cabinet", cadence: "monthly", seats: 3,
    status: "active", stripe_customer_id: `cus_par_${suffixe}_${marque}`,
  })
  return { firmId: cab.id, userId: u.user.id, courriel, client: await session(courriel, mdp) }
}

/** Un membre supplémentaire dans un cabinet existant, avec le rôle voulu. */
const nouveauMembre = async (firmId, suffixe, role) => {
  const courriel = `par-m${suffixe}-${marque}@example.invalid`
  const { data: u } = await admin.auth.admin.createUser({
    email: courriel, password: mdp, email_confirm: true,
  })
  await admin.from("profiles").insert({
    firm_id: firmId, user_id: u.user.id, email: courriel,
    full_name: `Collaborateur ${suffixe}`, cicc_role: role, status: "active",
  })
  return { userId: u.user.id, client: await session(courriel, mdp) }
}

const ADRESSE = {
  name: "DGV Immigration",
  rcicName: "Adama Diarra",
  address: "123, rue Exemple",
  addressLine2: "Bureau 400",
  city: "Gatineau",
  province: "Québec",
  postalCode: "J8X 1A1",
  country: "Canada",
  phone: "819 555 0100",
  email: "infos@dgvimmigration.example",
  website: "www.dgvimmigration.example",
}

try {
  const A = await nouveauCabinet(1)
  const B = await nouveauCabinet(2)
  cabinetA = A.firmId; cabinetB = B.firmId
  userProprio = A.userId; userB = B.userId

  // -------------------------------------------------------------------------
  console.log("\nLe propriétaire enregistre son identité")
  // -------------------------------------------------------------------------
  const r = await updateFirmSettingsAvec(A.client, cabinetA, ADRESSE)
  verifier("l'enregistrement réussit", r.ok ? "ok" : r.message, "ok")

  const { data: lu } = await admin.from("firms")
    .select("name, owner_name, address, address_line2, city, province, postal_code, country, phone, email, website")
    .eq("id", cabinetA).single()

  // C'EST LE CONTRÔLE QUI COMPTE : la base, pas l'écran. Un formulaire dont
  // les champs restent remplis ne prouve rien — il peut relire une copie
  // gardée dans le navigateur.
  for (const [colonne, attendu] of [
    ["name", ADRESSE.name],
    ["owner_name", ADRESSE.rcicName],
    ["address", ADRESSE.address],
    ["address_line2", ADRESSE.addressLine2],
    ["city", ADRESSE.city],
    ["province", ADRESSE.province],
    ["postal_code", ADRESSE.postalCode],
    ["country", ADRESSE.country],
    ["phone", ADRESSE.phone],
    ["email", ADRESSE.email],
    ["website", ADRESSE.website],
  ]) {
    verifier(`  ${colonne} est en base`, lu[colonne], attendu)
  }

  // -------------------------------------------------------------------------
  console.log("\nUne écriture qui ne touche AUCUNE ligne doit ÉCHOUER (§10)")
  // -------------------------------------------------------------------------
  // La politique firms_owner_update exige is_firm_owner(). Un collaborateur
  // voit son UPDATE toucher zéro ligne — et PostgREST ne rend AUCUNE erreur.
  // L'action concluait donc au succès sur une écriture sans effet, et l'écran
  // annonçait « enregistré avec succès ».
  const collaborateur = await nouveauMembre(cabinetA, 1, "consultant")
  userMembre = collaborateur.userId

  const rRefus = await updateFirmSettingsAvec(collaborateur.client, cabinetA, {
    address: "999 rue du Détournement",
  })
  verifier("un collaborateur ne peut pas enregistrer", rRefus.ok ? "ACCEPTÉ" : "refusé", "refusé")
  verifier("et le refus est EXPLICITE", /droit|propriétaire/i.test(rRefus.message) ? "oui" : `NON (${rRefus.message})`, "oui")

  const { data: intact } = await admin.from("firms").select("address").eq("id", cabinetA).single()
  verifier("l'adresse n'a pas bougé", intact.address, ADRESSE.address)

  // -------------------------------------------------------------------------
  console.log("\nUne charge PARTIELLE ne vide pas le reste (§23)")
  // -------------------------------------------------------------------------
  const rPartiel = await updateFirmSettingsAvec(A.client, cabinetA, { phone: "819 555 0199" })
  verifier("modifier le seul téléphone réussit", rPartiel.ok ? "ok" : rPartiel.message, "ok")

  const { data: apresPartiel } = await admin.from("firms")
    .select("phone, address, address_line2, city, province, postal_code")
    .eq("id", cabinetA).single()
  verifier("le téléphone est à jour", apresPartiel.phone, "819 555 0199")
  verifier("l'adresse est INTACTE", apresPartiel.address, ADRESSE.address)
  verifier("le bureau est INTACT", apresPartiel.address_line2, ADRESSE.addressLine2)
  verifier("la ville est INTACTE", apresPartiel.city, ADRESSE.city)
  verifier("le code postal est INTACT", apresPartiel.postal_code, ADRESSE.postalCode)

  // -------------------------------------------------------------------------
  console.log("\nModifier remplace, et ne laisse pas l'ancienne valeur (§20)")
  // -------------------------------------------------------------------------
  await updateFirmSettingsAvec(A.client, cabinetA, {
    address: "456, rue Nouvelle", addressLine2: "Suite 500", city: "Québec",
  })
  const { data: apresModif } = await admin.from("firms")
    .select("address, address_line2, city").eq("id", cabinetA).single()
  verifier("la nouvelle adresse remplace l'ancienne", apresModif.address, "456, rue Nouvelle")
  verifier("le nouveau bureau aussi", apresModif.address_line2, "Suite 500")
  verifier("la nouvelle ville aussi", apresModif.city, "Québec")

  // Un champ facultatif VIDÉ doit repartir à NULL, pas rester à l'ancien : le
  // consultant qui efface son numéro de bureau demande à ce qu'il disparaisse
  // du contrat.
  await updateFirmSettingsAvec(A.client, cabinetA, { addressLine2: "" })
  const { data: apresVidage } = await admin.from("firms")
    .select("address_line2").eq("id", cabinetA).single()
  verifier("un champ facultatif vidé repart à NULL", apresVidage.address_line2, null)

  // -------------------------------------------------------------------------
  console.log("\nLa validation refuse l'invraisemblable sans brider l'étranger (§22)")
  // -------------------------------------------------------------------------
  const rCourriel = await updateFirmSettingsAvec(A.client, cabinetA, { email: "pas-un-courriel" })
  verifier("un courriel incomplet : REFUSÉ", rCourriel.ok ? "ACCEPTÉ" : "refusé", "refusé")

  const rCodeFR = await updateFirmSettingsAvec(A.client, cabinetA, { postalCode: "75008" })
  // Un cabinet peut exercer depuis l'étranger : refuser « 75008 » forcerait à
  // inventer un code canadien, qui s'imprimerait sur le contrat.
  verifier("un code postal étranger : ACCEPTÉ", rCodeFR.ok ? "accepté" : rCodeFR.message, "accepté")

  const rCodeFaux = await updateFirmSettingsAvec(A.client, cabinetA, { postalCode: "J8X 1" })
  verifier("un code canadien mal formé : REFUSÉ", rCodeFaux.ok ? "ACCEPTÉ" : "refusé", "refusé")

  // On remet une identité complète pour la suite.
  await updateFirmSettingsAvec(A.client, cabinetA, ADRESSE)

  // -------------------------------------------------------------------------
  console.log("\nCloisonnement entre cabinets (§18, §19)")
  // -------------------------------------------------------------------------
  await updateFirmSettingsAvec(B.client, cabinetB, {
    ...ADRESSE, name: "Cabinet Boréale", address: "77 boulevard Nord", city: "Montréal",
  })

  const { data: vuParA } = await A.client.from("firms").select("id, name").eq("id", cabinetB)
  verifier("A ne voit pas l'identité de B", (vuParA ?? []).length, 0)

  // A tente d'écrire chez B : la politique compare id à current_firm_id().
  const rIntrusion = await updateFirmSettingsAvec(A.client, cabinetB, { address: "Détourné" })
  verifier("A ne peut pas écrire chez B", rIntrusion.ok ? "ACCEPTÉ" : "refusé", "refusé")
  const { data: bIntact } = await admin.from("firms").select("address").eq("id", cabinetB).single()
  verifier("l'adresse de B est intacte", bIntact.address, "77 boulevard Nord")

  const { data: aFinal } = await admin.from("firms").select("address, city").eq("id", cabinetA).single()
  verifier("A garde la sienne", aFinal.address, ADRESSE.address)
  verifier("et sa ville", aFinal.city, ADRESSE.city)

  // -------------------------------------------------------------------------
  console.log("\nLe générateur de contrats relit CETTE source (§12, §16)")
  // -------------------------------------------------------------------------
  const { data: cl } = await admin.from("clients").insert({
    firm_id: cabinetA, name: "Awa Diallo", email: `awa-${marque}@example.invalid`,
    file_number: `DOS-P-${String(marque).slice(-6)}`, program: "Résidence permanente",
    status: "active", client_type: "individual", civility: "mrs",
    address: "12 rue du Client", city: "Laval", province: "Québec",
    postal_code: "H7N 1A1", country: "Canada",
  }).select("id").single()

  const source = await chargerContractantAvec(A.client, { firmId: cabinetA }, "client", cl.id)
  verifier("le contrat lit le nom du cabinet", source.cabinet.nom, ADRESSE.name)
  verifier("le consultant", source.cabinet.consultant, ADRESSE.rcicName)
  verifier("la rue", source.cabinet.adresse, ADRESSE.address)
  verifier("LE BUREAU", source.cabinet.adresseComplement, ADRESSE.addressLine2)
  verifier("la ville", source.cabinet.ville, ADRESSE.city)
  verifier("la province", source.cabinet.province, ADRESSE.province)
  verifier("le code postal", source.cabinet.codePostal, ADRESSE.postalCode)
  verifier("le pays", source.cabinet.pays, ADRESSE.country)
  verifier("le téléphone", source.cabinet.telephone, ADRESSE.phone)
  verifier("le courriel", source.cabinet.courriel, ADRESSE.email)
  verifier("le site web", source.cabinet.siteWeb, ADRESSE.website)

  // Et l'adresse composée pour le contrat porte tout, dans l'ordre.
  const { lignesAdresseCabinet } = await import("../lib/ententes/variables.ts")
  verifier("les lignes du bloc « consultant »",
    lignesAdresseCabinet(source.cabinet).join(" | "),
    "123, rue Exemple | Bureau 400 | Gatineau (Québec) J8X 1A1 | Canada")

  // -------------------------------------------------------------------------
  console.log("\nLa facture lit la MÊME source, pas une copie (§13)")
  // -------------------------------------------------------------------------
  const { data: pourFacture } = await A.client.from("firms")
    .select("name, address, phone, email, rcic_license_number, logo_url, payment_terms")
    .eq("id", cabinetA).single()
  verifier("la facture lit le même nom", pourFacture.name, ADRESSE.name)
  verifier("et la même rue", pourFacture.address, ADRESSE.address)
  // -------------------------------------------------------------------------
  console.log("\nDANS LE NAVIGATEUR : enregistrer, recharger, se reconnecter (§7, §8)")
  // -------------------------------------------------------------------------
  // « Le simple fait que les champs restent remplis avant le rechargement ne
  // constitue PAS une preuve que la sauvegarde fonctionne. » — le cahier des
  // charges a raison, et c'est exactement ce qui s'était produit : une copie
  // dans le navigateur redonnait l'illusion. On passe donc par l'écran.
  const magasin = join(ROOT, "node_modules/.pnpm")
  const pw = readdirSync(magasin).find((d) => /^playwright@/.test(d))
  const { chromium } = await import(join(magasin, pw, "node_modules/playwright/index.mjs"))
  const arg = process.argv.find((a) => a.startsWith("--url="))
  const BASE = (arg ? arg.slice(6) : "http://localhost:3000").replace(/\/+$/, "")

  navigateur = await chromium.launch({ channel: "chrome" })
  const contexte = await navigateur.newContext({ viewport: { width: 1440, height: 1200 } })
  const page = await contexte.newPage()

  const connexion = async () => {
    await page.goto(`${BASE}/fr/connexion`, { waitUntil: "domcontentloaded" })
    await page.waitForSelector('input[type="email"]', { timeout: 30000 })
    await page.fill('input[type="email"]', A.courriel)
    await page.fill('input[type="password"]', mdp)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/fr(\/|$)/, { timeout: 30000 }).catch(() => {})
    await page.waitForTimeout(2000)
  }

  const lireChamp = async (etiquette) => {
    const champ = page.locator(`label:text-is("${etiquette}")`).locator("xpath=following-sibling::*[1]")
    return (await champ.inputValue().catch(() => "")) ?? ""
  }

  await connexion()
  await page.goto(`${BASE}/fr/settings`, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(2500)

  // On saisit une valeur NEUVE, différente de celle qui est déjà en base :
  // relire l'ancienne ne prouverait rien.
  const rueEcran = `789, rue de l'Écran ${String(marque).slice(-4)}`
  const remplir = async (etiquette, valeur) => {
    const champ = page.locator(`label:text-is("${etiquette}")`).locator("xpath=following-sibling::*[1]")
    await champ.fill(valeur)
  }
  await remplir("Numéro et rue", rueEcran)
  await remplir("Appartement, bureau, unité", "Bureau 777")
  await remplir("Ville", "Sherbrooke")
  await page.locator('label:text-is("Province ou territoire")').locator("xpath=following-sibling::*[1]")
    .selectOption("Québec")
  await remplir("Code postal", "J1H 1A1")

  await page.getByRole("button", { name: /Enregistrer les Paramètres/i }).click()
  await page.waitForTimeout(3500)

  const bandeau = await page.locator('[role="alert"]').first().textContent().catch(() => null)
  if (bandeau) console.log("    MESSAGE COMPLET :", bandeau)
  verifier("aucun bandeau d'erreur après l'enregistrement", bandeau ? `ERREUR` : "aucun", "aucun")

  // Ce que la BASE en dit, immédiatement.
  const { data: apresEcran } = await admin.from("firms")
    .select("address, address_line2, city, province, postal_code").eq("id", cabinetA).single()
  verifier("la rue saisie est en base", apresEcran.address, rueEcran)
  verifier("le bureau saisi est en base", apresEcran.address_line2, "Bureau 777")
  verifier("la ville saisie est en base", apresEcran.city, "Sherbrooke")
  verifier("le code postal saisi est en base", apresEcran.postal_code, "J1H 1A1")

  // §7 — RECHARGEMENT COMPLET.
  await page.reload({ waitUntil: "domcontentloaded" })
  await page.waitForTimeout(2500)
  verifier("après rechargement : la rue", await lireChamp("Numéro et rue"), rueEcran)
  verifier("après rechargement : le bureau", await lireChamp("Appartement, bureau, unité"), "Bureau 777")
  verifier("après rechargement : la ville", await lireChamp("Ville"), "Sherbrooke")
  verifier("après rechargement : la province", await lireChamp("Province ou territoire"), "Québec")
  verifier("après rechargement : le code postal", await lireChamp("Code postal"), "J1H 1A1")

  // §8 — DÉCONNEXION puis RECONNEXION, dans un contexte NEUF : ni cookie, ni
  // stockage local. C'est le contrôle qu'une copie dans le navigateur ne peut
  // pas tromper.
  await contexte.close()
  const contexte2 = await navigateur.newContext({ viewport: { width: 1440, height: 1200 } })
  const page2 = await contexte2.newPage()
  await page2.goto(`${BASE}/fr/connexion`, { waitUntil: "domcontentloaded" })
  await page2.waitForSelector('input[type="email"]', { timeout: 30000 })
  // Le bouton reste DÉSACTIVÉ tant que le formulaire n'est pas hydraté : le
  // remplir trop tôt laissait React avec des champs vides, et le bouton ne
  // s'activait jamais. On attend qu'il le soit.
  await page2.waitForTimeout(1500)
  await page2.fill('input[type="email"]', A.courriel)
  await page2.fill('input[type="password"]', mdp)
  await page2.waitForFunction(
    () => !document.querySelector("button[type=submit]")?.hasAttribute("disabled"),
    { timeout: 30000 }
  )
  await page2.click('button[type="submit"]')
  await page2.waitForURL(/\/fr(\/|$)/, { timeout: 30000 }).catch(() => {})
  // La session doit être POSÉE avant de naviguer : sans cette pause, la page
  // suivante partait avant le cookie et retombait sur la connexion.
  await page2.waitForTimeout(2500)
  await page2.goto(`${BASE}/fr/settings`, { waitUntil: "domcontentloaded" })
  // On ATTEND le formulaire plutôt qu'un délai fixe : une reconnexion est plus
  // lente qu'un rechargement, et lire des champs absents rendait des chaînes
  // vides — un faux échec qui ressemble à une vraie perte de données.
  await page2.waitForSelector('label:text-is("Numéro et rue")', { timeout: 30000 })
  await page2.waitForTimeout(1500)
  console.log("    URL après reconnexion :", page2.url())

  const lire2 = async (etiquette) => {
    const champ = page2.locator(`label:text-is("${etiquette}")`).locator("xpath=following-sibling::*[1]")
    return (await champ.inputValue().catch(() => "")) ?? ""
  }
  verifier("après reconnexion : la rue", await lire2("Numéro et rue"), rueEcran)
  verifier("après reconnexion : le bureau", await lire2("Appartement, bureau, unité"), "Bureau 777")
  verifier("après reconnexion : la ville", await lire2("Ville"), "Sherbrooke")
  verifier("après reconnexion : le code postal", await lire2("Code postal"), "J1H 1A1")
} finally {
  if (navigateur) await navigateur.close()
  for (const id of [cabinetA, cabinetB]) if (id) await admin.from("firms").delete().eq("id", id)
  for (const id of [userProprio, userMembre, userB]) if (id) await admin.auth.admin.deleteUser(id)
  console.log("\nCabinets et comptes d'épreuve supprimés.")
}

console.log(echecs === 0 ? "\n✓ Paramètres du cabinet vérifiés, 0 échec." : `\n✗ ${echecs} échec(s).`)
process.exit(echecs === 0 ? 0 : 1)
