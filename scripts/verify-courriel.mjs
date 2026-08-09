#!/usr/bin/env node
/**
 * Éprouve la fabrication de l'en-tête « De ».
 *
 * Un en-tête mal formé n'échoue qu'AU MOMENT DE L'ENVOI, chez le fournisseur,
 * et le questionnaire est alors déjà créé : le consultant croit avoir écrit à
 * son client. C'est donc une logique qu'il vaut mieux prendre en défaut ici.
 *
 * Le piège principal : EMAIL_FROM contient DÉJÀ un nom d'affichage. Recoller
 * celui du cabinet devant produirait « "Cabinet" <moncabinetcric <acces@…>> ».
 */
import { enTeteDe } from "../lib/email/send.ts"

let echecs = 0
const verifier = (intitule, obtenu, attendu) => {
  const ok = obtenu === attendu
  if (!ok) echecs++
  console.log(`  ${ok ? "✓" : "✗"} ${intitule.padEnd(46)} ${obtenu}` + (ok ? "" : `\n      ATTENDU ${attendu}`))
}

const essai = (from, nom) => {
  process.env.EMAIL_FROM = from
  return enTeteDe(nom)
}

console.log("\nL'adresse est isolée avant qu'on lui recolle un nom")
verifier("EMAIL_FROM déjà nommé",
  essai('moncabinetcric <acces@moncabinetcric.com>', "Diarra Global Visa"),
  '"Diarra Global Visa" <acces@moncabinetcric.com>')
verifier("EMAIL_FROM nu",
  essai("acces@moncabinetcric.com", "Diarra Global Visa"),
  '"Diarra Global Visa" <acces@moncabinetcric.com>')
verifier("EMAIL_FROM entre guillemets",
  essai('"moncabinetcric" <acces@moncabinetcric.com>', "Cabinet Test"),
  '"Cabinet Test" <acces@moncabinetcric.com>')

console.log("\nSans nom de cabinet, rien n'est touché")
verifier("nom absent",
  essai("moncabinetcric <acces@moncabinetcric.com>", null),
  "moncabinetcric <acces@moncabinetcric.com>")
verifier("nom vide ou blanc",
  essai("moncabinetcric <acces@moncabinetcric.com>", "   "),
  "moncabinetcric <acces@moncabinetcric.com>")

console.log("\nUne raison sociale hostile ne casse pas l'en-tête")
verifier("guillemet dans le nom",
  essai("acces@moncabinetcric.com", 'Cabinet "Le Meilleur"'),
  `"Cabinet 'Le Meilleur'" <acces@moncabinetcric.com>`)
verifier("chevrons dans le nom",
  essai("acces@moncabinetcric.com", "Cabinet <fictif>"),
  '"Cabinet <fictif>" <acces@moncabinetcric.com>')

console.log(echecs === 0 ? "\n✓ En-tête d'expédition vérifié, 0 échec." : `\n✗ ${echecs} échec(s).`)
process.exit(echecs === 0 ? 0 : 1)
