const EVENT_NAME_PATTERN=/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){2,}$/

function requiredString(value,label){
 const normalized=String(value||'').trim()
 if(!normalized)throw new Error(`${label} es obligatorio`)
 return normalized
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
  aggregate:{
   type:requiredString(aggregateType,'El tipo de objeto'),
   id:requiredString(aggregateId,'El identificador del objeto')
  },
  context:{
   organizationId:requiredString(organizationId,'La empresa'),
   siteId:siteId?String(siteId):null,
   actorId:requiredString(actorId,'El actor')
  },
  occurredAt:new Date(occurredAt).toISOString(),
  correlationId:correlationId?String(correlationId):null,
  causationId:causationId?String(causationId):null,
  payload:Object.freeze({...payload}),
  metadata:Object.freeze({...metadata})
 })
}

export function isDomainEvent(value){
 try{
  return Boolean(createDomainEvent({
   name:value?.name,
   aggregateType:value?.aggregate?.type,
   aggregateId:value?.aggregate?.id,
   organizationId:value?.context?.organizationId,
   siteId:value?.context?.siteId,
   actorId:value?.context?.actorId,
   occurredAt:value?.occurredAt,
   payload:value?.payload,
   metadata:value?.metadata,
   eventId:value?.eventId,
   version:value?.version,
   correlationId:value?.correlationId,
   causationId:value?.causationId
  }))
 }catch{return false}
}
