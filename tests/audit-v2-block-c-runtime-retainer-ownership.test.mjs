import test from 'node:test'
import assert from 'node:assert/strict'
import {
  clearKnowledgeGraphRuntimes,
  getKnowledgeGraphForScope,
  knowledgeGraphScopeCount,
  retainKnowledgeGraphScope,
  releaseKnowledgeGraphScope,
  releaseRetainedKnowledgeGraphScope
} from '../src/core/knowledgeGraph/index.js'

const scope = Object.freeze({ organizationId: 'org-retained', actorId: 'actor-retained' })

function flushMicrotasks() {
  return new Promise(resolve => queueMicrotask(resolve))
}

test.beforeEach(() => clearKnowledgeGraphRuntimes())

test('Auditoría V2 Graph runtime: una liberación forzada no puede destruir un scope con consumidores activos', () => {
  const lease = retainKnowledgeGraphScope(scope)

  assert.throws(
    () => releaseKnowledgeGraphScope(scope),
    /retenido|consumidor|activo/i
  )
  assert.equal(getKnowledgeGraphForScope(scope), lease.repository)
  assert.equal(knowledgeGraphScopeCount(), 1)
})

test('Auditoría V2 Graph runtime: una liberación sin adquisición propia no consume la retención de otro consumidor', async () => {
  const lease = retainKnowledgeGraphScope(scope)

  const released = releaseRetainedKnowledgeGraphScope(scope)
  await flushMicrotasks()

  assert.equal(released, false)
  assert.equal(getKnowledgeGraphForScope(scope), lease.repository)
  assert.equal(knowledgeGraphScopeCount(), 1)
})

test('Auditoría V2 Graph runtime: una lease no puede liberar otro scope ni reutilizarse', async () => {
  const foreignScope = { organizationId: 'org-foreign', actorId: 'actor-foreign' }
  const lease = retainKnowledgeGraphScope(scope)

  assert.equal(releaseRetainedKnowledgeGraphScope(foreignScope, lease), false)
  assert.equal(lease.release(), true)
  assert.equal(lease.release(), false)
  await flushMicrotasks()

  assert.equal(knowledgeGraphScopeCount(), 0)
})
