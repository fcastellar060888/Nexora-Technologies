import test from'node:test'
import assert from'node:assert/strict'
import{createIntelligentObject,createPassportBuilder,createProjectionPlugin}from'../src/core/passport/index.js'

const object=createIntelligentObject({objectType:'cultivation.plant',objectId:'plant-1',organizationId:'company-1',label:'P-1'})

test('proyecta las secciones comunes sin reimplementar el ensamblaje',()=>{
 const plugin=createProjectionPlugin({id:'test.projection'})
 const builder=createPassportBuilder({plugins:[plugin]})
 const projection={relationships:[{type:'located_in',targetType:'organization.site',targetId:'site-1',targetOrganizationId:'company-1'}],documents:[{id:'doc-1'}],indicators:[{key:'health',value:1}],risks:[{id:'risk-1'}],actions:[{id:'action-1'}],timeline:[{id:'event-1'}],decisionContext:{priority:'high'}}
 const passport=builder.build({object,context:{projection}})
 assert.equal(passport.relationships[0].targetId,'site-1')
 assert.equal(passport.documents[0].id,'doc-1')
 assert.equal(passport.indicators[0].key,'health')
 assert.equal(passport.risks[0].id,'risk-1')
 assert.equal(passport.actions[0].id,'action-1')
 assert.equal(passport.timeline[0].id,'event-1')
 assert.equal(passport.decisionContext.priority,'high')
})

test('permite seleccionar la proyección desde otro contexto',()=>{
 const plugin=createProjectionPlugin({id:'custom.projection',select:({state})=>state.passportProjection})
 const passport=createPassportBuilder({plugins:[plugin]}).build({object,state:{passportProjection:{indicators:[{key:'custom',value:7}]}}})
 assert.equal(passport.indicators[0].value,7)
})

test('rechaza identificadores, selectores y proyecciones inválidos',()=>{
 assert.throws(()=>createProjectionPlugin(),/identificador/)
 assert.throws(()=>createProjectionPlugin({id:'bad',select:true}),/función select/)
 const builder=createPassportBuilder({plugins:[createProjectionPlugin({id:'invalid',select:()=>[]})]})
 assert.throws(()=>builder.build({object}),/proyección inválida/)
})
