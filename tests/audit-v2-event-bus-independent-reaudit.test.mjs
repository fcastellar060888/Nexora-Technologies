import test from 'node:test'
import assert from 'node:assert/strict'
import { createEventBus, createDomainEvent } from '../src/core/events/index.js'

function event(id) {
  return createDomainEvent({
    eventId: id,
    name: 'audit.event.executed',
    aggregateType: 'audit.record',
    aggregateId: id,
    organizationId: 'audit-v2-independent',
    actorId: 'auditor',
    occurredAt: '2026-08-04T01:30:00.000Z',
    payload: { id }
  })
}

const tick = () => new Promise(resolve => setImmediate(resolve))
const settled = promise => promise.then(
  value => ({ status: 'fulfilled', value }),
  reason => ({ status: 'rejected', reason })
)

test('Auditoría V2 independiente: publicaciones concurrentes no exceden capacidad de completados', async () => {
  const bus = createEventBus({ maxCompletedEvents: 1, maxConcurrentPublications: 2 })
  let release
  const gate = new Promise(resolve => { release = resolve })
  bus.subscribe('audit.event.executed', async () => gate)

  const first = settled(bus.publish(event('capacity-completed-1')))
  const second = settled(bus.publish(event('capacity-completed-2')))
  await tick()
  release()

  const results = await Promise.all([first, second])
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
  assert.equal(results.filter(result => result.status === 'rejected').length, 1)
  assert.match(String(results.find(result => result.status === 'rejected').reason?.message), /capacidad de eventos completados/)
  assert.equal(bus.status().completedEvents, 1)
  assert.equal(bus.status().remainingCompletedCapacity, 0)
})

test('Auditoría V2 independiente: publicaciones concurrentes no exceden capacidad de fallos pendientes', async () => {
  const bus = createEventBus({ maxPendingFailures: 1, maxConcurrentPublications: 2, onError: () => {} })
  let release
  const gate = new Promise(resolve => { release = resolve })
  bus.subscribe('audit.event.executed', async () => {
    await gate
    throw new Error('fallo concurrente')
  })

  const first = settled(bus.publish(event('capacity-failure-1')))
  const second = settled(bus.publish(event('capacity-failure-2')))
  await tick()
  release()

  const results = await Promise.all([first, second])
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
  assert.equal(results.filter(result => result.status === 'rejected').length, 1)
  assert.match(String(results.find(result => result.status === 'rejected').reason?.message), /capacidad de fallos pendientes/)
  assert.equal(bus.status().pendingFailures, 1)
  assert.equal(bus.status().remainingFailureCapacity, 0)
})
