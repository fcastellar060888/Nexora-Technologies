import test from 'node:test'
import assert from 'node:assert/strict'
import { createDomainEvent } from '../src/core/events/index.js'
import { createMemoryLedgerRepository } from '../src/core/ledger/index.js'

function event(id) {
  return createDomainEvent({
    eventId: id,
    name: 'audit.ledger.recorded',
    aggregateType: 'audit.record',
    aggregateId: id,
    organizationId: 'audit-v2-ledger',
    actorId: 'auditor',
    occurredAt: '2026-08-04T02:05:00.000Z',
    payload: { id }
  })
}

const tick = () => new Promise(resolve => setImmediate(resolve))

test('Auditoría V2 Ledger: un rechazo asíncrono de listener queda contenido y observable', async () => {
  const ledger = createMemoryLedgerRepository({ onListenerError: () => {} })
  ledger.subscribe(async () => {
    await tick()
    throw new Error('fallo asíncrono del listener')
  })

  const unhandled = []
  const capture = reason => { unhandled.push(reason) }
  process.on('unhandledRejection', capture)
  try {
    const entry = ledger.append(event('async-listener-1'))
    assert.equal(entry.id, 'async-listener-1')
    await tick()
    await tick()

    assert.equal(unhandled.length, 0)
    assert.equal(ledger.getListenerErrors().length, 1)
    assert.match(ledger.getListenerErrors()[0].message, /fallo asíncrono/)
    assert.equal(ledger.health().listenerFailureCount, 1)
    assert.equal(ledger.health().status, 'degraded')
  } finally {
    process.off('unhandledRejection', capture)
  }
})
