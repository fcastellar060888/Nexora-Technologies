import test from'node:test'
import assert from'node:assert/strict'
import{createCultivationPlantPassportFromState}from'../src/core/passport/cultivationPlantPassport.js'

test('M11-F011: cultivation Passport excludes all foreign evidence when historical ids collide',()=>{
 const state={
  currentContext:{companyId:'org-b'},companies:[{id:'org-a'},{id:'org-b'}],
  sites:[{id:'site-a',companyId:'org-a',name:'A'},{id:'site-b',companyId:'org-b',name:'B'}],
  houses:[{id:'house-1',siteId:'site-a',organizationId:'org-a'},{id:'house-1',siteId:'site-b',organizationId:'org-b'}],
  beds:[{id:'bed-1',houseId:'house-1',organizationId:'org-a'},{id:'bed-1',houseId:'house-1',organizationId:'org-b'}],
  plantPositions:[{id:'plant-1',bedId:'bed-1',organizationId:'org-a',code:'A-001'},{id:'plant-1',bedId:'bed-1',organizationId:'org-b',code:'B-001'}],
  propagationUnits:[{id:'unit-a',plantPositionId:'plant-1',batchId:'batch-a',organizationId:'org-a'},{id:'unit-b',plantPositionId:'plant-1',batchId:'batch-b',organizationId:'org-b'}],
  propagationBatches:[{id:'batch-a',motherPlantId:'mother-a',organizationId:'org-a'},{id:'batch-b',motherPlantId:'mother-b',organizationId:'org-b'}],
  motherPlants:[{id:'mother-a',grandmotherPlantId:'grand-a',organizationId:'org-a'},{id:'mother-b',grandmotherPlantId:'grand-b',organizationId:'org-b'}],
  grandmotherPlants:[{id:'grand-a',organizationId:'org-a'},{id:'grand-b',organizationId:'org-b'}],
  genetics:[],
  attachments:[{id:'photo-a',entityType:'plant',entityId:'plant-1',organizationId:'org-a',name:'a.jpg',type:'image/jpeg',size:1,dataUrl:'data:a',createdAt:'2026-08-14T00:00:00.000Z'},{id:'photo-b',entityType:'plant',entityId:'plant-1',organizationId:'org-b',name:'b.jpg',type:'image/jpeg',size:1,dataUrl:'data:b',createdAt:'2026-08-14T00:00:00.000Z'}],
  incidents:[{id:'incident-1',organizationId:'org-a',name:'Botrytis A'},{id:'incident-1',organizationId:'org-b',name:'Botrytis B'}],
  findings:[{id:'finding-a',plantPositionId:'plant-1',incidentId:'incident-1',organizationId:'org-a',status:'Abierto',createdAt:'2026-08-14T01:00:00.000Z'},{id:'finding-b',plantPositionId:'plant-1',incidentId:'incident-1',organizationId:'org-b',status:'Abierto',createdAt:'2026-08-14T01:00:00.000Z'}],
  products:[{id:'product-1',organizationId:'org-a',name:'Producto A'},{id:'product-1',organizationId:'org-b',name:'Producto B'}],
  treatments:[{id:'treat-a',findingId:'finding-a',productId:'product-1',organizationId:'org-a',executedAt:'2026-08-14T02:00:00.000Z'},{id:'treat-b',findingId:'finding-b',productId:'product-1',organizationId:'org-b',executedAt:'2026-08-14T02:00:00.000Z'}],
  plantEvents:[{id:'event-a',plantId:'plant-1',organizationId:'org-a',title:'Evento A',date:'2026-08-14T03:00:00.000Z'},{id:'event-b',plantId:'plant-1',organizationId:'org-b',title:'Evento B',date:'2026-08-14T03:00:00.000Z'}],
  timelineEntries:[]
 }
 const passport=createCultivationPlantPassportFromState(state,{plantId:'plant-1'})
 assert.equal(passport.object.organizationId,'org-b')
 assert.deepEqual(passport.documents.map(item=>item.id),['photo-b'])
 assert.equal(passport.indicators.find(item=>item.key==='total_mipe_findings').value,1)
 assert.deepEqual(passport.risks.map(item=>item.label),['Botrytis B'])
 assert.ok(passport.relationships.some(item=>item.targetId==='batch-b'))
 assert.ok(passport.relationships.every(item=>!['batch-a','unit-a','mother-a','grand-a'].includes(item.targetId)))
 assert.equal(passport.timeline.some(item=>item.title==='Evento A'),false)
 assert.equal(passport.timeline.some(item=>item.title==='Evento B'),true)
 assert.equal(passport.timeline.some(item=>item.title==='Producto A'),false)
 assert.equal(passport.timeline.some(item=>item.title==='Producto B'),true)
})
