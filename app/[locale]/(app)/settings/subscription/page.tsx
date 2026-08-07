import { setRequestLocale } from "next-intl/server"
import { getCurrentMember } from "@/lib/supabase/session"
import { getAbonnement } from "@/lib/data/subscription"
import { stripeConfigure } from "@/lib/billing/stripe"
import { SubscriptionClient } from "./subscription-client"

/**
 * Abonnement du cabinet.
 *
 * La page reste accessible à tout membre, et pas au seul propriétaire : un
 * adjoint qui voit l'application se fermer dans huit jours doit pouvoir en
 * lire la raison. Les boutons, eux, ne s'affichent qu'au propriétaire — et
 * les actions revérifient sa qualité côté serveur, la lecture d'un écran
 * n'étant jamais une autorisation.
 */
export default async function SubscriptionPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)

  const [membre, abonnement] = await Promise.all([getCurrentMember(), getAbonnement()])

  return (
    <SubscriptionClient
      estProprietaire={membre?.ciccRole === "owner"}
      paiementConfigure={stripeConfigure()}
      abonnement={abonnement}
    />
  )
}
