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

test('Auditoría V2 A.3: eventos distintos no tienen backpressure y comienzan simultáneamente', async () => {
  const bus = createEventBus()
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

  const publications = Array.from({ length: 250 }, (_, index) => bus.publish(event(`pressure-${index}`)))
  await tick()
  assert.equal(peak, 250)

  unblock()
  await Promise.all(publications)
})

test('Auditoría V2 A.3: fallos permanentes se conservan sin límite operativo visible', async () => {
  const bus = createEventBus({ onError: () => {} })
  bus.subscribe('audit.event.executed', async () => { throw new Error('permanent failure') })

  await Promise.all(Array.from({ length: 100 }, (_, index) => bus.publish(event(`failure-${index}`))))

  const pending = bus.getPendingFailures()
  assert.equal(pending.length, 100)
  assert.ok(pending.every(item => item.failedHandlers === 1))
})

test('Auditoría V2 A.3: deduplicación completada sobrevive indefinidamente al recorte de historial', async () => {
  const bus = createEventBus({ maxHistory: 1 })
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

test('Auditoría V2 A.3: rechaza timeouts de handler inválidos', () => {
  assert.throws(() => createEventBus({ handlerTimeoutMs: 0 }), /entero positivo/)
  assert.throws(() => createEventBus({ handlerTimeoutMs: 1.5 }), /entero positivo/)
})
