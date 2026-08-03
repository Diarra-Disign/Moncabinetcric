"use server"

import { isSupabaseSource } from "./source"
import { Matter, Lead, InvoiceRecord, ClientRecord, DocumentRecord, ResearchWorkspace, ResearchSource, LegislationProvision } from "./types"
// Import depuis ./stores et non ./queries : ce module est "use server" mais
// des composants clients l'importent, et passer par queries.ts entraînerait
// supabase/reads.ts (server-only) dans le bundle navigateur.
import { _getStores, _getResearchStores, _getAiStores, _findLegislationProvision } from "./stores"
import { generateChecklistForProgram } from "./programs"
import { searchProvisions } from "./legislation-search"

const sbWrites = () => import("./supabase/writes")

export async function createMatter(data: Omit<Matter, "id"> & { id?: string }): Promise<Matter> {
  if (isSupabaseSource()) return (await sbWrites()).createMatter(data)
  const stores = _getStores()
  const id = data.id || `#DOS-${Math.floor(10000 + Math.random() * 90000)}`
  const newMatter: Matter = {
    ...data,
    id
  }
  stores.setMattersStore([newMatter, ...stores.mattersStore])
  return newMatter
}

export async function updateMatterStatus(id: string, status: Matter["status"]): Promise<Matter | undefined> {
  if (isSupabaseSource()) return (await sbWrites()).updateMatterStatus(id, status)
  const stores = _getStores()
  const idx = stores.mattersStore.findIndex(m => m.id === id)
  if (idx === -1) return undefined
  const updated = { ...stores.mattersStore[idx], status }
  const newArr = [...stores.mattersStore]
  newArr[idx] = updated
  stores.setMattersStore(newArr)
  return updated
}

export async function createLead(data: Omit<Lead, "id"> & { id?: string }): Promise<Lead> {
  if (isSupabaseSource()) return (await sbWrites()).createLead(data)
  const stores = _getStores()
  const id = data.id || `lead-${Date.now()}`
  const newLead: Lead = {
    ...data,
    id
  }
  stores.setLeadsStore([newLead, ...stores.leadsStore])
  return newLead
}

export async function moveLeadStage(id: string, stage: Lead["stage"]): Promise<Lead | undefined> {
  if (isSupabaseSource()) return (await sbWrites()).moveLeadStage(id, stage)
  const stores = _getStores()
  const idx = stores.leadsStore.findIndex(l => l.id === id)
  if (idx === -1) return undefined
  const updated = { ...stores.leadsStore[idx], stage }
  const newArr = [...stores.leadsStore]
  newArr[idx] = updated
  stores.setLeadsStore(newArr)
  return updated
}

export async function updateLead(id: string, updates: Partial<Lead>): Promise<Lead | undefined> {
  if (isSupabaseSource()) return (await sbWrites()).updateLead(id, updates)
  const stores = _getStores()
  const idx = stores.leadsStore.findIndex(l => l.id === id)
  if (idx === -1) return undefined
  const updated = { ...stores.leadsStore[idx], ...updates }
  const newArr = [...stores.leadsStore]
  newArr[idx] = updated
  stores.setLeadsStore(newArr)
  return updated
}

export async function createInvoice(data: Omit<InvoiceRecord, "id"> & { id?: string }): Promise<InvoiceRecord> {
  if (isSupabaseSource()) return (await sbWrites()).createInvoice(data)
  const stores = _getStores()
  const id = data.id || `inv-${Date.now()}`
  const newInv: InvoiceRecord = {
    ...data,
    id
  }
  stores.setInvoicesStore([newInv, ...stores.invoicesStore])
  return newInv
}

export async function createClient(data: Omit<ClientRecord, "id"> & { id?: string }): Promise<ClientRecord> {
  if (isSupabaseSource()) return (await sbWrites()).createClient(data)
  const stores = _getStores()
  const id = data.id || `c-${Date.now()}`
  const newClient: ClientRecord = {
    ...data,
    id
  }
  stores.setClientsStore([newClient, ...stores.clientsStore])
  return newClient
}

export async function createDocument(data: Omit<DocumentRecord, "id"> & { id?: string }): Promise<DocumentRecord> {
  if (isSupabaseSource()) return (await sbWrites()).createDocument(data)
  const stores = _getStores()
  const id = data.id || `doc-${Date.now()}`
  const newDoc: DocumentRecord = {
    ...data,
    id
  }
  stores.setDocumentsStore([newDoc, ...stores.documentsStore])
  return newDoc
}

export async function archiveDocumentRecord(id: string): Promise<DocumentRecord | undefined> {
  if (isSupabaseSource()) return (await sbWrites()).archiveDocumentRecord(id)
  const stores = _getStores()
  const idx = stores.documentsStore.findIndex(d => d.id === id)
  if (idx === -1) return undefined
  const updated: DocumentRecord = { ...stores.documentsStore[idx], status: "archived" }
  const newArr = [...stores.documentsStore]
  newArr[idx] = updated
  stores.setDocumentsStore(newArr)
  return updated
}

export async function deleteDocumentRecord(id: string): Promise<boolean> {
  if (isSupabaseSource()) return (await sbWrites()).deleteDocumentRecord(id)
  const stores = _getStores()
  const idx = stores.documentsStore.findIndex(d => d.id === id)
  if (idx === -1) return false
  const newArr = stores.documentsStore.filter(d => d.id !== id)
  stores.setDocumentsStore(newArr)
  return true
}

export async function restoreDocumentRecord(id: string): Promise<DocumentRecord | undefined> {
  if (isSupabaseSource()) return (await sbWrites()).restoreDocumentRecord(id)
  const stores = _getStores()
  const idx = stores.documentsStore.findIndex(d => d.id === id)
  if (idx === -1) return undefined
  const updated: DocumentRecord = { ...stores.documentsStore[idx], status: "valid" }
  const newArr = [...stores.documentsStore]
  newArr[idx] = updated
  stores.setDocumentsStore(newArr)
  return updated
}

import { AiApiKeyRecord, AiConnectorLogRecord } from "./types"

export async function toggleAiConnector(enabled: boolean): Promise<boolean> {
  const stores = _getAiStores()
  const updated = {
    ...stores.aiConnectorSettingsStore,
    enabled,
    enabledAt: enabled ? new Date().toISOString() : undefined
  }
  stores.setAiConnectorSettingsStore(updated)
  return enabled
}

export async function generateAiApiKey(name: string, createdForMemberId: string, createdForMemberName: string): Promise<AiApiKeyRecord> {
  const stores = _getAiStores()
  const randomSuffix = Math.random().toString(36).substring(2, 10)
  const keyPrefix = `cric_live_${randomSuffix}`
  const newKey: AiApiKeyRecord = {
    id: `key-${Date.now()}`,
    name,
    keyPrefix,
    secretHash: `sha256-${Date.now()}`,
    createdForMemberId,
    createdForMemberName,
    createdAt: new Date().toISOString().split("T")[0],
    isActive: true
  }
  stores.setAiApiKeysStore([newKey, ...stores.aiApiKeysStore])
  return newKey
}

export async function revokeAiApiKey(id: string): Promise<boolean> {
  const stores = _getAiStores()
  const idx = stores.aiApiKeysStore.findIndex(k => k.id === id)
  if (idx === -1) return false
  const updated = [...stores.aiApiKeysStore]
  updated[idx] = { ...updated[idx], isActive: false }
  stores.setAiApiKeysStore(updated)
  return true
}

export async function executeAiConnectorAction(
  action: string,
  payload: Record<string, unknown>,
  apiKeyPrefix = "cric_live_7a8b..."
): Promise<{ success: boolean; data?: unknown; error?: { code: string; message: string } }> {
  const stores = _getAiStores()
  const settings = stores.aiConnectorSettingsStore

  // Check 1: Connector enabled globally by Owner
  if (!settings.enabled) {
    const errorLog: AiConnectorLogRecord = {
      id: `log-ai-${Date.now()}`,
      occurredAt: new Date().toISOString(),
      apiKeyPrefix,
      clientIp: "198.51.100.42",
      action,
      status: "disabled",
      summary: `REJETÉ (403 Forbidden) : Le Connecteur IA est désactivé par le Propriétaire du cabinet.`,
      rowHash: `sha256-${Date.now()}`
    }
    stores.setAiConnectorLogsStore([errorLog, ...stores.aiConnectorLogsStore])
    return {
      success: false,
      error: {
        code: "CONNECTOR_DISABLED",
        message: "Le Connecteur IA est actuellement désactivé par le Propriétaire du cabinet."
      }
    }
  }

  // Check 2: Reserved Human Action Gate (HARD SAFETY GATE CICC)
  if (settings.reservedHumanActions.includes(action)) {
    const errorLog: AiConnectorLogRecord = {
      id: `log-ai-${Date.now()}`,
      occurredAt: new Date().toISOString(),
      apiKeyPrefix,
      clientIp: "198.51.100.42",
      action,
      resourceId: payload.agreementId as string | undefined,
      status: "forbidden_reserved",
      summary: `BLOQUÉ PAR GARDE-FOU CICC (403 Forbidden) : L'action "${action}" est un acte réservé exclusivement à un consultant humain dans le tableau de bord.`,
      rowHash: `sha256-${Date.now()}`
    }
    stores.setAiConnectorLogsStore([errorLog, ...stores.aiConnectorLogsStore])
    return {
      success: false,
      error: {
        code: "RESERVED_HUMAN_ACTION",
        message: `L'action "${action}" (Finaliser, Envoyer, Signer, Annuler) est un acte réservé exclusivement à un consultant humain dans le tableau de bord MonCabinetCRIC.`
      }
    }
  }

  // Success execution for allowed assistant actions
  const successLog: AiConnectorLogRecord = {
    id: `log-ai-${Date.now()}`,
    occurredAt: new Date().toISOString(),
    apiKeyPrefix,
    clientIp: "198.51.100.42",
    action,
    resourceId: payload.agreementId as string || "SA-2026-000142",
    status: "success",
    summary: `Exécution réussie par l'IA : ${action} (${JSON.stringify(payload).substring(0, 60)}...)`,
    rowHash: `sha256-${Date.now()}`
  }
  stores.setAiConnectorLogsStore([successLog, ...stores.aiConnectorLogsStore])

  return {
    success: true,
    data: {
      action,
      executedAt: new Date().toISOString(),
      agreementId: payload.agreementId || "SA-2026-000142",
      status: "draft_updated",
      payload
    }
  }
}

export async function createResearchWorkspace(
  title: string,
  matterId?: string,
  notes?: string,
  createdBy?: string
): Promise<ResearchWorkspace> {
  const stores = _getResearchStores()
  const now = new Date().toISOString().split("T")[0]
  const newWorkspace: ResearchWorkspace = {
    id: `ws-${Date.now()}`,
    title: title.trim() || "Nouvel espace de recherche",
    matterId: matterId || undefined,
    matterReference: matterId || undefined,
    // L'auteur vient de l'appelant, jamais d'une valeur figée : cette ligne
    // inscrivait le consultant et le numéro de permis d'un cabinet fictif
    // dans des données réelles.
    createdBy: createdBy?.trim() || "",
    createdAt: now,
    updatedAt: now,
    notes: notes || undefined,
    sources: []
  }
  stores.setResearchWorkspacesStore([newWorkspace, ...stores.researchWorkspacesStore])
  return newWorkspace
}

export async function addResearchSourceToWorkspace(workspaceId: string, provisionId: string, note?: string): Promise<ResearchWorkspace | undefined> {
  const stores = _getResearchStores()
  const idx = stores.researchWorkspacesStore.findIndex(w => w.id === workspaceId)
  if (idx === -1) return undefined
  const provision = _findLegislationProvision(provisionId)
  if (!provision) return undefined

  const now = new Date().toISOString().split("T")[0]
  const workspace = stores.researchWorkspacesStore[idx]
  const newSource: ResearchSource = {
    id: `src-${Date.now()}`,
    workspaceId,
    provisionId: provision.id,
    provisionNo: provision.provisionNo,
    instrument: provision.instrument,
    headingFr: provision.headingFr,
    headingEn: provision.headingEn,
    citationSnapshot: `${provision.instrument.toUpperCase()} art. ${provision.provisionNo} (version cons. ${provision.consolidatedOn})`,
    textSnapshotFr: provision.bodyFr,
    textSnapshotEn: provision.bodyEn,
    note: note || undefined,
    sortOrder: (workspace.sources.length || 0) + 1,
    addedAt: now
  }

  const updatedWorkspace: ResearchWorkspace = {
    ...workspace,
    sources: [...workspace.sources, newSource],
    updatedAt: now
  }
  const newArr = [...stores.researchWorkspacesStore]
  newArr[idx] = updatedWorkspace
  stores.setResearchWorkspacesStore(newArr)
  return updatedWorkspace
}

export async function deleteResearchSourceFromWorkspace(workspaceId: string, sourceId: string): Promise<ResearchWorkspace | undefined> {
  const stores = _getResearchStores()
  const idx = stores.researchWorkspacesStore.findIndex(w => w.id === workspaceId)
  if (idx === -1) return undefined
  const now = new Date().toISOString().split("T")[0]
  const workspace = stores.researchWorkspacesStore[idx]
  const updatedWorkspace: ResearchWorkspace = {
    ...workspace,
    sources: workspace.sources.filter(s => s.id !== sourceId),
    updatedAt: now
  }
  const newArr = [...stores.researchWorkspacesStore]
  newArr[idx] = updatedWorkspace
  stores.setResearchWorkspacesStore(newArr)
  return updatedWorkspace
}


/**
 * Taille d'une page de résultats renvoyée au navigateur.
 *
 * Volontairement NON exportée : un module « use server » ne peut exposer
 * que des fonctions asynchrones. Exporter une constante ici invalide le
 * module entier et fait disparaître toutes les autres actions.
 */
const LEGISLATION_RESULT_LIMIT = 60

/**
 * Recherche dans le corpus LIPR / RIPR, exécutée sur le serveur.
 *
 * Le corpus pèse environ 1,4 Mo : le sérialiser vers le client à chaque
 * chargement coûterait plus de 300 Ko compressés. Seuls les résultats
 * transitent, et le total permet d'indiquer combien ont été tronqués.
 */
export async function searchLegislationAction(
  query: string,
  instrumentFilter: string,
  limit: number = LEGISLATION_RESULT_LIMIT
): Promise<{ items: LegislationProvision[]; total: number }> {
  const { legislationProvisionsStore } = _getResearchStores()
  const matched = searchProvisions(legislationProvisionsStore, query, instrumentFilter)
  return { items: matched.slice(0, limit), total: matched.length }
}

export async function updateFirmSettings(data: {
  name?: string
  rcicNumber?: string
  rcicName?: string
  address?: string
  phone?: string
  email?: string
  logoUrl?: string
}): Promise<boolean> {
  if (isSupabaseSource()) return (await sbWrites()).updateFirmSettings(data)
  return true
}

