import test from'node:test'
import assert from'node:assert/strict'
import{DomainEvents}from'../src/core/events/eventCatalog.js'
import{MIPE_OPERATIONS,executeMipeCommand}from'../src/services/mipeCommand.js'

function state(){return{
 currentContext:{companyId:'org-a',siteId:'site-a'},companies:[{id:'org-a'}],
 users:[{id:'user-a',name:'Operador MIPE',activeSession:true,active:true,remote:true}],
 roles:[{id:'mipe-site',permissions:['manage_mipe']}],memberships:[{id:'membership-a',userId:'user-a',companyId:'org-a',roleId:'mipe-site',siteIds:['site-a'],status:'active'}],
 sites:[{id:'site-a',organizationId:'org-a',companyId:'org-a',name:'A'},{id:'site-b',organizationId:'org-a',companyId:'org-a',name:'B'}],
 houses:[{id:'house-a',organizationId:'org-a',siteId:'site-a'},{id:'house-b',organizationId:'org-a',siteId:'site-b'}],
 beds:[{id:'bed-a',organizationId:'org-a',siteId:'site-a',houseId:'house-a'},{id:'bed-b',organizationId:'org-a',siteId:'site-b',houseId:'house-b'}],
 plantPositions:[{id:'plant-a',organizationId:'org-a',siteId:'site-a',houseId:'house-a',bedId:'bed-a',active:true}],
 incidents:[{id:'incident-a',organizationId:'org-a',name:'Botritis',active:true}],findings:[],treatments:[],mipeInterventions:[],mipeCommandReceipts:[],
 grandmotherPlants:[],motherPlants:[],materialPlantUnits:[],genetics:[],products:[],inventoryLots:[],inventoryMovements:[],costEntries:[],plantEvents:[]
}}
function request(){return{operation:MIPE_OPERATIONS.CREATE_FINDING,input:{plantPositionId:'plant-a',incidentId:'incident-a',severity:3,notes:'Prueba commit-scope'},commandId:'cmd-mipe-commit-scope',occurredAt:'2026-08-17T19:58:00.000Z'}}

test('F012: MIPE revalida permiso site-scoped entre requested y commit',async()=>{
 let current=state(),events=[]
 const deps={
  publishEvent:async event=>{events.push(event);if(event.name===DomainEvents.CORE_OPERATION_REQUESTED)current={...current,memberships:current.memberships.map(item=>({...item,siteIds:['site-b']}))};return event},
  commit:recipe=>{current=recipe(current)}
 }
 await assert.rejects(()=>executeMipeCommand(current,request(),deps),/permiso manage_mipe|sede real|site/i)
 assert.equal(events.length,1)
 assert.equal(events[0].name,DomainEvents.CORE_OPERATION_REQUESTED)
 assert.deepEqual(current.findings,[])
 assert.deepEqual(current.mipeCommandReceipts,[])
})

test('F012: MIPE revalida la sede causal del target entre requested y commit',async()=>{
 let current=state(),events=[]
 const deps={
  publishEvent:async event=>{events.push(event);if(event.name===DomainEvents.CORE_OPERATION_REQUESTED)current={...current,plantPositions:current.plantPositions.map(item=>item.id==='plant-a'?{...item,siteId:'site-b',houseId:'house-b',bedId:'bed-b'}:item)};return event},
  commit:recipe=>{current=recipe(current)}
 }
 await assert.rejects(()=>executeMipeCommand(current,request(),deps),/sede.*cambió|target.*cambió|ubicación|permiso manage_mipe/i)
 assert.equal(events.length,1)
 assert.equal(events[0].name,DomainEvents.CORE_OPERATION_REQUESTED)
 assert.deepEqual(current.findings,[])
 assert.deepEqual(current.mipeCommandReceipts,[])
})
