import { BillingClient } from "./billing-client"
import { getFacturesDuCabinet, getMatters } from "@/lib/data"

/**
 * L'écran Facturation du menu : la vue d'ensemble du cabinet.
 *
 * Il ne lit plus getInvoices() mais firm_invoices_view, seule à porter le
 * statut CALCULÉ et le montant réglé — la colonne status reste « issued » sur
 * une facture entièrement payée, si bien que cet écran et la fiche dossier
 * annonçaient deux états différents pour la même facture.
 *
 * Les dossiers sont chargés pour une seule raison : conduire à celui dans
 * lequel une facture doit naître. Ils ne servent plus à un formulaire de
 * création local — il n'y en a plus.
 */
export default async function BillingPage() {
  const [factures, dossiers] = await Promise.all([getFacturesDuCabinet(), getMatters()])

  return (
    <BillingClient
      factures={factures}
      dossiers={dossiers.map((m) => ({
        reference: m.id,
        clientNom: m.clientName,
        programme: m.program ?? "",
      }))}
    />
  )
}
