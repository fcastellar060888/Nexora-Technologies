function requiredText(value,label){
 const normalized=String(value??'').trim()
 if(!normalized)throw new Error(`${label} es obligatorio`)
 return normalized
}

function clone(value){return value===undefined?undefined:structuredClone(value)}

function freeze(value){
 if(value===null||typeof value!=='object')return value
 if(Array.isArray(value))return Object.freeze(value.map(freeze))
 const result={}
 for(const[key,item]of Object.entries(value))result[key]=freeze(item)
 return Object.freeze(result)
}

function normalizeTarget(target){
 if(!target||typeof target!=='object')throw new Error('El objeto objetivo es obligatorio')
 return Object.freeze({
  type:requiredText(target.type,'El tipo de objeto'),
  id:requiredText(target.id,'El identificador del objeto'),
  organizationId:requiredText(target.organizationId,'La empresa'),
  siteId:target.siteId?String(target.siteId).trim():null,
  version:Number.isInteger(target.version)&&target.version>0?target.version:null,
  snapshot:freeze(clone(target.snapshot??{}))
 })
}

function canonical(value){
 if(value===null||typeof value!=='object')return JSON.stringify(value)
 if(Array.isArray(value))return`[${value.map(canonical).join(',')}]`
 return`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
}

function publicationFailed(result){
 return Boolean(result&&(result.pending===true||Number(result.failed)>0))
}

function publicationEventId(result,fallback){
 return result?.event?.eventId||result?.eventId||fallback
}

function scopedIdempotencyKey({definition,target,key}){
 const normalized=String(key??'').trim()
 if(!normalized)return null
 return`${target.organizationId}::${definition.id}::${target.type}::${target.id}::${normalized}`
}

function eventIdFor(scope,suffix){return scope?`action:${scope}:${suffix}`:crypto.randomUUID()}

export function defineAction({
 id,
 label,
 targetTypes=[],
 eventName,
 authorize,
 validate,
 execute
}){
 const normalizedId=requiredText(id,'El identificador de la acción')
 const normalizedLabel=requiredText(label,'El nombre de la acción')
 const normalizedEventName=requiredText(eventName,'El evento de la acción')
 if(!/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){2,}$/.test(normalizedEventName))throw new Error('El evento de la acción debe usar el formato dominio.entidad.accion')
 if(typeof execute!=='function')throw new Error('La acción debe declarar execute()')
 const types=[...new Set((targetTypes||[]).map(value=>requiredText(value,'El tipo de objeto permitido')))]
 return Object.freeze({
  id:normalizedId,
  label:normalizedLabel,
  targetTypes:Object.freeze(types),
  eventName:normalizedEventName,
  authorize:typeof authorize==='function'?authorize:null,
  validate:typeof validate==='function'?validate:null,
  execute
 })
}

export function createActionEngine({publishEvent,maxIdempotencyEntries=10000}={}){
 if(!Number.isInteger(maxIdempotencyEntries)||maxIdempotencyEntries<=0)throw new Error('El límite de idempotencia debe ser un entero positivo')
 const registry=new Map()
 const completedExecutions=new Map()
 const inFlightExecutions=new Map()
 const emit=typeof publishEvent==='function'?publishEvent:null

 function register(definition){
  if(!definition?.id||typeof definition.execute!=='function')throw new Error('La definición de acción no es válida')
  if(registry.has(definition.id))throw new Error(`La acción ${definition.id} ya está registrada`)
  registry.set(definition.id,definition)
  return()=>registry.delete(definition.id)
 }

 function get(actionId){return registry.get(actionId)||null}

 function list({targetType}={}){
  return[...registry.values()].filter(definition=>!targetType||definition.targetTypes.length===0||definition.targetTypes.includes(targetType))
 }

 async function evaluate(actionId,{target,input={},actor={},context={}}={}){
  const definition=get(requiredText(actionId,'La acción'))
  if(!definition)return{allowed:false,reason:'La acción no existe'}
  const normalizedTarget=normalizeTarget(target)
  if(definition.targetTypes.length&&!definition.targetTypes.includes(normalizedTarget.type))return{allowed:false,reason:'La acción no aplica a este tipo de objeto'}
  const envelope={target:normalizedTarget,input:freeze(clone(input)),actor:freeze(clone(actor)),context:freeze(clone(context))}
  if(definition.authorize){
   const allowed=await definition.authorize(envelope)
   if(allowed!==true)return{allowed:false,reason:typeof allowed==='string'?allowed:'No tienes permiso para ejecutar esta acción'}
  }
  if(definition.validate){
   const valid=await definition.validate(envelope)
   if(valid!==true)return{allowed:false,reason:typeof valid==='string'?valid:'La acción no cumple las condiciones operativas'}
  }
  return{allowed:true,definition,target:normalizedTarget,envelope}
 }

 function remember(scope,fingerprint,result){
  if(!scope)return
  completedExecutions.delete(scope)
  completedExecutions.set(scope,Object.freeze({fingerprint,result}))
  while(completedExecutions.size>maxIdempotencyEntries)completedExecutions.delete(completedExecutions.keys().next().value)
 }

 async function emitRequired(event,label){
  if(!emit)throw new Error('El Action Engine requiere publishEvent para ejecutar acciones mutables')
  const publication=await emit(event)
  if(publicationFailed(publication)){
   const error=new Error(`${label} no pudo persistirse de forma confiable`)
   error.code='ACTION_EVENT_PERSISTENCE_FAILED'
   error.publication=publication
   throw error
  }
  return publication
 }

 async function executeOnce(evaluation,{input,actionIdempotencyKey,occurredAt,scope,fingerprint}){
  const normalizedOccurredAt=new Date(occurredAt).toISOString()
  const executionId=crypto.randomUUID()
  const requestedEventId=eventIdFor(scope,'requested')
  const requestedPublication=await emitRequired({
   eventId:requestedEventId,
   name:'core.action.requested',
   aggregateType:evaluation.target.type,
   aggregateId:evaluation.target.id,
   organizationId:evaluation.target.organizationId,
   siteId:evaluation.target.siteId,
   occurredAt:normalizedOccurredAt,
   correlationId:executionId,
   payload:{
    actionId:evaluation.definition.id,
    executionId,
    intendedEventName:evaluation.definition.eventName,
    input:clone(input),
    targetVersion:evaluation.target.version
   },
   metadata:{
    actionEngine:true,
    actionLabel:evaluation.definition.label,
    actionPhase:'requested',
    actionIdempotencyKey:actionIdempotencyKey?String(actionIdempotencyKey):null
   }
  },'La intención de la acción')

  if(requestedPublication?.duplicate===true){
   const cached=scope?completedExecutions.get(scope):null
   if(cached&&cached.fingerprint===fingerprint)return cached.result
   const error=new Error('La acción ya fue solicitada con la misma clave de idempotencia')
   error.code='ACTION_IDEMPOTENCY_DUPLICATE'
   throw error
  }

  const persistedRequestId=publicationEventId(requestedPublication,requestedEventId)
  let result
  try{
   result=await evaluation.definition.execute({
    ...evaluation.envelope,
    executionId,
    occurredAt:normalizedOccurredAt
   })
  }catch(error){
   try{
    await emitRequired({
     eventId:eventIdFor(scope,'failed'),
     name:'core.action.failed',
     aggregateType:evaluation.target.type,
     aggregateId:evaluation.target.id,
     organizationId:evaluation.target.organizationId,
     siteId:evaluation.target.siteId,
     occurredAt:new Date().toISOString(),
     correlationId:executionId,
     causationId:persistedRequestId,
     payload:{actionId:evaluation.definition.id,executionId,error:String(error?.message||error||'Error no identificado')},
     metadata:{actionEngine:true,actionLabel:evaluation.definition.label,actionPhase:'failed',actionIdempotencyKey:actionIdempotencyKey?String(actionIdempotencyKey):null}
    },'El fallo de la acción')
   }catch{/* La intención ya quedó persistida; no se oculta el error original. */}
   throw error
  }

  if(result===undefined)throw new Error(`La acción ${evaluation.definition.id} no devolvió un resultado`)
  const normalizedResult=freeze(clone(result))
  const completedEventId=eventIdFor(scope,'completed')
  const publication=await emitRequired({
   eventId:completedEventId,
   name:evaluation.definition.eventName,
   aggregateType:evaluation.target.type,
   aggregateId:evaluation.target.id,
   organizationId:evaluation.target.organizationId,
   siteId:evaluation.target.siteId,
   occurredAt:normalizedOccurredAt,
   correlationId:executionId,
   causationId:persistedRequestId,
   payload:{
    actionId:evaluation.definition.id,
    executionId,
    input:clone(input),
    result:clone(normalizedResult)
   },
   metadata:{
    actionEngine:true,
    actionLabel:evaluation.definition.label,
    actionPhase:'completed',
    actionIdempotencyKey:actionIdempotencyKey?String(actionIdempotencyKey):null
   }
  },'El evento final de la acción')

  const response=Object.freeze({
   executionId,
   actionId:evaluation.definition.id,
   target:evaluation.target,
   result:normalizedResult,
   requestEvent:requestedPublication??null,
   event:publication??null
  })
  remember(scope,fingerprint,response)
  return response
 }

 async function execute(actionId,{target,input={},actor={},context={},actionIdempotencyKey=null,occurredAt=new Date().toISOString()}={}){
  const evaluation=await evaluate(actionId,{target,input,actor,context})
  if(!evaluation.allowed)throw new Error(evaluation.reason)
  if(Number.isNaN(Date.parse(occurredAt)))throw new Error('La fecha de ejecución no es válida')
  if(!emit)throw new Error('El Action Engine requiere publishEvent para ejecutar acciones mutables')

  const scope=scopedIdempotencyKey({definition:evaluation.definition,target:evaluation.target,key:actionIdempotencyKey})
  const fingerprint=canonical({target:evaluation.target,input:evaluation.envelope.input,actor:evaluation.envelope.actor,context:evaluation.envelope.context})
  if(!scope)return executeOnce(evaluation,{input,actionIdempotencyKey,occurredAt,scope,fingerprint})

  const completed=completedExecutions.get(scope)
  if(completed){
   if(completed.fingerprint!==fingerprint)throw new Error('La clave de idempotencia ya fue usada con datos diferentes')
   return completed.result
  }
  const active=inFlightExecutions.get(scope)
  if(active){
   if(active.fingerprint!==fingerprint)throw new Error('La clave de idempotencia ya está en uso con datos diferentes')
   return active.promise
  }

  const promise=executeOnce(evaluation,{input,actionIdempotencyKey,occurredAt,scope,fingerprint}).finally(()=>inFlightExecutions.delete(scope))
  inFlightExecutions.set(scope,Object.freeze({fingerprint,promise}))
  return promise
 }

 function status(){return Object.freeze({registeredActions:registry.size,idempotencyEntries:completedExecutions.size,inFlightExecutions:inFlightExecutions.size,maxIdempotencyEntries})}

 return Object.freeze({register,get,list,evaluate,execute,status})
}
