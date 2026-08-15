import test from 'node:test'
import assert from 'node:assert/strict'
import { createDomainEvent } from '../src/core/events/index.js'
import { createMemoryLedgerRepository } from '../src/core/ledger/index.js'
import { replayLedger } from '../src/core/projectionEngine/index.js'

const event = id => createDomainEvent({
  eventId: id,
  name: 'cultivation.plant.updated',
  aggregateType: 'cultivation.plant',
  aggregateId: id,
  organizationId: 'org-a',
  actorId: 'user-a',
  occurredAt: '2026-08-04T12:00:00.000Z',
  payload: { id }
})

function ledgerWith(...ids) {
  const ledger = createMemoryLedgerRepository()
  for (const id of ids) ledger.append(event(id))
  return ledger
}

test('Auditoría V2 replay: un fallo de onResult no reclasifica una proyección exitosa', async () => {
  const ledger = ledgerWith('evt-1')
  const projected = []
  const result = await replayLedger(ledger, {
    replay: async value => {
      projected.push(value.eventId)
      return { status: 'succeeded' }
    }
  }, {
    onResult: () => { throw new Error('observador de resultado defectuoso') }
  })

  assert.deepEqual(projected, ['evt-1'])
  assert.equal(result.processed, 1)
  assert.equal(result.succeeded, 1)
  assert.equal(result.failed, 0)
  assert.equal(result.results.length, 1)
  assert.equal(result.results[0].error, null)
})

test('Auditoría V2 replay: un fallo de onError queda contenido y permite continuar', async () => {
  const ledger = ledgerWith('evt-1', 'evt-2')
  const attempted = []
  const result = await replayLedger(ledger, {
    replay: async value => {
      attempted.push(value.eventId)
      if (value.eventId === 'evt-1') throw new Error('fallo de proyección')
      return { status: 'succeeded' }
    }
  }, {
    onError: () => { throw new Error('observador de error defectuoso') }
  })

  assert.deepEqual(attempted, ['evt-1', 'evt-2'])
  assert.equal(result.processed, 2)
  assert.equal(result.failed, 1)
  assert.equal(result.succeeded, 1)
  assert.equal(result.results[0].error, 'fallo de proyección')
  assert.equal(result.results[1].error, null)
})

test('Reauditoría D: rechazos asíncronos de observadores tampoco alteran el reporte', async () => {
  const ledger = ledgerWith('evt-1', 'evt-2')
  const result = await replayLedger(ledger, {
    replay: async value => {
      if (value.eventId === 'evt-2') throw new Error('fallo esperado')
      return { status: 'succeeded' }
    }
  }, {
    onResult: async () => { throw new Error('rechazo asíncrono de resultado') },
    onError: async () => { throw new Error('rechazo asíncrono de error') }
  })

  await new Promise(resolve => setImmediate(resolve))
  assert.equal(result.processed, 2)
  assert.equal(result.succeeded, 1)
  assert.equal(result.failed, 1)
  assert.equal(result.results.length, 2)
})
