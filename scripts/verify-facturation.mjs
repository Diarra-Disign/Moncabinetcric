#!/usr/bin/env node
/**
 * Éprouve la facturation contre la base réelle.
 *
 * Le défaut corrigé n'était visible d'aucune façon depuis l'écran : une
 * facture de 747,37 $ ayant reçu 200 $ s'annonçait « payée », parce que le
 * total vivait à deux endroits — les lignes, et une colonne restée à zéro.
 * Un chiffre faux qui rassure ne se signale jamais tout seul.
 */
import { runSql } from "./apply-migration.mjs"

let echecs = 0
const verifier = (intitule, obtenu, attendu) => {
  const ok = String(obtenu) === String(attendu)
  if (!ok) echecs++
  console.log(`  ${ok ? "✓" : "✗"} ${intitule.padEnd(48)} ${String(obtenu).slice(0, 30)}` +
    (ok ? "" : `   ATTENDU ${attendu}`))
}

const id = "00000000-0000-0000-0000-0000000000cc"
try {
  await runSql(`delete from public.firms where id='${id}';`)
  await runSql(`insert into public.firms (id,name,rcic_license_number,owner_name,email,plan,status)
    values ('${id}','Zenith Épreuve','R000333','X','x@example.invalid','cabinet','active');`)
  const c = await runSql(`insert into public.clients (firm_id,name,email,file_number,program,status,client_type)
    values ('${id}','Awa','a@example.invalid','C-1','PE','active','individual') returning id;`)
  const m = await runSql(`insert into public.matters (firm_id,client_id,reference,client_name,client_type,program,category,rcic,status)
    values ('${id}','${c[0].id}','ZEN-2026-00001','Awa','b2c','PE','study','X','pending') returning id;`)

  const num = (await runSql(`select public.next_invoice_number('${id}') as n;`))[0].n
  const inv = (await runSql(`insert into public.invoices (firm_id,client_id,matter_id,invoice_number,client_name,amount,date,status,due_on)
    values ('${id}','${c[0].id}','${m[0].id}','${num}','Awa',0,current_date,'issued',current_date+14) returning id;`))[0].id

  console.log("\nLe montant suit les lignes, il ne se saisit plus")
  verifier("facture sans ligne : montant intact", (await runSql(`select amount from public.invoices where id='${inv}';`))[0].amount, "0.00")

  await runSql(`insert into public.invoice_lines (firm_id,invoice_id,description,quantity,unit_price,position) values
    ('${id}','${inv}','Consultation initiale en immigration',1,150,1),
    ('${id}','${inv}','Analyse du dossier',1,500,2);`)

  const t = (await runSql(`select * from public.invoice_totals('${inv}');`))[0]
  verifier("sous-total", t.sous_total, "650.00")
  verifier("TPS", t.tps, "32.50")
  verifier("TVQ", t.tvq, "64.87")
  verifier("total", t.total, "747.37")
  verifier("amount a suivi les lignes", (await runSql(`select amount from public.invoices where id='${inv}';`))[0].amount, "747.37")

  console.log("\nLe statut suit les paiements, et dit la vérité")
  verifier("sans paiement : émise", (await runSql(`select public.invoice_status('${inv}') as s;`))[0].s, "issued")

  await runSql(`insert into public.payments (firm_id,client_id,matter_id,invoice_id,amount,paid_on,method,destination)
    values ('${id}','${c[0].id}','${m[0].id}','${inv}',200,current_date,'bank_transfer','business');`)
  verifier("acompte de 200 sur 747,37 : PARTIELLE", (await runSql(`select public.invoice_status('${inv}') as s;`))[0].s, "partial")

  await runSql(`insert into public.payments (firm_id,client_id,matter_id,invoice_id,amount,paid_on,method,destination)
    values ('${id}','${c[0].id}','${m[0].id}','${inv}',547.37,current_date,'bank_transfer','business');`)
  verifier("solde réglé : payée", (await runSql(`select public.invoice_status('${inv}') as s;`))[0].s, "paid")

  console.log("\nUn changement de taux déplace les factures non closes")
  await runSql(`update public.firms set tax_qst_rate = 0.10 where id='${id}';`)
  const inv2 = (await runSql(`insert into public.invoices (firm_id,client_id,matter_id,invoice_number,client_name,amount,date,status)
    values ('${id}','${c[0].id}','${m[0].id}','${(await runSql(`select public.next_invoice_number('${id}') as n;`))[0].n}','Awa',0,current_date,'draft') returning id;`))[0].id
  await runSql(`insert into public.invoice_lines (firm_id,invoice_id,description,quantity,unit_price,position)
    values ('${id}','${inv2}','Honoraires',1,1000,1);`)
  verifier("nouveau taux appliqué (5% + 10%)", (await runSql(`select amount from public.invoices where id='${inv2}';`))[0].amount, "1150.00")
  verifier("la facture PAYÉE n'a pas bougé", (await runSql(`select amount from public.invoices where id='${inv}';`))[0].amount, "747.37")

  console.log("\nUne ligne exonérée coexiste avec une ligne taxable")
  await runSql(`insert into public.invoice_lines (firm_id,invoice_id,description,quantity,unit_price,taxable,position)
    values ('${id}','${inv2}','Débours IRCC',1,500,false,2);`)
  const t2 = (await runSql(`select * from public.invoice_totals('${inv2}');`))[0]
  verifier("sous-total inclut le débours", t2.sous_total, "1500.00")
  verifier("la taxe ignore le débours", t2.tps, "50.00")

  console.log("\nLe résumé du dossier")
  const b = (await runSql(`select * from public.matter_billing_summary('${m[0].id}');`))[0]
  verifier("nombre de factures", b.nb_factures, 2)
  verifier("total payé", b.total_paye, "747.37")
} finally {
  await runSql(`delete from public.firms where id='${id}';`)
  console.log("\nCabinet d'épreuve supprimé.")
}
console.log(echecs === 0 ? "\n✓ Facturation vérifiée, 0 échec." : `\n✗ ${echecs} échec(s).`)
process.exit(echecs === 0 ? 0 : 1)
