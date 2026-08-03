import test from'node:test'
import assert from'node:assert/strict'
import{createGraphNode,createKnowledgeGraphRepository,projectPassportToGraph}from'../src/core/knowledgeGraph/index.js'
import{createIntelligentObject,createPassport}from'../src/core/passport/index.js'

const timestamp='2026-08-02T10:00:00.000Z'

function buildPassport({label='Planta Passport',status='vegetative',updatedAt=timestamp,relationships=[]}={}){
 const object=createIntelligentObject({objectType:'cultivation.plant',objectId:'plant-1',organizationId:'org-1',siteId:'site-1',label,status,createdAt:'2026-07-01T00:00:00.000Z',updatedAt})
 const scoped=relationships.map(item=>({targetOrganizationId:'org-1',...item}))
 return createPassport({object,relationships:scoped,generatedAt:updatedAt})
}

function targetResolver({label,source,version=0,updatedAt=timestamp,recordedAt}={}){
 return ref=>({label,status:'active',createdAt:'2010-01-01T00:00:00.000Z',updatedAt,metadata:{source,objectVersion:version,...(recordedAt?{recordedAt}:{})},siteId:ref.siteId})
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

test('una fuente Ledger prevalece sobre Passport incluso si Passport tiene fecha futura y versión inflada',()=>{
 const repository=createKnowledgeGraphRepository()
 repository.addNode(createGraphNode({nodeId:'org-1:cultivation.plant:plant-1',nodeType:'cultivation.plant',organizationId:'org-1',siteId:'site-1',label:'Planta Ledger',status:'flowering',createdAt:'2010-01-01T00:00:00.000Z',updatedAt:'2020-01-01T00:00:00.000Z',metadata:{source:'ledger',objectVersion:1}}))
 projectPassportToGraph(repository,buildPassport({label:'Passport futuro',status:'deleted',updatedAt:'2099-01-01T00:00:00.000Z'}))
 const node=repository.getNode('org-1:cultivation.plant:plant-1')
 assert.equal(node.label,'Planta Ledger')
 assert.equal(node.status,'flowering')
 assert.equal(node.metadata.source,'ledger')
})

test('una referencia Passport futura no desplaza un destino resuelto por una fuente autoritativa',()=>{
 const repository=createKnowledgeGraphRepository(),passport=buildPassport({updatedAt:'2099-01-01T00:00:00.000Z',relationships:[{type:'located.in',targetType:'cultivation.bed',targetId:'bed-1',targetLabel:'Referencia futura'}]})
 repository.addNode(createGraphNode({nodeId:'org-1:cultivation.bed:bed-1',nodeType:'cultivation.bed',organizationId:'org-1',siteId:'site-1',label:'Cama certificada',status:'active',createdAt:'2020-01-01T00:00:00.000Z',updatedAt:'2020-01-01T00:00:00.000Z',metadata:{source:'iot-certified',objectVersion:1}}))
 projectPassportToGraph(repository,passport)
 const target=repository.getNode('org-1:cultivation.bed:bed-1')
 assert.equal(target.label,'Cama certificada')
 assert.equal(target.metadata.source,'iot-certified')
})

test('la prioridad de fuente converge sin depender del orden de llegada ni de fechas hostiles',()=>{
 const a=createKnowledgeGraphRepository(),b=createKnowledgeGraphRepository(),passport=buildPassport({relationships:[{type:'located.in',targetType:'cultivation.bed',targetId:'bed-1'}]})
 const iot=targetResolver({label:'Cama IoT',source:'iot',updatedAt:'2020-01-01T00:00:00.000Z'})
 const userFuture=targetResolver({label:'Cama Usuario futura',source:'user',version:99,updatedAt:'2099-01-01T00:00:00.000Z'})
 projectPassportToGraph(a,passport,{resolveTarget:iot})
 projectPassportToGraph(a,passport,{resolveTarget:userFuture})
 projectPassportToGraph(b,passport,{resolveTarget:userFuture})
 projectPassportToGraph(b,passport,{resolveTarget:iot})
 assert.deepEqual(a.getNode('org-1:cultivation.bed:bed-1'),b.getNode('org-1:cultivation.bed:bed-1'))
 assert.equal(a.getNode('org-1:cultivation.bed:bed-1').label,'Cama IoT')
})

test('la versión desempata fuentes iguales antes de la fecha',()=>{
 const repository=createKnowledgeGraphRepository(),passport=buildPassport({relationships:[{type:'located.in',targetType:'cultivation.bed',targetId:'bed-1'}]})
 projectPassportToGraph(repository,passport,{resolveTarget:targetResolver({label:'Cama v2 histórica',source:'facility',version:2,updatedAt:'2020-01-01T00:00:00.000Z'})})
 projectPassportToGraph(repository,passport,{resolveTarget:targetResolver({label:'Cama v1 futura',source:'facility',version:1,updatedAt:'2099-01-01T00:00:00.000Z'})})
 assert.equal(repository.getNode('org-1:cultivation.bed:bed-1').label,'Cama v2 histórica')
})

test('recordedAt desempata fuentes y versiones equivalentes antes de updatedAt',()=>{
 const repository=createKnowledgeGraphRepository(),passport=buildPassport({relationships:[{type:'located.in',targetType:'cultivation.bed',targetId:'bed-1'}]})
 projectPassportToGraph(repository,passport,{resolveTarget:targetResolver({label:'Registrada después',source:'facility',version:2,updatedAt:'2020-01-01T00:00:00.000Z',recordedAt:'2026-08-03T12:00:00.000Z'})})
 projectPassportToGraph(repository,passport,{resolveTarget:targetResolver({label:'Actualizada después',source:'facility',version:2,updatedAt:'2099-01-01T00:00:00.000Z',recordedAt:'2026-08-03T11:00:00.000Z'})})
 assert.equal(repository.getNode('org-1:cultivation.bed:bed-1').label,'Registrada después')
})

test('la huella canónica produce convergencia cuando autoridad, versión y tiempo empatan',()=>{
 const a=createKnowledgeGraphRepository(),b=createKnowledgeGraphRepository(),passport=buildPassport({relationships:[{type:'located.in',targetType:'cultivation.bed',targetId:'bed-1'}]})
 const alpha=targetResolver({label:'Cama Alfa',source:'facility',version:2}),omega=targetResolver({label:'Cama Omega',source:'facility',version:2})
 projectPassportToGraph(a,passport,{resolveTarget:alpha})
 projectPassportToGraph(a,passport,{resolveTarget:omega})
 projectPassportToGraph(b,passport,{resolveTarget:omega})
 projectPassportToGraph(b,passport,{resolveTarget:alpha})
 assert.deepEqual(a.getNode('org-1:cultivation.bed:bed-1'),b.getNode('org-1:cultivation.bed:bed-1'))
})
