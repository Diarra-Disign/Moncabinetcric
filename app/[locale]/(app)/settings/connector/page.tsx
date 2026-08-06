import { getCurrentMember } from "@/lib/supabase/session"
import {
  getReglagesConnecteur,
  getClesApi,
  getJournalConnecteur,
} from "@/lib/data/connector-reads"
import { ConnectorClient } from "./connector-client"

/**
 * Réglages du connecteur d'intelligence artificielle.
 *
 * Tout ce qui s'affiche ici vient de la base, borné au cabinet du membre
 * par les politiques RLS. L'écran lisait auparavant des variables de
 * processus partagées par toute l'application : les clés, le journal et
 * l'interrupteur d'un cabinet étaient ceux de tous les autres.
 */
export default async function AiConnectorSettingsPage() {
  const [membre, reglages, cles, journal] = await Promise.all([
    getCurrentMember(),
    getReglagesConnecteur(),
    getClesApi(),
    getJournalConnecteur(),
  ])

  return (
    <ConnectorClient
      estProprietaire={membre?.ciccRole === "owner"}
      reglages={reglages}
      cles={cles}
      journal={journal}
    />
  )
}
