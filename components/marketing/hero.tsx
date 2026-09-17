import { getTranslations } from "next-intl/server"
import { Link } from "@/i18n/routing"
import { Button } from "@/components/ui/button"
import { AnchorLink } from "./anchor-link"

/**
 * Le premier ecran.
 *
 * CE QUI A CHANGE, ET POURQUOI
 *
 * · LE TITRE NE DISAIT PAS CE QU'EST LE PRODUIT. « L'excellence operationnelle
 *   pour cabinets d'immigration » decrit une ambition, pas un logiciel ; la
 *   variante generee ensuite — « L'application pensee pour la conformite CICC
 *   ET la gestion de cabinet » — reunissait deux idees par une conjonction, ce
 *   qui allonge sans clarifier. Le titre nomme maintenant les trois objets que
 *   la maquette montre juste en dessous : dossiers, echeances, fideicommis.
 *   Le heros et l'apercu racontent la meme chose, dans le meme ordre.
 *
 * · LA PASTILLE CLIGNOTANTE EST PARTIE. Un point vert anime (`animate-ping`)
 *   dans un cadre arrondi annoncait « Normes CICC & Cadre legal LIPR/RIPR ·
 *   Edition 2026 ». Trois informations, dont une — le millesime — ne dit rien
 *   a un visiteur. Elle est remplacee par un surtitre en texte simple qui fait
 *   le travail le plus utile de la page : nommer a qui elle s'adresse.
 *
 * · LA TRAME DE POINTS EST PARTIE. Un fond `radial-gradient` en damier est la
 *   signature visuelle des pages generees. L'espace blanc tient mieux le role.
 *
 * · LA LIGNE DE REASSURANCE NE FAISAIT QUE REPETER LA PASTILLE. Il n'en reste
 *   qu'une, et elle porte des faits verifiables plutot que l'adjectif
 *   « conforme ».
 *
 * Aucune apparition animee ici : animer le premier ecran retarde la lecture de
 * ce qui compte le plus.
 */
export async function Hero() {
  const t = await getTranslations("Landing.hero")

  return (
    <section className="w-full bg-card pt-32 pb-16 sm:pt-40 sm:pb-20">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-6 text-center lg:px-8">
        <p className="max-w-lg text-xs font-semibold uppercase tracking-widest text-primary text-balance">
          {t("eyebrow")}
        </p>

        {/* `text-balance` repartit les lignes au lieu de laisser un mot seul en
            derniere ligne — le defaut le plus visible d'un grand titre. */}
        <h1 className="mt-5 max-w-3xl text-3xl font-semibold tracking-tight text-foreground text-balance sm:text-4xl lg:text-5xl">
          {t("title")}
        </h1>

        <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          {t("subtitle")}
        </p>

        {/* Sur mobile, les deux actions occupent toute la largeur et
            l'action principale est au-dessus : c'est la zone du pouce. */}
        <div className="mt-9 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
          <Button asChild size="lg" className="shadow-elev-1 hover:shadow-elev-2">
            <Link href="/demo">{t("ctaPrimary")}</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <AnchorLink cible="apercu">{t("ctaSecondary")}</AnchorLink>
          </Button>
        </div>

        <p className="mt-8 text-xs text-muted-foreground">{t("trustLine")}</p>
      </div>
    </section>
  )
}
