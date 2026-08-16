import{calculateVpd,deltaEc,mirfeCategories,mirfeStatuses,quantityFromDose}from'./mirfe.js'
import{createWorkflowInstance,defineWorkflow,transitionWorkflow,verifyWorkflowHistory}from'./workflowCore.js'

const text=value=>String(value??'').trim()
const list=value=>Array.isArray(value)?value:[]
const plainObject=value=>value&&typeof value==='object'&&!Array.isArray(value)
const required=(value,label)=>{const normalized=text(value);if(!normalized)throw new Error(`${label} es obligatorio.`);return normalized}
const iso=(value,label)=>{const normalized=required(value,label),time=Date.parse(normalized);if(Number.isNaN(time))throw new Error(`${label} debe ser una fecha válida.`);return new Date(time).toISOString()}
const finite=(value,label,{positive=false,optional=false}={})=>{
 if(optional&&(value===''||value===null||value===undefined))return null
 const number=Number(value)
 if(!Number.isFinite(number)||(positive&&number<=0))throw new Error(`${label} debe ser ${positive?'mayor que cero':'un número finito'}.`)
 return number
}

function deepFreeze(value){
 if(!value||typeof value!=='object'||Object.isFrozen(value))return value
 Object.values(value).forEach(deepFreeze)
 return Object.freeze(value)
}

function canonicalDate(value,fallback){
 const candidate=text(value)||fallback
 const parsed=Date.parse(candidate)
 return Number.isNaN(parsed)?fallback:new Date(parsed).toISOString()
}

function snapshot(record,fields){
 if(!record)return null
 return Object.fromEntries(fields.map(key=>[key,record[key]??null]))
}

export const MIRFE_WORKFLOW_STATES=Object.freeze({
 DRAFT:'Borrador',PENDING_APPROVAL:'Pendiente aprobación',APPROVED:'Aprobado',SCHEDULED:'Programado',APPLIED:'Aplicado',FOLLOW_UP:'En seguimiento',EFFECTIVE:'Efectivo',NO_RESPONSE:'Sin respuesta',CANCELLED:'Cancelado'
})

export const MIRFE_WORKFLOW_TRANSITIONS=Object.freeze({
 SUBMIT:'SUBMIT',APPROVE:'APPROVE',SCHEDULE:'SCHEDULE',APPLY:'APPLY',START_FOLLOW_UP:'START_FOLLOW_UP',VERIFY_EFFECTIVE:'VERIFY_EFFECTIVE',VERIFY_NO_RESPONSE:'VERIFY_NO_RESPONSE',CORRECT:'CORRECT',CANCEL:'CANCEL'
})

export const MIRFE_REINFORCEMENT_WORKFLOW=defineWorkflow({
 id:'mirfe-reinforcement-v1',initialState:MIRFE_WORKFLOW_STATES.DRAFT,states:Object.values(MIRFE_WORKFLOW_STATES),terminalStates:[MIRFE_WORKFLOW_STATES.EFFECTIVE,MIRFE_WORKFLOW_STATES.CANCELLED],
 transitions:[
  {name:MIRFE_WORKFLOW_TRANSITIONS.SUBMIT,from:MIRFE_WORKFLOW_STATES.DRAFT,to:MIRFE_WORKFLOW_STATES.PENDING_APPROVAL},
  {name:MIRFE_WORKFLOW_TRANSITIONS.APPROVE,from:MIRFE_WORKFLOW_STATES.PENDING_APPROVAL,to:MIRFE_WORKFLOW_STATES.APPROVED},
  {name:MIRFE_WORKFLOW_TRANSITIONS.SCHEDULE,from:MIRFE_WORKFLOW_STATES.APPROVED,to:MIRFE_WORKFLOW_STATES.SCHEDULED},
  {name:MIRFE_WORKFLOW_TRANSITIONS.APPLY,from:MIRFE_WORKFLOW_STATES.SCHEDULED,to:MIRFE_WORKFLOW_STATES.APPLIED},
  {name:MIRFE_WORKFLOW_TRANSITIONS.START_FOLLOW_UP,from:MIRFE_WORKFLOW_STATES.APPLIED,to:MIRFE_WORKFLOW_STATES.FOLLOW_UP},
  {name:MIRFE_WORKFLOW_TRANSITIONS.VERIFY_EFFECTIVE,from:MIRFE_WORKFLOW_STATES.FOLLOW_UP,to:MIRFE_WORKFLOW_STATES.EFFECTIVE,guard:({metadata})=>Boolean(text(metadata.result)),guardMessage:'La verificación efectiva requiere un resultado agronómico.'},
  {name:MIRFE_WORKFLOW_TRANSITIONS.VERIFY_NO_RESPONSE,from:MIRFE_WORKFLOW_STATES.FOLLOW_UP,to:MIRFE_WORKFLOW_STATES.NO_RESPONSE,guard:({metadata})=>Boolean(text(metadata.result)),guardMessage:'La verificación sin respuesta requiere un resultado agronómico.'},
  {name:MIRFE_WORKFLOW_TRANSITIONS.CORRECT,from:MIRFE_WORKFLOW_STATES.NO_RESPONSE,to:MIRFE_WORKFLOW_STATES.PENDING_APPROVAL,guard:({metadata})=>Boolean(text(metadata.correctionId)&&text(metadata.action)),guardMessage:'La corrección requiere identidad y acción documentada.'},
  {name:MIRFE_WORKFLOW_TRANSITIONS.CANCEL,from:[MIRFE_WORKFLOW_STATES.DRAFT,MIRFE_WORKFLOW_STATES.PENDING_APPROVAL,MIRFE_WORKFLOW_STATES.APPROVED,MIRFE_WORKFLOW_STATES.SCHEDULED],to:MIRFE_WORKFLOW_STATES.CANCELLED}
 ]
})

export const MIRFE_HISTORY_TYPES=Object.freeze({
 PROGRAM_CREATED:'PROGRAM_CREATED',MONITORING_RECORDED:'MONITORING_RECORDED',REINFORCEMENT_CREATED:'REINFORCEMENT_CREATED',REINFORCEMENT_TRANSITIONED:'REINFORCEMENT_TRANSITIONED',CORRECTION_RECORDED:'CORRECTION_RECORDED'
})

export function createMirfeProgram(input={}){
 const category=required(input.category,'category')
 if(!mirfeCategories.includes(category))throw new Error('category no pertenece al catálogo MIRFE.')
 return deepFreeze({
  id:required(input.id,'id'),organizationId:required(input.organizationId,'organizationId'),siteId:text(input.siteId),houseId:text(input.houseId),
  name:required(input.name,'name'),category,geneticId:text(input.geneticId)||'Todos',stage:required(input.stage,'stage'),
  triggerVariable:text(input.triggerVariable),triggerOperator:text(input.triggerOperator)||'>',triggerValue:finite(input.triggerValue,'triggerValue'),targetValue:finite(input.targetValue,'targetValue'),
  objective:required(input.objective,'objective'),reviewHours:finite(input.reviewHours,'reviewHours',{positive:true}),status:input.active===false?'INACTIVE':'ACTIVE',active:input.active!==false,
  createdAt:iso(input.createdAt||new Date().toISOString(),'createdAt'),createdBy:required(input.createdBy,'createdBy')
 })
}

export function createMirfeMonitoring(input={}){
 const temp=finite(input.temp,'temp'),humidity=finite(input.humidity,'humidity')
 if(humidity<0||humidity>100)throw new Error('humidity debe estar entre 0 y 100.')
 const date=required(input.date,'date'),observedAt=iso(input.observedAt||`${date}T12:00:00.000Z`,'observedAt')
 return deepFreeze({
  id:required(input.id,'id'),organizationId:required(input.organizationId,'organizationId'),siteId:required(input.siteId,'siteId'),houseId:required(input.houseId,'houseId'),bedId:text(input.bedId),geneticId:required(input.geneticId,'geneticId'),
  stage:required(input.stage,'stage'),week:Math.max(1,Math.trunc(finite(input.week,'week',{positive:true}))),date:observedAt.slice(0,10),observedAt,
  temp,humidity,ppfd:finite(input.ppfd,'ppfd'),volumeApplied:finite(input.volumeApplied,'volumeApplied'),drainPercent:finite(input.drainPercent,'drainPercent'),
  ecInput:finite(input.ecInput,'ecInput'),ecDrain:finite(input.ecDrain,'ecDrain'),phInput:finite(input.phInput,'phInput'),phDrain:finite(input.phDrain,'phDrain'),
  n:finite(input.n,'n'),p:finite(input.p,'p'),k:finite(input.k,'k'),ca:finite(input.ca,'ca'),mg:finite(input.mg,'mg'),s:finite(input.s,'s'),
  vpd:calculateVpd(temp,humidity),deltaEc:deltaEc(input.ecInput,input.ecDrain),diagnosis:required(input.diagnosis,'diagnosis'),
  source:'MANUAL',recordedAt:iso(input.recordedAt||new Date().toISOString(),'recordedAt'),recordedBy:required(input.recordedBy,'recordedBy')
 })
}

export function createMirfeReinforcement(input={},references={}){
 const organizationId=required(input.organizationId,'organizationId'),id=required(input.id,'id'),dose=finite(input.dose,'dose',{positive:true}),volumePrepared=finite(input.volumePrepared,'volumePrepared',{positive:true})
 const category=required(input.category,'category')
 if(!mirfeCategories.includes(category))throw new Error('category no pertenece al catálogo MIRFE.')
 const doseUnit=required(input.doseUnit,'doseUnit')
 if(!['mL/L','g/L','mL/100 L','g/100 L'].includes(doseUnit))throw new Error('doseUnit no pertenece al catálogo MIRFE.')
 const actor={id:required(input.createdBy,'createdBy'),name:text(input.createdByName)}
 const createdAt=iso(input.createdAt||new Date().toISOString(),'createdAt')
 const workflow=createWorkflowInstance(MIRFE_REINFORCEMENT_WORKFLOW,{entityType:'mirfe.reinforcement',entityId:id,companyId:organizationId,actor,occurredAt:createdAt,eventId:required(input.workflowEventId||`${id}:workflow:create`,'workflowEventId'),metadata:{siteId:required(input.siteId,'siteId')}})
 return deepFreeze({
  id,organizationId,siteId:required(input.siteId,'siteId'),houseId:required(input.houseId,'houseId'),bedId:text(input.bedId),geneticId:required(input.geneticId,'geneticId'),stage:required(input.stage,'stage'),week:Math.max(1,Math.trunc(finite(input.week,'week',{positive:true}))),
  monitoringId:text(input.monitoringId),programId:text(input.programId),category,reason:required(input.reason,'reason'),triggerVariable:text(input.triggerVariable),observedValue:finite(input.observedValue,'observedValue'),targetValue:finite(input.targetValue,'targetValue'),objective:required(input.objective,'objective'),
  productId:required(input.productId,'productId'),dose,doseUnit,volumePrepared,quantityApplied:quantityFromDose(dose,doseUnit,volumePrepared),route:required(input.route,'route'),ecBefore:finite(input.ecBefore,'ecBefore'),phBefore:finite(input.phBefore,'phBefore'),responsible:text(input.responsible),nextReview:text(input.nextReview),notes:text(input.notes),
  date:createdAt.slice(0,10),createdAt,createdBy:actor.id,status:workflow.state,workflowVersion:workflow.version,workflow,followUps:Object.freeze([]),correctionIds:Object.freeze([]),
  programSnapshot:deepFreeze(snapshot(references.program,['id','name','category','geneticId','stage','triggerVariable','triggerOperator','triggerValue','targetValue','objective','reviewHours'])),
  monitoringSnapshot:deepFreeze(snapshot(references.monitoring,['id','siteId','houseId','bedId','geneticId','stage','week','observedAt','ecInput','phInput','deltaEc','drainPercent','diagnosis'])),
  productSnapshot:deepFreeze(snapshot(references.product,['id','name','category','unit']))
 })
}

export function availableMirfeTransitions(record){
 if(record?.workflowQuarantined||!record?.workflow||record.workflow.state!==record.status)return[]
 return[...MIRFE_REINFORCEMENT_WORKFLOW.transitions.values()].filter(transition=>transition.from.includes(record.status)).map(transition=>transition.name)
}

export function transitionMirfeReinforcement(record,transitionName,input={}){
 const organizationId=required(input.organizationId,'organizationId')
 if(record?.organizationId!==organizationId)throw new Error('El refuerzo pertenece a otra empresa.')
 if(!record.workflow||record.workflow.state!==record.status)throw new Error('El workflow del refuerzo no es canónico.')
 const occurredAt=iso(input.occurredAt||new Date().toISOString(),'occurredAt'),actor={id:required(input.actorId,'actorId'),name:text(input.actorName)}
 const metadata={result:text(input.result),reason:text(input.reason),action:text(input.action),correctionId:text(input.correctionId),ecAfter:finite(input.ecAfter,'ecAfter',{optional:true}),phAfter:finite(input.phAfter,'phAfter',{optional:true}),nextReview:text(input.nextReview),notes:text(input.notes)}
 if(transitionName===MIRFE_WORKFLOW_TRANSITIONS.CANCEL)required(metadata.reason,'reason')
 const workflow=transitionWorkflow(MIRFE_REINFORCEMENT_WORKFLOW,record.workflow,transitionName,{actor,metadata,occurredAt,eventId:required(input.eventId,'eventId')})
 const followUp=[...list(record.followUps)]
 if([MIRFE_WORKFLOW_TRANSITIONS.START_FOLLOW_UP,MIRFE_WORKFLOW_TRANSITIONS.VERIFY_EFFECTIVE,MIRFE_WORKFLOW_TRANSITIONS.VERIFY_NO_RESPONSE].includes(transitionName))followUp.push(deepFreeze({id:input.eventId,transition:transitionName,occurredAt,actorId:actor.id,result:metadata.result,ecAfter:metadata.ecAfter,phAfter:metadata.phAfter,nextReview:metadata.nextReview,notes:metadata.notes}))
 const correctionIds=transitionName===MIRFE_WORKFLOW_TRANSITIONS.CORRECT?[...list(record.correctionIds),metadata.correctionId]:list(record.correctionIds)
 return deepFreeze({...record,status:workflow.state,workflowVersion:workflow.version,workflow,updatedAt:occurredAt,followUps:followUp,correctionIds,...(transitionName===MIRFE_WORKFLOW_TRANSITIONS.APPLY?{appliedAt:occurredAt}:{}),...(transitionName===MIRFE_WORKFLOW_TRANSITIONS.VERIFY_EFFECTIVE||transitionName===MIRFE_WORKFLOW_TRANSITIONS.VERIFY_NO_RESPONSE?{verifiedAt:occurredAt,result:metadata.result,ecAfter:metadata.ecAfter,phAfter:metadata.phAfter,nextReview:metadata.nextReview||record.nextReview}:{}),...(transitionName===MIRFE_WORKFLOW_TRANSITIONS.CANCEL?{cancelledAt:occurredAt,cancellationReason:metadata.reason}:{})})
}

export function createMirfeCorrection(input={},reinforcement){
 const organizationId=required(input.organizationId,'organizationId')
 if(reinforcement?.organizationId!==organizationId)throw new Error('El refuerzo pertenece a otra empresa.')
 if(reinforcement?.status!==MIRFE_WORKFLOW_STATES.NO_RESPONSE)throw new Error('Solo un refuerzo verificado sin respuesta puede corregirse.')
 const id=required(input.id,'id'),occurredAt=iso(input.occurredAt||new Date().toISOString(),'occurredAt'),action=required(input.action,'action'),reason=required(input.reason,'reason')
 const correction=deepFreeze({id,organizationId,siteId:reinforcement.siteId,houseId:reinforcement.houseId,bedId:text(reinforcement.bedId),geneticId:reinforcement.geneticId,reinforcementId:reinforcement.id,programId:text(reinforcement.programId),monitoringId:text(reinforcement.monitoringId),reason,action,nextReview:text(input.nextReview),notes:text(input.notes),createdAt:occurredAt,createdBy:required(input.actorId,'actorId')})
 const updated=transitionMirfeReinforcement(reinforcement,MIRFE_WORKFLOW_TRANSITIONS.CORRECT,{...input,organizationId,occurredAt,correctionId:id,action,reason,eventId:required(input.workflowEventId,'workflowEventId')})
 return deepFreeze({correction,reinforcement:updated})
}

export function createMirfeHistoryEntry(input={}){
 if(!Object.values(MIRFE_HISTORY_TYPES).includes(input.type))throw new Error('type no pertenece al historial MIRFE.')
 return deepFreeze({
  id:required(input.id,'id'),organizationId:required(input.organizationId,'organizationId'),siteId:text(input.siteId),type:input.type,eventName:required(input.eventName,'eventName'),entityType:required(input.entityType,'entityType'),entityId:required(input.entityId,'entityId'),reinforcementId:text(input.reinforcementId),
  occurredAt:iso(input.occurredAt||new Date().toISOString(),'occurredAt'),actorId:required(input.actorId,'actorId'),summary:required(input.summary,'summary'),transition:text(input.transition),from:text(input.from),to:text(input.to),evidence:deepFreeze(plainObject(input.evidence)?{...input.evidence}:{})
 })
}

export function verifyMirfeReinforcementWorkflow(record){
 const errors=[]
 if(!record?.workflow)return{valid:false,errors:['El refuerzo no tiene workflow']}
 const verified=verifyWorkflowHistory(MIRFE_REINFORCEMENT_WORKFLOW,record.workflow)
 errors.push(...verified.errors)
 if(record.workflow.entityType!=='mirfe.reinforcement'||record.workflow.entityId!==record.id)errors.push('La identidad del workflow no coincide con el refuerzo')
 if(record.workflow.companyId!==record.organizationId)errors.push('La empresa del workflow no coincide con el refuerzo')
 if(record.workflow.state!==record.status)errors.push('El estado materializado no coincide con el workflow')
 if(record.workflowVersion!==record.workflow.version)errors.push('La versión materializada no coincide con el workflow')
 const ids=new Set(),history=list(record.workflow.history)
 for(let index=0;index<history.length;index+=1){
  const event=history[index]
  if(ids.has(event.id))errors.push(`Evento de workflow duplicado: ${event.id}`)
  ids.add(event.id)
  if(event.workflowId!==record.workflow.workflowId||event.entityId!==record.id||event.companyId!==record.organizationId)errors.push(`Evento de workflow fuera del agregado: ${event.id}`)
  if(Number.isNaN(Date.parse(event.occurredAt)))errors.push(`Evento de workflow sin fecha válida: ${event.id}`)
  if(index&&Date.parse(event.occurredAt)<Date.parse(history[index-1].occurredAt))errors.push(`El workflow retrocede en el tiempo: ${event.id}`)
 }
 return{valid:errors.length===0,errors}
}

export function mirfeWorkflowPhase(record){
 const state=record?.workflow?.state||record?.status
 if([MIRFE_WORKFLOW_STATES.APPLIED,MIRFE_WORKFLOW_STATES.FOLLOW_UP].includes(state))return'Ejecutada'
 if([MIRFE_WORKFLOW_STATES.EFFECTIVE,MIRFE_WORKFLOW_STATES.NO_RESPONSE,MIRFE_WORKFLOW_STATES.CANCELLED].includes(state))return'Verificada'
 return'Pendiente'
}

const LEGACY_PATHS=Object.freeze({
 [MIRFE_WORKFLOW_STATES.DRAFT]:[],
 [MIRFE_WORKFLOW_STATES.PENDING_APPROVAL]:[MIRFE_WORKFLOW_TRANSITIONS.SUBMIT],
 [MIRFE_WORKFLOW_STATES.APPROVED]:[MIRFE_WORKFLOW_TRANSITIONS.SUBMIT,MIRFE_WORKFLOW_TRANSITIONS.APPROVE],
 [MIRFE_WORKFLOW_STATES.SCHEDULED]:[MIRFE_WORKFLOW_TRANSITIONS.SUBMIT,MIRFE_WORKFLOW_TRANSITIONS.APPROVE,MIRFE_WORKFLOW_TRANSITIONS.SCHEDULE],
 [MIRFE_WORKFLOW_STATES.APPLIED]:[MIRFE_WORKFLOW_TRANSITIONS.SUBMIT,MIRFE_WORKFLOW_TRANSITIONS.APPROVE,MIRFE_WORKFLOW_TRANSITIONS.SCHEDULE,MIRFE_WORKFLOW_TRANSITIONS.APPLY],
 [MIRFE_WORKFLOW_STATES.FOLLOW_UP]:[MIRFE_WORKFLOW_TRANSITIONS.SUBMIT,MIRFE_WORKFLOW_TRANSITIONS.APPROVE,MIRFE_WORKFLOW_TRANSITIONS.SCHEDULE,MIRFE_WORKFLOW_TRANSITIONS.APPLY,MIRFE_WORKFLOW_TRANSITIONS.START_FOLLOW_UP],
 [MIRFE_WORKFLOW_STATES.EFFECTIVE]:[MIRFE_WORKFLOW_TRANSITIONS.SUBMIT,MIRFE_WORKFLOW_TRANSITIONS.APPROVE,MIRFE_WORKFLOW_TRANSITIONS.SCHEDULE,MIRFE_WORKFLOW_TRANSITIONS.APPLY,MIRFE_WORKFLOW_TRANSITIONS.START_FOLLOW_UP,MIRFE_WORKFLOW_TRANSITIONS.VERIFY_EFFECTIVE],
 [MIRFE_WORKFLOW_STATES.NO_RESPONSE]:[MIRFE_WORKFLOW_TRANSITIONS.SUBMIT,MIRFE_WORKFLOW_TRANSITIONS.APPROVE,MIRFE_WORKFLOW_TRANSITIONS.SCHEDULE,MIRFE_WORKFLOW_TRANSITIONS.APPLY,MIRFE_WORKFLOW_TRANSITIONS.START_FOLLOW_UP,MIRFE_WORKFLOW_TRANSITIONS.VERIFY_NO_RESPONSE],
 [MIRFE_WORKFLOW_STATES.CANCELLED]:[MIRFE_WORKFLOW_TRANSITIONS.CANCEL]
})

function legacyWorkflow(record){
 const status=mirfeStatuses.includes(record.status)?record.status:MIRFE_WORKFLOW_STATES.DRAFT
 const occurredAt=canonicalDate(record.createdAt||record.date,'1970-01-01T00:00:00.000Z'),organizationId=text(record.organizationId)
 let workflow=createWorkflowInstance(MIRFE_REINFORCEMENT_WORKFLOW,{entityType:'mirfe.reinforcement',entityId:record.id,companyId:organizationId,actor:{id:'legacy-migration'},occurredAt,eventId:`${record.id}:workflow:legacy:0`,metadata:{migrated:true,siteId:text(record.siteId)}})
 for(const[step,transition]of LEGACY_PATHS[status].entries())workflow=transitionWorkflow(MIRFE_REINFORCEMENT_WORKFLOW,workflow,transition,{actor:{id:'legacy-migration'},occurredAt,eventId:`${record.id}:workflow:legacy:${step+1}`,metadata:{migrated:true,result:text(record.result)||'Resultado legado documentado',reason:text(record.notes)||'Cancelación legada',correctionId:`${record.id}:legacy-correction`,action:'Corrección legada'}})
 return workflow
}

export function migrateLegacyMirfeWorkflowState(input={}){
 const state={...input},records=list(state.mirfeReinforcements)
 state.mirfeReinforcements=records.map(record=>{
  if(record?.workflow){const verification=verifyMirfeReinforcementWorkflow(record);return verification.valid?record:{...record,workflowQuarantined:true,workflowQuarantineReason:verification.errors.join(' ')}}
  if(!text(record?.id)||!text(record?.organizationId))return{...record,workflowQuarantined:true,workflowQuarantineReason:'El refuerzo legado no tiene identidad y ownership inequívocos.'}
  if(text(record.status)&&!mirfeStatuses.includes(record.status))return{...record,workflowQuarantined:true,workflowQuarantineReason:'El estado legado no pertenece al catálogo MIRFE.'}
  const workflow=legacyWorkflow(record)
  return{...record,status:workflow.state,workflowVersion:workflow.version,workflow,followUps:list(record.followUps),correctionIds:list(record.correctionIds),workflowMigrated:true}
 })
 return state
}
