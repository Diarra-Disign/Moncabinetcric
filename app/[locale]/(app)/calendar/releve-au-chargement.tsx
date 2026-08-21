"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { releverCalendly } from "@/lib/data/calendly-actions"

/**
 * Va chercher chez Calendly ce qui a été réservé depuis la dernière fois.
 *
 * ─── POURQUOI APRÈS L'AFFICHAGE, ET NON PENDANT ────────────────────────────
 *
 * La relève pourrait vivre dans `page.tsx`, avant le rendu. Le calendrier
 * attendrait alors Calendly à chaque ouverture — jusqu'à dix secondes si le
 * service traîne, et une page blanche pendant ce temps. Sur un écran qu'on
 * ouvre vingt fois par jour, c'est inacceptable.
 *
 * Ici, la page s'affiche d'abord avec ce que la base contient, la relève part
 * ensuite, et `router.refresh()` ne réveille le rendu que si quelque chose est
 * effectivement arrivé. L'attente n'est jamais visible.
 *
 * ─── CE COMPOSANT NE REND RIEN, ET NE DIT RIEN ─────────────────────────────
 *
 * Aucun indicateur, aucun message d'erreur. Un cabinet qui n'a pas raccordé
 * Calendly — la majorité — ne doit pas voir un avertissement sur un service
 * qu'il n'utilise pas. Les échecs se rangent dans les réglages, à l'endroit où
 * l'on va justement quand quelque chose ne se remplit plus.
 *
 * Le verrou de deux minutes vit dans l'action serveur, non ici : un verrou
 * côté navigateur disparaîtrait au premier rechargement.
 */
export function ReleveAuChargement() {
  const router = useRouter()
  // React 19 monte deux fois en développement. Sans ce garde-fou, chaque
  // ouverture partirait en double — le verrou serveur absorberait le second
  // appel, mais autant ne pas le faire.
  const lancee = React.useRef(false)

  React.useEffect(() => {
    if (lancee.current) return
    lancee.current = true

    let vivant = true
    releverCalendly()
      .then((r) => {
        // On ne rafraîchit que s'il y a du neuf : un `refresh()` inutile
        // relance toutes les requêtes de la page pour rien.
        if (vivant && r.ok && (r.releves ?? 0) > 0) router.refresh()
      })
      .catch(() => {
        // Silence délibéré. L'action range déjà l'échec dans `last_error`,
        // et le calendrier reste utilisable sur les données en base.
      })

    return () => { vivant = false }
  }, [router])

  return null
}
