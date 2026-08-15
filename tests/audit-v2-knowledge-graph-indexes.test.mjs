import test from 'node:test'
import assert from 'node:assert/strict'
import {createKnowledgeGraphRepository} from '../src/core/knowledgeGraph/graphRepository.js'

const node=(nodeId,organizationId='company-a')=>({
  nodeId,nodeType:'cultivation.plant',organizationId,siteId:null,label:nodeId,status:'active',
  createdAt:'2026-08-04T00:00:00.000Z',updatedAt:'2026-08-04T00:00:00.000Z',metadata:{}
})
const edge=(edgeId,sourceNodeId,targetNodeId,relationType='descends_from',organizationId='company-a')=>({
  edgeId,relationType,sourceNodeId,targetNodeId,organizationId,source:'audit',confidence:1,
  validFrom:'2026-08-04T00:00:00.000Z',validTo:null,createdAt:'2026-08-04T00:00:00.000Z',metadata:{}
})

function graphWithChain(){
  const graph=createKnowledgeGraphRepository()
  for(const id of ['root','child','grandchild'])graph.addNode(node(id))
  graph.addEdge(edge('edge-1','child','root'))
  graph.addEdge(edge('edge-2','grandchild','child'))
  return graph
}

test('Auditoría V2 Graph: neighbors rechaza direcciones desconocidas en vez de devolver un vacío ambiguo',()=>{
  const graph=graphWithChain()
  assert.throws(()=>graph.neighbors('root',{direction:'sideways'}),/direction|dirección/i)
})

test('Auditoría V2 Graph: descendants exige una profundidad entera no negativa y finita',()=>{
  const graph=graphWithChain()
  for(const maxDepth of [-1,1.5,NaN,Infinity,'2']){
    assert.throws(()=>graph.descendants('root',{maxDepth}),/maxDepth|profundidad/i)
  }
})

test('Auditoría V2 Graph: profundidad cero no recorre y profundidad uno no sobrepasa el primer nivel',()=>{
  const graph=graphWithChain()
  assert.deepEqual(graph.descendants('root',{maxDepth:0}),[])
  assert.deepEqual(graph.descendants('root',{maxDepth:1}).map(item=>item.node.nodeId),['child'])
  assert.deepEqual(graph.descendants('root',{maxDepth:2}).map(item=>item.node.nodeId),['child','grandchild'])
})

test('Auditoría V2 Graph: IDs iguales entre nodo y arista no contaminan el índice organizacional',()=>{
  const graph=createKnowledgeGraphRepository()
  graph.addNode(node('shared-id'))
  graph.addNode(node('target'))
  graph.addEdge(edge('shared-id','shared-id','target','located_in'))
  assert.deepEqual(graph.nodesForOrganization('company-a').map(item=>item.nodeId).sort(),['shared-id','target'])
  assert.equal(graph.edgesByRelation('located_in').length,1)
})

test('Auditoría V2 Graph: replaceAll y clear reconstruyen todos los índices sin residuos',()=>{
  const graph=graphWithChain()
  const previousVersion=graph.getVersion()
  graph.replaceAll({
    expectedVersion:previousVersion,
    nodes:[node('a','company-b'),node('b','company-b')],
    edges:[edge('new-edge','a','b','located_in','company-b')]
  })
  assert.deepEqual(graph.nodesForOrganization('company-a'),[])
  assert.deepEqual(graph.edgesByRelation('descends_from'),[])
  assert.deepEqual(graph.nodesForOrganization('company-b').map(item=>item.nodeId).sort(),['a','b'])
  assert.equal(graph.neighbors('a',{direction:'out'}).length,1)
  graph.clear()
  assert.deepEqual(graph.snapshot().nodes,[])
  assert.deepEqual(graph.snapshot().edges,[])
  assert.deepEqual(graph.nodesForOrganization('company-b'),[])
  assert.deepEqual(graph.edgesByRelation('located_in'),[])
  assert.equal(graph.health().organizations,0)
  assert.equal(graph.health().relations,0)
})
