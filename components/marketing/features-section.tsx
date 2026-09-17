import { getTranslations } from "next-intl/server"
import { FolderOpen, Landmark, Receipt, Users } from "lucide-react"
import { Reveal } from "./reveal"
import { Section, SectionHeading } from "./section"
import { VideoPresentation } from "./video-presentation"

const MODULES = [
  { icone: FolderOpen, cle: "f1" },
  { icone: Users, cle: "f2" },
  { icone: Landmark, cle: "f3" },
  { icone: Receipt, cle: "f4" },
] as const

/**
 * Les quatre modules.
 *
 * LES QUATRE MINI-MAQUETTES ONT ETE RETIREES. Chaque carte contenait un faux
 * widget de 176 px de haut : une barre de progression « Conformite des
 * passeports 100% Valide », un « Coffre-fort client SHA-256 », un « Registre
 * Fideicommis Ecart 0,00$ », un « Calculateur Exoneration ». Quatre interfaces
 * inventees, qui ne correspondent a aucun ecran du produit, placees juste sous
 * la vraie maquette. Elles faisaient exactement ce que la consigne interdit :
 * transformer la page en demonstration d'effets graphiques, et diluer le seul
 * visuel qui montre le produit reel.
 *
 * Reste ce qui informe : une icone, un titre de deux a quatre mots, une phrase.
 */
export async function FeaturesSection() {
  const t = await getTranslations("Landing.features")

  return (
    <Section id="features" fond="canevas">
      <Reveal>
        <SectionHeading
          eyebrow={t("sectionBadge")}
          title={t("sectionTitle")}
          lead={t("sectionSubtitle")}
        />
      </Reveal>

      {/* La video montre les modules S'ENCHAINER avant que les cartes les
          detaillent un par un. `max-w-4xl` : a pleine largeur, un 16:9 de
          1 100 px de large occupait l'ecran entier et ecrasait la section. */}
      <Reveal className="mx-auto mt-14 max-w-4xl sm:mt-16">
        <VideoPresentation />
      </Reveal>

      <Reveal className="mt-14 sm:mt-16">
        <div className="grid gap-5 sm:grid-cols-2">
          {MODULES.map(({ icone: Icone, cle }) => (
            // Aucun effet au survol : ces cartes ne sont pas cliquables. La
            // version precedente les faisait toutes monter de deux pixels au
            // passage de la souris, ce qui promet une interaction inexistante.
            <div
              key={cle}
              className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-elev-1 sm:p-8"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icone className="size-5" />
              </span>
              <div>
                <h3 className="text-base font-semibold tracking-tight text-foreground">
                  {t(`${cle}Title`)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {t(`${cle}Desc`)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Reveal>
    </Section>
  )
}
