import { getTranslations } from "next-intl/server"
import { Link } from "@/i18n/routing"
import { AnchorLink } from "./anchor-link"

const ANCRES = [
  { id: "apercu", cle: "overview" },
  { id: "fideicommis", cle: "trust" },
  { id: "features", cle: "features" },
  { id: "pricing", cle: "pricing" },
  { id: "faq", cle: "faq" },
] as const

/**
 * Le pied de page.
 *
 * LE LIEN « PORTAIL CLIENT » A ETE RETIRE. Il pointait vers `/portal`, qui
 * n'est pas dans la liste blanche de `proxy.ts` : un visiteur anonyme qui
 * cliquait dessus etait renvoye vers `/connexion?suivant=/fr/portal`. Un lien
 * de pied de page qui mene a un formulaire de mot de passe est un cul-de-sac,
 * et le seul lien du pied qui en produisait un. « Espace cabinet » couvre le
 * besoin depuis l'en-tete.
 *
 * LA MENTION « CONFORME COLLEGE CICC » A ETE RETIREE. Une auto-declaration de
 * conformite dans un pied de page n'engage personne et n'informe personne ;
 * les trois faits verifiables de la bande de reassurance font le travail.
 *
 * Les libelles juridiques viennent du catalogue `Legal`, comme avant : ce sont
 * les titres reels des documents servis par `/conditions` et
 * `/confidentialite`, et non des copies qui pourraient en divergent.
 */
export async function MarketingFooter() {
  const t = await getTranslations("Landing.footer")
  const tNav = await getTranslations("Landing.nav")
  const tLegal = await getTranslations("Legal")
  const annee = String(new Date().getFullYear())

  return (
    <footer className="w-full border-t border-border bg-card py-14">
      <div className="mx-auto w-full max-w-6xl px-6 lg:px-8">
        <div className="flex flex-col gap-10 border-b border-border pb-10 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex max-w-sm flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex size-7 items-center justify-center rounded-lg bg-foreground text-xs font-semibold text-background">
                M
              </span>
              <span className="text-sm font-semibold tracking-tight text-foreground">
                moncabinetcric
              </span>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">{t("tagline")}</p>
          </div>

          {/* Les sept liens etaient repartis en deux colonnes sans rien qui
              explique le partage : l'oeil cherchait la logique et n'en trouvait
              pas. Deux groupes nommes, et la colonne devient une information. */}
          <nav aria-label={t("navLabel")} className="grid gap-10 sm:grid-cols-2 sm:gap-x-16">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground">
                {t("colProduct")}
              </p>
              <ul className="mt-4 flex flex-col gap-3">
                {ANCRES.map(({ id, cle }) => (
                  <li key={id}>
                    <AnchorLink
                      cible={id}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {tNav(cle)}
                    </AnchorLink>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground">
                {t("colLegal")}
              </p>
              <ul className="mt-4 flex flex-col gap-3">
                <li>
                  <Link
                    href="/confidentialite"
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {tLegal("privacy.title")}
                  </Link>
                </li>
                <li>
                  <Link
                    href="/conditions"
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {tLegal("terms.title")}
                  </Link>
                </li>
              </ul>
            </div>
          </nav>
        </div>

        <div className="flex flex-col items-center gap-2 pt-8 text-xs text-muted-foreground sm:flex-row sm:justify-between">
          {/* L'annee est passee en CHAINE. En nombre, `next-intl` la formate
              selon la locale et « 2026 » devient « 2 026 » en francais. */}
          <p>{t("rights", { annee })}</p>
          <p>{t("hosting")}</p>
        </div>
      </div>
    </footer>
  )
}
