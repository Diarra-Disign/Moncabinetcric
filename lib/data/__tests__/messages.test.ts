import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import frMessages from '../../../messages/fr.json' with { type: 'json' }
import enMessages from '../../../messages/en.json' with { type: 'json' }
import { EMPTY_FIRM } from '../firm.js'

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

  test('should carry no firm identity in the fallback constant', () => {
    // EMPTY_FIRM ne sert qu'à éviter un rendu cassé quand la table firms
    // n'est pas encore renseignée. Y laisser une raison sociale ou surtout
    // un numéro de permis ferait apparaître l'identité d'un autre cabinet
    // sur des ententes et des formulaires IRCC.
    assert.equal(EMPTY_FIRM.name, '')
    assert.equal(EMPTY_FIRM.rcicNumber, '')
    assert.equal(EMPTY_FIRM.rcicName, '')
  })

  test('should keep any RCIC permit number out of the translation catalogues', () => {
    // Un permis est un identifiant réglementaire, identique dans les deux
    // langues : il n'a rien à faire dans un catalogue de traduction. La
    // recherche porte sur le motif complet, pas sur un numéro connu — un
    // permis codé en dur doit être rattrapé quel qu'il soit.
    const permitPattern = /R-?\d{6}/

    for (const [name, catalogue] of [['fr.json', frMessages], ['en.json', enMessages]] as const) {
      const match = JSON.stringify(catalogue).match(permitPattern)
      assert.ok(
        !match,
        `${name} contient un numéro de permis en dur (${match?.[0]}) — il doit venir de la table firms`
      )
    }
  })
})
