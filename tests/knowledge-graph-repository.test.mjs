import test from'node:test'
import assert from'node:assert/strict'
import{createGraphNode,createGraphEdge}from'../src/core/knowledgeGraph/graphContract.js'
import{createKnowledgeGraphRepository}from'../src/core/knowledgeGraph/graphRepository.js'

const at='2026-08-01T12:00:00.000Z'
const node=(nodeId,nodeType='cultivation.plant',organizationId='company-1')=>createGraphNode({nodeId,nodeType,organizationId,label:nodeId,createdAt:at,updatedAt:at})
const edge=(edgeId,sourceNodeId,targetNodeId,organizationId='company-1',relationType='descends_from')=>createGraphEdge({edgeId,sourceNodeId,targetNodeId,organizationId,relationType,validFrom:at,createdAt:at})

test('indexa nodos y aristas y consulta vecinos en ambas direcciones',()=>{
 const graph=createKnowledgeGraphRepository()
 graph.addNode(node('mother','cultivation.materialplant'))
 graph.addNode(node('plant'))
 graph.addEdge(edge('edge-1','plant','mother'))
 assert.equal(graph.getNode('plant').label,'plant')
 assert.equal(graph.getEdge('edge-1').relationType,'descends_from')
 assert.deepEqual(graph.neighbors('plant').map(item=>[item.node.nodeId,item.direction]),[['mother','out']])
 assert.deepEqual(graph.neighbors('mother').map(item=>[item.node.nodeId,item.direction]),[['plant','in']])
})

test('impide aristas huérfanas y relaciones entre empresas',()=>{
 const graph=createKnowledgeGraphRepository()
 graph.addNode(node('a'))
 assert.throws(()=>graph.addEdge(edge('missing','a','b')),/ambos nodos existan/)
 graph.addNode(node('b','cultivation.plant','company-2'))
 assert.throws(()=>graph.addEdge(edge('cross','a','b')),/cruzar organizaciones/)
})

test('deduplica por edgeId y por identidad semántica',()=>{
 const graph=createKnowledgeGraphRepository()
 graph.addNode(node('a'));graph.addNode(node('b'))
 assert.equal(graph.addEdge(edge('edge-1','a','b')).inserted,true)
 assert.equal(graph.addEdge(edge('edge-1','a','b')).reason,'edgeId')
 assert.equal(graph.addEdge(edge('edge-2','a','b')).reason,'semantic')
 assert.equal(graph.health().edges,1)
})

test('rehidrata de forma atómica y conserva el estado anterior ante errores',()=>{
 const graph=createKnowledgeGraphRepository()
 graph.addNode(node('original'))
 assert.throws(()=>graph.replaceAll({nodes:[node('a')],edges:[edge('bad','a','missing')]}),/ambos nodos existan/)
 assert.equal(graph.getNode('original').nodeId,'original')
 assert.equal(graph.health().nodes,1)
 const snapshot=graph.replaceAll({nodes:[node('mother','cultivation.materialplant'),node('plant')],edges:[edge('edge-1','plant','mother')]})
 assert.equal(snapshot.nodes.length,2)
 assert.equal(snapshot.edges.length,1)
 assert.equal(graph.getNode('original'),null)
})

test('recorre descendencia por niveles sin repetir nodos en ciclos',()=>{
 const graph=createKnowledgeGraphRepository()
 for(const item of [node('grandmother','cultivation.materialplant'),node('mother','cultivation.materialplant'),node('plant')])graph.addNode(item)
 graph.addEdge(edge('e1','mother','grandmother'))
 graph.addEdge(edge('e2','plant','mother'))
 graph.addEdge(edge('e3','grandmother','plant'))
 assert.deepEqual(graph.descendants('grandmother').map(item=>[item.node.nodeId,item.depth]),[['mother',1],['plant',2]])
})

test('mantiene índices por organización y tipo de relación',()=>{
 const graph=createKnowledgeGraphRepository()
 graph.replaceAll({nodes:[node('a'),node('b'),node('c','cultivation.plant','company-2')],edges:[edge('e1','a','b')]})
 assert.deepEqual(graph.nodesForOrganization('company-1').map(item=>item.nodeId),['a','b'])
 assert.deepEqual(graph.nodesForOrganization('company-2').map(item=>item.nodeId),['c'])
 assert.deepEqual(graph.edgesByRelation('descends_from').map(item=>item.edgeId),['e1'])
 assert.equal(graph.health().organizations,2)
})
