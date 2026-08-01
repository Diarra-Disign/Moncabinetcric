"use server"

import { Matter, Lead, InvoiceRecord, ClientRecord, DocumentRecord } from "./types"
import { _getStores } from "./queries"
import { generateChecklistForProgram } from "./programs"

export async function createMatter(data: Omit<Matter, "id"> & { id?: string }): Promise<Matter> {
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
  const stores = _getStores()
  const idx = stores.leadsStore.findIndex(l => l.id === id)
  if (idx === -1) return undefined
  const updated = { ...stores.leadsStore[idx], stage }
  const newArr = [...stores.leadsStore]
  newArr[idx] = updated
  stores.setLeadsStore(newArr)
  return updated
}

export async function createInvoice(data: Omit<InvoiceRecord, "id"> & { id?: string }): Promise<InvoiceRecord> {
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
  const stores = _getStores()
  const idx = stores.documentsStore.findIndex(d => d.id === id)
  if (idx === -1) return false
  const newArr = stores.documentsStore.filter(d => d.id !== id)
  stores.setDocumentsStore(newArr)
  return true
}

export async function restoreDocumentRecord(id: string): Promise<DocumentRecord | undefined> {
  const stores = _getStores()
  const idx = stores.documentsStore.findIndex(d => d.id === id)
  if (idx === -1) return undefined
  const updated: DocumentRecord = { ...stores.documentsStore[idx], status: "valid" }
  const newArr = [...stores.documentsStore]
  newArr[idx] = updated
  stores.setDocumentsStore(newArr)
  return updated
}
