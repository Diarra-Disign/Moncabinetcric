import { cn } from "@/lib/utils"

/**
 * Les primitives de rythme de la page publique.
 *
 * Elles existent pour une raison mesurable : l'ancienne page alternait `py-16`,
 * `py-20` et `py-24` d'une section a l'autre, et changeait de fond a CHAQUE
 * section — blanc, gris, blanc, gris. L'oeil lit cette alternance comme des
 * rayures, et plus rien ne ressort. Ici, une seule valeur d'espacement
 * vertical, et deux teintes de fond seulement, posees a dessein pour GROUPER
 * des sections plutot que pour les separer.
 *
 * `--shadow-elev-*` et les couleurs viennent de `app/globals.css` : la page
 * publique suit donc le theme du cabinet comme le reste du produit, alors
 * qu'elle etait jusqu'ici ecrite en `slate-*` et `blue-*` en dur.
 *
 * ─── UN SEUL GRIS ──────────────────────────────────────────────────────────
 *
 * La page d'origine employait quatre niveaux de gris — `slate-400`, `-500`,
 * `-600`, `-700` — la ou le systeme n'en definit qu'un, `--muted-foreground`.
 * La tentation est alors de le diluer (`text-muted-foreground/70`) pour
 * retrouver des niveaux. C'est un piege mesurable : `globals.css` a remonte ce
 * token a `#5B6980` EXPRES pour atteindre 5,56:1 sur blanc, et le diluer a
 * 70 % le ramene a 2,99:1 — sous le seuil AA de 4,5:1.
 *
 * La hierarchie du texte secondaire vient donc de la TAILLE et de la GRAISSE,
 * jamais de l'opacite. Aucun texte de cette page ne porte de modificateur
 * d'opacite sur sa couleur.
 */
export function Section({
  id,
  fond = "carte",
  filet = false,
  className,
  children,
}: {
  id?: string
  /** `carte` = blanc. `canevas` = le gris tres pale du produit. */
  fond?: "carte" | "canevas"
  /** Un filet d'un pixel en haut, quand deux sections de meme teinte se suivent. */
  filet?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      // `scroll-mt-20` : l'en-tete est fixe sur 4rem. Sans cette marge de
      // defilement, un lien d'ancrage depose la section SOUS l'en-tete et le
      // titre est invisible. C'etait le cas des cinq ancres du menu.
      className={cn(
        "w-full scroll-mt-20 py-20 sm:py-28",
        fond === "carte" ? "bg-card" : "bg-background",
        filet && "border-t border-border",
        className,
      )}
    >
      <div className="mx-auto w-full max-w-6xl px-6 lg:px-8">{children}</div>
    </section>
  )
}

/**
 * Le surtitre de section. La mise en majuscules est faite ICI, en CSS, et non
 * dans le fichier de traduction : une valeur ecrite « TARIFICATION » ne peut
 * plus etre affichee autrement, et certains lecteurs d'ecran epellent les
 * capitales lettre par lettre.
 */
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("text-xs font-semibold uppercase tracking-widest text-primary", className)}>
      {children}
    </p>
  )
}

export function SectionHeading({
  eyebrow,
  title,
  lead,
  centre = true,
}: {
  eyebrow?: string
  title: string
  lead?: string
  centre?: boolean
}) {
  return (
    <div className={cn("flex flex-col gap-4", centre && "mx-auto max-w-2xl text-center")}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      {/* `font-semibold` et non `font-extrabold` : a cette taille, c'est le
          corps du texte qui porte la voix, pas la graisse. Une graisse 800 sur
          un titre de 36 px crie — et crier est le premier signe d'un gabarit. */}
      <h2 className="text-2xl font-semibold tracking-tight text-foreground text-balance sm:text-3xl">
        {title}
      </h2>
      {lead ? (
        // `max-w-xl` plafonne la ligne autour de 65 caracteres. A `max-w-2xl`,
        // la mesure montait a 85 et l'oeil perdait le debut de ligne suivante.
        <p className={cn("text-sm leading-relaxed text-muted-foreground sm:text-base", centre && "mx-auto max-w-xl")}>
          {lead}
        </p>
      ) : null}
    </div>
  )
}
