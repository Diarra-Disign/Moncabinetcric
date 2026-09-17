import { getTranslations } from "next-intl/server"
import { FileClock, History, MapPin } from "lucide-react"
import { Reveal } from "./reveal"
import { Section } from "./section"

/**
 * La bande de reassurance.
 *
 * ELLE REMPLACE DEUX SECTIONS. La page portait successivement une bande de
 * trois grandes statistiques (« 1 Clic », « SHA-256 », « Ajout seul ») puis une
 * section de quatre colonnes intitulee « Une assise reglementaire integree a
 * chaque etape » — soit sept blocs consacres a la conformite, dans quatre
 * teintes differentes (bleu, ambre, emeraude, ardoise). La conformite doit
 * soutenir la credibilite, pas occuper le tiers de la page.
 *
 * Il reste trois faits, tous verifiables dans le produit, sur une seule ligne,
 * en monochrome. La quatrieme colonne supprimee promettait « une tenue de
 * dossier strictement conforme aux exigences deontologiques du College » : une
 * affirmation que rien sur la page ne peut etayer, et que la ligne de
 * reassurance du heros disait deja.
 */
const FAITS = [
  { icone: History, cle: "t1" },
  { icone: FileClock, cle: "t2" },
  { icone: MapPin, cle: "t3" },
] as const

export async function AssuranceBand() {
  const t = await getTranslations("Landing.assurance")

  return (
    <Section fond="carte" className="py-16 sm:py-20">
      <Reveal>
        {/* Pas de cartes : trois colonnes separees par un filet sur grand
            ecran, par de l'espace sur petit. Encadrer chaque fait lui donnait
            un poids que le contenu ne justifie pas. */}
        {/* Une vraie liste, et des intitules qui ne sont PAS des titres de
            niveau 3 : la bande n'a pas de titre de section, donc trois `h3`
            ici sautaient directement du `h1` du heros au niveau 3. */}
        <ul className="grid gap-10 sm:grid-cols-3 sm:gap-8 lg:divide-x lg:divide-border">
          {FAITS.map(({ icone: Icone, cle }) => (
            <li key={cle} className="flex flex-col gap-3 lg:px-8 lg:first:pl-0 lg:last:pr-0">
              {/* Icone monochrome. Quatre pastilles pastel de couleurs
                  differentes alignees se lisaient comme des confettis. */}
              <span className="flex size-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Icone className="size-4.5" />
              </span>
              <p className="text-sm font-semibold text-foreground">{t(`${cle}Title`)}</p>
              <p className="text-sm leading-relaxed text-muted-foreground">{t(`${cle}Desc`)}</p>
            </li>
          ))}
        </ul>
      </Reveal>
    </Section>
  )
}
