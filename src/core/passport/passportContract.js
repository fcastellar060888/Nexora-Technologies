const OBJECT_TYPE_PATTERN=/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$/

function requiredString(value,label){
 const normalized=String(value||'').trim()
 if(!normalized)throw new Error(`${label} es obligatorio`)
 return normalized
}

function objectValue(value,label){
 if(value===null||Array.isArray(value)||typeof value!=='object')throw new Error(`${label} debe ser un objeto`)
 return structuredClone(value)
}

function arrayValue(value,label){
 if(!Array.isArray(value))throw new Error(`${label} debe ser una lista`)
 return structuredClone(value)
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
 createdAt=new Date().toISOString(),
 updatedAt=createdAt,
 version=1
}){
 const normalizedType=requiredString(objectType,'El tipo de objeto')
 if(!OBJECT_TYPE_PATTERN.test(normalizedType))throw new Error('El tipo de objeto debe usar una nomenclatura estable en minúsculas')
 if(!Number.isInteger(version)||version<1)throw new Error('La versión del objeto debe ser un entero positivo')
 if(Number.isNaN(Date.parse(createdAt))||Number.isNaN(Date.parse(updatedAt)))throw new Error('Las fechas del objeto no son válidas')

 return Object.freeze({
  objectType:normalizedType,
  objectId:requiredString(objectId,'El identificador del objeto'),
  organizationId:requiredString(organizationId,'La empresa'),
  siteId:siteId?String(siteId):null,
  label:requiredString(label,'La etiqueta del objeto'),
  status:requiredString(status,'El estado del objeto'),
  version,
  createdAt:new Date(createdAt).toISOString(),
  updatedAt:new Date(updatedAt).toISOString(),
  identity:Object.freeze(objectValue(identity,'La identidad')),
  attributes:Object.freeze(objectValue(attributes,'Los atributos')),
  metadata:Object.freeze(objectValue(metadata,'La metadata'))
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
 generatedAt=new Date().toISOString()
}){
 if(!isIntelligentObject(object))throw new Error('El Passport requiere un Objeto Inteligente válido')
 if(Number.isNaN(Date.parse(generatedAt)))throw new Error('La fecha de generación del Passport no es válida')

 return Object.freeze({
  passportId:`${object.organizationId}:${object.objectType}:${object.objectId}`,
  generatedAt:new Date(generatedAt).toISOString(),
  object,
  relationships:Object.freeze(arrayValue(relationships,'Las relaciones')),
  documents:Object.freeze(arrayValue(documents,'Los documentos')),
  indicators:Object.freeze(arrayValue(indicators,'Los indicadores')),
  risks:Object.freeze(arrayValue(risks,'Los riesgos')),
  actions:Object.freeze(arrayValue(actions,'Las acciones')),
  timeline:Object.freeze(arrayValue(timeline,'El historial')),
  decisionContext:Object.freeze(objectValue(decisionContext,'El contexto de decisión'))
 })
}

export function isIntelligentObject(value){
 try{
  return Boolean(createIntelligentObject(value))
 }catch{return false}
}

export function passportObjectRef(passport){
 if(!passport?.object)return null
 const{objectType,objectId,organizationId,siteId}=passport.object
 return Object.freeze({objectType,objectId,organizationId,siteId})
}
