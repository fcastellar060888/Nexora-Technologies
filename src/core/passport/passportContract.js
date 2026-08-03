const OBJECT_TYPE_PATTERN=/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$/
export const DETERMINISTIC_TIMESTAMP='1970-01-01T00:00:00.000Z'

function requiredString(value,label){
 const normalized=String(value??'').trim()
 if(!normalized)throw new Error(`${label} es obligatorio`)
 return normalized
}

function deepClone(value,label){
 try{return structuredClone(value)}catch{throw new Error(`${label} contiene datos no serializables`)}
}

function deepFreeze(value){
 if(!value||typeof value!=='object'||Object.isFrozen(value))return value
 Object.values(value).forEach(deepFreeze)
 return Object.freeze(value)
}

function objectValue(value,label){
 if(value===null||Array.isArray(value)||typeof value!=='object')throw new Error(`${label} debe ser un objeto`)
 return deepFreeze(deepClone(value,label))
}

function arrayValue(value,label){
 if(!Array.isArray(value))throw new Error(`${label} debe ser una lista`)
 return deepFreeze(deepClone(value,label))
}

function validObjectShape(value){
 return Boolean(value
  &&typeof value==='object'
  &&!Array.isArray(value)
  &&requiredString(value.objectType,'El tipo de objeto')
  &&OBJECT_TYPE_PATTERN.test(String(value.objectType).trim())
  &&requiredString(value.objectId,'El identificador del objeto')
  &&requiredString(value.organizationId,'La empresa')
  &&requiredString(value.label,'La etiqueta del objeto')
  &&requiredString(value.status,'El estado del objeto')
  &&Number.isInteger(value.version)
  &&value.version>=1
  &&!Number.isNaN(Date.parse(value.createdAt))
  &&!Number.isNaN(Date.parse(value.updatedAt))
  &&Date.parse(value.updatedAt)>=Date.parse(value.createdAt)
  &&value.identity!==null&&!Array.isArray(value.identity)&&typeof value.identity==='object'
  &&value.attributes!==null&&!Array.isArray(value.attributes)&&typeof value.attributes==='object'
  &&value.metadata!==null&&!Array.isArray(value.metadata)&&typeof value.metadata==='object')
}

function uniqueBy(items,keyFor,label){
 const seen=new Set()
 return items.map(item=>deepClone(item,label)).filter(item=>{
  const key=keyFor(item)
  if(seen.has(key))return false
  seen.add(key)
  return true
 })
}

function normalizeRelationships(relationships,object){
 if(!Array.isArray(relationships))throw new Error('Las relaciones debe ser una lista')
 return deepFreeze(uniqueBy(relationships,relationship=>{
  if(!relationship||typeof relationship!=='object'||Array.isArray(relationship))throw new Error('Cada relación debe ser un objeto')
  const type=requiredString(relationship.type,'El tipo de relación')
  const targetType=requiredString(relationship.targetType,'El tipo del destino')
  const targetId=requiredString(relationship.targetId,'El identificador del destino')
  if(!OBJECT_TYPE_PATTERN.test(targetType))throw new Error('El tipo del destino debe usar una nomenclatura estable en minúsculas')
  const targetOrganizationId=relationship.targetOrganizationId??relationship.organizationId
  if(targetOrganizationId&&String(targetOrganizationId).trim()!==object.organizationId)throw new Error('El Passport no puede relacionar objetos de otra empresa')
  return`${type}:${targetType}:${targetId}`
 },'Las relaciones'))
}

function normalizeIndicators(indicators){
 if(!Array.isArray(indicators))throw new Error('Los indicadores debe ser una lista')
 return deepFreeze(uniqueBy(indicators,indicator=>{
  if(!indicator||typeof indicator!=='object'||Array.isArray(indicator))throw new Error('Cada indicador debe ser un objeto')
  return requiredString(indicator.key,'La clave del indicador')
 },'Los indicadores'))
}

function normalizeIdentified(items,label,{required=false}={}){
 if(!Array.isArray(items))throw new Error(`${label} debe ser una lista`)
 return deepFreeze(uniqueBy(items,item=>{
  if(!item||typeof item!=='object'||Array.isArray(item))throw new Error(`Cada elemento de ${label.toLowerCase()} debe ser un objeto`)
  const identity=item.id??item.key??item.eventId
  if(identity===null||identity===undefined||String(identity).trim()===''){
   if(required)throw new Error(`Cada elemento de ${label.toLowerCase()} requiere identidad`)
   return JSON.stringify(item)
  }
  return String(identity).trim()
 },label))
}

export function createIntelligentObject({
 objectType,
 objectId,
 organizationId,
 siteId=null,
 label,
 status='active',
 identity={},
 attributes={},
 metadata={},
 createdAt=DETERMINISTIC_TIMESTAMP,
 updatedAt=createdAt,
 version=1
}){
 const normalizedType=requiredString(objectType,'El tipo de objeto')
 if(!OBJECT_TYPE_PATTERN.test(normalizedType))throw new Error('El tipo de objeto debe usar una nomenclatura estable en minúsculas')
 if(!Number.isInteger(version)||version<1)throw new Error('La versión del objeto debe ser un entero positivo')
 const createdTime=Date.parse(createdAt),updatedTime=Date.parse(updatedAt)
 if(Number.isNaN(createdTime)||Number.isNaN(updatedTime))throw new Error('Las fechas del objeto no son válidas')
 if(updatedTime<createdTime)throw new Error('La fecha de actualización no puede ser anterior a la creación')

 return deepFreeze({
  objectType:normalizedType,
  objectId:requiredString(objectId,'El identificador del objeto'),
  organizationId:requiredString(organizationId,'La empresa'),
  siteId:siteId===null||siteId===undefined||String(siteId).trim()===''?null:String(siteId).trim(),
  label:requiredString(label,'La etiqueta del objeto'),
  status:requiredString(status,'El estado del objeto'),
  version,
  createdAt:new Date(createdTime).toISOString(),
  updatedAt:new Date(updatedTime).toISOString(),
  identity:objectValue(identity,'La identidad'),
  attributes:objectValue(attributes,'Los atributos'),
  metadata:objectValue(metadata,'La metadata')
 })
}

export function createPassport({
 object,
 relationships=[],
 documents=[],
 indicators=[],
 risks=[],
 actions=[],
 timeline=[],
 decisionContext={},
 generatedAt
}){
 if(!isIntelligentObject(object))throw new Error('El Passport requiere un Objeto Inteligente válido')
 const projectionTime=generatedAt??object.updatedAt??object.createdAt??DETERMINISTIC_TIMESTAMP
 if(Number.isNaN(Date.parse(projectionTime)))throw new Error('La fecha de generación del Passport no es válida')

 return deepFreeze({
  passportId:`${object.organizationId}:${object.objectType}:${object.objectId}`,
  generatedAt:new Date(projectionTime).toISOString(),
  object,
  relationships:normalizeRelationships(relationships,object),
  documents:normalizeIdentified(documents,'Los documentos'),
  indicators:normalizeIndicators(indicators),
  risks:normalizeIdentified(risks,'Los riesgos'),
  actions:normalizeIdentified(actions,'Las acciones',{required:true}),
  timeline:normalizeIdentified(timeline,'El historial'),
  decisionContext:objectValue(decisionContext,'El contexto de decisión')
 })
}

export function isIntelligentObject(value){
 try{return validObjectShape(value)}catch{return false}
}

export function passportObjectRef(passport){
 if(!passport?.object||!isIntelligentObject(passport.object))return null
 const{objectType,objectId,organizationId,siteId}=passport.object
 return Object.freeze({objectType,objectId,organizationId,siteId})
}
