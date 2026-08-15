import test from'node:test'
import assert from'node:assert/strict'
import{createGraphNode,createGraphEdge,createKnowledgeGraphRepository,projectPassportToGraph}from'../src/core/knowledgeGraph/index.js'
import{createIntelligentObject,createPassport}from'../src/core/passport/index.js'

const time='2026-08-03T17:00:00.000Z'

function passport(objectId,relationships=[]){
 const object=createIntelligentObject({objectType:'cultivation.plant',objectId,organizationId:'org-1',siteId:'site-1',label:objectId,status:'active',createdAt:'2026-07-01T00:00:00.000Z',updatedAt:time})
 return createPassport({object,generatedAt:time,relationships:relationships.map(item=>({targetOrganizationId:'org-1',...item}))})
}

function provisional(nodeId,nodeType='cultivation.bed'){
 return createGraphNode({nodeId,nodeType,organizationId:'org-1',siteId:'site-1',label:nodeId,status:'referenced',createdAt:time,updatedAt:time,metadata:{source:'passport-reference'}})
}

test('AUD-F028: reproyectar un Passport no elimina referencias provisionales ajenas sin aristas',()=>{
 const repository=createKnowledgeGraphRepository()
 const unrelated=provisional('org-1:cultivation.bed:bed-unrelated')
 repository.addNode(unrelated)
 const source=passport('plant-1',[{type:'located.in',targetType:'cultivation.bed',targetId:'bed-1'}])
 projectPassportToGraph(repository,source)
 projectPassportToGraph(repository,passport('plant-1',[]))
 assert.equal(repository.getNode(unrelated.nodeId),unrelated)
})

test('AUD-F028: elimina únicamente el destino provisional obsoleto del Passport reproyectado',()=>{
 const repository=createKnowledgeGraphRepository()
 const source=passport('plant-1',[{type:'located.in',targetType:'cultivation.bed',targetId:'bed-old'}])
 projectPassportToGraph(repository,source)
 assert.ok(repository.getNode('org-1:cultivation.bed:bed-old'))
 projectPassportToGraph(repository,passport('plant-1',[{type:'located.in',targetType:'cultivation.bed',targetId:'bed-new'}]))
 assert.equal(repository.getNode('org-1:cultivation.bed:bed-old'),null)
 assert.ok(repository.getNode('org-1:cultivation.bed:bed-new'))
})

test('AUD-F028: conserva un destino provisional mientras otra proyección mantenga una arista',()=>{
 const repository=createKnowledgeGraphRepository()
 const first=passport('plant-1',[{type:'located.in',targetType:'cultivation.bed',targetId:'bed-shared'}])
 const second=passport('plant-2',[{type:'located.in',targetType:'cultivation.bed',targetId:'bed-shared'}])
 projectPassportToGraph(repository,first)
 projectPassportToGraph(repository,second)
 projectPassportToGraph(repository,passport('plant-1',[]))
 const shared='org-1:cultivation.bed:bed-shared'
 assert.ok(repository.getNode(shared))
 assert.equal(repository.snapshot().edges.some(edge=>edge.sourceNodeId==='org-1:cultivation.plant:plant-2'&&edge.targetNodeId===shared),true)
})

test('AUD-F028: una arista de otra fuente protege el provisional al retirar el Passport',()=>{
 const repository=createKnowledgeGraphRepository()
 const source=passport('plant-1',[{type:'located.in',targetType:'cultivation.bed',targetId:'bed-1'}])
 projectPassportToGraph(repository,source)
 const sensor=provisional('org-1:iot.sensor:sensor-1','iot.sensor')
 repository.addNode(sensor)
 repository.addEdge(createGraphEdge({edgeId:'iot-observation',relationType:'observes',sourceNodeId:sensor.nodeId,targetNodeId:'org-1:cultivation.bed:bed-1',organizationId:'org-1',source:'iot',confidence:1,validFrom:time,createdAt:time,metadata:{sensorId:'sensor-1'}}))
 projectPassportToGraph(repository,passport('plant-1',[]))
 assert.ok(repository.getNode('org-1:cultivation.bed:bed-1'))
 assert.ok(repository.getEdge('iot-observation'))
})

test('AUD-F028: una proyección inválida no ejecuta limpieza parcial',()=>{
 const repository=createKnowledgeGraphRepository()
 const source=passport('plant-1',[{type:'located.in',targetType:'cultivation.bed',targetId:'bed-1'}])
 projectPassportToGraph(repository,source)
 const before=repository.snapshot()
 const invalid={...source,relationships:[{type:'located.in',targetType:'cultivation.bed',targetId:'bed-2',targetOrganizationId:'org-2'}]}
 assert.throws(()=>projectPassportToGraph(repository,invalid),/otra empresa/)
 const after=repository.snapshot()
 assert.deepEqual(after.nodes,before.nodes)
 assert.deepEqual(after.edges,before.edges)
 assert.equal(after.version,before.version)
})
