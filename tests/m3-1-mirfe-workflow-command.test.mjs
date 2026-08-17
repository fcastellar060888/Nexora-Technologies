import test from'node:test'
import assert from'node:assert/strict'
import{createDomainEvent}from'../src/core/events/eventContract.js'
import{DomainEvents}from'../src/core/events/eventCatalog.js'
import{createLedgerEntry}from'../src/core/ledger/ledgerEntry.js'
import{domainEventToTimelineEntry}from'../src/core/timeline/timelineProjection.js'
import{MIRFE_WORKFLOW_STATES,MIRFE_WORKFLOW_TRANSITIONS,verifyMirfeReinforcementWorkflow}from'../src/domain/mirfeWorkflow.js'
import{IRRIGATION_MIRFE_OPERATIONS,executeIrrigationMirfeCommand}from'../src/services/irrigationMirfeCommand.js'

const fixture=()=>({
 companies:[{id:'org-a'},{id:'org-b'}],currentContext:{companyId:'org-a',siteId:'site-1'},
 users:[{id:'user-1',name:'Ana',activeSession:true,active:true,remote:true}],roles:[{id:'agronomist',permissions:['manage_mirfe']}],memberships:[{id:'membership-1',userId:'user-1',companyId:'org-a',roleId:'agronomist',siteIds:['site-1'],status:'active'}],
 sites:[{id:'site-1',organizationId:'org-b',name:'B'},{id:'site-1',organizationId:'org-a',name:'A'}],
 houses:[{id:'house-1',organizationId:'org-b',siteId:'site-1',name:'B'},{id:'house-1',organizationId:'org-a',siteId:'site-1',name:'A'}],
 beds:[{id:'bed-1',organizationId:'org-b',houseId:'house-1'},{id:'bed-1',organizationId:'org-a',houseId:'house-1'}],
 genetics:[{id:'g-1',organizationId:'org-b',name:'B'},{id:'g-1',organizationId:'org-a',name:'A'}],
 products:[{id:'product-1',organizationId:'org-b',name:'B',category:'MIRFE',unit:'L'},{id:'product-1',organizationId:'org-a',name:'Corrector',category:'MIRFE',unit:'L'}],
 inventoryLots:[],inventoryMovements:[],waterAnalyses:[],nutrientProducts:[],nutrientObjectives:[],irrigationPlans:[],formulations:[],tankPreparations:[],irrigationApplications:[],workOrders:[],costEntries:[],
 mirfePrograms:[{id:'program-1',organizationId:'org-b',siteId:'site-1',houseId:'house-1',geneticId:'g-1',stage:'Floración media',status:'ACTIVE'}],
 mirfeMonitoring:[{id:'monitor-1',organizationId:'org-b',siteId:'site-1',houseId:'house-1',bedId:'bed-1',geneticId:'g-1',stage:'Floración media'}],mirfeReinforcements:[],irrigationCorrections:[],irrigationHistory:[{id:'cmd-program:history',organizationId:'org-b',siteId:'site-1'}]
})

const programInput={siteId:'site-1',houseId:'house-1',name:'Control EC',category:'EC/pH',geneticId:'g-1',stage:'Floración media',triggerVariable:'ΔEC',triggerOperator:'>',triggerValue:.5,targetValue:.2,objective:'Normalizar EC',reviewHours:48,active:true}
const monitoringInput={siteId:'site-1',houseId:'house-1',bedId:'bed-1',geneticId:'g-1',stage:'Floración media',week:5,date:'2026-08-16',temp:25,humidity:60,ppfd:700,volumeApplied:100,drainPercent:15,ecInput:1.5,ecDrain:2.2,phInput:5.8,phDrain:6,n:10,p:5,k:20,ca:15,mg:5,s:4,diagnosis:'Acumulación de sales'}
const reinforcementInput={siteId:'site-1',houseId:'house-1',bedId:'bed-1',geneticId:'g-1',stage:'Floración media',week:5,programId:'program-1',monitoringId:'monitor-1',category:'EC/pH',reason:'ΔEC alto',triggerVariable:'ΔEC',observedValue:.7,targetValue:.2,objective:'Normalizar EC',productId:'product-1',dose:2,doseUnit:'mL/L',volumePrepared:100,route:'Riego',ecBefore:2.2,phBefore:5.8,responsible:'Ana',nextReview:'2026-08-18',notes:''}

async function execute(holder,command,{onPublish,onCommit}={}){
 const events=[]
 const result=await executeIrrigationMirfeCommand(holder.state,command,{publishEvent:async event=>{events.push(event);await onPublish?.(event,holder)},commit:recipe=>{if(onCommit)onCommit(recipe,holder);else holder.state=recipe(holder.state)}})
 return{result,events}
}

async function seedWorkflow(holder){
 await execute(holder,{operation:IRRIGATION_MIRFE_OPERATIONS.CREATE_MIRFE_PROGRAM,entityId:'program-1',commandId:'cmd-program',occurredAt:'2026-08-16T10:00:00.000Z',input:programInput})
 await execute(holder,{operation:IRRIGATION_MIRFE_OPERATIONS.RECORD_MIRFE_MONITORING,entityId:'monitor-1',commandId:'cmd-monitor',occurredAt:'2026-08-16T10:05:00.000Z',input:monitoringInput})
 await execute(holder,{operation:IRRIGATION_MIRFE_OPERATIONS.CREATE_MIRFE_REINFORCEMENT,entityId:'reinforcement-1',commandId:'cmd-reinforcement',occurredAt:'2026-08-16T10:10:00.000Z',input:reinforcementInput})
}

test('M31-F010: programas, monitoreo y refuerzo cruzan el boundary con IDs homónimos aislados',async()=>{
 const holder={state:fixture()}
 await seedWorkflow(holder)
 assert.equal(holder.state.mirfePrograms.length,2)
 assert.equal(holder.state.mirfeMonitoring.length,2)
 assert.equal(holder.state.mirfePrograms.find(item=>item.organizationId==='org-b').name,undefined)
 const program=holder.state.mirfePrograms.find(item=>item.organizationId==='org-a'),monitoring=holder.state.mirfeMonitoring.find(item=>item.organizationId==='org-a'),reinforcement=holder.state.mirfeReinforcements[0]
 assert.equal(program.createdBy,'user-1')
 assert.ok(Math.abs(monitoring.deltaEc-.7)<1e-9)
 assert.equal(reinforcement.organizationId,'org-a')
 assert.equal(reinforcement.status,MIRFE_WORKFLOW_STATES.DRAFT)
 assert.equal(reinforcement.programSnapshot.name,'Control EC')
 assert.equal(reinforcement.monitoringSnapshot.diagnosis,'Acumulación de sales')
 assert.equal(holder.state.irrigationHistory.filter(item=>item.organizationId==='org-a').length,3)
 assert.deepEqual(verifyMirfeReinforcementWorkflow(reinforcement),{valid:true,errors:[]})
})

test('M31-F010: transición inválida, replay y colisión de commandId fallan de forma determinista',async()=>{
 const holder={state:fixture()};await seedWorkflow(holder)
 await assert.rejects(()=>execute(holder,{operation:IRRIGATION_MIRFE_OPERATIONS.TRANSITION_MIRFE_REINFORCEMENT,commandId:'invalid-apply',input:{reinforcementId:'reinforcement-1',siteId:'site-1',transition:MIRFE_WORKFLOW_TRANSITIONS.APPLY}}),/no está permitida/)
 const command={operation:IRRIGATION_MIRFE_OPERATIONS.TRANSITION_MIRFE_REINFORCEMENT,commandId:'submit-1',occurredAt:'2026-08-16T10:20:00.000Z',input:{reinforcementId:'reinforcement-1',siteId:'site-1',transition:MIRFE_WORKFLOW_TRANSITIONS.SUBMIT}}
 await execute(holder,command)
 const count=holder.state.irrigationHistory.length,version=holder.state.mirfeReinforcements[0].workflowVersion
 const replay=await execute(holder,command)
 assert.equal(replay.result.replay,true)
 assert.equal(holder.state.irrigationHistory.length,count)
 assert.equal(holder.state.mirfeReinforcements[0].workflowVersion,version)
 await assert.rejects(()=>execute(holder,{...command,input:{...command.input,transition:MIRFE_WORKFLOW_TRANSITIONS.CANCEL,reason:'Otro'}}),/contenido diferente/)
})

test('M31-F010: resultado sin respuesta crea corrección append-only y reabre aprobación',async()=>{
 const holder={state:fixture()};await seedWorkflow(holder)
 const steps=[MIRFE_WORKFLOW_TRANSITIONS.SUBMIT,MIRFE_WORKFLOW_TRANSITIONS.APPROVE,MIRFE_WORKFLOW_TRANSITIONS.SCHEDULE,MIRFE_WORKFLOW_TRANSITIONS.APPLY,MIRFE_WORKFLOW_TRANSITIONS.START_FOLLOW_UP,MIRFE_WORKFLOW_TRANSITIONS.VERIFY_NO_RESPONSE]
 for(const[index,step]of steps.entries())await execute(holder,{operation:IRRIGATION_MIRFE_OPERATIONS.TRANSITION_MIRFE_REINFORCEMENT,commandId:`transition-${index}`,occurredAt:`2026-08-16T${String(11+index).padStart(2,'0')}:00:00.000Z`,input:{reinforcementId:'reinforcement-1',siteId:'site-1',transition:step,...(step===MIRFE_WORKFLOW_TRANSITIONS.VERIFY_NO_RESPONSE?{result:'Sin respuesta a 72 h',ecAfter:2.1,phAfter:5.9}:{})}})
 const before=holder.state.mirfeReinforcements[0].workflow.history.length
 const{events}=await execute(holder,{operation:IRRIGATION_MIRFE_OPERATIONS.RECORD_MIRFE_CORRECTION,entityId:'correction-1',commandId:'correct-1',occurredAt:'2026-08-16T18:00:00.000Z',input:{reinforcementId:'reinforcement-1',siteId:'site-1',reason:'EC persiste',action:'Reducir dosis 20%',nextReview:'2026-08-18'}})
 const reinforcement=holder.state.mirfeReinforcements[0]
 assert.equal(reinforcement.status,MIRFE_WORKFLOW_STATES.PENDING_APPROVAL)
 assert.equal(reinforcement.workflow.history.length,before+1)
 assert.equal(holder.state.irrigationCorrections.length,1)
 assert.equal(holder.state.irrigationCorrections[0].organizationId,'org-a')
 assert.equal(events.at(-1).name,DomainEvents.MIRFE_CORRECTION_RECORDED)
})

test('M31-F010: permisos, referencias extranjeras y carrera de versión no producen completion falso',async()=>{
 const denied={state:fixture()};denied.state.roles=[{id:'agronomist',permissions:[]}];let publishes=0
 await assert.rejects(()=>executeIrrigationMirfeCommand(denied.state,{operation:IRRIGATION_MIRFE_OPERATIONS.CREATE_MIRFE_PROGRAM,entityId:'p',commandId:'denied',input:programInput},{publishEvent:async()=>{publishes+=1},commit:()=>{}}),/manage_mirfe/)
 assert.equal(publishes,0)
 const foreign={state:fixture()}
 await assert.rejects(()=>execute(foreign,{operation:IRRIGATION_MIRFE_OPERATIONS.CREATE_MIRFE_REINFORCEMENT,entityId:'r',commandId:'foreign-reference',input:reinforcementInput}),/programa MIRFE no existe/)
 const holder={state:fixture()};await seedWorkflow(holder);let seen=0
 await assert.rejects(()=>execute(holder,{operation:IRRIGATION_MIRFE_OPERATIONS.TRANSITION_MIRFE_REINFORCEMENT,commandId:'race',input:{reinforcementId:'reinforcement-1',siteId:'site-1',transition:MIRFE_WORKFLOW_TRANSITIONS.SUBMIT}},{onPublish:()=>{seen+=1},onCommit:(recipe,current)=>{current.state={...current.state,mirfeReinforcements:current.state.mirfeReinforcements.map(item=>({...item,status:MIRFE_WORKFLOW_STATES.APPROVED,workflowVersion:item.workflowVersion+1}))};current.state=recipe(current.state)}}),/workflow MIRFE cambió/)
 assert.equal(seen,1)
})

test('M31-F010: el evento agronómico entra al Operational Ledger y se proyecta al Timeline tenant-aware',async()=>{
 const holder={state:fixture()};const{events}=await execute(holder,{operation:IRRIGATION_MIRFE_OPERATIONS.CREATE_MIRFE_PROGRAM,entityId:'program-1',commandId:'timeline-program',occurredAt:'2026-08-16T20:00:00.000Z',input:programInput})
 const spec=events.at(-1),event=createDomainEvent({...spec,actorId:'user-1'}),ledger=createLedgerEntry(event,{sequence:17,recordedAt:'2026-08-16T20:00:01.000Z'}),timeline=domainEventToTimelineEntry(ledger.event,{sequence:ledger.sequence,recordedAt:ledger.recordedAt})
 assert.equal(ledger.event.name,DomainEvents.MIRFE_PROGRAM_CREATED)
 assert.equal(timeline.source,'operational-ledger')
 assert.equal(timeline.category,'MIRFE')
 assert.equal(timeline.title,'Programa MIRFE creado')
 assert.equal(timeline.organizationId,'org-a')
 assert.equal(timeline.aggregateType,'mirfe.program')
 assert.equal(timeline.aggregateId,'program-1')
 assert.equal(timeline.correlationId,'timeline-program')
})
