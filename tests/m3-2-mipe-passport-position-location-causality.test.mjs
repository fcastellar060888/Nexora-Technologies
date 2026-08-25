import test from'node:test'
import assert from'node:assert/strict'
import{createCultivationPlantPassportFromState}from'../src/core/passport/cultivationPlantPassport.js'

function state(){return{
 currentContext:{companyId:'org-a',siteId:'site-a'},companies:[{id:'org-a',name:'A'}],
 sites:[{id:'site-a',organizationId:'org-a',companyId:'org-a',name:'A'},{id:'site-b',organizationId:'org-a',companyId:'org-a',name:'B'}],
 houses:[{id:'house-a',organizationId:'org-a',siteId:'site-a',name:'Nave A'},{id:'house-b',organizationId:'org-a',siteId:'site-a',name:'Nave B'}],
 beds:[{id:'bed-a',organizationId:'org-a',siteId:'site-a',houseId:'house-a',name:'Cama A'}],
 plantPositions:[{id:'plant-a',organizationId:'org-a',siteId:'site-a',houseId:'house-a',bedId:'bed-a',row:1,position:1,active:true,createdAt:'2026-08-17T10:00:00.000Z'}],
 propagationUnits:[],propagationBatches:[],motherPlants:[],grandmotherPlants:[],genetics:[],findings:[],incidents:[],treatments:[],mipeInterventions:[],products:[],inventoryLots:[],attachments:[],plantEvents:[],timelineEntries:[],
 growingMediumAssignments:[],growingMediumBatches:[],growingMediumProducts:[],growingMediumFormulas:[],growingMediumReusePolicies:[],growingMediumReuseCycles:[],
 irrigationApplications:[],irrigationCorrections:[],irrigationHistory:[],tankPreparations:[],workOrders:[],inventoryMovements:[],costEntries:[],formulations:[],nutrientProducts:[],mirfePrograms:[],mirfeMonitoring:[],mirfeReinforcements:[],waterAnalyses:[]
}}

test('F011 Passport Position: ascendencia Bed→House→Site coherente construye ubicación canónica',()=>{
 const passport=createCultivationPlantPassportFromState(state(),{plantId:'plant-a'})
 assert.equal(passport.object.organizationId,'org-a')
 assert.equal(passport.object.siteId,'site-a')
 assert.ok(passport.relationships.some(item=>item.targetType==='cultivation.bed'&&item.targetId==='bed-a'))
 assert.ok(passport.relationships.some(item=>item.targetType==='cultivation.house'&&item.targetId==='house-a'))
 assert.ok(passport.relationships.some(item=>item.targetType==='organization.site'&&item.targetId==='site-a'))
})

test('F011 Passport Position: houseId redundante no puede contradecir la nave canónica de la cama',()=>{
 const input=state();input.plantPositions[0]={...input.plantPositions[0],houseId:'house-b'}
 assert.throws(()=>createCultivationPlantPassportFromState(input,{plantId:'plant-a'}),/contradice.*nave|nave canónica/i)
})

test('F011 Passport Position: siteId redundante no puede contradecir Bed→House aunque sea same-tenant',()=>{
 const input=state();input.plantPositions[0]={...input.plantPositions[0],siteId:'site-b'}
 assert.throws(()=>createCultivationPlantPassportFromState(input,{plantId:'plant-a'}),/sede.*contradictoria/i)
})
