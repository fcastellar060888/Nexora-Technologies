import test from 'node:test'
import assert from 'node:assert/strict'
import { createDomainEvent } from '../src/core/events/index.js'
import { createMemoryLedgerRepository } from '../src/core/ledger/index.js'

function event(id, label = id) {
  return createDomainEvent({
    eventId: id,
    name: 'audit.ledger.recorded',
    aggregateType: 'audit.record',
    aggregateId: id,
    organizationId: 'audit-v2-ledger',
    actorId: 'auditor',
    occurredAt: '2026-08-04T03:15:00.000Z',
    payload: { label }
  })
}

test('Auditoría V2 Ledger: la retención no permite reutilizar un eventId ya confirmado', () => {
  const ledger = createMemoryLedgerRepository({ maxEntries: 2 })
  const original = event('retained-identity', 'original')

  ledger.append(original)
  ledger.append(event('second'))
  ledger.append(event('third'))

  assert.equal(ledger.getByEventId('retained-identity'), null)
  assert.throws(
    () => ledger.append(event('retained-identity', 'mutated')),
    /ya pertenece a un evento diferente/
  )
})

test('Auditoría V2 Ledger: un duplicado idéntico recortado sigue siendo idempotente', () => {
  const ledger = createMemoryLedgerRepository({ maxEntries: 2 })
  const original = event('retained-idempotency')
  const first = ledger.append(original)

  ledger.append(event('other-a'))
  ledger.append(event('other-b'))

  const duplicate = ledger.append(original)
  assert.equal(duplicate.id, first.id)
  assert.equal(duplicate.sequence, first.sequence)
  assert.equal(ledger.count(), 2)
})
