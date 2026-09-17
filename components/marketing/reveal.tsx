import { cn } from "@/lib/utils"

/**
 * Apparition au défilement — la seule animation de la page.
 *
 * Composant SERVEUR : il n'expédie pas une ligne de JavaScript. Toute la
 * mécanique est dans `app/globals.css` (`.revelation`), confiée au moteur de
 * rendu par `animation-timeline: view()`.
 *
 * ─── POURQUOI PAS UN `IntersectionObserver` ────────────────────────────────
 *
 * C'était la première version, et elle avait un défaut que la capture pleine
 * page a révélé : chaque bloc naissait en `opacity: 0` et n'apparaissait qu'au
 * passage de l'observer. Tant que le JavaScript n'avait pas tourné, quatre
 * sections sur huit étaient rigoureusement invisibles — pour un visiteur au
 * réseau lent comme pour un robot d'indexation.
 *
 * La règle CSS est enveloppée dans `@supports` : là où le navigateur ne sait
 * pas animer au défilement, aucune règle n'est émise et le contenu est visible,
 * point. L'animation est décorative ; elle ne doit jamais conditionner la
 * lecture.
 *
 * Le heros en est volontairement dépourvu : animer le premier écran retarde la
 * perception de ce qui compte le plus.
 */
export function Reveal({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return <div className={cn("revelation", className)}>{children}</div>
}
