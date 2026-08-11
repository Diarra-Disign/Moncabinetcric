/**
 * La forme d'un questionnaire, et ce qui la rend valide.
 *
 * Ce fichier existe séparément de questionnaire-actions.ts pour une raison
 * mécanique : un module « use server » ne peut exporter que des fonctions
 * asynchrones. Une garde qu'on ne peut pas appeler depuis une épreuve finit
 * par n'être éprouvée qu'en production.
 */

/**
 * Les types de question que le formulaire public sait RÉELLEMENT rendre.
 *
 * « checkbox » figure dans l'union TypeScript mais n'a aucune branche dans
 * formulaire-public.tsx : il tomberait dans le cas générique et s'afficherait
 * comme une zone de texte libre. Un type qu'on accepte d'enregistrer et qu'on
 * ne sait pas afficher est un piège posé pour plus tard.
 *
 * Pour une question fermée, « radio » vaut mieux de toute façon : une case
 * décochée ne distingue pas « non » de « je n'ai pas répondu », et sur un
 * formulaire d'immigration cette différence est tout.
 */
export const TYPES_DE_QUESTION = ["text", "number", "date", "select", "radio", "file", "repeater"] as const

/**
 * Contrôle la structure d'un questionnaire avant de l'écrire.
 *
 * Cette garde vit ICI, et pas seulement dans l'éditeur, parce que c'est
 * l'action qui est la frontière — un écran n'est qu'une commodité, et cette
 * fonction reste appelable sans lui.
 *
 * Le contrôle qui compte est celui des clés. La réponse d'un client est rangée
 * sous la `key` de sa question : deux questions qui partagent une clé écrasent
 * leurs réponses l'une l'autre. À l'écran, cela ressemble à un client qui a
 * sauté une question — sur une pièce que le consultant transmettra à IRCC.
 */
export function verifierSections(brut: unknown): { ok: true; sections: unknown[] } | { ok: false; message: string } {
  if (!Array.isArray(brut)) return { ok: false, message: "La structure des sections est illisible." }

  const clesVues = new Map<string, string>()

  for (const [i, s] of brut.entries()) {
    if (!s || typeof s !== "object") return { ok: false, message: `La section ${i + 1} est illisible.` }
    const section = s as Record<string, unknown>
    const titre = String(section.titleFr ?? "").trim()
    if (!titre) return { ok: false, message: `La section ${i + 1} n'a pas de titre.` }

    const champs = section.fields
    if (!Array.isArray(champs)) return { ok: false, message: `« ${titre} » n'a pas de questions lisibles.` }

    for (const c of champs) {
      if (!c || typeof c !== "object") return { ok: false, message: `Une question de « ${titre} » est illisible.` }
      const champ = c as Record<string, unknown>
      const libelle = String(champ.labelFr ?? "").trim() || "sans libellé"
      const cle = String(champ.key ?? "").trim()

      if (!cle) return { ok: false, message: `La question « ${libelle} » n'a pas d'identifiant.` }

      // On nomme LES DEUX questions : savoir qu'il y a un doublon sans savoir
      // lequel oblige à relire tout le questionnaire.
      const dejaDans = clesVues.get(cle)
      if (dejaDans) {
        return {
          ok: false,
          message: `Deux questions portent le même identifiant « ${cle} » : « ${dejaDans} » et « ${libelle} ». ` +
            `La réponse à l'une effacerait l'autre.`,
        }
      }
      clesVues.set(cle, libelle)

      const type = String(champ.type ?? "")
      if (!(TYPES_DE_QUESTION as readonly string[]).includes(type)) {
        return { ok: false, message: `La question « ${libelle} » a un type inconnu : « ${type} ».` }
      }

      if ((type === "select" || type === "radio") && !(Array.isArray(champ.options) && champ.options.length > 0)) {
        return { ok: false, message: `La question « ${libelle} » propose un choix mais n'a aucune option.` }
      }
    }
  }

  return { ok: true, sections: brut }
}

