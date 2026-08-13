#!/usr/bin/env node
/**
 * Éprouve l'onglet Signature du dossier, DANS UN VRAI NAVIGATEUR.
 *
 * POURQUOI CELUI-CI NE PEUT PAS ÊTRE UNE ÉPREUVE UNITAIRE : le défaut qu'il a
 * attrapé était une jointure ambiguë côté PostgREST. `signature_requests`
 * pointe deux fois vers `documents` — le document envoyé et le document signé
 * qui en naît — et sans le nom de la clé étrangère, la requête rendait `null`.
 *
 * Ni le compilateur, ni les 218 épreuves unitaires, ni les 136 contrôles du
 * socle ne pouvaient le voir : la demande existait bel et bien en base. Seul
 * l'écran mentait, en annonçant « Demande envoyée » puis « Aucune signature en
 * cours » deux lignes plus bas.
 *
 * Il crée un cabinet d'épreuve complet — dossier, client, contrat — envoie une
 * demande depuis l'écran, et vérifie ce que le consultant voit ensuite. Tout
 * est supprimé à la fin, même en cas d'échec.
 */
import { readFileSync, readdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { randomBytes, createHash } from "node:crypto"
import { createClient } from "@supabase/supabase-js"
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const env = Object.fromEntries([...readFileSync(join(ROOT,".env.local"),"utf8").matchAll(/^([A-Z0-9_]+)=(.*)$/gm)].map(m=>[m[1],m[2].trim()]))
const magasin = join(ROOT,"node_modules/.pnpm")
const pw = readdirSync(magasin).find(d=>/^playwright@/.test(d))
const { chromium } = await import(join(magasin, pw, "node_modules/playwright/index.mjs"))
const { PDFDocument, StandardFonts } = await import(join(magasin, readdirSync(magasin).find(d=>/^pdf-lib@/.test(d)), "node_modules/pdf-lib/cjs/index.js"))
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})
// Les captures ne sont écrites QUE si on donne un dossier : sans cela, le
// script en avait semé quatre dans un répertoire nommé « undefined ».
//   ./cric onglet-signature /tmp/captures
const S = process.argv[2] ?? null
const capturer = async (page, nom) => { if (S) await page.screenshot({ path: join(S, nom) }) }
const marque = Date.now(); const mdp = "Epreuve-"+randomBytes(9).toString("base64url")
let cab, uid, nav, echecs=0
const v=(i,o,a)=>{const ok=String(o)===String(a);if(!ok)echecs++;console.log(`  ${ok?"✓":"✗"} ${i.padEnd(46)} ${String(o).slice(0,30)}`+(ok?"":`   ATTENDU ${a}`))}
try {
  const courriel = `ong-${marque}@example.invalid`
  const { data:f } = await admin.from("firms").insert({
    name:"DGV Immigration", rcic_license_number:`R55${String(marque).slice(-5)}`,
    owner_name:"Adama Diarra", email:courriel, plan:"cabinet", status:"active",
  }).select("id").single(); cab=f.id
  await admin.from("firm_subscriptions").insert({firm_id:cab,plan:"cabinet",cadence:"monthly",seats:3,status:"active",stripe_customer_id:`cus_o_${marque}`})
  const { data:u } = await admin.auth.admin.createUser({email:courriel,password:mdp,email_confirm:true}); uid=u.user.id
  await admin.from("profiles").insert({firm_id:cab,user_id:uid,email:courriel,full_name:"Adama Diarra",cicc_role:"owner",status:"active"})
  const { data:cl } = await admin.from("clients").insert({
    firm_id:cab, name:"Jean Tremblay", first_name:"Jean", last_name:"Tremblay",
    email:`jt-${marque}@example.invalid`, file_number:`DOS-O-${String(marque).slice(-6)}`,
    program:"Permis de travail", status:"active", client_type:"individual",
  }).select("id").single()
  const { data:m } = await admin.from("matters").insert({
    firm_id:cab, client_id:cl.id, reference:`#DOS-${String(marque).slice(-5)}`,
    client_name:"Jean Tremblay", client_type:"b2c", program:"Permis de travail",
    category:"work", opened_date:new Date().toISOString().slice(0,10),
    rcic:"Adama Diarra", status:"valid", urgency_days:0, notes:"", is_priority:false,
  }).select("id, reference").single()

  const pdf = await PDFDocument.create(); const pg = pdf.addPage([595,842])
  const pol = await pdf.embedFont(StandardFonts.Helvetica)
  pg.drawText("CONTRAT DE SERVICES", { x:56, y:760, size:18, font:pol })
  const octets = Buffer.from(await pdf.save())
  const { data:doc } = await admin.from("documents").insert({
    firm_id:cab, client_id:cl.id, matter_id:m.id, name:"Contrat de services.pdf",
    type:"Entente de service", category:"contract", uploaded_by:"Adama Diarra",
    source:"cabinet", status:"valid", mime_type:"application/pdf", size_bytes:octets.length,
  }).select("id").single()
  const chemin = `${cab}/${cl.id}/${doc.id}/contrat.pdf`
  await admin.storage.from("documents").upload(chemin, octets, {contentType:"application/pdf", upsert:true})
  await admin.from("documents").update({storage_path:chemin, sha256:createHash("sha256").update(octets).digest("hex")}).eq("id", doc.id)

  nav = await chromium.launch({channel:"chrome"})
  const page = await (await nav.newContext({viewport:{width:1440,height:1100}})).newPage()
  await page.goto("http://localhost:3000/fr/connexion",{waitUntil:"domcontentloaded"})
  await page.waitForSelector('input[type="email"]',{timeout:30000}); await page.waitForTimeout(1500)
  await page.fill('input[type="email"]',courriel); await page.fill('input[type="password"]',mdp)
  await page.waitForFunction(()=>!document.querySelector("button[type=submit]")?.hasAttribute("disabled"),{timeout:30000})
  await page.click('button[type="submit"]'); await page.waitForURL(/\/fr(\/|$)/,{timeout:30000}).catch(()=>{})
  await page.waitForTimeout(2500)
  // Le dossier se retrouve par sa RÉFÉRENCE, pas par son identifiant : c'est
  // la convention des adresses du produit.
  await page.goto(`http://localhost:3000/fr/matters/${encodeURIComponent(m.reference)}`,{waitUntil:"domcontentloaded"})
  await page.waitForTimeout(3500)

  await capturer(page, "onglet-dossier.png")
  console.log("    URL :", page.url())
  // Le bandeau d'onglets emploie des <button aria-selected> : ils ne prennent
  // pas le rôle « tab » pour autant. On vise donc le texte, dans le bandeau.
  const onglet = page.locator('button[aria-selected]').filter({hasText:/^Signature$/}).first()
  v("l'onglet Signature existe", await onglet.count()>0?"oui":"NON","oui")
  if (await onglet.count() === 0) throw new Error("onglet absent — voir onglet-dossier.png")
  await onglet.click(); await page.waitForTimeout(2500)
  await capturer(page, "onglet-vide.png")
  v("il annonce l'état vide", await page.getByText(/Aucune signature en cours/).count()>0?"oui":"NON","oui")

  await page.getByRole("button",{name:/Envoyer pour signature/}).first().click()
  await page.waitForTimeout(2000)
  await capturer(page, "onglet-envoi.png")
  v("la fenêtre d'envoi s'ouvre", await page.getByText(/Le document sera verrouillé/).count()>0?"oui":"NON","oui")
  // Le consultant est proposé d'office, en second : c'est l'oubli le plus fréquent.
  v("le consultant est proposé d'office",
    await page.locator('input[type="email"]').filter({hasNot:page.locator('[type="password"]')}).nth(1).inputValue()===courriel?"oui":"NON","oui")

  await page.locator("#doc-signature").selectOption({label:"Contrat de services.pdf"})
  await page.locator('input[placeholder="courriel@exemple.com"]').first().fill(`jt-${marque}@example.invalid`)
  await page.getByRole("button",{name:/^Envoyer pour signature$/}).last().click()
  await page.waitForTimeout(5000)
  await capturer(page, "onglet-envoye.png")

  const { data:dem } = await admin.from("signature_requests").select("id, status").eq("firm_id",cab)
  v("une demande est créée", (dem??[]).length, 1)
  v("elle est envoyée", dem?.[0]?.status, "sent")
  const { data:dest } = await admin.from("signature_recipients").select("role, rank, rcic_number").eq("request_id", dem[0].id).order("rank")
  v("deux signataires", (dest??[]).length, 2)
  v("le client d'abord", dest?.[0]?.role, "client")
  v("le consultant ensuite", dest?.[1]?.role, "consultant")
  v("avec son PERMIS", (dest?.[1]?.rcic_number ?? "").startsWith("R55")?"oui":"NON","oui")
  const { data:docApres } = await admin.from("documents").select("locked_at").eq("id",doc.id).single()
  v("le document est VERROUILLÉ par l'envoi", docApres.locked_at?"oui":"NON","oui")
  v("l'onglet montre la demande", await page.getByText(/Contrat de services\.pdf/).count()>0?"oui":"NON","oui")
} finally {
  if(nav) await nav.close()
  if(cab) await admin.rpc("purger_cabinet_epreuve", { p_firm_id: cab })
  if(uid) await admin.auth.admin.deleteUser(uid)
}
console.log(echecs===0?"\n✓ Onglet vérifié, 0 échec.":`\n✗ ${echecs} échec(s).`)
process.exit(echecs===0?0:1)
