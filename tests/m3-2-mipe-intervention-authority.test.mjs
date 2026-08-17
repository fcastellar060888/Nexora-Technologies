import test from'node:test'
import assert from'node:assert/strict'
import{readFile}from'node:fs/promises'
import{createCanonicalMipeIntervention,reassignCanonicalMipeIntervention,verifyCanonicalMipeIntervention}from'../src/domain/mipeInterventionAuthority.js'
import{MIPE_REVIEW_TASK_STATUS,interventionCompletesReview,projectMipeReviewTasks}from'../src/domain/mipeReviewTasks.js'
import{executeMipeCommand,MIPE_OPERATIONS}from'../src/services/mipeCommand.js'

const positionFinding={id:'finding-pos',organizationId:'org-a',siteId:'site-a',plantPositionId:'position-a',targetType:'POSITION',targetId:'position-a',incidentId:'incident-a',severity:3,status:'Seguimiento',reportedAt:'2026-08-17T08:00:00.000Z'}
const materialFinding={id:'finding-mat',organizationId:'org-a',siteId:'site-a',materialPlantId:'material-a',targetType:'MATERIAL_PLANT',targetId:'material-a',type:'Ácaros',severity:'Alta',status:'Abierto',reportedAt:'2026-08-17T08:00:00.000Z'}

function state(){return{
 companies:[{id:'org-a'},{id:'org-b'}],currentContext:{companyId:'org-a',siteId:'site-a'},users:[{id:'user-a',name:'Agrónomo A',role:'Encargado MIPE',activeSession:true,active:true,remote:false}],memberships:[],roles:[],
 sites:[{id:'site-a',organizationId:'org-a',companyId:'org-a'},{id:'site-b',organizationId:'org-b',companyId:'org-b'}],houses:[],beds:[],plantPositions:[],grandmotherPlants:[],motherPlants:[],genetics:[],products:[],inventoryLots:[],inventoryMovements:[],costEntries:[],incidents:[],
 findings:[structuredClone(positionFinding),structuredClone(materialFinding),{...positionFinding,id:'finding-foreign',organizationId:'org-b',siteId:'site-b',plantPositionId:'position-b',targetId:'position-b'}],
 treatments:[{id:'treatment-a',organizationId:'org-a',siteId:'site-a',findingId:'finding-pos',productId:'product-a',status:'Ejecutado',lotId:'lot-a',executedAt:'2026-08-17T09:00:00.000Z'},{id:'treatment-b',organizationId:'org-b',siteId:'site-b',findingId:'finding-foreign',productId:'product-b',status:'Ejecutado'}],
 mipeInterventions:[],mipeCommandReceipts:[],materialPlantUnits:[],plantEvents:[]
}}
function harness(initial=state()){let current=structuredClone(initial);const events=[];return{events,get state(){return current},deps:{publishEvent:async spec=>events.push(structuredClone(spec)),commit:recipe=>{current=recipe(current)}}}}

test('M32-F006: canonical intervention captures tenant, target, actor and optional Treatment snapshot',()=>{
 const record=createCanonicalMipeIntervention({finding:positionFinding,treatment:state().treatments[0],organizationId:'org-a',commandId:'int-a',actor:{id:'user-a',name:'Agrónomo A'},occurredAt:'2026-08-17T10:00:00.000Z',input:{type:'Seguimiento',responsible:'Agrónomo A',outcome:'Disminución visible',nextReviewAt:'2026-08-18T10:00:00.000Z'}})
 assert.equal(record.id,'int-a')
 assert.equal(record.organizationId,'org-a')
 assert.equal(record.siteId,'site-a')
 assert.equal(record.findingSnapshot.targetType,'POSITION')
 assert.equal(record.findingSnapshot.plantPositionId,'position-a')
 assert.equal(record.treatmentSnapshot.id,'treatment-a')
 assert.equal(record.assignmentHistory[0].actor.id,'user-a')
 assert.deepEqual(verifyCanonicalMipeIntervention(record),{valid:true,errors:[]})
 assert.throws(()=>{record.assignmentHistory.push({})},TypeError)
})

test('M32-F006: foreign Treatment, regressive review and closed Finding fail closed',()=>{
 const source=state()
 assert.throws(()=>createCanonicalMipeIntervention({finding:positionFinding,treatment:source.treatments[1],organizationId:'org-a',commandId:'bad-treatment',occurredAt:'2026-08-17T10:00:00.000Z',input:{type:'Seguimiento',outcome:'x'}}),/otra empresa/)
 assert.throws(()=>createCanonicalMipeIntervention({finding:positionFinding,organizationId:'org-a',commandId:'bad-review',occurredAt:'2026-08-17T10:00:00.000Z',input:{type:'Seguimiento',outcome:'x',nextReviewAt:'2026-08-17T09:00:00.000Z'}}),/no puede preceder/)
 assert.throws(()=>createCanonicalMipeIntervention({finding:{...positionFinding,status:'Resuelto'},organizationId:'org-a',commandId:'closed',occurredAt:'2026-08-17T10:00:00.000Z',input:{type:'Seguimiento',outcome:'x'}}),/cerrado/)
})

test('M32-F006: a follow-up performed before or exactly at due time completes the review obligation',()=>{
 const source=createCanonicalMipeIntervention({finding:positionFinding,organizationId:'org-a',commandId:'source',occurredAt:'2026-08-17T08:00:00.000Z',input:{type:'Seguimiento',outcome:'Primera inspección',nextReviewAt:'2026-08-17T12:00:00.000Z'}})
 const early=createCanonicalMipeIntervention({finding:positionFinding,organizationId:'org-a',commandId:'early',occurredAt:'2026-08-17T10:00:00.000Z',input:{type:'Seguimiento',outcome:'Revisión anticipada'}})
 assert.equal(interventionCompletesReview(early,source),true)
 let tasks=projectMipeReviewTasks({findings:[positionFinding],mipeInterventions:[source,early]},{now:'2026-08-17T13:00:00.000Z',includeCompleted:true})
 assert.equal(tasks.length,1)
 assert.equal(tasks[0].status,MIPE_REVIEW_TASK_STATUS.COMPLETED)
 assert.equal(tasks[0].completedByInterventionId,'early')
 const exact=createCanonicalMipeIntervention({finding:positionFinding,organizationId:'org-a',commandId:'exact',occurredAt:'2026-08-17T12:00:00.000Z',input:{type:'Seguimiento',outcome:'Revisión puntual'}})
 tasks=projectMipeReviewTasks({findings:[positionFinding],mipeInterventions:[source,exact]},{now:'2026-08-17T13:00:00.000Z',includeCompleted:true})
 assert.equal(tasks[0].status,MIPE_REVIEW_TASK_STATUS.COMPLETED)
})

test('M32-F006: simultaneous interventions do not complete each other review obligations',()=>{
 const source=createCanonicalMipeIntervention({finding:positionFinding,organizationId:'org-a',commandId:'same-source',occurredAt:'2026-08-17T08:00:00.000Z',input:{type:'Seguimiento',outcome:'Origen',nextReviewAt:'2026-08-17T09:00:00.000Z'}})
 const simultaneous=createCanonicalMipeIntervention({finding:positionFinding,organizationId:'org-a',commandId:'same-peer',occurredAt:'2026-08-17T08:00:00.000Z',input:{type:'Seguimiento',outcome:'Registro simultáneo',nextReviewAt:'2026-08-18T09:00:00.000Z'}})
 assert.equal(interventionCompletesReview(simultaneous,source),false)
 assert.equal(interventionCompletesReview(source,simultaneous),false)
 const tasks=projectMipeReviewTasks({findings:[positionFinding],mipeInterventions:[source,simultaneous]},{now:'2026-08-17T10:00:00.000Z'})
 assert.equal(tasks.find(item=>item.interventionId==='same-source').status,MIPE_REVIEW_TASK_STATUS.OVERDUE)
 assert.equal(tasks.find(item=>item.interventionId==='same-peer').status,MIPE_REVIEW_TASK_STATUS.PENDING)
})

test('M32-F006: review projection isolates same Finding id across organizations',()=>{
 const findingA={...positionFinding,id:'finding-shared'},findingB={...positionFinding,id:'finding-shared',organizationId:'org-b',siteId:'site-b',plantPositionId:'position-b',targetId:'position-b'}
 const sourceA=createCanonicalMipeIntervention({finding:findingA,organizationId:'org-a',commandId:'source-a',occurredAt:'2026-08-17T08:00:00.000Z',input:{type:'Seguimiento',outcome:'A',nextReviewAt:'2026-08-17T12:00:00.000Z'}})
 const foreignB=createCanonicalMipeIntervention({finding:findingB,organizationId:'org-b',commandId:'foreign-b',occurredAt:'2026-08-17T10:00:00.000Z',input:{type:'Seguimiento',outcome:'B'}})
 assert.equal(interventionCompletesReview(foreignB,sourceA),false)
 const tasks=projectMipeReviewTasks({findings:[findingA,findingB],mipeInterventions:[sourceA,foreignB]},{now:'2026-08-17T13:00:00.000Z',organizationId:'org-a',includeCompleted:true})
 assert.equal(tasks.length,1)
 assert.equal(tasks[0].organizationId,'org-a')
 assert.equal(tasks[0].status,MIPE_REVIEW_TASK_STATUS.OVERDUE)
 assert.equal(tasks[0].completedByInterventionId,'')
})

test('M32-F006: command records canonical POSITION follow-up without bogus material plant event',async()=>{
 const h=harness()
 await executeMipeCommand(h.state,{operation:MIPE_OPERATIONS.RECORD_INTERVENTION,input:{findingId:'finding-pos',treatmentId:'treatment-a',type:'Seguimiento',responsible:'Agrónomo A',outcome:'Sin nuevas lesiones',nextReviewAt:'2026-08-18T10:00:00.000Z'},commandId:'cmd-pos',occurredAt:'2026-08-17T10:00:00.000Z'},h.deps)
 const record=h.state.mipeInterventions.find(item=>item.id==='cmd-pos')
 assert.equal(record.organizationId,'org-a')
 assert.equal(record.findingSnapshot.targetType,'POSITION')
 assert.equal(record.assignmentHistory[0].actor.id,'user-a')
 assert.equal(h.state.plantEvents.length,0)
})

test('M32-F006: material intervention emits one deterministic plant event and reassignment is append-only/replay-safe',async()=>{
 const h=harness()
 await executeMipeCommand(h.state,{operation:MIPE_OPERATIONS.RECORD_INTERVENTION,input:{findingId:'finding-mat',type:'Tratamiento',product:'Jabón potásico',dose:'5 mL/L',responsible:'Agrónomo A',nextReviewAt:'2026-08-18T10:00:00.000Z'},commandId:'cmd-mat',occurredAt:'2026-08-17T10:00:00.000Z'},h.deps)
 assert.equal(h.state.mipeInterventions.find(item=>item.id==='cmd-mat').findingSnapshot.targetType,'MATERIAL_PLANT')
 assert.equal(h.state.plantEvents.filter(item=>item.id==='cmd-mat:plant-event').length,1)
 const request={operation:MIPE_OPERATIONS.REASSIGN_INTERVENTION,entityId:'cmd-mat',input:{responsible:'Técnico B'},commandId:'cmd-reassign',occurredAt:'2026-08-17T11:00:00.000Z'}
 await executeMipeCommand(h.state,request,h.deps)
 let record=h.state.mipeInterventions.find(item=>item.id==='cmd-mat')
 assert.equal(record.responsible,'Técnico B')
 assert.equal(record.assignmentHistory.length,2)
 assert.equal(record.assignmentHistory.at(-1).previousResponsible,'Agrónomo A')
 await executeMipeCommand(h.state,request,h.deps)
 record=h.state.mipeInterventions.find(item=>item.id==='cmd-mat')
 assert.equal(record.assignmentHistory.length,2)
 assert.equal(h.state.plantEvents.filter(item=>item.id==='cmd-mat:plant-event').length,1)
})

test('M32-F006: command boundary no longer imports legacy intervention mutation helpers',async()=>{
 const source=await readFile('src/services/mipeCommand.js','utf8')
 assert.match(source,/createCanonicalMipeIntervention/)
 assert.match(source,/reassignCanonicalMipeIntervention/)
 assert.doesNotMatch(source,/appendMipeIntervention/)
 assert.doesNotMatch(source,/reassignMipeReviewTask/)
})

test('M32-F006: direct reassignment authority is idempotent by assignment event id',()=>{
 const base=createCanonicalMipeIntervention({finding:materialFinding,organizationId:'org-a',commandId:'int-base',actor:{id:'u1'},occurredAt:'2026-08-17T10:00:00.000Z',input:{type:'Tratamiento',product:'Aceite',responsible:'A'}})
 const first=reassignCanonicalMipeIntervention(base,{responsible:'B',commandId:'reassign-1',actor:{id:'u2'},occurredAt:'2026-08-17T11:00:00.000Z'})
 const replay=reassignCanonicalMipeIntervention(first,{responsible:'B',commandId:'reassign-1',actor:{id:'u2'},occurredAt:'2026-08-17T09:00:00.000Z'})
 assert.equal(replay.assignmentHistory.length,2)
 assert.equal(replay.responsible,'B')
 assert.deepEqual(verifyCanonicalMipeIntervention(replay),{valid:true,errors:[]})
})
