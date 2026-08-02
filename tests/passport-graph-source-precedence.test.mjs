import test from'node:test'
import assert from'node:assert/strict'
import{createKnowledgeGraphRepository,projectPassportToGraph}from'../src/core/knowledgeGraph/index.js'
import{createIntelligentObject,createPassport}from'../src/core/passport/index.js'

function buildPassport({label,status,updatedAt,relationships=[]}){
 const object=createIntelligentObject({
  objectType:'cultivation.plant',
  objectId:'plant-1',
  organizationId:'org-1',
  siteId:'site-1',
  label,
  status,
  createdAt:'2026-07-01T00:00:00.000Z',
  updatedAt
 })
 return createPassport({object,relationships,generatedAt:updatedAt})
}

test('un Passport antiguo no degrada el nodo principal pero sí reconcilia sus relaciones',()=>{
 const repository=createKnowledgeGraphRepository()
 const current=buildPassport({
  label:'Planta vigente',
  status:'flowering',
  updatedAt:'2026-08-02T10:00:00.000Z',
  relationships:[{type:'located.in',targetType:'cultivation.bed',targetId:'bed-1'}]
 })
 projectPassportToGraph(repository,current)

 const stale=buildPassport({
  label:'Planta antigua',
  status:'vegetative',
  updatedAt:'2026-08-01T10:00:00.000Z',
  relationships:[{type:'located.in',targetType:'cultivation.bed',targetId:'bed-2'}]
 })
 projectPassportToGraph(repository,stale)

 const node=repository.getNode('org-1:cultivation.plant:plant-1')
 const snapshot=repository.snapshot()
 assert.equal(node.label,'Planta vigente')
 assert.equal(node.status,'flowering')
 assert.equal(node.updatedAt,'2026-08-02T10:00:00.000Z')
 assert.equal(snapshot.edges.filter(edge=>edge.source==='passport').length,1)
 assert.equal(snapshot.edges.find(edge=>edge.source==='passport').targetNodeId,'org-1:cultivation.bed:bed-2')
 assert.equal(snapshot.nodes.some(item=>item.nodeId==='org-1:cultivation.bed:bed-1'),false)
})
