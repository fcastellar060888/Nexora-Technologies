import test from 'node:test'
import assert from 'node:assert/strict'
import { createDomainEvent, DomainEvents } from '../src/core/events/index.js'
import {
  createMemoryLedgerRepository,
  getOperationalLedgerForScope,
  releaseOperationalLedgerScope
} from '../src/core/ledger/index.js'

const domainEvent = (eventId, overrides = {}) => createDomainEvent({
  name: DomainEvents.COMPANY_CREATED,
  aggregateType: 'company',
  aggregateId: `company-${eventId}`,
  organizationId: 'audit-company',
  actorId: 'audit-user',
  occurredAt: '2026-08-04T03:20:00.000Z',
  eventId,
  payload: { label: eventId },
  ...overrides
})

const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

const nextTurn = () => new Promise(resolve => setImmediate(resolve))

test('Auditoría V2 Ledger: no libera un scope mientras un listener asíncrono sigue activo', async () => {
  const scope = { organizationId: 'audit-release-company', actorId: 'audit-release-user' }
  const ledger = getOperationalLedgerForScope(scope)
  const gate = deferred()
  ledger.subscribe(async () => gate.promise)
  ledger.append(domainEvent('release-pending', { organizationId: scope.organizationId, actorId: scope.actorId }))

  assert.equal(ledger.health().activeListeners, 1)
  assert.throws(
    () => releaseOperationalLedgerScope(scope),
    /listener|observador|activo|curso/i
  )

  gate.resolve()
  await nextTurn()
  assert.equal(ledger.health().activeListeners, 0)
  assert.equal(releaseOperationalLedgerScope(scope), true)
})

test('Auditoría V2 Ledger: limpiar errores recientes recupera salud sin borrar el contador histórico', async () => {
  const ledger = createMemoryLedgerRepository()
  ledger.subscribe(async () => { throw new Error('listener temporal') })
  ledger.append(domainEvent('health-recovery'))
  await nextTurn()

  assert.equal(ledger.health().status, 'degraded')
  assert.equal(ledger.health().listenerFailureCount, 1)
  ledger.clearListenerErrors()
  assert.equal(ledger.health().listenerFailureCount, 1)
  assert.equal(ledger.health().status, 'ready')
})

test('Auditoría V2 Ledger: capacidad de identidad histórica bloquea antes de perder idempotencia', () => {
  const ledger = createMemoryLedgerRepository({ maxEntries: 1, maxKnownEntries: 2 })
  ledger.append(domainEvent('known-1'))
  ledger.append(domainEvent('known-2'))

  assert.throws(() => ledger.append(domainEvent('known-3')), /capacidad|identidad|históric/i)
  assert.equal(ledger.health().knownEntries, 2)
  assert.equal(ledger.health().remainingKnownCapacity, 0)
  assert.equal(ledger.count(), 1)
  assert.equal(ledger.append(domainEvent('known-1')).id, 'known-1')
})
