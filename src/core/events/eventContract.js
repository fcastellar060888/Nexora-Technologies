const EVENT_NAME_PATTERN=/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){2,}$/

function requiredString(value,label){
 const normalized=String(value||'').trim()
 if(!normalized)throw new Error(`${label} es obligatorio`)
 return normalized
}

function immutableCopy(value,label){
 try{
  const copy=structuredClone(value)
  const freeze=current=>{
   if(!current||typeof current!=='object'||Object.isFrozen(current))return current
   Object.values(current).forEach(freeze)
   return Object.freeze(current)
  }
  return freeze(copy)
 }catch{
  throw new Error(`${label} debe contener datos serializables`)
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
