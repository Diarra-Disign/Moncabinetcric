import {
  Matter,
  Lead,
  InvoiceRecord,
  ClientRecord,
  DocumentRecord,
  FolderRecord,
  CalendarEvent,
  AgreementRecord,
  DeadlineRecord,
  LegislationProvision,
  ResearchWorkspace,
} from "./types"
import { MOCK_MATTERS } from "./mock/matters"
import { MOCK_LEADS } from "./mock/leads"
import { MOCK_INVOICES } from "./mock/invoices"
import { MOCK_CLIENTS } from "./mock/clients"
import { MOCK_DOCUMENTS, MOCK_FOLDERS } from "./mock/documents"
import { MOCK_EVENTS } from "./mock/events"
import { MOCK_AGREEMENTS } from "./mock/agreements"
import { MOCK_DEADLINE_RECORDS } from "./mock/deadlines"
import { MOCK_LEGISLATION_PROVISIONS, MOCK_RESEARCH_WORKSPACES } from "./mock/legislation"

/**
 * Magasins en mémoire de la source « mock ».
 *
 * Ce module existe pour une raison précise de frontière serveur/client :
 * `actions.ts` est un module "use server" que des composants clients
 * importent légitimement, et il a besoin d'accéder aux magasins. Tant que
 * ces magasins vivaient dans `queries.ts`, le graphe de modules devenait
 *
 *   composant client → actions.ts → queries.ts → supabase/reads.ts
 *
 * et `supabase/reads.ts` importe "server-only", qui lève à l'évaluation
 * dans un bundle navigateur. En isolant les magasins ici, `actions.ts`
 * n'atteint plus `queries.ts`, seul module à connaître Supabase.
 *
 * Ces magasins ne persistent rien : leur contenu disparaît au redémarrage
 * du serveur. Ils seront retirés quand la couche d'écriture Supabase sera
 * en place.
 */

let mattersStore: Matter[] = [...MOCK_MATTERS]
let leadsStore: Lead[] = [...MOCK_LEADS]
let invoicesStore: InvoiceRecord[] = [...MOCK_INVOICES]
let clientsStore: ClientRecord[] = [...MOCK_CLIENTS]
let documentsStore: DocumentRecord[] = [...MOCK_DOCUMENTS]
let agreementsStore: AgreementRecord[] = [...MOCK_AGREEMENTS]
let deadlinesStore: DeadlineRecord[] = [...MOCK_DEADLINE_RECORDS]
let legislationProvisionsStore: LegislationProvision[] = [...MOCK_LEGISLATION_PROVISIONS]
let researchWorkspacesStore: ResearchWorkspace[] = [...MOCK_RESEARCH_WORKSPACES]

// Les trois variables du connecteur qui vivaient ici étaient partagées par
// tout le processus, donc par tous les cabinets. Elles sont en base,
// cloisonnées — voir la migration 20260806100000_connector_auth.sql.

const foldersStore: FolderRecord[] = [...MOCK_FOLDERS]
const eventsStore: CalendarEvent[] = [...MOCK_EVENTS]

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
    setDeadlinesStore: (newVal: DeadlineRecord[]) => { deadlinesStore = newVal },
  }
}

export function _getResearchStores() {
  return {
    legislationProvisionsStore,
    researchWorkspacesStore,
    setLegislationProvisionsStore: (val: LegislationProvision[]) => { legislationProvisionsStore = val },
    setResearchWorkspacesStore: (val: ResearchWorkspace[]) => { researchWorkspacesStore = val },
  }
}


/** Lecture directe d'une disposition, sans passer par queries.ts. */
export function _findLegislationProvision(id: string): LegislationProvision | undefined {
  return legislationProvisionsStore.find((p) => p.id === id)
}

export const _mockStores = {
  get matters() { return mattersStore },
  get leads() { return leadsStore },
  get invoices() { return invoicesStore },
  get clients() { return clientsStore },
  get documents() { return documentsStore },
  get folders() { return foldersStore },
  get events() { return eventsStore },
  get agreements() { return agreementsStore },
  get deadlines() { return deadlinesStore },
  get legislationProvisions() { return legislationProvisionsStore },
  get researchWorkspaces() { return researchWorkspacesStore },
}
