import test from 'node:test'
import assert from 'node:assert/strict'

import {
  clearKnowledgeGraphRuntimes,
  getKnowledgeGraphForScope,
  knowledgeGraphRuntimeKey,
  knowledgeGraphScopeCount,
  releaseKnowledgeGraphScope
} from '../src/core/knowledgeGraph/graphRuntime.js'
import { createGraphNode } from '../src/core/knowledgeGraph/graphContract.js'

function node(nodeId, organizationId, label = nodeId) {
  return createGraphNode({
    nodeId,
    nodeType: 'cultivation.plant',
    organizationId,
    label,
    createdAt: '2026-08-04T00:00:00.000Z',
    updatedAt: '2026-08-04T00:00:00.000Z'
  })
}

test.beforeEach(() => clearKnowledgeGraphRuntimes())

test('Auditoría V2 Graph runtime: scopes distintos no pueden colisionar por el delimitador interno', () => {
  const scopeA = { organizationId: 'company::west', actorId: 'operator' }
  const scopeB = { organizationId: 'company', actorId: 'west::operator' }

  assert.notEqual(knowledgeGraphRuntimeKey(scopeA), knowledgeGraphRuntimeKey(scopeB))

  const graphA = getKnowledgeGraphForScope(scopeA)
  const graphB = getKnowledgeGraphForScope(scopeB)
  assert.notStrictEqual(graphA, graphB)

  graphA.addNode(node('shared-id', 'company::west', 'A'))
  graphB.addNode(node('shared-id', 'company', 'B'))

  assert.equal(graphA.getNode('shared-id').label, 'A')
  assert.equal(graphB.getNode('shared-id').label, 'B')
  assert.equal(knowledgeGraphScopeCount(), 2)
})

test('Auditoría V2 Graph runtime: la identidad del scope no ejecuta coerciones implícitas', () => {
  let calls = 0
  const hostile = { toString() { calls += 1; return 'company-a' } }

  assert.throws(
    () => knowledgeGraphRuntimeKey({ organizationId: hostile, actorId: 'operator' }),
    /empresa|texto|scope/i
  )
  assert.equal(calls, 0)
})

test('Auditoría V2 Graph runtime: liberar y recrear un scope produce un repositorio limpio e independiente', () => {
  const scope = { organizationId: 'company-a', actorId: 'operator' }
  const oldGraph = getKnowledgeGraphForScope(scope)
  oldGraph.addNode(node('plant-1', 'company-a'))

  assert.equal(releaseKnowledgeGraphScope(scope), true)
  assert.equal(oldGraph.snapshot().nodes.length, 0)
  assert.equal(knowledgeGraphScopeCount(), 0)

  const newGraph = getKnowledgeGraphForScope(scope)
  assert.notStrictEqual(newGraph, oldGraph)
  assert.equal(newGraph.snapshot().nodes.length, 0)

  oldGraph.addNode(node('stale-only', 'company-a'))
  assert.equal(newGraph.getNode('stale-only'), null)
})

test('Auditoría V2 Graph runtime: liberar un scope no altera actores ni empresas vecinas', () => {
  const a1 = getKnowledgeGraphForScope({ organizationId: 'company-a', actorId: 'one' })
  const a2 = getKnowledgeGraphForScope({ organizationId: 'company-a', actorId: 'two' })
  const b1 = getKnowledgeGraphForScope({ organizationId: 'company-b', actorId: 'one' })

  a1.addNode(node('same', 'company-a', 'A1'))
  a2.addNode(node('same', 'company-a', 'A2'))
  b1.addNode(node('same', 'company-b', 'B1'))

  assert.equal(releaseKnowledgeGraphScope({ organizationId: 'company-a', actorId: 'one' }), true)
  assert.equal(a2.getNode('same').label, 'A2')
  assert.equal(b1.getNode('same').label, 'B1')
  assert.equal(knowledgeGraphScopeCount(), 2)
})
