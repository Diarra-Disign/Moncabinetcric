import { getAgreements, getGovernmentFees, getClauses } from "@/lib/data/queries"
import { AgreementsClient } from "./agreements-client"

export const metadata = {
  title: "Ententes de Service CICC — MonCabinetCRIC",
  description: "Rédaction, validation et suivi de signature des ententes de service réglementées CICC."
}

export default async function AgreementsPage() {
  const agreements = await getAgreements()
  const governmentFees = await getGovernmentFees()
  const clauses = await getClauses()

  return (
    <AgreementsClient 
      initialAgreements={agreements}
      governmentFees={governmentFees}
      clauses={clauses}
    />
  )
}
