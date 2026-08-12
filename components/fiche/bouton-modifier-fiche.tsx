"use client"

import * as React from "react"
import { Pencil } from "lucide-react"
import { useRouter } from "@/i18n/routing"
import { ModifierFiche } from "./fiche-formulaire"
import { cn } from "@/lib/utils"

/**
 * Le bouton « Modifier » et la fenêtre qu'il ouvre.
 *
 * Il existe pour une raison précise : la page d'un dossier est un composant
 * SERVEUR, et ne peut donc pas tenir l'état d'une fenêtre. Sans cette enveloppe
 * il aurait fallu rendre la page entière cliente — ou, plus probablement,
 * écrire un troisième formulaire à cet endroit-là. C'est exactement ce que le
 * §8 interdit.
 *
 * Trois portes, un seul formulaire : Clients, Prospects, Dossier.
 */
export function BoutonModifierFiche({
  type,
  id,
  nomAffiche,
  libelle = "Modifier",
  className,
}: {
  type: "client" | "lead"
  id: string
  nomAffiche?: string
  libelle?: string
  className?: string
}) {
  const [ouvert, setOuvert] = React.useState(false)
  const router = useRouter()

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border",
          "text-xs font-bold text-foreground hover:bg-muted transition-colors cursor-pointer",
          className
        )}
      >
        <Pencil className="h-3.5 w-3.5 text-primary" />
        <span>{libelle}</span>
      </button>

      {ouvert && (
        <ModifierFiche
          type={type}
          id={id}
          nomAffiche={nomAffiche}
          onFerme={() => setOuvert(false)}
          // La page est rendue par le serveur : sans ce rafraîchissement, le
          // nom et l'adresse resteraient ceux d'avant jusqu'au prochain
          // chargement complet — et le consultant croirait l'enregistrement
          // perdu.
          onEnregistre={() => router.refresh()}
        />
      )}
    </>
  )
}
