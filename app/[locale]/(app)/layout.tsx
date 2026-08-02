import { Sidebar } from "@/components/app-shell/sidebar"
import { Topbar, SearchItem } from "@/components/app-shell/topbar"
import { getClients, getMatters, getDocuments, getInvoices } from "@/lib/data"
import { getCurrentMember, getCurrentFirm } from "@/lib/supabase/session"
import { FirmProvider } from "@/components/app-shell/firm-provider"
import { redirect } from "next/navigation"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Seconde barrière, après proxy.ts : le middleware peut être contourné
  // par une route mal déclarée dans son matcher, pas ce contrôle-ci.
  const member = await getCurrentMember()
  if (!member) redirect("/fr/connexion")

  const [firm, clients, matters, documents, invoices] = await Promise.all([
    getCurrentFirm(),
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
    <FirmProvider firm={firm}>
    <div className="h-full bg-background text-foreground">
      <Sidebar />
      <div className="lg:pl-72 flex flex-col h-full">
        <Topbar
          searchDb={searchDb}
          member={{
            fullName: member.fullName,
            email: member.email,
            ciccRole: member.ciccRole,
            initials: initialsOf(member.fullName),
          }}
        />
        <main className="flex-1 py-10">
          <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
    </FirmProvider>
  )
}

/** Initiales affichées dans la pastille de l'en-tête. */
function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
