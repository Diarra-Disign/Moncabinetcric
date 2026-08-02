import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { 
  getMatters, 
  getMatterById, 
  getClients, 
  getClientById, 
  getInvoices, 
  getInvoicesByMatterId,
  getEvents
} from '../index.js'

describe('Data Queries Unit Tests', () => {
  test('should fetch all matters', async () => {
    const matters = await getMatters()
    assert.ok(matters)
    assert.ok(Array.isArray(matters))
    assert.ok(matters.length > 0)
  })

  test('should fetch a specific matter by ID', async () => {
    // Les dossiers sont stockés avec un dièse ("#DOS-35695"), mais les URL et
    // les liens manipulent aussi la forme nue. La recherche doit accepter les
    // deux et retourner l'identifiant canonique.
    const matter = await getMatterById('DOS-35695')
    assert.ok(matter)
    assert.equal(matter?.id, '#DOS-35695')
    assert.equal(matter?.clientName, 'K. Tremblay')
    assert.equal(matter?.program, "Parrainage d'Époux / Conjoint de fait")
  })

  test('should resolve a matter whether or not the ID carries the # prefix', async () => {
    const bare = await getMatterById('DOS-35695')
    const prefixed = await getMatterById('#DOS-35695')
    assert.ok(bare)
    assert.ok(prefixed)
    assert.equal(bare?.id, prefixed?.id)
  })

  test('should fetch all clients', async () => {
    const clients = await getClients()
    assert.ok(clients)
    assert.ok(clients.length > 0)
  })

  test('should fetch a specific client by ID', async () => {
    // Les clients portent un identifiant court ("c-1"), distinct de leur
    // numéro de dossier lisible ("CRIC-2026-0101").
    const client = await getClientById('c-1')
    assert.ok(client)
    assert.equal(client?.id, 'c-1')
    assert.equal(client?.fileNumber, 'CRIC-2026-0101')
  })

  test('should return undefined for an unknown client ID', async () => {
    const client = await getClientById('client-inexistant')
    assert.equal(client, undefined)
  })

  test('should fetch all invoices', async () => {
    const invoices = await getInvoices()
    assert.ok(invoices)
    assert.ok(invoices.length > 0)
  })

  test('should fetch invoices linked to a specific matter ID', async () => {
    const invoices = await getInvoicesByMatterId('DOS-35695')
    assert.ok(invoices)
    assert.ok(invoices.length > 0, 'au moins une facture doit être rattachée à ce dossier')
    assert.ok(invoices.every(inv => inv.matterId === '#DOS-35695'))
  })

  test('should fetch calendar events', async () => {
    const events = await getEvents()
    assert.ok(events)
    assert.ok(events.length > 0)
  })
})
