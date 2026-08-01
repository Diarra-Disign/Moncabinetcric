import { Sidebar } from "@/components/app-shell/sidebar"
import { Topbar, SearchItem } from "@/components/app-shell/topbar"
import { getClients, getMatters, getDocuments, getInvoices } from "@/lib/data"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [clients, matters, documents, invoices] = await Promise.all([
    getClients(),
    getMatters(),
    getDocuments(),
    getInvoices(),
  ])

  const searchDb: SearchItem[] = [
    ...clients.map(c => ({
      id: c.id,
      title: c.name,
      subtitle: `${c.fileNumber} · ${c.program}`,
      type: "client" as const,
      href: `/clients`,
    })),
    ...matters.map(m => ({
      id: m.id,
      title: m.clientName,
      subtitle: `${m.id} · ${m.program}`,
      type: "matter" as const,
      href: `/matters/${m.id.replace("#", "")}`,
    })),
    ...documents.map(d => ({
      id: d.id,
      title: d.type,
      subtitle: d.uploadedBy,
      type: "document" as const,
      href: "/documents",
    })),
    ...invoices.map(i => ({
      id: i.id,
      title: `Facture ${i.invoiceNumber}`,
      subtitle: `${i.clientName} · ${i.amount} $ CAD`,
      type: "matter" as const,
      href: "/billing",
    })),
  ]

  return (
    <div className="h-full bg-background text-foreground">
      <Sidebar />
      <div className="lg:pl-72 flex flex-col h-full">
        <Topbar searchDb={searchDb} />
        <main className="flex-1 py-10">
          <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
