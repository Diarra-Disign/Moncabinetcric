import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  assignQuestionnaire,
  saveQuestionnaireProgress,
  submitQuestionnaire,
  requestQuestionnaireCorrections,
  updateQuestionnaireByConsultant,
  validateQuestionnaire,
  lockQuestionnaire,
  getClientQuestionnairesByMatterId,
  getClientQuestionnairesByClientId,
  getClientQuestionnaireById,
} from '../index.js'

describe('Client Questionnaires Unit Tests (Mock Mode)', () => {
  const testMatterId = 'DOS-35695'
  const testClientId = 'c-1'

  test('should assign a new study permit questionnaire', async () => {
    const q = await assignQuestionnaire(testMatterId, testClientId, 'study_permit')
    
    assert.ok(q.id)
    assert.equal(q.clientId, testClientId)
    assert.equal(q.matterId, testMatterId)
    assert.equal(q.formType, 'study_permit')
    assert.equal(q.status, 'draft')
    assert.equal(q.progress, 0)
    assert.deepEqual(q.answers, {})
    assert.deepEqual(q.corrections, [])
    assert.deepEqual(q.history, [])
  })

  test('should save questionnaire progress and update status', async () => {
    const assigned = await assignQuestionnaire(testMatterId, testClientId, 'work_permit')
    
    const answers = { lastName: 'Diarra', firstName: 'Adama' }
    const updated = await saveQuestionnaireProgress(assigned.id, answers, 15)
    
    assert.equal(updated.id, assigned.id)
    assert.equal(updated.status, 'in_progress')
    assert.equal(updated.progress, 15)
    assert.deepEqual(updated.answers, answers)
    assert.ok(updated.lastSavedAt)
  })

  test('should submit questionnaire to consultant review', async () => {
    const assigned = await assignQuestionnaire(testMatterId, testClientId, 'pr')
    const submitted = await submitQuestionnaire(assigned.id)
    
    assert.equal(submitted.status, 'submitted')
  })

  test('should request corrections from client', async () => {
    const assigned = await assignQuestionnaire(testMatterId, testClientId, 'study_permit')
    const corrections = [
      {
        sectionId: 'personal_info',
        comment: 'Veuillez saisir votre deuxième prénom.',
        status: 'pending' as const,
        requestedAt: new Date().toISOString()
      }
    ]
    const updated = await requestQuestionnaireCorrections(assigned.id, corrections)
    
    assert.equal(updated.status, 'to_correct')
    assert.deepEqual(updated.corrections, corrections)
  })

  test('should log edits in history when consultant modifies answers', async () => {
    const assigned = await assignQuestionnaire(testMatterId, testClientId, 'study_permit')
    const initialAnswers = { lastName: 'Tremblay' }
    await saveQuestionnaireProgress(assigned.id, initialAnswers, 10)

    const consultantAnswers = { lastName: 'Tremblay-Lefebvre' }
    const historyEntry = [
      {
        userId: 'user-c1',
        userName: 'Adama Diarra',
        userType: 'consultant' as const,
        changedAt: new Date().toISOString(),
        sectionId: 'personal_info',
        fieldKey: 'lastName',
        fieldName: 'Nom de famille',
        oldValue: 'Tremblay',
        newValue: 'Tremblay-Lefebvre'
      }
    ]

    const updated = await updateQuestionnaireByConsultant(assigned.id, consultantAnswers, historyEntry)
    
    assert.deepEqual(updated.answers, consultantAnswers)
    assert.equal(updated.history.length, 1)
    assert.equal(updated.history[0].oldValue, 'Tremblay')
    assert.equal(updated.history[0].newValue, 'Tremblay-Lefebvre')
  })

  test('should validate and lock questionnaire', async () => {
    const assigned = await assignQuestionnaire(testMatterId, testClientId, 'study_permit')
    
    const validated = await validateQuestionnaire(assigned.id)
    assert.equal(validated.status, 'validated')

    const locked = await lockQuestionnaire(assigned.id)
    assert.equal(locked.status, 'locked')
  })

  test('should query questionnaires by matter, client and id', async () => {
    // Nettoyer / réinitialiser le store n'est pas strictement nécessaire pour assert.ok
    const assigned = await assignQuestionnaire(testMatterId, testClientId, 'study_permit')
    
    const byMatter = await getClientQuestionnairesByMatterId(testMatterId)
    assert.ok(byMatter.some(item => item.id === assigned.id))

    const byClient = await getClientQuestionnairesByClientId(testClientId)
    assert.ok(byClient.some(item => item.id === assigned.id))

    const byId = await getClientQuestionnaireById(assigned.id)
    assert.ok(byId)
    assert.equal(byId?.id, assigned.id)
  })
})
