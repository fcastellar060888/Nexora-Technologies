import test from'node:test'
import assert from'node:assert/strict'
import{MIRFE_WORKFLOW_STATES,MIRFE_WORKFLOW_TRANSITIONS,availableMirfeTransitions,createMirfeCorrection,createMirfeMonitoring,createMirfeReinforcement,migrateLegacyMirfeWorkflowState,transitionMirfeReinforcement,verifyMirfeReinforcementWorkflow}from'../src/domain/mirfeWorkflow.js'

const reinforcement=()=>createMirfeReinforcement({
 id:'reinforcement-1',organizationId:'org-a',siteId:'site-1',houseId:'house-1',bedId:'bed-1',geneticId:'g-1',stage:'Floración media',week:5,category:'Nutrición',reason:'ΔEC alto',triggerVariable:'ΔEC',observedValue:.8,targetValue:.2,objective:'Normalizar EC',productId:'product-1',dose:2,doseUnit:'mL/L',volumePrepared:100,route:'Riego',ecBefore:2.4,phBefore:5.8,createdAt:'2026-08-16T10:00:00.000Z',createdBy:'user-1',workflowEventId:'workflow-create'
},{product:{id:'product-1',name:'Corrector',category:'Corrector pH',unit:'L'}})

const move=(record,transition,index,input={})=>transitionMirfeReinforcement(record,transition,{organizationId:'org-a',actorId:'user-1',occurredAt:`2026-08-16T1${index}:00:00.000Z`,eventId:`workflow-${index}`,...input})

test('M31-F010: el workflow compartido impone la secuencia y conserva historial append-only',()=>{
 const draft=reinforcement()
 assert.equal(draft.status,MIRFE_WORKFLOW_STATES.DRAFT)
 assert.deepEqual(availableMirfeTransitions(draft),[MIRFE_WORKFLOW_TRANSITIONS.SUBMIT,MIRFE_WORKFLOW_TRANSITIONS.CANCEL])
 assert.throws(()=>move(draft,MIRFE_WORKFLOW_TRANSITIONS.APPLY,1),/no está permitida/)
 const pending=move(draft,MIRFE_WORKFLOW_TRANSITIONS.SUBMIT,1)
 const approved=move(pending,MIRFE_WORKFLOW_TRANSITIONS.APPROVE,2)
 const scheduled=move(approved,MIRFE_WORKFLOW_TRANSITIONS.SCHEDULE,3)
 const applied=move(scheduled,MIRFE_WORKFLOW_TRANSITIONS.APPLY,4)
 const following=move(applied,MIRFE_WORKFLOW_TRANSITIONS.START_FOLLOW_UP,5)
 assert.throws(()=>move(following,MIRFE_WORKFLOW_TRANSITIONS.VERIFY_EFFECTIVE,6),/resultado agronómico/)
 const effective=move(following,MIRFE_WORKFLOW_TRANSITIONS.VERIFY_EFFECTIVE,6,{result:'EC normalizada',ecAfter:1.8,phAfter:5.9})
 assert.equal(effective.status,MIRFE_WORKFLOW_STATES.EFFECTIVE)
 assert.equal(draft.status,MIRFE_WORKFLOW_STATES.DRAFT)
 assert.equal(effective.workflow.history.length,7)
 assert.deepEqual(verifyMirfeReinforcementWorkflow(effective),{valid:true,errors:[]})
 assert.throws(()=>move(effective,MIRFE_WORKFLOW_TRANSITIONS.CANCEL,7,{reason:'tarde'}),/está cerrado/)
})

test('M31-F010: una corrección solo nace de Sin respuesta y reabre aprobación sin reescribir evidencia',()=>{
 let record=reinforcement()
 for(const[transition,index]of[[MIRFE_WORKFLOW_TRANSITIONS.SUBMIT,1],[MIRFE_WORKFLOW_TRANSITIONS.APPROVE,2],[MIRFE_WORKFLOW_TRANSITIONS.SCHEDULE,3],[MIRFE_WORKFLOW_TRANSITIONS.APPLY,4],[MIRFE_WORKFLOW_TRANSITIONS.START_FOLLOW_UP,5]])record=move(record,transition,index)
 record=move(record,MIRFE_WORKFLOW_TRANSITIONS.VERIFY_NO_RESPONSE,6,{result:'Sin cambio a 72 h'})
 assert.throws(()=>createMirfeCorrection({id:'correction-x',organizationId:'org-b'},record),/otra empresa/)
 const before=structuredClone(record)
 const result=createMirfeCorrection({id:'correction-1',organizationId:'org-a',actorId:'user-1',occurredAt:'2026-08-16T17:00:00.000Z',workflowEventId:'workflow-7',reason:'Persistencia de EC',action:'Reducir dosis 20%',nextReview:'2026-08-18'},record)
 assert.equal(result.reinforcement.status,MIRFE_WORKFLOW_STATES.PENDING_APPROVAL)
 assert.deepEqual(result.reinforcement.correctionIds,['correction-1'])
 assert.equal(result.correction.reinforcementId,record.id)
 assert.equal(record.status,before.status)
 assert.equal(record.workflow.history.length,before.workflow.history.length)
 assert.deepEqual(verifyMirfeReinforcementWorkflow(result.reinforcement),{valid:true,errors:[]})
})

test('M31-F010: monitoreo recalcula VPD y ΔEC y no confía en derivados del cliente',()=>{
 const record=createMirfeMonitoring({id:'monitor-1',organizationId:'org-a',siteId:'site-1',houseId:'house-1',geneticId:'g-1',stage:'Vegetativo fuerte',week:3,date:'2026-08-16',temp:25,humidity:60,ppfd:600,volumeApplied:100,drainPercent:15,ecInput:1.4,ecDrain:2,n:10,p:5,k:20,ca:15,mg:5,s:4,phInput:5.8,phDrain:6,diagnosis:'Acumulación leve',vpd:999,deltaEc:999,recordedAt:'2026-08-16T18:00:00.000Z',recordedBy:'user-1'})
 assert.ok(Math.abs(record.deltaEc-.6)<1e-9)
 assert.notEqual(record.vpd,999)
 assert.equal(record.source,'MANUAL')
 assert.equal(Object.isFrozen(record),true)
})

test('M31-F010: migración legacy es determinista y pone estados desconocidos en cuarentena',()=>{
 const legacy={mirfeReinforcements:[{id:'legacy-1',organizationId:'org-a',siteId:'site-1',date:'2026-08-01',status:'Aplicado'},{id:'legacy-2',organizationId:'org-a',siteId:'site-1',status:'Inventado'},{id:'legacy-3',status:'Borrador'}]}
 const first=migrateLegacyMirfeWorkflowState(legacy),second=migrateLegacyMirfeWorkflowState(structuredClone(legacy))
 assert.deepEqual(first,second)
 assert.equal(first.mirfeReinforcements[0].workflow.state,MIRFE_WORKFLOW_STATES.APPLIED)
 assert.equal(first.mirfeReinforcements[0].workflow.history.length,5)
 assert.equal(first.mirfeReinforcements[1].workflowQuarantined,true)
 assert.equal(first.mirfeReinforcements[2].workflowQuarantined,true)
})

test('M31-F010: la verificación detecta identidad, versión y tiempo adulterados',()=>{
 const record=move(reinforcement(),MIRFE_WORKFLOW_TRANSITIONS.SUBMIT,1)
 const invalid={...record,workflowVersion:99,workflow:{...record.workflow,companyId:'org-b',history:record.workflow.history.map((event,index)=>index?{...event,id:record.workflow.history[0].id,occurredAt:'2026-08-15T00:00:00.000Z'}:event)}}
 const result=verifyMirfeReinforcementWorkflow(invalid)
 assert.equal(result.valid,false)
 assert.match(result.errors.join(' '),/empresa|versión|duplicado|retrocede/)
})
