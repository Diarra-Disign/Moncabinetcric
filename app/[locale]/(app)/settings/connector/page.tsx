import { getAiConnectorSettings, getAiApiKeys, getAiConnectorLogs } from "@/lib/data/queries"
import { ConnectorClient } from "./connector-client"

export default async function AiConnectorSettingsPage() {
  const settings = await getAiConnectorSettings()
  const apiKeys = await getAiApiKeys()
  const logs = await getAiConnectorLogs()

  return (
    <ConnectorClient 
      initialSettings={settings}
      initialApiKeys={apiKeys}
      initialLogs={logs}
    />
  )
}
