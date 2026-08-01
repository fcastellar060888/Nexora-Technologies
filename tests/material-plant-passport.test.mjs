import test from'node:test'
import assert from'node:assert/strict'
import{createMaterialPlantPassportFromState}from'../src/core/passport/materialPlantPassport.js'

const state={currentContext:{companyId:'company-1'},companies:[{id:'company-1'}],sites:[{id:'site-1',companyId:'company-1',name:'Villeta'}],genetics:[{id:'gen-1',name:'Canapa 1'}],grandmotherPlants:[{id:'g-lot',lotCode:'LAB-001',quantity:1,siteId:'site-1',geneticId:'gen-1',status:'Activa',healthStatus:'Sana',createdAt:'2026-01-01T00:00:00Z'}],motherPlants:[{id:'m-lot',lotCode:'LM-001',quantity:2,siteId:'site-1',geneticId:'gen-1',grandmotherPlantId:'g-lot',status:'Activa',healthStatus:'Sana',createdAt:'2026-02-01T00:00:00Z'}],materialPlantUnits:[{id:'mother-unit-1',lotId:'m-lot',plantType:'MOTHER',unitIndex:0,healthStatus:'En seguimiento',notes:'Revisar vigor'}],propagationBatches:[{id:'batch-1',motherPlantId:'m-lot',quantity:10,activeQuantity:8}],attachments:[{id:'doc-1',entityType:'materialPlant',entityId:'mother-unit-1',name:'Foto sanitaria',type:'image/jpeg',createdAt:'2026-03-01T00:00:00Z'}],timelineEntries:[{id:'event-1',aggregateId:'mother-unit-1',occurredAt:'2026-03-02T00:00:00Z',title:'Sanidad actualizada',summary:'En seguimiento'}],plantEvents:[]}

test('crea Passport individual de madre con identidad estable y contexto',()=>{
 const passport=createMaterialPlantPassportFromState(state,{unitId:'mother-unit-1'})
 assert.equal(passport.object.objectType,'cultivation.materialplant')
 assert.equal(passport.object.label,'LM-001-M001')
 assert.equal(passport.object.attributes.geneticName,'Canapa 1')
 assert.equal(passport.object.attributes.healthStatus,'En seguimiento')
 assert.equal(passport.documents.length,1)
 assert.equal(passport.timeline.length,1)
 assert.equal(passport.indicators.find(item=>item.key==='descendants').value,8)
 assert.ok(passport.relationships.some(item=>item.type==='descends_from'))
 assert.ok(passport.risks.some(item=>item.type==='health.status'))
})

test('rechaza unidades inexistentes',()=>{
 assert.throws(()=>createMaterialPlantPassportFromState(state,{unitId:'missing'}),/No se encontró/)
})
