import test from'node:test'
import assert from'node:assert/strict'
import{createGraphNode,createGraphEdge,createKnowledgeGraphRepository,createKnowledgeGraph}from'../src/core/knowledgeGraph/index.js'

const time='2026-08-03T12:00:00.000Z'
function repository(){
 const graph=createKnowledgeGraphRepository()
 graph.addNode(createGraphNode({nodeId:'org-1:cultivation.plant:plant-1',nodeType:'cultivation.plant',organizationId:'org-1',label:'Planta 1',createdAt:time,updatedAt:time}))
 graph.addNode(createGraphNode({nodeId:'org-1:cultivation.bed:bed-1',nodeType:'cultivation.bed',organizationId:'org-1',label:'Cama 1',createdAt:time,updatedAt:time}))
 return graph
}
function edge({edgeId,source='passport',confidence=1,metadata={evidence:'passport'}}={}){
 return createGraphEdge({edgeId,relationType:'located_in',sourceNodeId:'org-1:cultivation.plant:plant-1',targetNodeId:'org-1:cultivation.bed:bed-1',organizationId:'org-1',source,confidence,validFrom:time,createdAt:time,metadata})
}

test('conserva afirmaciones distintas de fuentes diferentes sobre los mismos extremos',()=>{
 const graph=repository()
 assert.equal(graph.addEdge(edge({edgeId:'passport-edge'})).inserted,true)
 assert.equal(graph.addEdge(edge({edgeId:'iot-edge',source:'iot',metadata:{sensorId:'sensor-1'}})).inserted,true)
 assert.equal(graph.snapshot().edges.length,2)
})

test('conserva evidencias distintas de una misma fuente',()=>{
 const graph=repository()
 graph.addEdge(edge({edgeId:'edge-a',metadata:{documentId:'doc-a'}}))
 graph.addEdge(edge({edgeId:'edge-b',metadata:{documentId:'doc-b'}}))
 assert.deepEqual(graph.snapshot().edges.map(item=>item.edgeId),['edge-a','edge-b'])
})

test('conserva niveles de confianza distintos como afirmaciones separadas',()=>{
 const graph=repository()
 graph.addEdge(edge({edgeId:'edge-low',confidence:.6}))
 graph.addEdge(edge({edgeId:'edge-high',confidence:.95}))
 assert.equal(graph.snapshot().edges.length,2)
})

test('deduplica copias semánticamente idénticas aunque cambie el edgeId y el orden de metadata',()=>{
 const graph=repository()
 graph.addEdge(edge({edgeId:'edge-a',metadata:{evidence:{type:'document',id:'doc-1'},reviewed:true}}))
 const duplicate=graph.addEdge(edge({edgeId:'edge-b',metadata:{reviewed:true,evidence:{id:'doc-1',type:'document'}}}))
 assert.equal(duplicate.inserted,false)
 assert.equal(duplicate.reason,'semantic')
 assert.equal(duplicate.edge.edgeId,'edge-a')
 assert.equal(graph.snapshot().edges.length,1)
})

test('replaceAll rechaza duplicados equivalentes atómicamente pero acepta afirmaciones distintas',()=>{
 const graph=repository(),nodes=graph.snapshot().nodes
 const distinct=[edge({edgeId:'edge-a',source:'passport'}),edge({edgeId:'edge-b',source:'iot',metadata:{sensorId:'sensor-1'}})]
 graph.replaceAll({nodes,edges:distinct})
 const before=graph.snapshot()
 assert.equal(before.edges.length,2)
 const duplicate=edge({edgeId:'edge-c',source:'passport'})
 assert.throws(()=>graph.replaceAll({nodes,edges:[...distinct,duplicate]}),/Relación semántica duplicada/)
 const after=graph.snapshot()
 assert.deepEqual(after.edges,before.edges)
 assert.equal(after.version,before.version)
})

test('la API heredada conserva relaciones con atributos distintos entre los mismos objetos',()=>{
 const graph=createKnowledgeGraph()
 const from={organizationId:'org-1',objectType:'cultivation.plant',objectId:'plant-1'}
 const to={organizationId:'org-1',objectType:'cultivation.bed',objectId:'bed-1'}
 graph.connect({relationId:'legacy-a',relationType:'located.in',from,to,createdAt:time,attributes:{evidence:'inspection-a'}})
 graph.connect({relationId:'legacy-b',relationType:'located.in',from,to,createdAt:time,attributes:{evidence:'inspection-b'}})
 const relations=graph.snapshot().relations
 assert.equal(relations.length,2)
 assert.deepEqual(relations.map(item=>item.attributes.evidence),['inspection-a','inspection-b'])
})
