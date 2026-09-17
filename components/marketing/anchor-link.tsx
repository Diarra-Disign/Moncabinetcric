"use client"

import * as React from "react"

/**
 * Un lien vers une ancre de la meme page, qui defile en douceur et respecte
 * `prefers-reduced-motion`.
 *
 * Il existe pour que l'en-tete ET le heros se comportent pareil. Le depot
 * n'active `scroll-behavior: smooth` nulle part, et l'activer sur `html`
 * changerait le comportement de toute l'application pour le besoin d'une seule
 * page. `scrollIntoView` honore `scroll-margin-top`, donc la marge posee par
 * `<Section>` suffit a placer le titre sous l'en-tete fixe.
 */
export function AnchorLink({
  cible,
  onNavigate,
  className,
  children,
}: {
  /** L'identifiant de la section, sans le dièse. */
  cible: string
  onNavigate?: () => void
  className?: string
  children: React.ReactNode
}) {
  const cliquer = (event: React.MouseEvent<HTMLAnchorElement>) => {
    onNavigate?.()
    const element = document.getElementById(cible)
    if (!element) return
    event.preventDefault()
    const reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    element.scrollIntoView({ behavior: reduit ? "auto" : "smooth", block: "start" })
  }

  return (
    <a href={`#${cible}`} onClick={cliquer} className={className}>
      {children}
    </a>
  )
}
