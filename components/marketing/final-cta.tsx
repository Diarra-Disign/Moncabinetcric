import { getTranslations } from "next-intl/server"
import { Link } from "@/i18n/routing"
import { Button } from "@/components/ui/button"

/**
 * L'appel a l'action final.
 *
 * ELLE PERD SA TRAME DE POINTS ET SES TROIS COCHES. Le bloc portait un fond
 * `radial-gradient` en damier et, sous les boutons, trois mentions —
 * « Deploiement guide », « Sans engagement », « Donnees au Canada ». C'etait la
 * TROISIEME fois que la page annoncait l'hebergement canadien et l'absence
 * d'engagement : une fois sous le heros, une fois dans la bande de
 * reassurance, une fois ici.
 *
 * Elle devient une bande pleine largeur plutot qu'une carte arrondie flottant
 * dans une section rembourree : une page se termine mieux sur un bord franc.
 * `bg-foreground` / `text-background` la fait suivre le theme du cabinet, la
 * ou `bg-slate-950` etait fige.
 */
export async function FinalCta() {
  const t = await getTranslations("Landing.finalCta")

  return (
    <section className="w-full bg-foreground py-20 text-background sm:py-28">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-6 text-center lg:px-8">
        <h2 className="max-w-2xl text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          {t("title")}
        </h2>
        <p className="mt-5 max-w-xl text-sm leading-relaxed text-background/70 sm:text-base">
          {t("subtitle")}
        </p>

        <div className="mt-9 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
          <Button asChild size="lg">
            <Link href="/demo">{t("ctaPrimary")}</Link>
          </Button>
          {/* La variante `outline` est calibree pour un fond clair
              (`border-border bg-background`). Sur fond sombre, elle est
              renversee ici plutot que dans la primitive partagee : le bouton
              de l'application n'a pas a connaitre ce cas. */}
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-background/25 bg-transparent text-background hover:bg-background/10 hover:text-background"
          >
            <Link href="/connexion">{t("ctaSecondary")}</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
