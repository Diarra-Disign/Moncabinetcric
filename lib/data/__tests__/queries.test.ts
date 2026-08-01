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
    const matter = await getMatterById('DOS-35695')
    assert.ok(matter)
    assert.equal(matter?.id, 'DOS-35695')
    assert.equal(matter?.clientName, 'M. Adama Diarra')
  })

  test('should fetch all clients', async () => {
    const clients = await getClients()
    assert.ok(clients)
    assert.ok(clients.length > 0)
  })

  test('should fetch a specific client by ID', async () => {
    const client = await getClientById('CLI-1001')
    assert.ok(client)
    assert.equal(client?.id, 'CLI-1001')
  })

  test('should fetch all invoices', async () => {
    const invoices = await getInvoices()
    assert.ok(invoices)
    assert.ok(invoices.length > 0)
  })

  test('should fetch invoices linked to a specific matter ID', async () => {
    const invoices = await getInvoicesByMatterId('DOS-35695')
    assert.ok(invoices)
    assert.ok(invoices.every(inv => inv.matterId === 'DOS-35695'))
  })

  test('should fetch calendar events', async () => {
    const events = await getEvents()
    expectEvents: assert.ok(events)
    assert.ok(events.length > 0)
  })
})
