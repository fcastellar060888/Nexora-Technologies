import test from 'node:test'
import assert from 'node:assert/strict'
import { createDomainEvent, DomainEvents } from '../src/core/events/index.js'
import { createLedgerEntry, createMemoryLedgerRepository } from '../src/core/ledger/index.js'

const event = (eventId, aggregateId = eventId) => createDomainEvent({
  name: DomainEvents.COMPANY_CREATED,
  aggregateType: 'company',
  aggregateId,
  organizationId: 'company-1',
  actorId: 'user-1',
  occurredAt: '2026-08-04T10:00:00.000Z',
  eventId,
  payload: { label: aggregateId },
  metadata: {}
})

const waitUntil = async predicate => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return
    await new Promise(resolve => setTimeout(resolve, 1))
  }
  throw new Error('La condición asíncrona no se cumplió')
}

test('Auditoría V2 Ledger: listeners que terminan fuera de orden no alteran secuencia ni snapshot canónico', async () => {
  const ledger = createMemoryLedgerRepository()
  const releases = new Map()
  const completed = []
  ledger.subscribe(entry => new Promise(resolve => {
    releases.set(entry.id, () => { completed.push(entry.id); resolve() })
  }))

  ledger.append(event('event-1'))
  ledger.append(event('event-2'))
  assert.deepEqual(ledger.find({ order: 'asc' }).map(entry => [entry.id, entry.sequence]), [
    ['event-1', 1],
    ['event-2', 2]
  ])
  assert.equal(ledger.health().activeListeners, 2)

  releases.get('event-2')()
  await waitUntil(() => ledger.health().activeListeners === 1)
  releases.get('event-1')()
  await waitUntil(() => ledger.health().activeListeners === 0)

  assert.deepEqual(completed, ['event-2', 'event-1'])
  assert.deepEqual(ledger.find({ order: 'asc' }).map(entry => [entry.id, entry.sequence]), [
    ['event-1', 1],
    ['event-2', 2]
  ])
})

test('Auditoría V2 Ledger: reconciliar mientras un listener previo trabaja conserva ambas identidades', async () => {
  const ledger = createMemoryLedgerRepository()
  let release
  ledger.subscribe(() => new Promise(resolve => { release = resolve }))
  ledger.append(event('local'), { sequence: 1 })

  const remote = createLedgerEntry(event('remote'), {
    sequence: 7,
    recordedAt: '2026-08-04T10:00:01.000Z'
  })
  const reconciled = ledger.reconcileMany([remote])
  assert.deepEqual(reconciled.map(entry => entry.id), ['local', 'remote'])
  assert.equal(ledger.getByEventId('local').sequence, 1)
  assert.equal(ledger.getByEventId('remote').sequence, 7)

  release()
  await waitUntil(() => ledger.health().activeListeners === 0)
  assert.equal(ledger.append(event('next')).sequence, 8)
})

test('Auditoría V2 Ledger: un fallo tardío se atribuye a la entrada correcta sin degradar otras identidades', async () => {
  const ledger = createMemoryLedgerRepository()
  ledger.subscribe(async entry => {
    await Promise.resolve()
    if (entry.id === 'bad') throw new Error('fallo tardío controlado')
  })

  ledger.appendMany([event('good'), event('bad')])
  await waitUntil(() => ledger.health().activeListeners === 0)

  const errors = ledger.getListenerErrors()
  assert.equal(errors.length, 1)
  assert.equal(errors[0].entryId, 'bad')
  assert.equal(errors[0].sequence, 2)
  assert.equal(ledger.getByEventId('good').sequence, 1)
  assert.equal(ledger.getByEventId('bad').sequence, 2)
})
