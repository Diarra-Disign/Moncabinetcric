"use client"

import * as React from "react"
import { useLocale, useTranslations } from "next-intl"
import { Menu, X } from "lucide-react"
import { Link, usePathname, useRouter } from "@/i18n/routing"
import { Button } from "@/components/ui/button"
import { AnchorLink } from "./anchor-link"
import { cn } from "@/lib/utils"

/**
 * Les ancres gardent les identifiants de l'ancienne page (`apercu`,
 * `fideicommis`, `features`, `pricing`, `faq`) : ils circulent deja dans des
 * liens partages, et les renommer les casserait sans rien apporter.
 */
const ANCRES = [
  { id: "apercu", cle: "overview" },
  { id: "fideicommis", cle: "trust" },
  { id: "features", cle: "features" },
  { id: "pricing", cle: "pricing" },
  { id: "faq", cle: "faq" },
] as const

/**
 * L'en-tete de la page publique.
 *
 * Trois manques reels de la version precedente sont corriges ici :
 *
 * 1. AUCUN MENU MOBILE. Le `<nav>` etait `hidden md:flex` sans rien derriere :
 *    sous 768 px, les cinq sections de la page etaient inatteignables.
 * 2. AUCUN SELECTEUR DE LANGUE. Le produit est bilingue par construction et
 *    la page publique n'offrait aucun moyen d'atteindre `/en`. Un visiteur
 *    anglophone arrivant sur `/fr` restait sur `/fr`.
 * 3. LES ANCRES TOMBAIENT SOUS L'EN-TETE. L'en-tete est fixe ; sans marge de
 *    defilement ni calcul de decalage, cliquer « Tarifs » cachait le titre.
 *
 * L'en-tete est transparent au repos et ne prend son fond translucide et son
 * filet qu'apres defilement : le premier ecran reste d'un seul tenant.
 *
 * ─── POURQUOI LES LIENS N'APPARAISSENT QU'A 1024 PX, ET NON A 768 ──────────
 *
 * Mesure faite a 834 px (iPad en portrait) : logo, cinq liens, bascule de
 * langue, « Espace cabinet » et le bouton de demonstration demandent environ
 * 920 px. A 834 px, « Espace cabinet » passait sur deux lignes et le bouton
 * sortait de l'ecran par la droite. Le defaut echappait au controle de
 * debordement horizontal parce qu'un element `fixed` ne fait pas grandir le
 * `scrollWidth` du document.
 *
 * Les liens passent donc en ligne a `lg` (1024 px), ou l'ensemble tient avec
 * une cinquantaine de pixels de reserve. Entre 640 et 1023 px, le menu porte
 * les liens et l'en-tete garde les deux actions.
 */
export function MarketingNav() {
  const t = useTranslations("Landing.nav")
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const [menuOuvert, setMenuOuvert] = React.useState(false)

  // `useSyncExternalStore` et non un effet : l'etat lu appartient au
  // navigateur, pas a React. Un effet devrait appeler `setState` des le
  // montage pour rattraper une page deja defilee — un rendu en cascade que
  // `react-hooks/set-state-in-effect` proscrit. React se contente ici de
  // relire l'instantane et n'engage un rendu que si le booleen change.
  const defile = React.useSyncExternalStore(
    (notifier) => {
      window.addEventListener("scroll", notifier, { passive: true })
      return () => window.removeEventListener("scroll", notifier)
    },
    () => window.scrollY > 8,
    () => false,
  )

  React.useEffect(() => {
    if (!menuOuvert) return
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOuvert(false)
    }
    window.addEventListener("keydown", surTouche)
    return () => window.removeEventListener("keydown", surTouche)
  }, [menuOuvert])

  const changerLangue = (cible: "fr" | "en") => {
    if (cible !== locale) router.replace(pathname, { locale: cible })
  }

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300",
        defile || menuOuvert
          ? "border-border bg-card/85 backdrop-blur-md"
          : "border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6 lg:px-8">
        <div className="flex items-center gap-8 xl:gap-10">
          <Link href="/" className="group flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-xl bg-foreground text-sm font-semibold text-background transition-colors group-hover:bg-primary">
              M
            </span>
            <span className="text-sm font-semibold tracking-tight text-foreground">
              moncabinetcric
            </span>
          </Link>

          <nav className="hidden items-center gap-6 lg:flex">
            {ANCRES.map(({ id, cle }) => (
              <AnchorLink
                key={id}
                cible={id}
                className="whitespace-nowrap text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {t(cle)}
              </AnchorLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <SelecteurLangue
            actif={locale}
            onChange={changerLangue}
            libelleGroupe={t("language")}
            labelFr={t("switchToFr")}
            labelEn={t("switchToEn")}
            className="hidden sm:flex"
          />

          <Link
            href="/connexion"
            className="hidden whitespace-nowrap text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline"
          >
            {t("login")}
          </Link>

          <Button asChild size="sm" className="hidden whitespace-nowrap sm:inline-flex">
            <Link href="/demo">{t("bookDemo")}</Link>
          </Button>

          <button
            type="button"
            onClick={() => setMenuOuvert((v) => !v)}
            aria-expanded={menuOuvert}
            aria-controls="menu-mobile"
            aria-label={menuOuvert ? t("closeMenu") : t("openMenu")}
            className="flex size-9 items-center justify-center rounded-xl text-foreground transition-colors hover:bg-muted lg:hidden"
          >
            {menuOuvert ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {menuOuvert ? (
        <div id="menu-mobile" className="border-t border-border bg-card lg:hidden">
          <nav className="mx-auto flex w-full max-w-6xl flex-col px-6 py-2">
            {ANCRES.map(({ id, cle }) => (
              <AnchorLink
                key={id}
                cible={id}
                onNavigate={() => setMenuOuvert(false)}
                className="border-b border-border/60 py-3.5 text-sm font-medium text-foreground last:border-0"
              >
                {t(cle)}
              </AnchorLink>
            ))}
            {/* Sous 640 px, la bascule de l'en-tete est masquee faute de place
                a cote du logo : sans cette ligne, un visiteur sur telephone
                n'avait aucun moyen d'atteindre la version anglaise. */}
            <div className="flex items-center justify-between gap-4 border-t border-border py-3 sm:hidden">
              <span className="text-sm font-medium text-foreground">{t("language")}</span>
              <SelecteurLangue
                actif={locale}
                onChange={(cible) => {
                  setMenuOuvert(false)
                  changerLangue(cible)
                }}
                libelleGroupe={t("language")}
                labelFr={t("switchToFr")}
                labelEn={t("switchToEn")}
                confortable
              />
            </div>
            <div className="flex flex-col gap-3 py-4 sm:hidden">
              <Button asChild size="lg">
                <Link href="/demo" onClick={() => setMenuOuvert(false)}>
                  {t("bookDemo")}
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/connexion" onClick={() => setMenuOuvert(false)}>
                  {t("login")}
                </Link>
              </Button>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  )
}

/**
 * Bascule FR / EN compacte.
 *
 * `components/app-shell/locale-switcher.tsx` fait le meme travail, mais son
 * apparence est ecrite en dur — `bg-slate-100`, `font-mono font-black`,
 * `rounded-2xl` — et calibree pour la barre du tableau de bord. Pose dans un
 * en-tete de 64 px il pese trop. La logique dupliquee tient en deux lignes
 * (`router.replace(pathname, { locale })`) ; le jour ou ce composant partage
 * acceptera une variante d'apparence, les deux se rejoindront.
 *
 * `confortable` agrandit les deux boutons a 44 px de haut pour le menu mobile,
 * ou ils se touchent au pouce ; la variante compacte reste celle de l'en-tete.
 *
 * `aria-pressed` et non `aria-current` : ce sont des boutons a bascule, et
 * `aria-current` est reserve a l'element courant d'une navigation.
 */
function SelecteurLangue({
  actif,
  onChange,
  libelleGroupe,
  labelFr,
  labelEn,
  confortable = false,
  className,
}: {
  actif: string
  onChange: (cible: "fr" | "en") => void
  libelleGroupe: string
  labelFr: string
  labelEn: string
  confortable?: boolean
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label={libelleGroupe}
      className={cn(
        "flex items-center rounded-full border border-border bg-muted",
        confortable ? "p-1" : "p-0.5",
        className,
      )}
    >
      {([
        ["fr", "FR", labelFr],
        ["en", "EN", labelEn],
      ] as const).map(([code, texte, label]) => (
        <button
          key={code}
          type="button"
          onClick={() => onChange(code)}
          aria-label={label}
          aria-pressed={actif === code}
          className={cn(
            "rounded-full font-medium transition-colors",
            confortable ? "h-11 min-w-14 px-4 text-sm" : "px-2.5 py-1 text-xs",
            actif === code
              ? "bg-card text-foreground shadow-elev-1"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {texte}
        </button>
      ))}
    </div>
  )
}
