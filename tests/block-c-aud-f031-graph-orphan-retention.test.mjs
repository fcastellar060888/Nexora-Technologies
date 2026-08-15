import test from'node:test'
import assert from'node:assert/strict'
import{createGraphNode}from'../src/core/knowledgeGraph/index.js'
import{createKnowledgeGraph}from'../src/core/knowledgeGraph/legacy.js'

const org='org-1'
const at='2026-08-03T12:00:00.000Z'
const ref=(type,id)=>({objectType:type,objectId:id,organizationId:org})
const relation=(id,from,to)=>({relationId:id,relationType:'located.in',from,to,createdAt:at})

test('AUD-F031: la retención recoge endpoints automáticos de una arista expulsada',()=>{
 const graph=createKnowledgeGraph({maxRelations:1})
 const oldFrom=ref('cultivation.plant','plant-old'),oldTo=ref('cultivation.bed','bed-old')
 const newFrom=ref('cultivation.plant','plant-new'),newTo=ref('cultivation.bed','bed-new')
 graph.connect(relation('edge-old',oldFrom,oldTo))
 graph.connect(relation('edge-new',newFrom,newTo))
 assert.equal(graph.getNode(oldFrom),null)
 assert.equal(graph.getNode(oldTo),null)
 assert.equal(graph.getNode(newFrom).ref.objectId,'plant-new')
 assert.equal(graph.getNode(newTo).ref.objectId,'bed-new')
 assert.equal(graph.snapshot().relations.length,1)
})

test('AUD-F031: un nodo creado explícitamente sobrevive aunque pierda su última arista',()=>{
 const graph=createKnowledgeGraph({maxRelations:1})
 const persistent=ref('cultivation.plant','persistent'),oldTarget=ref('cultivation.bed','old-target')
 graph.upsertNode({ref:persistent,label:'Planta persistente',createdAt:at,updatedAt:at})
 graph.connect(relation('edge-old',persistent,oldTarget))
 graph.connect(relation('edge-new',ref('cultivation.plant','new'),ref('cultivation.bed','new-target')))
 assert.equal(graph.getNode(persistent).label,'Planta persistente')
 assert.equal(graph.getNode(oldTarget),null)
})

test('AUD-F031: un endpoint automático compartido permanece mientras conserve una arista',()=>{
 const graph=createKnowledgeGraph({maxRelations:1})
 const shared=ref('cultivation.bed','shared')
 graph.connect(relation('edge-old',ref('cultivation.plant','old'),shared))
 graph.connect(relation('edge-new',ref('cultivation.plant','new'),shared))
 assert.equal(graph.getNode(ref('cultivation.plant','old')),null)
 assert.equal(graph.getNode(shared).ref.objectId,'shared')
 assert.equal(graph.neighbors(shared).length,1)
})

test('AUD-F031: un nodo canónico de otra fuente nunca se recoge como huérfano de retención legacy',()=>{
 const graph=createKnowledgeGraph({maxRelations:1})
 const canonicalId='org-1:cultivation.asset:asset-1'
 graph.repository.addNode(createGraphNode({nodeId:canonicalId,nodeType:'cultivation.asset',organizationId:org,label:'Activo Ledger',createdAt:at,updatedAt:at,metadata:{source:'ledger'}}))
 graph.connect(relation('edge-old',ref('cultivation.asset','asset-1'),ref('organization.site','site-old')))
 graph.connect(relation('edge-new',ref('cultivation.plant','new'),ref('cultivation.bed','new-target')))
 assert.equal(graph.repository.getNode(canonicalId).label,'Activo Ledger')
 assert.equal(graph.repository.getNode(canonicalId).metadata.source,'ledger')
})

test('AUD-F031: la poda confirma nodos y aristas en una sola revisión',()=>{
 const graph=createKnowledgeGraph({maxRelations:1})
 graph.connect(relation('edge-old',ref('cultivation.plant','old'),ref('cultivation.bed','old-target')))
 const before=graph.repository.snapshot().version
 graph.connect(relation('edge-new',ref('cultivation.plant','new'),ref('cultivation.bed','new-target')))
 const after=graph.repository.snapshot()
 assert.equal(after.version,before+4)
 assert.equal(after.nodes.length,2)
 assert.equal(after.edges.length,1)
})

test('AUD-F031: disconnect recoge únicamente endpoints automáticos que quedan sin relaciones',()=>{
 const graph=createKnowledgeGraph()
 const from=ref('cultivation.plant','disconnect-from'),to=ref('cultivation.bed','disconnect-to')
 graph.connect(relation('edge-disconnect',from,to))
 assert.equal(graph.disconnect('edge-disconnect'),true)
 assert.equal(graph.getNode(from),null)
 assert.equal(graph.getNode(to),null)
 assert.equal(graph.repository.snapshot().edges.length,0)
})

test('AUD-F031: un endpoint automático promovido explícitamente deja de ser recolectable',()=>{
 const graph=createKnowledgeGraph()
 const from=ref('cultivation.plant','promoted'),to=ref('cultivation.bed','temporary-target')
 graph.connect(relation('edge-promote',from,to))
 graph.upsertNode({ref:from,label:'Planta consolidada',attributes:{registry:'official'},createdAt:at,updatedAt:at})
 graph.disconnect('edge-promote')
 assert.equal(graph.getNode(from).label,'Planta consolidada')
 assert.equal(graph.getNode(from).attributes.registry,'official')
 assert.equal(graph.getNode(to),null)
 assert.equal(graph.repository.getNode('org-1:cultivation.plant:promoted').metadata.retention,'persistent')
})
