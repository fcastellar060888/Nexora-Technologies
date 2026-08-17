const list=value=>Array.isArray(value)?value:[]
const text=value=>String(value??'').trim()
const required=(value,label)=>{const normalized=text(value);if(!normalized)throw new Error(`${label} es obligatorio.`);return normalized}
const occurred=value=>{const normalized=required(value,'occurredAt');const parsed=Date.parse(normalized);if(Number.isNaN(parsed))throw new Error('occurredAt debe ser una fecha válida.');return new Date(parsed).toISOString()}
const clone=value=>structuredClone(value)
const freeze=value=>{if(!value||typeof value!=='object'||Object.isFrozen(value))return value;Object.values(value).forEach(freeze);return Object.freeze(value)}

export const MIPE_FINDING_STATES=Object.freeze({
 DETECTED:'Detectado',
 EVALUATING:'En evaluación',
 TREATMENT_APPROVED:'Tratamiento aprobado',
 IN_TREATMENT:'En tratamiento',
 FOLLOW_UP:'Seguimiento',
 RESOLVED:'Resuelto',
 PLANT_REMOVED:'Planta eliminada',
 FALSE_POSITIVE:'Falso positivo'
})

export const MIPE_FINDING_TRANSITIONS=Object.freeze({
 START_EVALUATION:'START_EVALUATION',
 APPROVE_TREATMENT:'APPROVE_TREATMENT',
 BEGIN_TREATMENT:'BEGIN_TREATMENT',
 START_FOLLOW_UP:'START_FOLLOW_UP',
 RESOLVE:'RESOLVE',
 MARK_FALSE_POSITIVE:'MARK_FALSE_POSITIVE',
 MARK_PLANT_REMOVED:'MARK_PLANT_REMOVED'
})

const TRANSITIONS=Object.freeze({
 [MIPE_FINDING_TRANSITIONS.START_EVALUATION]:{from:[MIPE_FINDING_STATES.DETECTED],to:MIPE_FINDING_STATES.EVALUATING,label:'Iniciar evaluación'},
 [MIPE_FINDING_TRANSITIONS.APPROVE_TREATMENT]:{from:[MIPE_FINDING_STATES.DETECTED,MIPE_FINDING_STATES.EVALUATING],to:MIPE_FINDING_STATES.TREATMENT_APPROVED,label:'Aprobar tratamiento'},
 [MIPE_FINDING_TRANSITIONS.BEGIN_TREATMENT]:{from:[MIPE_FINDING_STATES.TREATMENT_APPROVED],to:MIPE_FINDING_STATES.IN_TREATMENT,label:'Iniciar tratamiento'},
 [MIPE_FINDING_TRANSITIONS.START_FOLLOW_UP]:{from:[MIPE_FINDING_STATES.IN_TREATMENT],to:MIPE_FINDING_STATES.FOLLOW_UP,label:'Iniciar seguimiento'},
 [MIPE_FINDING_TRANSITIONS.RESOLVE]:{from:[MIPE_FINDING_STATES.DETECTED,MIPE_FINDING_STATES.EVALUATING,MIPE_FINDING_STATES.FOLLOW_UP],to:MIPE_FINDING_STATES.RESOLVED,label:'Resolver'},
 [MIPE_FINDING_TRANSITIONS.MARK_FALSE_POSITIVE]:{from:[MIPE_FINDING_STATES.DETECTED,MIPE_FINDING_STATES.EVALUATING],to:MIPE_FINDING_STATES.FALSE_POSITIVE,label:'Marcar falso positivo'},
 [MIPE_FINDING_TRANSITIONS.MARK_PLANT_REMOVED]:{from:[MIPE_FINDING_STATES.DETECTED,MIPE_FINDING_STATES.EVALUATING,MIPE_FINDING_STATES.TREATMENT_APPROVED,MIPE_FINDING_STATES.IN_TREATMENT,MIPE_FINDING_STATES.FOLLOW_UP],to:MIPE_FINDING_STATES.PLANT_REMOVED,label:'Registrar planta eliminada'}
})

const TERMINAL=new Set([MIPE_FINDING_STATES.RESOLVED,MIPE_FINDING_STATES.PLANT_REMOVED,MIPE_FINDING_STATES.FALSE_POSITIVE])
const CORRECTABLE_FIELDS=Object.freeze(['incidentId','severity','notes','action','responsible','followUpDate'])
const FORBIDDEN_CORRECTION_FIELDS=new Set(['id','organizationId','companyId','siteId','targetType','targetId','plantPositionId','materialPlantId','createdAt','reportedAt','status','closedAt','resolvedAt','mipeHistory','mipeHistoryVersion'])

function actorSnapshot(actor={}){return freeze({id:text(actor.id)||'system',name:text(actor.name)||'Sistema'})}
function eventId(commandId,suffix){return `${required(commandId,'commandId')}:${suffix}`}
function uniqueHistory(history){const ids=new Set();for(const item of history){const id=required(item?.id,'El id del evento MIPE');if(ids.has(id))throw new Error('El historial MIPE contiene un eventId duplicado.');ids.add(id)}return history}

function legacyImportEvent(finding){
 const when=occurred(finding?.updatedAt||finding?.reportedAt||finding?.createdAt||'1970-01-01T00:00:00.000Z')
 return freeze({id:`${required(finding?.id,'finding.id')}:workflow:legacy-import`,type:'IMPORTED',from:null,to:required(finding?.status||MIPE_FINDING_STATES.DETECTED,'finding.status'),occurredAt:when,actor:actorSnapshot({id:'legacy-import',name:'Migración legacy'}),metadata:freeze({legacyImported:true})})
}

export function mipeFindingHistory(finding){
 const current=list(finding?.mipeHistory)
 return current.length?current:[legacyImportEvent(finding)]
}

export function createMipeFindingWorkflow(finding,{commandId,actor={},occurredAt}={}){
 if(list(finding?.mipeHistory).length)throw new Error('El Finding ya tiene historial MIPE.')
 if(text(finding?.status||MIPE_FINDING_STATES.DETECTED)!==MIPE_FINDING_STATES.DETECTED)throw new Error('Un Finding nuevo debe iniciar en Detectado.')
 const when=occurred(occurredAt||finding?.reportedAt||finding?.createdAt||new Date().toISOString())
 const event=freeze({id:eventId(commandId,'finding-created'),type:'CREATED',from:null,to:MIPE_FINDING_STATES.DETECTED,occurredAt:when,actor:actorSnapshot(actor),metadata:freeze({source:text(finding?.source)||'MIPE'})})
 return freeze({...clone(finding),status:MIPE_FINDING_STATES.DETECTED,mipeHistory:[event],mipeHistoryVersion:1})
}

export function availableMipeFindingTransitions(finding){
 const state=text(finding?.status||MIPE_FINDING_STATES.DETECTED)
 if(TERMINAL.has(state))return[]
 return Object.entries(TRANSITIONS).filter(([,definition])=>definition.from.includes(state)).map(([name,definition])=>freeze({name,to:definition.to,label:definition.label}))
}

export function transitionMipeFinding(finding,transitionName,{commandId,actor={},occurredAt,notes='',metadata={}}={}){
 const name=required(transitionName,'transition'),definition=TRANSITIONS[name]
 if(!definition)throw new Error(`La transición MIPE ${name} no existe.`)
 const state=required(finding?.status||MIPE_FINDING_STATES.DETECTED,'finding.status')
 if(TERMINAL.has(state))throw new Error(`El hallazgo MIPE está cerrado en ${state}.`)
 if(!definition.from.includes(state))throw new Error(`La transición ${name} no está permitida desde ${state}.`)
 const when=occurred(occurredAt||new Date().toISOString()),history=[...mipeFindingHistory(finding)],id=eventId(commandId,`transition:${name}`)
 if(history.some(item=>item.id===id))return freeze(clone(finding))
 const previousTime=Date.parse(history.at(-1)?.occurredAt||0)
 if(Number.isFinite(previousTime)&&Date.parse(when)<previousTime)throw new Error('La transición MIPE no puede retroceder el tiempo del historial.')
 const event=freeze({id,type:'TRANSITION',transition:name,from:state,to:definition.to,occurredAt:when,actor:actorSnapshot(actor),notes:text(notes),metadata:freeze(clone(metadata||{}))})
 return freeze({...clone(finding),status:definition.to,updatedAt:when,...(TERMINAL.has(definition.to)?{closedAt:when,resolvedAt:when}:{}),mipeHistory:uniqueHistory([...history,event]),mipeHistoryVersion:history.length+1})
}

export function correctMipeFinding(finding,patch,{commandId,actor={},occurredAt,reason}={}){
 const correctionReason=required(reason,'El motivo de la corrección'),input=patch&&typeof patch==='object'&&!Array.isArray(patch)?patch:{}
 for(const key of Object.keys(input))if(FORBIDDEN_CORRECTION_FIELDS.has(key)||!CORRECTABLE_FIELDS.includes(key))throw new Error(`El campo ${key} no puede reescribirse mediante una corrección MIPE.`)
 const changes={}
 for(const key of CORRECTABLE_FIELDS){if(input[key]===undefined)continue;const before=finding?.[key]??'',after=input[key]??'';if(JSON.stringify(before)!==JSON.stringify(after))changes[key]={before:clone(before),after:clone(after)}}
 if(!Object.keys(changes).length)throw new Error('La corrección MIPE no contiene cambios efectivos.')
 const when=occurred(occurredAt||new Date().toISOString()),history=[...mipeFindingHistory(finding)],id=eventId(commandId,'correction')
 if(history.some(item=>item.id===id))return freeze(clone(finding))
 const previousTime=Date.parse(history.at(-1)?.occurredAt||0)
 if(Number.isFinite(previousTime)&&Date.parse(when)<previousTime)throw new Error('La corrección MIPE no puede retroceder el tiempo del historial.')
 const event=freeze({id,type:'CORRECTION',from:text(finding?.status),to:text(finding?.status),occurredAt:when,actor:actorSnapshot(actor),reason:correctionReason,changes:freeze(changes)})
 const next={...clone(finding),updatedAt:when,mipeHistory:uniqueHistory([...history,event]),mipeHistoryVersion:history.length+1}
 for(const[key,change]of Object.entries(changes))next[key]=clone(change.after)
 return freeze(next)
}

export function verifyMipeFindingHistory(finding){
 const errors=[],history=list(finding?.mipeHistory)
 if(!history.length)return{valid:false,errors:['El Finding no tiene historial MIPE materializado.']}
 const ids=new Set(),first=history[0]
 if(!['CREATED','IMPORTED'].includes(first?.type))errors.push('El primer evento MIPE debe ser CREATED o IMPORTED.')
 let state=first?.to||'';let previousTime=Date.parse(first?.occurredAt||'')
 for(const event of history){
  if(ids.has(event?.id))errors.push(`eventId MIPE duplicado: ${event?.id}`);ids.add(event?.id)
  const time=Date.parse(event?.occurredAt||'');if(Number.isNaN(time))errors.push(`Fecha inválida en ${event?.id}`);else if(Number.isFinite(previousTime)&&time<previousTime)errors.push(`Tiempo regresivo en ${event?.id}`);previousTime=time
  if(event===first)continue
  if(event.type==='TRANSITION'){
   const definition=TRANSITIONS[event.transition]
   if(!definition||event.from!==state||!definition.from.includes(event.from)||definition.to!==event.to)errors.push(`Transición inválida en ${event.id}`)
   state=event.to
  }else if(event.type==='CORRECTION'){
   if(event.from!==state||event.to!==state)errors.push(`Corrección alteró estado en ${event.id}`)
  }else errors.push(`Tipo de evento MIPE desconocido en ${event.id}`)
 }
 if(state!==finding?.status)errors.push('El estado actual no coincide con el último evento MIPE.')
 if(Number(finding?.mipeHistoryVersion)!==history.length)errors.push('La versión de historial MIPE no coincide con su longitud.')
 return{valid:errors.length===0,errors}
}

export function transitionNameForResolution(status){
 const value=text(status)
 if(value===MIPE_FINDING_STATES.RESOLVED)return MIPE_FINDING_TRANSITIONS.RESOLVE
 if(value===MIPE_FINDING_STATES.FALSE_POSITIVE)return MIPE_FINDING_TRANSITIONS.MARK_FALSE_POSITIVE
 if(value===MIPE_FINDING_STATES.PLANT_REMOVED)return MIPE_FINDING_TRANSITIONS.MARK_PLANT_REMOVED
 throw new Error('El estado solicitado no es una resolución terminal MIPE válida.')
}
