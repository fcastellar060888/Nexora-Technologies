import test from 'node:test'
import assert from 'node:assert/strict'
import { createDomainEvent, DomainEvents } from '../src/core/events/index.js'
import { createLedgerEntry, createMemoryLedgerRepository } from '../src/core/ledger/index.js'

const event = (id, overrides = {}) => createDomainEvent({
  name: DomainEvents.COMPANY_CREATED,
  aggregateType: 'company',
  aggregateId: `aggregate-${id}`,
  organizationId: 'company-a',
  actorId: 'auditor',
  occurredAt: '2026-08-04T10:00:00.000Z',
  eventId: id,
  payload: { label: id },
  metadata: { actorName: 'Auditor V2' },
  ...overrides
})

test('Auditoría V2 Ledger final: secuencia e identidad permanecen inmutables tras retención, reconcile y replace', () => {
  const ledger = createMemoryLedgerRepository({ maxEntries: 2, maxKnownEntries: 10 })
  const first = ledger.append(event('event-1'), { sequence: 4 })
  ledger.append(event('event-2'), { sequence: 8 })
  ledger.append(event('event-3'), { sequence: 12 })

  assert.equal(ledger.getByEventId('event-1'), null)
  assert.equal(ledger.append(event('event-1')).sequence, first.sequence)
  const reconciled = ledger.reconcileMany([
    createLedgerEntry(event('event-1'), { sequence: 5, recordedAt: '2026-08-04T10:00:01.000Z' })
  ])
  assert.equal(reconciled.some(entry => entry.id === 'event-1'), false)
  assert.equal(ledger.append(event('event-1')).sequence, first.sequence)
  assert.throws(() => ledger.replaceMany([
    createLedgerEntry(event('event-1', { payload: { label: 'alterado' } }), { sequence: 4 })
  ], { authoritative: true }), /evento diferente/)
  assert.equal(ledger.health().nextSequence, 13)
})

test('Auditoría V2 Ledger final: appendMany y reconcileMany conservan atomicidad y contador', () => {
  const ledger = createMemoryLedgerRepository()
  ledger.append(event('base'), { sequence: 3 })
  const before = ledger.health()

  assert.throws(() => ledger.appendMany([
    createLedgerEntry(event('batch-ok'), { sequence: 7 }),
    createLedgerEntry(event('batch-collision'), { sequence: 3 })
  ]), /secuencia 3 ya pertenece/)
  assert.equal(ledger.getByEventId('batch-ok'), null)
  assert.equal(ledger.health().nextSequence, before.nextSequence)

  assert.throws(() => ledger.reconcileMany([
    createLedgerEntry(event('remote-ok'), { sequence: 9 }),
    createLedgerEntry(event('remote-collision'), { sequence: 3 })
  ]), /secuencia 3 ya pertenece/)
  assert.equal(ledger.getByEventId('remote-ok'), null)
  assert.equal(ledger.health().nextSequence, before.nextSequence)
})

test('Auditoría V2 Ledger final: consultas y snapshots no exponen estado mutable', () => {
  const ledger = createMemoryLedgerRepository()
  ledger.append(event('immutable-1'))
  ledger.append(event('immutable-2'))

  const snapshot = ledger.find({ order: 'asc' })
  snapshot.reverse()
  assert.deepEqual(ledger.find({ order: 'asc' }).map(entry => entry.id), ['immutable-1', 'immutable-2'])
  assert.equal(Object.isFrozen(ledger.getByEventId('immutable-1')), true)
  assert.equal(Object.isFrozen(ledger.getByEventId('immutable-1').event), true)
})

test('Auditoría V2 Ledger final: clear restablece identidad, secuencia y salud operativa', () => {
  const ledger = createMemoryLedgerRepository({ maxEntries: 2, maxKnownEntries: 4 })
  ledger.append(event('clear-1'))
  ledger.append(event('clear-2'))
  ledger.clear()

  assert.equal(ledger.count(), 0)
  assert.equal(ledger.getByEventId('clear-1'), null)
  assert.deepEqual(ledger.health(), {
    status: 'ready',
    driver: 'memory',
    entries: 0,
    knownEntries: 0,
    maxKnownEntries: 4,
    remainingKnownCapacity: 4,
    activeListeners: 0,
    nextSequence: 1,
    maxEntries: 2,
    listenerFailureCount: 0,
    listenerErrorsRetained: 0,
    lastListenerError: null
  })
  assert.equal(ledger.append(event('clear-1')).sequence, 1)
})

test('Auditoría V2 Ledger final: misma operación produce el mismo orden y secuencias', () => {
  const build = () => {
    const ledger = createMemoryLedgerRepository()
    ledger.appendMany([event('det-1'), event('det-2'), event('det-3')])
    return ledger.find({ order: 'asc' }).map(entry => ({ id: entry.id, sequence: entry.sequence }))
  }
  assert.deepEqual(build(), build())
})
