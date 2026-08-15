const text=value=>String(value??'').trim()
const clone=value=>value===undefined?undefined:structuredClone(value)
const freeze=value=>{if(value===null||typeof value!=='object')return value;if(Array.isArray(value))return Object.freeze(value.map(freeze));const result={};for(const[key,item]of Object.entries(value))result[key]=freeze(item);return Object.freeze(result)}
const required=(value,label)=>{const normalized=text(value);if(!normalized)throw new Error(`${label} es obligatorio`);return normalized}

function targetContract(target){
 if(!target||typeof target!=='object')throw new Error('El objeto objetivo es obligatorio')
 return Object.freeze({
  type:required(target.type,'El tipo de objeto'),
  id:required(target.id,'El identificador del objeto'),
  organizationId:required(target.organizationId,'La organización'),
  siteId:text(target.siteId)||null,
  snapshot:freeze(clone(target.snapshot??{}))
 })
}

export function defineAction({id,label,targetTypes=[],authorize,validate,execute}={}){
 const actionId=required(id,'El identificador de la acción'),actionLabel=required(label,'El nombre de la acción')
 if(typeof execute!=='function')throw new Error('La acción debe declarar execute()')
 const types=Object.freeze([...new Set((targetTypes||[]).map(type=>required(type,'El tipo de objeto permitido')))])
 return Object.freeze({id:actionId,label:actionLabel,targetTypes:types,authorize:typeof authorize==='function'?authorize:null,validate:typeof validate==='function'?validate:null,execute})
}

export function createActionEngine(){
 const registry=new Map()
 function register(definition){
  if(!definition?.id||typeof definition.execute!=='function')throw new Error('La definición de acción no es válida')
  if(registry.has(definition.id))throw new Error(`La acción ${definition.id} ya está registrada`)
  registry.set(definition.id,definition)
  return()=>registry.delete(definition.id)
 }
 function get(actionId){return registry.get(text(actionId))||null}
 function list({targetType}={}){return Object.freeze([...registry.values()].filter(action=>!targetType||!action.targetTypes.length||action.targetTypes.includes(targetType)))}
 async function evaluate(actionId,{target,input={},actor={},context={}}={}){
  const definition=get(required(actionId,'La acción'))
  if(!definition)return Object.freeze({allowed:false,reason:'La acción no existe'})
  const normalizedTarget=targetContract(target)
  if(definition.targetTypes.length&&!definition.targetTypes.includes(normalizedTarget.type))return Object.freeze({allowed:false,reason:'La acción no aplica a este tipo de objeto'})
  const envelope=Object.freeze({target:normalizedTarget,input:freeze(clone(input)),actor:freeze(clone(actor)),context:freeze(clone(context))})
  if(definition.authorize){const allowed=await definition.authorize(envelope);if(allowed!==true)return Object.freeze({allowed:false,reason:typeof allowed==='string'?allowed:'No tienes permiso para ejecutar esta acción'})}
  if(definition.validate){const valid=await definition.validate(envelope);if(valid!==true)return Object.freeze({allowed:false,reason:typeof valid==='string'?valid:'La acción no cumple las condiciones operativas'})}
  return Object.freeze({allowed:true,definition,target:normalizedTarget,envelope})
 }
 async function execute(actionId,request={}){
  const evaluation=await evaluate(actionId,request)
  if(!evaluation.allowed)throw new Error(evaluation.reason)
  const result=await evaluation.definition.execute(evaluation.envelope)
  if(result===undefined)throw new Error(`La acción ${evaluation.definition.id} no devolvió un resultado`)
  return Object.freeze({actionId:evaluation.definition.id,target:evaluation.target,result:freeze(clone(result))})
 }
 function status(){return Object.freeze({registeredActions:registry.size})}
 return Object.freeze({register,get,list,evaluate,execute,status})
}
