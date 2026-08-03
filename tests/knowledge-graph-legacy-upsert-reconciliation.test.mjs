import test from'node:test'
import assert from'node:assert/strict'
import{createKnowledgeGraph,createGraphNode}from'../src/core/knowledgeGraph/index.js'

const ref={objectType:'cultivation.bed',objectId:'bed-1',organizationId:'org-1',siteId:'site-1'}
const createdAt='2026-01-01T00:00:00.000Z'

function node({label='Cama 1',status='active',capacity=50,updatedAt='2026-08-01T00:00:00.000Z'}={}){
 return{ref,label,status,attributes:{capacity},createdAt,updatedAt}
}

test('la API heredada actualiza un nodo existente con evidencia posterior',()=>{
 const graph=createKnowledgeGraph()
 graph.upsertNode(node())
 const result=graph.upsertNode(node({label:'Cama 1 ampliada',status:'maintenance',capacity:60,updatedAt:'2026-08-02T00:00:00.000Z'}))
 assert.equal(result.label,'Cama 1 ampliada')
 assert.equal(result.status,'maintenance')
 assert.equal(result.attributes.capacity,60)
 assert.equal(graph.getNode(ref).updatedAt,'2026-08-02T00:00:00.000Z')
})

test('una actualización heredada más antigua no degrada el nodo vigente',()=>{
 const graph=createKnowledgeGraph()
 graph.upsertNode(node({label:'Vigente',capacity:60,updatedAt:'2026-08-02T00:00:00.000Z'}))
 const result=graph.upsertNode(node({label:'Antigua',status:'deleted',capacity:10,updatedAt:'2026-07-01T00:00:00.000Z'}))
 assert.equal(result.label,'Vigente')
 assert.equal(result.status,'active')
 assert.equal(result.attributes.capacity,60)
})

test('actualizar un nodo preserva todas sus relaciones canónicas',()=>{
 const graph=createKnowledgeGraph()
 const plant={objectType:'cultivation.plant',objectId:'plant-1',organizationId:'org-1',siteId:'site-1'}
 graph.upsertNode(node())
 graph.connect({relationId:'located-1',relationType:'located.in',from:plant,to:ref,createdAt:'2026-08-01T00:00:00.000Z'})
 graph.upsertNode(node({label:'Cama actualizada',capacity:75,updatedAt:'2026-08-03T00:00:00.000Z'}))
 const neighbors=graph.neighbors(plant,{direction:'out'})
 assert.equal(neighbors.length,1)
 assert.equal(neighbors[0].node.label,'Cama actualizada')
 assert.equal(neighbors[0].relation.id,'located-1')
})

test('la API heredada no degrada una fuente canónica de mayor autoridad',()=>{
 const graph=createKnowledgeGraph()
 graph.repository.addNode(createGraphNode({nodeId:'org-1:cultivation.bed:bed-1',nodeType:'cultivation.bed',organizationId:'org-1',siteId:'site-1',label:'Cama Ledger',status:'active',createdAt,updatedAt:'2026-07-01T00:00:00.000Z',metadata:{source:'ledger',objectVersion:1}}))
 const result=graph.upsertNode(node({label:'Legacy futura',status:'deleted',capacity:999,updatedAt:'2099-01-01T00:00:00.000Z'}))
 assert.equal(result.label,'Cama Ledger')
 assert.equal(result.status,'active')
 assert.equal(graph.repository.getNode('org-1:cultivation.bed:bed-1').metadata.source,'ledger')
})

test('la reconciliación heredada converge sin depender del orden de llegada',()=>{
 const a=createKnowledgeGraph(),b=createKnowledgeGraph()
 const first=node({label:'Cama Alfa',capacity:50,updatedAt:'2026-08-02T00:00:00.000Z'})
 const second=node({label:'Cama Omega',capacity:60,updatedAt:'2026-08-02T00:00:00.000Z'})
 a.upsertNode(first);a.upsertNode(second)
 b.upsertNode(second);b.upsertNode(first)
 assert.deepEqual(a.getNode(ref),b.getNode(ref))
})
