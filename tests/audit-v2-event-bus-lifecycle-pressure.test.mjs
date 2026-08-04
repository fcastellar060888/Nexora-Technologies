import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createEventBus,
  createDomainEvent,
  getEventBusForScope,
  releaseEventBusScope
} from '../src/core/events/index.js'

function event(id, organizationId = 'company-a') {
  return createDomainEvent({
    eventId: id,
    name: 'audit.event.executed',
    aggregateType: 'audit.record',
    aggregateId: id,
    organizationId,
    actorId: 'auditor',
    occurredAt: '2026-08-03T23:45:00.000Z',
    payload: { id }
  })
}

const tick = () => new Promise(resolve => setImmediate(resolve))

test('Auditoría V2 A.3: timeout aborta un handler colgado y permite liberar el scope', async () => {
  const scope = { organizationId: 'audit-v2-hung', actorId: 'auditor' }
  const bus = getEventBusForScope(scope, { handlerTimeoutMs: 10, onError: () => {} })
  let receivedSignal
  bus.subscribe('audit.event.executed', (_event, { signal }) => {
    receivedSignal = signal
    return new Promise(resolve => signal.addEventListener('abort', resolve, { once: true }))
  })

  const publication = bus.publish(event('hung-1', scope.organizationId))
  await tick()
  assert.throws(() => releaseEventBusScope(scope), /publicaciones activas/)

  const result = await publication
  assert.equal(result.failed, 1)
  assert.equal(result.pending, true)
  assert.match(result.errors[0], /timeout de 10 ms/)
  assert.equal(receivedSignal.aborted, true)
  assert.equal(releaseEventBusScope(scope), true)
})

test('Auditoría V2 A.3: un handler que venció puede reintentarse con un contexto nuevo', async () => {
  const bus = createEventBus({ handlerTimeoutMs: 10, onError: () => {} })
  let attempts = 0
  const signals = []
  bus.subscribe('audit.event.executed', async (_event, { signal, timeoutMs }) => {
    attempts += 1
    signals.push(signal)
    assert.equal(timeoutMs, 10)
    if (attempts === 1) await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true }))
  })

  const first = await bus.publish(event('timeout-retry'))
  const second = await bus.publish(event('timeout-retry'))

  assert.equal(first.failed, 1)
  assert.equal(second.failed, 0)
  assert.equal(second.retry, true)
  assert.equal(attempts, 2)
  assert.notEqual(signals[0], signals[1])
  assert.equal(signals[0].aborted, true)
  assert.equal(signals[1].aborted, false)
})

test('Auditoría V2 A.3: backpressure limita concurrencia y conserva todos los trabajos en cola', async () => {
  const bus = createEventBus({ maxConcurrentPublications: 4 })
  let active = 0
  let peak = 0
  let unblock
  const gate = new Promise(resolve => { unblock = resolve })

  bus.subscribe('audit.event.executed', async () => {
    active += 1
    peak = Math.max(peak, active)
    await gate
    active -= 1
  })

  const publications = Array.from({ length: 20 }, (_, index) => bus.publish(event(`pressure-${index}`)))
  await tick()
  try {
    assert.equal(peak, 4)
    assert.deepEqual(bus.status(), {
      activePublications: 4,
      queuedPublications: 16,
      inFlight: 20,
      completedEvents: 0,
      pendingFailures: 0,
      reservedCompleted: 20,
      reservedFailures: 20,
      maxConcurrentPublications: 4,
      maxCompletedEvents: 10000,
      maxPendingFailures: 1000,
      remainingCompletedCapacity: 9980,
      remainingFailureCapacity: 980
    })
  } finally {
    unblock()
  }

  const results = await Promise.all(publications)
  assert.ok(results.every(result => result.failed === 0))
  assert.equal(bus.status().activePublications, 0)
  assert.equal(bus.status().queuedPublications, 0)
  assert.equal(bus.status().inFlight, 0)
  assert.equal(bus.status().reservedCompleted, 0)
  assert.equal(bus.status().reservedFailures, 0)
})

test('Auditoría V2 A.3: capacidad de completados bloquea antes de ejecutar y compacta explícitamente', async () => {
  const bus = createEventBus({ maxCompletedEvents: 2 })
  let deliveries = 0
  bus.subscribe('audit.event.executed', () => { deliveries += 1 })

  await bus.publish(event('completed-a'))
  await bus.publish(event('completed-b'))
  await assert.rejects(bus.publish(event('completed-c')), /capacidad de eventos completados/)
  assert.equal(deliveries, 2)
  assert.equal(bus.status().remainingCompletedCapacity, 0)

  const report = bus.compactCompleted({ remove: ['completed-a'] })
  assert.deepEqual(report, { removed: 1, remaining: 1 })
  await bus.publish(event('completed-c'))
  assert.equal(deliveries, 3)

  const stillProtected = await bus.publish(event('completed-b'))
  assert.equal(stillProtected.duplicate, true)
})

test('Auditoría V2 A.3: fallos pendientes saturan de forma visible y requieren compactación explícita', async () => {
  const bus = createEventBus({ maxPendingFailures: 2, onError: () => {} })
  bus.subscribe('audit.event.executed', async () => { throw new Error('permanent failure') })

  await bus.publish(event('failure-a'))
  await bus.publish(event('failure-b'))
  await assert.rejects(bus.publish(event('failure-c')), /capacidad de fallos pendientes/)
  assert.equal(bus.getPendingFailures().length, 2)

  const report = bus.compactPendingFailures({ remove: ['failure-a'] })
  assert.deepEqual(report, { removed: 1, remaining: 1 })
  const third = await bus.publish(event('failure-c'))
  assert.equal(third.failed, 1)
  assert.equal(bus.getPendingFailures().length, 2)
})

test('Auditoría V2 A.3: compactación se rechaza mientras existen publicaciones activas', async () => {
  const bus = createEventBus({ maxConcurrentPublications: 1 })
  let unblock
  bus.subscribe('audit.event.executed', () => new Promise(resolve => { unblock = resolve }))
  const publication = bus.publish(event('compact-active'))
  await tick()

  assert.throws(() => bus.compactCompleted({ remove: [] }), /publicaciones activas/)
  assert.throws(() => bus.compactPendingFailures({ remove: [] }), /publicaciones activas/)

  unblock()
  await publication
})

test('Auditoría V2 A.3: deduplicación completada permanece independiente del historial', async () => {
  const bus = createEventBus({ maxHistory: 1, maxCompletedEvents: 500 })
  let deliveries = 0
  bus.subscribe('audit.event.executed', () => { deliveries += 1 })

  await bus.publish(event('completed-oldest'))
  for (let index = 0; index < 200; index += 1) {
    await bus.publish(event(`completed-${index}`))
  }

  const duplicate = await bus.publish(event('completed-oldest'))
  assert.equal(duplicate.duplicate, true)
  assert.equal(deliveries, 201)
  assert.equal(bus.getHistory().length, 1)
})

test('Auditoría V2 A.3: rechaza límites operativos inválidos', () => {
  assert.throws(() => createEventBus({ handlerTimeoutMs: 0 }), /entero positivo/)
  assert.throws(() => createEventBus({ handlerTimeoutMs: 1.5 }), /entero positivo/)
  assert.throws(() => createEventBus({ maxConcurrentPublications: 0 }), /entero positivo/)
  assert.throws(() => createEventBus({ maxCompletedEvents: 0 }), /entero positivo/)
  assert.throws(() => createEventBus({ maxPendingFailures: 0 }), /entero positivo/)
})
