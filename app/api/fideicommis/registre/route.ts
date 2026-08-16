import { getRegistreMensuel } from "@/lib/data/trust"
import { getCurrentFirm } from "@/lib/supabase/session"
import type { LigneRegistreMensuel } from "@/lib/data/trust"

/**
 * Le registre mensuel en tableur.
 *
 * ─── POURQUOI UN CSV ET NON UN .XLSX ───────────────────────────────────────
 *
 * Excel, Numbers et LibreOffice ouvrent un CSV sans rien installer. Produire
 * un vrai classeur demanderait une dépendance de plus, sa chaîne de mises à
 * jour et sa surface d'attaque, pour un gain nul sur des colonnes de texte et
 * de nombres.
 *
 * ─── LE POINT-VIRGULE, ET LE BOM ───────────────────────────────────────────
 *
 * Deux détails décident si le fichier s'ouvre correctement au Québec :
 *
 *   · Excel en français attend le POINT-VIRGULE comme séparateur, la virgule
 *     étant déjà le séparateur décimal. Avec des virgules, tout atterrit dans
 *     une seule colonne.
 *   · Sans marque d'ordre d'octets, Excel lit le fichier en Latin-1 : « Awa
 *     Diallo » passe, « Tremblay » aussi, mais « Hélène » devient « HÃ©lÃ¨ne ».
 *     Trois octets règlent la question.
 *
 * ─── LA SÉCURITÉ D'UNE CELLULE ─────────────────────────────────────────────
 *
 * Un nom de client commençant par « = », « + », « - » ou « @ » est interprété
 * par le tableur comme une FORMULE. C'est une injection connue, et elle
 * traverse tout : le nom vient d'un formulaire, personne ne le relit, et le
 * fichier finit ouvert sur le poste du comptable du cabinet. On préfixe donc
 * d'une apostrophe, qui force le texte sans s'afficher.
 */

const SEPARATEUR = ";"

function cellule(valeur: string | number | null): string {
  const brut = valeur === null || valeur === undefined ? "" : String(valeur)
  // Neutralise l'interprétation en formule sans altérer la lecture humaine.
  const sur = /^[=+\-@\t\r]/.test(brut) ? `'${brut}` : brut
  return /[";\n\r]/.test(sur) ? `"${sur.replace(/"/g, '""')}"` : sur
}

const ligne = (cellules: (string | number | null)[]) =>
  cellules.map(cellule).join(SEPARATEUR)

export async function GET(request: Request) {
  const mois = new URL(request.url).searchParams.get("mois") ?? ""
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mois)) {
    return new Response("Mois invalide.", { status: 400 })
  }

  // Aucun cabinet n'est transmis par l'appelant : `getRegistreMensuel()` le
  // résout depuis la session, et la fonction SQL revérifie par
  // `peut_lire_cabinet()`. Il n'existe donc aucun paramètre par lequel
  // réclamer le registre d'un autre cabinet.
  const [registre, cabinet] = await Promise.all([
    getRegistreMensuel(mois),
    getCurrentFirm(),
  ])
  if (!registre) return new Response("Session expirée.", { status: 401 })

  const lignes: string[] = [
    ligne([cabinet.name || "", "", "", "", "", ""]),
    ligne(["Registre du compte client", mois, "", "", "", ""]),
    ligne([]),
    ligne(["Client", "Dernière transaction", "Ouverture", "Dépôts", "Retraits", "Solde"]),
    ...registre.lignes.map((l: LigneRegistreMensuel) =>
      ligne([
        l.clientNom,
        l.dernierMouvement ?? "",
        // Le point décimal, non la virgule : le séparateur de colonnes est
        // déjà le point-virgule, et un tableur francophone convertit de
        // lui-même. Une virgule décimale entre guillemets se lirait comme du
        // texte, et aucune somme ne serait possible.
        l.ouverture.toFixed(2),
        l.depots.toFixed(2),
        l.retraits.toFixed(2),
        l.cloture.toFixed(2),
      ])
    ),
    ligne([]),
    ligne([
      "Totaux", "",
      registre.totaux.ouverture.toFixed(2),
      registre.totaux.depots.toFixed(2),
      registre.totaux.retraits.toFixed(2),
      registre.totaux.cloture.toFixed(2),
    ]),
    ligne([]),
    ligne(["Total des fonds détenus pour les clients", "", "", "", "", registre.totaux.cloture.toFixed(2)]),
    ligne([]),
    ligne(["Outil de tenue de registre. Le consultant demeure responsable de ses obligations professionnelles."]),
  ]

  return new Response("﻿" + lignes.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="registre-compte-client-${mois}.csv"`,
      // Un état comptable ne se met pas en cache : le mois en cours change à
      // chaque écriture.
      "Cache-Control": "no-store",
    },
  })
}
