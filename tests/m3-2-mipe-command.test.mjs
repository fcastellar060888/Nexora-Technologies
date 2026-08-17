import test from'node:test'
import assert from'node:assert/strict'
import{DomainEvents}from'../src/core/events/eventCatalog.js'
import{MIPE_OPERATIONS,executeMipeCommand}from'../src/services/mipeCommand.js'

function baseState(role='Encargado MIPE'){return{
 companies:[{id:'org-a'},{id:'org-b'}],currentContext:{companyId:'org-a',siteId:'site-a'},
 users:[{id:'user-a',name:'Operador',role,activeSession:true,active:true,remote:false}],memberships:[],roles:[],
 sites:[{id:'site-a',organizationId:'org-a',companyId:'org-a'},{id:'site-b',organizationId:'org-b',companyId:'org-b'}],
 houses:[{id:'house-a',organizationId:'org-a',siteId:'site-a'},{id:'house-b',organizationId:'org-b',siteId:'site-b'}],
 beds:[{id:'bed-a',organizationId:'org-a',siteId:'site-a',houseId:'house-a'},{id:'bed-b',organizationId:'org-b',siteId:'site-b',houseId:'house-b'}],
 plantPositions:[{id:'plant-shared',organizationId:'org-a',siteId:'site-a',bedId:'bed-a',active:true},{id:'plant-shared',organizationId:'org-b',siteId:'site-b',bedId:'bed-b',active:true}],
 grandmotherPlants:[],motherPlants:[],materialPlantUnits:[],plantEvents:[],genetics:[],
 incidents:[{id:'incident-shared',organizationId:'org-a',name:'Ácaro A'},{id:'incident-shared',organizationId:'org-b',name:'Ácaro B'}],
 findings:[{id:'finding-shared',organizationId:'org-a',siteId:'site-a',plantPositionId:'plant-shared',targetType:'POSITION',targetId:'plant-shared',incidentId:'incident-shared',status:'Detectado',severity:2},{id:'finding-shared',organizationId:'org-b',siteId:'site-b',plantPositionId:'plant-shared',targetType:'POSITION',targetId:'plant-shared',incidentId:'incident-shared',status:'Detectado',severity:4}],
 products:[{id:'product-shared',organizationId:'org-a',siteId:'site-a',name:'Producto A',category:'MIPE',unit:'mL',doseMin:1,doseMax:5,doseUnit:'mL/L',cost:2,reentryHours:12,withdrawalDays:3},{id:'product-shared',organizationId:'org-b',siteId:'site-b',name:'Producto B',category:'MIPE',unit:'mL',doseMin:1,doseMax:5,doseUnit:'mL/L',cost:9,reentryHours:24,withdrawalDays:7}],
 inventoryLots:[{id:'lot-shared',organizationId:'org-a',siteId:'site-a',productId:'product-shared',lotNumber:'LOT-A',quantity:10000},{id:'lot-shared',organizationId:'org-b',siteId:'site-b',productId:'product-shared',lotNumber:'LOT-B',quantity:10000}],
 inventoryMovements:[],costEntries:[],treatments:[],mipeInterventions:[],mipeCommandReceipts:[]
}}

function harness(initial){
 let state=structuredClone(initial);const events=[]
 const deps={publishEvent:async spec=>{events.push(structuredClone(spec));return spec},commit:(recipe)=>{state=recipe(state)}}
 return{deps,events,get state(){return state},setState(value){state=value}}
}

test('M32-F003: command publishes requested then canonical completion with deterministic causality',async()=>{
 const h=harness(baseState())
 await executeMipeCommand(h.state,{operation:MIPE_OPERATIONS.CREATE_INCIDENT,input:{name:'Trips',category:'Plaga',risk:'Alto'},commandId:'cmd-create-incident',occurredAt:'2026-08-16T20:00:00.000Z'},h.deps)
 assert.equal(h.state.incidents.filter(item=>item.organizationId==='org-a'&&item.id==='cmd-create-incident').length,1)
 assert.equal(h.events.length,2)
 assert.equal(h.events[0].name,DomainEvents.CORE_OPERATION_REQUESTED)
 assert.equal(h.events[0].eventId,'cmd-create-incident:requested')
 assert.equal(h.events[1].name,DomainEvents.MIPE_INCIDENT_CREATED)
 assert.equal(h.events[1].eventId,'cmd-create-incident:completed')
 assert.equal(h.events[1].correlationId,'cmd-create-incident')
 assert.equal(h.events[1].causationId,'cmd-create-incident:requested')
 assert.equal(h.state.mipeCommandReceipts[0].commandId,'cmd-create-incident')
})

test('M32-F003: identical replay is effect-idempotent and command collision fails before publication',async()=>{
 const h=harness(baseState()),request={operation:MIPE_OPERATIONS.CREATE_INCIDENT,input:{name:'Trips'},commandId:'cmd-replay',occurredAt:'2026-08-16T20:00:00.000Z'}
 await executeMipeCommand(h.state,request,h.deps)
 await executeMipeCommand(h.state,request,h.deps)
 assert.equal(h.state.incidents.filter(item=>item.organizationId==='org-a'&&item.id==='cmd-replay').length,1)
 assert.equal(h.state.mipeCommandReceipts.filter(item=>item.commandId==='cmd-replay').length,1)
 const before=h.events.length
 await assert.rejects(()=>executeMipeCommand(h.state,{...request,input:{name:'Mosca blanca'}},h.deps),/contenido diferente/)
 assert.equal(h.events.length,before)
})

test('M32-F003: permission denial occurs before requested event or state mutation',async()=>{
 const h=harness(baseState('Gerente')),before=structuredClone(h.state)
 await assert.rejects(()=>executeMipeCommand(h.state,{operation:MIPE_OPERATIONS.UPDATE_FINDING,entityId:'finding-shared',input:{notes:'Cambio',correctionReason:'Prueba de permiso'},commandId:'cmd-denied'},h.deps),/permiso manage_mipe/)
 assert.deepEqual(h.state,before)
 assert.deepEqual(h.events,[])
})

test('M32-F003: execute treatment requires execute_treatments independently from manage_mipe',async()=>{
 const state=baseState('Supervisor'),schedule=harness(state)
 await executeMipeCommand(schedule.state,{operation:MIPE_OPERATIONS.SCHEDULE_TREATMENT,input:{findingId:'finding-shared',productId:'product-shared',dose:2,doseUnit:'mL/L',mixVolume:100,date:'2026-08-17',responsible:'Operador'},commandId:'cmd-treatment'},schedule.deps)
 assert.equal(schedule.state.treatments.some(item=>item.id==='cmd-treatment'&&item.organizationId==='org-a'),true)
 const execution=harness(schedule.state)
 await assert.rejects(()=>executeMipeCommand(execution.state,{operation:MIPE_OPERATIONS.EXECUTE_TREATMENT,entityId:'cmd-treatment',input:{lotId:'lot-shared',responsible:'Operador'},commandId:'cmd-execute'},execution.deps),/permiso execute_treatments/)
 assert.equal(execution.state.inventoryLots.find(item=>item.organizationId==='org-a').quantity,10000)
 assert.deepEqual(execution.events,[])
})

test('M32-F003: cross-tenant reference is rejected before requested event',async()=>{
 const state=baseState();state.incidents=state.incidents.filter(item=>item.organizationId==='org-b');const h=harness(state)
 await assert.rejects(()=>executeMipeCommand(h.state,{operation:MIPE_OPERATIONS.CREATE_FINDING,input:{plantPositionId:'plant-shared',incidentId:'incident-shared',severity:3},commandId:'cmd-cross'},h.deps),/otra empresa|ownership inequívoco/)
 assert.deepEqual(h.events,[])
 assert.equal(h.state.findings.length,2)
})

test('M32-F003: tenant change between intent and commit fails closed and emits no completion',async()=>{
 let state=baseState(),events=[]
 const deps={publishEvent:async spec=>{events.push(spec)},commit:recipe=>{state={...state,currentContext:{...state.currentContext,companyId:'org-b',siteId:'site-b'}};state=recipe(state)}}
 await assert.rejects(()=>executeMipeCommand(state,{operation:MIPE_OPERATIONS.UPDATE_FINDING,entityId:'finding-shared',input:{notes:'No debe confirmar',correctionReason:'Prueba de cambio de tenant'},commandId:'cmd-switch'},deps),/empresa activa cambió/)
 assert.equal(events.length,1)
 assert.equal(events[0].name,DomainEvents.CORE_OPERATION_REQUESTED)
 assert.equal(state.findings.find(item=>item.organizationId==='org-a').notes,undefined)
 assert.equal(state.mipeCommandReceipts.length,0)
})

test('M32-F003: treatment execution mutates only active tenant and replay does not double consume',async()=>{
 const state=baseState(),h=harness(state)
 await executeMipeCommand(h.state,{operation:MIPE_OPERATIONS.SCHEDULE_TREATMENT,input:{findingId:'finding-shared',productId:'product-shared',dose:2,doseUnit:'mL/L',mixVolume:100,date:'2026-08-17',responsible:'Operador'},commandId:'cmd-schedule'},h.deps)
 const executeRequest={operation:MIPE_OPERATIONS.EXECUTE_TREATMENT,entityId:'cmd-schedule',input:{lotId:'lot-shared',responsible:'Operador'},commandId:'cmd-execute-once',occurredAt:'2026-08-17T10:00:00.000Z'}
 await executeMipeCommand(h.state,executeRequest,h.deps)
 const activeAfter=h.state.inventoryLots.find(item=>item.organizationId==='org-a'),foreignAfter=h.state.inventoryLots.find(item=>item.organizationId==='org-b')
 assert.equal(activeAfter.quantity,9800)
 assert.equal(foreignAfter.quantity,10000)
 assert.equal(h.state.inventoryMovements.filter(item=>item.organizationId==='org-a').length,1)
 await executeMipeCommand(h.state,executeRequest,h.deps)
 assert.equal(h.state.inventoryLots.find(item=>item.organizationId==='org-a').quantity,9800)
 assert.equal(h.state.inventoryMovements.filter(item=>item.organizationId==='org-a').length,1)
})

test('M32-F003: intervention command resolves the active-tenant finding before invoking legacy helper',async()=>{
 const h=harness(baseState())
 await executeMipeCommand(h.state,{operation:MIPE_OPERATIONS.RECORD_INTERVENTION,input:{findingId:'finding-shared',type:'Seguimiento',responsible:'Operador',outcome:'Disminuyó la incidencia',nextReviewAt:'2026-08-18T10:00:00.000Z'},commandId:'cmd-intervention',occurredAt:'2026-08-17T10:00:00.000Z'},h.deps)
 assert.equal(h.state.mipeInterventions.length,1)
 assert.equal(h.state.mipeInterventions[0].id,'cmd-intervention')
 assert.equal(h.state.mipeInterventions[0].organizationId,'org-a')
 assert.equal(h.state.mipeInterventions[0].findingId,'finding-shared')
 assert.equal(h.events.at(-1).name,DomainEvents.MIPE_INTERVENTION_RECORDED)
})
