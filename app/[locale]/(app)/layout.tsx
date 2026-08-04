import { Sidebar } from "@/components/app-shell/sidebar"
import { Topbar, SearchItem } from "@/components/app-shell/topbar"
import { getClients, getMatters, getDocuments, getInvoices } from "@/lib/data"
import {
  getCurrentMember,
  getCurrentFirm,
  getCurrentPlatformAdmin,
  getCurrentPortalClient,
} from "@/lib/supabase/session"
import { FirmProvider } from "@/components/app-shell/firm-provider"
import { AccessClosed } from "@/components/app-shell/access-closed"
import { getTranslations } from "next-intl/server"
import { redirect } from "next/navigation"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Seconde barrière, après proxy.ts : le middleware peut être contourné
  // par une route mal déclarée dans son matcher, pas ce contrôle-ci.
  const member = await getCurrentMember()
  if (!member) {
    // Un compte connecté sans profil n'est pas forcément un intrus : c'est
    // le cas normal d'un administrateur de plateforme, qui n'est membre
    // d'aucun cabinet. Le renvoyer vers la connexion créait une boucle —
    // proxy.ts voyait une session valide et le retournait aussitôt ici.
    const admin = await getCurrentPlatformAdmin()
    if (admin) redirect("/fr/admin")

    // Un client du portail n'a pas de profil de cabinet, et c'est normal.
    // Sans ce cas, il rebondissait vers la connexion avec « probleme=profil »
    // juste après s'être authentifié avec succès.
    const client = await getCurrentPortalClient()
    if (client) redirect("/fr")

    // Ni membre, ni administrateur : le paramètre rend la page de connexion
    // terminale, sinon la même boucle se reformerait.
    redirect("/fr/connexion?probleme=profil")
  }

  // L'abonnement est vérifié AVANT de charger quoi que ce soit : inutile de
  // lancer cinq requêtes que la base refusera. Ce contrôle sert à afficher
  // une explication, pas à protéger — la protection est dans
  // current_firm_id(), qui renvoie NULL et fait refuser toutes les
  // politiques.
  const firmForAccess = await getCurrentFirm()
  if (!firmForAccess.accessOpen) {
    const tAuth = await getTranslations("Auth")
    return (
      <AccessClosed
        firm={firmForAccess}
        title={tAuth("accessClosedTitle")}
        suspendedBody={tAuth("accessSuspendedBody")}
        expiredBody={tAuth("accessExpiredBody")}
        contactLabel={tAuth("accessContact")}
        signOutLabel={tAuth("signOut")}
        planLabel={tAuth("planLabel")}
        statusLabel={tAuth("statusLabel")}
      />
    )
  }

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
