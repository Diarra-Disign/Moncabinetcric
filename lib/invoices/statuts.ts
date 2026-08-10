import type { StatutFacture } from "@/lib/data/types"

/**
 * Le libellé et le ton d'un statut de facture.
 *
 * Extrait de la fiche dossier pour que l'écran du cabinet et le dossier ne
 * puissent plus diverger. Ils le pouvaient : l'écran global disait
 * « En attente » là où le dossier disait « Émise », pour la même facture — et
 * rien, dans le code, n'obligeait les deux listes à se ressembler.
 *
 * Les teintes viennent des jetons du système, jamais d'une couleur figée : le
 * cabinet peut choisir un thème sombre, où un fond clair porterait du texte
 * clair.
 */
export const STATUT_FACTURE: Record<StatutFacture, { texte: string; texteEn: string; ton: string }> = {
  draft:     { texte: "Brouillon",           texteEn: "Draft",           ton: "bg-muted text-muted-foreground" },
  issued:    { texte: "Émise",               texteEn: "Issued",          ton: "bg-primary/10 text-primary-strong" },
  partial:   { texte: "Partiellement payée", texteEn: "Partially paid",  ton: "bg-warning/15 text-warning-strong" },
  paid:      { texte: "Payée",               texteEn: "Paid",            ton: "bg-success/15 text-success-strong" },
  overdue:   { texte: "En retard",           texteEn: "Overdue",         ton: "bg-error/15 text-error-strong" },
  cancelled: { texte: "Annulée",             texteEn: "Cancelled",       ton: "bg-muted text-muted-foreground line-through" },
}

/** Le libellé dans la langue de l'écran, avec repli sur le code brut. */
export function libelleStatut(statut: string, langue: string): string {
  const s = STATUT_FACTURE[statut as StatutFacture]
  if (!s) return statut
  return langue === "en" ? s.texteEn : s.texte
}

export function tonStatut(statut: string): string {
  return STATUT_FACTURE[statut as StatutFacture]?.ton ?? "bg-muted text-muted-foreground"
}
