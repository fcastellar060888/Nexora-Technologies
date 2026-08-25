import test from'node:test'
import assert from'node:assert/strict'
import{DomainEvents}from'../src/core/events/eventCatalog.js'
import{MIPE_OPERATIONS,executeMipeCommand}from'../src/services/mipeCommand.js'

function baseState(){return{
 currentContext:{companyId:'org-a',siteId:'site-a'},companies:[{id:'org-a'}],
 users:[{id:'user-a',name:'Operador MIPE',activeSession:true,active:true,remote:true}],
 roles:[{id:'mipe-site',permissions:['manage_mipe','execute_treatments']}],memberships:[{id:'membership-a',userId:'user-a',companyId:'org-a',roleId:'mipe-site',siteIds:['site-a'],status:'active'}],
 sites:[{id:'site-a',organizationId:'org-a',companyId:'org-a',name:'A'}],houses:[{id:'house-a',organizationId:'org-a',siteId:'site-a'}],beds:[{id:'bed-a',organizationId:'org-a',siteId:'site-a',houseId:'house-a'}],
 plantPositions:[
  {id:'plant-a',organizationId:'org-a',siteId:'site-a',houseId:'house-a',bedId:'bed-a',active:true},
  {id:'plant-b',organizationId:'org-a',siteId:'site-a',houseId:'house-a',bedId:'bed-a',active:true}
 ],
 incidents:[{id:'incident-a',organizationId:'org-a',name:'Botritis',active:true}],products:[{id:'product-a',organizationId:'org-a',siteId:'site-a',name:'Bio',category:'MIPE',active:true,unit:'mL',doseUnit:'mL/L',doseMin:1,doseMax:5,reentryHours:12,withdrawalDays:2,cost:10,technicalRevision:1}],
 inventoryLots:[{id:'lot-a',organizationId:'org-a',siteId:'site-a',productId:'product-a',lotNumber:'LOT-A',quantity:100,unit:'mL'}],inventoryMovements:[],costEntries:[],
 findings:[
  {id:'finding-a',organizationId:'org-a',siteId:'site-a',plantPositionId:'plant-a',targetType:'POSITION',targetId:'plant-a',incidentId:'incident-a',severity:2,status:'Seguimiento',reportedAt:'2026-08-17T18:00:00.000Z',createdAt:'2026-08-17T18:00:00.000Z'},
  {id:'finding-b',organizationId:'org-a',siteId:'site-a',plantPositionId:'plant-b',targetType:'POSITION',targetId:'plant-b',incidentId:'incident-a',severity:2,status:'Seguimiento',reportedAt:'2026-08-17T18:00:00.000Z',createdAt:'2026-08-17T18:00:00.000Z'}
 ],treatments:[],mipeInterventions:[],mipeCommandReceipts:[],plantEvents:[],grandmotherPlants:[],motherPlants:[],materialPlantUnits:[],genetics:[]
}}
function requestedMutation(current,setCurrent,mutate){return async event=>{if(event.name===DomainEvents.CORE_OPERATION_REQUESTED)setCurrent(mutate(current()));return event}}

test('F012 causal identity: Finding no puede cambiar de target dentro de la misma sede entre requested y commit',async()=>{
 let state=baseState();const get=()=>state,set=value=>{state=value}
 const deps={publishEvent:requestedMutation(get,set,current=>({...current,findings:current.findings.map(item=>item.id==='finding-a'?{...item,plantPositionId:'plant-b',targetId:'plant-b'}:item)})),commit:recipe=>{state=recipe(state)}}
 const command={operation:MIPE_OPERATIONS.CORRECT_FINDING,entityId:'finding-a',input:{severity:3,correctionReason:'Ajuste de severidad'},commandId:'cmd-target-toctou',occurredAt:'2026-08-17T20:00:00.000Z'}
 await assert.rejects(()=>executeMipeCommand(state,command,deps),/identidad causal.*target.*cambió/i)
 assert.equal(state.findings.find(item=>item.id==='finding-a').severity,2)
 assert.deepEqual(state.mipeCommandReceipts,[])
})

test('F012 causal identity: Treatment no puede cambiar de Finding dentro de la misma sede entre requested y commit',async()=>{
 let state=baseState();state.findings=state.findings.map(item=>({...item,status:'Tratamiento aprobado'}));state.treatments=[{id:'treatment-a',organizationId:'org-a',siteId:'site-a',findingId:'finding-a',productId:'product-a',dose:2,doseUnit:'mL/L',mixVolume:10,totalQuantity:20,inventoryUnit:'mL',status:'Programado',createdAt:'2026-08-17T19:00:00.000Z'}]
 const get=()=>state,set=value=>{state=value},deps={publishEvent:requestedMutation(get,set,current=>({...current,treatments:current.treatments.map(item=>item.id==='treatment-a'?{...item,findingId:'finding-b'}:item)})),commit:recipe=>{state=recipe(state)}}
 const command={operation:MIPE_OPERATIONS.EXECUTE_TREATMENT,entityId:'treatment-a',input:{lotId:'lot-a',responsible:'Operador'},commandId:'cmd-treatment-parent-toctou',occurredAt:'2026-08-17T20:00:00.000Z'}
 await assert.rejects(()=>executeMipeCommand(state,command,deps),/Treatment.*Finding cambió/i)
 assert.equal(state.inventoryLots[0].quantity,100)
 assert.deepEqual(state.inventoryMovements,[])
 assert.deepEqual(state.mipeCommandReceipts,[])
})

test('F012 causal identity: Intervention no puede cambiar de Finding dentro de la misma sede entre requested y commit',async()=>{
 let state=baseState();state.mipeInterventions=[{id:'intervention-a',organizationId:'org-a',siteId:'site-a',findingId:'finding-a',type:'Seguimiento',responsible:'Ana',outcome:'Estable',performedAt:'2026-08-17T19:00:00.000Z',assignmentHistory:[{id:'intervention-a:assignment:created',kind:'ASSIGNED',previousResponsible:'',responsible:'Ana',actor:{id:'user-a',name:'Operador MIPE'},occurredAt:'2026-08-17T19:00:00.000Z'}],createdAt:'2026-08-17T19:00:00.000Z',updatedAt:'2026-08-17T19:00:00.000Z'}]
 const get=()=>state,set=value=>{state=value},deps={publishEvent:requestedMutation(get,set,current=>({...current,mipeInterventions:current.mipeInterventions.map(item=>item.id==='intervention-a'?{...item,findingId:'finding-b'}:item)})),commit:recipe=>{state=recipe(state)}}
 const command={operation:MIPE_OPERATIONS.REASSIGN_INTERVENTION,entityId:'intervention-a',input:{responsible:'Carlos'},commandId:'cmd-intervention-parent-toctou',occurredAt:'2026-08-17T20:00:00.000Z'}
 await assert.rejects(()=>executeMipeCommand(state,command,deps),/Intervention.*Finding cambió/i)
 assert.equal(state.mipeInterventions[0].responsible,'Ana')
 assert.deepEqual(state.mipeCommandReceipts,[])
})
