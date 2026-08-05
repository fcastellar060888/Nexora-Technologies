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
  const retained = retainKnowledgeGraphScope(scope)
  retained.addNode({
    nodeId: 'node-1',
    organizationId: 'org-retained',
    type: 'cultivation.plant',
    label: 'Planta retenida',
    version: 1,
    createdAt: '2026-08-04T00:00:00.000Z',
    updatedAt: '2026-08-04T00:00:00.000Z',
    source: 'ledger',
    metadata: {}
  })

  assert.throws(
    () => releaseKnowledgeGraphScope(scope),
    /retenido|consumidor|activo/i
  )
  assert.equal(getKnowledgeGraphForScope(scope), retained)
  assert.ok(retained.getNode('node-1'))
  assert.equal(knowledgeGraphScopeCount(), 1)
})

test('Auditoría V2 Graph runtime: una liberación sin adquisición propia no consume la retención de otro consumidor', async () => {
  const retained = retainKnowledgeGraphScope(scope)

  const released = releaseRetainedKnowledgeGraphScope(scope)
  await flushMicrotasks()

  assert.equal(released, false)
  assert.equal(getKnowledgeGraphForScope(scope), retained)
  assert.equal(knowledgeGraphScopeCount(), 1)
})
