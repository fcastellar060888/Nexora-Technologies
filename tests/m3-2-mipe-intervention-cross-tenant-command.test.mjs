import test from'node:test'
import assert from'node:assert/strict'
import{executeMipeCommand,MIPE_OPERATIONS}from'../src/services/mipeCommand.js'

function base(){return{
 companies:[{id:'org-a'},{id:'org-b'}],currentContext:{companyId:'org-a',siteId:'site-a'},users:[{id:'user-a',name:'Agrónomo',role:'Encargado MIPE',activeSession:true,active:true,remote:false}],memberships:[],roles:[],
 sites:[{id:'site-a',organizationId:'org-a',companyId:'org-a'},{id:'site-b',organizationId:'org-b',companyId:'org-b'}],houses:[],beds:[],plantPositions:[],grandmotherPlants:[],motherPlants:[],materialPlantUnits:[],genetics:[],products:[],inventoryLots:[],inventoryMovements:[],costEntries:[],incidents:[],treatments:[],
 findings:[
  {id:'finding-shared',organizationId:'org-a',siteId:'site-a',targetType:'MATERIAL_PLANT',targetId:'material-a',materialPlantId:'material-a',status:'Abierto',reportedAt:'2026-08-17T08:00:00.000Z'},
  {id:'finding-shared',organizationId:'org-b',siteId:'site-b',targetType:'MATERIAL_PLANT',targetId:'material-b',materialPlantId:'material-b',status:'Abierto',reportedAt:'2026-08-17T08:00:00.000Z'}
 ],mipeInterventions:[],mipeCommandReceipts:[],plantEvents:[]
}}

test('M32-F006: same commandId in two organizations preserves both material intervention plant events',async()=>{
 let state=base();const events=[]
 const deps={publishEvent:async spec=>events.push(structuredClone(spec)),commit:recipe=>{state=recipe(state)}}
 const request={operation:MIPE_OPERATIONS.RECORD_INTERVENTION,entityId:'shared-command',input:{findingId:'finding-shared',type:'Tratamiento',product:'Producto',responsible:'Agrónomo'},commandId:'shared-command',occurredAt:'2026-08-17T10:00:00.000Z'}
 await executeMipeCommand(state,request,deps)
 state={...state,currentContext:{companyId:'org-b',siteId:'site-b'}}
 await executeMipeCommand(state,request,deps)
 assert.equal(state.mipeInterventions.filter(item=>item.id==='shared-command').length,2)
 assert.equal(state.mipeInterventions.find(item=>item.organizationId==='org-a').findingSnapshot.materialPlantId,'material-a')
 assert.equal(state.mipeInterventions.find(item=>item.organizationId==='org-b').findingSnapshot.materialPlantId,'material-b')
 assert.equal(state.plantEvents.filter(item=>item.id==='org-a:shared-command:plant-event').length,1)
 assert.equal(state.plantEvents.filter(item=>item.id==='org-b:shared-command:plant-event').length,1)
 assert.equal(state.plantEvents.find(item=>item.organizationId==='org-a').plantId,'material-a')
 assert.equal(state.plantEvents.find(item=>item.organizationId==='org-b').plantId,'material-b')
 assert.equal(state.mipeCommandReceipts.filter(item=>item.commandId==='shared-command').length,2)
})
