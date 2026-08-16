#!/usr/bin/env node
/**
 * Éprouve ce qui se compose avant qu'un courriel parte.
 *
 * Deux sujets, réunis parce qu'ils partagent la même propriété : leurs défauts
 * ne se voient qu'À L'ENVOI, chez le fournisseur ou dans la boîte du
 * destinataire, quand il est trop tard pour les rattraper.
 *
 *   · L'EN-TÊTE « DE ». Mal formé, il fait refuser l'envoi alors que le
 *     questionnaire est déjà créé : le consultant croit avoir écrit à son
 *     client. Le piège principal est qu'EMAIL_FROM contient DÉJÀ un nom
 *     d'affichage — recoller celui du cabinet devant produirait
 *     « "Cabinet" <moncabinetcric <acces@…>> ».
 *
 *   · LES GABARITS DE LA DEMANDE DE DÉMONSTRATION, seuls du projet à composer
 *     avec du texte écrit par un inconnu.
 */
import { enTeteDe, adresseNonRoutable } from "../lib/email/send.ts"

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

// ---------------------------------------------------------------------------
// La garde contre les domaines réservés
// ---------------------------------------------------------------------------
//
// Les épreuves de ce dépôt créent des clients fictifs en @example.invalid et
// déclenchent les VRAIS envois. Le message partait, rebondissait, et le taux
// de rebond du domaine atteignait 54 % — au point que les courriels légitimes
// finissaient en indésirables chez Microsoft.
//
// Ces vérifications tiennent les deux côtés de la frontière : ce qui doit être
// retenu, et surtout ce qui ne doit JAMAIS l'être. Une garde trop large est
// pire que pas de garde du tout — elle avalerait en silence un courriel dû à
// un vrai client, et personne ne le saurait.

console.log("\nLes domaines réservés sont reconnus")
const retenu = (adresse) => verifier(adresse.padEnd(34), adresseNonRoutable(adresse) ? "retenu" : "EXPÉDIÉ", "retenu")
retenu("jt-1786@example.invalid")
retenu("client@quelquechose.test")
retenu("a@b.example")
retenu("root@localhost")
retenu("qui@example.com")
retenu("qui@sous.example.org")
retenu("avec-point-final@example.invalid.")
retenu("MAJUSCULES@EXAMPLE.INVALID")

console.log("\nUne adresse malformée ne part pas non plus")
retenu("")
retenu("sans-arobase")
retenu("@sans-partie-locale.com")

console.log("\nMAIS AUCUNE ADRESSE RÉELLE N'EST RETENUE")
const laisse = (adresse) => verifier(adresse.padEnd(34), adresseNonRoutable(adresse) ? "RETENU" : "expédié", "expédié")
laisse("infos@dgvimmigration.com")
laisse("diarrasf@outlook.fr")
laisse("acces@moncabinetcric.com")
laisse("confrere@cabinet.ca")
// Les pièges : un nom de domaine qui CONTIENT un mot réservé sans l'être.
laisse("qui@example.company")
laisse("qui@monexample.com")
laisse("qui@invalid-solutions.ca")
laisse("qui@test-immigration.qc.ca")
laisse("qui@localhost.ca")

// ---------------------------------------------------------------------------
// Les deux courriels de la demande de démonstration
// ---------------------------------------------------------------------------
//
// Ils se distinguent de tous les autres gabarits par un détail qui commande ces
// épreuves : LEUR CONTENU EST ÉCRIT PAR UN INCONNU. Les courriels de signature
// ou d'invitation composent avec des données déjà passées par une session et une
// politique RLS ; ceux-ci partent d'un formulaire public que n'importe qui
// remplit, y compris avec du HTML.
//
// Le pire cas n'est pas la mise en page abîmée : c'est le lien étranger glissé
// dans un message expédié depuis notre domaine, et signé par lui.

const { courrielAccuseDemande, courrielDemandeRecue } = await import("../lib/email/templates.ts")

const vrai = (intitule, condition) => verifier(intitule, condition ? "oui" : "NON", "oui")

const PIEGE = `<script>alert(1)</script><a href="https://mechant.example">clic</a>`

console.log("\nL'accusé au prospect neutralise ce qu'il reçoit")
{
  const { html } = courrielAccuseDemande({ langue: "fr", nom: PIEGE })
  vrai("la balise script est échappée", !html.includes("<script>") && html.includes("&lt;script&gt;"))
  vrai("le lien étranger est inerte", !html.includes(`href="https://mechant.example"`))

  const nu = courrielAccuseDemande({ langue: "fr", nom: "Dupont & Fils" })
  vrai("la version texte n'échappe rien", nu.texte.includes("Dupont & Fils") && !nu.texte.includes("&amp;"))
  vrai("le sujet reste lisible en boîte", !nu.sujet.includes("&amp;"))

  const en = courrielAccuseDemande({ langue: "en", nom: "Aline" })
  vrai("les deux langues diffèrent", nu.sujet !== en.sujet && en.html.includes("Hello Aline"))
}

console.log("\nL'avis à l'exploitant porte tout, et ne laisse rien s'échapper")
{
  const base = {
    nom: "Aline Tremblay",
    courriel: "aline@cabinet.example",
    langue: "fr",
    lienConsole: "https://moncabinetcric.com/fr/admin",
  }

  const complet = courrielDemandeRecue({
    ...base,
    cabinet: "Tremblay Immigration",
    telephone: "819-555-0123",
    message: "Nous sommes trois consultants.",
  })
  for (const attendu of [
    "Aline Tremblay",
    "aline@cabinet.example",
    "Tremblay Immigration",
    "819-555-0123",
    "Nous sommes trois consultants.",
  ]) {
    vrai(`« ${attendu} » présent des deux côtés`,
      complet.html.includes(attendu) && complet.texte.includes(attendu))
  }

  const hostile = courrielDemandeRecue({ ...base, nom: PIEGE, message: PIEGE })
  vrai("le nom et le message hostiles sont échappés tous deux",
    !hostile.html.includes("<script>") && hostile.html.split("&lt;script&gt;").length - 1 === 2)
  vrai("aucun lien étranger ne survit", !hostile.html.includes(`href="https://mechant.example"`))

  const creux = courrielDemandeRecue({ ...base, cabinet: "  ", telephone: null, message: "" })
  vrai("un cabinet blanc ne laisse pas de ligne vide", !creux.html.includes("Cabinet"))
  vrai("un téléphone absent non plus", !creux.html.includes("Téléphone"))
  vrai("l'absence de message est dite", creux.html.includes("Aucun message.") && creux.texte.includes("(aucun)"))

  verifier("le sujet nomme la personne et son cabinet", complet.sujet,
    "Demande de démonstration — Aline Tremblay — Tremblay Immigration")
  verifier("sans cabinet, le nom suffit", courrielDemandeRecue(base).sujet,
    "Demande de démonstration — Aline Tremblay")

  const anglais = courrielDemandeRecue({ ...base, langue: "en" })
  vrai("la langue de la demande est rapportée sans changer celle de l'avis",
    anglais.html.includes("anglais") && anglais.html.includes("Une demande de démonstration vient d'arriver"))
  vrai("le lien de console est celui qu'on donne",
    complet.html.includes(`href="https://moncabinetcric.com/fr/admin"`))
}

console.log(echecs === 0 ? "\n✓ Courriels vérifiés, 0 échec." : `\n✗ ${echecs} échec(s).`)
process.exit(echecs === 0 ? 0 : 1)
