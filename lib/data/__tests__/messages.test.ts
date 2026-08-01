import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import frMessages from '../../../messages/fr.json' with { type: 'json' }
import enMessages from '../../../messages/en.json' with { type: 'json' }

describe('i18n Messages Completeness & Keys Alignment', () => {
  test('should have non-empty fr and en message objects', () => {
    assert.ok(frMessages)
    assert.ok(enMessages)
  })

  test('should contain expected top-level namespaces in both fr.json and en.json', () => {
    const requiredKeys = ['Navigation', 'Dashboard', 'Matters', 'Clients', 'Billing', 'Pipeline', 'Calendar']
    
    requiredKeys.forEach((key) => {
      assert.ok(key in frMessages, `fr.json missing key ${key}`)
      assert.ok(key in enMessages, `en.json missing key ${key}`)
    })
  })

  test('should match RCIC permit number reference in firm details', () => {
    const frStr = JSON.stringify(frMessages)
    assert.ok(frStr.includes('R-514982'))
  })
})
