import { getAgreements, getGovernmentFees, getClauses } from "@/lib/data/queries"
import { listerModelesEntente, listerEntentes } from "@/lib/data/ententes-actions"
import { AgreementsClient } from "./agreements-client"

// Ni « CICC » ni « réglementées » : le §1 interdit de laisser croire à une
// conformité attestée par le Collège que personne n'a accordée. Le titre de la
// page avait été corrigé ; ces métadonnées, elles, partent dans l'onglet du
// navigateur et dans les résultats de recherche.
export const metadata = {
  title: "Ententes de service — MonCabinetCRIC",
  description: "Rédigez, personnalisez et suivez vos ententes de service et vos contrats de mandat."
}

export default async function AgreementsPage() {
  // Les modèles d'entente viennent de la base — système et cabinet. Ils
  // n'existaient pas : getAgreements() rend toujours [] sur Supabase, et
  // l'écran reposait sur des données de démonstration.
  const modelesEntente = await listerModelesEntente()
  const ententes = await listerEntentes()
  const agreements = await getAgreements()
  const governmentFees = await getGovernmentFees()
  const clauses = await getClauses()

  return (
    <AgreementsClient 
      initialAgreements={agreements}
      governmentFees={governmentFees}
      clauses={clauses}
      modelesEntente={modelesEntente}
      ententes={ententes}
    />
  )
}
