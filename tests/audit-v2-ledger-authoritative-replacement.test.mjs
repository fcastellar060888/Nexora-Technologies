import test from 'node:test'
import assert from 'node:assert/strict'
import { createDomainEvent, DomainEvents } from '../src/core/events/index.js'
import { createLedgerEntry, createMemoryLedgerRepository } from '../src/core/ledger/index.js'

const event = (eventId, overrides = {}) => createDomainEvent({
  name: DomainEvents.COMPANY_CREATED,
  aggregateType: 'company',
  aggregateId: `company-${eventId}`,
  organizationId: 'audit-company',
  actorId: 'audit-user',
  occurredAt: '2026-08-04T04:40:00.000Z',
  eventId,
  payload: { label: eventId },
  ...overrides
})

test('Auditoría V2 Ledger: un snapshot parcial no puede borrar identidad local por defecto', () => {
  const ledger = createMemoryLedgerRepository()
  ledger.append(event('local-1'), { sequence: 1 })
  ledger.append(event('local-2'), { sequence: 2 })
  const remote = createLedgerEntry(event('local-1'), { sequence: 1, recordedAt: '2026-08-04T04:40:01.000Z' })

  assert.throws(
    () => ledger.replaceMany([remote]),
    /omite|identidades conocidas|authoritative/i
  )
  assert.deepEqual(ledger.find({ order: 'asc' }).map(entry => entry.id), ['local-1', 'local-2'])
})

test('Auditoría V2 Ledger: un snapshot completo y autoritativo puede reemplazar explícitamente', () => {
  const ledger = createMemoryLedgerRepository()
  ledger.append(event('local'), { sequence: 1 })
  const remote = createLedgerEntry(event('remote'), { sequence: 9, recordedAt: '2026-08-04T04:40:01.000Z' })

  ledger.replaceMany([remote], { authoritative: true })
  assert.equal(ledger.getByEventId('local'), null)
  assert.equal(ledger.getByEventId('remote').sequence, 9)
  assert.equal(ledger.append(event('next')).sequence, 10)
})

test('Auditoría V2 Ledger: reemplazo autoritativo no puede reescribir un eventId conocido', () => {
  const ledger = createMemoryLedgerRepository()
  ledger.append(event('stable'), { sequence: 4 })
  const collision = createLedgerEntry(event('stable', { payload: { label: 'contenido distinto' } }), {
    sequence: 4,
    recordedAt: '2026-08-04T04:40:01.000Z'
  })

  assert.throws(
    () => ledger.replaceMany([collision], { authoritative: true }),
    /evento diferente|eventId/i
  )
  assert.equal(ledger.getByEventId('stable').event.payload.label, 'stable')
})

test('Auditoría V2 Ledger: reemplazo no puede reasignar la secuencia histórica de un eventId', () => {
  const ledger = createMemoryLedgerRepository()
  ledger.append(event('stable-sequence'), { sequence: 4 })
  const moved = createLedgerEntry(event('stable-sequence'), {
    sequence: 8,
    recordedAt: '2026-08-04T04:40:01.000Z'
  })

  assert.throws(
    () => ledger.replaceMany([moved], { authoritative: true }),
    /cambiar de secuencia histórica/i
  )
  assert.equal(ledger.getByEventId('stable-sequence').sequence, 4)
})
