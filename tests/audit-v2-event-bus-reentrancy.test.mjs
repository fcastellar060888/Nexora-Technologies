import test from 'node:test'
import assert from 'node:assert/strict'

import { createDomainEvent } from '../src/core/events/eventContract.js'
import {
  createEventBus,
  getEventBusForScope,
  releaseEventBusScope
} from '../src/core/events/eventBus.js'

function event({ eventId, name = 'audit.event.executed', payload = {} }) {
  return createDomainEvent({
    eventId,
    name,
    aggregateType: 'audit.target',
    aggregateId: 'target-1',
    organizationId: 'audit-company',
    actorId: 'audit-user',
    occurredAt: '2026-08-03T22:30:00.000Z',
    payload
  })
}

test('Auditoría V2 A.1: publicación reentrante de otro evento conserva ambas entregas e historia', async () => {
  const bus = createEventBus()
  const delivered = []
  const parent = event({ eventId: 'audit-v2-parent', name: 'audit.parent.executed' })
  const child = event({ eventId: 'audit-v2-child', name: 'audit.child.executed' })

  bus.subscribe(parent.name, async current => {
    delivered.push(current.eventId)
    const nested = await bus.publish(child)
    assert.equal(nested.failed, 0)
  })
  bus.subscribe(child.name, current => delivered.push(current.eventId))

  const result = await bus.publish(parent)

  assert.equal(result.failed, 0)
  assert.deepEqual(delivered, ['audit-v2-parent', 'audit-v2-child'])
  assert.deepEqual(bus.getHistory({ limit: 10 }).map(item => item.eventId), [
    'audit-v2-child',
    'audit-v2-parent'
  ])
})

test('Auditoría V2 A.1: republicación reentrante del mismo evento no se espera a sí misma ni duplica handlers', async () => {
  const bus = createEventBus()
  const current = event({ eventId: 'audit-v2-self' })
  let executions = 0
  let nestedResult

  bus.subscribe(current.name, async received => {
    executions += 1
    nestedResult = await bus.publish(received)
  })

  const result = await bus.publish(current)

  assert.equal(result.failed, 0)
  assert.equal(executions, 1)
  assert.equal(nestedResult.duplicate, true)
  assert.equal(nestedResult.inFlight, true)
  assert.equal(bus.getHistory({ limit: 10 }).length, 1)
})

test('Auditoría V2 A.1: un mismo callback específico y universal se entrega una sola vez', async () => {
  const bus = createEventBus()
  const current = event({ eventId: 'audit-v2-overlap' })
  let executions = 0
  const handler = () => { executions += 1 }

  bus.subscribe(current.name, handler)
  bus.subscribe('*', handler)

  const result = await bus.publish(current)

  assert.equal(result.failed, 0)
  assert.equal(result.delivered, 1)
  assert.equal(executions, 1)
})

test('Auditoría V2 A.1: liberar un scope durante una entrega falla atómicamente y permite liberarlo después', async () => {
  const scope = { organizationId: 'audit-v2-lifecycle', actorId: 'auditor' }
  const bus = getEventBusForScope(scope)
  const current = event({ eventId: 'audit-v2-active-scope' })
  let releaseHandler
  const gate = new Promise(resolve => { releaseHandler = resolve })

  bus.subscribe(current.name, () => gate)
  const publishing = bus.publish(current)
  await Promise.resolve()

  assert.throws(
    () => releaseEventBusScope(scope),
    /publicaciones activas/
  )
  assert.equal(getEventBusForScope(scope), bus)

  releaseHandler()
  await publishing

  assert.equal(releaseEventBusScope(scope), true)
  assert.notEqual(getEventBusForScope(scope), bus)
  assert.equal(releaseEventBusScope(scope), true)
})
