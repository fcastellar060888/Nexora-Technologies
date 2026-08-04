import test from 'node:test'
import assert from 'node:assert/strict'
import { createKnowledgeGraphRepository } from '../src/core/knowledgeGraph/index.js'

const node = (nodeId, overrides = {}) => ({
  nodeId,
  nodeType: 'cultivation.plant',
  organizationId: 'company-a',
  siteId: 'site-a',
  label: nodeId,
  status: 'active',
  createdAt: '2026-08-04T12:00:00.000Z',
  updatedAt: '2026-08-04T12:00:00.000Z',
  metadata: {},
  ...overrides
})

const edge = (edgeId, overrides = {}) => ({
  edgeId,
  relationType: 'located_in',
  sourceNodeId: 'plant-1',
  targetNodeId: 'bed-1',
  organizationId: 'company-a',
  source: 'ledger',
  confidence: 1,
  validFrom: '2026-08-04T12:00:00.000Z',
  validTo: null,
  createdAt: '2026-08-04T12:00:00.000Z',
  metadata: {},
  ...overrides
})

test('Auditoría V2 Graph: reutilizar nodeId con contenido contradictorio no se acepta como duplicado benigno', () => {
  const graph = createKnowledgeGraphRepository()
  graph.addNode(node('plant-1'))

  assert.throws(() => graph.addNode(node('plant-1', {
    label: 'Otra planta',
    updatedAt: '2026-08-04T13:00:00.000Z'
  })), /nodeId|nodo|identidad|diferente/i)

  assert.equal(graph.getNode('plant-1').label, 'plant-1')
  assert.equal(graph.getVersion(), 1)
})

test('Auditoría V2 Graph: reutilizar edgeId con otra relación no se acepta como duplicado benigno', () => {
  const graph = createKnowledgeGraphRepository()
  graph.addNode(node('plant-1'))
  graph.addNode(node('bed-1', { nodeType: 'infrastructure.bed' }))
  graph.addNode(node('room-1', { nodeType: 'infrastructure.room' }))
  graph.addEdge(edge('edge-1'))

  assert.throws(() => graph.addEdge(edge('edge-1', {
    targetNodeId: 'room-1',
    relationType: 'assigned_to'
  })), /edgeId|arista|identidad|diferente/i)

  assert.equal(graph.getEdge('edge-1').targetNodeId, 'bed-1')
  assert.equal(graph.getVersion(), 4)
})

test('Auditoría V2 Graph: duplicados estructuralmente idénticos conservan idempotencia sin avanzar versión', () => {
  const graph = createKnowledgeGraphRepository()
  const firstNode = graph.addNode(node('plant-1'))
  const secondNode = graph.addNode(node('plant-1'))
  graph.addNode(node('bed-1', { nodeType: 'infrastructure.bed' }))
  const firstEdge = graph.addEdge(edge('edge-1'))
  const secondEdge = graph.addEdge(edge('edge-1'))

  assert.equal(firstNode.inserted, true)
  assert.equal(secondNode.inserted, false)
  assert.equal(firstEdge.inserted, true)
  assert.equal(secondEdge.inserted, false)
  assert.equal(graph.getVersion(), 3)
})
