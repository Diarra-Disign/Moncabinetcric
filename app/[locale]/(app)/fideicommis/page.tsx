import { FideicommisClient } from "./fideicommis-client"
import { getRegistreFideicommis, getClientsPourFideicommis } from "@/lib/data/trust"

/**
 * Le compte en fidéicommis du cabinet.
 *
 * Une seule lecture pour l'écran entier : solde, ventilation par client,
 * mouvements et rapprochements viennent du même instant. Quatre requêtes
 * séparées produiraient un total qui ne correspond pas à la somme des lignes
 * affichées juste en dessous — sur un état comptable, c'est ce qui fait douter
 * de tout le reste.
 */
export default async function FideicommisPage() {
  const [registre, clients] = await Promise.all([
    getRegistreFideicommis(),
    getClientsPourFideicommis(),
  ])

  if (!registre) {
    return (
      <p className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
        Session expirée. Reconnectez-vous.
      </p>
    )
  }

  return <FideicommisClient registre={registre} clients={clients} />
}
