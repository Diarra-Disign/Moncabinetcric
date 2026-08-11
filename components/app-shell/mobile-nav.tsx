"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { Menu, SlidersHorizontal, X } from "lucide-react"
import { useTranslations } from "next-intl"
import { Link, usePathname } from "@/lib/i18n/routing"
import { cn } from "@/lib/utils"
import { MAIN_NAV, OTHER_NAV } from "./nav-items"
import { ThemePicker } from "./theme-picker"
import { LocaleSwitcher } from "./locale-switcher"

export function MobileNav() {
  const t = useTranslations("Navigation")
  const pathname = usePathname()
  const [isOpen, setIsOpen] = React.useState(false)

  // Le tiroir est posé dans <body>, et non là où ce composant est rendu.
  //
  // LA RAISON, ET ELLE EST INVISIBLE À LA LECTURE DU JSX
  // La barre supérieure porte `backdrop-blur-md`. Un `backdrop-filter` fait de
  // l'élément un BLOC CONTENEUR pour ses descendants en `position: fixed` — au
  // même titre qu'un `transform`. Le tiroir, rendu à l'intérieur de la barre,
  // voyait donc son `inset-0` résolu contre les 64 pixels de la barre, et non
  // contre l'écran.
  //
  // Ce qu'on obtenait : un panneau haut de 64 pixels montrant le logo et la
  // croix, sans un seul lien de navigation. Les quatorze liens étaient bien
  // dans le DOM — un contrôle automatisé les comptait — simplement rognés hors
  // d'un conteneur trop court. C'est le genre de défaut qu'aucune relecture de
  // ce fichier ne révèle : la cause est dans un AUTRE fichier, sur un élément
  // ancêtre, et elle porte sur un effet visuel dont personne n'attend qu'il
  // déplace un positionnement.
  //
  // Le portail rend le tiroir immunisé : posé sous <body>, aucun ancêtre ne
  // peut plus le contenir, quel que soit l'effet qu'on ajoutera un jour à la
  // barre.
  const monte = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )

  // Ferme le tiroir à chaque changement de page
  const prevPathname = React.useRef(pathname)
  React.useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname
      setIsOpen(false)
    }
  }, [pathname])

  // Ferme avec la touche Échap
  React.useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [isOpen])

  const renderGroup = (items: typeof MAIN_NAV, heading: string) => (
    <li>
      <div className="text-xs font-semibold leading-6 text-muted-foreground uppercase tracking-wider mb-2">
        {heading}
      </div>
      <ul role="list" className="-mx-2 space-y-1">
        {items.map((item) => {
          const isActive = pathname.startsWith(item.href)
          const Icon = item.icon
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  isActive
                    ? "bg-primary/10 text-primary-strong"
                    : "text-foreground hover:bg-muted",
                  "group flex gap-x-3 rounded-xl p-2 text-sm font-semibold leading-6 transition-colors"
                )}
              >
                <Icon
                  className={cn(
                    isActive ? "text-primary-strong" : "text-muted-foreground",
                    "h-5 w-5 shrink-0"
                  )}
                  aria-hidden="true"
                />
                {t(item.labelKey)}
              </Link>
            </li>
          )
        })}
      </ul>
    </li>
  )

  return (
    <>
      {/* `shrink-0` : la barre supérieure est un conteneur flexible, et sans
          lui ce bouton se comprimait avec le reste au lieu de garder ses
          quarante pixels. */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={t("openMenu")}
        aria-expanded={isOpen}
        className="lg:hidden -ml-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-foreground hover:bg-muted transition-colors"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      {isOpen && monte && createPortal(
        <div className="lg:hidden fixed inset-0 z-[200]">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("menu")}
            className="relative flex h-full w-72 max-w-[85vw] flex-col gap-y-5 overflow-y-auto border-r border-border bg-card px-6 pb-4 shadow-xl"
          >
            <div className="flex h-16 shrink-0 items-center justify-between">
              <div className="flex items-center gap-2 text-primary-strong font-bold text-xl tracking-tight">
                <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
                  M
                </div>
                moncabinetcric
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label={t("closeMenu")}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <nav className="flex flex-1 flex-col">
              <ul role="list" className="flex flex-1 flex-col gap-y-7">
                {renderGroup(MAIN_NAV, t("main"))}
                {renderGroup(OTHER_NAV, t("other"))}
              </ul>
            </nav>

            {/* Thème, langue et personnalisation des vues.
                Ils vivaient dans la barre supérieure, qui débordait de 74 à
                184 pixels selon le téléphone — et c'est le menu du membre,
                donc la déconnexion, qui en sortait. Retirés de la barre sous
                md, ils se retrouvent ici : un réglage qu'on masque sans le
                remettre ailleurs devient introuvable, ce qui est pire
                qu'encombré. */}
            <div className="mt-6 shrink-0 space-y-3 border-t border-border pt-4 md:hidden">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("preferences")}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <ThemePicker />
                <LocaleSwitcher />
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false)
                  window.dispatchEvent(new CustomEvent("cric_open_widgets_modal"))
                }}
                className="inline-flex w-full items-center gap-2 rounded-xl border border-border bg-muted/60 px-3 py-2.5 text-xs font-bold text-foreground transition-colors hover:bg-muted"
              >
                <SlidersHorizontal className="h-4 w-4 shrink-0 text-primary-strong" aria-hidden="true" />
                {t("customizeViews")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
