import { getTranslations } from "next-intl/server"
import { BillingClient } from "./billing-client"
import { getInvoices } from "@/lib/data"

export default async function BillingPage() {
  const tBilling = await getTranslations("Billing")
  const initialInvoices = await getInvoices()

  const translations = {
    title: tBilling("title"),
    subtitle: tBilling("subtitle"),
    newInvoice: tBilling("newInvoice"),
    stats: {
      totalBilled: tBilling("stats.totalBilled"),
      collected: tBilling("stats.collected"),
      pending: tBilling("stats.pending"),
      overdue: tBilling("stats.overdue"),
    },
    searchPlaceholder: tBilling("searchPlaceholder"),
    table: {
      invoiceId: tBilling("table.invoiceId"),
      client: tBilling("table.client"),
      amount: tBilling("table.amount"),
      date: tBilling("table.date"),
      status: tBilling("table.status"),
      actions: tBilling("table.actions"),
    },
  }

  return <BillingClient t={translations} initialInvoices={initialInvoices} />
}
