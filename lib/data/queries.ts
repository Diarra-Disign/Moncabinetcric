import { Matter, Lead, InvoiceRecord, ClientRecord, DocumentRecord, FolderRecord, ImmigrationProgram, CalendarEvent, AuditLogRecord, ActionApprovalRecord, DeadlineRule, CiccComplianceScore } from "./types"
import { MOCK_MATTERS } from "./mock/matters"
import { MOCK_LEADS } from "./mock/leads"
import { MOCK_INVOICES } from "./mock/invoices"
import { MOCK_CLIENTS } from "./mock/clients"
import { MOCK_DOCUMENTS, MOCK_FOLDERS } from "./mock/documents"
import { MOCK_EVENTS } from "./mock/events"
import { IMMIGRATION_PROGRAMS, getPrograms as getProgramsFromRef, getProgramByName as getProgramByNameFromRef } from "./programs"

// Internal mutable stores for demo persistence in memory during session
let mattersStore: Matter[] = [...MOCK_MATTERS]
let leadsStore: Lead[] = [...MOCK_LEADS]
let invoicesStore: InvoiceRecord[] = [...MOCK_INVOICES]
let clientsStore: ClientRecord[] = [...MOCK_CLIENTS]
let documentsStore: DocumentRecord[] = [...MOCK_DOCUMENTS]
const foldersStore: FolderRecord[] = [...MOCK_FOLDERS]
const eventsStore: CalendarEvent[] = [...MOCK_EVENTS]

// MATTERS
export async function getMatters(): Promise<Matter[]> {
  return mattersStore
}

export async function getMatterById(id: string): Promise<Matter | undefined> {
  const decodedId = decodeURIComponent(id)
  return mattersStore.find(m => m.id === decodedId || m.id === `#${decodedId}` || m.id.replace("#", "") === decodedId.replace("#", ""))
}

export async function getMattersByClientId(clientId: string): Promise<Matter[]> {
  return mattersStore.filter(m => m.clientId === clientId)
}

// LEADS
export async function getLeads(): Promise<Lead[]> {
  return leadsStore
}

export async function getLeadById(id: string): Promise<Lead | undefined> {
  return leadsStore.find(l => l.id === id)
}

// INVOICES
export async function getInvoices(): Promise<InvoiceRecord[]> {
  return invoicesStore
}

export async function getInvoicesByMatterId(matterId: string): Promise<InvoiceRecord[]> {
  const decodedId = decodeURIComponent(matterId)
  return invoicesStore.filter(i => 
    i.matterId === decodedId || 
    i.matterId === `#${decodedId}` || 
    i.matterId?.replace("#", "") === decodedId.replace("#", "")
  )
}

export async function getInvoicesByClientId(clientId: string): Promise<InvoiceRecord[]> {
  return invoicesStore.filter(i => i.clientId === clientId)
}

// CLIENTS
export async function getClients(): Promise<ClientRecord[]> {
  return clientsStore
}

export async function getClientById(id: string): Promise<ClientRecord | undefined> {
  return clientsStore.find(c => c.id === id)
}

// DOCUMENTS & FOLDERS
export async function getDocuments(): Promise<DocumentRecord[]> {
  return documentsStore
}

export async function getFolders(): Promise<FolderRecord[]> {
  return foldersStore
}

export async function getDocumentsByMatterId(matterId: string): Promise<DocumentRecord[]> {
  const decodedId = decodeURIComponent(matterId)
  return documentsStore.filter(d => 
    d.matterId === decodedId || 
    d.matterId === `#${decodedId}` || 
    d.matterId?.replace("#", "") === decodedId.replace("#", "")
  )
}

// EVENTS
export async function getEvents(): Promise<CalendarEvent[]> {
  return eventsStore
}

// AGREEMENTS & GOVERNMENT FEES
import { MOCK_AGREEMENTS, MOCK_GOVERNMENT_FEES, MOCK_CLAUSES } from "./mock/agreements"
import { AgreementRecord, ClauseDefinition, GovernmentFee } from "./types"

let agreementsStore: AgreementRecord[] = [...MOCK_AGREEMENTS]

export async function getAgreements(): Promise<AgreementRecord[]> {
  return agreementsStore
}

export async function getAgreementById(id: string): Promise<AgreementRecord | undefined> {
  return agreementsStore.find(a => a.id === id || a.reference === id)
}

export async function getGovernmentFees(): Promise<GovernmentFee[]> {
  return MOCK_GOVERNMENT_FEES
}

export async function getClauses(): Promise<ClauseDefinition[]> {
  return MOCK_CLAUSES
}

// DEADLINES & COMPLIANCE
import { MOCK_DEADLINE_RECORDS, OFFICIAL_DEADLINE_RULES, OFFICIAL_CICC_COMPLIANCE_SCORE } from "./mock/deadlines"

let deadlinesStore: DeadlineRecord[] = [...MOCK_DEADLINE_RECORDS]

export async function getDeadlines(): Promise<DeadlineRecord[]> {
  return deadlinesStore
}

export async function getDeadlineRules(): Promise<DeadlineRule[]> {
  return OFFICIAL_DEADLINE_RULES
}

export async function getCiccComplianceScore(): Promise<CiccComplianceScore> {
  return OFFICIAL_CICC_COMPLIANCE_SCORE
}

export async function getComplianceScore(): Promise<CiccComplianceScore> {
  return OFFICIAL_CICC_COMPLIANCE_SCORE
}

// ACCESS TO INTERNAL STORE (for actions.ts mutation)
export function _getStores() {
  return {
    mattersStore,
    leadsStore,
    invoicesStore,
    clientsStore,
    documentsStore,
    foldersStore,
    agreementsStore,
    deadlinesStore,
    setMattersStore: (newVal: Matter[]) => { mattersStore = newVal },
    setLeadsStore: (newVal: Lead[]) => { leadsStore = newVal },
    setInvoicesStore: (newVal: InvoiceRecord[]) => { invoicesStore = newVal },
    setClientsStore: (newVal: ClientRecord[]) => { clientsStore = newVal },
    setDocumentsStore: (newVal: DocumentRecord[]) => { documentsStore = newVal },
    setAgreementsStore: (newVal: AgreementRecord[]) => { agreementsStore = newVal },
    setDeadlinesStore: (newVal: DeadlineRecord[]) => { deadlinesStore = newVal }
  }
}

export async function getAuditLogs(): Promise<AuditLogRecord[]> {
  const { MOCK_AUDIT_LOGS } = await import("./mock/audit")
  return MOCK_AUDIT_LOGS
}

export async function getApprovalQueue(): Promise<ActionApprovalRecord[]> {
  const { MOCK_APPROVAL_QUEUE } = await import("./mock/audit")
  return MOCK_APPROVAL_QUEUE
}

import { INITIAL_AI_CONNECTOR_SETTINGS, INITIAL_AI_API_KEYS, INITIAL_AI_CONNECTOR_LOGS } from "./mock/connector"
import { AiConnectorSettings, AiApiKeyRecord, AiConnectorLogRecord } from "./types"

let aiConnectorSettingsStore: AiConnectorSettings = { ...INITIAL_AI_CONNECTOR_SETTINGS }
let aiApiKeysStore: AiApiKeyRecord[] = [...INITIAL_AI_API_KEYS]
let aiConnectorLogsStore: AiConnectorLogRecord[] = [...INITIAL_AI_CONNECTOR_LOGS]

export async function getAiConnectorSettings(): Promise<AiConnectorSettings> {
  return aiConnectorSettingsStore
}

export async function getAiApiKeys(): Promise<AiApiKeyRecord[]> {
  return aiApiKeysStore
}

export async function getAiConnectorLogs(): Promise<AiConnectorLogRecord[]> {
  return aiConnectorLogsStore
}

export function _getAiStores() {
  return {
    aiConnectorSettingsStore,
    aiApiKeysStore,
    aiConnectorLogsStore,
    setAiConnectorSettingsStore: (val: AiConnectorSettings) => { aiConnectorSettingsStore = val },
    setAiApiKeysStore: (val: AiApiKeyRecord[]) => { aiApiKeysStore = val },
    setAiConnectorLogsStore: (val: AiConnectorLogRecord[]) => { aiConnectorLogsStore = val }
  }
}
