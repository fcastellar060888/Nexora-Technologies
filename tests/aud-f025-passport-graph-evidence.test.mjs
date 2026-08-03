import test from'node:test'
import assert from'node:assert/strict'
import{createKnowledgeGraphRepository,projectPassportToGraph}from'../src/core/knowledgeGraph/index.js'
import{createIntelligentObject,createPassport}from'../src/core/passport/index.js'

const createdAt='2026-07-01T00:00:00.000Z'
const updatedAt='2026-08-03T12:00:00.000Z'

function buildPassport({version=3,attributes={phase:'flowering',metrics:{heightCm:92}},metadata={sourceSystem:'cultivation',tags:['elite']}}={}){
 const identity={plantCode:'PL-001',lineage:{geneticId:'gen-7',motherId:'mother-3'}}
 const object=createIntelligentObject({
  objectType:'cultivation.plant',
  objectId:'plant-1',
  organizationId:'org-1',
  siteId:'site-1',
  label:'Planta 1',
  status:'active',
  version,
  identity,
  attributes,
  metadata,
  createdAt,
  updatedAt
 })
 return{passport:createPassport({object,generatedAt:updatedAt}),identity,attributes,metadata}
}

test('AUD-F025: el nodo principal conserva identidad, atributos y metadata del Objeto Inteligente',()=>{
 const repository=createKnowledgeGraphRepository()
 const{passport}=buildPassport()
 projectPassportToGraph(repository,passport)
 const node=repository.getNode('org-1:cultivation.plant:plant-1')
 assert.deepEqual(node.metadata.intelligentObject,{
  objectType:'cultivation.plant',
  objectId:'plant-1',
  organizationId:'org-1',
  siteId:'site-1',
  version:3,
  identity:{plantCode:'PL-001',lineage:{geneticId:'gen-7',motherId:'mother-3'}},
  attributes:{phase:'flowering',metrics:{heightCm:92}},
  metadata:{sourceSystem:'cultivation',tags:['elite']}
 })
 assert.equal(node.metadata.source,'passport')
 assert.equal(node.metadata.objectVersion,3)
})

test('AUD-F025: la evidencia proyectada no comparte referencias y queda profundamente inmutable',()=>{
 const repository=createKnowledgeGraphRepository()
 const attributes={phase:'flowering',metrics:{heightCm:92}}
 const metadata={sourceSystem:'cultivation',tags:['elite']}
 const{passport}=buildPassport({attributes,metadata})
 projectPassportToGraph(repository,passport)
 attributes.metrics.heightCm=1
 metadata.tags.push('mutated')
 const evidence=repository.getNode('org-1:cultivation.plant:plant-1').metadata.intelligentObject
 assert.equal(evidence.attributes.metrics.heightCm,92)
 assert.deepEqual(evidence.metadata.tags,['elite'])
 assert.equal(Object.isFrozen(evidence),true)
 assert.equal(Object.isFrozen(evidence.identity.lineage),true)
 assert.equal(Object.isFrozen(evidence.attributes.metrics),true)
 assert.equal(Object.isFrozen(evidence.metadata.tags),true)
 assert.throws(()=>{evidence.attributes.metrics.heightCm=2},TypeError)
})

test('AUD-F025: una versión posterior del mismo Passport actualiza también su evidencia de dominio',()=>{
 const repository=createKnowledgeGraphRepository()
 const first=buildPassport({version:3,attributes:{phase:'flowering'},metadata:{sourceSystem:'cultivation'}}).passport
 projectPassportToGraph(repository,first)
 const nextObject=createIntelligentObject({
  ...first.object,
  version:4,
  status:'harvest-ready',
  attributes:{phase:'harvest',yieldEstimateGrams:420},
  metadata:{sourceSystem:'cultivation',reviewed:true},
  updatedAt:'2026-08-03T13:00:00.000Z'
 })
 projectPassportToGraph(repository,createPassport({object:nextObject,generatedAt:nextObject.updatedAt}))
 const node=repository.getNode('org-1:cultivation.plant:plant-1')
 assert.equal(node.status,'harvest-ready')
 assert.equal(node.metadata.objectVersion,4)
 assert.deepEqual(node.metadata.intelligentObject.attributes,{phase:'harvest',yieldEstimateGrams:420})
 assert.deepEqual(node.metadata.intelligentObject.metadata,{sourceSystem:'cultivation',reviewed:true})
})

test('AUD-F025: un objeto incompleto se rechaza antes de modificar el Graph',()=>{
 const repository=createKnowledgeGraphRepository()
 const{passport}=buildPassport()
 projectPassportToGraph(repository,passport)
 const before=repository.snapshot()
 const invalid={...passport,object:{...passport.object,attributes:null}}
 assert.throws(()=>projectPassportToGraph(repository,invalid),/requiere attributes/)
 const after=repository.snapshot()
 assert.deepEqual(after.nodes,before.nodes)
 assert.deepEqual(after.edges,before.edges)
})
