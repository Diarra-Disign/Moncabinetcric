import { getAgreements, getGovernmentFees, getClauses } from "@/lib/data/queries"
import { listerModelesEntente } from "@/lib/data/ententes-actions"
import { AgreementsClient } from "./agreements-client"

export const metadata = {
  title: "Ententes de Service CICC — MonCabinetCRIC",
  description: "Rédaction, validation et suivi de signature des ententes de service réglementées CICC."
}

export default async function AgreementsPage() {
  // Les modèles d'entente viennent de la base — système et cabinet. Ils
  // n'existaient pas : getAgreements() rend toujours [] sur Supabase, et
  // l'écran reposait sur des données de démonstration.
  const modelesEntente = await listerModelesEntente()
  const agreements = await getAgreements()
  const governmentFees = await getGovernmentFees()
  const clauses = await getClauses()

  return (
    <AgreementsClient 
      initialAgreements={agreements}
      governmentFees={governmentFees}
      clauses={clauses}
      modelesEntente={modelesEntente}
    />
  )
}
