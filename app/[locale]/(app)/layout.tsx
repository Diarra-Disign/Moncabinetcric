import { Sidebar } from "@/components/app-shell/sidebar"
import { Topbar, SearchItem } from "@/components/app-shell/topbar"
import { AppShellContainer } from "./app-shell-container"
import { getClients, getMatters, getDocuments, getInvoices } from "@/lib/data"
import {
  getCurrentMember,
  getCurrentFirm,
  getCurrentPlatformAdmin,
  getCurrentPortalClient,
} from "@/lib/supabase/session"
import { FirmProvider } from "@/components/app-shell/firm-provider"
import { AccessClosed } from "@/components/app-shell/access-closed"
import { MemberClosed } from "@/components/app-shell/member-closed"
import { getTranslations } from "next-intl/server"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { getAbonnement } from "@/lib/data/subscription"
import { stripeConfigure } from "@/lib/billing/stripe"
import { getForfaitsSouscriptibles } from "@/lib/billing/catalogue"
import { SubscriptionClient } from "./settings/subscription/subscription-client"
import { exigerSecondFacteur } from "@/lib/auth/second-facteur"

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
    // Vers /fr/portal, et non vers /fr : la racine sert désormais la page
    // publique. Un client renvoyé à la racine y aurait trouvé l'argumentaire
    // commercial du produit au lieu de son propre dossier.
    const client = await getCurrentPortalClient()
    if (client) redirect("/fr/portal")

    // Ni membre, ni administrateur : le paramètre rend la page de connexion
    // terminale, sinon la même boucle se reformerait.
    redirect("/fr/connexion?probleme=profil")
  }

  // ── LE SECOND FACTEUR, EXIGÉ ICI ET NON DANS L'ÉCRAN DE CONNEXION ────────
  //
  // C'est ce contrôle qui rend le second facteur réel. Sans lui, il suffirait
  // de fermer l'onglet au moment du défi et de revenir sur /fr/dashboard : la
  // session issue du mot de passe seul est valide, simplement de niveau aal1.
  // Le formulaire de connexion propose le défi ; c'est ce garde qui l'impose.
  //
  // `nextLevel` ne vaut « aal2 » que pour un compte ayant un facteur VÉRIFIÉ :
  // personne n'est enfermé dehors par un enrôlement resté inachevé.
  await exigerSecondFacteur()

  // L'abonnement est vérifié AVANT de charger quoi que ce soit : inutile de
  // lancer cinq requêtes que la base refusera. Ce contrôle sert à afficher
  // une explication, pas à protéger — la protection est dans
  // current_firm_id(), qui renvoie NULL et fait refuser toutes les
  // politiques.
  // Le membre lui-même peut être écarté, indépendamment de l'état du cabinet.
  // Ce contrôle vient AVANT celui de l'abonnement : un adjoint suspendu dans
  // un cabinet parfaitement à jour doit lire la bonne raison, pas « accès
  // suspendu » suivi d'un plan et d'un statut qui vont très bien.
  //
  // Comme partout ici, ce n'est pas la protection : celle-ci est en base, dans
  // current_firm_id(), qui renvoie NULL et fait refuser toutes les politiques.
  // Sans cet écran, le membre verrait une application vide et en conclurait
  // que ses dossiers ont disparu.
  if (member.statut !== "active") {
    const tAuth = await getTranslations("Auth")
    return (
      <MemberClosed
        firmName={member.firmName}
        fullName={member.fullName || member.email}
        statut={member.statut}
        title={tAuth("memberClosedTitle")}
        suspendedBody={tAuth("memberSuspendedBody")}
        revokedBody={tAuth("memberRevokedBody")}
        signOutLabel={tAuth("signOut")}
      />
    )
  }

  const firmForAccess = await getCurrentFirm()
  if (!firmForAccess.accessOpen) {
    const tAuth = await getTranslations("Auth")

    // L'écran d'abonnement est greffé sur l'écran de refus, et non atteint
    // par un lien : toutes les pages de ce groupe passent par ce layout, donc
    // aucune n'est atteignable une fois l'accès fermé — y compris celle qui
    // permettrait de payer. Sans cette greffe, un cabinet dont l'essai vient
    // d'échoir devrait écrire un courriel et attendre une réponse pour un
    // geste qui prend trente secondes.
    const [abonnement, plans] = await Promise.all([
      getAbonnement(),
      getForfaitsSouscriptibles(),
    ])

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
        contactEmail={process.env.EMAIL_REPLY_TO || "acces@moncabinetcric.com"}
      >
        {/* Une suspension décidée depuis la console n'est pas un impayé :
            payer ne la lèverait pas. Proposer le paiement dans ce cas serait
            encaisser sans rouvrir. */}
        {member.ciccRole === "owner" && firmForAccess.status === "active" && (
          <Suspense fallback={null}>
            <SubscriptionClient
              estProprietaire
              paiementConfigure={stripeConfigure()}
              abonnement={abonnement}
              plans={plans}
            />
          </Suspense>
        )}
      </AccessClosed>
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
    // LE NOM D'ABORD. La recherche indexait `type` — une étiquette générique,
    // « Formulaire » ou « Entente de service », partagée par des dizaines de
    // pièces — et affichait le déposant en sous-titre. On ne pouvait donc pas
    // retrouver un document par son nom, qui est pourtant la seule chose qui le
    // distingue des autres, ni par son client ni par sa date.
    ...documents.map(d => ({
      id: d.id,
      title: d.name,
      // Le statut n'apparaît QUE s'il mérite l'attention : « valide » sur
      // chaque ligne serait du bruit sur toute la liste, et noierait les
      // quelques pièces qui attendent une revue.
      subtitle: [
        d.clientName,
        d.type,
        d.status === "pending_review" ? "à réviser"
          : d.status === "invalid" ? "refusée"
          : d.status === "archived" ? "archivée"
          : null,
        d.date ? new Date(d.date).toLocaleDateString("fr-CA") : null,
      ].filter(Boolean).join(" · "),
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

  // La boîte de notifications du membre. Lue ici, dans la coque, parce que la
  // cloche est présente sur toutes les pages : la charger page par page
  // l'aurait fait disparaître de celles qui auraient oublié de la demander.
  const { listerNotifications } = await import("@/lib/data/notifications")
  const boite = await listerNotifications()

  return (
    <FirmProvider firm={firm}>
      <AppShellContainer
        searchDb={searchDb}
        notifications={boite.liste}
        nonLues={boite.nonLues}
        member={{
          fullName: member.fullName,
          email: member.email,
          ciccRole: member.ciccRole,
          initials: initialsOf(member.fullName),
        }}
      >
        {children}
      </AppShellContainer>
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
