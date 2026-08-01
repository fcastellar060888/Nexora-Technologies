import test from'node:test'
import assert from'node:assert/strict'
import{createCultivationPlantPassportFromState}from'../src/core/passport/index.js'

const state={
 companies:[{id:'company-1',name:'Nexora Farms'}],
 sites:[{id:'site-1',companyId:'company-1',name:'Villeta'}],
 houses:[{id:'house-1',siteId:'site-1',name:'Nave 1'}],
 beds:[{id:'bed-1',houseId:'house-1',name:'Cama 1',geneticId:'genetic-1'}],
 genetics:[{id:'genetic-1',name:'Genética A'}],
 grandmotherPlants:[{id:'grand-1',lotCode:'LAB-001'}],
 motherPlants:[{id:'mother-1',grandmotherPlantId:'grand-1',lotCode:'LM-001'}],
 propagationBatches:[{id:'lot-1',motherPlantId:'mother-1',geneticId:'genetic-1',code:'LOT-001',phase:'Floración',createdAt:'2026-07-01T00:00:00.000Z'}],
 propagationUnits:[{id:'unit-1',batchId:'lot-1',plantPositionId:'plant-1',code:'LOT-001-E001',cutDate:'2026-07-01'}],
 plantPositions:[{id:'plant-1',bedId:'bed-1',row:2,position:7,active:true,status:'Activa',createdAt:'2026-07-15T00:00:00.000Z'}],
 incidents:[{id:'incident-1',name:'Botrytis'}],
 findings:[
  {id:'finding-1',plantPositionId:'plant-1',incidentId:'incident-1',severity:3,status:'En tratamiento',createdAt:'2026-07-20T10:00:00.000Z',notes:'Lesión localizada'},
  {id:'finding-2',plantPositionId:'plant-1',incidentId:'incident-1',severity:1,status:'Resuelto',createdAt:'2026-07-18T10:00:00.000Z'}
 ],
 products:[{id:'product-1',name:'Tratamiento A'}],
 treatments:[{id:'treatment-1',findingId:'finding-1',productId:'product-1',status:'Ejecutado',executedAt:'2026-07-21T10:00:00.000Z',totalQuantity:10,inventoryUnit:'mL'}],
 plantEvents:[{id:'event-1',plantId:'plant-1',type:'Observación',title:'Inspección',detail:'Sin avance',date:'2026-07-22T10:00:00.000Z'}],
 attachments:[{id:'photo-1',entityType:'plant',entityId:'plant-1',name:'foto.jpg',type:'image/jpeg',size:1200,dataUrl:'data:image/jpeg;base64,abc',createdAt:'2026-07-22T11:00:00.000Z'}]
}

test('proyecta una planta productiva a Passport sin duplicar ni migrar colecciones',()=>{
 const source=structuredClone(state)
 const passport=createCultivationPlantPassportFromState(state,{plantId:'plant-1'})
 assert.equal(passport.object.objectType,'cultivation.plant')
 assert.equal(passport.object.objectId,'plant-1')
 assert.equal(passport.object.organizationId,'company-1')
 assert.equal(passport.object.siteId,'site-1')
 assert.equal(passport.object.identity.row,2)
 assert.equal(passport.object.identity.position,7)
 assert.equal(passport.object.attributes.geneticName,'Genética A')
 assert.equal(passport.object.attributes.phase,'Floración')
 assert.equal(passport.object.metadata.compatibilityMode,'existing-plant-position-v1')
 assert.deepEqual(state,source)
})

test('integra ubicación y genealogía completa en relaciones del Passport',()=>{
 const passport=createCultivationPlantPassportFromState(state,{plantId:'plant-1'})
 assert.deepEqual(passport.relationships.map(item=>item.type),[
  'located_in','located_in','located_in','member_of_lot','originated_from','descends_from','descends_from'
 ])
 assert.deepEqual(passport.relationships.map(item=>item.targetId),[
  'bed-1','house-1','site-1','lot-1','unit-1','mother-1','grand-1'
 ])
})

test('integra fotografías, MIPE, tratamientos y eventos en una sola ficha',()=>{
 const passport=createCultivationPlantPassportFromState(state,{plantId:'plant-1'})
 assert.equal(passport.documents.length,1)
 assert.equal(passport.documents[0].id,'photo-1')
 assert.equal(passport.indicators.find(item=>item.key==='open_mipe_findings').value,1)
 assert.equal(passport.indicators.find(item=>item.key==='total_mipe_findings').value,2)
 assert.equal(passport.risks.length,1)
 assert.equal(passport.risks[0].label,'Botrytis')
 assert.deepEqual(passport.timeline.map(item=>item.id),['plant:event-1','treatment:treatment-1','mipe:finding-1','mipe:finding-2'])
 assert.equal(passport.timeline[0].title,'Inspección')
 assert.equal(passport.timeline.some(item=>item.title==='Tratamiento A'),true)
})

test('mantiene compatibilidad con plantas antiguas sin estructura organizacional completa',()=>{
 const legacy={plantPositions:[{id:'legacy-plant',row:1,position:1}],beds:[],houses:[],sites:[],companies:[]}
 const passport=createCultivationPlantPassportFromState(legacy,{plantId:'legacy-plant'})
 assert.equal(passport.object.organizationId,'local-installation')
 assert.equal(passport.object.siteId,null)
 assert.equal(passport.relationships.length,0)
 assert.equal(passport.documents.length,0)
 assert.equal(passport.timeline.length,0)
})

test('rechaza una planta inexistente',()=>{
 assert.throws(()=>createCultivationPlantPassportFromState(state,{plantId:'missing'}),/No se encontró la planta productiva/)
})
