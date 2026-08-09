import "server-only"

import { PDFDocument, type PDFForm } from "pdf-lib"

/**
 * Remplissage des formulaires officiels.
 *
 * ---------------------------------------------------------------------------
 * CE QUE CE MODULE NE FAIT PAS
 * ---------------------------------------------------------------------------
 * Il ne dessine aucun formulaire. IRCC refuse un formulaire qui n'est pas le
 * sien : reproduire une mise en page produirait un document d'apparence
 * correcte et juridiquement inutile, découvert au moment du refus — c'est-à-
 * dire des mois plus tard, aux frais du client.
 *
 * Le PDF officiel est ouvert tel qu'il a été publié, ses champs sont remplis,
 * et il est réenregistré. Rien d'autre.
 *
 * ---------------------------------------------------------------------------
 * LES NOMS DE CHAMPS SE RELÈVENT, ILS NE SE DEVINENT PAS
 * ---------------------------------------------------------------------------
 * Un formulaire d'IRCC porte des noms de champs internes du genre
 * `form1[0].Page1[0].Nom[0]`. Les écrire de mémoire remplirait la mauvaise
 * case en silence — un formulaire complet, lisible, et faux.
 *
 * `champsDuFormulaire()` les lit dans le fichier ; la correspondance est
 * ensuite établie une fois, contrôlée, et enregistrée en base.
 */

/** Un champ tel que le PDF le déclare. */
export interface ChampPdf {
  nom: string
  type: "texte" | "case" | "choix" | "liste" | "bouton" | "autre"
  /** Pour une case ou un choix : les valeurs que le PDF accepte. */
  options?: string[]
  lectureSeule: boolean
}

/**
 * Relève les champs remplissables d'un PDF.
 *
 * Un formulaire sans champ n'est pas remplissable : IRCC publie certains
 * documents en PDF plat, et il faut le savoir avant de promettre un
 * pré-remplissage plutôt que de le découvrir sur un dossier réel.
 */
export async function champsDuFormulaire(pdf: Uint8Array): Promise<ChampPdf[]> {
  const doc = await PDFDocument.load(pdf, { ignoreEncryption: true })
  const form = doc.getForm()

  return form.getFields().map((f) => {
    const type = f.constructor.name
    const nom = f.getName()

    const genre: ChampPdf["type"] =
      type === "PDFTextField" ? "texte"
      : type === "PDFCheckBox" ? "case"
      : type === "PDFRadioGroup" ? "choix"
      : type === "PDFDropdown" || type === "PDFOptionList" ? "liste"
      : type === "PDFButton" ? "bouton"
      : "autre"

    let options: string[] | undefined
    try {
      const avecOptions = f as unknown as { getOptions?: () => string[] }
      if (typeof avecOptions.getOptions === "function") options = avecOptions.getOptions()
    } catch {
      options = undefined
    }

    return { nom, type: genre, options, lectureSeule: f.isReadOnly() }
  })
}

export interface ResultatRemplissage {
  pdf: Uint8Array
  /** Champs effectivement écrits. */
  remplis: string[]
  /** Champs annoncés par la correspondance mais absents du PDF. */
  introuvables: string[]
  /** Clés de données attendues par la correspondance et absentes des données. */
  manquantes: string[]
}

/**
 * Remplit un PDF officiel à partir d'une correspondance et de données.
 *
 * `correspondance` va du NOM DE CHAMP DU PDF vers la clé de donnée :
 *   { "form1[0].Page1[0].NomFamille[0]": "client_nom" }
 *
 * Ce sens-là, et non l'inverse : un même renseignement peut alimenter
 * plusieurs cases d'un formulaire — un nom figure souvent en tête de chaque
 * page — et la clé serait alors dupliquée.
 *
 * Rien n'est inventé : une clé absente des données laisse la case VIDE et
 * revient dans `manquantes`. Remplir par un tiret ou par une chaîne vide
 * donnerait un formulaire qui a l'air complet.
 */
export async function remplirFormulaire(params: {
  pdf: Uint8Array
  correspondance: Record<string, string>
  donnees: Record<string, unknown>
  /** Fige le formulaire pour qu'il ne soit plus modifiable après signature. */
  aplatir?: boolean
}): Promise<ResultatRemplissage> {
  const doc = await PDFDocument.load(params.pdf, { ignoreEncryption: true })
  const form = doc.getForm()

  const remplis: string[] = []
  const introuvables: string[] = []
  const manquantes: string[] = []

  // La correspondance est confrontée au PDF AVANT toute donnée.
  //
  // Le premier jet ne signalait un champ introuvable que s'il y avait une
  // donnée à y écrire : une correspondance périmée pointant vers un champ
  // disparu passait inaperçue tant que la donnée manquait aussi. Or c'est
  // précisément le cas à détecter — IRCC révise ses formulaires, les noms de
  // champs changent, et une correspondance qui ne correspond plus doit se
  // dire, qu'on ait ou non de quoi la remplir.
  const presents = new Set(form.getFields().map((f) => f.getName()))

  for (const [champ, cle] of Object.entries(params.correspondance)) {
    if (!presents.has(champ)) {
      introuvables.push(champ)
      continue
    }

    const valeur = params.donnees[cle]
    if (valeur === undefined || valeur === null || valeur === "") {
      manquantes.push(cle)
      continue
    }

    if (!ecrireChamp(form, champ, valeur)) {
      // Le champ existe mais n'a accepté aucune écriture : type inattendu, ou
      // valeur refusée par une liste. Signalé comme introuvable plutôt que
      // compté comme rempli — un formulaire qui prétend l'être et ne l'est pas
      // est pire qu'un formulaire visiblement incomplet.
      introuvables.push(champ)
      continue
    }
    remplis.push(champ)
  }

  // Aplatir supprime l'interactivité : le document ne peut plus être modifié
  // dans un lecteur PDF. Indispensable avant signature — sans cela, le texte
  // signé et le texte affiché peuvent différer.
  if (params.aplatir) form.flatten()

  return { pdf: await doc.save(), remplis, introuvables, manquantes }
}

/** Écrit une valeur dans un champ, selon son type. Faux si le champ est absent. */
function ecrireChamp(form: PDFForm, nom: string, valeur: unknown): boolean {
  const texte = String(valeur)

  try {
    form.getTextField(nom).setText(texte)
    return true
  } catch {
    /* pas un champ texte */
  }

  try {
    const c = form.getCheckBox(nom)
    // Les cases d'un formulaire officiel se cochent sur des valeurs variées :
    // « Oui », « 1 », « true ». On accepte les trois plutôt que d'imposer la
    // nôtre, qui laisserait la case décochée sans erreur.
    if (["true", "1", "oui", "yes", "on", "x"].includes(texte.toLowerCase())) c.check()
    else c.uncheck()
    return true
  } catch {
    /* pas une case */
  }

  try {
    form.getRadioGroup(nom).select(texte)
    return true
  } catch {
    /* pas un groupe de choix */
  }

  try {
    form.getDropdown(nom).select(texte)
    return true
  } catch {
    /* pas une liste */
  }

  return false
}
