import test from'node:test'
import assert from'node:assert/strict'
import{createIntelligentObject,createPassportBuilder}from'../src/core/passport/index.js'

const object=createIntelligentObject({objectType:'cultivation.plant',objectId:'plant-1',organizationId:'company-1',siteId:'site-1',label:'P-1'})

test('compone plugins de dominio sobre un único contrato de Passport',()=>{
 const builder=createPassportBuilder({plugins:[
  {id:'mipe',project:({object})=>({risks:[{id:`risk:${object.objectId}`,type:'mipe.finding'}],indicators:[{key:'open_findings',value:1}]})},
  {id:'facility',project:()=>({relationships:[{type:'located_in',targetType:'cultivation.bed',targetId:'bed-1'}],decisionContext:{zone:'flowering'}})}
 ]})
 const passport=builder.build({object,base:{actions:[{id:'inspect'}]}})
 assert.deepEqual(builder.listPlugins(),['mipe','facility'])
 assert.equal(passport.risks.length,1)
 assert.equal(passport.indicators[0].key,'open_findings')
 assert.equal(passport.relationships[0].targetId,'bed-1')
 assert.equal(passport.actions[0].id,'inspect')
 assert.equal(passport.decisionContext.zone,'flowering')
 assert.equal(Object.isFrozen(passport),true)
})

test('rechaza plugins duplicados o proyecciones inválidas',()=>{
 const builder=createPassportBuilder()
 builder.use({id:'mipe',project:()=>({})})
 assert.throws(()=>builder.use({id:'mipe',project:()=>({})}),/ya está registrado/)
 assert.throws(()=>createPassportBuilder({plugins:[{id:'bad',project:()=>[]}]}).build({object}),/proyección inválida/)
 assert.throws(()=>createPassportBuilder({plugins:[{id:'bad-context',project:()=>({decisionContext:[]})}]}).build({object}),/contexto de decisión inválido/)
})

test('no permite construir sin Objeto Inteligente válido',()=>{
 assert.throws(()=>createPassportBuilder().build({object:{objectId:'x'}}),/Objeto Inteligente válido/)
})
