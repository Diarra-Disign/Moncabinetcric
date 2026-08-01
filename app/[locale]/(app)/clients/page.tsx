import { getTranslations } from "next-intl/server"
import { ClientsClient } from "./clients-client"
import { getClients } from "@/lib/data"

export default async function ClientsPage() {
  const tClients = await getTranslations("Clients")
  const initialClients = await getClients()

  const translations = {
    title: tClients("title"),
    subtitle: tClients("subtitle"),
    newClient: tClients("newClient"),
    stats: {
      total: tClients("stats.total"),
      active: tClients("stats.active"),
      pendingDocs: tClients("stats.pendingDocs"),
      archived: tClients("stats.archived"),
    },
    searchPlaceholder: tClients("searchPlaceholder"),
    table: {
      fileNumber: tClients("table.fileNumber"),
      name: tClients("table.name"),
      contact: tClients("table.contact"),
      program: tClients("table.program"),
      status: tClients("table.status"),
      actions: tClients("table.actions"),
    },
  }

  return <ClientsClient t={translations} initialClients={initialClients} />
}
