import { Matter, Lead, InvoiceRecord, ClientRecord, DocumentRecord, FolderRecord, ImmigrationProgram, CalendarEvent, AuditLogRecord, ActionApprovalRecord, DeadlineRule, CiccComplianceScore, DeadlineRecord, LegislationProvision, ResearchWorkspace } from "./types"
import { MOCK_MATTERS } from "./mock/matters"
import { MOCK_LEADS } from "./mock/leads"
import { MOCK_INVOICES } from "./mock/invoices"
import { MOCK_CLIENTS } from "./mock/clients"
import { MOCK_DOCUMENTS, MOCK_FOLDERS } from "./mock/documents"
import { MOCK_EVENTS } from "./mock/events"
import { MOCK_LEGISLATION_PROVISIONS, MOCK_RESEARCH_WORKSPACES } from "./mock/legislation"
import { searchProvisions } from "./legislation-search"
import { IMMIGRATION_PROGRAMS, getPrograms as getProgramsFromRef, getProgramByName as getProgramByNameFromRef } from "./programs"
import { isSupabaseSource } from "./source"
import { _mockStores } from "./stores"

// Réexportés pour compatibilité : leur définition vit désormais dans ./stores,
// afin qu'actions.ts n'ait plus à importer ce module (voir stores.ts).
export { _getStores, _getResearchStores, _getAiStores } from "./stores"

// Chargement paresseux des lectures Supabase.
//
// L'import est dynamique et non statique à dessein : ./supabase/reads
// importe "server-only", qui lève dès qu'il est évalué hors du bundler
// Next — ce qui casserait le lanceur de tests et tout usage de ce module
// en dehors d'un Server Component. En mode mock, ce module n'est donc
// jamais chargé.
const sbReads = () => import("./supabase/reads")

//
// Les entités dont la table n'est pas encore peuplée (dossiers du coffre,
// ententes, référentiels réglementaires, échéances, connecteur IA)
// restent servies par les mocks, quelle que soit la valeur de DATA_SOURCE.


// MATTERS
export async function getMatters(): Promise<Matter[]> {
  if (isSupabaseSource()) return (await sbReads()).getMatters()
  return _mockStores.matters
}

export async function getMatterById(id: string): Promise<Matter | undefined> {
  if (isSupabaseSource()) return (await sbReads()).getMatterById(id)
  const decodedId = decodeURIComponent(id)
  return _mockStores.matters.find(m => m.id === decodedId || m.id === `#${decodedId}` || m.id.replace("#", "") === decodedId.replace("#", ""))
}

export async function getMattersByClientId(clientId: string): Promise<Matter[]> {
  if (isSupabaseSource()) return (await sbReads()).getMattersByClientId(clientId)
  return _mockStores.matters.filter(m => m.clientId === clientId)
}

// LEADS
export async function getLeads(): Promise<Lead[]> {
  if (isSupabaseSource()) return (await sbReads()).getLeads()
  return _mockStores.leads
}

export async function getLeadById(id: string): Promise<Lead | undefined> {
  if (isSupabaseSource()) return (await sbReads()).getLeadById(id)
  return _mockStores.leads.find(l => l.id === id)
}

// INVOICES
export async function getInvoices(): Promise<InvoiceRecord[]> {
  if (isSupabaseSource()) return (await sbReads()).getInvoices()
  return _mockStores.invoices
}

export async function getInvoicesByMatterId(matterId: string): Promise<InvoiceRecord[]> {
  if (isSupabaseSource()) return (await sbReads()).getInvoicesByMatterId(matterId)
  const decodedId = decodeURIComponent(matterId)
  return _mockStores.invoices.filter(i => 
    i.matterId === decodedId || 
    i.matterId === `#${decodedId}` || 
    i.matterId?.replace("#", "") === decodedId.replace("#", "")
  )
}

export async function getInvoicesByClientId(clientId: string): Promise<InvoiceRecord[]> {
  if (isSupabaseSource()) return (await sbReads()).getInvoicesByClientId(clientId)
  return _mockStores.invoices.filter(i => i.clientId === clientId)
}

// CLIENTS
export async function getClients(): Promise<ClientRecord[]> {
  if (isSupabaseSource()) return (await sbReads()).getClients()
  return _mockStores.clients
}

export async function getClientById(id: string): Promise<ClientRecord | undefined> {
  if (isSupabaseSource()) return (await sbReads()).getClientById(id)
  return _mockStores.clients.find(c => c.id === id)
}

// DOCUMENTS & FOLDERS
export async function getDocuments(): Promise<DocumentRecord[]> {
  if (isSupabaseSource()) return (await sbReads()).getDocuments()
  return _mockStores.documents
}

// Les dossiers du coffre restent des agrégats calculés côté mock :
// aucune table folders n'existe encore.
export async function getFolders(): Promise<FolderRecord[]> {
  return _mockStores.folders
}

export async function getDocumentsByMatterId(matterId: string): Promise<DocumentRecord[]> {
  if (isSupabaseSource()) return (await sbReads()).getDocumentsByMatterId(matterId)
  const decodedId = decodeURIComponent(matterId)
  return _mockStores.documents.filter(d => 
    d.matterId === decodedId || 
    d.matterId === `#${decodedId}` || 
    d.matterId?.replace("#", "") === decodedId.replace("#", "")
  )
}

// EVENTS
export async function getEvents(): Promise<CalendarEvent[]> {
  if (isSupabaseSource()) return (await sbReads()).getEvents()
  return _mockStores.events
}

// AGREEMENTS & GOVERNMENT FEES
import { MOCK_AGREEMENTS, MOCK_GOVERNMENT_FEES, MOCK_CLAUSES } from "./mock/agreements"
import { AgreementRecord, ClauseDefinition, GovernmentFee } from "./types"


export async function getAgreements(): Promise<AgreementRecord[]> {
  return _mockStores.agreements
}

export async function getAgreementById(id: string): Promise<AgreementRecord | undefined> {
  return _mockStores.agreements.find(a => a.id === id || a.reference === id)
}

export async function getGovernmentFees(): Promise<GovernmentFee[]> {
  return MOCK_GOVERNMENT_FEES
}

export async function getClauses(): Promise<ClauseDefinition[]> {
  return MOCK_CLAUSES
}

// DEADLINES & COMPLIANCE
import { MOCK_DEADLINE_RECORDS, OFFICIAL_DEADLINE_RULES, OFFICIAL_CICC_COMPLIANCE_SCORE } from "./mock/deadlines"


export async function getDeadlines(): Promise<DeadlineRecord[]> {
  return _mockStores.deadlines
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


export async function getAuditLogs(): Promise<AuditLogRecord[]> {
  if (isSupabaseSource()) return (await sbReads()).getAuditLogs()
  const { MOCK_AUDIT_LOGS } = await import("./mock/audit")
  return MOCK_AUDIT_LOGS
}

export async function getDocumentAuditLog(): Promise<AuditLogRecord[]> {
  if (isSupabaseSource()) return (await sbReads()).getDocumentAuditLog()
  const { MOCK_DOCUMENT_AUDIT_LOG } = await import("./mock/doc-audit")
  return MOCK_DOCUMENT_AUDIT_LOG
}

export async function getApprovalQueue(): Promise<ActionApprovalRecord[]> {
  const { MOCK_APPROVAL_QUEUE } = await import("./mock/audit")
  return MOCK_APPROVAL_QUEUE
}

import { INITIAL_AI_CONNECTOR_SETTINGS, INITIAL_AI_API_KEYS, INITIAL_AI_CONNECTOR_LOGS } from "./mock/connector"
import { AiConnectorSettings, AiApiKeyRecord, AiConnectorLogRecord } from "./types"


export async function getAiConnectorSettings(): Promise<AiConnectorSettings> {
  return _mockStores.aiConnectorSettings
}

export async function getAiApiKeys(): Promise<AiApiKeyRecord[]> {
  return _mockStores.aiApiKeys
}

export async function getAiConnectorLogs(): Promise<AiConnectorLogRecord[]> {
  return _mockStores.aiConnectorLogs
}



/**
 * Nombre de dispositions renvoyées au navigateur en une fois.
 *
 * Le corpus complet pèse environ 1,4 Mo : l'expédier en entier à chaque
 * chargement de page annulerait le bénéfice de l'import. On ne transmet
 * donc qu'une tranche, et la recherche s'exécute côté serveur.
 */
export const LEGISLATION_PAGE_SIZE = 60

export async function getLegislationProvisions(
  instrumentFilter?: string,
  query?: string
): Promise<LegislationProvision[]> {
  // Même moteur que la recherche client : une seule sémantique de recherche
  // dans le projet, sinon les deux divergent — ce qui était déjà le cas ici,
  // cette fonction reproduisait la comparaison naïve corrigée côté client.
  return searchProvisions([..._mockStores.legislationProvisions], query ?? "", instrumentFilter ?? "all")
}

export async function searchLegislation(
  query: string,
  instrumentFilter: string,
  limit: number = LEGISLATION_PAGE_SIZE
): Promise<{ items: LegislationProvision[]; total: number }> {
  const matched = searchProvisions([..._mockStores.legislationProvisions], query, instrumentFilter)
  return { items: matched.slice(0, limit), total: matched.length }
}

export async function getLegislationProvisionById(id: string): Promise<LegislationProvision | undefined> {
  return _mockStores.legislationProvisions.find(p => p.id === id)
}

export async function getResearchWorkspaces(): Promise<ResearchWorkspace[]> {
  return [..._mockStores.researchWorkspaces].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getResearchWorkspaceById(id: string): Promise<ResearchWorkspace | undefined> {
  return _mockStores.researchWorkspaces.find(w => w.id === id)
}


