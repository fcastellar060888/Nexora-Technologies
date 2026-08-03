import test from'node:test'
import assert from'node:assert/strict'
import{createIntelligentObject,createPassport}from'../src/core/passport/passportContract.js'
import{passportRelationship}from'../src/core/passport/passportDomainSources.js'
import{createCultivationPlantPassportFromState}from'../src/core/passport/cultivationPlantPassport.js'
import{createMaterialPlantPassportFromState}from'../src/core/passport/materialPlantPassport.js'
import{projectPassportToGraph}from'../src/core/knowledgeGraph/passportGraphProjection.js'

const object=createIntelligentObject({objectType:'test.object',objectId:'o-1',organizationId:'org-a',label:'Objeto'})
const relation={type:'located_in',targetType:'organization.site',targetId:'site-a'}

test('AUD-F022: Passport rechaza relaciones sin empresa destino explícita',()=>{
 assert.throws(()=>createPassport({object,relationships:[relation]}),/empresa del destino/)
 assert.throws(()=>passportRelationship('located_in','organization.site','site-a','Sede'),/empresa explícita/)
})

test('AUD-F022: Passport acepta solo relaciones del mismo tenant y conserva la evidencia',()=>{
 const passport=createPassport({object,relationships:[{...relation,targetOrganizationId:'org-a'}]})
 assert.equal(passport.relationships[0].targetOrganizationId,'org-a')
 assert.throws(()=>createPassport({object,relationships:[{...relation,targetOrganizationId:'org-b'}]}),/otra empresa/)
})

test('AUD-F022: Graph no rellena silenciosamente el tenant de relaciones crudas',()=>{
 const repository={snapshot:()=>({nodes:[],edges:[],version:0}),replaceAll:()=>{throw new Error('no debe escribir')}}
 const raw={passportId:'org-a:test.object:o-1',generatedAt:object.updatedAt,object,relationships:[relation]}
 assert.throws(()=>projectPassportToGraph(repository,raw),/empresa explícita/)
})

test('AUD-F022: proyecciones productivas etiquetan todas sus relaciones',()=>{
 const cultivation=createCultivationPlantPassportFromState({plantPositions:[{id:'p-1',bedId:'b-1',companyId:'org-a'}],beds:[{id:'b-1',houseId:'h-1'}],houses:[{id:'h-1',siteId:'s-1'}],sites:[{id:'s-1',companyId:'org-a'}],companies:[],propagationUnits:[],propagationBatches:[],motherPlants:[],grandmotherPlants:[],attachments:[],findings:[],plantEvents:[],treatments:[],timelineEntries:[],incidents:[],products:[],genetics:[]},{plantId:'p-1'})
 assert.ok(cultivation.relationships.length>0)
 assert.ok(cultivation.relationships.every(item=>item.targetOrganizationId==='org-a'))
 const material=createMaterialPlantPassportFromState({currentContext:{companyId:'org-a'},sites:[{id:'s-1',companyId:'org-a'}],genetics:[],attachments:[],findings:[],plantEvents:[],timelineEntries:[],motherPlants:[],propagationBatches:[],grandmotherPlants:[{id:'g-1',lotCode:'G-1',quantity:1,siteId:'s-1'}],materialPlantUnits:[{id:'u-1',lotId:'g-1',plantType:'GRANDMOTHER',unitIndex:0,siteId:'s-1',code:'G-1-A001'}]},{unitId:'u-1'})
 assert.ok(material.relationships.every(item=>item.targetOrganizationId==='org-a'))
})
