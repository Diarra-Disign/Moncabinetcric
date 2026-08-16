/**
 * Les bornes d'un mois, à partir de « AAAA-MM ».
 *
 * Module PUR, sans `server-only` et sans entrée-sortie : le sélecteur de mois
 * du registre est un composant client, et il a besoin des mêmes bornes que la
 * lecture serveur. Recopier ce calcul des deux côtés produirait, un jour, deux
 * mois de mai différents.
 *
 * ─── POURQUOI LE JOUR 0 DU MOIS SUIVANT ────────────────────────────────────
 *
 * `Date.UTC(a, m, 0)` désigne le dernier jour du mois `m` (les mois y sont
 * comptés à partir de zéro, donc `m` est déjà le mois suivant). C'est le
 * calendrier lui-même qui répond : longueurs de mois, années bissextiles, et
 * la règle des siècles — 2100 n'est pas bissextile bien que divisible par
 * quatre. Une table de longueurs écrite à la main se trompe sur ce dernier
 * point, et nulle part ailleurs avant.
 *
 * ─── POURQUOI UTC ──────────────────────────────────────────────────────────
 *
 * `new Date("2026-05-01")` est interprété en UTC, puis lu dans le fuseau
 * local : à Montréal il devient le 30 avril à 20 h. Le registre de mai
 * commencerait un jour trop tôt et emporterait la dernière écriture d'avril —
 * une erreur qui laisse les soldes cohérents entre eux, donc invisible à la
 * relecture.
 */
export function bornesDuMois(mois: string): { debut: string; fin: string } {
  const [annee, mensuel] = mois.split("-").map(Number)
  const dernier = new Date(Date.UTC(annee, mensuel, 0)).getUTCDate()
  return {
    debut: `${mois}-01`,
    fin: `${mois}-${String(dernier).padStart(2, "0")}`,
  }
}
