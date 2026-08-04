import test from 'node:test'
import assert from 'node:assert/strict'

import {
  createDomainEvent,
  createEventBus,
  getEventBusForScope,
  releaseEventBusScope
} from '../src/core/events/index.js'

function event(overrides = {}) {
  return createDomainEvent({
    name: 'audit.event.executed',
    aggregateType: 'audit.event',
    aggregateId: overrides.aggregateId ?? 'aggregate-1',
    organizationId: overrides.organizationId ?? 'company-a',
    actorId: overrides.actorId ?? 'auditor',
    eventId: overrides.eventId ?? crypto.randomUUID(),
    occurredAt: overrides.occurredAt ?? '2026-08-03T23:30:00.000Z',
    payload: overrides.payload ?? {},
    metadata: overrides.metadata ?? {}
  })
}

function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

test('Auditoría V2 A.2: cien publicaciones concurrentes del mismo evento comparten una sola entrega', async () => {
  const bus = createEventBus()
  const gate = deferred()
  let deliveries = 0
  bus.subscribe('audit.event.executed', async () => {
    deliveries += 1
    await gate.promise
  })

  const current = event({ eventId: 'v2-a2-shared' })
  const publications = Array.from({ length: 100 }, () => bus.publish(current))
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(deliveries, 1)

  gate.resolve()
  const results = await Promise.all(publications)
  assert.equal(deliveries, 1)
  assert.equal(results.filter(result => !result.duplicate).length, 100)
  assert.ok(results.every(result => result.delivered === 1))
  assert.equal(bus.getHistory().length, 1)
})

test('Auditoría V2 A.2: alta y baja durante dispatch solo afectan publicaciones posteriores', async () => {
  const bus = createEventBus()
  const gate = deferred()
  const calls = []

  const lateHandler = current => calls.push(`late:${current.eventId}`)
  let unsubscribeSecond
  bus.subscribe('audit.event.executed', async current => {
    calls.push(`first:${current.eventId}`)
    bus.subscribe('audit.event.executed', lateHandler)
    unsubscribeSecond()
    await gate.promise
  })
  unsubscribeSecond = bus.subscribe('audit.event.executed', current => {
    calls.push(`second:${current.eventId}`)
  })

  const firstPublish = bus.publish(event({ eventId: 'v2-a2-subscriptions-1' }))
  await new Promise(resolve => setImmediate(resolve))
  gate.resolve()
  await firstPublish

  assert.deepEqual(calls, [
    'first:v2-a2-subscriptions-1',
    'second:v2-a2-subscriptions-1'
  ])

  await bus.publish(event({ eventId: 'v2-a2-subscriptions-2' }))
  assert.deepEqual(calls, [
    'first:v2-a2-subscriptions-1',
    'second:v2-a2-subscriptions-1',
    'first:v2-a2-subscriptions-2',
    'late:v2-a2-subscriptions-2'
  ])
})

test('Auditoría V2 A.2: reintentos concurrentes ejecutan una sola vez cada handler pendiente', async () => {
  const bus = createEventBus({ onError: () => {} })
  let successfulCalls = 0
  let flakyCalls = 0
  let shouldFail = true
  const retryGate = deferred()

  bus.subscribe('audit.event.executed', () => {
    successfulCalls += 1
  })
  bus.subscribe('audit.event.executed', async () => {
    flakyCalls += 1
    if (shouldFail) throw new Error('fallo transitorio')
    await retryGate.promise
  })

  const current = event({ eventId: 'v2-a2-retry' })
  const first = await bus.publish(current)
  assert.equal(first.failed, 1)
  assert.equal(successfulCalls, 1)
  assert.equal(flakyCalls, 1)

  shouldFail = false
  const retries = Array.from({ length: 50 }, () => bus.publish(current))
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(successfulCalls, 1)
  assert.equal(flakyCalls, 2)

  retryGate.resolve()
  const results = await Promise.all(retries)
  assert.equal(successfulCalls, 1)
  assert.equal(flakyCalls, 2)
  assert.ok(results.every(result => result.retry === true))
  assert.equal(bus.getPendingFailures().length, 0)
  assert.equal(bus.getHistory().length, 1)
})

test('Auditoría V2 A.2: eventos distintos avanzan concurrentemente sin starvation global', async () => {
  const bus = createEventBus()
  const slowGate = deferred()
  const completed = []

  bus.subscribe('audit.event.executed', async current => {
    if (current.eventId === 'v2-a2-slow') await slowGate.promise
    completed.push(current.eventId)
  })

  const slow = bus.publish(event({ eventId: 'v2-a2-slow' }))
  const fast = bus.publish(event({ eventId: 'v2-a2-fast' }))
  await fast

  assert.deepEqual(completed, ['v2-a2-fast'])
  slowGate.resolve()
  await slow
  assert.deepEqual(completed, ['v2-a2-fast', 'v2-a2-slow'])
})

test('Auditoría V2 A.2: scopes con el mismo eventId mantienen entrega e historia independientes', async () => {
  const scopeA = { organizationId: 'company-a', actorId: 'auditor' }
  const scopeB = { organizationId: 'company-b', actorId: 'auditor' }
  const busA = getEventBusForScope(scopeA)
  const busB = getEventBusForScope(scopeB)
  let callsA = 0
  let callsB = 0

  busA.subscribe('audit.event.executed', () => { callsA += 1 })
  busB.subscribe('audit.event.executed', () => { callsB += 1 })

  await Promise.all([
    busA.publish(event({ eventId: 'shared-event-id', organizationId: 'company-a' })),
    busB.publish(event({ eventId: 'shared-event-id', organizationId: 'company-b' }))
  ])

  assert.equal(callsA, 1)
  assert.equal(callsB, 1)
  assert.equal(busA.getHistory().length, 1)
  assert.equal(busB.getHistory().length, 1)

  assert.equal(releaseEventBusScope(scopeA), true)
  assert.equal(releaseEventBusScope(scopeB), true)
})
