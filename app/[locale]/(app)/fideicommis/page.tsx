import { FideicommisClient } from "./fideicommis-client"
import { RegistreMensuelSection } from "./registre-mensuel"
import {
  getRegistreFideicommis,
  getClientsPourFideicommis,
  getRegistreMensuel,
} from "@/lib/data/trust"

/**
 * Le mois demandé, ou le mois en cours.
 *
 * Validé plutôt que passé tel quel : `?mois=` vient de l'adresse, donc de
 * n'importe où. Une valeur libre atteindrait `bornesDuMois()`, qui produirait
 * « NaN-NaN-01 », et Postgres refuserait la requête — une page en erreur pour
 * un paramètre mal recopié. On retombe silencieusement sur le mois courant.
 */
function moisDemande(brut: string | undefined): string {
  const maintenant = new Date()
  const courant = `${maintenant.getUTCFullYear()}-${String(maintenant.getUTCMonth() + 1).padStart(2, "0")}`
  if (!brut || !/^\d{4}-(0[1-9]|1[0-2])$/.test(brut)) return courant
  return brut
}

/**
 * Le compte en fidéicommis du cabinet.
 *
 * Une seule lecture pour l'écran entier : solde, ventilation par client,
 * mouvements et rapprochements viennent du même instant. Quatre requêtes
 * séparées produiraient un total qui ne correspond pas à la somme des lignes
 * affichées juste en dessous — sur un état comptable, c'est ce qui fait douter
 * de tout le reste.
 */
export default async function FideicommisPage({
  searchParams,
}: {
  searchParams: Promise<{ mois?: string }>
}) {
  const mois = moisDemande((await searchParams).mois)
  const [registre, clients, mensuel] = await Promise.all([
    getRegistreFideicommis(),
    getClientsPourFideicommis(),
    getRegistreMensuel(mois),
  ])

  if (!registre) {
    return (
      <p className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
        Session expirée. Reconnectez-vous.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {mensuel && <RegistreMensuelSection registre={mensuel} mois={mois} />}
      <FideicommisClient registre={registre} clients={clients} />
    </div>
  )
}
