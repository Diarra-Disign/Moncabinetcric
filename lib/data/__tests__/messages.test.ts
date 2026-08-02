import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import frMessages from '../../../messages/fr.json' with { type: 'json' }
import enMessages from '../../../messages/en.json' with { type: 'json' }
import { FIRM_DATA } from '../firm.js'

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

  test('should keep the RCIC permit number out of the translation catalogues', () => {
    // Le numéro de permis est un identifiant réglementaire, identique en
    // français et en anglais. Il n'a donc pas à être traduit : sa source
    // unique de vérité est FIRM_DATA. Le dupliquer dans les catalogues
    // exposerait les deux copies à diverger.
    assert.equal(FIRM_DATA.rcicNumber, 'R-514982')

    for (const [name, catalogue] of [['fr.json', frMessages], ['en.json', enMessages]] as const) {
      assert.ok(
        !JSON.stringify(catalogue).includes(FIRM_DATA.rcicNumber),
        `${name} ne doit pas contenir le numéro de permis en dur — utiliser FIRM_DATA`
      )
    }
  })
})
