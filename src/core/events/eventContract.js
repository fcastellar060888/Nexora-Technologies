const EVENT_NAME_PATTERN=/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){2,}$/

function requiredString(value,label){
 const normalized=String(value||'').trim()
 if(!normalized)throw new Error(`${label} es obligatorio`)
 return normalized
}

function immutableCopy(value,label){
 const active=new WeakSet()
 function copy(current,path){
  if(current===null||typeof current==='string'||typeof current==='boolean')return current
  if(typeof current==='number'){
   if(!Number.isFinite(current))throw new Error(`${path} debe contener números finitos`)
   return Object.is(current,-0)?0:current
  }
  if(typeof current!=='object')throw new Error(`${path} debe contener datos JSON serializables`)
  if(active.has(current))throw new Error(`${path} no puede contener referencias cíclicas`)
  active.add(current)
  try{
   if(Array.isArray(current)){
    if(Object.getOwnPropertySymbols(current).length)throw new Error(`${path} no puede contener propiedades Symbol`)
    for(let index=0;index<current.length;index+=1)if(!Object.hasOwn(current,index))throw new Error(`${path} no puede contener posiciones vacías`)
    const extraKeys=Object.keys(current).filter(key=>!/^\d+$/.test(key)||Number(key)>=current.length)
    if(extraKeys.length)throw new Error(`${path} no puede contener propiedades adicionales`)
    return Object.freeze(current.map((item,index)=>copy(item,`${path}[${index}]`)))
   }
   const prototype=Object.getPrototypeOf(current)
   if(prototype!==Object.prototype&&prototype!==null)throw new Error(`${path} debe contener únicamente objetos planos`)
   if(Object.getOwnPropertySymbols(current).length)throw new Error(`${path} no puede contener propiedades Symbol`)
   if(Object.getOwnPropertyNames(current).length!==Object.keys(current).length)throw new Error(`${path} no puede contener propiedades no enumerables`)
   const result={}
   for(const key of Object.keys(current))result[key]=copy(current[key],`${path}.${key}`)
   return Object.freeze(result)
  }finally{active.delete(current)}
 }
 try{return copy(value,label)}catch(error){
  if(error instanceof Error&&error.message.startsWith(label))throw error
  throw new Error(`${label} debe contener datos JSON serializables`)
 }
}

export function createDomainEvent({
 name,
 aggregateType,
 aggregateId,
 organizationId,
 siteId=null,
 actorId='system',
 occurredAt=new Date().toISOString(),
 payload={},
 metadata={},
 eventId=crypto.randomUUID(),
 version=1,
 correlationId=null,
 causationId=null
}){
 const normalizedName=requiredString(name,'El nombre del evento')
 if(!EVENT_NAME_PATTERN.test(normalizedName))throw new Error('El evento debe usar el formato dominio.entidad.accion')
 if(!Number.isInteger(version)||version<1)throw new Error('La versión del evento debe ser un entero positivo')
 if(Number.isNaN(Date.parse(occurredAt)))throw new Error('La fecha del evento no es válida')
 if(payload===null||Array.isArray(payload)||typeof payload!=='object')throw new Error('El payload del evento debe ser un objeto')
 if(metadata===null||Array.isArray(metadata)||typeof metadata!=='object')throw new Error('La metadata del evento debe ser un objeto')

 return Object.freeze({
  eventId:requiredString(eventId,'El identificador del evento'),
  name:normalizedName,
  version,
  aggregate:Object.freeze({
   type:requiredString(aggregateType,'El tipo de objeto'),
   id:requiredString(aggregateId,'El identificador del objeto')
  }),
  context:Object.freeze({
   organizationId:requiredString(organizationId,'La empresa'),
   siteId:siteId?String(siteId):null,
   actorId:requiredString(actorId,'El actor')
  }),
  occurredAt:new Date(occurredAt).toISOString(),
  correlationId:correlationId?String(correlationId):null,
  causationId:causationId?String(causationId):null,
  payload:immutableCopy(payload,'El payload del evento'),
  metadata:immutableCopy(metadata,'La metadata del evento')
 })
}

export function isDomainEvent(value){
 if(!value||typeof value!=='object')return false
 const requiredOwnFields=['eventId','name','version','aggregate','context','occurredAt','payload','metadata']
 if(requiredOwnFields.some(field=>!Object.hasOwn(value,field)))return false
 if(!value.aggregate||typeof value.aggregate!=='object'||!Object.hasOwn(value.aggregate,'type')||!Object.hasOwn(value.aggregate,'id'))return false
 if(!value.context||typeof value.context!=='object'||!Object.hasOwn(value.context,'organizationId')||!Object.hasOwn(value.context,'actorId'))return false
 try{
  createDomainEvent({
   name:value.name,
   aggregateType:value.aggregate.type,
   aggregateId:value.aggregate.id,
   organizationId:value.context.organizationId,
   siteId:value.context.siteId,
   actorId:value.context.actorId,
   occurredAt:value.occurredAt,
   payload:value.payload,
   metadata:value.metadata,
   eventId:value.eventId,
   version:value.version,
   correlationId:value.correlationId,
   causationId:value.causationId
  })
  return true
 }catch{return false}
}
