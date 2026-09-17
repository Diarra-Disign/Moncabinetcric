"use client"

import * as React from "react"
import { useTranslations } from "next-intl"
import { FolderOpen, Landmark, Search, ShieldCheck, User, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { VueDossiers, VueFideicommis, VuePortail } from "./preview-views"
import { Reveal } from "./reveal"
import { Section } from "./section"

/**
 * LA MAQUETTE PRODUIT.
 *
 * C'est l'objet le plus regarde de la page, et celui qui portait le plus de
 * defauts. Ce qui a ete corrige, dans l'ordre de gravite :
 *
 * 1. DES NOMS DE PERSONNES ET UN NUMERO DE COMPTE BANCAIRE. La version
 *    precedente affichait « A. Diarra, CRIC » dans la barre de titre,
 *    « Espace Candidat — Marie L. », « Passeport_Bio_Marie.pdf »,
 *    « Bail_Preuve_Vie_Commune.pdf », des mouvements de fideicommis nommes
 *    « A. Kone », « M. Dubois », « L. Zhang », et « Compte banque RBC #8821 ».
 *    Une page publique de logiciel d'immigration ne montre pas de personnes.
 *    Tout est desormais anonyme : une reference de dossier, un type de
 *    procedure, un type de piece.
 *
 * 2. UNE FAUSSE FENETRE DE NAVIGATEUR. Trois pastilles macOS qui changeaient
 *    de couleur au survol, et une barre d'adresse affichant un domaine qui
 *    n'existe pas (`moncabinetcric-app.ca`). Un domaine invente sur une page
 *    de vente coute plus de credibilite qu'il n'en rapporte. Le cadre est
 *    maintenant la barre de l'application elle-meme : on regarde le produit,
 *    pas une capture d'ecran de navigateur.
 *
 * 3. DES COMMANDES EN DOUBLE. Le rail de gauche et les onglets changeaient
 *    tous deux de module. Le rail est desormais du decor (`aria-hidden`), et
 *    les onglets sont la seule commande.
 *
 * 4. UN INDICATEUR QUI N'ETAIT PAS UN NOMBRE. Parmi quatre tuiles chiffrees,
 *    l'une affichait « A jour » en vert : la ligne de base des chiffres
 *    sautait, et la grille perdait son alignement. Les quatre tuiles portent
 *    maintenant un nombre.
 *
 * 5. DES POINTS CLIGNOTANTS PARTOUT. Cinq `animate-ping` et un `animate-pulse`
 *    dans un seul bloc. Ils attirent l'oeil sur du vide.
 *
 * Les pastilles de statut reprennent les tons exacts du produit
 * (`lib/invoices/statuts.ts`, `app/[locale]/(app)/matters/matters-client.tsx`) :
 * la maquette ressemble a l'application parce qu'elle en applique les regles.
 */

const MODULES = ["matters", "trust", "portal"] as const
type Module = (typeof MODULES)[number]

const ICONES: Record<Module, React.ElementType> = {
  matters: FolderOpen,
  trust: Landmark,
  portal: Users,
}

const VUES: Record<Module, React.ComponentType> = {
  matters: VueDossiers,
  trust: VueFideicommis,
  portal: VuePortail,
}

export function ProductPreview() {
  const t = useTranslations("Landing.preview")
  const [module, setModule] = React.useState<Module>("matters")

  return (
    <Section id="apercu" fond="canevas" filet>
      <Reveal>
        <figure className="m-0">
          <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-elev-3">
            <AppBar compte={t("accountLabel")} recherche={t("searchPlaceholder")} />

            <div className="flex gap-4 border-t border-border bg-background p-4 sm:p-5">
              <RailDecoratif actif={module} />

              <div className="flex min-w-0 flex-1 flex-col gap-4">
                <EnteteModule
                  textes={(m) => ({ titre: t(`${m}.title`), sousTitre: t(`${m}.subtitle`) })}
                  module={module}
                  onChange={setModule}
                  libelleOnglet={(m) => t(`${m}.tab`)}
                  libelleSelecteur={t("moduleSelector")}
                />

                {/* LES TROIS VUES SONT SUPERPOSEES DANS UNE MEME CELLULE.
                    Rendue seule, chaque vue imposait sa hauteur : la maquette
                    perdait 140 px en passant sur « Portail client » a 1280 px,
                    211 px a 375 px, et tout ce qui la suivait remontait sous le
                    doigt. Superposees, elles donnent a la cellule la hauteur de
                    la plus haute, a chaque largeur, sans valeur fixe.
                    `invisible` retire les vues inactives de la lecture d'ecran
                    et de la tabulation ; `inert` le garantit pour tout contenu
                    interactif qu'on y ajouterait. */}
                <div className="grid">
                  {MODULES.map((m) => {
                    const Vue = VUES[m]
                    const actif = m === module
                    return (
                      <div
                        key={m}
                        id={`panneau-${m}`}
                        role="tabpanel"
                        aria-labelledby={`onglet-${m}`}
                        inert={!actif}
                        className={cn(
                          "col-start-1 row-start-1 flex min-w-0 flex-col gap-3",
                          !actif && "invisible",
                        )}
                      >
                        <Vue />
                      </div>
                    )
                  })}
                </div>

                <p className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs text-muted-foreground">
                  <ShieldCheck className="size-4 shrink-0 text-success-strong" />
                  {t("footnote")}
                </p>
              </div>
            </div>
          </div>

          <figcaption className="mt-4 text-center text-xs text-muted-foreground">
            {t("caption")}
          </figcaption>
        </figure>
      </Reveal>
    </Section>
  )
}

/** La barre de l'application : marque, recherche, compte. Aucune adresse web. */
function AppBar({ compte, recherche }: { compte: string; recherche: string }) {
  return (
    <div className="flex h-14 items-center justify-between gap-4 px-4 sm:px-5">
      <div className="flex items-center gap-2.5">
        <span className="flex size-6 items-center justify-center rounded-lg bg-foreground text-xs font-semibold text-background">
          M
        </span>
        <span className="text-xs font-semibold tracking-tight text-foreground">moncabinetcric</span>
      </div>

      {/* Un champ de recherche en decor, pas un vrai champ : un champ reel
          capterait le focus au clavier pour ne rien faire. */}
      <div
        aria-hidden="true"
        className="hidden min-w-0 flex-1 max-w-xs items-center gap-2 rounded-xl border border-border bg-background px-3 py-1.5 md:flex"
      >
        <Search className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate text-xs text-muted-foreground">{recherche}</span>
        <kbd className="ml-auto rounded-md border border-border bg-card px-1.5 text-xs font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </div>

      <div className="flex items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <User className="size-3.5" />
        </span>
        <span className="hidden text-xs font-medium text-muted-foreground sm:inline">{compte}</span>
      </div>
    </div>
  )
}

/**
 * Le rail lateral de l'application, reduit a sa forme d'icones — exactement
 * comme la coque du produit sous 1024 px. C'est du decor : il reflete le module
 * actif mais ne le change pas, sinon il doublerait les onglets.
 */
function RailDecoratif({ actif }: { actif: Module }) {
  return (
    <div
      aria-hidden="true"
      className="hidden shrink-0 flex-col gap-1.5 rounded-xl border border-border bg-card p-1.5 md:flex"
    >
      {MODULES.map((m) => {
        const Icone = ICONES[m]
        return (
          <span
            key={m}
            className={cn(
              "flex size-9 items-center justify-center rounded-lg transition-colors",
              m === actif ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            <Icone className="size-4" />
          </span>
        )
      })}
    </div>
  )
}

/**
 * Titre du module et selecteur d'onglets.
 *
 * Le motif ARIA complet est implemente — `tablist` / `tab` / `tabpanel`, focus
 * mobile et fleches directionnelles — parce qu'un `role="tab"` sans navigation
 * au clavier promet a un lecteur d'ecran un comportement qui n'existe pas. La
 * version precedente declarait les roles sans les honorer.
 */
function EnteteModule({
  textes,
  module,
  onChange,
  libelleOnglet,
  libelleSelecteur,
}: {
  textes: (m: Module) => { titre: string; sousTitre: string }
  module: Module
  onChange: (m: Module) => void
  libelleOnglet: (m: Module) => string
  libelleSelecteur: string
}) {
  const onglets = React.useRef<(HTMLButtonElement | null)[]>([])

  const surTouche = (event: React.KeyboardEvent, index: number) => {
    const deplacements: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: MODULES.length - 1,
    }
    const suivant = deplacements[event.key]
    if (suivant === undefined) return
    event.preventDefault()
    const cible = (suivant + MODULES.length) % MODULES.length
    onChange(MODULES[cible])
    onglets.current[cible]?.focus()
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 lg:flex-row lg:items-center lg:justify-between">
      {/* Meme superposition que les vues : un sous-titre plus long passait
          sur deux lignes pour un module et une seule pour l'autre, et
          l'en-tete changeait de hauteur a son tour. */}
      <div className="grid min-w-0">
        {MODULES.map((m) => (
          <div
            key={m}
            className={cn("col-start-1 row-start-1 min-w-0", m !== module && "invisible")}
          >
            {/* Volontairement un `p` et non un `h3` : c'est l'en-tete d'un ecran
                illustre a l'interieur d'une `figure`, pas une section du document.
                En `h3`, il s'inserait dans le plan de la page entre le `h1` du
                heros et le premier `h2`. */}
            <p className="truncate text-sm font-semibold text-foreground">{textes(m).titre}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {textes(m).sousTitre}
            </p>
          </div>
        ))}
      </div>

      {/* Sous 1024 px la bande d'onglets defile horizontalement plutot que de
          comprimer trois libelles jusqu'a l'illisible. */}
      <div
        role="tablist"
        aria-label={libelleSelecteur}
        className="-mx-1 flex shrink-0 items-center gap-1 overflow-x-auto rounded-xl bg-muted p-1 lg:mx-0"
      >
        {MODULES.map((m, index) => {
          const Icone = ICONES[m]
          const actif = m === module
          return (
            <button
              key={m}
              ref={(el) => {
                onglets.current[index] = el
              }}
              type="button"
              role="tab"
              id={`onglet-${m}`}
              aria-selected={actif}
              aria-controls={`panneau-${m}`}
              tabIndex={actif ? 0 : -1}
              onClick={() => onChange(m)}
              onKeyDown={(e) => surTouche(e, index)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                actif
                  ? "bg-card text-foreground shadow-elev-1"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icone className="size-3.5" />
              {libelleOnglet(m)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
