import test from'node:test'
import assert from'node:assert/strict'
import{DomainEvents}from'../src/core/events/eventCatalog.js'
import{MIPE_FINDING_TRANSITIONS,verifyMipeFindingHistory}from'../src/domain/mipeFindingWorkflow.js'
import{executeMipeCommand,MIPE_OPERATIONS}from'../src/services/mipeCommand.js'

function state(){return{
 companies:[{id:'org-a'}],currentContext:{companyId:'org-a',siteId:'site-a'},users:[{id:'u-a',name:'Agrónomo',role:'Encargado MIPE',activeSession:true,active:true,remote:false}],memberships:[],roles:[],
 sites:[{id:'site-a',organizationId:'org-a',companyId:'org-a'}],houses:[{id:'house-a',organizationId:'org-a',siteId:'site-a'}],beds:[{id:'bed-a',organizationId:'org-a',siteId:'site-a',houseId:'house-a'}],plantPositions:[{id:'plant-a',organizationId:'org-a',siteId:'site-a',bedId:'bed-a',active:true}],
 incidents:[{id:'incident-a',organizationId:'org-a',name:'Ácaros'}],findings:[],products:[{id:'product-a',organizationId:'org-a',siteId:'site-a',name:'Producto A',category:'MIPE',unit:'mL',doseMin:1,doseMax:4,doseUnit:'mL/L',cost:2,reentryHours:12,withdrawalDays:2}],inventoryLots:[{id:'lot-a',organizationId:'org-a',siteId:'site-a',productId:'product-a',lotNumber:'L-A',quantity:1000}],inventoryMovements:[],costEntries:[],treatments:[],mipeInterventions:[],mipeCommandReceipts:[],grandmotherPlants:[],motherPlants:[],materialPlantUnits:[],plantEvents:[],genetics:[]
}}
function harness(initial=state()){let current=structuredClone(initial);const events=[];return{events,get state(){return current},deps:{publishEvent:async spec=>events.push(structuredClone(spec)),commit:recipe=>{current=recipe(current)}}}}

async function createFinding(h){await executeMipeCommand(h.state,{operation:MIPE_OPERATIONS.CREATE_FINDING,input:{plantPositionId:'plant-a',incidentId:'incident-a',severity:2,notes:'Original'},commandId:'cmd-create',occurredAt:'2026-08-17T01:00:00.000Z'},h.deps);return h.state.findings[0]}

test('M32-F005: command-created finding has CREATED history and cannot start in arbitrary state',async()=>{
 const h=harness();const finding=await createFinding(h)
 assert.equal(finding.status,'Detectado')
 assert.equal(finding.mipeHistory.length,1)
 assert.equal(finding.mipeHistory[0].type,'CREATED')
 assert.deepEqual(verifyMipeFindingHistory(finding),{valid:true,errors:[]})
 const bad=harness()
 await assert.rejects(()=>executeMipeCommand(bad.state,{operation:MIPE_OPERATIONS.CREATE_FINDING,input:{plantPositionId:'plant-a',incidentId:'incident-a',severity:2,status:'Seguimiento'},commandId:'cmd-bad',occurredAt:'2026-08-17T01:00:00.000Z'},bad.deps),/debe iniciar en Detectado/)
 assert.equal(bad.events.length,0)
})

test('M32-F005: correction records before/after and preserves original date and state',async()=>{
 const h=harness();const original=await createFinding(h)
 await executeMipeCommand(h.state,{operation:MIPE_OPERATIONS.CORRECT_FINDING,entityId:original.id,input:{severity:3,notes:'Confirmado',status:'Resuelto',createdAt:'2020-01-01',correctionReason:'Verificación microscópica'},commandId:'cmd-correct',occurredAt:'2026-08-17T02:00:00.000Z'},h.deps)
 const corrected=h.state.findings[0]
 assert.equal(corrected.createdAt,'2026-08-17T01:00:00.000Z')
 assert.equal(corrected.status,'Detectado')
 assert.equal(corrected.severity,3)
 assert.equal(corrected.mipeHistory.at(-1).type,'CORRECTION')
 assert.equal(corrected.mipeHistory.at(-1).reason,'Verificación microscópica')
 assert.equal(h.events.at(-1).name,DomainEvents.MIPE_FINDING_CORRECTED)
 assert.deepEqual(verifyMipeFindingHistory(corrected),{valid:true,errors:[]})
})

test('M32-F005: explicit transition publishes semantic event and invalid skip fails before requested event',async()=>{
 const h=harness();const finding=await createFinding(h),before=h.events.length
 await assert.rejects(()=>executeMipeCommand(h.state,{operation:MIPE_OPERATIONS.TRANSITION_FINDING,entityId:finding.id,input:{transition:MIPE_FINDING_TRANSITIONS.START_FOLLOW_UP},commandId:'cmd-skip',occurredAt:'2026-08-17T02:00:00.000Z'},h.deps),/no está permitida/)
 assert.equal(h.events.length,before)
 await executeMipeCommand(h.state,{operation:MIPE_OPERATIONS.TRANSITION_FINDING,entityId:finding.id,input:{transition:MIPE_FINDING_TRANSITIONS.START_EVALUATION,reason:'Inspección técnica'},commandId:'cmd-eval',occurredAt:'2026-08-17T02:00:00.000Z'},h.deps)
 assert.equal(h.state.findings[0].status,'En evaluación')
 assert.equal(h.events.at(-1).name,DomainEvents.MIPE_FINDING_TRANSITIONED)
 assert.equal(h.state.findings[0].mipeHistory.at(-1).transition,MIPE_FINDING_TRANSITIONS.START_EVALUATION)
})

test('M32-F005: hard-delete is rejected before requested event and leaves evidence intact',async()=>{
 const h=harness();const finding=await createFinding(h),before=h.events.length
 await assert.rejects(()=>executeMipeCommand(h.state,{operation:MIPE_OPERATIONS.DELETE_FINDING,entityId:finding.id,commandId:'cmd-delete'},h.deps),/hard-delete.*prohibido/i)
 assert.equal(h.events.length,before)
 assert.equal(h.state.findings.length,1)
})

test('M32-F005: schedule and execute append approved, in-treatment and follow-up transitions into the same finding record',async()=>{
 const h=harness();const finding=await createFinding(h)
 await executeMipeCommand(h.state,{operation:MIPE_OPERATIONS.SCHEDULE_TREATMENT,input:{findingId:finding.id,productId:'product-a',dose:2,doseUnit:'mL/L',mixVolume:100,date:'2026-08-17',responsible:'Agrónomo'},commandId:'cmd-schedule',occurredAt:'2026-08-17T02:00:00.000Z'},h.deps)
 let current=h.state.findings[0]
 assert.equal(current.status,'Tratamiento aprobado')
 assert.equal(current.mipeHistory.at(-1).transition,MIPE_FINDING_TRANSITIONS.APPROVE_TREATMENT)
 await executeMipeCommand(h.state,{operation:MIPE_OPERATIONS.EXECUTE_TREATMENT,entityId:'cmd-schedule',input:{lotId:'lot-a',responsible:'Agrónomo'},commandId:'cmd-execute',occurredAt:'2026-08-17T03:00:00.000Z'},h.deps)
 current=h.state.findings[0]
 assert.equal(current.status,'Seguimiento')
 assert.deepEqual(current.mipeHistory.slice(-2).map(item=>item.transition),[MIPE_FINDING_TRANSITIONS.BEGIN_TREATMENT,MIPE_FINDING_TRANSITIONS.START_FOLLOW_UP])
 assert.equal(current.mipeHistoryVersion,current.mipeHistory.length)
 assert.deepEqual(verifyMipeFindingHistory(current),{valid:true,errors:[]})
})

test('M32-F005: terminal resolution is append-only and cannot be reopened by transition',async()=>{
 const h=harness();const finding=await createFinding(h)
 await executeMipeCommand(h.state,{operation:MIPE_OPERATIONS.RESOLVE_FINDING,entityId:finding.id,input:{status:'Resuelto',resolutionNotes:'Sin signos'},commandId:'cmd-resolve',occurredAt:'2026-08-17T02:00:00.000Z'},h.deps)
 const resolved=h.state.findings[0]
 assert.equal(resolved.status,'Resuelto')
 assert.equal(resolved.mipeHistory.at(-1).transition,MIPE_FINDING_TRANSITIONS.RESOLVE)
 const count=resolved.mipeHistory.length,before=h.events.length
 await assert.rejects(()=>executeMipeCommand(h.state,{operation:MIPE_OPERATIONS.TRANSITION_FINDING,entityId:finding.id,input:{transition:MIPE_FINDING_TRANSITIONS.START_EVALUATION},commandId:'cmd-reopen',occurredAt:'2026-08-17T03:00:00.000Z'},h.deps),/está cerrado/)
 assert.equal(h.events.length,before)
 assert.equal(h.state.findings[0].mipeHistory.length,count)
})
