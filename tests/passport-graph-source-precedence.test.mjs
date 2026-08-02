import test from'node:test'
import assert from'node:assert/strict'
import{createGraphNode,createKnowledgeGraphRepository,projectPassportToGraph}from'../src/core/knowledgeGraph/index.js'
import{createIntelligentObject,createPassport}from'../src/core/passport/index.js'

const timestamp='2026-08-02T10:00:00.000Z'

function buildPassport({label='Planta Passport',status='vegetative',updatedAt=timestamp,relationships=[]}={}){
 const object=createIntelligentObject({objectType:'cultivation.plant',objectId:'plant-1',organizationId:'org-1',siteId:'site-1',label,status,createdAt:'2026-07-01T00:00:00.000Z',updatedAt})
 return createPassport({object,relationships,generatedAt:updatedAt})
}

function targetResolver({label,source,version=0}){
 return ref=>({label,status:'active',createdAt:'2026-01-01T00:00:00.000Z',updatedAt:timestamp,metadata:{source,objectVersion:version},siteId:ref.siteId})
}

test('un Passport antiguo no degrada el nodo principal pero sí reconcilia sus relaciones',()=>{
 const repository=createKnowledgeGraphRepository()
 const current=buildPassport({label:'Planta vigente',status:'flowering',updatedAt:'2026-08-02T10:00:00.000Z',relationships:[{type:'located.in',targetType:'cultivation.bed',targetId:'bed-1'}]})
 projectPassportToGraph(repository,current)
 const stale=buildPassport({label:'Planta antigua',status:'vegetative',updatedAt:'2026-08-01T10:00:00.000Z',relationships:[{type:'located.in',targetType:'cultivation.bed',targetId:'bed-2'}]})
 projectPassportToGraph(repository,stale)
 const node=repository.getNode('org-1:cultivation.plant:plant-1'),snapshot=repository.snapshot()
 assert.equal(node.label,'Planta vigente')
 assert.equal(node.status,'flowering')
 assert.equal(node.updatedAt,'2026-08-02T10:00:00.000Z')
 assert.equal(snapshot.edges.filter(edge=>edge.source==='passport').length,1)
 assert.equal(snapshot.edges.find(edge=>edge.source==='passport').targetNodeId,'org-1:cultivation.bed:bed-2')
 assert.equal(snapshot.nodes.some(item=>item.nodeId==='org-1:cultivation.bed:bed-1'),false)
})

test('una fuente Ledger prevalece sobre Passport con el mismo updatedAt',()=>{
 const repository=createKnowledgeGraphRepository()
 repository.addNode(createGraphNode({nodeId:'org-1:cultivation.plant:plant-1',nodeType:'cultivation.plant',organizationId:'org-1',siteId:'site-1',label:'Planta Ledger',status:'flowering',createdAt:'2026-07-01T00:00:00.000Z',updatedAt:timestamp,metadata:{source:'ledger',objectVersion:4}}))
 projectPassportToGraph(repository,buildPassport())
 const node=repository.getNode('org-1:cultivation.plant:plant-1')
 assert.equal(node.label,'Planta Ledger')
 assert.equal(node.status,'flowering')
 assert.equal(node.metadata.source,'ledger')
})

test('la prioridad de fuente converge sin depender del orden de llegada',()=>{
 const a=createKnowledgeGraphRepository(),b=createKnowledgeGraphRepository(),passport=buildPassport({relationships:[{type:'located.in',targetType:'cultivation.bed',targetId:'bed-1'}]})
 projectPassportToGraph(a,passport,{resolveTarget:targetResolver({label:'Cama IoT',source:'iot'})})
 projectPassportToGraph(a,passport,{resolveTarget:targetResolver({label:'Cama Usuario',source:'user'})})
 projectPassportToGraph(b,passport,{resolveTarget:targetResolver({label:'Cama Usuario',source:'user'})})
 projectPassportToGraph(b,passport,{resolveTarget:targetResolver({label:'Cama IoT',source:'iot'})})
 assert.deepEqual(a.getNode('org-1:cultivation.bed:bed-1'),b.getNode('org-1:cultivation.bed:bed-1'))
 assert.equal(a.getNode('org-1:cultivation.bed:bed-1').label,'Cama IoT')
})

test('la versión desempata fuentes iguales con la misma fecha',()=>{
 const repository=createKnowledgeGraphRepository(),passport=buildPassport({relationships:[{type:'located.in',targetType:'cultivation.bed',targetId:'bed-1'}]})
 projectPassportToGraph(repository,passport,{resolveTarget:targetResolver({label:'Cama v2',source:'facility',version:2})})
 projectPassportToGraph(repository,passport,{resolveTarget:targetResolver({label:'Cama v1',source:'facility',version:1})})
 assert.equal(repository.getNode('org-1:cultivation.bed:bed-1').label,'Cama v2')
})

test('la huella canónica produce convergencia cuando fecha, fuente y versión empatan',()=>{
 const a=createKnowledgeGraphRepository(),b=createKnowledgeGraphRepository(),passport=buildPassport({relationships:[{type:'located.in',targetType:'cultivation.bed',targetId:'bed-1'}]})
 const alpha=targetResolver({label:'Cama Alfa',source:'facility',version:2}),omega=targetResolver({label:'Cama Omega',source:'facility',version:2})
 projectPassportToGraph(a,passport,{resolveTarget:alpha})
 projectPassportToGraph(a,passport,{resolveTarget:omega})
 projectPassportToGraph(b,passport,{resolveTarget:omega})
 projectPassportToGraph(b,passport,{resolveTarget:alpha})
 assert.deepEqual(a.getNode('org-1:cultivation.bed:bed-1'),b.getNode('org-1:cultivation.bed:bed-1'))
})
