import test from'node:test'
import assert from'node:assert/strict'
import{createGraphNode,createGraphEdge,createKnowledgeGraphRepository,projectPassportToGraph}from'../src/core/knowledgeGraph/index.js'
import{createIntelligentObject,createPassport}from'../src/core/passport/index.js'

const generatedAt='2026-08-01T18:00:00.000Z'

function passport(relationships=[]){
 const object=createIntelligentObject({objectType:'cultivation.plant',objectId:'plant-1',organizationId:'org-1',siteId:'site-1',label:'Planta 1',status:'active',createdAt:'2026-07-01T00:00:00.000Z',updatedAt:generatedAt})
 return createPassport({object,relationships,generatedAt})
}

test('proyecta el objeto y sus relaciones canónicas de forma atómica',()=>{
 const repository=createKnowledgeGraphRepository()
 const source=passport([
  {type:'located.in',targetType:'cultivation.bed',targetId:'bed-1',targetLabel:'Cama 1'},
  {type:'descends_from',targetType:'cultivation.materialplant',targetId:'mother-1',targetLabel:'Madre 1'}
 ])
 const result=projectPassportToGraph(repository,source)
 const snapshot=repository.snapshot()
 assert.equal(snapshot.nodes.length,3)
 assert.equal(snapshot.edges.length,2)
 assert.deepEqual(snapshot.edges.map(edge=>edge.relationType).sort(),['descends_from','located_in'])
 assert.equal(snapshot.edges.every(edge=>edge.source==='passport'&&edge.metadata.passportId===source.passportId),true)
 assert.equal(result.node.label,'Planta 1')
 assert.equal(Object.isFrozen(result.edges),true)
})

test('reproyectar el mismo Passport no duplica nodos ni aristas',()=>{
 const repository=createKnowledgeGraphRepository(),source=passport([{type:'located.in',targetType:'cultivation.bed',targetId:'bed-1'}])
 projectPassportToGraph(repository,source)
 projectPassportToGraph(repository,source)
 const snapshot=repository.snapshot()
 assert.equal(snapshot.nodes.length,2)
 assert.equal(snapshot.edges.length,1)
})

test('reemplaza solo las aristas propias del Passport y retira las obsoletas',()=>{
 const repository=createKnowledgeGraphRepository()
 const initial=passport([
  {type:'located.in',targetType:'cultivation.bed',targetId:'bed-1'},
  {type:'descends.from',targetType:'cultivation.materialplant',targetId:'mother-1'}
 ])
 projectPassportToGraph(repository,initial)
 const sensor=createGraphNode({nodeId:'org-1:iot.sensor:sensor-1',nodeType:'iot.sensor',organizationId:'org-1',siteId:'site-1',label:'Sensor 1',status:'active',createdAt:generatedAt,updatedAt:generatedAt})
 repository.addNode(sensor)
 repository.addEdge(createGraphEdge({edgeId:'iot-edge-1',relationType:'monitored_by',sourceNodeId:'org-1:cultivation.plant:plant-1',targetNodeId:sensor.nodeId,organizationId:'org-1',source:'iot',confidence:1,validFrom:generatedAt,createdAt:generatedAt}))
 const updated=passport([{type:'located.in',targetType:'cultivation.bed',targetId:'bed-2'}])
 projectPassportToGraph(repository,updated)
 const snapshot=repository.snapshot()
 const passportEdges=snapshot.edges.filter(edge=>edge.source==='passport')
 assert.equal(passportEdges.length,1)
 assert.equal(passportEdges[0].targetNodeId,'org-1:cultivation.bed:bed-2')
 assert.equal(snapshot.edges.some(edge=>edge.edgeId==='iot-edge-1'&&edge.source==='iot'),true)
 assert.equal(snapshot.edges.some(edge=>edge.targetNodeId.endsWith('bed-1')||edge.targetNodeId.endsWith('mother-1')),false)
 assert.equal(snapshot.nodes.some(node=>node.nodeId.endsWith('bed-1')||node.nodeId.endsWith('mother-1')),false)
})

test('un Passport sin relaciones elimina solo sus aristas proyectadas',()=>{
 const repository=createKnowledgeGraphRepository(),source=passport([{type:'located.in',targetType:'cultivation.bed',targetId:'bed-1'}])
 projectPassportToGraph(repository,source)
 const bed=repository.getNode('org-1:cultivation.bed:bed-1')
 repository.addEdge(createGraphEdge({edgeId:'manual-edge-1',relationType:'assigned_to',sourceNodeId:'org-1:cultivation.plant:plant-1',targetNodeId:bed.nodeId,organizationId:'org-1',source:'user',confidence:1,validFrom:generatedAt,createdAt:generatedAt}))
 projectPassportToGraph(repository,passport([]))
 const snapshot=repository.snapshot()
 assert.equal(snapshot.edges.length,1)
 assert.equal(snapshot.edges[0].edgeId,'manual-edge-1')
 assert.equal(snapshot.nodes.some(node=>node.nodeId===bed.nodeId),true)
})

test('preserva nodos enriquecidos aunque ya no estén en el Passport',()=>{
 const repository=createKnowledgeGraphRepository(),source=passport([{type:'located.in',targetType:'cultivation.bed',targetId:'bed-1'}])
 projectPassportToGraph(repository,source,{resolveTarget:ref=>({label:'Cama Norte',status:'active',createdAt:'2026-01-01T00:00:00.000Z',updatedAt:generatedAt,metadata:{capacity:50},siteId:ref.siteId})})
 projectPassportToGraph(repository,passport([]))
 const target=repository.getNode('org-1:cultivation.bed:bed-1')
 assert.equal(target.label,'Cama Norte')
 assert.equal(target.metadata.capacity,50)
})

test('permite resolver destinos con datos completos sin cambiar su identidad',()=>{
 const repository=createKnowledgeGraphRepository(),source=passport([{type:'located.in',targetType:'cultivation.bed',targetId:'bed-1'}])
 projectPassportToGraph(repository,source,{resolveTarget:ref=>({label:'Cama Norte',status:'active',createdAt:'2026-01-01T00:00:00.000Z',updatedAt:generatedAt,metadata:{capacity:50},siteId:ref.siteId})})
 const target=repository.getNode('org-1:cultivation.bed:bed-1')
 assert.equal(target.label,'Cama Norte')
 assert.equal(target.metadata.capacity,50)
})

test('una relación inválida no modifica el snapshot vigente',()=>{
 const repository=createKnowledgeGraphRepository(),valid=passport([{type:'located.in',targetType:'cultivation.bed',targetId:'bed-1'}])
 projectPassportToGraph(repository,valid)
 const before=repository.snapshot()
 const invalid={...valid,relationships:[{type:'located.in',targetType:'cultivation.bed',targetId:'bed-2',targetOrganizationId:'org-2'}]}
 assert.throws(()=>projectPassportToGraph(repository,invalid),/otra empresa/)
 const after=repository.snapshot()
 assert.deepEqual(after.nodes,before.nodes)
 assert.deepEqual(after.edges,before.edges)
})
