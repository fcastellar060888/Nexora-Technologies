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

export function createActionEngine({publishEvent}={}){
 const registry=new Map()
 const emit=typeof publishEvent==='function'?publishEvent:async()=>null

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

 async function execute(actionId,{target,input={},actor={},context={},actionIdempotencyKey=null,occurredAt=new Date().toISOString()}={}){
  const evaluation=await evaluate(actionId,{target,input,actor,context})
  if(!evaluation.allowed)throw new Error(evaluation.reason)
  if(Number.isNaN(Date.parse(occurredAt)))throw new Error('La fecha de ejecución no es válida')
  const executionId=crypto.randomUUID()
  const result=await evaluation.definition.execute({
   ...evaluation.envelope,
   executionId,
   occurredAt:new Date(occurredAt).toISOString()
  })
  if(result===undefined)throw new Error(`La acción ${actionId} no devolvió un resultado`)
  const normalizedResult=freeze(clone(result))
  const event=await emit({
   name:evaluation.definition.eventName,
   aggregateType:evaluation.target.type,
   aggregateId:evaluation.target.id,
   organizationId:evaluation.target.organizationId,
   siteId:evaluation.target.siteId,
   payload:{
    actionId:evaluation.definition.id,
    executionId,
    input:clone(input),
    result:clone(normalizedResult)
   },
   metadata:{
    actionEngine:true,
    actionLabel:evaluation.definition.label,
    actionIdempotencyKey:actionIdempotencyKey?String(actionIdempotencyKey):null
   }
  })
  return Object.freeze({
   executionId,
   actionId:evaluation.definition.id,
   target:evaluation.target,
   result:normalizedResult,
   event:event??null
  })
 }

 return Object.freeze({register,get,list,evaluate,execute})
}
